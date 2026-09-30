const cron = require('node-cron');
const { pool } = require('../database/db');

/**
 * Proactive daily cron job to check subscription expiration and update DB status.
 */
const checkSubscriptionExpiryJob = async () => {
  const now = new Date();

  try {
    const [result] = await pool.execute(
      'UPDATE `Subscription` SET status = ? WHERE subscription_end_date < ? AND status = ?',
      ['expired', now, 'active']
    );

    const count = result.affectedRows || 0;

    if (count > 0) {
      console.warn(
        `⚠️ [Subscription Cron Job] Flipped ${count} subscription(s) to EXPIRED state on ${now.toISOString()}`
      );
    } else {
      console.log(`✅ [Subscription Cron Job] Checked subscription status on ${now.toISOString()}: active.`);
    }
  } catch (error) {
    console.error(`❌ [Subscription Cron Job Error] Failed to check subscription status: ${error.message}`);
  }
};

/**
 * Initialize daily scheduled cron job (runs every day at 00:05 AM server time)
 */
const initSubscriptionCronJob = () => {
  const schedulePattern = process.env.SUBSCRIPTION_CRON || '5 0 * * *';

  cron.schedule(schedulePattern, async () => {
    console.log('[Subscription Cron Job] Daily automated check started...');
    await checkSubscriptionExpiryJob();
  });

  console.log(`[Subscription Cron Job] Scheduled daily subscription check active with pattern '${schedulePattern}'`);
};

module.exports = {
  checkSubscriptionExpiryJob,
  initSubscriptionCronJob,
};
