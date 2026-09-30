import React from 'react';
import { Menu, ShieldAlert, Zap, LogOut, ExternalLink } from 'lucide-react';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';

export default function Header({ setMobileOpen, title, subtitle }) {
  const { admin, logout } = useSuperAdminAuth();

  return (
    <header className="sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="font-display font-extrabold text-base sm:text-xl text-white tracking-tight leading-none">
            {title || 'Super-Admin Console'}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>System Healthy</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
            {admin?.name?.charAt(0) || 'A'}
          </div>
          <span className="text-xs font-bold text-slate-200 hidden sm:inline">{admin?.name || 'Super Admin'}</span>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
