import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Contact, Phone, ArrowRight, KeyRound, AlertCircle, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { useAuth } from '../context/AuthContext';
import CAFE_D_CRUZE_LOGO from '../assets/logo';

const getGoogleOAuthUrl = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '404710338094-k2vudlae2nql5226ru3ajlfnmhskdtru.apps.googleusercontent.com';
  const redirectUri = window.location.origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: 'openid profile email',
    prompt: 'select_account',
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

const isWebViewOrApp = () => {
  if (typeof window === 'undefined') return false;
  const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase();
  return (
    ua.includes('wv') ||
    (ua.includes('android') && ua.includes('version/')) ||
    ua.includes('mobile_app') ||
    window.Android !== undefined ||
    window.Capacitor !== undefined ||
    window.ReactNativeWebView !== undefined ||
    (window.webkit && window.webkit.messageHandlers !== undefined)
  );
};

export default function AuthModal() {
  const {
    authModalOpen,
    authModalMode,
    resetToken: contextResetToken,
    closeAuthModal,
    pendingCheckout,
    login,
    loginWithGoogle,
    signup,
    verifyOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    loading,
    setResetToken,
  } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'otp' | 'forgot-password' | 'reset-password' | 'change-password'
  const [otpEmail, setOtpEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleAuth = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      resetFormAlerts();
      try {
        if (tokenResponse?.access_token) {
          const res = await loginWithGoogle(null, tokenResponse.access_token);
          if (res.success) {
            setSuccessMsg(res.message || (mode === 'signup' ? 'Account created with Google successfully!' : 'Signed in with Google successfully!'));
          } else {
            setErrorMsg(res.message || 'Google authentication failed.');
          }
        } else {
          setErrorMsg('No access token received from Google.');
        }
      } catch (err) {
        setErrorMsg('Google authentication failed. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.warn('Google Sign-In Error / Cancelled:', errorResponse);
      // If popup failed to open or was blocked in WebView, fallback to direct redirect
      if (errorResponse?.type === 'popup_failed_to_open' || errorResponse?.type === 'popup_closed') {
        window.location.href = getGoogleOAuthUrl();
        return;
      }
      setGoogleLoading(false);
      setErrorMsg('Google Sign-In was cancelled or failed. Please try again.');
    },
  });

  const handleGoogleClick = async () => {
    resetFormAlerts();
    setGoogleLoading(true);

    // Native Android/iOS Capacitor App Flow
    if (Capacitor.isNativePlatform()) {
      try {
        const googleUser = await GoogleAuth.signIn();
        const accessToken = googleUser?.authentication?.accessToken || googleUser?.accessToken;

        if (accessToken) {
          const res = await loginWithGoogle(null, accessToken);
          if (res.success) {
            setSuccessMsg(res.message || (mode === 'signup' ? 'Account created with Google successfully!' : 'Signed in with Google successfully!'));
          } else {
            setErrorMsg(res.message || 'Google authentication failed.');
          }
        } else {
          setErrorMsg('No access token received from Google.');
        }
      } catch (err) {
        console.warn('Native Google Sign-In Error / Cancelled:', err);
        setErrorMsg('Google Sign-In was cancelled or failed. Please try again.');
      } finally {
        setGoogleLoading(false);
      }
      return;
    }

    // Web Browser Flow (Completely Unchanged)
    if (isWebViewOrApp()) {
      // In WebView APKs, window.open popups fail without multi-window handling.
      // We navigate directly to the Google OAuth 2.0 authorization URL:
      window.location.href = getGoogleOAuthUrl();
      return;
    }

    try {
      handleGoogleAuth();
    } catch (err) {
      console.warn('Google Auth popup initialization error, redirecting directly:', err);
      window.location.href = getGoogleOAuthUrl();
    }
  };

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (mode === 'otp') {
      setCooldown(60);
    }
  }, [mode]);

  // Password visibility toggle states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resetFormInputs = () => {
    setLoginEmail('');
    setLoginPassword('');
    setSignupName('');
    setSignupEmail('');
    setSignupPhone('');
    setSignupPassword('');
    setOtpCode('');
    setForgotEmail('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const clearFormFieldsOnly = () => {
    setLoginEmail('');
    setLoginPassword('');
    setSignupName('');
    setSignupEmail('');
    setSignupPhone('');
    setSignupPassword('');
    setOtpCode('');
    setForgotEmail('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Sync mode from context when modal opens or mode changes
  useEffect(() => {
    if (authModalMode) {
      setMode(authModalMode);
    }
  }, [authModalMode, authModalOpen]);

  // Clear inputs when modal opens or closes
  useEffect(() => {
    resetFormInputs();
  }, [authModalOpen]);

  // Clear inputs when mode changes (keep fields empty)
  useEffect(() => {
    clearFormFieldsOnly();
  }, [mode]);

  if (!authModalOpen) return null;

  const resetFormAlerts = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const res = await login(loginEmail, loginPassword);
    if (!res.success) {
      if (res.requires_otp) {
        setOtpEmail(res.email || loginEmail.trim().toLowerCase());
        setMode('otp');
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } else {
      setSuccessMsg(res.message);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const cleanedPhone = signupPhone.trim().replace(/\D/g, '');
    if (cleanedPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    const res = await signup({
      name: signupName,
      email: signupEmail,
      phone: signupPhone.trim(),
      password: signupPassword,
    });

    if (res.success) {
      clearFormFieldsOnly();
      setMode('login');
      setSuccessMsg(res.message || 'Account created successfully! Please log in with your credentials.');
    } else {
      setErrorMsg(res.errors && res.errors.length ? res.errors.join('. ') : res.message);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const res = await verifyOtp(otpEmail, otpCode);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
    }
  };

  const handleResendOtp = async () => {
    resetFormAlerts();
    if (!otpEmail) {
      setErrorMsg('Email address is missing.');
      return;
    }
    if (cooldown > 0) return;
    const res = mode === 'reset-password'
      ? await forgotPassword(otpEmail)
      : await resendOtp(otpEmail);
    if (res.success) {
      setSuccessMsg(res.message);
      setCooldown(60);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match. Please re-enter.');
      return;
    }

    const res = await changePassword(oldPassword, newPassword);
    if (res.success) {
      setSuccessMsg(res.message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        closeAuthModal();
      }, 2000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const emailTrimmed = forgotEmail.trim().toLowerCase();
    if (!emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const res = await forgotPassword(emailTrimmed);
    if (res.success) {
      setOtpEmail(emailTrimmed);
      setSuccessMsg(res.message || 'A verification OTP code has been sent to your email.');
      setMode('reset-password');
      setCooldown(60);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    const res = await resetPassword(otpEmail, otpCode.trim(), newPassword);
    if (res.success) {
      setSuccessMsg(res.message);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('reset_token');
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
      setTimeout(() => {
        setMode('login');
        setLoginPassword('');
      }, 2000);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-md my-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-100 p-4 sm:p-7 max-h-[92vh] flex flex-col justify-between overflow-y-auto">

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Top Branding & Context Notice */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <img
              src={CAFE_D_CRUZE_LOGO}
              alt="Cafe D Cruze Restaurant Logo"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-contain bg-white p-1 shadow-warm border border-amber-200"
            />
            <div className="text-left">
              <span className="font-display font-extrabold text-base sm:text-lg text-brand-dark tracking-tight leading-none block">
                Cafe D Cruze <span className="text-brand-orange">Restaurant</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mt-0.5">
                Official Student Portal
              </span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold font-display text-brand-dark">
            {mode === 'login' && 'Welcome Back!'}
            {mode === 'signup' && 'Create Student Account'}
            {mode === 'otp' && 'Verify Your Email'}
            {mode === 'forgot-password' && 'Reset Your Password'}
            {mode === 'reset-password' && 'Set New Password'}
            {mode === 'change-password' && 'Change Password'}
          </h2>

          <p className="text-xs text-stone-500 mt-1 font-medium px-2">
            {pendingCheckout ? (
              <span className="text-brand-orange font-bold flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Please sign in to finalize your meal order
              </span>
            ) : mode === 'forgot-password' ? (
              'Enter your registered email to receive a password reset link'
            ) : mode === 'reset-password' ? (
              'Enter and confirm your new password below'
            ) : mode === 'change-password' ? (
              'Enter your old password and choose a new one below'
            ) : (
              'Sign in to order hot meals with digital tokens at Cafe D Cruze Restaurant'
            )}
          </p>
        </div>

        {/* Alert Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mode Switch Tabs */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="flex bg-stone-100 p-1 rounded-2xl mb-4 sm:mb-6">
            <button
              onClick={() => { setMode('login'); resetFormAlerts(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white text-brand-dark shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); resetFormAlerts(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${mode === 'signup' ? 'bg-white text-brand-dark shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Form: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5" autoComplete="off">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Email or Mobile Number</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  required
                  placeholder="Ex: studentname@gmail.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setMode('forgot-password'); resetFormAlerts(); }}
                className="text-xs font-bold text-brand-orange hover:underline focus:outline-none"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold rounded-2xl text-sm shadow-warm transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Signing In...' : 'Sign In to Cafe D Cruze Restaurant'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Google OAuth Login Button */}
            <div className="pt-3 border-t border-stone-200 mt-3">
              <div className="relative flex items-center justify-center mb-2.5">
                <span className="bg-white px-2.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  or continue with
                </span>
              </div>
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading || googleLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-700 font-bold rounded-2xl border border-stone-200 shadow-sm hover:shadow transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Form: SIGNUP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  placeholder="Ex: studentname@gmail.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type="tel"
                  required
                  maxLength={15}
                  placeholder="10-digit mobile number"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Create Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3.5 top-2.5 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold rounded-2xl text-xs shadow-warm transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Creating Account...' : 'Create New Account'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Google OAuth Signup Button */}
            <div className="pt-3 border-t border-stone-200 mt-3">
              <div className="relative flex items-center justify-center mb-2.5">
                <span className="bg-white px-2.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  or sign up with
                </span>
              </div>
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading || googleLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-700 font-bold rounded-2xl border border-stone-200 shadow-sm hover:shadow transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="text-xs sm:text-sm font-bold text-stone-700">
                  {googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Form: FORGOT PASSWORD */}
        {mode === 'forgot-password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Registered Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  placeholder="Ex: studentname@gmail.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold rounded-2xl text-sm shadow-warm transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Sending OTP...' : 'Send Password Reset OTP'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); resetFormAlerts(); }}
              className="w-full text-center text-xs font-bold text-stone-500 hover:text-brand-dark py-1 transition-colors"
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* Form: RESET PASSWORD WITH OTP */}
        {mode === 'reset-password' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
            <p className="text-xs text-stone-600 text-center mb-2">
              Enter the 6-digit OTP sent to <strong className="text-brand-dark font-bold">{otpEmail}</strong> along with your new password.
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">6-Digit OTP Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Enter 6 digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium tracking-[0.1em]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showConfirmResetPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showConfirmResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
              <Sparkles className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading || cooldown > 0}
                className="font-bold text-brand-orange hover:underline focus:outline-none disabled:opacity-50 disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP Code'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); resetFormAlerts(); }}
                className="font-bold text-stone-500 hover:text-brand-dark transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Form: OTP VERIFICATION */}
        {mode === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-3.5 text-center">
            <p className="text-xs text-stone-600">
              Enter the 6-digit verification code sent to <br />
              <strong className="text-brand-dark font-bold truncate block">{otpEmail}</strong>
            </p>

            <div className="relative my-3">
              <KeyRound className="absolute left-3.5 top-3.5 w-5 h-5 text-brand-orange" />
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 6 digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-amber-50/80 border border-amber-300 rounded-2xl text-center font-display font-extrabold text-xl sm:text-2xl tracking-[0.3em] text-brand-terracotta focus:ring-2 focus:ring-brand-orange outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying OTP...' : 'Verify OTP & Finish'}
              <Sparkles className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading || cooldown > 0}
                className="font-bold text-brand-orange hover:underline focus:outline-none disabled:opacity-50 disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); resetFormAlerts(); }}
                className="font-bold text-stone-500 hover:text-stone-800 transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Form: CHANGE PASSWORD */}
        {mode === 'change-password' && (
          <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Old Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter old password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showOldPassword ? 'Hide password' : 'Show password'}
                >
                  {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showConfirmResetPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showConfirmResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold rounded-2xl text-sm shadow-warm transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Updating Password...' : 'Change Password'}
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
