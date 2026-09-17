const cron = require('node-cron');
const { pool } = require('../database/db');

/**
 * Auto-expire uncollected token orders from previous days.
 * If an order was placed/preparing/ready on a date before TODAY and was never
 * collected/delivered at the canteen counter, its status transitions to 'expired'.
 *
 * @returns {Promise<number>} Number of orders updated to expired
 */
const autoExpireUncollectedOrders = async () => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const [result] = await pool.execute(
      `UPDATE \`Order\` 
       SET order_status = 'expired' 
       WHERE date < ? 
         AND order_status IN ('placed', 'preparing', 'ready')`,
      [todayStr]
    );

    const count = result.affectedRows || 0;
    if (count > 0) {
      console.log(`⏰ [Auto-Expire] Automatically expired ${count} uncollected order(s) from previous days (before ${todayStr}).`);
    }
    return count;
  } catch (error) {
    console.error('❌ [Auto-Expire Error]:', error.message);
    return 0;
  }
};

/**
 * Permanently delete orders older than the specified retention window.
 * DISABLED: Orders are NEVER automatically deleted from the database.
 * All orders persist permanently for audit and lifetime canteen reporting.
 *
 * @returns {Promise<{ deletedCount: number, message: string }>}
 */
const cleanupOldOrders = async () => {
  console.log('ℹ️ [Order Cleanup Job] Automated order deletion is disabled. All orders persist permanently in the database.');
  return { deletedCount: 0, message: 'Automated deletion disabled; orders persist permanently.' };
};

/**
 * Initialize daily scheduled cron job.
 * Automatically transitions uncollected token orders from previous days to 'expired'.
 * Automated order deletion is permanently disabled.
 */
const initOrderCleanupJob = () => {
  const schedulePattern = process.env.ORDER_CLEANUP_CRON || '1 0 * * *';

  cron.schedule(schedulePattern, async () => {
    console.log('[Order Jobs] Scheduled daily trigger started...');
    await autoExpireUncollectedOrders();
  });

  // Also run auto-expiry check on hourly interval to catch day turnovers immediately
  cron.schedule('0 * * * *', async () => {
    await autoExpireUncollectedOrders();
  });

  console.log(`[Order Cleanup Job] Scheduled jobs active with pattern '${schedulePattern}' and hourly auto-expiry checks (automated deletion disabled).`);
};

module.exports = {
  autoExpireUncollectedOrders,
  cleanupOldOrders,
  initOrderCleanupJob,
};
