import React from 'react';
import { Calendar, ShieldAlert, ShieldCheck, Clock, RefreshCw, Zap } from 'lucide-react';

export default function SubscriptionWidget({ subscription, onOpenRenewModal, loading, onRefresh }) {
  if (!subscription) return null;

  const daysRemaining = subscription.days_remaining ?? 0;
  const isExpired = subscription.is_expired || subscription.status !== 'active';

  // Format plan type label
  const formatPlanName = (type) => {
    switch (type) {
      case 'monthly':
        return 'Monthly Plan (₹1,000 / 30d)';
      case 'quarterly':
        return 'Quarterly Plan (₹3,000 / 90d)';
      case 'six_month':
        return '6-Month Plan (₹6,000 / 180d)';
      case 'yearly':
        return 'Yearly Plan (₹12,000 / 365d)';
      default:
        return type ? type.toUpperCase() : 'Active Plan';
    }
  };

  // Color logic according to spec:
  // normal > 7 days, orange <= 7 days, red <= 2 days
  let theme = {
    cardBg: 'bg-slate-900 border-slate-800 text-white',
    badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    daysText: 'text-emerald-400',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    statusLabel: 'Active',
  };

  if (isExpired || daysRemaining <= 2) {
    theme = {
      cardBg: 'bg-slate-900 border-red-500/40 text-white',
      badgeBg: 'bg-red-500/20 text-red-400 border-red-500/40',
      daysText: 'text-red-400',
      icon: <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />,
      statusLabel: isExpired ? 'Expired' : 'Critical (≤2 Days)',
    };
  } else if (daysRemaining <= 7) {
    theme = {
      cardBg: 'bg-slate-900 border-amber-500/40 text-white',
      badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      daysText: 'text-amber-400',
      icon: <Clock className="w-5 h-5 text-amber-400" />,
      statusLabel: 'Expiring Soon (≤7 Days)',
    };
  }

  const formattedEndDate = subscription.subscription_end_date
    ? new Date(subscription.subscription_end_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'N/A';

  return (
    <div className={`rounded-3xl p-5 border shadow-md space-y-3 ${theme.cardBg}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {theme.icon}
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Super Admin • System Subscription Status
            </span>
            <h4 className="text-sm font-bold text-slate-200">
              {formatPlanName(subscription.plan_type)}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-black px-3 py-1 rounded-full border uppercase tracking-wide ${theme.badgeBg}`}>
            {theme.statusLabel}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
        <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Days Remaining
          </span>
          <span className={`text-2xl font-black ${theme.daysText}`}>
            {daysRemaining} <span className="text-xs font-semibold text-slate-400">days</span>
          </span>
        </div>

        <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Expiry Date
          </span>
          <span className="text-base font-black text-white flex items-center gap-1.5 mt-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            {formattedEndDate}
          </span>
        </div>

        <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80 col-span-2 sm:col-span-1 flex items-center justify-center">
          <button
            onClick={onOpenRenewModal}
            className="w-full h-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Renew / Extend Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
