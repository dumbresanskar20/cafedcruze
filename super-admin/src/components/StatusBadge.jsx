import React from 'react';
import { CheckCircle2, Clock, Ban, AlertTriangle } from 'lucide-react';

export default function StatusBadge({ status, size = 'sm' }) {
  const s = status ? status.toLowerCase() : 'unknown';

  let config = {
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-700',
    label: s,
    icon: Clock,
  };

  if (s === 'active') {
    config = {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      label: 'Active',
      icon: CheckCircle2,
    };
  } else if (s === 'trial') {
    config = {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-400',
      border: 'border-indigo-500/30',
      label: 'Free Trial',
      icon: Clock,
    };
  } else if (s === 'suspended') {
    config = {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/30',
      label: 'Suspended',
      icon: Ban,
    };
  } else if (s === 'expired') {
    config = {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      label: 'Expired',
      icon: AlertTriangle,
    };
  }

  const Icon = config.icon;
  const padding = size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border ${config.bg} ${config.text} ${config.border} ${padding}`}
    >
      <Icon className={size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      <span>{config.label}</span>
    </span>
  );
}
