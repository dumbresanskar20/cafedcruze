import axios from 'axios';

const envApiUrl = import.meta.env.VITE_API_URL;

const rawApiUrl = envApiUrl
  ? envApiUrl
  : 'https://cafe-d-cruze-api.mealbook.in/api';

const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
const API_BASE_URL = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Admin JWT bearer token
api.interceptors.request.use(
  (config) => {
    const rawToken = localStorage.getItem('admin_token');
    if (rawToken && rawToken !== 'null' && rawToken !== 'undefined') {
      const cleanToken = rawToken.replace(/^"(.*)"$/, '$1').trim();
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: handle 401 & 403 Auth errors by clearing stale token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 402) {
      console.warn('[Admin API] 402 Subscription Expired detected');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription_expired', { detail: error.response.data }));
      }
    }
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const errorData = error.response.data || {};
      const isAuthError =
        error.response.status === 401 ||
        errorData.code === 'TOKEN_EXPIRED' ||
        errorData.code === 'INVALID_TOKEN' ||
        errorData.code === 'NO_TOKEN' ||
        errorData.code === 'FORBIDDEN_ROLE' ||
        errorData.code === 'ACCOUNT_DEACTIVATED' ||
        (errorData.message && (errorData.message.toLowerCase().includes('token') || errorData.message.toLowerCase().includes('forbidden')));

      if (isAuthError) {
        console.warn(`[Admin API] ${error.response.status} Auth error confirmed — clearing stale admin_token`);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('admin_auth_unauthorized'));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
