import axios from 'axios';

const isDev = import.meta.env.DEV;
const envApiUrl = import.meta.env.VITE_API_URL;
const rawApiUrl = isDev ? '/api' : (envApiUrl || 'https://cafe-d-cruze-api.mealbook.in/api');
const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
const API_BASE_URL = cleanApiUrl.endsWith('/api') ? `${cleanApiUrl}/super-admin` : `${cleanApiUrl}/api/super-admin`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach SuperAdmin token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('super_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[SuperAdmin API] 401 Unauthorized — clearing Super-Admin token.');
      localStorage.removeItem('super_admin_token');
      localStorage.removeItem('super_admin_user');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.dispatchEvent(new CustomEvent('super_admin_unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
