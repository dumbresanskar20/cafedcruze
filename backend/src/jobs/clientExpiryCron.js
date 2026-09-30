const { pool } = require('../database/db');

/**
 * Checks all active and trial clients for expired periods and updates status to 'expired'.
 * Runs automatically every 30 minutes.
 */
const autoExpireClientsJob = async () => {
  try {
    const now = new Date();

    // 1. Expire trials that reached trial_ends_at
    const [expiredTrials] = await pool.query(
      "SELECT id, name, slug FROM `Client` WHERE status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < ?",
      [now]
    );

    for (const c of expiredTrials) {
      await pool.execute(
        "UPDATE `Client` SET status = 'expired' WHERE id = ?",
        [c.id]
      );

      // Record system audit log
      await pool.execute(
        `INSERT INTO \`SuperAdminAuditLog\` 
          (actor_id, actor_name, actor_email, action, client_id, client_name, before_value, after_value, ip_address, user_agent)
         VALUES (NULL, 'System Cron', 'system@canteen.com', 'AUTO_EXPIRE_TRIAL', ?, ?, ?, ?, '127.0.0.1', 'CronJob')`,
        [
          c.id,
          c.name,
          JSON.stringify({ status: 'trial' }),
          JSON.stringify({ status: 'expired', reason: 'Trial period completed' }),
        ]
      );
      console.log(`[Client Expiry Cron] Client '${c.name}' trial period expired — status set to 'expired'.`);
    }

    // 2. Expire active subscriptions that reached subscription_ends_at
    const [expiredSubs] = await pool.query(
      "SELECT id, name, slug FROM `Client` WHERE status = 'active' AND subscription_ends_at IS NOT NULL AND subscription_ends_at < ?",
      [now]
    );

    for (const c of expiredSubs) {
      await pool.execute(
        "UPDATE `Client` SET status = 'expired' WHERE id = ?",
        [c.id]
      );

      await pool.execute(
        `INSERT INTO \`SuperAdminAuditLog\` 
          (actor_id, actor_name, actor_email, action, client_id, client_name, before_value, after_value, ip_address, user_agent)
         VALUES (NULL, 'System Cron', 'system@canteen.com', 'AUTO_EXPIRE_SUBSCRIPTION', ?, ?, ?, ?, '127.0.0.1', 'CronJob')`,
        [
          c.id,
          c.name,
          JSON.stringify({ status: 'active' }),
          JSON.stringify({ status: 'expired', reason: 'Subscription period completed' }),
        ]
      );
      console.log(`[Client Expiry Cron] Client '${c.name}' subscription expired — status set to 'expired'.`);
    }
  } catch (error) {
    console.error('⚠️ [Client Expiry Cron Error]', error.message);
  }
};

const initClientExpiryCron = () => {
  // Run on startup
  autoExpireClientsJob();
  // Run every 30 minutes
  setInterval(autoExpireClientsJob, 30 * 60 * 1000);
  console.log('⏰ [Cron] Client auto-expiry background scheduler initialized.');
};

module.exports = {
  initClientExpiryCron,
  autoExpireClientsJob,
};
