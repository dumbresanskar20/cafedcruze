import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('admin_token') || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

  const fetchSubscriptionStatus = async () => {
    try {
      const res = await api.get('/subscription/status');
      if (res.data.success) {
        setSubscription(res.data.subscription);
        const isExp = res.data.subscription?.is_expired || res.data.subscription?.status !== 'active';
        setSubscriptionExpired(isExp);
        return res.data.subscription;
      }
    } catch (err) {
      if (err.response?.status === 402) {
        setSubscriptionExpired(true);
      }
    }
    return null;
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
  }, [token]);

  useEffect(() => {
    if (admin) {
      localStorage.setItem('admin_user', JSON.stringify(admin));
    } else {
      localStorage.removeItem('admin_user');
    }
  }, [admin]);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  // Reset auth state if a 401 Unauthorized API error occurs or set expired on 402
  useEffect(() => {
    const handleUnauthorized = () => {
      setAdmin(null);
      setToken(null);
    };

    const handleSubExpired = () => {
      setSubscriptionExpired(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('admin_auth_unauthorized', handleUnauthorized);
      window.addEventListener('subscription_expired', handleSubExpired);
      return () => {
        window.removeEventListener('admin_auth_unauthorized', handleUnauthorized);
        window.removeEventListener('subscription_expired', handleSubExpired);
      };
    }
  }, []);

  const login = async (usernameOrEmail, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/login', { usernameOrEmail, password });
      const data = res.data;

      setAdmin(data.admin);
      setToken(data.token);

      if (data.subscription) {
        setSubscription(data.subscription);
      }
      if (data.subscription_expired) {
        setSubscriptionExpired(true);
      }

      return { success: true, message: data.message, subscriptionExpired: Boolean(data.subscription_expired) };
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed. Invalid admin credentials.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password, confirmPassword, role = 'admin') => {
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/register', { username, email, password, confirmPassword, role });
      return { success: true, message: res.data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const setPasswordWithToken = async (setupToken, newPassword) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/set-password', {
        token: setupToken,
        password: newPassword,
      });
      const data = res.data;

      if (data.token && data.admin) {
        // Immediate implicit login: store JWT token and admin user profile
        setToken(data.token);
        setAdmin(data.admin);

        // Remove token query param from URL so the app renders the admin dashboard immediately
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      if (data.requires_login) {
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return { success: false, requiresLogin: true, message: data.message };
      }

      return { success: true, message: data.message, admin: data.admin };
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        'This link has expired or was already used — please ask your admin to resend an invite.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAdmin(null);
    setToken(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: !!token && !!admin,
        isSuperAdmin: admin?.role === 'super_admin',
        loading,
        subscription,
        subscriptionExpired,
        setSubscription,
        setSubscriptionExpired,
        fetchSubscriptionStatus,
        login,
        register,
        setPasswordWithToken,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
