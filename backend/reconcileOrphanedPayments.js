/**
 * Manual / Cron Reconciliation Utility Script
 * ──────────────────────────────────────────────
 * Checks recent captured payments in the Canteen Razorpay account.
 * For any payment that was captured but has no corresponding paid Order row in MySQL:
 * 1. Automatically fulfills the order.
 * 2. Generates the sequential daily Token number.
 * 3. Associates it with the Student and records it in daily revenue.
 *
 * Can be run manually via:
 *   node reconcileOrphanedPayments.js
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Locate and load .env
const candidateEnvPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
];

for (const p of candidateEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const Razorpay = require('razorpay');
const { pool } = require('./src/database/db');
const { generateTokenNumber } = require('./src/services/tokenGenerator');
const { cleanEnvValue } = require('./src/controllers/orderController');

const keyId = cleanEnvValue(process.env.RAZORPAY_KEY_ID);
const keySecret = cleanEnvValue(process.env.RAZORPAY_KEY_SECRET);

if (!keyId || !keySecret) {
  console.error('❌ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in environment.');
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

async function reconcile() {
  console.log('========================================================================');
  console.log('🔄 Starting Razorpay Payment Reconciliation...');
  console.log(`Razorpay Account: ${keyId}`);
  console.log('========================================================================\n');

  try {
    const paymentsRes = await razorpay.payments.all({ count: 50 });
    const payments = paymentsRes.items || [];
    const capturedPayments = payments.filter((p) => p.status === 'captured');

    console.log(`Fetched ${payments.length} total payments, found ${capturedPayments.length} CAPTURED payments.\n`);

    let reconciledCount = 0;
    let alreadyFulfilledCount = 0;

    for (const payment of capturedPayments) {
      const paymentId = payment.id;
      const orderId = payment.order_id;
      const amountRupees = Number(payment.amount) / 100;
      const paymentDate = new Date(payment.created_at * 1000).toISOString().split('T')[0];

      // Check if order exists in DB by razorpay_order_id or razorpay_payment_id
      const [existingRows] = await pool.execute(
        `SELECT id, student_id, token_number, payment_status, total_amount, date 
         FROM \`Order\` 
         WHERE (razorpay_order_id = ? AND razorpay_order_id IS NOT NULL) 
            OR (razorpay_payment_id = ? AND razorpay_payment_id IS NOT NULL)
         LIMIT 1`,
        [orderId || '', paymentId]
      );

      const existingOrder = existingRows[0] || null;

      if (existingOrder && existingOrder.payment_status === 'paid' && existingOrder.token_number) {
        alreadyFulfilledCount++;
        continue;
      }

      console.log(`🚨 Orphaned Payment Detected:`);
      console.log(`   - Payment ID: ${paymentId}`);
      console.log(`   - Razorpay Order ID: ${orderId || 'N/A'}`);
      console.log(`   - Amount: ₹${amountRupees}`);
      console.log(`   - Customer Email: ${payment.email || 'N/A'}`);
      console.log(`   - Date: ${paymentDate}`);

      // Extract notes
      const notes = payment.notes || {};
      let studentId = notes.student_id ? parseInt(notes.student_id, 10) : null;
      const mealType = (notes.meal_type || 'breakfast').toLowerCase();
      const subtotalAmt = Number(notes.subtotal_amount || amountRupees);
      const discAmt = Number(notes.discount_amount || 0);
      const discPct = Number(notes.discount_percentage || 0);
      const discType = notes.discount_type || (discAmt > 0 ? 'discount' : 'none');
      const totalAmt = Number(notes.total_amount || amountRupees);

      // If studentId wasn't in payment notes, check Razorpay Order notes
      if (!studentId && orderId) {
        try {
          const rzpOrder = await razorpay.orders.fetch(orderId);
          if (rzpOrder.notes?.student_id) {
            studentId = parseInt(rzpOrder.notes.student_id, 10);
          }
        } catch (e) { /* ignore */ }
      }

      // If still no studentId, attempt lookup by student email
      let customerName = null;
      if (!studentId && payment.email) {
        const [sRows] = await pool.execute('SELECT id, name FROM Student WHERE email = ? LIMIT 1', [payment.email]);
        if (sRows.length > 0) {
          studentId = sRows[0].id;
          customerName = sRows[0].name;
        }
      } else if (studentId) {
        const [sRows] = await pool.execute('SELECT name FROM Student WHERE id = ? LIMIT 1', [studentId]);
        if (sRows.length > 0) {
          customerName = sRows[0].name;
        }
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const { tokenNumber, sequenceNumber } = await generateTokenNumber(mealType, paymentDate, connection);

        let finalOrderId;
        if (existingOrder) {
          // Update existing order row that was pending
          await connection.execute(
            `UPDATE \`Order\` 
             SET payment_status = 'paid', is_paid = 1, payment_method = 'razorpay',
                 razorpay_payment_id = ?, token_number = ?, daily_sequence = ?,
                 order_status = 'placed', date = ?
             WHERE id = ?`,
            [paymentId, tokenNumber, sequenceNumber, paymentDate, existingOrder.id]
          );
          finalOrderId = existingOrder.id;

          // If no items in OrderItem, insert fallback item
          const [itRows] = await connection.execute('SELECT id FROM OrderItem WHERE order_id = ? LIMIT 1', [finalOrderId]);
          if (itRows.length === 0) {
            await connection.execute(
              `INSERT INTO OrderItem (order_id, menu_item_id, item_name, price, quantity)
               VALUES (?, NULL, ?, ?, 1)`,
              [finalOrderId, `${mealType.toUpperCase()} Meal (Online Order)`, totalAmt]
            );
          }
        } else {
          // Create new Order row
          const [orderResult] = await connection.execute(
            `INSERT INTO \`Order\` (
              student_id, customer_name, meal_type, subtotal_amount,
              discount_percentage, discount_amount, discount_type, total_amount,
              payment_status, payment_method, razorpay_order_id, razorpay_payment_id,
              token_number, daily_sequence, order_status, date, order_type, is_parcel, is_paid
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'razorpay', ?, ?, ?, ?, 'placed', ?, 'dine_in', 0, 1)`,
            [
              studentId,
              customerName || 'Student',
              mealType,
              subtotalAmt,
              discPct,
              discAmt,
              discType,
              totalAmt,
              orderId || null,
              paymentId,
              tokenNumber,
              sequenceNumber,
              paymentDate,
            ]
          );
          finalOrderId = orderResult.insertId;

          await connection.execute(
            `INSERT INTO OrderItem (order_id, menu_item_id, item_name, price, quantity)
             VALUES (?, NULL, ?, ?, 1)`,
            [finalOrderId, `${mealType.toUpperCase()} Meal (Online Order)`, totalAmt]
          );
        }

        await connection.commit();

        console.log(`   ✅ RECOVERED! Assigned Token: ${tokenNumber} (Order #${finalOrderId}, Student: ${customerName || studentId || 'N/A'})\n`);
        reconciledCount++;
      } catch (err) {
        await connection.rollback();
        console.error(`   ❌ Failed to recover payment ${paymentId}:`, err.message);
      } finally {
        connection.release();
      }
    }

    console.log('========================================================================');
    console.log(`Reconciliation Complete!`);
    console.log(`- Already Fulfilled: ${alreadyFulfilledCount}`);
    console.log(`- Newly Reconciled: ${reconciledCount}`);
    console.log('========================================================================\n');
  } catch (error) {
    console.error('❌ Reconciliation Error:', error.message);
  } finally {
    await pool.end();
  }
}

reconcile();
