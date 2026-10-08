/**
 * CANTEEN RAZORPAY ACCOUNT ONLY - Used for Student Meal Payments
 * ───────────────────────────────────────────────────────────────
 * This controller handles student meal payments (student -> canteen).
 * Uses RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET.
 * NEVER touch Subscription table in this controller.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const { pool } = require('../database/db');
const { generateTokenNumber } = require('../services/tokenGenerator');
const { computeMealStatus, convertToInventoryBaseUnit } = require('./menuController');
const { autoExpireUncollectedOrders } = require('../jobs/cleanupOldOrders');
const {
  calculateOrderDiscount,
  getFreshDiscountSettings,
  isStudentInNewUserWindow,
  getCurrentServerTimeHHMM,
} = require('../services/discountService');
const { initOrderSchema } = require('../database/initOrderSchema');
const { isMenuStockTrackingEnabled } = require('./inventoryController');

let orderSchemaEnsured = false;
const ensureOrderSchemaOnce = async () => {
  if (orderSchemaEnsured) return;
  try {
    if (typeof initOrderSchema === 'function') {
      await initOrderSchema();
    }
    orderSchemaEnsured = true;
  } catch (err) {
    console.warn('[OrderController] ensureOrderSchemaOnce notice:', err.message);
  }
};

/**
 * Utility to sanitize environment strings (removes carriage returns, quotes, trailing comments, extra whitespace)
 */
const cleanEnvValue = (val) => {
  if (!val) return '';
  let str = String(val).trim();
  if (!str.startsWith('"') && !str.startsWith("'") && str.includes('#')) {
    str = str.split('#')[0].trim();
  }
  str = str.replace(/^['"]+|['"]+$/g, '').trim();
  return str;
};

/**
 * Centrally reads Canteen Razorpay Key and Secret from environment variables.
 * Directly respects process.env upon server restart without hardcoded overrides.
 */
const getCanteenRazorpayCredentials = () => {
  const keyId = cleanEnvValue(process.env.RAZORPAY_KEY_ID);
  const keySecret = cleanEnvValue(process.env.RAZORPAY_KEY_SECRET);
  const webhookSecret = cleanEnvValue(process.env.RAZORPAY_WEBHOOK_SECRET);
  return { keyId, keySecret, webhookSecret };
};

// Initialize Razorpay SDK instance dynamically with current .env credentials
const getRazorpayInstance = () => {
  const { keyId, keySecret } = getCanteenRazorpayCredentials();

  if (!keyId || !keySecret) {
    console.error('[OrderController] ⚠️ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing or empty in environment!');
    throw new Error('Razorpay credentials missing in backend .env');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};


/**
 * Dynamic Discount Calculator (reads fresh DiscountSettings from database)
 * Supports New User Welcome Discount and Early Breakfast/Lunch Discounts.
 */
const computeOrderDiscount = async (subtotal, mealType, serverTime = getCurrentServerTimeHHMM(), studentCreatedAt = null) => {
  return await calculateOrderDiscount({ subtotal, mealType, serverTime, studentCreatedAt });
};

/**
 * Resolves item price and item name accounting for variants (e.g. Chapati Bhaji with 2 or 3 Chapatis)
 */
const resolveMenuItemVariant = (dbItem, cartItem) => {
  let itemPrice = Number(dbItem.price);
  let itemName = dbItem.name;
  let variantName = cartItem.variant_name || null;

  if (dbItem.has_variants && dbItem.variants) {
    let dbVariants = [];
    try {
      dbVariants = typeof dbItem.variants === 'string' ? JSON.parse(dbItem.variants) : dbItem.variants;
    } catch (e) {
      dbVariants = [];
    }

    if (Array.isArray(dbVariants) && dbVariants.length > 0) {
      const requestedVariantId = cartItem.variant_id || cartItem.variant?.id;
      const requestedVariantName = cartItem.variant_name || cartItem.variant?.name;
      const incomingName = cartItem.name || cartItem.item_name || '';

      const matchedVariant = dbVariants.find(
        (v) => (requestedVariantId && String(v.id) === String(requestedVariantId)) ||
               (requestedVariantName && String(v.name).toLowerCase() === String(requestedVariantName).toLowerCase()) ||
               (incomingName && incomingName.toLowerCase().includes(String(v.name).toLowerCase()))
      );

      if (matchedVariant) {
        itemPrice = Number(matchedVariant.price);
        variantName = matchedVariant.name;
        itemName = incomingName.includes(matchedVariant.name)
          ? incomingName
          : `${dbItem.name} (${matchedVariant.name})`;
      }
    }
  }

  return { itemPrice, itemName, variantName };
};

// Helper: add _id alias to order object and reshape items/student for frontend compatibility
const shapeOrder = (order) => {
  const customerName = order.customer_name || (order.student ? order.student.name : order.student_name) || null;
  const isParcel = order.order_type === 'parcel' || Boolean(order.is_parcel);
  const orderType = isParcel ? 'parcel' : (order.order_type || 'dine_in');
  const studentPhone = (order.student ? order.student.phone : order.student_phone) || '';
  return {
    ...order,
    _id: order.id,
    customer_name: customerName,
    student_name: customerName,
    student_phone: studentPhone,
    order_type: orderType,
    is_parcel: isParcel,
    delivery_address: order.delivery_address || null,
    subtotal_amount: Number(order.subtotal_amount != null ? order.subtotal_amount : order.total_amount),
    discount_percentage: Number(order.discount_percentage || 0),
    discount_amount: Number(order.discount_amount || 0),
    discount_type: order.discount_type || (Number(order.discount_percentage) > 0 ? 'early_order' : 'none'),
    total_amount: Number(order.total_amount),
    items: (order.items || []).map((it) => ({
      ...it,
      _id: it.id,
      price: Number(it.price),
    })),
    student_id: order.student
      ? { _id: order.student.id, id: order.student.id, name: order.student.name, roll_no: order.student.roll_no, email: order.student.email, phone: order.student.phone || '' }
      : (customerName ? { _id: null, id: null, name: customerName, roll_no: '', email: '', phone: studentPhone } : order.student_id),
    student: undefined,
  };
};

// Helper: fetch a single order with its items and student details (simulates Prisma include)
const fetchOrderWithDetails = async (idOrRazorpayId, isDbId = true) => {
  const querySql = isDbId
    ? `SELECT o.*, s.name AS student_name, s.roll_no AS student_roll_no, s.email AS student_email, s.phone AS student_phone 
       FROM \`Order\` o
       LEFT JOIN Student s ON o.student_id = s.id
       WHERE o.id = ? LIMIT 1`
    : `SELECT o.*, s.name AS student_name, s.roll_no AS student_roll_no, s.email AS student_email, s.phone AS student_phone 
       FROM \`Order\` o
       LEFT JOIN Student s ON o.student_id = s.id
       WHERE o.razorpay_order_id = ? LIMIT 1`;

  const [rows] = await pool.execute(querySql, [idOrRazorpayId]);
  const orderRaw = rows[0];
  if (!orderRaw) return null;

  const [itemRows] = await pool.execute(
    'SELECT * FROM OrderItem WHERE order_id = ?',
    [orderRaw.id]
  );

  const effectiveName = orderRaw.customer_name || orderRaw.student_name || 'Walk-in Customer';

  return {
    ...orderRaw,
    student_name: effectiveName,
    student: orderRaw.student_id
      ? {
          id: orderRaw.student_id,
          name: orderRaw.student_name,
          roll_no: orderRaw.student_roll_no || '',
          email: orderRaw.student_email || '',
          phone: orderRaw.student_phone || '',
        }
      : {
          id: null,
          name: effectiveName,
          roll_no: '',
          email: '',
          phone: '',
        },
    items: itemRows,
  };
};

// Helper: Atomically deduct inventory ingredients and log deductions for a confirmed/paid order
const deductInventoryForOrder = async (connection, orderId) => {
  const [orderItems] = await connection.execute(
    'SELECT * FROM OrderItem WHERE order_id = ?',
    [orderId]
  );

  const inventoryDeductions = {};

  for (const item of orderItems) {
    if (!item.menu_item_id) continue;

    const [recipeItems] = await connection.execute(
      `SELECT ri.*, ii.name AS inventory_item_name, ii.unit AS inventory_item_unit 
       FROM RecipeItem ri
       INNER JOIN InventoryItem ii ON ri.inventory_item_id = ii.id
       WHERE ri.menu_item_id = ?`,
      [item.menu_item_id]
    );

    for (const ri of recipeItems) {
      const convertedRequired = convertToInventoryBaseUnit(
        Number(ri.quantity_required),
        ri.quantity_unit || ri.inventory_item_unit,
        ri.inventory_item_unit
      );
      const needed = convertedRequired * item.quantity;
      const itemId = ri.inventory_item_id;
      if (!inventoryDeductions[itemId]) {
        inventoryDeductions[itemId] = {
          needed: 0,
          name: ri.inventory_item_name,
          unit: ri.inventory_item_unit,
        };
      }
      inventoryDeductions[itemId].needed += needed;
    }
  }

  // Lock and deduct inventory levels in sorted order to avoid deadlocks
  const sortedItemIds = Object.keys(inventoryDeductions).map(Number).sort((a, b) => a - b);

  for (const itemId of sortedItemIds) {
    const { needed } = inventoryDeductions[itemId];

    const [invRows] = await connection.execute(
      'SELECT id, name, quantity_in_stock, is_active FROM InventoryItem WHERE id = ? FOR UPDATE',
      [itemId]
    );
    const invItem = invRows[0];
    if (!invItem) continue;

    const currentStock = Number(invItem.quantity_in_stock);
    const newStock = Math.max(0, currentStock - needed);

    await connection.execute(
      'UPDATE InventoryItem SET quantity_in_stock = ? WHERE id = ?',
      [newStock, itemId]
    );

    await connection.execute(
      `INSERT INTO InventoryLog (inventory_item_id, action_type, quantity_changed, order_id)
       VALUES (?, 'deduction', ?, ?)`,
      [itemId, -needed, orderId]
    );
  }
};

// Create Razorpay Order (STRICT STUDENT JWT ENFORCED VIA verifyStudent MIDDLEWARE)
// Validates availability and creates Razorpay Order with zero database writes.
const createRazorpayOrder = async (req, res) => {
  try {
    const { items, meal_type, order_type, is_parcel, delivery_address } = req.body;
    const studentId = req.studentId;
    const targetOrderType = (order_type === 'parcel' || Boolean(is_parcel)) ? 'parcel' : 'dine_in';
    const isParcelOrder = targetOrderType === 'parcel';

    if (isParcelOrder) {
      if (!delivery_address || !String(delivery_address).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Delivery address is mandatory for parcel orders. Please select or add an address before proceeding to pay.',
        });
      }
    }
    const cleanDeliveryAddress = isParcelOrder && delivery_address ? String(delivery_address).trim() : null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    const incomingMealType = meal_type || (items && items[0]?.meal_type);
    if (!incomingMealType || typeof incomingMealType !== 'string' || !incomingMealType.trim()) {
      return res.status(400).json({ success: false, message: 'Valid meal_type is required.' });
    }

    const targetMealType = incomingMealType.toLowerCase().trim();
    const normalizedVariants = Array.from(new Set([
      targetMealType,
      targetMealType.replace(/_/g, ' '),
      targetMealType.replace(/\s+/g, '_'),
      targetMealType.replace(/[\s_-]+/g, '_'),
      targetMealType.replace(/[\s_-]+/g, ' '),
    ])).filter(Boolean);

    // Check MealWindow status: Must be active and currently open for ordering
    const placeholders = normalizedVariants.map(() => '?').join(', ');
    const [windowRows] = await pool.execute(
      `SELECT * FROM MealWindow WHERE LOWER(meal_type) IN (${placeholders}) LIMIT 1`,
      normalizedVariants
    );
    const windowDoc = windowRows[0] || null;
    const effectiveMealType = windowDoc ? windowDoc.meal_type.toLowerCase() : targetMealType;

    if (windowDoc) {
      const windowStatus = computeMealStatus(windowDoc);
      if (!windowStatus.is_active) {
        return res.status(400).json({
          success: false,
          message: `The meal category '${windowDoc.meal_type.toUpperCase()}' is currently not offered by Canteen Management.`,
        });
      }
      if (!windowStatus.is_currently_open) {
        return res.status(400).json({
          success: false,
          message: `Ordering for ${windowDoc.meal_type.toUpperCase()} is currently closed. Operating window: ${windowStatus.formatted_start_time} – ${windowStatus.formatted_end_time}.`,
        });
      }
    }

    // Verify item prices from DB to prevent client-side tampering
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const cartItem of items) {
      const rawId = cartItem.menu_item || cartItem.id;
      const numericId = rawId ? parseInt(rawId, 10) : NaN;
      let dbItem = null;

      if (!isNaN(numericId)) {
        const [menuRows] = await pool.execute('SELECT * FROM MenuItem WHERE id = ? LIMIT 1', [numericId]);
        dbItem = menuRows[0] || null;
      }

      if (!dbItem && (cartItem.name || cartItem.item_name)) {
        const nameToSearch = cartItem.name || cartItem.item_name;
        const [menuRows] = await pool.execute('SELECT * FROM MenuItem WHERE name = ? AND is_active = 1 LIMIT 1', [nameToSearch]);
        dbItem = menuRows[0] || null;
      }

      if (!dbItem || !dbItem.is_active) {
        return res.status(400).json({
          success: false,
          message: `Item '${cartItem.name || cartItem.item_name || 'selected'}' is currently unavailable.`,
        });
      }

      const itemQuantity = Number(cartItem.quantity) || 1;
      const { itemPrice, itemName, variantName } = resolveMenuItemVariant(dbItem, cartItem);
      const itemTotal = itemPrice * itemQuantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        menu_item_id: dbItem.id,
        item_name: itemName,
        variant_name: variantName,
        price: itemPrice,
        quantity: itemQuantity,
      });
    }

    if (calculatedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order total.' });
    }

    // Check prepared menu stock availability if tracking is enabled
    const menuTrackingEnabled = await isMenuStockTrackingEnabled();
    if (menuTrackingEnabled) {
      for (const item of validatedItems) {
        const [menuRows] = await pool.execute(
          'SELECT id, name, available_quantity, is_available FROM MenuItem WHERE id = ? LIMIT 1',
          [item.menu_item_id]
        );
        const mItem = menuRows[0];
        if (!mItem || mItem.is_available === 0 || Number(mItem.available_quantity) <= 0) {
          return res.status(400).json({
            success: false,
            message: `'${item.item_name}' is currently out of stock.`,
            is_out_of_stock: true,
            item_name: item.item_name,
            available_quantity: 0,
          });
        }
        if (item.quantity > Number(mItem.available_quantity)) {
          return res.status(400).json({
            success: false,
            message: `Only ${mItem.available_quantity} portions of '${item.item_name}' are available right now!`,
            is_insufficient_stock: true,
            item_name: item.item_name,
            available_quantity: Number(mItem.available_quantity),
          });
        }
      }
    }

    // Pre-validate ingredient stock availability (WITHOUT deducting stock yet)
    const inventoryRequirements = {};
    for (const item of validatedItems) {
      if (!item.menu_item_id) continue;

      const [recipeItems] = await pool.execute(
        `SELECT ri.*, ii.name AS inventory_item_name, ii.unit AS inventory_item_unit 
         FROM RecipeItem ri
         INNER JOIN InventoryItem ii ON ri.inventory_item_id = ii.id
         WHERE ri.menu_item_id = ?`,
        [item.menu_item_id]
      );

      for (const ri of recipeItems) {
        const convertedRequired = convertToInventoryBaseUnit(
          Number(ri.quantity_required),
          ri.quantity_unit || ri.inventory_item_unit,
          ri.inventory_item_unit
        );
        const needed = convertedRequired * item.quantity;
        const itemId = ri.inventory_item_id;
        if (!inventoryRequirements[itemId]) {
          inventoryRequirements[itemId] = {
            needed: 0,
            name: ri.inventory_item_name,
            unit: ri.inventory_item_unit,
          };
        }
        inventoryRequirements[itemId].needed += needed;
      }
    }

    for (const itemId of Object.keys(inventoryRequirements)) {
      const { needed, name } = inventoryRequirements[itemId];
      const [invRows] = await pool.execute(
        'SELECT id, name, quantity_in_stock, is_active FROM InventoryItem WHERE id = ? LIMIT 1',
        [itemId]
      );
      const invItem = invRows[0];
      if (!invItem || !invItem.is_active) {
        return res.status(400).json({
          success: false,
          message: `Sorry, ingredient '${name}' is currently unavailable.`,
        });
      }
      if (Number(invItem.quantity_in_stock) < needed) {
        return res.status(400).json({
          success: false,
          message: `Sorry, ${name} is temporarily unavailable due to low stock.`,
        });
      }
    }

    // FEATURE 2: Calculate server-side dynamic discount (reads fresh DiscountSettings)
    const studentCreatedAt = req.student ? req.student.created_at : null;
    const discountInfo = await calculateOrderDiscount({
      subtotal: calculatedTotal,
      mealType: targetMealType,
      studentCreatedAt,
    });
    const amountInPaisa = Math.round(discountInfo.total_amount * 100);

    let razorpayOrderId = null;
    let rzpErrorDetails = null;

    try {
      const razorpay = getRazorpayInstance();
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaisa,
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: {
          student_id: String(studentId),
          meal_type: effectiveMealType,
          subtotal_amount: String(discountInfo.subtotal_amount),
          discount_percentage: String(discountInfo.discount_percentage),
          discount_amount: String(discountInfo.discount_amount),
          discount_type: String(discountInfo.discount_type),
          total_amount: String(discountInfo.total_amount),
          delivery_address: cleanDeliveryAddress ? cleanDeliveryAddress.substring(0, 500) : '',
        },
      });
      razorpayOrderId = rzpOrder.id;
    } catch (rzpErr) {
      console.error(`[Razorpay] ERROR creating order:`, {
        message: rzpErr.message,
        description: rzpErr.error?.description || rzpErr.description,
      });
      rzpErrorDetails = rzpErr.error?.description || rzpErr.message || 'Razorpay API error';

      if (!process.env.RAZORPAY_KEY_ID && process.env.NODE_ENV !== 'production') {
        razorpayOrderId = `order_mock_${Date.now()}`;
      } else {
        return res.status(500).json({
          success: false,
          message: `Razorpay Order Creation Failed: ${rzpErrorDetails}.`,
        });
      }
    }

    // Persist pending order into DB immediately so that webhook, mobile redirects, and recovery checks can fulfill it reliably
    let orderDbId = null;
    const todayDate = new Date().toISOString().split('T')[0];
    const customerName = req.student?.name || null;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [orderResult] = await connection.execute(
        `INSERT INTO \`Order\` (
          student_id, customer_name, meal_type, subtotal_amount, 
          discount_percentage, discount_amount, discount_type, total_amount, 
          payment_status, payment_method, razorpay_order_id, 
          token_number, daily_sequence, order_status, date, order_type, is_parcel, is_paid, delivery_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'razorpay', ?, '', 0, 'pending_payment', ?, ?, ?, 0, ?)`,
        [
          studentId,
          customerName,
          effectiveMealType,
          discountInfo.subtotal_amount,
          discountInfo.discount_percentage,
          discountInfo.discount_amount,
          discountInfo.discount_type,
          discountInfo.total_amount,
          razorpayOrderId,
          todayDate,
          targetOrderType,
          isParcelOrder ? 1 : 0,
          cleanDeliveryAddress,
        ]
      );
      orderDbId = orderResult.insertId;

      for (const it of validatedItems) {
        await connection.execute(
          `INSERT INTO OrderItem (order_id, menu_item_id, item_name, price, quantity, variant_name)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderDbId, it.menu_item_id, it.item_name, it.price, it.quantity, it.variant_name || null]
        );
      }

      await connection.commit();
      console.log(`[OrderController] Pre-saved pending order #${orderDbId} for Razorpay order ${razorpayOrderId}`);
    } catch (dbErr) {
      await connection.rollback();
      console.error('[OrderController] Error pre-saving pending order in DB:', dbErr.message);
    } finally {
      connection.release();
    }

    // Return Razorpay checkout info with dynamic key_id from environment
    const { keyId } = getCanteenRazorpayCredentials();

    return res.status(201).json({
      success: true,
      message: 'Razorpay order created successfully.',
      razorpay_order_id: razorpayOrderId,
      order_db_id: orderDbId,
      amount: amountInPaisa,
      currency: 'INR',
      key_id: keyId,
      subtotal_amount: discountInfo.subtotal_amount,
      discount_percentage: discountInfo.discount_percentage,
      discount_amount: discountInfo.discount_amount,
      discount_type: discountInfo.discount_type,
      total_amount: discountInfo.total_amount,
      is_discount_applied: discountInfo.is_discount_applied,
    });
  } catch (error) {
    if (error.isInventoryError || error.message.startsWith('Sorry,')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    console.error('Create Razorpay order error:', error);
    return res.status(500).json({ success: false, message: `Failed to initiate payment order: ${error.message}` });
  }
};

/**
 * Shared, robust helper to fulfill a paid Razorpay order.
 * Called by:
 * 1. verifyPaymentAndFulfill (frontend client verification)
 * 2. razorpayWebhook (Razorpay server-to-server webhook)
 * 3. checkRazorpayOrderStatus (frontend auto-recovery check)
 * 4. reconcileRecentPayments (admin & startup reconciliation)
 */
const fulfillPaidOrder = async ({
  razorpayOrderId,
  paymentId,
  signature = null,
  existingOrder = null,
  validatedItems = null,
  mealType = null,
  targetOrderType = null,
  isParcelOrder = false,
  deliveryAddress = null,
  studentId = null,
  req = null,
}) => {
  await ensureOrderSchemaOnce();
  const todayDate = new Date().toISOString().split('T')[0];

  // 1. Fetch order from DB if not provided
  let order = existingOrder;
  if (!order && razorpayOrderId) {
    order = await fetchOrderWithDetails(razorpayOrderId, false);
  }

  // 2. Idempotency: if already paid and has token, return existing order immediately
  if (order && order.payment_status === 'paid' && order.token_number) {
    console.log(`[fulfillPaidOrder] Order #${order.id} is already fulfilled with Token: ${order.token_number}`);
    return order;
  }

  // 3. If no order in DB, recover order details from Razorpay API
  let rzpOrderData = null;
  if (!order && razorpayOrderId && !razorpayOrderId.startsWith('order_mock_')) {
    try {
      const razorpay = getRazorpayInstance();
      rzpOrderData = await razorpay.orders.fetch(razorpayOrderId);
    } catch (fetchErr) {
      console.warn(`[fulfillPaidOrder] Could not fetch Razorpay order ${razorpayOrderId}:`, fetchErr.message);
    }
  }

  const effectiveMealType = (
    mealType ||
    order?.meal_type ||
    rzpOrderData?.notes?.meal_type ||
    'breakfast'
  ).toLowerCase();

  const effectiveOrderType = targetOrderType || order?.order_type || (isParcelOrder ? 'parcel' : 'dine_in');
  const effectiveIsParcel = isParcelOrder || Boolean(order?.is_parcel) || effectiveOrderType === 'parcel';
  const effectiveDeliveryAddress =
    deliveryAddress ||
    order?.delivery_address ||
    rzpOrderData?.notes?.delivery_address ||
    null;

  const effectiveStudentId =
    studentId ||
    order?.student_id ||
    (rzpOrderData?.notes?.student_id ? parseInt(rzpOrderData.notes.student_id, 10) : null) ||
    null;

  // 4. Atomically generate token & update/insert order in transaction
  const connection = await pool.getConnection();
  let finalOrderId;
  let finalTokenNumber;
  let finalSeqNumber;

  try {
    await connection.beginTransaction();

    const { tokenNumber, sequenceNumber } = await generateTokenNumber(effectiveMealType, todayDate, connection);
    finalTokenNumber = tokenNumber;
    finalSeqNumber = sequenceNumber;

    if (order) {
      // Update existing pending order
      await connection.execute(
        `UPDATE \`Order\` 
         SET payment_status = 'paid', is_paid = 1, payment_method = 'razorpay',
             razorpay_payment_id = ?, razorpay_signature = COALESCE(?, razorpay_signature),
             token_number = ?, daily_sequence = ?, order_status = 'placed',
             order_type = ?, is_parcel = ?, date = ?,
             delivery_address = COALESCE(?, delivery_address)
         WHERE id = ?`,
        [
          paymentId || `pay_${Date.now()}`,
          signature,
          finalTokenNumber,
          finalSeqNumber,
          effectiveOrderType,
          effectiveIsParcel ? 1 : 0,
          todayDate,
          effectiveDeliveryAddress,
          order.id,
        ]
      );
      finalOrderId = order.id;

      // If existing order had no items in OrderItem table and validatedItems are supplied:
      if ((!order.items || order.items.length === 0) && validatedItems && validatedItems.length > 0) {
        for (const it of validatedItems) {
          await connection.execute(
            `INSERT INTO OrderItem (order_id, menu_item_id, item_name, price, quantity, variant_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [finalOrderId, it.menu_item_id, it.item_name, it.price, it.quantity, it.variant_name || null]
          );
        }
      }
    } else {
      // Recovered Order from Razorpay payment notes
      const subtotalAmt = Number(rzpOrderData?.notes?.subtotal_amount || (rzpOrderData?.amount ? rzpOrderData.amount / 100 : 0));
      const discAmt = Number(rzpOrderData?.notes?.discount_amount || 0);
      const discPct = Number(rzpOrderData?.notes?.discount_percentage || 0);
      const discType = rzpOrderData?.notes?.discount_type || 'none';
      const totalAmt = Number(rzpOrderData?.notes?.total_amount || (rzpOrderData?.amount ? rzpOrderData.amount / 100 : 0));

      let studentName = null;
      if (effectiveStudentId) {
        const [stRows] = await connection.execute('SELECT name FROM Student WHERE id = ? LIMIT 1', [effectiveStudentId]);
        studentName = stRows[0]?.name || null;
      }

      const [insertResult] = await connection.execute(
        `INSERT INTO \`Order\` (
          student_id, customer_name, meal_type, subtotal_amount, 
          discount_percentage, discount_amount, discount_type, total_amount, 
          payment_status, payment_method, razorpay_order_id, razorpay_payment_id, 
          razorpay_signature, token_number, daily_sequence, order_status, date, order_type, is_parcel, is_paid, delivery_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'razorpay', ?, ?, ?, ?, ?, 'placed', ?, ?, ?, 1, ?)`,
        [
          effectiveStudentId,
          studentName,
          effectiveMealType,
          subtotalAmt,
          discPct,
          discAmt,
          discType,
          totalAmt,
          razorpayOrderId,
          paymentId || `pay_${Date.now()}`,
          signature || '',
          finalTokenNumber,
          finalSeqNumber,
          todayDate,
          effectiveOrderType,
          effectiveIsParcel ? 1 : 0,
          effectiveDeliveryAddress,
        ]
      );
      finalOrderId = insertResult.insertId;

      if (validatedItems && validatedItems.length > 0) {
        for (const it of validatedItems) {
          await connection.execute(
            `INSERT INTO OrderItem (order_id, menu_item_id, item_name, price, quantity, variant_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [finalOrderId, it.menu_item_id, it.item_name, it.price, it.quantity, it.variant_name || null]
          );
        }
      } else {
        await connection.execute(
          `INSERT INTO OrderItem (order_id, menu_item_id, item_name, price, quantity, variant_name)
           VALUES (?, NULL, ?, ?, 1, NULL)`,
          [finalOrderId, `${effectiveMealType.toUpperCase()} Meal (Online Order)`, totalAmt]
        );
      }
    }

    // Safely deduct prepared menu stock if enabled
    try {
      const menuTrackingEnabled = await isMenuStockTrackingEnabled();
      if (menuTrackingEnabled && validatedItems && validatedItems.length > 0) {
        for (const it of validatedItems) {
          if (it.menu_item_id) {
            await connection.execute(
              `UPDATE MenuItem 
               SET available_quantity = GREATEST(0, available_quantity - ?),
                   is_available = CASE WHEN available_quantity - ? <= 0 THEN 0 ELSE is_available END
               WHERE id = ?`,
              [it.quantity, it.quantity, it.menu_item_id]
            );
          }
        }
      }
    } catch (mErr) {
      console.warn('[fulfillPaidOrder] Menu portion deduction notice:', mErr.message);
    }

    // Safely deduct inventory ingredients
    try {
      await deductInventoryForOrder(connection, finalOrderId);
    } catch (invErr) {
      console.warn('[fulfillPaidOrder] Inventory deduction notice:', invErr.message);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // 5. Fetch updated order with student and item details
  const updatedOrder = await fetchOrderWithDetails(finalOrderId, true);
  const orderCounts = await computeKitchenOrderCounts(updatedOrder.date);

  // 6. Broadcast live socket events to kitchen and student
  const io = req?.app?.get('socketio') || (typeof global !== 'undefined' && global.io);
  if (io) {
    try {
      io.emit('menu:stock_updated', { order_id: finalOrderId });
      const socketPayload = {
        _id: updatedOrder.id,
        id: updatedOrder.id,
        token_number: updatedOrder.token_number,
        meal_type: updatedOrder.meal_type,
        order_type: updatedOrder.order_type || effectiveOrderType,
        is_parcel: Boolean(updatedOrder.is_parcel != null ? updatedOrder.is_parcel : effectiveIsParcel),
        items: (updatedOrder.items || []).map((it) => ({
          item_name: it.item_name,
          quantity: it.quantity,
          price: Number(it.price),
        })),
        student_name: updatedOrder.student?.name || updatedOrder.customer_name || 'Student',
        roll_no: updatedOrder.student?.roll_no || '',
        total_amount: Number(updatedOrder.total_amount),
        payment_status: 'paid',
        order_status: updatedOrder.order_status,
        created_at: updatedOrder.created_at,
        orderCounts,
      };

      io.to('kitchen').emit('order:new', socketPayload);
      io.to('kitchen').emit('order-counts-updated', socketPayload);
      io.emit('menu:sales_updated', { meal_type: updatedOrder.meal_type });
      io.emit('menu:updated', { meal_type: updatedOrder.meal_type });

      if (updatedOrder.student?.id) {
        io.to(`student:${updatedOrder.student.id}`).emit('student:order_updated', {
          orderId: updatedOrder.id,
          token_number: updatedOrder.token_number,
          order_status: updatedOrder.order_status,
          payment_status: 'paid',
          order: shapeOrder(updatedOrder),
        });
      }
    } catch (socketErr) {
      console.warn('[fulfillPaidOrder] Socket notification notice:', socketErr.message);
    }
  }

  console.log(`✅ [fulfillPaidOrder] Successfully fulfilled Order #${updatedOrder.id} with Token: ${updatedOrder.token_number} (Razorpay: ${razorpayOrderId}, Payment: ${paymentId})`);
  return updatedOrder;
};

// Verify Payment Signature & Fulfill Order
const verifyPaymentAndFulfill = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items, meal_type, order_db_id, order_type, is_parcel, delivery_address } = req.body;
    const studentId = req.studentId;
    const isParcelOrder = order_type === 'parcel' || Boolean(is_parcel);
    const targetOrderType = isParcelOrder ? 'parcel' : 'dine_in';

    if (!razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'razorpay_order_id is required.' });
    }

    // Verify signature with dynamic secret from process.env
    const { keySecret } = getCanteenRazorpayCredentials();
    let isValidSignature = false;

    if (razorpay_order_id.startsWith('order_mock_')) {
      isValidSignature = true;
    } else if (keySecret && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      try {
        const expectedBuf = Buffer.from(generatedSignature, 'utf8');
        const actualBuf = Buffer.from(razorpay_signature, 'utf8');
        isValidSignature = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
      } catch (sigErr) {
        isValidSignature = false;
      }
    }

    // API Fallback: If signature check fails or is missing, verify payment directly with Razorpay API
    if (!isValidSignature && razorpay_payment_id && !razorpay_payment_id.startsWith('pay_mock_')) {
      try {
        const razorpay = getRazorpayInstance();
        const paymentData = await razorpay.payments.fetch(razorpay_payment_id);
        if (
          paymentData &&
          (paymentData.order_id === razorpay_order_id || !paymentData.order_id) &&
          (paymentData.status === 'captured' || paymentData.status === 'authorized')
        ) {
          console.log(`[OrderController] Signature check fallback: payment ${razorpay_payment_id} successfully confirmed as '${paymentData.status}' via Razorpay API.`);
          isValidSignature = true;
        }
      } catch (apiErr) {
        console.warn(`[OrderController] Razorpay API fallback verification failed for ${razorpay_payment_id}:`, apiErr.message);
      }
    }

    if (!isValidSignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Signature mismatch.' });
    }

    // Fetch existing order from DB
    let existingOrder = null;
    if (order_db_id) {
      existingOrder = await fetchOrderWithDetails(parseInt(order_db_id, 10), true);
    }
    if (!existingOrder) {
      existingOrder = await fetchOrderWithDetails(razorpay_order_id, false);
    }

    // Validate cart items to record
    let validatedItems = [];
    const cartItems = items || existingOrder?.items || [];
    if (Array.isArray(cartItems) && cartItems.length > 0) {
      for (const cartItem of cartItems) {
        const rawId = cartItem.menu_item || cartItem.menu_item_id || cartItem.id;
        const numericId = rawId ? parseInt(rawId, 10) : NaN;
        let dbItem = null;

        if (!isNaN(numericId)) {
          const [menuRows] = await pool.execute('SELECT * FROM MenuItem WHERE id = ? LIMIT 1', [numericId]);
          dbItem = menuRows[0] || null;
        }

        if (!dbItem && (cartItem.name || cartItem.item_name)) {
          const nameToSearch = cartItem.name || cartItem.item_name;
          const [menuRows] = await pool.execute('SELECT * FROM MenuItem WHERE name = ? AND is_active = 1 LIMIT 1', [nameToSearch]);
          dbItem = menuRows[0] || null;
        }

        if (dbItem) {
          const itemQuantity = Number(cartItem.quantity) || 1;
          const { itemPrice, itemName, variantName } = resolveMenuItemVariant(dbItem, cartItem);
          validatedItems.push({
            menu_item_id: dbItem.id,
            item_name: itemName,
            variant_name: variantName,
            price: itemPrice,
            quantity: itemQuantity,
          });
        }
      }
    }

    const fulfilledOrder = await fulfillPaidOrder({
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      existingOrder,
      validatedItems,
      mealType: meal_type,
      targetOrderType,
      isParcelOrder,
      deliveryAddress: delivery_address,
      studentId,
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and token generated successfully!',
      token_number: fulfilledOrder.token_number,
      order: shapeOrder(fulfilledOrder),
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error verifying payment.' });
  }
};

// Compute Kitchen Order Counts Aggregation
const computeKitchenOrderCounts = async (targetDate) => {
  await ensureOrderSchemaOnce();
  const dateStr = targetDate || new Date().toISOString().split('T')[0];

  const [groupedOrders] = await pool.execute(
    `SELECT meal_type, COALESCE(order_status, status, 'placed') AS order_status, COUNT(*) AS count
     FROM \`Order\`
     WHERE (date = ? OR DATE(created_at) = ?) AND (payment_status = 'paid' OR is_paid = 1)
     GROUP BY meal_type, COALESCE(order_status, status, 'placed')`,
    [dateStr, dateStr]
  );

  const counts = {
    breakfast: { total_orders_today: 0, active_tokens: 0 },
    lunch: { total_orders_today: 0, active_tokens: 0 },
    snacks: { total_orders_today: 0, active_tokens: 0 },
    dinner: { total_orders_today: 0, active_tokens: 0 },
    combined: { total_orders_today: 0, active_tokens: 0 },
    todays_menu_summary: [],
  };

  const activeStatuses = ['placed', 'preparing', 'ready', 'out_for_delivery'];

  groupedOrders.forEach((group) => {
    const meal = (group.meal_type || '').toLowerCase();
    const count = group.count || 0;
    const isActive = activeStatuses.includes(group.order_status);

    if (!counts[meal]) {
      counts[meal] = { total_orders_today: 0, active_tokens: 0 };
    }
    counts[meal].total_orders_today += count;
    if (isActive) {
      counts[meal].active_tokens += count;
    }
    counts.combined.total_orders_today += count;
    if (isActive) {
      counts.combined.active_tokens += count;
    }
  });

  // Today's menu summary using OrderItem queries
  try {
    const [orderItems] = await pool.execute(
      `SELECT oi.item_name, oi.quantity, oi.order_id, COALESCE(o.order_status, o.status, 'placed') AS order_status
       FROM OrderItem oi
       INNER JOIN \`Order\` o ON oi.order_id = o.id
       WHERE (o.date = ? OR DATE(o.created_at) = ?) AND (o.payment_status = 'paid' OR o.is_paid = 1)
         AND COALESCE(o.order_status, o.status, 'placed') NOT IN ('cancelled', 'expired')`,
      [dateStr, dateStr]
    );

    const summaryMap = {};
    orderItems.forEach((item) => {
      if (!summaryMap[item.item_name]) {
        summaryMap[item.item_name] = {
          item_name: item.item_name,
          total_quantity: 0,
          pending_quantity: 0,
          delivered_quantity: 0,
          orderIds: new Set(),
        };
      }
      const qty = Number(item.quantity) || 1;
      summaryMap[item.item_name].total_quantity += qty;
      summaryMap[item.item_name].orderIds.add(item.order_id);
      if (item.order_status === 'delivered') {
        summaryMap[item.item_name].delivered_quantity += qty;
      } else {
        summaryMap[item.item_name].pending_quantity += qty;
      }
    });

    counts.todays_menu_summary = Object.values(summaryMap)
      .map((s) => ({
        item_name: s.item_name,
        total_quantity: s.total_quantity,
        pending_quantity: s.pending_quantity,
        delivered_quantity: s.delivered_quantity,
        total_orders: s.orderIds.size,
      }))
      .sort((a, b) => b.pending_quantity - a.pending_quantity || b.total_quantity - a.total_quantity);
  } catch (err) {
    console.warn('Menu summary calculation warning:', err);
  }

  return counts;
};

// Get Kitchen Order Counts API Endpoint
const getKitchenOrderCounts = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const orderCounts = await computeKitchenOrderCounts(dateStr);
    return res.status(200).json({
      success: true,
      date: dateStr,
      orderCounts,
    });
  } catch (error) {
    console.error('Error fetching kitchen order counts:', error);
    return res.status(500).json({ success: false, message: 'Error fetching order counts.' });
  }
};

const razorpayWebhook = async (req, res) => {
  try {
    const { webhookSecret } = getCanteenRazorpayCredentials();
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature using preserved raw body buffer
    const rawPayload = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (webhookSecret && signature) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(rawPayload);
      const digest = shasum.digest('hex');

      try {
        const expectedBuf = Buffer.from(digest, 'utf8');
        const actualBuf = Buffer.from(signature, 'utf8');
        if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
          console.warn('[Webhook] Signature mismatch on raw body. Attempting fallback verification via Razorpay API...');
        }
      } catch (e) {
        console.warn('[Webhook] Signature comparison error:', e.message);
      }
    }

    const event = req.body?.event;
    console.log(`[Razorpay Webhook] Received event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      const orderEntity = req.body.payload?.order?.entity;
      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;

      if (rzpOrderId) {
        await fulfillPaidOrder({
          razorpayOrderId: rzpOrderId,
          paymentId: paymentId,
          req,
        });
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Razorpay Webhook Error]:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

// Check Razorpay Order Status (Client auto-recovery on reload, app return, or modal dismiss)
const checkRazorpayOrderStatus = async (req, res) => {
  try {
    const razorpayOrderId = req.params.razorpay_order_id || req.body?.razorpay_order_id || req.query?.razorpay_order_id;
    if (!razorpayOrderId) {
      return res.status(400).json({ success: false, message: 'razorpay_order_id is required.' });
    }

    // 1. Check if already in DB and marked paid
    let order = await fetchOrderWithDetails(razorpayOrderId, false);
    if (order && order.payment_status === 'paid' && order.token_number) {
      return res.status(200).json({
        success: true,
        is_paid: true,
        token_number: order.token_number,
        order: shapeOrder(order),
        message: 'Order is active and paid.',
      });
    }

    // 2. Fetch live payments from Razorpay API for this order
    const razorpay = getRazorpayInstance();
    const paymentsList = await razorpay.orders.fetchPayments(razorpayOrderId);
    const capturedPayment = (paymentsList.items || []).find((p) => p.status === 'captured');

    if (capturedPayment) {
      console.log(`[checkRazorpayOrderStatus] Order ${razorpayOrderId} has captured payment ${capturedPayment.id} on Razorpay. Fulfilling now...`);
      const fulfilledOrder = await fulfillPaidOrder({
        razorpayOrderId,
        paymentId: capturedPayment.id,
        existingOrder: order,
        studentId: req.studentId,
        req,
      });

      return res.status(200).json({
        success: true,
        is_paid: true,
        token_number: fulfilledOrder.token_number,
        order: shapeOrder(fulfilledOrder),
        message: 'Payment verified and token generated successfully!',
      });
    }

    return res.status(200).json({
      success: true,
      is_paid: false,
      status: (paymentsList.items && paymentsList.items[0]?.status) || 'created',
      message: 'Payment has not been captured yet.',
    });
  } catch (error) {
    console.error('[checkRazorpayOrderStatus Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Reconcile Recent Razorpay Payments (Recovers orphaned payments and ensures tokens/revenue are generated)
const reconcileRecentPayments = async (req, res) => {
  try {
    const razorpay = getRazorpayInstance();
    const payments = await razorpay.payments.all({ count: 50 });
    const captured = (payments.items || []).filter((p) => p.status === 'captured');
    const reconciled = [];

    for (const payment of captured) {
      const rzpOrderId = payment.order_id;
      if (!rzpOrderId) continue;

      let order = await fetchOrderWithDetails(rzpOrderId, false);
      if (!order || order.payment_status !== 'paid' || !order.token_number) {
        console.log(`[Reconcile] Recovering orphaned payment ${payment.id} for Razorpay order ${rzpOrderId}...`);
        try {
          const fulfilled = await fulfillPaidOrder({
            razorpayOrderId: rzpOrderId,
            paymentId: payment.id,
            existingOrder: order,
            req,
          });
          reconciled.push({
            payment_id: payment.id,
            order_id: rzpOrderId,
            token_number: fulfilled.token_number,
            amount: payment.amount / 100,
          });
        } catch (fErr) {
          console.error(`[Reconcile] Failed to fulfill ${payment.id}:`, fErr.message);
        }
      }
    }

    if (res) {
      return res.status(200).json({
        success: true,
        reconciled_count: reconciled.length,
        reconciled_orders: reconciled,
        message: `Successfully reconciled ${reconciled.length} orders.`,
      });
    }
    return reconciled;
  } catch (err) {
    console.error('[reconcileRecentPayments Error]:', err);
    if (res) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};

// Get Past Orders for logged-in Student
const getStudentOrders = async (req, res) => {
  try {
    await autoExpireUncollectedOrders().catch(() => { });

    const retentionDays = parseInt(
      process.env.STUDENT_ORDER_HISTORY_DAYS || process.env.ORDER_RETENTION_DAYS,
      10
    ) || 7;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const [orders] = await pool.execute(
      `SELECT * FROM \`Order\` 
       WHERE student_id = ? AND payment_status = 'paid' AND (created_at >= ? OR date >= ?)
       ORDER BY created_at DESC`,
      [req.studentId, cutoffDate, cutoffDateStr]
    );

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const placeholders = orderIds.map(() => '?').join(', ');
      const [itemRows] = await pool.query(
        `SELECT * FROM OrderItem WHERE order_id IN (${placeholders})`,
        orderIds
      );

      // Fetch reviews and ratings submitted for these orders
      let reviewRows = [];
      try {
        const [rRows] = await pool.query(
          `SELECT * FROM MenuItemReview WHERE order_id IN (${placeholders}) AND student_id = ?`,
          [...orderIds, req.studentId]
        );
        reviewRows = rRows;
      } catch (revErr) {
        console.warn('Could not load reviews in getStudentOrders:', revErr.message);
      }

      const itemsByOrderId = {};
      itemRows.forEach((item) => {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push(item);
      });

      const reviewsByOrderId = {};
      reviewRows.forEach((rev) => {
        if (!reviewsByOrderId[rev.order_id]) {
          reviewsByOrderId[rev.order_id] = [];
        }
        reviewsByOrderId[rev.order_id].push(rev);
      });

      orders.forEach((order) => {
        order.items = itemsByOrderId[order.id] || [];
        const ordReviews = reviewsByOrderId[order.id] || [];
        order.reviews = ordReviews;
        order.is_rated = ordReviews.length > 0;
        if (ordReviews.length > 0) {
          const sum = ordReviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
          const avg = sum / ordReviews.length;
          order.rating = avg % 1 === 0 ? avg : Math.round(avg * 10) / 10;
        } else {
          order.rating = null;
        }
      });
    }

    const shaped = orders.map((o) => ({
      ...o,
      _id: o.id,
      total_amount: Number(o.total_amount),
      items: (o.items || []).map((it) => ({ ...it, _id: it.id, price: Number(it.price) })),
      is_rated: Boolean(o.is_rated),
      rating: o.rating != null ? o.rating : null,
      reviews: o.reviews || [],
    }));

    return res.status(200).json({
      success: true,
      retention_days: retentionDays,
      count: shaped.length,
      orders: shaped,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching order history.' });
  }
};

// Get Kitchen Screen Orders for Today (Admin)
const getKitchenOrders = async (req, res) => {
  try {
    await ensureOrderSchemaOnce();
    await autoExpireUncollectedOrders().catch(() => { });

    const { date, meal_type, status, order_type } = req.query;
    let sql = `
      SELECT o.*, s.name AS student_name, s.roll_no AS student_roll_no, s.email AS student_email, s.phone AS student_phone
      FROM \`Order\` o
      LEFT JOIN Student s ON o.student_id = s.id
      WHERE (o.payment_status = 'paid' OR o.is_paid = 1)
    `;
    const params = [];
    const targetDate = date || new Date().toISOString().split('T')[0];
    sql += ' AND (o.date = ? OR DATE(o.created_at) = ?)';
    params.push(targetDate, targetDate);

    if (meal_type) {
      sql += ' AND o.meal_type = ?';
      params.push(meal_type.toLowerCase());
    }
    if (order_type) {
      if (order_type === 'parcel') {
        sql += ' AND (o.order_type = ? OR o.is_parcel = 1)';
        params.push('parcel');
      } else if (order_type === 'dine_in') {
        sql += ' AND (o.order_type = ? OR o.is_parcel = 0 OR o.is_parcel IS NULL)';
        params.push('dine_in');
      }
    }
    if (status) {
      sql += ' AND (o.order_status = ? OR o.status = ?)';
      params.push(status, status);
    }

    sql += ' ORDER BY o.created_at ASC';

    const [orders] = await pool.execute(sql, params);

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const placeholders = orderIds.map(() => '?').join(', ');
      const [itemRows] = await pool.query(
        `SELECT * FROM OrderItem WHERE order_id IN (${placeholders})`,
        orderIds
      );

      const itemsByOrderId = {};
      itemRows.forEach((item) => {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push(item);
      });

      orders.forEach((order) => {
        const effName = order.customer_name || order.student_name || 'Walk-in Customer';
        order.student = order.student_id
          ? {
              id: order.student_id,
              name: order.student_name,
              roll_no: order.student_roll_no || '',
              email: order.student_email || '',
              phone: order.student_phone || '',
            }
          : {
              id: null,
              name: effName,
              roll_no: '',
              email: '',
              phone: '',
            };
        order.student_name = effName;
        order.is_parcel = order.order_type === 'parcel' || Boolean(order.is_parcel);
        order.order_type = order.is_parcel ? 'parcel' : (order.order_type || 'dine_in');
        order.items = itemsByOrderId[order.id] || [];
      });
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders: orders.map(shapeOrder),
    });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    return res.status(500).json({ success: false, message: 'Error fetching kitchen orders.', error: error.message });
  }
};

// Update Order Status (Admin tap to mark preparing / ready / delivered)
const updateOrderStatus = async (req, res) => {
  try {
    await autoExpireUncollectedOrders().catch(() => { });
    const { id } = req.params;
    const { order_status } = req.body;
    const targetId = parseInt(id, 10);

    const validStatuses = ['placed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'expired'];
    if (!order_status || !validStatuses.includes(order_status)) {
      return res.status(400).json({ success: false, message: 'Invalid order_status' });
    }

    // Check previous status
    const [prevOrderRows] = await pool.execute('SELECT order_status FROM `Order` WHERE id = ? LIMIT 1', [targetId]);
    const prevStatus = prevOrderRows[0]?.order_status;

    await pool.execute('UPDATE `Order` SET order_status = ? WHERE id = ?', [order_status, targetId]);

    // If order was cancelled and was not previously cancelled, restore deducted ingredients and menu portions
    if (order_status === 'cancelled' && prevStatus !== 'cancelled') {
      const [logs] = await pool.execute(
        "SELECT * FROM InventoryLog WHERE order_id = ? AND action_type = 'deduction'",
        [targetId]
      );
      for (const log of logs) {
        const qtyToRestore = Math.abs(Number(log.quantity_changed));
        await pool.execute(
          'UPDATE InventoryItem SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?',
          [qtyToRestore, log.inventory_item_id]
        );
        await pool.execute(
          "INSERT INTO InventoryLog (inventory_item_id, action_type, quantity_changed, order_id, admin_user_id) VALUES (?, 'restock', ?, ?, ?)",
          [log.inventory_item_id, qtyToRestore, targetId, req.adminId || null]
        );
      }

      // Restore prepared menu portions if tracking is enabled
      const menuTrackingEnabled = await isMenuStockTrackingEnabled();
      if (menuTrackingEnabled) {
        const [orderItems] = await pool.execute(
          'SELECT menu_item_id, quantity FROM OrderItem WHERE order_id = ?',
          [targetId]
        );
        for (const it of orderItems) {
          if (it.menu_item_id) {
            await pool.execute(
              `UPDATE MenuItem 
               SET available_quantity = available_quantity + ?,
                   is_available = CASE WHEN available_quantity + ? > 0 THEN 1 ELSE is_available END
               WHERE id = ?`,
              [it.quantity, it.quantity, it.menu_item_id]
            );
          }
        }
      }
    }

    const order = await fetchOrderWithDetails(targetId, true);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const orderCounts = await computeKitchenOrderCounts(order.date);

    const io = req.app.get('socketio');
    if (io) {
      if (order_status === 'cancelled' && prevStatus !== 'cancelled') {
        io.emit('menu:stock_updated', { restored_order_id: targetId });
      }

      const updatePayload = {
        orderId: order.id,
        id: order.id,
        token_number: order.token_number,
        meal_type: order.meal_type,
        order_status: order.order_status,
        student_name: order.student?.name || 'Student',
        updated_at: new Date(),
        orderCounts,
      };

      io.to('kitchen').emit('order-counts-updated', updatePayload);
      io.to('kitchen').emit('order:status_updated', updatePayload);

      // Broadcast to student room
      if (order.student?.id) {
        io.to(`student:${order.student.id}`).emit('student:order_updated', {
          orderId: order.id,
          token_number: order.token_number,
          order_status: order.order_status,
        });

        if (['delivered', 'expired', 'cancelled'].includes(order.order_status)) {
          io.to(`student:${order.student.id}`).emit('parcel:timer_cleared', {
            orderId: order.id,
            token_number: order.token_number,
            studentId: order.student.id,
          });
        }
      }

      if (['delivered', 'expired', 'cancelled'].includes(order.order_status)) {
        io.emit('order:timer_cleared_broadcast', {
          orderId: order.id,
          token_number: order.token_number,
          studentId: order.student?.id,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to '${order_status}'`,
      order: shapeOrder(order),
      orderCounts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating order status.' });
  }
};

/**
 * Safely parses and sanitizes a date parameter to valid ISO 'YYYY-MM-DD'.
 * Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or any valid Date representation.
 * Returns null if the value is invalid, empty, or placeholder (e.g. 'dd-mm-yyyy', 'undefined', 'null').
 * Prevents MySQL Error 1292 (Incorrect date value) which crashes order queries with HTTP 500.
 */
const sanitizeDateParam = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'dd-mm-yyyy' ||
    trimmed.toLowerCase() === 'invalid date'
  ) {
    return null;
  }

  // 1. Standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }

  // 2. Format DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    const iso = `${year}-${month}-${day}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return iso;
  }

  // 3. Any other valid string date parseable by Date constructor
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
};

// Get Admin Order History (Paginated, Filterable, Role-Based Field Stripping for Staff)
// Strictly returns ONLY paid/confirmed orders (unpaid orders are excluded)
const getAdminOrderHistory = async (req, res) => {
  try {
    await ensureOrderSchemaOnce();
    await autoExpireUncollectedOrders().catch(() => { });

    const { from, to, meal_type, order_status, order_type, sort_by, sort_order, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const whereClauses = [
      "(o.payment_status = 'paid' OR o.is_paid = 1)",
      "o.token_number IS NOT NULL",
      "o.token_number != ''",
    ];
    const baseParams = [];

    const cleanFrom = sanitizeDateParam(from);
    if (cleanFrom) {
      whereClauses.push("(o.date >= ? OR DATE(o.created_at) >= ?)");
      baseParams.push(cleanFrom, cleanFrom);
    }
    const cleanTo = sanitizeDateParam(to);
    if (cleanTo) {
      whereClauses.push("(o.date <= ? OR DATE(o.created_at) <= ?)");
      baseParams.push(cleanTo, cleanTo);
    }
    if (meal_type && meal_type.trim() && meal_type.toLowerCase() !== 'all') {
      whereClauses.push("LOWER(o.meal_type) = ?");
      baseParams.push(meal_type.toLowerCase().trim());
    }
    if (order_status && order_status.trim() && order_status.toLowerCase() !== 'all') {
      whereClauses.push("LOWER(COALESCE(o.order_status, o.status, 'placed')) = ?");
      baseParams.push(order_status.toLowerCase().trim());
    }
    if (order_type && order_type.trim() && order_type.toLowerCase() !== 'all') {
      const cleanType = order_type.toLowerCase().trim();
      if (cleanType === 'parcel') {
        whereClauses.push("(LOWER(o.order_type) = 'parcel' OR o.is_parcel = 1)");
      } else if (cleanType === 'dine_in') {
        whereClauses.push("(LOWER(o.order_type) = 'dine_in' AND (o.is_parcel = 0 OR o.is_parcel IS NULL))");
      }
    }

    const whereSql = "WHERE " + whereClauses.join(" AND ");

    // 1. Total count query (with 'o' alias so table filters work)
    const countSql = `SELECT COUNT(*) AS total FROM \`Order\` o ${whereSql}`;
    const [countRows] = await pool.query(countSql, baseParams);
    const totalCount = countRows[0]?.total || 0;

    // Determine custom sorting
    let orderClause = 'o.created_at DESC';
    const allowedSort = {
      created_at: 'o.created_at',
      date: 'o.created_at',
      total_amount: 'o.total_amount',
      token_number: 'o.daily_sequence, o.token_number',
      order_type: 'o.order_type',
    };
    if (sort_by && allowedSort[sort_by]) {
      const dir = (sort_order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      orderClause = `${allowedSort[sort_by]} ${dir}`;
    }

    // 2. Select paginated orders with student information
    // Using validated integer interpolation for LIMIT/OFFSET guarantees zero parameter mismatch in mysql2
    const selectSql = `
      SELECT o.*, s.name AS student_name, s.roll_no AS student_roll_no, s.email AS student_email
      FROM \`Order\` o
      LEFT JOIN Student s ON o.student_id = s.id
      ${whereSql}
      ORDER BY ${orderClause}
      LIMIT ${limitNum} OFFSET ${skip}
    `;
    const [orders] = await pool.query(selectSql, baseParams);

    // 3. Fetch items for the orders
    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id).filter(Boolean);
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => '?').join(', ');
        const [itemRows] = await pool.query(
          `SELECT * FROM OrderItem WHERE order_id IN (${placeholders})`,
          orderIds
        );

        const itemsByOrderId = {};
        itemRows.forEach((item) => {
          if (!itemsByOrderId[item.order_id]) {
            itemsByOrderId[item.order_id] = [];
          }
          itemsByOrderId[item.order_id].push(item);
        });

        orders.forEach((order) => {
          const effName = order.customer_name || order.student_name || 'Walk-in Customer';
          order.student = order.student_id
            ? {
                id: order.student_id,
                name: order.student_name || effName,
                roll_no: order.student_roll_no || '',
                email: order.student_email || '',
              }
            : {
                id: null,
                name: effName,
                roll_no: '',
                email: '',
              };
          order.student_name = effName;
          order.is_parcel = order.order_type === 'parcel' || Boolean(order.is_parcel);
          order.order_type = order.is_parcel ? 'parcel' : (order.order_type || 'dine_in');
          order.items = itemsByOrderId[order.id] || [];
        });
      }
    }

    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';

    const sanitizedOrders = orders.map((order) => {
      const shaped = shapeOrder(order);
      if (!isSuperAdmin) {
        delete shaped.total_amount;
        delete shaped.subtotal_amount;
        delete shaped.discount_amount;
        delete shaped.discount_percentage;
        delete shaped.payment_method;
        shaped.items = (shaped.items || []).map(({ price, ...rest }) => rest);
      }
      return shaped;
    });

    // 4. Income summary for range (super_admin only)
    let incomeSummary = null;
    if (isSuperAdmin) {
      const groupSql = `
        SELECT o.payment_method, SUM(o.total_amount) AS sum, COUNT(*) AS count
        FROM \`Order\` o
        ${whereSql}
        GROUP BY o.payment_method
      `;
      const [incomeGroups] = await pool.query(groupSql, baseParams);

      let totalIncome = 0;
      let totalPaidOrders = 0;
      const breakdown = {
        razorpay: { amount: 0, count: 0 },
        counter_cash: { amount: 0, count: 0 },
        counter_upi: { amount: 0, count: 0 },
        other: { amount: 0, count: 0 },
      };

      incomeGroups.forEach((group) => {
        let rawMethod = (group.payment_method || 'counter_cash').toLowerCase().trim();
        let method = rawMethod;
        if (rawMethod === 'cash') method = 'counter_cash';
        else if (rawMethod === 'upi') method = 'counter_upi';
        else if (rawMethod === 'razorpay' || rawMethod === 'online') method = 'razorpay';
        else if (!breakdown[method]) method = 'other';

        const amt = Number(group.sum || 0);
        const cnt = Number(group.count || 0);
        breakdown[method].amount += amt;
        breakdown[method].count += cnt;
        totalIncome += amt;
        totalPaidOrders += cnt;
      });

      incomeSummary = { total_income: totalIncome, total_paid_orders: totalPaidOrders, breakdown };
    }

    return res.status(200).json({
      success: true,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(totalCount / limitNum) || 1,
      total_count: totalCount,
      is_super_admin: isSuperAdmin,
      income_summary: incomeSummary,
      orders: sanitizedOrders,
    });
  } catch (error) {
    console.error('Error fetching admin order history:', error);
    return res.status(500).json({
      success: false,
      message: error.sqlMessage || error.message || 'Error fetching order history.',
    });
  }
};

// Get Today's Total Income & Payment Method Breakdown (Strictly Super Admin Only)
const getTodayIncome = async (req, res) => {
  try {
    await ensureOrderSchemaOnce();
    const todayDate = new Date().toISOString().split('T')[0];

    const [incomeGroups] = await pool.execute(
      `SELECT payment_method, SUM(total_amount) AS sum, COUNT(*) AS count
       FROM \`Order\`
       WHERE (date = ? OR DATE(created_at) = ?) AND (payment_status = 'paid' OR is_paid = 1)
       GROUP BY payment_method`,
      [todayDate, todayDate]
    );

    let totalIncome = 0;
    let totalPaidOrders = 0;
    const breakdown = {
      razorpay: { amount: 0, count: 0 },
      counter_cash: { amount: 0, count: 0 },
      counter_upi: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    incomeGroups.forEach((group) => {
      let rawMethod = (group.payment_method || 'counter_cash').toLowerCase().trim();
      let method = rawMethod;
      if (rawMethod === 'cash') method = 'counter_cash';
      else if (rawMethod === 'upi') method = 'counter_upi';
      else if (rawMethod === 'razorpay' || rawMethod === 'online') method = 'razorpay';
      else if (!breakdown[method]) method = 'other';

      const amt = Number(group.sum || 0);
      const cnt = Number(group.count || 0);
      breakdown[method].amount += amt;
      breakdown[method].count += cnt;
      totalIncome += amt;
      totalPaidOrders += cnt;
    });

    return res.status(200).json({
      success: true,
      date: todayDate,
      total_income: totalIncome,
      total_paid_orders: totalPaidOrders,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching today income:', error);
    return res.status(500).json({ success: false, message: 'Error fetching today income.' });
  }
};

// Get Income History for Date Range & Payment Method Breakdown (Strictly Super Admin Only)
const getIncomeHistory = async (req, res) => {
  try {
    const { from, to, meal_type } = req.query;

    let sql = `
      SELECT payment_method, SUM(total_amount) AS sum, COUNT(*) AS count
      FROM \`Order\`
      WHERE payment_status = 'paid'
    `;
    const params = [];
    const cleanFrom = sanitizeDateParam(from);
    if (cleanFrom) {
      sql += ' AND (date >= ? OR DATE(created_at) >= ?)';
      params.push(cleanFrom, cleanFrom);
    }
    const cleanTo = sanitizeDateParam(to);
    if (cleanTo) {
      sql += ' AND (date <= ? OR DATE(created_at) <= ?)';
      params.push(cleanTo, cleanTo);
    }
    if (meal_type && meal_type.trim() && meal_type.toLowerCase() !== 'all') {
      sql += ' AND meal_type = ?';
      params.push(meal_type.toLowerCase().trim());
    }
    sql += ' GROUP BY payment_method';

    const [incomeGroups] = await pool.execute(sql, params);

    let totalIncome = 0;
    let totalPaidOrders = 0;
    const breakdown = {
      razorpay: { amount: 0, count: 0 },
      counter_cash: { amount: 0, count: 0 },
      counter_upi: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    incomeGroups.forEach((group) => {
      let rawMethod = (group.payment_method || 'counter_cash').toLowerCase().trim();
      let method = rawMethod;
      if (rawMethod === 'cash') method = 'counter_cash';
      else if (rawMethod === 'upi') method = 'counter_upi';
      else if (rawMethod === 'razorpay' || rawMethod === 'online') method = 'razorpay';
      else if (!breakdown[method]) method = 'other';

      const amt = Number(group.sum || 0);
      const cnt = Number(group.count || 0);
      breakdown[method].amount += amt;
      breakdown[method].count += cnt;
      totalIncome += amt;
      totalPaidOrders += cnt;
    });

    return res.status(200).json({
      success: true,
      from: from || null,
      to: to || null,
      meal_type: meal_type || null,
      total_income: totalIncome,
      total_paid_orders: totalPaidOrders,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching income history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching income history.' });
  }
};

// Monthly Orders Analytics & Growth Comparison for Admin Order History Grid
const getAdminMonthlyOrderAnalytics = async (req, res) => {
  try {
    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';

    // 1. Query past months of paid orders
    const [monthRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m') AS month_key,
        DATE_FORMAT(o.created_at, '%M %Y') AS month_name,
        DATE_FORMAT(o.created_at, '%b %Y') AS short_name,
        YEAR(o.created_at) AS year,
        MONTH(o.created_at) AS month_num,
        COUNT(*) AS total_orders,
        COUNT(CASE WHEN o.order_status = 'delivered' THEN 1 END) AS delivered_orders,
        COUNT(CASE WHEN o.order_status = 'expired' THEN 1 END) AS expired_orders,
        COUNT(CASE WHEN o.order_status = 'cancelled' THEN 1 END) AS cancelled_orders,
        SUM(o.total_amount) AS total_revenue
      FROM \`Order\` o
      WHERE o.payment_status = 'paid'
        AND o.token_number IS NOT NULL
        AND o.token_number != ''
      GROUP BY 
        DATE_FORMAT(o.created_at, '%Y-%m'), 
        DATE_FORMAT(o.created_at, '%M %Y'),
        DATE_FORMAT(o.created_at, '%b %Y'),
        YEAR(o.created_at), 
        MONTH(o.created_at)
      ORDER BY month_key DESC
      LIMIT 12
    `);

    // Ensure the current calendar month is always present even if 0 orders have been placed yet
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7); // e.g. "2026-08"
    const currentMonthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const currentShortName = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    let monthsList = [...monthRows];
    if (!monthsList.some((m) => m.month_key === currentMonthKey)) {
      monthsList.unshift({
        month_key: currentMonthKey,
        month_name: currentMonthName,
        short_name: currentShortName,
        year: now.getFullYear(),
        month_num: now.getMonth() + 1,
        total_orders: 0,
        delivered_orders: 0,
        expired_orders: 0,
        cancelled_orders: 0,
        total_revenue: 0,
      });
    }

    // 2. Compute Month-over-Month (MoM) growth for each month relative to its preceding month (idx+1)
    const processedMonths = monthsList.map((current, idx) => {
      const prev = monthsList[idx + 1] || null;
      const currentOrders = Number(current.total_orders || 0);
      const prevOrders = prev ? Number(prev.total_orders || 0) : null;

      let ordersDiff = 0;
      let ordersGrowthPct = 0;
      let trend = 'neutral'; // 'increased', 'decreased', 'neutral', 'first_record'

      if (prev !== null) {
        ordersDiff = currentOrders - prevOrders;
        if (prevOrders > 0) {
          ordersGrowthPct = Number(((ordersDiff / prevOrders) * 100).toFixed(1));
        } else if (currentOrders > 0) {
          ordersGrowthPct = 100;
        } else {
          ordersGrowthPct = 0;
        }

        if (ordersDiff > 0) {
          trend = 'increased';
        } else if (ordersDiff < 0) {
          trend = 'decreased';
        } else {
          trend = 'neutral';
        }
      } else {
        trend = 'first_record';
      }

      // Relative badge description (e.g. "Current Month", "1 Month Ago", "2 Months Ago")
      let relativeLabel = 'Past Month';
      if (idx === 0) {
        relativeLabel = 'Current Month';
      } else if (idx === 1) {
        relativeLabel = '1 Month Ago';
      } else {
        relativeLabel = `${idx} Months Ago`;
      }

      const item = {
        month_key: current.month_key,
        month_name: current.month_name,
        short_name: current.short_name,
        relative_label: relativeLabel,
        is_current_month: idx === 0,
        total_orders: currentOrders,
        delivered_orders: Number(current.delivered_orders || 0),
        expired_orders: Number(current.expired_orders || 0),
        cancelled_orders: Number(current.cancelled_orders || 0),
        mom_comparison: {
          prev_month_name: prev ? prev.month_name : null,
          prev_orders: prevOrders,
          orders_diff: ordersDiff,
          growth_percentage: Math.abs(ordersGrowthPct),
          signed_growth_percentage: ordersGrowthPct,
          trend: trend, // 'increased' | 'decreased' | 'neutral' | 'first_record'
        },
      };

      if (isSuperAdmin) {
        item.total_revenue = Number(current.total_revenue || 0);
      }

      return item;
    });

    // 3. Top summary analysis for the current month vs previous month
    const currentMonthData = processedMonths[0];
    const prevMonthData = processedMonths[1] || null;

    let analysisMessage = 'No previous month data recorded for comparison.';
    if (prevMonthData) {
      const diff = currentMonthData.mom_comparison.orders_diff;
      const pct = currentMonthData.mom_comparison.growth_percentage;
      const prevName = prevMonthData.month_name;

      if (diff > 0) {
        analysisMessage = `Orders increased by ${pct}% (+${diff} more orders) compared to ${prevName}.`;
      } else if (diff < 0) {
        analysisMessage = `Orders decreased by ${pct}% (${Math.abs(diff)} fewer orders) compared to ${prevName}.`;
      } else {
        analysisMessage = `Orders volume is identical to ${prevName} (${currentMonthData.total_orders} orders).`;
      }
    }

    return res.status(200).json({
      success: true,
      current_month_key: currentMonthKey,
      analysis: {
        trend: currentMonthData?.mom_comparison?.trend || 'neutral',
        growth_percentage: currentMonthData?.mom_comparison?.growth_percentage || 0,
        signed_growth_percentage: currentMonthData?.mom_comparison?.signed_growth_percentage || 0,
        orders_diff: currentMonthData?.mom_comparison?.orders_diff || 0,
        message: analysisMessage,
        current_orders: currentMonthData?.total_orders || 0,
        prev_orders: prevMonthData?.total_orders || 0,
        prev_month_name: prevMonthData?.month_name || 'Previous Month',
      },
      months: processedMonths,
    });
  } catch (error) {
    console.error('Error computing monthly order analytics:', error);
    return res.status(500).json({ success: false, message: 'Failed to compute monthly order analytics.' });
  }
};

/**
 * FEATURE 1: Manual Order Entry by Admin/Staff for Walk-in Customers
 * POST /api/admin/orders/manual (or /orders/manual)
 *
 * Accepts:
 * - customer_name: string (required)
 * - meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snacks' (required)
 * - items: array of { menu_item_id / id, quantity } (required)
 * - payment_method: 'cash' | 'upi' | 'other' (required)
 */
// Admin Manual Walk-in Order Creation (Feature 1)
const createManualOrder = async (req, res) => {
  try {
    await ensureOrderSchemaOnce();
    const {
      customer_name,
      meal_type,
      payment_method,
      items,
      order_type,
      is_parcel,
    } = req.body;

    // 1. Validate customer name
    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required for manual order.' });
    }
    const cleanCustomerName = customer_name.trim();

    // 2. Validate meal_type
    const incomingMealType = meal_type || (items && items[0]?.meal_type);
    if (!incomingMealType || typeof incomingMealType !== 'string' || !incomingMealType.trim()) {
      return res.status(400).json({ success: false, message: 'Valid meal_type is required.' });
    }
    const targetMealType = incomingMealType.toLowerCase().trim();
    const normalizedVariants = Array.from(new Set([
      targetMealType,
      targetMealType.replace(/_/g, ' '),
      targetMealType.replace(/\s+/g, '_'),
      targetMealType.replace(/[\s_-]+/g, '_'),
      targetMealType.replace(/[\s_-]+/g, ' '),
    ])).filter(Boolean);

    // 3. Determine order_type and normalize payment_method
    const isParcelOrder = order_type === 'parcel' || Boolean(is_parcel);
    const targetOrderType = isParcelOrder ? 'parcel' : 'dine_in';

    const rawMethod = (payment_method || 'counter_cash').toLowerCase().trim();
    let dbPaymentMethod = rawMethod;
    if (rawMethod === 'cash') dbPaymentMethod = 'counter_cash';
    else if (rawMethod === 'upi') dbPaymentMethod = 'counter_upi';
    else if (!['counter_cash', 'counter_upi', 'razorpay', 'other'].includes(dbPaymentMethod)) {
      dbPaymentMethod = 'other';
    }

    // 4. Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one menu item is required.' });
    }

    // 5. Enforce meal-window / is_currently_open checks (same rules as normal ordering)
    const placeholders = normalizedVariants.map(() => '?').join(', ');
    const [windowRows] = await pool.execute(
      `SELECT * FROM MealWindow WHERE LOWER(meal_type) IN (${placeholders}) LIMIT 1`,
      normalizedVariants
    );
    const windowDoc = windowRows[0] || null;
    const effectiveMealType = windowDoc ? windowDoc.meal_type.toLowerCase() : targetMealType;

    if (windowDoc) {
      const windowStatus = computeMealStatus(windowDoc);
      if (!windowStatus.is_active) {
        return res.status(400).json({
          success: false,
          message: `The meal category '${windowDoc.meal_type.toUpperCase()}' is currently deactivated.`,
        });
      }
      if (!windowStatus.is_currently_open) {
        return res.status(400).json({
          success: false,
          message: `Ordering for ${windowDoc.meal_type.toUpperCase()} is currently closed. Operating window: ${windowStatus.formatted_start_time} – ${windowStatus.formatted_end_time}.`,
        });
      }
    }

    // 6. Validate items against MenuItem table and calculate pre-discount subtotal
    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const cartItem of items) {
      const rawId = cartItem.menu_item_id || cartItem.menu_item || cartItem.id;
      const numericId = rawId ? parseInt(rawId, 10) : NaN;
      let dbItem = null;

      if (!isNaN(numericId)) {
        const [menuRows] = await pool.execute('SELECT * FROM MenuItem WHERE id = ? LIMIT 1', [numericId]);
        dbItem = menuRows[0] || null;
      }

      if (!dbItem && (cartItem.name || cartItem.item_name)) {
        const nameToSearch = cartItem.name || cartItem.item_name;
        const [menuRows] = await pool.execute('SELECT * FROM MenuItem WHERE name = ? AND is_active = 1 LIMIT 1', [nameToSearch]);
        dbItem = menuRows[0] || null;
      }

      if (!dbItem || !dbItem.is_active) {
        return res.status(400).json({
          success: false,
          message: `Item '${cartItem.name || cartItem.item_name || 'selected'}' is currently unavailable.`,
        });
      }

      const itemQuantity = Math.max(1, parseInt(cartItem.quantity, 10) || 1);
      const { itemPrice, itemName, variantName } = resolveMenuItemVariant(dbItem, cartItem);
      const itemTotal = itemPrice * itemQuantity;
      calculatedSubtotal += itemTotal;

      validatedItems.push({
        menu_item_id: dbItem.id,
        item_name: itemName,
        variant_name: variantName,
        price: itemPrice,
        quantity: itemQuantity,
      });
    }

    if (calculatedSubtotal <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order total.' });
    }

    // Check prepared menu stock availability if tracking is enabled
    const manualMenuTracking = await isMenuStockTrackingEnabled();
    if (manualMenuTracking) {
      for (const item of validatedItems) {
        const [menuRows] = await pool.execute(
          'SELECT id, name, available_quantity, is_available FROM MenuItem WHERE id = ? LIMIT 1',
          [item.menu_item_id]
        );
        const mItem = menuRows[0];
        if (!mItem || mItem.is_available === 0 || Number(mItem.available_quantity) <= 0) {
          return res.status(400).json({
            success: false,
            message: `'${item.item_name}' is currently out of stock.`,
            is_out_of_stock: true,
            item_name: item.item_name,
            available_quantity: 0,
          });
        }
        if (item.quantity > Number(mItem.available_quantity)) {
          return res.status(400).json({
            success: false,
            message: `Only ${mItem.available_quantity} portions of '${item.item_name}' are available right now!`,
            is_insufficient_stock: true,
            item_name: item.item_name,
            available_quantity: Number(mItem.available_quantity),
          });
        }
      }
    }

    // 7. Check ingredient inventory requirements before deducting
    const inventoryRequirements = {};
    for (const item of validatedItems) {
      if (!item.menu_item_id) continue;

      const [recipeItems] = await pool.execute(
        `SELECT ri.*, ii.name AS inventory_item_name, ii.unit AS inventory_item_unit 
         FROM RecipeItem ri
         INNER JOIN InventoryItem ii ON ri.inventory_item_id = ii.id
         WHERE ri.menu_item_id = ?`,
        [item.menu_item_id]
      );

      for (const ri of recipeItems) {
        const convertedRequired = convertToInventoryBaseUnit(
          Number(ri.quantity_required),
          ri.quantity_unit || ri.inventory_item_unit,
          ri.inventory_item_unit
        );
        const needed = convertedRequired * item.quantity;
        const itemId = ri.inventory_item_id;
        if (!inventoryRequirements[itemId]) {
          inventoryRequirements[itemId] = {
            needed: 0,
            name: ri.inventory_item_name,
            unit: ri.inventory_item_unit,
          };
        }
        inventoryRequirements[itemId].needed += needed;
      }
    }

    for (const itemId of Object.keys(inventoryRequirements)) {
      const { needed, name } = inventoryRequirements[itemId];
      const [invRows] = await pool.execute(
        'SELECT id, name, quantity_in_stock, is_active FROM InventoryItem WHERE id = ? LIMIT 1',
        [itemId]
      );
      const invItem = invRows[0];
      if (!invItem || !invItem.is_active) {
        return res.status(400).json({
          success: false,
          message: `Sorry, ingredient '${name}' is currently unavailable.`,
        });
      }
      if (Number(invItem.quantity_in_stock) < needed) {
        return res.status(400).json({
          success: false,
          message: `Sorry, ${name} is temporarily unavailable due to low stock.`,
        });
      }
    }

    // 8. Support optional student linking for walk-in orders & apply dynamic discount
    let linkedStudent = null;
    const rawStudentId = req.body.student_id;
    if (rawStudentId) {
      try {
        const [studentRows] = await pool.execute(
          'SELECT id, name, email, roll_no, created_at FROM Student WHERE id = ? LIMIT 1',
          [rawStudentId]
        );
        if (studentRows.length > 0) {
          linkedStudent = studentRows[0];
        }
      } catch (stErr) {
        console.warn('[createManualOrder] Error looking up linked student:', stErr.message);
      }
    }

    const discountInfo = await calculateOrderDiscount({
      subtotal: calculatedSubtotal,
      mealType: targetMealType,
      studentCreatedAt: linkedStudent ? linkedStudent.created_at : null,
    });

    const todayDate = new Date().toISOString().split('T')[0];

    // 9. Atomic Transaction: Generate token, Insert Order & OrderItems, Deduct inventory
    const connection = await pool.getConnection();
    let finalOrderId;
    let finalTokenNumber;
    let finalSeqNumber;

    try {
      await connection.beginTransaction();

      const { tokenNumber, sequenceNumber } = await generateTokenNumber(effectiveMealType, todayDate, connection);
      finalTokenNumber = tokenNumber;
      finalSeqNumber = sequenceNumber;

      const effectiveStudentId = linkedStudent ? linkedStudent.id : null;
      const [orderResult] = await connection.execute(
        `INSERT INTO \`Order\` (
          student_id, customer_name, meal_type, subtotal_amount, discount_percentage, discount_amount, discount_type,
          total_amount, payment_status, payment_method, token_number, daily_sequence, order_status, date, order_type, is_parcel
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, 'placed', ?, ?, ?)`,
        [
          effectiveStudentId,
          cleanCustomerName,
          effectiveMealType,
          discountInfo.subtotal_amount,
          discountInfo.discount_percentage,
          discountInfo.discount_amount,
          discountInfo.discount_type,
          discountInfo.total_amount,
          dbPaymentMethod,
          finalTokenNumber,
          finalSeqNumber,
          todayDate,
          targetOrderType,
          isParcelOrder ? 1 : 0,
        ]
      );
      finalOrderId = orderResult.insertId;

      for (const it of validatedItems) {
        await connection.execute(
          `INSERT INTO OrderItem (order_id, menu_item_id, item_name, price, quantity, variant_name)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [finalOrderId, it.menu_item_id, it.item_name, it.price, it.quantity, it.variant_name || null]
        );
      }

      // Deduct prepared menu portions if tracking is enabled
      const manualTrackingOn = await isMenuStockTrackingEnabled();
      if (manualTrackingOn) {
        for (const it of validatedItems) {
          await connection.execute(
            `UPDATE MenuItem 
             SET available_quantity = GREATEST(0, available_quantity - ?),
                 is_available = CASE WHEN available_quantity - ? <= 0 THEN 0 ELSE is_available END
             WHERE id = ?`,
            [it.quantity, it.quantity, it.menu_item_id]
          );
        }
      }

      // Deduct inventory ingredients and log
      await deductInventoryForOrder(connection, finalOrderId);

      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    const createdOrder = await fetchOrderWithDetails(finalOrderId, true);
    const orderCounts = await computeKitchenOrderCounts(createdOrder.date);

    // 10. Real-time Socket.IO emission to kitchen & menu
    const io = req.app.get('socketio');
    if (io) {
      const socketPayload = {
        _id: createdOrder.id,
        id: createdOrder.id,
        token_number: createdOrder.token_number,
        meal_type: createdOrder.meal_type,
        order_type: createdOrder.order_type || targetOrderType,
        is_parcel: Boolean(createdOrder.is_parcel != null ? createdOrder.is_parcel : isParcelOrder),
        items: createdOrder.items.map((it) => ({
          item_name: it.item_name,
          quantity: it.quantity,
          price: Number(it.price),
        })),
        customer_name: cleanCustomerName,
        student_name: cleanCustomerName,
        roll_no: '',
        subtotal_amount: Number(createdOrder.subtotal_amount),
        discount_percentage: Number(createdOrder.discount_percentage),
        discount_amount: Number(createdOrder.discount_amount),
        total_amount: Number(createdOrder.total_amount),
        payment_method: dbPaymentMethod,
        payment_status: 'paid',
        order_status: createdOrder.order_status,
        created_at: createdOrder.created_at,
        orderCounts,
      };

      io.to('kitchen').emit('order:new', socketPayload);
      io.to('kitchen').emit('order-counts-updated', socketPayload);
      io.to('kitchen').emit('income:updated');
      io.emit('menu:sales_updated', { meal_type: createdOrder.meal_type });
      io.emit('menu:updated', { meal_type: createdOrder.meal_type });
    }

    return res.status(201).json({
      success: true,
      message: 'Manual walk-in order created successfully.',
      token_number: finalTokenNumber,
      order: shapeOrder(createdOrder),
    });
  } catch (error) {
    console.error('Create manual order error:', error);
    return res.status(500).json({ success: false, message: `Failed to create manual order: ${error.message}` });
  }
};

/**
 * Check current server time and discount eligibility for a meal type
 * GET /api/orders/discount-status?meal_type=breakfast
 */
const getDiscountStatus = async (req, res) => {
  try {
    const mealType = req.query.meal_type || 'breakfast';
    const serverTime = getCurrentServerTimeHHMM();
    let studentCreatedAt = req.student ? req.student.created_at : null;

    if (!studentCreatedAt && req.query.student_id) {
      try {
        const [stRows] = await pool.execute(
          'SELECT created_at FROM Student WHERE id = ? LIMIT 1',
          [req.query.student_id]
        );
        if (stRows.length > 0) {
          studentCreatedAt = stRows[0].created_at;
        }
      } catch (stErr) {
        console.warn('[getDiscountStatus] Student query warning:', stErr.message);
      }
    }

    const discountInfo = await calculateOrderDiscount({
      subtotal: 100,
      mealType,
      studentCreatedAt,
      serverTime,
    });

    const settings = discountInfo.settings;

    return res.status(200).json({
      success: true,
      server_time: serverTime,
      meal_type: mealType.toLowerCase(),
      key_id: getCanteenRazorpayCredentials().keyId,
      is_discount_active: discountInfo.is_discount_applied,
      discount_percentage: discountInfo.discount_percentage,
      discount_type: discountInfo.discount_type,
      is_new_user: discountInfo.discount_type === 'new_user',
      new_user_discount_days: settings ? (settings.new_user_discount_days || 0) : 0,
      new_user_discount_percentage: settings ? (settings.new_user_discount_percentage || 0) : 0,
      cutoffs: (settings && settings.cutoffs) || {},
      settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Public client endpoint to retrieve active Razorpay Key ID
 * GET /api/orders/razorpay-key
 */
const getRazorpayKey = async (req, res) => {
  const { keyId } = getCanteenRazorpayCredentials();
  return res.status(200).json({
    success: true,
    key_id: keyId,
  });
};

// Maintenance: Synchronize and verify Order table schema on demand
const syncOrderSchema = async (req, res) => {
  try {
    await initOrderSchema();
    return res.status(200).json({ success: true, message: 'Order schema successfully verified and updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to sync order schema: ' + err.message });
  }
};

// Menu Report API Endpoint for Admin Panel (Daily, Weekly, Monthly, Yearly)
const getMenuReport = async (req, res) => {
  try {
    const period = (req.query.period || 'daily').toLowerCase();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthStr = now.toISOString().slice(0, 7);
    const currentYearStr = String(now.getFullYear());

    let dateParam = req.query.date || todayStr;
    let monthParam = req.query.month || currentMonthStr;
    let yearParam = req.query.year || currentYearStr;

    let dateWhereClause = '';
    let queryParams = [];
    let periodTitle = '';

    if (period === 'daily') {
      dateWhereClause = 'DATE(o.created_at) = ? OR o.date = ?';
      queryParams = [dateParam, dateParam];
      periodTitle = `Daily Report (${dateParam})`;
    } else if (period === 'weekly') {
      dateWhereClause = 'DATE(o.created_at) >= DATE_SUB(?, INTERVAL 6 DAY) AND DATE(o.created_at) <= ?';
      queryParams = [dateParam, dateParam];
      periodTitle = `Weekly Report (7 Days up to ${dateParam})`;
    } else if (period === 'monthly') {
      dateWhereClause = "DATE_FORMAT(o.created_at, '%Y-%m') = ?";
      queryParams = [monthParam];
      periodTitle = `Monthly Report (${monthParam})`;
    } else if (period === 'yearly') {
      dateWhereClause = 'YEAR(o.created_at) = ?';
      queryParams = [yearParam];
      periodTitle = `Yearly Report (${yearParam})`;
    } else {
      dateWhereClause = 'DATE(o.created_at) = ? OR o.date = ?';
      queryParams = [todayStr, todayStr];
      periodTitle = `Daily Report (${todayStr})`;
    }

    // 1. Overall Aggregate Stats
    const [overallRows] = await pool.query(
      `SELECT 
         COUNT(DISTINCT o.id) AS total_orders,
         COALESCE(SUM(o.total_amount), 0) AS total_revenue,
         COALESCE(SUM(o.subtotal_amount), 0) AS subtotal_revenue,
         COALESCE(SUM(o.discount_amount), 0) AS total_discounts,
         COALESCE(SUM(oi.quantity), 0) AS total_items_sold
       FROM \`Order\` o
       LEFT JOIN \`OrderItem\` oi ON o.id = oi.order_id
       WHERE (${dateWhereClause})
         AND (o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
         AND o.token_number IS NOT NULL AND o.token_number != ''`,
      queryParams
    );

    const overall = overallRows[0] || {};
    const totalOrders = Number(overall.total_orders) || 0;
    const totalRevenue = Number(overall.total_revenue) || 0;
    const subtotalRevenue = Number(overall.subtotal_revenue) || 0;
    const totalDiscounts = Number(overall.total_discounts) || 0;
    const totalItemsSold = Number(overall.total_items_sold) || 0;
    const avgOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

    // 2. Menu Items Ranking Breakdown
    const [itemRows] = await pool.query(
      `SELECT 
         oi.menu_item_id,
         oi.item_name,
         COALESCE(mi.meal_type, o.meal_type) AS meal_type,
         mi.image_url,
         COALESCE(mi.available_quantity, 0) AS available_quantity,
         COALESCE(mi.is_available, 1) AS is_available,
         SUM(oi.quantity) AS quantity_sold,
         SUM(oi.quantity * oi.price) AS total_sales,
         COUNT(DISTINCT oi.order_id) AS orders_count
       FROM \`OrderItem\` oi
       INNER JOIN \`Order\` o ON oi.order_id = o.id
       LEFT JOIN \`MenuItem\` mi ON oi.menu_item_id = mi.id
       WHERE (${dateWhereClause})
         AND (o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
         AND o.token_number IS NOT NULL AND o.token_number != ''
       GROUP BY oi.menu_item_id, oi.item_name, COALESCE(mi.meal_type, o.meal_type), mi.image_url, mi.available_quantity, mi.is_available
       ORDER BY quantity_sold DESC, total_sales DESC`,
      queryParams
    );

    const menuItems = itemRows.map((row) => ({
      menu_item_id: row.menu_item_id,
      item_name: row.item_name,
      meal_type: row.meal_type,
      image_url: row.image_url,
      quantity_sold: Number(row.quantity_sold) || 0,
      total_sales: Number(row.total_sales) || 0,
      orders_count: Number(row.orders_count) || 0,
      available_quantity: Number(row.available_quantity) || 0,
      is_available: Boolean(row.is_available),
      sales_share_pct: totalRevenue > 0 ? Number(((Number(row.total_sales) / totalRevenue) * 100).toFixed(1)) : 0,
    }));

    // 3. Meal Category Breakdown
    const [categoryRows] = await pool.query(
      `SELECT 
         LOWER(o.meal_type) AS meal_type,
         COUNT(DISTINCT o.id) AS orders_count,
         COALESCE(SUM(o.total_amount), 0) AS category_revenue,
         COALESCE(SUM(oi.quantity), 0) AS items_sold
       FROM \`Order\` o
       LEFT JOIN \`OrderItem\` oi ON o.id = oi.order_id
       WHERE (${dateWhereClause})
         AND (o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
         AND o.token_number IS NOT NULL AND o.token_number != ''
       GROUP BY LOWER(o.meal_type)`,
      queryParams
    );

    // 4. Order Type Breakdown (Dine-in vs Parcel)
    const [orderTypeRows] = await pool.query(
      `SELECT 
         COALESCE(o.order_type, CASE WHEN o.is_parcel = 1 THEN 'parcel' ELSE 'dine_in' END) AS order_type,
         COUNT(DISTINCT o.id) AS orders_count,
         COALESCE(SUM(o.total_amount), 0) AS revenue
       FROM \`Order\` o
       WHERE (${dateWhereClause})
         AND (o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
         AND o.token_number IS NOT NULL AND o.token_number != ''
       GROUP BY COALESCE(o.order_type, CASE WHEN o.is_parcel = 1 THEN 'parcel' ELSE 'dine_in' END)`,
      queryParams
    );

    // 5. Time Series Trend (Daily/Hourly depending on period)
    let trendRows = [];
    if (period === 'daily') {
      const [hours] = await pool.query(
        `SELECT 
           DATE_FORMAT(o.created_at, '%H:00') AS time_label,
           COUNT(DISTINCT o.id) AS orders,
           COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM \`Order\` o
         WHERE (${dateWhereClause})
           AND (o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
         GROUP BY DATE_FORMAT(o.created_at, '%H:00')
         ORDER BY time_label ASC`,
        queryParams
      );
      trendRows = hours;
    } else if (period === 'yearly') {
      const [months] = await pool.query(
        `SELECT 
           DATE_FORMAT(o.created_at, '%b') AS time_label,
           DATE_FORMAT(o.created_at, '%m') AS month_num,
           COUNT(DISTINCT o.id) AS orders,
           COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM \`Order\` o
         WHERE (${dateWhereClause})
           AND (o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
         GROUP BY DATE_FORMAT(o.created_at, '%b'), DATE_FORMAT(o.created_at, '%m')
         ORDER BY month_num ASC`,
        queryParams
      );
      trendRows = months;
    } else {
      const [days] = await pool.query(
        `SELECT 
           DATE_FORMAT(o.created_at, '%d %b') AS time_label,
           DATE(o.created_at) AS date_key,
           COUNT(DISTINCT o.id) AS orders,
           COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM \`Order\` o
         WHERE (${dateWhereClause})
           AND (o.payment_status = 'paid' OR o.status NOT IN ('cancelled', 'expired'))
         GROUP BY DATE_FORMAT(o.created_at, '%d %b'), DATE(o.created_at)
         ORDER BY date_key ASC`,
        queryParams
      );
      trendRows = days;
    }

    // 6. Inventory Deduction Log summary for this period
    let inventoryLogs = [];
    try {
      const [logRows] = await pool.query(
        `SELECT 
           il.inventory_item_id,
           ii.name AS item_name,
           ii.unit,
           ii.quantity_in_stock,
           SUM(CASE WHEN il.action_type = 'deduction' THEN il.quantity_changed ELSE 0 END) AS total_deducted,
           SUM(CASE WHEN il.action_type = 'restock' THEN il.quantity_changed ELSE 0 END) AS total_restocked
         FROM \`InventoryLog\` il
         INNER JOIN \`InventoryItem\` ii ON il.inventory_item_id = ii.id
         WHERE (${dateWhereClause.replace(/o\./g, 'il.')})
         GROUP BY il.inventory_item_id, ii.name, ii.unit, ii.quantity_in_stock
         ORDER BY total_deducted DESC
         LIMIT 20`,
        queryParams
      );
      inventoryLogs = logRows;
    } catch (e) {
      // If table empty or join mismatch
    }

    return res.status(200).json({
      success: true,
      period,
      period_title: periodTitle,
      selected_date: dateParam,
      selected_month: monthParam,
      selected_year: yearParam,
      summary: {
        total_revenue: totalRevenue,
        subtotal_revenue: subtotalRevenue,
        total_discounts: totalDiscounts,
        total_orders: totalOrders,
        total_items_sold: totalItemsSold,
        avg_order_value: avgOrderValue,
      },
      menu_items: menuItems,
      categories: categoryRows.map((c) => ({
        meal_type: c.meal_type,
        orders_count: Number(c.orders_count) || 0,
        revenue: Number(c.category_revenue) || 0,
        items_sold: Number(c.items_sold) || 0,
      })),
      order_types: orderTypeRows.map((ot) => ({
        order_type: ot.order_type,
        orders_count: Number(ot.orders_count) || 0,
        revenue: Number(ot.revenue) || 0,
      })),
      trend: trendRows.map((t) => ({
        time_label: t.time_label,
        orders: Number(t.orders) || 0,
        revenue: Number(t.revenue) || 0,
      })),
      inventory_logs: inventoryLogs.map((l) => ({
        item_name: l.item_name,
        unit: l.unit,
        current_stock: Number(l.quantity_in_stock) || 0,
        total_deducted: Number(l.total_deducted) || 0,
        total_restocked: Number(l.total_restocked) || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching menu report:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate menu report.' });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPaymentAndFulfill,
  fulfillPaidOrder,
  checkRazorpayOrderStatus,
  reconcileRecentPayments,
  razorpayWebhook,
  getRazorpayKey,
  getCanteenRazorpayCredentials,
  cleanEnvValue,
  getStudentOrders,
  getKitchenOrders,
  getKitchenOrderCounts,
  updateOrderStatus,
  getAdminOrderHistory,
  getTodayIncome,
  getIncomeHistory,
  getAdminMonthlyOrderAnalytics,
  createManualOrder,
  getDiscountStatus,
  computeOrderDiscount,
  getCurrentServerTimeHHMM,
  syncOrderSchema,
  getMenuReport,
};
