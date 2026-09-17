const { pool } = require('../database/db');

/**
 * Generate daily sequential token number formatted as T-001, T-002, etc.
 * Unified across all meal types using MySQL atomic transaction — fully
 * race-condition-safe under concurrent requests.
 *
 * Supports passing an existing active MySQL connection to avoid duplicate connection pool
 * checkout and nested transactions during payment processing bursts.
 *
 * @param {string} mealType - 'breakfast' | 'lunch' | 'dinner' | 'snacks'
 * @param {string} dateString - YYYY-MM-DD
 * @param {object} [existingConnection] - Optional active MySQL connection
 * @returns {Promise<{ tokenNumber: string, sequenceNumber: number }>}
 */
const generateTokenNumber = async (mealType, dateString, existingConnection = null) => {
  const counterKey = 'all'; // Unified daily sequence for all meal types

  const connection = existingConnection || (await pool.getConnection());
  const shouldManageTransaction = !existingConnection;

  try {
    if (shouldManageTransaction) {
      await connection.beginTransaction();
    }

    // Atomic increment: insert if not exists, else increment. Fully safe under concurrency.
    await connection.execute(
      `INSERT INTO DailyTokenCounter (meal_type, date, last_token_number)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE last_token_number = last_token_number + 1`,
      [counterKey, dateString]
    );

    const [rows] = await connection.execute(
      `SELECT last_token_number FROM DailyTokenCounter 
       WHERE meal_type = ? AND date = ? LIMIT 1`,
      [counterKey, dateString]
    );

    if (shouldManageTransaction) {
      await connection.commit();
    }

    const nextSeq = rows[0].last_token_number;
    const tokenNumber = `T-${String(nextSeq).padStart(3, '0')}`;

    return {
      tokenNumber,
      sequenceNumber: nextSeq,
    };
  } catch (error) {
    if (shouldManageTransaction) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (shouldManageTransaction) {
      connection.release();
    }
  }
};

module.exports = {
  generateTokenNumber,
};
