import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const SuperAdminAuthContext = createContext();

export const SuperAdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(() => {
    try {
      const saved = localStorage.getItem('super_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('super_admin_token') || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('super_admin_token', token);
    } else {
      localStorage.removeItem('super_admin_token');
    }
  }, [token]);

  useEffect(() => {
    if (admin) {
      localStorage.setItem('super_admin_user', JSON.stringify(admin));
    } else {
      localStorage.removeItem('super_admin_user');
    }
  }, [admin]);

  // Listen for unauthorized 401 events
  useEffect(() => {
    const handleUnauthorized = () => {
      setAdmin(null);
      setToken(null);
    };

    window.addEventListener('super_admin_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('super_admin_unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        setToken(res.data.token);
        setAdmin(res.data.admin);
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Login failed. Invalid Super-Admin credentials.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAdmin(null);
    setToken(null);
    localStorage.removeItem('super_admin_token');
    localStorage.removeItem('super_admin_user');
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      return { success: true, message: res.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to update password.' };
    }
  };

  return (
    <SuperAdminAuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: !!token && !!admin,
        loading,
        login,
        logout,
        changePassword,
      }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
};

export const useSuperAdminAuth = () => useContext(SuperAdminAuthContext);
