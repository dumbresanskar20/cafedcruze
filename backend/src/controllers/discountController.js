const { pool } = require('../database/db');
const {
  getFreshDiscountSettings,
  normalizeTimeHHMM,
  DEFAULT_DISCOUNT_SETTINGS,
} = require('../services/discountService');

/**
 * Helper to validate percentage (0 - 100)
 */
const validatePercentage = (val, name) => {
  const num = Number(val);
  if (isNaN(num) || num < 0 || num > 100) {
    throw new Error(`${name} must be a valid percentage between 0 and 100.`);
  }
  return Math.round(num * 100) / 100;
};

/**
 * Helper to validate days (positive integer 1 - 365)
 */
const validateDays = (val, name) => {
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 1 || num > 365) {
    throw new Error(`${name} must be a positive integer between 1 and 365 days.`);
  }
  return num;
};

/**
 * Helper to validate time (24-hour HH:mm format)
 */
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const validateTime = (val, name) => {
  if (!val || typeof val !== 'string' || !timeRegex.test(val.trim())) {
    throw new Error(`${name} must be a valid 24-hour time in HH:mm format (e.g. '09:00').`);
  }
  return normalizeTimeHHMM(val.trim());
};

/**
 * GET /api/admin/discount-settings
 * Returns the current DiscountSettings row, all dynamic MealDiscountRules,
 * last updated admin info, and recent audit logs.
 * Accessible to: super_admin, admin, staff.
 */
const getDiscountSettings = async (req, res) => {
  try {
    const settings = await getFreshDiscountSettings();

    // Fetch details of the admin who last updated settings
    let updatedByAdmin = null;
    if (settings.updated_by) {
      const [adminRows] = await pool.query(
        'SELECT id, username, email, role FROM `AdminUser` WHERE id = ? LIMIT 1',
        [settings.updated_by]
      );
      if (adminRows.length > 0) {
        updatedByAdmin = adminRows[0];
      }
    }

    // Fetch recent audit logs (up to 10)
    let auditLogs = [];
    try {
      const [logRows] = await pool.query(`
        SELECT dal.*, au.username AS admin_username, au.role AS admin_role
        FROM \`DiscountAuditLog\` dal
        LEFT JOIN \`AdminUser\` au ON dal.admin_user_id = au.id
        ORDER BY dal.created_at DESC
        LIMIT 10
      `);
      auditLogs = logRows.map((log) => {
        let changedFields = [];
        let prevVals = {};
        let newVals = {};
        try {
          changedFields = JSON.parse(log.changed_fields || '[]');
        } catch {
          changedFields = [log.changed_fields];
        }
        try {
          prevVals = JSON.parse(log.previous_values || '{}');
        } catch {}
        try {
          newVals = JSON.parse(log.new_values || '{}');
        } catch {}
        return {
          id: log.id,
          admin_user_id: log.admin_user_id,
          admin_username: log.admin_username || 'Unknown Admin',
          admin_role: log.admin_role || 'super_admin',
          action: log.action,
          changed_fields: changedFields,
          previous_values: prevVals,
          new_values: newVals,
          created_at: log.created_at,
        };
      });
    } catch (logErr) {
      console.warn('[discountController] Failed to query audit logs:', logErr.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...settings,
        updated_by_admin: updatedByAdmin,
      },
      audit_logs: auditLogs,
    });
  } catch (error) {
    console.error('[discountController] getDiscountSettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve discount settings: ' + error.message,
    });
  }
};

/**
 * PUT /api/admin/discount-settings
 * Updates the DiscountSettings record and dynamic MealDiscountRules.
 * Accessible to: super_admin and admin.
 */
const updateDiscountSettings = async (req, res) => {
  try {
    const {
      new_user_discount_enabled,
      new_user_discount_percentage,
      new_user_discount_days,
      breakfast_early_discount_enabled,
      breakfast_early_discount_percentage,
      breakfast_early_discount_cutoff_time,
      lunch_early_discount_enabled,
      lunch_early_discount_percentage,
      lunch_early_discount_cutoff_time,
      snacks_early_discount_enabled,
      snacks_early_discount_percentage,
      snacks_early_discount_cutoff_time,
      dinner_early_discount_enabled,
      dinner_early_discount_percentage,
      dinner_early_discount_cutoff_time,
      meal_rules = [],
    } = req.body;

    const cleanNewUserEnabled = Boolean(new_user_discount_enabled);
    const cleanNewUserPercentage = validatePercentage(new_user_discount_percentage != null ? new_user_discount_percentage : 10, 'New user discount percentage');
    const cleanNewUserDays = validateDays(new_user_discount_days || 5, 'New user discount days');

    const cleanBreakfastEnabled = Boolean(breakfast_early_discount_enabled);
    const cleanBreakfastPercentage = validatePercentage(breakfast_early_discount_percentage != null ? breakfast_early_discount_percentage : 10, 'Breakfast early discount percentage');
    const cleanBreakfastCutoff = validateTime(breakfast_early_discount_cutoff_time || '09:00', 'Breakfast cutoff time');

    const cleanLunchEnabled = Boolean(lunch_early_discount_enabled);
    const cleanLunchPercentage = validatePercentage(lunch_early_discount_percentage != null ? lunch_early_discount_percentage : 10, 'Lunch early discount percentage');
    const cleanLunchCutoff = validateTime(lunch_early_discount_cutoff_time || '12:00', 'Lunch cutoff time');

    const cleanSnacksEnabled = Boolean(snacks_early_discount_enabled);
    const cleanSnacksPercentage = validatePercentage(snacks_early_discount_percentage != null ? snacks_early_discount_percentage : 10, 'Snacks early discount percentage');
    const cleanSnacksCutoff = validateTime(snacks_early_discount_cutoff_time || '17:00', 'Snacks cutoff time');

    const cleanDinnerEnabled = Boolean(dinner_early_discount_enabled);
    const cleanDinnerPercentage = validatePercentage(dinner_early_discount_percentage != null ? dinner_early_discount_percentage : 10, 'Dinner early discount percentage');
    const cleanDinnerCutoff = validateTime(dinner_early_discount_cutoff_time || '20:30', 'Dinner cutoff time');

    // 2. Fetch current settings to compute changes
    const prevSettings = await getFreshDiscountSettings();

    const newSettings = {
      new_user_discount_enabled: cleanNewUserEnabled,
      new_user_discount_percentage: cleanNewUserPercentage,
      new_user_discount_days: cleanNewUserDays,
      breakfast_early_discount_enabled: cleanBreakfastEnabled,
      breakfast_early_discount_percentage: cleanBreakfastPercentage,
      breakfast_early_discount_cutoff_time: cleanBreakfastCutoff,
      lunch_early_discount_enabled: cleanLunchEnabled,
      lunch_early_discount_percentage: cleanLunchPercentage,
      lunch_early_discount_cutoff_time: cleanLunchCutoff,
      snacks_early_discount_enabled: cleanSnacksEnabled,
      snacks_early_discount_percentage: cleanSnacksPercentage,
      snacks_early_discount_cutoff_time: cleanSnacksCutoff,
      dinner_early_discount_enabled: cleanDinnerEnabled,
      dinner_early_discount_percentage: cleanDinnerPercentage,
      dinner_early_discount_cutoff_time: cleanDinnerCutoff,
    };

    const changedFields = [];
    for (const key of Object.keys(newSettings)) {
      if (prevSettings[key] !== newSettings[key]) {
        changedFields.push(key);
      }
    }

    const adminId = req.admin ? req.admin.id : null;

    // 3. Update DiscountSettings row (id = 1)
    await pool.query(
      `UPDATE \`DiscountSettings\`
       SET new_user_discount_enabled = ?,
           new_user_discount_percentage = ?,
           new_user_discount_days = ?,
           breakfast_early_discount_enabled = ?,
           breakfast_early_discount_percentage = ?,
           breakfast_early_discount_cutoff_time = ?,
           lunch_early_discount_enabled = ?,
           lunch_early_discount_percentage = ?,
           lunch_early_discount_cutoff_time = ?,
           snacks_early_discount_enabled = ?,
           snacks_early_discount_percentage = ?,
           snacks_early_discount_cutoff_time = ?,
           dinner_early_discount_enabled = ?,
           dinner_early_discount_percentage = ?,
           dinner_early_discount_cutoff_time = ?,
           updated_by = ?,
           updated_at = NOW()
       WHERE id = 1`,
      [
        cleanNewUserEnabled ? 1 : 0,
        cleanNewUserPercentage,
        cleanNewUserDays,
        cleanBreakfastEnabled ? 1 : 0,
        cleanBreakfastPercentage,
        cleanBreakfastCutoff,
        cleanLunchEnabled ? 1 : 0,
        cleanLunchPercentage,
        cleanLunchCutoff,
        cleanSnacksEnabled ? 1 : 0,
        cleanSnacksPercentage,
        cleanSnacksCutoff,
        cleanDinnerEnabled ? 1 : 0,
        cleanDinnerPercentage,
        cleanDinnerCutoff,
        adminId,
      ]
    );

    // 4. Update MealDiscountRule table for all provided meal_rules
    if (Array.isArray(meal_rules) && meal_rules.length > 0) {
      for (const rule of meal_rules) {
        const type = (rule.meal_type || '').toLowerCase().trim();
        if (!type) continue;
        const pct = validatePercentage(rule.discount_percentage != null ? rule.discount_percentage : 0, `${type} discount percentage`);
        const cutoff = validateTime(rule.cutoff_time || '12:00', `${type} cutoff time`);
        const enabled = Boolean(rule.is_enabled);
        const name = rule.display_name || `Early ${type.charAt(0).toUpperCase() + type.slice(1)} Discount`;

        await pool.execute(
          `INSERT INTO \`MealDiscountRule\` (meal_type, display_name, discount_percentage, cutoff_time, is_enabled)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             display_name = VALUES(display_name),
             discount_percentage = VALUES(discount_percentage),
             cutoff_time = VALUES(cutoff_time),
             is_enabled = VALUES(is_enabled)`,
          [type, name, pct, cutoff, enabled ? 1 : 0]
        );
      }
    } else {
      // Synchronize core 4 meal types into MealDiscountRule if no custom array passed
      const coreRules = [
        ['breakfast', 'Early Breakfast Discount', cleanBreakfastPercentage, cleanBreakfastCutoff, cleanBreakfastEnabled ? 1 : 0],
        ['lunch',     'Early Lunch Discount',     cleanLunchPercentage,     cleanLunchCutoff,     cleanLunchEnabled ? 1 : 0],
        ['snacks',    'Early Snacks Discount',    cleanSnacksPercentage,    cleanSnacksCutoff,    cleanSnacksEnabled ? 1 : 0],
        ['dinner',    'Early Dinner Discount',    cleanDinnerPercentage,    cleanDinnerCutoff,    cleanDinnerEnabled ? 1 : 0],
      ];
      for (const [type, name, pct, cutoff, enabled] of coreRules) {
        await pool.execute(
          `INSERT INTO \`MealDiscountRule\` (meal_type, display_name, discount_percentage, cutoff_time, is_enabled)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             display_name = VALUES(display_name),
             discount_percentage = VALUES(discount_percentage),
             cutoff_time = VALUES(cutoff_time),
             is_enabled = VALUES(is_enabled)`,
          [type, name, pct, cutoff, enabled]
        );
      }
    }

    // 5. Record entry in DiscountAuditLog
    if (changedFields.length > 0 || (meal_rules && meal_rules.length > 0)) {
      try {
        await pool.query(
          `INSERT INTO \`DiscountAuditLog\` (admin_user_id, action, changed_fields, previous_values, new_values)
           VALUES (?, 'update_discount_settings', ?, ?, ?)`,
          [
            adminId,
            JSON.stringify(changedFields.length > 0 ? changedFields : ['dynamic_meal_rules']),
            JSON.stringify(prevSettings),
            JSON.stringify(newSettings),
          ]
        );
      } catch (logErr) {
        console.warn('[discountController] Failed to record audit log:', logErr.message);
      }
    }

    // 6. Broadcast real-time update to connected clients
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('discount_settings:updated', {
          ...newSettings,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (socketErr) {
      console.warn('[discountController] Socket emit warning:', socketErr.message);
    }

    const updatedData = await getFreshDiscountSettings();

    return res.status(200).json({
      success: true,
      message: 'Discount settings and dynamic meal rules updated successfully.',
      data: updatedData,
      changed_fields: changedFields,
    });
  } catch (error) {
    console.error('[discountController] updateDiscountSettings error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update discount settings.',
    });
  }
};

/**
 * POST /api/admin/discount-settings/rules
 * Dynamically creates or updates a discount rule for any meal type.
 * If the meal type is not in MealWindow, registers it in MealWindow as well!
 * Accessible to: super_admin and admin.
 */
const createOrUpdateMealDiscountRule = async (req, res) => {
  try {
    const { meal_type, display_name, discount_percentage, cutoff_time, is_enabled = true } = req.body;

    if (!meal_type || typeof meal_type !== 'string' || !meal_type.trim()) {
      return res.status(400).json({ success: false, message: 'Meal type is required.' });
    }

    const cleanMealType = meal_type.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
    const cleanPercentage = validatePercentage(discount_percentage != null ? discount_percentage : 0, 'Discount percentage');
    const cleanCutoff = validateTime(cutoff_time || '12:00', 'Cutoff time');
    const cleanEnabled = is_enabled !== false && is_enabled !== 0 && is_enabled !== 'false';
    const cleanName = display_name?.trim() || `Early ${cleanMealType.charAt(0).toUpperCase() + cleanMealType.slice(1)} Discount`;

    // 1. Ensure MealWindow exists for this meal_type so menus can use it
    await pool.execute(
      `INSERT INTO \`MealWindow\` (meal_type, start_time, end_time, is_active, is_full_day)
       VALUES (?, '08:00', '20:00', 1, 0)
       ON DUPLICATE KEY UPDATE id = id`,
      [cleanMealType]
    );

    // 2. Insert or update in MealDiscountRule
    await pool.execute(
      `INSERT INTO \`MealDiscountRule\` (meal_type, display_name, discount_percentage, cutoff_time, is_enabled)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         display_name = VALUES(display_name),
         discount_percentage = VALUES(discount_percentage),
         cutoff_time = VALUES(cutoff_time),
         is_enabled = VALUES(is_enabled)`,
      [cleanMealType, cleanName, cleanPercentage, cleanCutoff, cleanEnabled ? 1 : 0]
    );

    // 3. Keep DiscountSettings column in sync if it's one of core meals
    if (['breakfast', 'lunch', 'snacks', 'dinner'].includes(cleanMealType)) {
      await pool.execute(
        `UPDATE \`DiscountSettings\`
         SET \`${cleanMealType}_early_discount_enabled\` = ?,
             \`${cleanMealType}_early_discount_percentage\` = ?,
             \`${cleanMealType}_early_discount_cutoff_time\` = ?
         WHERE id = 1`,
        [cleanEnabled ? 1 : 0, cleanPercentage, cleanCutoff]
      );
    }

    // 4. Audit Log
    const adminId = req.admin ? req.admin.id : null;
    try {
      await pool.query(
        `INSERT INTO \`DiscountAuditLog\` (admin_user_id, action, changed_fields, previous_values, new_values)
         VALUES (?, 'create_or_update_meal_rule', ?, ?, ?)`,
        [
          adminId,
          JSON.stringify([cleanMealType]),
          JSON.stringify({}),
          JSON.stringify({ meal_type: cleanMealType, cleanPercentage, cleanCutoff, cleanEnabled }),
        ]
      );
    } catch (e) {
      console.warn('[discountController] Audit log error:', e.message);
    }

    // 5. Socket broadcast
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('discount_settings:updated', { meal_type: cleanMealType });
      }
    } catch (e) {}

    const freshSettings = await getFreshDiscountSettings();

    return res.status(200).json({
      success: true,
      message: `Discount rule for '${cleanMealType}' saved successfully.`,
      rule: {
        meal_type: cleanMealType,
        display_name: cleanName,
        discount_percentage: cleanPercentage,
        cutoff_time: cleanCutoff,
        is_enabled: cleanEnabled,
      },
      data: freshSettings,
    });
  } catch (error) {
    console.error('[discountController] createOrUpdateMealDiscountRule error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to save discount rule.',
    });
  }
};

/**
 * DELETE /api/admin/discount-settings/rules/:meal_type
 * Deletes a custom meal discount rule.
 * Standard meal types ('breakfast', 'lunch', 'snacks', 'dinner') cannot be deleted.
 * Accessible to: super_admin and admin.
 */
const deleteMealDiscountRule = async (req, res) => {
  try {
    const { meal_type } = req.params;
    const cleanType = (meal_type || '').toLowerCase().trim();

    const protectedTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    if (protectedTypes.includes(cleanType)) {
      return res.status(400).json({
        success: false,
        message: `Standard meal category '${cleanType}' cannot be deleted. You can disable it instead.`,
      });
    }

    await pool.execute('DELETE FROM `MealDiscountRule` WHERE meal_type = ?', [cleanType]);

    // Audit Log
    const adminId = req.admin ? req.admin.id : null;
    try {
      await pool.query(
        `INSERT INTO \`DiscountAuditLog\` (admin_user_id, action, changed_fields, previous_values, new_values)
         VALUES (?, 'delete_meal_rule', ?, ?, ?)`,
        [adminId, JSON.stringify([cleanType]), JSON.stringify({ meal_type: cleanType }), JSON.stringify({})]
      );
    } catch (e) {}

    // Socket broadcast
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('discount_settings:updated', { deleted_meal_type: cleanType });
      }
    } catch (e) {}

    const freshSettings = await getFreshDiscountSettings();

    return res.status(200).json({
      success: true,
      message: `Discount rule for '${cleanType}' deleted successfully.`,
      data: freshSettings,
    });
  } catch (error) {
    console.error('[discountController] deleteMealDiscountRule error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete discount rule.',
    });
  }
};

module.exports = {
  getDiscountSettings,
  updateDiscountSettings,
  createOrUpdateMealDiscountRule,
  deleteMealDiscountRule,
};
