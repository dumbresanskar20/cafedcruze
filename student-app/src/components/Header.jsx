import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, User, LogOut, Receipt, ChevronDown, KeyRound, Download } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CAFE_D_CRUZE_LOGO from '../assets/logo';

// Helper to detect Android operating system
const isAndroidDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  return ua.includes('android') || platform.includes('android');
};

// Helper to detect if running inside native app / WebView wrapper / standalone PWA
const isNativeOrAppEnvironment = () => {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
      return true;
    }
  } catch (e) {
    // Ignore Capacitor lookup errors
  }
  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
  return (
    ua.includes('wv') ||
    (ua.includes('android') && ua.includes('version/')) ||
    ua.includes('mobile_app') ||
    window.Android !== undefined ||
    window.ReactNativeWebView !== undefined ||
    (window.webkit && window.webkit.messageHandlers !== undefined) ||
    Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );
};

export default function Header({ onOpenOrders }) {
  const { student, isAuthenticated, openAuthModal, logout } = useAuth();
  const { cartCount, setIsCartOpen, isCartBouncing } = useCart();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showDownloadApp, setShowDownloadApp] = useState(false);
  const dropdownRef = useRef(null);

  // Detect if on Android device and browsing on website (not in native app)
  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forcePreview = params && (params.get('preview_app') === 'true' || params.get('download_preview') === '1');

    const isAndroid = isAndroidDevice();
    const isApp = isNativeOrAppEnvironment();

    // Only visible on website, on Android devices (and excluded inside native app)
    if ((isAndroid && !isApp) || forcePreview) {
      setShowDownloadApp(true);
    }
  }, []);

  // Outside click listener to auto-close user dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-100/80 shadow-sm transition-all w-full">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0 min-w-0"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img
              src={CAFE_D_CRUZE_LOGO}
              alt="Cafe D Cruze Restaurant Logo"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl object-contain bg-white p-0.5 shadow-warm border border-amber-200 hover:rotate-6 transition-transform shrink-0"
            />
            <div className="min-w-0">
              <span className="font-display font-extrabold text-lg sm:text-2xl text-brand-dark tracking-tight leading-none block whitespace-nowrap truncate">
                Cafe D Cruze <span className="text-brand-orange">Restaurant</span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-stone-500 tracking-wider uppercase hidden sm:block whitespace-nowrap">
                Fresh & Delicious Daily
              </span>
            </div>
          </div>

          {/* Right Action Bar: Cart Icon & Persistent Auth Control */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Android Website-Only APK Download Button */}
            {showDownloadApp && (
              <a
                href="/Cafe-D-Cruze.apk"
                download="Cafe D Cruze.apk"
                className="inline-flex items-center gap-1 sm:gap-1.5 bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white font-bold text-xs sm:text-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl shadow-sm hover:shadow transition-all transform active:scale-95 shrink-0 cursor-pointer"
                title="Download Cafe D Cruze Android App"
                aria-label="Download Cafe D Cruze Android App"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                <span>Get App</span>
              </a>
            )}

            {/* Cart Tray Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative inline-flex items-center justify-center p-2 sm:px-4 sm:py-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-brand-terracotta hover:bg-amber-100/80 transition-all shadow-sm ${
                isCartBouncing ? 'animate-pulse-cart scale-110 border-brand-orange' : ''
              }`}
              aria-label="View Cart"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-brand-orange" />
              <span className="hidden sm:inline font-bold text-sm ml-2 text-stone-800">Tray</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white font-extrabold text-[10px] sm:text-[11px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Persistent Auth Control */}
            {isAuthenticated && student ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 text-brand-dark px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-semibold text-xs sm:text-sm hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-brand-orange text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline font-bold max-w-[90px] sm:max-w-[100px] truncate">{student.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-500 shrink-0" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 sm:w-52 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-stone-100">
                      <p className="text-[10px] sm:text-xs text-stone-500 font-medium">Logged in as</p>
                      <p className="text-xs sm:text-sm font-bold text-stone-800 truncate">{student.name}</p>
                      <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">{student.roll_no}{student.phone ? ` • ${student.phone}` : ''}</p>
                    </div>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenOrders();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-stone-700 font-semibold hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Receipt className="w-4 h-4 text-brand-orange" />
                      <span>My Order History</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        openAuthModal(false, 'change-password');
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-stone-700 font-semibold hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-brand-orange" />
                      <span>Change Password</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-red-600 font-semibold hover:bg-red-50 flex items-center gap-2.5 transition-colors border-t border-stone-100 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal(false)}
                className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold text-xs sm:text-sm px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-warm hover:shadow-cardHover transition-all transform active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Sign In</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
