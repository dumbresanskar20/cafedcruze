import React, { useState } from 'react';
import { LayoutGrid, UtensilsCrossed, Clock, Users, LogOut, History, Menu, X, Package, Star, Percent, BarChart3, KeyRound } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import CAFE_D_CRUZE_LOGO from '../assets/logo';
import AlertControls from './AlertControls';

export default function Sidebar({ activeTab, setActiveTab, onOpenChangePassword }) {
  const { admin, isSuperAdmin, logout } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [];
  if (admin?.role === 'super_admin') {
    navItems.push(
      { id: 'kitchen', label: 'Order Fulfillment', icon: LayoutGrid, highlight: true },
      { id: 'history', label: 'Order History', icon: History },
      { id: 'reviews', label: 'Ratings & Reviews', icon: Star },
      { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
      { id: 'menu-report', label: 'Menu Report', icon: BarChart3 },
      { id: 'inventory', label: 'Total Inventory', icon: Package },
      { id: 'timings', label: 'Meal Timings', icon: Clock },
      { id: 'discounts', label: 'Discount Rules', icon: Percent },
      { id: 'staff', label: 'Manage Staff', icon: Users }
    );
  } else if (admin?.role === 'admin') {
    navItems.push(
      { id: 'kitchen', label: 'Order Fulfillment', icon: LayoutGrid, highlight: true },
      { id: 'history', label: 'Order History', icon: History },
      { id: 'reviews', label: 'Ratings & Reviews', icon: Star },
      { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
      { id: 'menu-report', label: 'Menu Report', icon: BarChart3 },
      { id: 'inventory', label: 'Total Inventory', icon: Package },
      { id: 'timings', label: 'Meal Timings', icon: Clock },
      { id: 'discounts', label: 'Discount Rules', icon: Percent }
    );
  } else {
    // staff role
    navItems.push(
      { id: 'kitchen', label: 'Kitchen Screen', icon: LayoutGrid, highlight: true }
    );
  }

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Navigation Bar (Visible ONLY on mobile screens < md) */}
      <div className="md:hidden sticky top-0 z-30 bg-slate-900 text-slate-200 px-4 py-3 border-b border-slate-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <img
            src={CAFE_D_CRUZE_LOGO}
            alt="Cafe D Cruze Restaurant Logo"
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-sm border border-slate-700"
          />
          <div>
            <h1 className="font-extrabold text-sm text-white tracking-tight leading-none">
              Cafe D Cruze <span className="text-emerald-400">Restaurant</span>
            </h1>
            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
              {navItems.find((n) => n.id === activeTab)?.label || 'Kitchen Operations'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AlertControls isDarkHeader={true} />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex items-center gap-1.5"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-xs font-bold">{mobileOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Content (Collapsible Drawer on mobile < md, persistent sidebar on desktop >= md) */}
      <aside
        className={`bg-admin-sidebar text-slate-300 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-50 transition-all duration-200 ${mobileOpen
            ? 'fixed inset-y-0 left-0 w-64 shadow-2xl translate-x-0'
            : 'hidden md:flex md:w-64 md:translate-x-0'
          }`}
      >
        <div>
          {/* Top Logo Header */}
          <div className="p-5 border-b border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={CAFE_D_CRUZE_LOGO}
                alt="Cafe D Cruze Restaurant Logo"
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 shadow-md border border-slate-700/80"
              />
              <div>
                <h1 className="font-extrabold text-base text-white tracking-tight leading-none">
                  Cafe D Cruze <span className="text-emerald-400">Restaurant</span>
                </h1>
                <span className="text-[10px] text-slate-400 font-medium">Order Fulfillment & Stocks</span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info Badge & Alert Status */}
          <div className="mx-4 my-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                {admin?.username?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{admin?.username || 'Admin User'}</p>
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
                  {admin?.role === 'super_admin' ? 'Super Admin' : admin?.role === 'admin' ? 'Admin' : 'Kitchen Staff'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 text-left ${active
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-slate-700/60 space-y-1.5">
          <button
            onClick={() => {
              setMobileOpen(false);
              if (onOpenChangePassword) onOpenChangePassword();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => {
              setMobileOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
