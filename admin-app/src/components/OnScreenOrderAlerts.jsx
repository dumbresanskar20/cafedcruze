import React, { useEffect } from 'react';
import { Bell, Volume2, X, UtensilsCrossed, Package } from 'lucide-react';
import { useOrderAlerts } from '../context/OrderAlertContext';

export default function OnScreenOrderAlerts() {
  const { activeAlerts, dismissAlert } = useOrderAlerts();

  if (!activeAlerts || activeAlerts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[9999] flex flex-col gap-3 max-w-md w-[calc(100vw-2rem)] sm:w-96 pointer-events-none select-none"
      aria-live="assertive"
      aria-label="New order notifications"
    >
      {activeAlerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onDismiss={() => dismissAlert(alert.id)} />
      ))}
    </div>
  );
}

function AlertCard({ alert, onDismiss }) {
  const isParcel = Boolean(alert.is_parcel) || alert.order_type === 'parcel';

  // Automatically dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const itemsList = (alert.items || [])
    .map((it) => `${it.quantity || 1}x ${it.item_name || it.name || 'Item'}`)
    .join(', ');

  return (
    <div className="pointer-events-auto bg-slate-900/95 border-2 border-amber-500 rounded-3xl p-4 shadow-2xl backdrop-blur-md text-white transition-all transform animate-in slide-in-from-top-4 duration-300 relative overflow-hidden ring-4 ring-amber-500/20">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center animate-bounce">
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                New Order Received
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Added to Active Tokens</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black px-2.5 py-1 rounded-xl text-xs tracking-tight shadow-sm">
            #{alert.token_number}
          </span>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Customer & Dining Details */}
      <div className="pt-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sm text-white truncate">
            {alert.student_name || 'Walk-in Customer'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isParcel ? (
              <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 font-black text-[10px] px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                <Package className="w-3 h-3" /> Parcel
              </span>
            ) : (
              <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-black text-[10px] px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3" /> Dine In
              </span>
            )}
            {alert.meal_type && (
              <span className="bg-slate-800 text-slate-300 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">
                {alert.meal_type}
              </span>
            )}
          </div>
        </div>

        {/* Ordered items */}
        {itemsList && (
          <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-amber-200/90 line-clamp-2">
            🍲 {itemsList}
          </div>
        )}

        {/* Chime & Sound status footer */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-medium">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            Alert Sound Active
          </span>
          <span>Auto-dismissing in 8s</span>
        </div>
      </div>

      {/* Progress countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 animate-[progress_8s_linear_forwards]" />
      </div>
    </div>
  );
}
