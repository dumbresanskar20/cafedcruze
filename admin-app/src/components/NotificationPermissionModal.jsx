import React from 'react';
import { Bell, Volume2, ShieldCheck, X } from 'lucide-react';
import { useOrderAlerts } from '../context/OrderAlertContext';

export default function NotificationPermissionModal() {
  const { showPromptModal, requestNotificationPermission, dismissPromptModal } = useOrderAlerts();

  if (!showPromptModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center relative space-y-5">
        {/* Close Button */}
        <button
          onClick={dismissPromptModal}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
          <Bell className="w-8 h-8 animate-bounce" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            Enable Real-Time Order Alerts?
          </h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
            Get instant sound chimes and desktop notification alerts the second a student places an order — even when this tab is in the background or minimized!
          </p>
        </div>

        {/* Benefits list */}
        <div className="bg-slate-50 rounded-2xl p-3.5 text-left text-xs font-semibold text-slate-700 space-y-2 border border-slate-200/70">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Hear a clear chime whenever a new order arrives</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-blue-600 shrink-0" />
            <span>See desktop popups with token # and dining details</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Never miss urgent or parcel takeaway orders</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={dismissPromptModal}
            className="py-3 px-4 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
          >
            Maybe Later
          </button>

          <button
            onClick={() => requestNotificationPermission(true)}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Bell className="w-4 h-4" />
            <span>Enable Alerts</span>
          </button>
        </div>

        <p className="text-[10px] text-slate-400 font-medium">
          You can mute sound or change preferences anytime via the header control.
        </p>
      </div>
    </div>
  );
}
