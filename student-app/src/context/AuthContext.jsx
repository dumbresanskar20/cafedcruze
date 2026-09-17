import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [student, setStudent] = useState(() => {
    const saved = localStorage.getItem('student_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('student_token') || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [resetToken, setResetToken] = useState(null);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync token to API interceptor headers
  useEffect(() => {
    if (token) {
      localStorage.setItem('student_token', token);
    } else {
      localStorage.removeItem('student_token');
    }
  }, [token]);

  useEffect(() => {
    if (student) {
      localStorage.setItem('student_user', JSON.stringify(student));
    } else {
      localStorage.removeItem('student_user');
    }
  }, [student]);

  // Capture Google OAuth redirect token from URL hash or query params (#access_token=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const parseAndLoginFromHash = async () => {
      const hash = window.location.hash;
      const search = window.location.search;

      let accessToken = null;
      let idToken = null;

      if (hash && (hash.includes('access_token=') || hash.includes('id_token='))) {
        const hashParams = new URLSearchParams(hash.substring(1));
        accessToken = hashParams.get('access_token');
        idToken = hashParams.get('id_token');
      } else if (search && (search.includes('access_token=') || search.includes('id_token='))) {
        const searchParams = new URLSearchParams(search);
        accessToken = searchParams.get('access_token');
        idToken = searchParams.get('id_token');
      }

      if (accessToken || idToken) {
        // Clean URL hash without reloading the page
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        try {
          await loginWithGoogle(idToken || null, accessToken || null);
        } catch (e) {
          console.error('[OAuth Redirect] Auto-login error:', e);
        }
      }
    };

    parseAndLoginFromHash();
  }, []);

  // Handle successful login or OTP verification
  const handleAuthSuccess = (userData, accessToken) => {
    setStudent(userData);
    setToken(accessToken);
    setAuthModalOpen(false);
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/login', { email, password });
      const data = response.data;

      if (data.requires_otp) {
        return { success: false, requires_otp: true, email: data.email, message: data.message };
      }

      handleAuthSuccess(data.student, data.accessToken);
      return { success: true, message: data.message };
    } catch (error) {
      if (error.response?.data?.requires_otp) {
        return {
          success: false,
          requires_otp: true,
          email: error.response.data.email,
          message: error.response.data.message,
        };
      }
      const msg = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (formData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/signup', formData);
      const data = response.data;
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Signup failed. Please try again.';
      return { success: false, message: msg, errors: error.response?.data?.errors };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email, otp_code) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/verify-otp', { email, otp_code });
      const data = response.data;
      handleAuthSuccess(data.student, data.accessToken);
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Verification failed. Invalid or expired OTP.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async (email) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/resend-otp', { email });
      return { success: true, message: response.data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to resend verification code.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/change-password', { oldPassword, newPassword });
      return { success: true, message: response.data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to change password. Please check your old password.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/forgot-password', { email });
      return { success: true, message: response.data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to request password reset. Please try again.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email, otpCode, newPassword) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/reset-password', {
        email,
        otp_code: otpCode,
        password: newPassword,
      });
      return { success: true, message: response.data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Password reset failed. OTP may have expired or is invalid.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (credential, accessToken) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/google', { credential, accessToken });
      const data = response.data;
      handleAuthSuccess(data.student, data.accessToken);
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Google sign-in failed. Please try again.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStudent(null);
    setToken(null);
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
  };

  const openAuthModal = (forCheckout = false, mode = 'login', tokenVal = null) => {
    setPendingCheckout(forCheckout);
    setAuthModalMode(mode);
    if (tokenVal) setResetToken(tokenVal);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setPendingCheckout(false);
  };

  return (
    <AuthContext.Provider
      value={{
        student,
        token,
        isAuthenticated: !!token && !!student,
        authModalOpen,
        authModalMode,
        resetToken,
        setAuthModalMode,
        setResetToken,
        pendingCheckout,
        loading,
        login,
        loginWithGoogle,
        signup,
        verifyOtp,
        resendOtp,
        changePassword,
        forgotPassword,
        resetPassword,
        logout,
        openAuthModal,
        closeAuthModal,
        setPendingCheckout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
