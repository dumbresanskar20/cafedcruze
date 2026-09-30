const { pool } = require('../database/db');
const { formatPublicImageUrl } = require('../config/storage');

let reviewSchemaEnsured = false;

/**
 * Ensures MenuItemReview table exists with proper columns and no restrictive foreign keys
 */
const ensureReviewSchema = async () => {
  if (reviewSchemaEnsured) return;
  try {
    // 1. Create MenuItemReview table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`MenuItemReview\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`order_id\` INT NOT NULL,
        \`student_id\` INT NOT NULL,
        \`menu_item_id\` INT NULL,
        \`menu_item_name\` VARCHAR(255) NOT NULL DEFAULT '',
        \`meal_type\` VARCHAR(50) NOT NULL DEFAULT 'lunch',
        \`rating\` TINYINT NOT NULL DEFAULT 5,
        \`review_text\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_review_order\` (\`order_id\`),
        INDEX \`idx_review_student\` (\`student_id\`),
        INDEX \`idx_review_menu_item\` (\`menu_item_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Make menu_item_id nullable so non-catalog/custom items never fail
    await pool.query('ALTER TABLE `MenuItemReview` MODIFY COLUMN `menu_item_id` INT NULL').catch(() => {});

    // 3. Drop any foreign key constraints on menu_item_id that cause insert failures
    try {
      const [fkRows] = await pool.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'MenuItemReview' 
          AND COLUMN_NAME = 'menu_item_id' 
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      for (const fk of fkRows) {
        if (fk.CONSTRAINT_NAME) {
          await pool.query(`ALTER TABLE \`MenuItemReview\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``).catch(() => {});
        }
      }
    } catch (e) {
      // Ignored
    }

    // 4. Ensure all expected columns exist
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MenuItemReview'
    `);
    const colNames = new Set(cols.map((c) => c.COLUMN_NAME.toLowerCase()));

    if (!colNames.has('menu_item_name')) {
      await pool.query('ALTER TABLE `MenuItemReview` ADD COLUMN `menu_item_name` VARCHAR(255) NOT NULL DEFAULT ""').catch(() => {});
    }
    if (!colNames.has('meal_type')) {
      await pool.query('ALTER TABLE `MenuItemReview` ADD COLUMN `meal_type` VARCHAR(50) NOT NULL DEFAULT "lunch"').catch(() => {});
    }
    if (!colNames.has('rating')) {
      await pool.query('ALTER TABLE `MenuItemReview` ADD COLUMN `rating` TINYINT NOT NULL DEFAULT 5').catch(() => {});
    }
    if (!colNames.has('review_text')) {
      await pool.query('ALTER TABLE `MenuItemReview` ADD COLUMN `review_text` TEXT NULL').catch(() => {});
    }
    if (!colNames.has('order_id')) {
      await pool.query('ALTER TABLE `MenuItemReview` ADD COLUMN `order_id` INT NOT NULL').catch(() => {});
    }
    if (!colNames.has('student_id')) {
      await pool.query('ALTER TABLE `MenuItemReview` ADD COLUMN `student_id` INT NOT NULL').catch(() => {});
    }

    reviewSchemaEnsured = true;
    console.log('✅ [ReviewController] MenuItemReview schema ensured.');
  } catch (err) {
    console.warn('[ReviewController] ensureReviewSchema notice:', err.message);
  }
};

/**
 * Submit or update ratings & reviews for a delivered order (Student)
 * POST /api/reviews/rate-order
 */
const submitOrderRating = async (req, res) => {
  try {
    await ensureReviewSchema();

    const studentId = req.student?.id || req.studentId || req.user?.id || req.user?._id;
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please login again.' });
    }

    const { order_id, ratings } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one item rating.' });
    }

    // Verify order ownership
    const [orderRows] = await pool.execute(
      'SELECT id, student_id, meal_type, order_status FROM `Order` WHERE id = ? AND student_id = ? LIMIT 1',
      [order_id, studentId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    const order = orderRows[0];

    // Check if reviews already exist for this order — editing is disallowed once submitted
    const [existingReviews] = await pool.execute(
      'SELECT id FROM MenuItemReview WHERE order_id = ? AND student_id = ? LIMIT 1',
      [order_id, studentId]
    );

    if (existingReviews.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review and rating for this meal order. Reviews cannot be edited.',
      });
    }

    // Fetch order items to validate item names and IDs
    let orderItemRows = [];
    try {
      const [oRows] = await pool.execute(
        'SELECT id, menu_item_id, item_name FROM OrderItem WHERE order_id = ?',
        [order_id]
      );
      orderItemRows = oRows;
    } catch (e) {
      // If OrderItem query fails, proceed with payload items
    }

    const savedReviews = [];

    for (const r of ratings) {
      const starRating = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 5));
      const reviewText = r.review_text && typeof r.review_text === 'string' ? r.review_text.trim().slice(0, 1000) : null;
      const rawItemName = (r.item_name || '').trim();
      const rawId = Number(r.menu_item_id) || 0;

      // Robust MenuItem resolution:
      let targetMenuItem = null;

      // 1. Try by provided ID in MenuItem table
      if (rawId > 0) {
        try {
          const [mRows] = await pool.execute('SELECT id, name, meal_type FROM MenuItem WHERE id = ? LIMIT 1', [rawId]);
          if (mRows.length > 0) targetMenuItem = mRows[0];
        } catch (e) {}
      }

      // 2. Try by item name in MenuItem table
      if (!targetMenuItem && rawItemName) {
        try {
          const [mRows] = await pool.execute('SELECT id, name, meal_type FROM MenuItem WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [rawItemName]);
          if (mRows.length > 0) targetMenuItem = mRows[0];
        } catch (e) {}
      }

      // 3. Try matching through OrderItem table
      if (!targetMenuItem) {
        const matchedOrderItem = orderItemRows.find(
          (oi) => (oi.id === rawId || oi.menu_item_id === rawId || (rawItemName && oi.item_name && oi.item_name.toLowerCase() === rawItemName.toLowerCase()))
        );
        if (matchedOrderItem && matchedOrderItem.menu_item_id) {
          try {
            const [mRows] = await pool.execute('SELECT id, name, meal_type FROM MenuItem WHERE id = ? LIMIT 1', [matchedOrderItem.menu_item_id]);
            if (mRows.length > 0) targetMenuItem = mRows[0];
          } catch (e) {}
        }
      }

      // If targetMenuItem was found, use its id; otherwise check if rawId exists; else null (never hardcode 1)
      let finalMenuItemId = null;
      if (targetMenuItem) {
        finalMenuItemId = targetMenuItem.id;
      } else if (rawId > 0) {
        try {
          const [chk] = await pool.execute('SELECT id FROM MenuItem WHERE id = ? LIMIT 1', [rawId]);
          if (chk.length > 0) finalMenuItemId = chk[0].id;
        } catch (e) {}
      }

      const finalItemName = targetMenuItem ? targetMenuItem.name : (rawItemName || 'Meal Item');
      const finalMealType = targetMenuItem ? targetMenuItem.meal_type : (order.meal_type || 'breakfast');

      // Check if review for this order and item name or id already exists
      const [existingItemReview] = await pool.execute(
        'SELECT id FROM MenuItemReview WHERE order_id = ? AND (menu_item_name = ? OR (menu_item_id IS NOT NULL AND menu_item_id = ?)) LIMIT 1',
        [order_id, finalItemName, finalMenuItemId || 0]
      );

      if (existingItemReview.length > 0) {
        await pool.execute(
          `UPDATE MenuItemReview 
           SET rating = ?, review_text = ?, menu_item_id = ?, meal_type = ?, updated_at = NOW() 
           WHERE id = ?`,
          [starRating, reviewText, finalMenuItemId, finalMealType, existingItemReview[0].id]
        );
      } else {
        await pool.execute(
          `INSERT INTO MenuItemReview 
            (order_id, student_id, menu_item_id, menu_item_name, meal_type, rating, review_text)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [order_id, studentId, finalMenuItemId, finalItemName, finalMealType, starRating, reviewText]
        );
      }

      savedReviews.push({
        menu_item_id: finalMenuItemId,
        item_name: finalItemName,
        rating: starRating,
        review_text: reviewText,
      });
    }

    // Emit Socket.IO event for real-time admin sync & live client re-sorting
    const io = req.app?.get('io') || req.app?.get('socketio');
    if (io) {
      const payload = {
        order_id,
        student_id: studentId,
        meal_type: order.meal_type,
        reviews: savedReviews,
      };
      io.to('kitchen').emit('review:new', payload);
      io.emit('menu:rating_updated', payload);
      io.emit('menu:updated', { meal_type: order.meal_type });
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you! Your ratings and review have been submitted.',
      reviews: savedReviews,
    });
  } catch (error) {
    console.error('Error submitting order rating:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error saving rating.' });
  }
};

/**
 * Get ratings for a specific order (Student/Admin)
 * GET /api/reviews/order/:order_id
 */
const getOrderRatings = async (req, res) => {
  try {
    await ensureReviewSchema();
    const { order_id } = req.params;
    const studentId = req.student?.id || req.studentId || req.user?.id || req.user?._id;

    let sql = 'SELECT * FROM MenuItemReview WHERE order_id = ?';
    const params = [order_id];

    if (studentId) {
      sql += ' AND student_id = ?';
      params.push(studentId);
    }

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      success: true,
      reviews: rows,
    });
  } catch (error) {
    console.error('Error fetching order ratings:', error);
    return res.status(500).json({ success: false, message: 'Error fetching ratings.' });
  }
};

/**
 * Get meal-wise summary & reviews analytics for Admin Dashboard
 * GET /api/reviews/admin/summary
 */
const getMealWiseReviewsSummary = async (req, res) => {
  try {
    await ensureReviewSchema();
    const { meal_type, search } = req.query;

    // Self-healing query: re-link any mis-matched menu_item_id by exact name match
    await pool.query(`
      UPDATE MenuItemReview r
      JOIN MenuItem m ON LOWER(TRIM(r.menu_item_name)) = LOWER(TRIM(m.name))
      SET r.menu_item_id = m.id
      WHERE r.menu_item_id NOT IN (SELECT id FROM MenuItem)
    `).catch(() => {});

    // 1. Fetch all menu items
    let menuSql = 'SELECT id, name, meal_type, price, image_url, is_active FROM MenuItem WHERE 1=1';
    const menuParams = [];

    if (meal_type && meal_type.toLowerCase() !== 'all') {
      menuSql += ' AND LOWER(meal_type) = ?';
      menuParams.push(meal_type.toLowerCase().trim());
    }

    if (search && search.trim()) {
      menuSql += ' AND LOWER(name) LIKE ?';
      menuParams.push(`%${search.toLowerCase().trim()}%`);
    }

    menuSql += ' ORDER BY meal_type ASC, name ASC';
    const [menuItems] = await pool.execute(menuSql, menuParams);

    // 2. Fetch rating aggregations grouped by menu_item_id
    const [ratingAggs] = await pool.query(`
      SELECT 
        menu_item_id,
        COUNT(*) AS total_reviews,
        ROUND(AVG(rating), 1) AS average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS stars_5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS stars_4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS stars_3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS stars_2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS stars_1
      FROM MenuItemReview
      GROUP BY menu_item_id
    `);

    const ratingMap = {};
    ratingAggs.forEach((row) => {
      ratingMap[row.menu_item_id] = {
        total_reviews: Number(row.total_reviews) || 0,
        average_rating: Number(row.average_rating) || 0,
        stars_5: Number(row.stars_5) || 0,
        stars_4: Number(row.stars_4) || 0,
        stars_3: Number(row.stars_3) || 0,
        stars_2: Number(row.stars_2) || 0,
        stars_1: Number(row.stars_1) || 0,
      };
    });

    // Combine menu items with rating stats and properly formatted absolute image URLs
    const mealSummary = menuItems.map((item) => {
      const stats = ratingMap[item.id] || {
        total_reviews: 0,
        average_rating: 0,
        stars_5: 0,
        stars_4: 0,
        stars_3: 0,
        stars_2: 0,
        stars_1: 0,
      };
      return {
        id: item.id,
        _id: item.id,
        name: item.name,
        meal_type: item.meal_type,
        price: Number(item.price),
        image_url: formatPublicImageUrl(item.image_url, req),
        is_active: Boolean(item.is_active),
        ...stats,
      };
    });

    // 3. Overall Canteen Rating Totals
    const [overallStatsRow] = await pool.query(`
      SELECT 
        COUNT(*) AS total_reviews,
        ROUND(AVG(rating), 1) AS overall_average,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS total_5_stars,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS total_4_stars,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS total_3_stars,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS total_2_stars,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS total_1_stars
      FROM MenuItemReview
    `);

    const overall = overallStatsRow[0] || {};
    const totalRevCount = Number(overall.total_reviews) || 0;
    const overallAvg = Number(overall.overall_average) || 0;
    const fiveStarPct = totalRevCount > 0 ? Math.round(((Number(overall.total_5_stars) || 0) / totalRevCount) * 100) : 0;

    // 4. Fetch recent student reviews with student details
    let recentSql = `
      SELECT r.*, s.name AS student_name, s.roll_no AS student_roll_no, s.email AS student_email, o.token_number
      FROM MenuItemReview r
      LEFT JOIN Student s ON r.student_id = s.id
      LEFT JOIN \`Order\` o ON r.order_id = o.id
      WHERE 1=1
    `;
    const recentParams = [];

    if (meal_type && meal_type.toLowerCase() !== 'all') {
      recentSql += ' AND LOWER(r.meal_type) = ?';
      recentParams.push(meal_type.toLowerCase().trim());
    }

    if (search && search.trim()) {
      recentSql += ' AND (LOWER(r.menu_item_name) LIKE ? OR LOWER(r.review_text) LIKE ?)';
      recentParams.push(`%${search.toLowerCase().trim()}%`, `%${search.toLowerCase().trim()}%`);
    }

    recentSql += ' ORDER BY r.created_at DESC LIMIT 100';
    const [recentReviews] = await pool.execute(recentSql, recentParams);

    return res.status(200).json({
      success: true,
      overall_stats: {
        total_reviews: totalRevCount,
        overall_average: overallAvg,
        five_star_percentage: fiveStarPct,
        breakdown: {
          5: Number(overall.total_5_stars) || 0,
          4: Number(overall.total_4_stars) || 0,
          3: Number(overall.total_3_stars) || 0,
          2: Number(overall.total_2_stars) || 0,
          1: Number(overall.total_1_stars) || 0,
        },
      },
      meal_summary: mealSummary,
      recent_reviews: recentReviews,
    });
  } catch (error) {
    console.error('Error fetching meal-wise reviews summary:', error);
    return res.status(500).json({ success: false, message: 'Error generating reviews summary.' });
  }
};

/**
 * Public endpoint to get average ratings map for all menu items
 * GET /api/reviews/menu-ratings
 */
const getPublicMenuRatings = async (req, res) => {
  try {
    await ensureReviewSchema();
    const [rows] = await pool.query(`
      SELECT 
        menu_item_id,
        COUNT(*) AS rating_count,
        ROUND(AVG(rating), 1) AS avg_rating
      FROM MenuItemReview
      GROUP BY menu_item_id
    `);

    const map = {};
    rows.forEach((r) => {
      map[r.menu_item_id] = {
        avg_rating: Number(r.avg_rating) || 0,
        rating_count: Number(r.rating_count) || 0,
      };
    });

    return res.status(200).json({
      success: true,
      ratings: map,
    });
  } catch (error) {
    console.error('Error fetching public menu ratings:', error);
    return res.status(500).json({ success: false, message: 'Error fetching ratings.' });
  }
};

module.exports = {
  submitOrderRating,
  getOrderRatings,
  getMealWiseReviewsSummary,
  getPublicMenuRatings,
  ensureReviewSchema,
};
