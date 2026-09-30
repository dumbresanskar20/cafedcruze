import axios from 'axios';

const envApiUrl = import.meta.env.VITE_API_URL;

const rawApiUrl = envApiUrl
  ? envApiUrl
  : 'https://cafe-d-cruze-api.mealbook.in/api';

const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
const API_BASE_URL = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;

// [Diagnostics] Check API URL protocol for HTTPS vs HTTP (Mixed Content Protection)
console.log(`[Razorpay Diagnostics] Frontend API Base URL configured: ${API_BASE_URL}`);

if (typeof window !== 'undefined' && window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:')) {
  console.error('[Razorpay Diagnostics] CRITICAL: Web app is served over HTTPS but VITE_API_URL is HTTP. Browsers will block these API calls as Mixed Content!');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Student JWT token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('student_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token invalidation & subscription status
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 402) {
      console.warn('[Student API] 402 Subscription Expired detected');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription_expired', { detail: error.response.data }));
      }
    }
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const msg = error.response.data?.message || '';
      const code = error.response.data?.code || '';
      // If token is explicitly expired, invalid, or account unverified, clear stale session token
      if (
        code === 'TOKEN_EXPIRED' ||
        code === 'INVALID_TOKEN' ||
        code === 'NO_TOKEN' ||
        msg.includes('Token expired') ||
        msg.includes('Invalid authentication token') ||
        msg.includes('not verified')
      ) {
        console.warn(`[Student API] ${error.response.status} Authentication error detected — clearing stale session tokens.`);
        localStorage.removeItem('student_token');
        localStorage.removeItem('student_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
