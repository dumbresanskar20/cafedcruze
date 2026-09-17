import React, { useState } from 'react';
import { ShieldAlert, AlertCircle, RefreshCw, PhoneCall } from 'lucide-react';
import api from '../services/api';
import mealBookLogo from '../assets/meal-book-logo.jpeg';

export default function SubscriptionExpiredScreen({ onRetry }) {
  const [checking, setChecking] = useState(false);

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        const res = await api.get('/subscription/status');
        if (res.data?.subscription && !res.data.subscription.is_expired && res.data.subscription.status === 'active') {
          window.location.reload();
        }
      }
    } catch (err) {
      console.warn('Subscription still expired or offline:', err);
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-stone-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 text-stone-100 overflow-hidden">
      <div className="max-w-lg w-full bg-stone-900 border border-amber-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
        
        {/* MealBook Logo Header */}
        <div className="flex flex-col items-center justify-center mx-auto">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white p-2.5 shadow-2xl shadow-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center overflow-hidden transform hover:scale-105 transition-transform duration-300">
            <img
              src={mealBookLogo}
              alt="MealBook Logo"
              className="w-full h-full object-contain rounded-2xl"
              onError={(e) => {
                e.currentTarget.src = '/meal-book-logo.jpeg';
              }}
            />
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-extrabold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>App Expired</span>
        </div>

        {/* Main Warning Header */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
            Currently the App is expired.
          </h1>

          <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl">
            <p className="text-sm sm:text-base font-bold text-amber-300 flex items-center justify-center gap-2">
              <PhoneCall className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Kindly contact to the Canteen(Mess).</span>
            </p>
          </div>

          <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto leading-relaxed font-medium">
            Online meal token ordering, menu browsing, and counter operations are temporarily paused until canteen administration reactivates the service.
          </p>
        </div>

        {/* Informational Card */}
        <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-4 text-xs text-stone-400 flex items-start gap-3 text-left">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            If you have an active order or token number placed earlier, please present your order confirmation or token number directly at the counter.
          </span>
        </div>

        {/* Check Status Button */}
        <div className="pt-2">
          <button
            onClick={handleCheckAgain}
            disabled={checking}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status...' : 'Check Status Again'}</span>
          </button>
        </div>

        <div className="pt-1 text-[11px] text-stone-500">
          MealBook • Digital Canteen Management System
        </div>
      </div>
    </div>
  );
}
