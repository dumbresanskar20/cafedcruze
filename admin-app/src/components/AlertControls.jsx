import React, { useState } from 'react';
import { Volume2, VolumeX, Bell, BellOff, Check, Play, Info } from 'lucide-react';
import { useOrderAlerts } from '../context/OrderAlertContext';

export default function AlertControls({ isDarkHeader = false }) {
  const {
    isMuted,
    toggleMute,
    permission,
    requestNotificationPermission,
    testAlert,
  } = useOrderAlerts();

  const [showTooltip, setShowTooltip] = useState(false);

  const handleBellClick = () => {
    if (permission === 'default') {
      requestNotificationPermission(true);
    } else if (permission === 'denied') {
      alert(
        'Desktop notifications are blocked by your browser settings.\n\nTo enable:\n1. Click the lock/settings icon next to the URL in your browser bar.\n2. Set Notifications to "Allow".\n3. Refresh this page.'
      );
    } else if (permission === 'granted') {
      testAlert();
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* 1. Mute / Unmute Speaker Toggle Button */}
      <button
        onClick={toggleMute}
        className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
          isMuted
            ? isDarkHeader
              ? 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/70'
              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
            : isDarkHeader
            ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
        }`}
        title={isMuted ? 'Sound Alert: MUTED (Click to Unmute)' : 'Sound Alert: ACTIVE (Click to Mute)'}
        aria-label={isMuted ? 'Unmute order sound alerts' : 'Mute order sound alerts'}
      >
        {isMuted ? (
          <>
            <VolumeX className="w-4 h-4 text-rose-500" />
            <span className="hidden sm:inline font-black text-[11px] uppercase tracking-wider">
              Muted
            </span>
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="hidden sm:inline font-black text-[11px] uppercase tracking-wider">
              Sound On
            </span>
          </>
        )}
      </button>

      {/* 2. Desktop Notification Status & Quick Test / Enable Button */}
      <button
        onClick={handleBellClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
          permission === 'granted'
            ? isDarkHeader
              ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
              : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
            : permission === 'denied'
            ? isDarkHeader
              ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            : isDarkHeader
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
            : 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
        }`}
        title={
          permission === 'granted'
            ? 'Desktop Notifications Active (Click to test sound & popup)'
            : permission === 'denied'
            ? 'Notifications Blocked in Browser (Click for info)'
            : 'Notifications Not Enabled (Click to allow)'
        }
        aria-label="Notification alert settings"
      >
        {permission === 'granted' ? (
          <>
            <div className="relative">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
            </div>
            <span className="hidden sm:inline font-bold text-[11px]">
              Alerts On
            </span>
          </>
        ) : permission === 'denied' ? (
          <>
            <BellOff className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline font-bold text-[11px]">
              Popups Blocked
            </span>
          </>
        ) : (
          <>
            <Bell className="w-4 h-4 animate-bounce text-amber-600" />
            <span className="hidden sm:inline font-bold text-[11px]">
              Enable Popups
            </span>
          </>
        )}
      </button>

      {/* Optional Test Audio Trigger for quick verification */}
      <button
        onClick={testAlert}
        className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
          isDarkHeader
            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
        }`}
        title="Test Order Alert (Plays chime & sends desktop notification)"
        aria-label="Test order chime alert"
      >
        <Play className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
