const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Locate and load .env from candidate paths without overriding existing cPanel/system variables
const candidateEnvPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, './.env'),
  path.resolve(__dirname, '../../backend/.env'),
  path.resolve(process.cwd(), 'backend/.env'),
];

let envLoaded = false;
let loadedEnvPath = null;
for (const p of candidateEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true }); // Ensure updated .env file values take priority upon restart
    envLoaded = true;
    loadedEnvPath = p;
    break; // Stop at first valid .env file to prevent unintended cross-file overrides
  }
}
if (!envLoaded) {
  dotenv.config({ override: true });
}

const rawStartupKey = (process.env.RAZORPAY_KEY_ID || '').trim().replace(/^['"]+|['"]+$/g, '');
const startupKeyType = rawStartupKey.startsWith('rzp_live_') ? 'LIVE' : rawStartupKey.startsWith('rzp_test_') ? 'TEST' : 'CUSTOM/UNSET';
console.log(`[Startup] .env source: ${loadedEnvPath || 'cPanel / system environment'}`);
console.log(`[Startup] Canteen Razorpay Key ID: ${rawStartupKey ? `${rawStartupKey.substring(0, 12)}... [${startupKeyType}]` : 'NOT_SET'}`);



const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { connectDB, pool, getDatabaseStatus } = require('./database/db');

let initBaseSchema;
try {
  initBaseSchema = require('./database/initBaseSchema').initBaseSchema;
} catch (e) {
  // Not yet uploaded or optional
}

let ensureMealWindowTable;
try {
  ensureMealWindowTable = require('./controllers/menuController').ensureMealWindowTable;
} catch (e) {
  // Not yet uploaded or optional
}
const { initInventorySchema } = require('./database/initInventorySchema');
const { initStudentSchema } = require('./database/initStudentSchema');
const { initSuperAdminSchema } = require('./database/initSuperAdminSchema');
const { initOrderSchema } = require('./database/initOrderSchema');
const { initDiscountSchema } = require('./database/initDiscountSchema');
const { initMenuSchema } = require('./database/initMenuSchema');
const initSocketIO = require('./socket');
const { initOrderCleanupJob, autoExpireUncollectedOrders } = require('./jobs/cleanupOldOrders');
const { initSubscriptionCronJob } = require('./jobs/subscriptionCron');
const { initClientExpiryCron } = require('./jobs/clientExpiryCron');
const { checkSubscriptionStatus } = require('./middleware/subscriptionMiddleware');

// Initialize express & http server
const app = express();
const server = http.createServer(app);

// Enable trust proxy for Render / Cloudflare reverse proxy rate-limiting & IP tracking
app.set('trust proxy', 1);

// CORS configuration helper function
const cleanOrigin = (url) => (url ? url.replace(/\/+$/, '') : '');

const rawOrigins = [
  process.env.FRONTEND_STUDENT_URL,
  process.env.FRONTEND_ADMIN_URL,
  'https://dev.mealbook.in',
  'https://cafe-d-cruze-api.mealbook.in',
  'https://devapi.mealbook.in',
  'https://api.mealbook.in',
  'https://devadmin.mealbook.in',
  'https://d-cruze-superadmin.mealbook.in',
  'https://d-cruze-admin.mealbook.in',
  'https://d-cruze.mealbook.in',
  'https://cafe-d-cruze.mealbook.in',
  'https://cafe-d-cruze-admin.mealbook.in',
  'https://cafe-d-cruze-superadmin.mealbook.in',
  'https://superadmin.mealbook.in',
  'https://devsuperadmin.mealbook.in',
  'https://dupcoei-canteen.mealbook.in',
  'https://dypcoei-canteen.mealbook.in',
  'https://canteen-admin.mealbook.in',
  'https://mealbook.in',
  'https://mess-mgmt.vercel.app',
  'https://mess-mgmt-fo5r.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:3000',
];

const allowedOrigins = Array.from(
  new Set(rawOrigins.filter(Boolean).map(cleanOrigin))
);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const normalizedOrigin = cleanOrigin(origin);
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  if (normalizedOrigin.endsWith('.mealbook.in')) return true;
  if (normalizedOrigin === 'https://mealbook.in' || normalizedOrigin === 'http://mealbook.in') return true;
  if (normalizedOrigin.endsWith('.vercel.app')) return true;
  // Allow localhost and private local network IPs (e.g. 10.x.x.x, 192.168.x.x, 172.16-31.x.x)
  if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:[0-9]+)?$/i.test(normalizedOrigin)) {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS Diagnostics] BLOCKED incoming origin: ${origin}`);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static local uploads (images stored in cPanel local storage) with 1-day browser cache
const { UPLOADS_DIR } = require('./config/storage');
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
    },
  })
);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`[Socket.IO CORS] BLOCKED incoming origin: ${origin}`);
        callback(new Error(`Not allowed by Socket.IO CORS: ${origin}`));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initSocketIO(io);
app.set('socketio', io);

// Health check endpoint (exempt from rate limiting, placed before rate limiter for uptime monitors & Passenger)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Mess Management System API',
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: typeof getDatabaseStatus === 'function' ? getDatabaseStatus() : undefined,
  });
});

// Root fallback
app.get('/', (req, res) => {
  res.send('Mess Management System API is running...');
});

const { apiLimiter } = require('./middleware/rateLimiter');

// Rate Limiting: Apply general API rate limiter across all API routes to safeguard Passenger worker capacity
app.use(
  [
    '/api',
    '/super-admin',
    '/subscription',
    '/auth',
    '/menu',
    '/orders',
    '/inventory',
    '/reviews',
    '/discount-settings',
  ],
  apiLimiter
);

// Super-Admin Routes & Subscription Billing (Mounted BEFORE blocking middleware)
app.use(['/api/super-admin', '/super-admin'], require('./routes/superAdminRoutes'));
app.use(['/api/subscription', '/subscription'], require('./routes/subscriptionRoutes'));
app.use('/api/webhook/razorpay-subscription', require('./controllers/subscriptionController').handleDevRazorpayWebhook);

// Global Subscription & Client Status Enforcement Middleware (Runs before student, menu, order, kitchen routes)
app.use(checkSubscriptionStatus);

// API Routes (supports both /api/ prefix and fallback paths)
app.use(['/api/auth/student', '/auth/student'], require('./routes/studentAuthRoutes'));
app.use(['/api/auth/admin', '/auth/admin'], require('./routes/adminAuthRoutes'));
app.use(['/api/menu', '/menu', '/api/admin/menu-items', '/admin/menu-items'], require('./routes/menuRoutes'));
app.use(['/api/orders', '/orders', '/api/admin/orders', '/admin/orders', '/api/admin/income', '/admin/income'], require('./routes/orderRoutes'));
app.use(['/api/inventory', '/inventory'], require('./routes/inventoryRoutes'));
app.use(['/api/reviews', '/reviews'], require('./routes/reviewRoutes'));
app.use(['/api/admin/discount-settings', '/admin/discount-settings', '/api/discount-settings', '/discount-settings'], require('./routes/discountRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start Server Immediately so Phusion Passenger establishes connection without 503 timeouts
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  const cleanKey = (val) => (val ? String(val).trim().replace(/^['"]+|['"]+$/g, '') : '');
  const rzpKeyId = cleanKey(process.env.RAZORPAY_KEY_ID);
  const rzpSecretSet = Boolean(cleanKey(process.env.RAZORPAY_KEY_SECRET));
  const devRzpKeyId = cleanKey(process.env.DEV_RAZORPAY_KEY_ID);
  const devRzpSecretSet = Boolean(cleanKey(process.env.DEV_RAZORPAY_KEY_SECRET));

  const rzpMode = rzpKeyId.startsWith('rzp_live_') ? 'LIVE' : rzpKeyId.startsWith('rzp_test_') ? 'TEST' : (rzpKeyId ? 'CUSTOM' : 'NOT SET');
  const devRzpMode = devRzpKeyId.startsWith('rzp_live_') ? 'LIVE' : devRzpKeyId.startsWith('rzp_test_') ? 'TEST' : (devRzpKeyId ? 'CUSTOM' : 'NOT SET');

  console.log(`\n==================================================`);
  console.log(`🚀 MealBook Mess Management Server running on port ${PORT} [PID: ${process.pid}]`);
  console.log(`📡 Socket.IO server active`);
  console.log(`💳 Canteen Student Razorpay Key: ${rzpKeyId ? `${rzpKeyId.substring(0, 10)}... [${rzpMode}]` : 'NOT SET'}`);
  console.log(`🔑 Canteen Student Razorpay Secret: ${rzpSecretSet ? 'Configured ✅' : 'MISSING ❌'}`);
  console.log(`👑 Developer Subscription Razorpay Key: ${devRzpKeyId ? `${devRzpKeyId.substring(0, 10)}... [${devRzpMode}]` : 'NOT SET'}`);
  console.log(`🔑 Developer Subscription Secret: ${devRzpSecretSet ? 'Configured ✅' : 'MISSING ❌'}`);
  console.log(`==================================================\n`);
});

// Asynchronously connect database and initialize schemas without blocking server listen
connectDB().then(async () => {
  if (typeof initBaseSchema === 'function') {
    try { await initBaseSchema(); } catch (e) { console.warn('[Startup] initBaseSchema warning:', e.message); }
  }

  if (typeof ensureMealWindowTable === 'function') {
    try { await ensureMealWindowTable(); } catch (e) { console.warn('[Startup] ensureMealWindowTable warning:', e.message); }
  }

  if (typeof initStudentSchema === 'function') {
    try { await initStudentSchema(); } catch (e) { console.warn('[Startup] initStudentSchema warning:', e.message); }
  }

  if (typeof initInventorySchema === 'function') {
    try { await initInventorySchema(); } catch (e) { console.warn('[Startup] initInventorySchema warning:', e.message); }
  }

  if (typeof initSuperAdminSchema === 'function') {
    try { await initSuperAdminSchema(); } catch (e) { console.warn('[Startup] initSuperAdminSchema warning:', e.message); }
  }

  if (typeof initOrderSchema === 'function') {
    try { await initOrderSchema(); } catch (e) { console.warn('[Startup] initOrderSchema warning:', e.message); }
  }

  if (typeof initDiscountSchema === 'function') {
    try { await initDiscountSchema(); } catch (e) { console.warn('[Startup] initDiscountSchema warning:', e.message); }
  }

  if (typeof initMenuSchema === 'function') {
    try { await initMenuSchema(); } catch (e) { console.warn('[Startup] initMenuSchema warning:', e.message); }
  }

  try {
    await autoExpireUncollectedOrders();
  } catch (e) {
    console.warn('[Startup] autoExpireUncollectedOrders warning:', e.message);
  }

  try {
    initOrderCleanupJob();
    initSubscriptionCronJob();
    initClientExpiryCron();
  } catch (e) {
    console.warn('[Startup] Cron jobs initialization warning:', e.message);
  }
}).catch((startupErr) => {
  console.error('[Database Startup Warning]:', startupErr.message);
});

// Graceful Shutdown & Process Signal Handling (Crucial for cPanel / Phusion Passenger)
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Process] ${signal} received — shutting down gracefully [PID: ${process.pid}]...`);

  // Force exit timer: ensure Passenger does not leave a zombie process if a connection hangs
  const forceExitTimeout = setTimeout(() => {
    console.error('[Process] Graceful shutdown timed out (5s). Forcing termination.');
    process.exit(1);
  }, 5000);
  forceExitTimeout.unref();

  try {
    // 1. Close Socket.IO server and disconnect clients cleanly
    if (io) {
      console.log('[Process] Closing Socket.IO server...');
      io.close();
    }

    // 2. Close HTTP server (stop accepting new incoming connections)
    if (server && server.listening) {
      console.log('[Process] Closing HTTP server...');
      await new Promise((resolve) => server.close(resolve));
    }

    // 3. Close database connection pool (releases MySQL connections cleanly)
    if (pool) {
      console.log('[Process] Closing database connection pool...');
      await pool.end();
    }

    console.log(`[Process] Graceful shutdown completed cleanly [PID: ${process.pid}].`);
    process.exit(0);
  } catch (err) {
    console.error('[Process] Error during graceful shutdown:', err);
    process.exit(1);
  }
};

// Process signal listeners for cPanel Passenger reloads/restarts & system interrupts
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Defensive error logging for unexpected runtime exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception thrown:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
