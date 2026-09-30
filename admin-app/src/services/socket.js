import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL.replace(/\/+$/, '');
  }

  if (import.meta.env.VITE_API_URL) {
    const cleanApi = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    return cleanApi.replace(/\/api\/?$/i, '');
  }

  return 'https://cafe-d-cruze-api.mealbook.in';
};

export const createAdminSocketClient = (token) => {
  const socketUrl = getSocketUrl();
  console.log(`[Admin Socket.IO Client] Connecting to: ${socketUrl}`);

  const options = {
    auth: { token },
    transports: ['polling', 'websocket'], // Reliable handshake starting with polling, upgrading to websocket
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    withCredentials: true,
  };

  const socket = io(socketUrl, options);

  socket.on('connect', () => {
    console.log(`[Admin Socket.IO Connected] Socket ID: ${socket.id} (URL: ${socketUrl})`);
    socket.emit('join:kitchen');
  });

  socket.on('connect_error', (err) => {
    console.error(`[Admin Socket.IO Connection Error] ${err.message}`, err);
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') {
      console.log(`[Admin Socket.IO Client] Intentional client disconnect.`);
    } else {
      console.warn(`[Admin Socket.IO Disconnected] Reason: ${reason}`);
    }
  });

  return socket;
};
