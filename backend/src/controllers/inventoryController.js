const { pool } = require('../database/db');

// Helper to cast decimal properties to float/number for JSON response
const shapeItem = (item) => {
  if (!item) return null;
  return {
    ...item,
    quantity_in_stock: Number(item.quantity_in_stock),
    low_stock_threshold: Number(item.low_stock_threshold),
  };
};

const shapeLog = (log) => {
  if (!log) return null;
  return {
    ...log,
    quantity_changed: Number(log.quantity_changed),
    admin_user: log.admin_user ? { id: log.admin_user.id, username: log.admin_user.username } : null,
    order: log.order ? { id: log.order.id, token_number: log.order.token_number } : null,
  };
};

// 1. Create Inventory Item
const createInventoryItem = async (req, res) => {
  try {
    const { name, unit, quantity_in_stock, low_stock_threshold, category } = req.body;

    if (!name || !unit || quantity_in_stock === undefined || low_stock_threshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, unit, quantity_in_stock, and low_stock_threshold are required.',
      });
    }

    const validUnits = ['kg', 'g', 'litre', 'ml', 'piece', 'packet'];
    const cleanUnit = String(unit).toLowerCase().trim();
    if (!validUnits.includes(cleanUnit)) {
      return res.status(400).json({
        success: false,
        message: `Invalid unit. Allowed units: ${validUnits.join(', ')}`,
      });
    }

    const cleanCategory = (category || 'other').toString().toLowerCase().trim();

    // Case-insensitive duplicate name check
    const [allItems] = await pool.query('SELECT id, name FROM InventoryItem');
    const duplicate = allItems.find((i) => i.name.toLowerCase().trim() === name.trim().toLowerCase());
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `"${name.trim()}" already exists in inventory — did you mean to restock it instead?`,
      });
    }

    // Atomic generate unique_inventory_id (INV-0001) in a transaction
    const connection = await pool.getConnection();
    let uniqueId;
    let itemId;
    try {
      await connection.beginTransaction();

      // Find max existing number in InventoryItem to avoid duplicate key conflicts
      const [maxRows] = await connection.execute(
        `SELECT MAX(CAST(SUBSTRING(unique_inventory_id, 5) AS UNSIGNED)) AS max_id 
         FROM InventoryItem 
         WHERE unique_inventory_id LIKE 'INV-%'`
      );
      const currentMaxId = maxRows[0]?.max_id || 0;

      await connection.execute(
        `INSERT INTO \`InventoryCounter\` (\`id\`, \`last_value\`)
         VALUES (1, ?)
         ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, ?) + 1`,
        [currentMaxId + 1, currentMaxId]
      );

      const [counterRows] = await connection.execute(
        'SELECT `last_value` FROM `InventoryCounter` WHERE `id` = 1 LIMIT 1'
      );
      let lastValue = counterRows[0]?.last_value || (currentMaxId + 1);

      // Verify uniqueId does not already exist
      uniqueId = `INV-${String(lastValue).padStart(4, '0')}`;
      let isUnique = false;
      while (!isUnique) {
        const [existing] = await connection.execute(
          'SELECT `id` FROM `InventoryItem` WHERE `unique_inventory_id` = ? LIMIT 1',
          [uniqueId]
        );
        if (existing.length === 0) {
          isUnique = true;
        } else {
          lastValue += 1;
          uniqueId = `INV-${String(lastValue).padStart(4, '0')}`;
          await connection.execute(
            'UPDATE `InventoryCounter` SET `last_value` = ? WHERE `id` = 1',
            [lastValue]
          );
        }
      }

      // Insert new item
      const [insertResult] = await connection.execute(
        `INSERT INTO InventoryItem (unique_inventory_id, name, unit, quantity_in_stock, low_stock_threshold, category, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [uniqueId, name.trim(), cleanUnit, Number(quantity_in_stock), Number(low_stock_threshold), cleanCategory]
      );
      itemId = insertResult.insertId;

      // Write initial log if stock > 0
      if (Number(quantity_in_stock) > 0) {
        await connection.execute(
          `INSERT INTO InventoryLog (inventory_item_id, action_type, quantity_changed, admin_user_id)
           VALUES (?, 'restock', ?, ?)`,
          [itemId, Number(quantity_in_stock), req.adminId || null]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const [newRows] = await pool.execute('SELECT * FROM InventoryItem WHERE id = ? LIMIT 1', [itemId]);
    const newItem = newRows[0];

    return res.status(201).json({
      success: true,
      message: 'Inventory item created successfully!',
      item: shapeItem(newItem),
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create inventory item.' });
  }
};

// 2. List Inventory Items (Paginated & Searchable)
const listInventoryItems = async (req, res) => {
  try {
    const { search, is_active, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let countSql = 'SELECT COUNT(*) AS total FROM InventoryItem';
    let selectSql = 'SELECT * FROM InventoryItem';
    const params = [];
    const whereClauses = [];
    
    if (search) {
      whereClauses.push('(name LIKE ? OR unique_inventory_id LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }
    
    if (is_active !== undefined) {
      whereClauses.push('is_active = ?');
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    if (whereClauses.length > 0) {
      const whereSql = ' WHERE ' + whereClauses.join(' AND ');
      countSql += whereSql;
      selectSql += whereSql;
    }
    
    const [countResult] = await pool.query(countSql, params);
    const totalCount = countResult[0].total;
    
    selectSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const selectParams = [...params, limitNum, skip];
    const [items] = await pool.query(selectSql, selectParams);

    return res.status(200).json({
      success: true,
      count: totalCount,
      page: pageNum,
      pages: Math.ceil(totalCount / limitNum),
      items: items.map(shapeItem),
    });
  } catch (error) {
    console.error('Error listing inventory items:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory items.' });
  }
};

// 3. Update Inventory Item
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);
    const updates = { ...req.body };

    const [existingRows] = await pool.execute('SELECT * FROM InventoryItem WHERE id = ? LIMIT 1', [targetId]);
    const existing = existingRows[0] || null;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }

    if (updates.unit) {
      const validUnits = ['kg', 'g', 'litre', 'ml', 'piece', 'packet'];
      if (!validUnits.includes(updates.unit)) {
        return res.status(400).json({ success: false, message: 'Invalid unit.' });
      }
    }

    if (updates.category !== undefined) {
      const validCategories = ['vegetables', 'grains_pulses', 'dairy_proteins', 'oil_spices', 'snack_essentials', 'beverages', 'other'];
      if (!validCategories.includes(updates.category)) {
        return res.status(400).json({ success: false, message: 'Invalid category.' });
      }
    }

    // Prepare update data
    const data = {};
    if (updates.name !== undefined) data.name = updates.name.trim();
    if (updates.unit !== undefined) data.unit = updates.unit;
    if (updates.quantity_in_stock !== undefined) data.quantity_in_stock = Number(updates.quantity_in_stock);
    if (updates.low_stock_threshold !== undefined) data.low_stock_threshold = Number(updates.low_stock_threshold);
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.is_active !== undefined) {
      if (typeof updates.is_active === 'string') {
        data.is_active = updates.is_active === 'true' ? 1 : 0;
      } else {
        data.is_active = updates.is_active ? 1 : 0;
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const keys = Object.keys(data);
      if (keys.length > 0) {
        const setClause = keys.map((k) => `\`${k}\` = ?`).join(', ');
        const vals = Object.values(data);
        vals.push(targetId);
        await connection.execute(
          `UPDATE InventoryItem SET ${setClause} WHERE id = ?`,
          vals
        );
      }

      // Log update if quantity changed manually
      if (updates.quantity_in_stock !== undefined) {
        const diff = Number(updates.quantity_in_stock) - Number(existing.quantity_in_stock);
        if (diff !== 0) {
          await connection.execute(
            `INSERT INTO InventoryLog (inventory_item_id, action_type, quantity_changed, admin_user_id)
             VALUES (?, ?, ?, ?)`,
            [targetId, diff > 0 ? 'restock' : 'deduction', diff, req.adminId || null]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const [updatedRows] = await pool.execute('SELECT * FROM InventoryItem WHERE id = ? LIMIT 1', [targetId]);
    const updated = updatedRows[0];

    return res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully.',
      item: shapeItem(updated),
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to update inventory item.' });
  }
};

// 4. Delete Item from Database (Hard Delete)
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const [existingRows] = await pool.execute('SELECT * FROM InventoryItem WHERE id = ? LIMIT 1', [targetId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }

    await pool.execute('DELETE FROM InventoryItem WHERE id = ?', [targetId]);

    return res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully from database.',
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete inventory item.' });
  }
};

// 5. Restock Item (Add stock)
const restockInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);
    const { quantity } = req.body;

    const amount = Number(quantity);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'A valid positive restock quantity is required.' });
    }

    const [existingRows] = await pool.execute('SELECT * FROM InventoryItem WHERE id = ? LIMIT 1', [targetId]);
    const existing = existingRows[0] || null;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }

    // Atomic update stock and log in transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE InventoryItem SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?',
        [amount, targetId]
      );

      await connection.execute(
        `INSERT INTO InventoryLog (inventory_item_id, action_type, quantity_changed, admin_user_id)
         VALUES (?, 'restock', ?, ?)`,
        [targetId, amount, req.adminId || null]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const [updatedRows] = await pool.execute('SELECT * FROM InventoryItem WHERE id = ? LIMIT 1', [targetId]);
    const updated = updatedRows[0];

    return res.status(200).json({
      success: true,
      message: `Restocked ${amount} ${existing.unit} successfully!`,
      item: shapeItem(updated),
    });
  } catch (error) {
    console.error('Error restocking inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to restock inventory item.' });
  }
};

// 6. Get Item Logs / Audit history
const getInventoryItemLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const [logs] = await pool.execute(
      `SELECT il.*, au.username AS admin_username, o.token_number AS order_token_number
       FROM InventoryLog il
       LEFT JOIN AdminUser au ON il.admin_user_id = au.id
       LEFT JOIN \`Order\` o ON il.order_id = o.id
       WHERE il.inventory_item_id = ?
       ORDER BY il.created_at DESC
       LIMIT 50`,
      [targetId]
    );

    const shapedLogs = logs.map((row) => ({
      id: row.id,
      inventory_item_id: row.inventory_item_id,
      action_type: row.action_type,
      quantity_changed: Number(row.quantity_changed),
      admin_user_id: row.admin_user_id,
      order_id: row.order_id,
      created_at: row.created_at,
      admin_user: row.admin_user_id ? { id: row.admin_user_id, username: row.admin_username } : null,
      order: row.order_id ? { id: row.order_id, token_number: row.order_token_number } : null,
    }));

    return res.status(200).json({
      success: true,
      logs: shapedLogs,
    });
  } catch (error) {
    console.error('Error fetching inventory item logs:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve logs.' });
  }
};

// 7. Get Inventory Dashboard Summary (Alerts + Stats + Recent Logs)
const getInventoryDashboardSummary = async (req, res) => {
  try {
    const [totalResult] = await pool.query('SELECT COUNT(*) AS total FROM InventoryItem');
    const totalItems = totalResult[0].total;

    const [activeResult] = await pool.query('SELECT COUNT(*) AS active FROM InventoryItem WHERE is_active = 1');
    const activeItems = activeResult[0].active;

    // Out of stock level
    const [outOfStockItems] = await pool.query(
      'SELECT * FROM InventoryItem WHERE quantity_in_stock <= 0 AND is_active = 1'
    );

    // Low stock level (lte threshold and gte 0.001)
    const [allActiveItems] = await pool.query(
      'SELECT * FROM InventoryItem WHERE is_active = 1'
    );

    const lowStockItems = allActiveItems.filter((item) => {
      const stock = Number(item.quantity_in_stock);
      const threshold = Number(item.low_stock_threshold);
      return stock <= threshold && stock > 0;
    });

    const outOfStockCount = outOfStockItems.length;
    const lowStockCount = lowStockItems.length;

    // Recent logs (take 15)
    const [recentLogs] = await pool.query(
      `SELECT il.*, 
              ii.name AS inventory_item_name, ii.unit AS inventory_item_unit, ii.unique_inventory_id AS inventory_item_unique_id,
              au.username AS admin_username,
              o.token_number AS order_token_number
       FROM InventoryLog il
       INNER JOIN InventoryItem ii ON il.inventory_item_id = ii.id
       LEFT JOIN AdminUser au ON il.admin_user_id = au.id
       LEFT JOIN \`Order\` o ON il.order_id = o.id
       ORDER BY il.created_at DESC
       LIMIT 15`
    );

    const shapedRecentLogs = recentLogs.map((row) => ({
      id: row.id,
      inventory_item_id: row.inventory_item_id,
      action_type: row.action_type,
      quantity_changed: Number(row.quantity_changed),
      admin_user_id: row.admin_user_id,
      order_id: row.order_id,
      created_at: row.created_at,
      admin_user: row.admin_user_id ? { id: row.admin_user_id, username: row.admin_username } : null,
      order: row.order_id ? { id: row.order_id, token_number: row.order_token_number } : null,
      inventory_item: {
        unique_inventory_id: row.inventory_item_unique_id,
        name: row.inventory_item_name,
        unit: row.inventory_item_unit,
      },
    }));

    return res.status(200).json({
      success: true,
      stats: {
        totalItems,
        activeItems,
        outOfStockCount,
        lowStockCount,
      },
      lowStockItems: lowStockItems.map(shapeItem),
      outOfStockItems: outOfStockItems.map(shapeItem),
      recentLogs: shapedRecentLogs,
    });
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard summary.' });
  }
};

// Helper to get menu stock tracking config
const isMenuStockTrackingEnabled = async () => {
  try {
    const [rows] = await pool.query(
      "SELECT value_str FROM `InventoryConfig` WHERE key_name = 'menu_stock_tracking_enabled' LIMIT 1"
    );
    return rows.length > 0 && String(rows[0].value_str).toLowerCase() === 'true';
  } catch (err) {
    return false;
  }
};

// 8. Get Menu Stock and Tracking Status
const getMenuStock = async (req, res) => {
  try {
    const trackingEnabled = await isMenuStockTrackingEnabled();
    const [menuRows] = await pool.query(
      `SELECT id, name, meal_type, price, image_url, is_active, 
              COALESCE(is_available, 1) AS is_available,
              COALESCE(available_quantity, 100) AS available_quantity,
              COALESCE(daily_stock_limit, 100) AS daily_stock_limit
       FROM \`MenuItem\`
       WHERE is_active = 1
       ORDER BY meal_type ASC, name ASC`
    );

    return res.status(200).json({
      success: true,
      tracking_enabled: trackingEnabled,
      trackingEnabled: trackingEnabled,
      items: menuRows.map((item) => ({
        ...item,
        category: item.meal_type,
        meal_type: item.meal_type,
        is_available: Boolean(item.is_available),
        available_quantity: Number(item.available_quantity),
        daily_stock_limit: Number(item.daily_stock_limit),
        price: Number(item.price),
      })),
    });
  } catch (error) {
    console.error('Error fetching menu stock:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch menu stock.' });
  }
};

// 9. Toggle Menu Stock Tracking ON/OFF
const toggleMenuStockTracking = async (req, res) => {
  try {
    const { enabled } = req.body;
    const isEnabled = Boolean(enabled);
    const valueStr = isEnabled ? 'true' : 'false';

    // Ensure InventoryConfig table exists
    await pool.query(
      `CREATE TABLE IF NOT EXISTS \`InventoryConfig\` (
        \`key_name\` VARCHAR(100) PRIMARY KEY,
        \`value_str\` VARCHAR(255) NOT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );

    await pool.query(
      `INSERT INTO \`InventoryConfig\` (key_name, value_str)
       VALUES ('menu_stock_tracking_enabled', ?)
       ON DUPLICATE KEY UPDATE value_str = ?`,
      [valueStr, valueStr]
    );

    const io = req.app.get('socketio');
    if (io) {
      io.emit('inventory:tracking_toggled', { 
        tracking_enabled: isEnabled,
        trackingEnabled: isEnabled
      });
    }

    return res.status(200).json({
      success: true,
      tracking_enabled: isEnabled,
      trackingEnabled: isEnabled,
      message: `Menu portion tracking is now ${isEnabled ? 'ACTIVE' : 'INACTIVE'}.`,
    });
  } catch (error) {
    console.error('Error toggling menu stock tracking:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle menu tracking.' });
  }
};

// 10. Update Specific Menu Item Stock
const updateMenuItemStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { available_quantity, daily_stock_limit, is_available } = req.body;

    const [existing] = await pool.query('SELECT * FROM `MenuItem` WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    const current = existing[0];
    let newQty = available_quantity !== undefined ? Math.max(0, parseInt(available_quantity, 10)) : current.available_quantity;
    let newLimit = daily_stock_limit !== undefined ? Math.max(0, parseInt(daily_stock_limit, 10)) : current.daily_stock_limit;
    let newAvail = is_available !== undefined ? (is_available ? 1 : 0) : current.is_available;

    if (newQty <= 0) {
      newQty = 0;
      newAvail = 0;
    } else if (is_available === undefined && newQty > 0) {
      newAvail = 1;
    }

    await pool.query(
      `UPDATE \`MenuItem\` 
       SET available_quantity = ?, daily_stock_limit = ?, is_available = ?
       WHERE id = ?`,
      [newQty, newLimit, newAvail, id]
    );

    const [updated] = await pool.query('SELECT * FROM `MenuItem` WHERE id = ? LIMIT 1', [id]);
    const item = updated[0];

    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:stock_updated', {
        id: item.id,
        name: item.name,
        available_quantity: Number(item.available_quantity),
        is_available: Boolean(item.is_available),
      });
      io.emit('menu_item:updated', item);
    }

    return res.status(200).json({
      success: true,
      message: `Stock updated for ${item.name}.`,
      item: {
        ...item,
        is_available: Boolean(item.is_available),
        available_quantity: Number(item.available_quantity),
        daily_stock_limit: Number(item.daily_stock_limit),
      },
    });
  } catch (error) {
    console.error('Error updating menu item stock:', error);
    return res.status(500).json({ success: false, message: 'Failed to update menu stock.' });
  }
};

// 11. Batch Update Menu Item Stocks
const batchUpdateMenuStock = async (req, res) => {
  try {
    const list = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body.updates) ? req.body.updates : []);
    if (list.length === 0) {
      return res.status(400).json({ success: false, message: 'Items or updates array is required.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const u of list) {
        if (!u.id) continue;
        const qty = u.available_quantity !== undefined ? Math.max(0, parseInt(u.available_quantity, 10)) : undefined;
        const limit = u.daily_stock_limit !== undefined ? Math.max(0, parseInt(u.daily_stock_limit, 10)) : undefined;
        const avail = qty !== undefined && qty <= 0 ? 0 : (u.is_available !== undefined ? (u.is_available ? 1 : 0) : 1);

        if (qty !== undefined && limit !== undefined) {
          await connection.query(
            'UPDATE `MenuItem` SET available_quantity = ?, daily_stock_limit = ?, is_available = ? WHERE id = ?',
            [qty, limit, avail, u.id]
          );
        } else if (qty !== undefined) {
          await connection.query(
            'UPDATE `MenuItem` SET available_quantity = ?, is_available = ? WHERE id = ?',
            [qty, avail, u.id]
          );
        }
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const io = req.app.get('socketio');
    if (io) {
      io.emit('menu:stock_updated', { batch: true });
    }

    return res.status(200).json({ success: true, message: 'Batch menu stock updated successfully.' });
  } catch (error) {
    console.error('Error in batch update menu stock:', error);
    return res.status(500).json({ success: false, message: 'Failed to batch update menu stock.' });
  }
};

module.exports = {
  createInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  getInventoryItemLogs,
  getInventoryDashboardSummary,
  isMenuStockTrackingEnabled,
  getMenuStock,
  toggleMenuStockTracking,
  updateMenuItemStock,
  batchUpdateMenuStock,
};
