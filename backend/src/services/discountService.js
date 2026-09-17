
const { pool } = require('../database/db');

// Default fallback discount settings in case DB is unreachable
const DEFAULT_DISCOUNT_SETTINGS = {
  id: 1,
  new_user_discount_enabled: true,
  new_user_discount_percentage: 10.0,
  new_user_discount_days: 5,
  breakfast_early_discount_enabled: true,
  breakfast_early_discount_percentage: 10.0,
  breakfast_early_discount_cutoff_time: '09:00',
  lunch_early_discount_enabled: true,
  lunch_early_discount_percentage: 10.0,
  lunch_early_discount_cutoff_time: '12:00',
  snacks_early_discount_enabled: true,
  snacks_early_discount_percentage: 10.0,
  snacks_early_discount_cutoff_time: '17:00',
  dinner_early_discount_enabled: true,
  dinner_early_discount_percentage: 10.0,
  dinner_early_discount_cutoff_time: '20:30',
  meal_rules: [
    { meal_type: 'breakfast', display_name: 'Early Breakfast Discount', discount_percentage: 10.0, cutoff_time: '09:00', is_enabled: true },
    { meal_type: 'lunch', display_name: 'Early Lunch Discount', discount_percentage: 10.0, cutoff_time: '12:00', is_enabled: true },
    { meal_type: 'snacks', display_name: 'Early Snacks Discount', discount_percentage: 10.0, cutoff_time: '17:00', is_enabled: true },
    { meal_type: 'dinner', display_name: 'Early Dinner Discount', discount_percentage: 10.0, cutoff_time: '20:30', is_enabled: true },
  ],
  cutoffs: {
    breakfast: '09:00',
    lunch: '12:00',
    snacks: '17:00',
    dinner: '20:30',
  },
};

/**
 * Get current server time formatted as 24-hour HH:mm string.
 * Uses system local time (Indian Standard Time).
 */
const getCurrentServerTimeHHMM = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Normalize cutoff time string (e.g. '09:00:00' -> '09:00')
 */
const normalizeTimeHHMM = (timeStr) => {
  if (!timeStr) return '00:00';
  const parts = String(timeStr).split(':');
  const hh = (parts[0] || '00').padStart(2, '0');
  const mm = (parts[1] || '00').padStart(2, '0');
  return `${hh}:${mm}`;
};

/**
 * Fetches the active DiscountSettings and all dynamic MealDiscountRules fresh from MySQL.
 */
const getFreshDiscountSettings = async () => {
  let baseSettings = { ...DEFAULT_DISCOUNT_SETTINGS };

  try {
    const [rows] = await pool.query('SELECT * FROM `DiscountSettings` WHERE id = 1 LIMIT 1');
    if (rows && rows.length > 0) {
      const row = rows[0];
      baseSettings = {
        ...baseSettings,
        id: row.id,
        new_user_discount_enabled: Boolean(row.new_user_discount_enabled),
        new_user_discount_percentage: Number(row.new_user_discount_percentage),
        new_user_discount_days: parseInt(row.new_user_discount_days, 10) || 5,
        breakfast_early_discount_enabled: Boolean(row.breakfast_early_discount_enabled),
        breakfast_early_discount_percentage: Number(row.breakfast_early_discount_percentage),
        breakfast_early_discount_cutoff_time: normalizeTimeHHMM(row.breakfast_early_discount_cutoff_time || '09:00'),
        lunch_early_discount_enabled: Boolean(row.lunch_early_discount_enabled),
        lunch_early_discount_percentage: Number(row.lunch_early_discount_percentage),
        lunch_early_discount_cutoff_time: normalizeTimeHHMM(row.lunch_early_discount_cutoff_time || '12:00'),
        snacks_early_discount_enabled: Boolean(row.snacks_early_discount_enabled != null ? row.snacks_early_discount_enabled : 1),
        snacks_early_discount_percentage: Number(row.snacks_early_discount_percentage != null ? row.snacks_early_discount_percentage : 10.0),
        snacks_early_discount_cutoff_time: normalizeTimeHHMM(row.snacks_early_discount_cutoff_time || '17:00'),
        dinner_early_discount_enabled: Boolean(row.dinner_early_discount_enabled != null ? row.dinner_early_discount_enabled : 1),
        dinner_early_discount_percentage: Number(row.dinner_early_discount_percentage != null ? row.dinner_early_discount_percentage : 10.0),
        dinner_early_discount_cutoff_time: normalizeTimeHHMM(row.dinner_early_discount_cutoff_time || '20:30'),
        updated_by: row.updated_by,
        updated_at: row.updated_at,
      };
    }
  } catch (error) {
    console.warn('[discountService] Failed to read DiscountSettings from DB, using fallback:', error.message);
  }

  // Fetch dynamic per-meal discount rules from MealDiscountRule
  let mealRules = [];
  const cutoffs = {
    breakfast: baseSettings.breakfast_early_discount_cutoff_time || '09:00',
    lunch: baseSettings.lunch_early_discount_cutoff_time || '12:00',
    snacks: baseSettings.snacks_early_discount_cutoff_time || '17:00',
    dinner: baseSettings.dinner_early_discount_cutoff_time || '20:30',
  };

  try {
    const [rules] = await pool.query('SELECT * FROM `MealDiscountRule` ORDER BY id ASC');
    if (rules && rules.length > 0) {
      mealRules = rules.map((r) => {
        const type = (r.meal_type || '').toLowerCase();
        const cutoff = normalizeTimeHHMM(r.cutoff_time || '12:00');
        cutoffs[type] = cutoff;
        return {
          id: r.id,
          meal_type: type,
          display_name: r.display_name || `Early ${type.charAt(0).toUpperCase() + type.slice(1)} Discount`,
          discount_percentage: Number(r.discount_percentage) || 10.0,
          cutoff_time: cutoff,
          is_enabled: Boolean(r.is_enabled),
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
    }
  } catch (ruleErr) {
    console.warn('[discountService] MealDiscountRule query fallback:', ruleErr.message);
  }

  // If MealDiscountRule table had no rows or failed, build default rules list from baseSettings
  if (mealRules.length === 0) {
    mealRules = [
      {
        meal_type: 'breakfast',
        display_name: 'Early Breakfast Discount',
        discount_percentage: baseSettings.breakfast_early_discount_percentage,
        cutoff_time: baseSettings.breakfast_early_discount_cutoff_time,
        is_enabled: baseSettings.breakfast_early_discount_enabled,
      },
      {
        meal_type: 'lunch',
        display_name: 'Early Lunch Discount',
        discount_percentage: baseSettings.lunch_early_discount_percentage,
        cutoff_time: baseSettings.lunch_early_discount_cutoff_time,
        is_enabled: baseSettings.lunch_early_discount_enabled,
      },
      {
        meal_type: 'snacks',
        display_name: 'Early Snacks Discount',
        discount_percentage: baseSettings.snacks_early_discount_percentage,
        cutoff_time: baseSettings.snacks_early_discount_cutoff_time,
        is_enabled: baseSettings.snacks_early_discount_enabled,
      },
      {
        meal_type: 'dinner',
        display_name: 'Early Dinner Discount',
        discount_percentage: baseSettings.dinner_early_discount_percentage,
        cutoff_time: baseSettings.dinner_early_discount_cutoff_time,
        is_enabled: baseSettings.dinner_early_discount_enabled,
      },
    ];
  }

  return {
    ...baseSettings,
    meal_rules: mealRules,
    cutoffs,
  };
};

/**
 * Determines if a student is within their new-user welcome discount window.
 * Window: current server timestamp - student.created_at <= new_user_discount_days * 24 hours.
 */
const isStudentInNewUserWindow = (studentCreatedAt, windowDays = 5) => {
  if (!studentCreatedAt) return false;
  const createdDate = new Date(studentCreatedAt);
  if (isNaN(createdDate.getTime())) return false;

  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= Number(windowDays);
};

/**
 * Calculates discount at order creation time using dynamic DiscountSettings and MealDiscountRules.
 *
 * Precedence Rule:
 * 1. Check if student is within new-user window and new_user_discount_enabled is TRUE.
 *    -> Applies to ANY meal type at new_user_discount_percentage.
 * 2. If NOT in new-user window, look up matching MealDiscountRule for the ordered mealType.
 *    -> If rule is enabled and serverTime < rule.cutoff_time: apply rule.discount_percentage.
 * 3. Fallback checks for legacy breakfast/lunch/snacks/dinner if rule wasn't found in meal_rules.
 * 4. Otherwise -> 0% discount, discount_type: 'none'.
 *
 * NOTE: Discounts do NOT stack. Only ONE discount ever applies per order.
 */
const calculateOrderDiscount = async ({
  subtotal = 0,
  mealType = '',
  studentCreatedAt = null,
  serverTime = getCurrentServerTimeHHMM(),
  customSettings = null, // Optional parameter for unit testing / mocking
}) => {
  const settings = customSettings || (await getFreshDiscountSettings());
  const normalizedMeal = (mealType || '').toLowerCase().trim();
  const normalizedServerTime = normalizeTimeHHMM(serverTime);

  let discountPercentage = 0;
  let discountType = 'none';

  // 1. Check New-User Welcome Discount
  const isNewUserEligible =
    settings.new_user_discount_enabled &&
    isStudentInNewUserWindow(studentCreatedAt, settings.new_user_discount_days);

  if (isNewUserEligible) {
    // New user discount applies to ANY meal type
    discountPercentage = Math.max(0, Math.min(100, Number(settings.new_user_discount_percentage) || 0));
    discountType = 'new_user';
  } else {
    // 2. Dynamic Rule Evaluation: Look up mealType in dynamic meal_rules
    const matchedRule = (settings.meal_rules || []).find(
      (r) => (r.meal_type || '').toLowerCase() === normalizedMeal
    );

    const rulePct = matchedRule ? (Number(matchedRule.discount_percentage) || 0) : 0;

    if (
      matchedRule &&
      matchedRule.is_enabled &&
      rulePct > 0 &&
      matchedRule.cutoff_time &&
      normalizedServerTime < matchedRule.cutoff_time
    ) {
      discountPercentage = Math.max(0, Math.min(100, rulePct));
      discountType = `early_${normalizedMeal}`;
    } else if (!matchedRule) {
      // 3. Fallback checks for standard categories from DiscountSettings row if not in meal_rules table
      const fieldPrefix = `${normalizedMeal}_early_discount`;
      const isEnabled = Boolean(settings[`${fieldPrefix}_enabled`]);
      const pct = Number(settings[`${fieldPrefix}_percentage`]) || 0;
      const cutoff = settings[`${fieldPrefix}_cutoff_time`];
      if (isEnabled && pct > 0 && cutoff && normalizedServerTime < cutoff) {
        discountPercentage = Math.max(0, Math.min(100, pct));
        discountType = `early_${normalizedMeal}`;
      }
    }
  }

  if (discountPercentage <= 0) {
    discountPercentage = 0;
    discountType = 'none';
  }

  const rawSubtotal = Math.max(0, Math.round((Number(subtotal) || 0) * 100) / 100);
  const discountAmount =
    discountPercentage > 0
      ? Math.round((rawSubtotal * discountPercentage / 100) * 100) / 100
      : 0;
  const totalAmount = Math.max(0, Math.round((rawSubtotal - discountAmount) * 100) / 100);

  return {
    subtotal_amount: rawSubtotal,
    discount_percentage: discountPercentage,
    discount_amount: discountAmount,
    discount_type: discountType,
    total_amount: totalAmount,
    is_discount_applied: discountPercentage > 0,
    server_time: normalizedServerTime,
    settings,
  };
};

module.exports = {
  DEFAULT_DISCOUNT_SETTINGS,
  getCurrentServerTimeHHMM,
  normalizeTimeHHMM,
  getFreshDiscountSettings,
  isStudentInNewUserWindow,
  calculateOrderDiscount,
};
