const jwt = require('jsonwebtoken');

const initSocketIO = (io) => {
  // Middleware to authenticate socket connections via JWT token
  io.use((socket, next) => {
    let rawToken = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!rawToken) {
      // Allow anonymous connection for non-sensitive public events if any
      socket.userType = 'anonymous';
      return next();
    }

    if (typeof rawToken === 'string') {
      rawToken = rawToken.replace(/^Bearer\s+/i, '').trim();
    }

    try {
      const decoded = jwt.verify(rawToken, process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production');
      socket.user = decoded;
      if (['super_admin', 'admin', 'staff'].includes(decoded.role)) {
        socket.userType = 'admin';
      } else if (decoded.role === 'student') {
        socket.userType = 'student';
      }
      return next();
    } catch (err) {
      console.warn(`[Socket.IO Auth Error] Socket ${socket.id} verification failed: ${err.message}`);
      socket.userType = 'anonymous';
      return next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id} (Type: ${socket.userType || 'anonymous'})`);

    // Automatically join kitchen room for authenticated admin / staff connections
    if (socket.userType === 'admin') {
      socket.join('kitchen');
      console.log(`[Socket.IO] Admin socket ${socket.id} (${socket.user?.username || 'admin'}) auto-joined 'kitchen'`);
      socket.emit('joined:kitchen', { success: true, message: 'Subscribed to live kitchen order stream.' });
    }

    // Kitchen Screen Subscription (explicit listener)
    socket.on('join:kitchen', () => {
      if (socket.userType === 'admin') {
        socket.join('kitchen');
        console.log(`[Socket.IO] Admin socket ${socket.id} (${socket.user?.username}) joined room 'kitchen'`);
        socket.emit('joined:kitchen', { success: true, message: 'Subscribed to live kitchen order stream.' });
      } else {
        socket.emit('error', { message: 'Unauthorized. Admin token required to join kitchen stream.' });
      }
    });

    // Student Order Subscription
    socket.on('join:student', (studentId) => {
      const targetId = studentId || socket.user?.id || socket.user?.studentId;
      if (targetId) {
        socket.join(`student:${targetId}`);
        console.log(`[Socket.IO] Student socket ${socket.id} joined room 'student:${targetId}'`);
      }
    });

    // Parcel Preparation Timer Events (Admin <-> Student real-time sync)
    socket.on('order:timer_set', (data) => {
      console.log(`[Socket.IO] Parcel timer set: Order #${data?.token_number || data?.orderId} for ${data?.minutes}m`);
      io.to('kitchen').emit('parcel:timer_updated', data);
      if (data?.studentId) {
        io.to(`student:${data.studentId}`).emit('parcel:timer_updated', data);
      }
      io.emit('order:timer_broadcast', data);
    });

    socket.on('order:timer_cleared', (data) => {
      console.log(`[Socket.IO] Parcel timer cleared for Order #${data?.orderId}`);
      io.to('kitchen').emit('parcel:timer_cleared', data);
      if (data?.studentId) {
        io.to(`student:${data.studentId}`).emit('parcel:timer_cleared', data);
      }
      io.emit('order:timer_cleared_broadcast', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocketIO;
