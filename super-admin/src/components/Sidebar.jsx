import React from 'react';
import { 
  LayoutDashboard, ShieldAlert, CreditCard,
  History, Settings, LogOut, Zap, X
} from 'lucide-react';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, setMobileOpen }) {
  const { admin, logout } = useSuperAdminAuth();

  const navSections = [
    {
      title: 'Cafe D Cruze Control',
      items: [
        { id: 'dashboard', label: 'Canteen Dashboard', icon: LayoutDashboard },
        { id: 'canteen_control', label: 'Subscription & Access', icon: ShieldAlert },
        { id: 'plans', label: 'Plans & Pricing', icon: CreditCard },
      ],
    },
    {
      title: 'System & Security',
      items: [
        { id: 'audit', label: 'Audit Trail Logs', icon: History },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`bg-[#0c1220] border-r border-slate-800/80 text-slate-300 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-50 transition-all duration-200 ${
          mobileOpen
            ? 'fixed inset-y-0 left-0 w-64 shadow-2xl translate-x-0'
            : 'hidden md:flex md:w-64 md:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto flex-1">
          {/* Logo Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#0c1220] z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-base text-white tracking-tight leading-none font-display">
                  Cafe D Cruze <span className="text-indigo-400">Master</span>
                </h1>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
                  Super-Admin Console
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Badge */}
          <div className="mx-4 my-3 p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
              {admin?.name?.charAt(0).toUpperCase() || 'S'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{admin?.name || 'Super Admin'}</p>
              <span className="text-[10px] font-semibold text-indigo-400 block truncate">{admin?.email}</span>
            </div>
          </div>

          {/* Navigation Links Grouped by Section */}
          <nav className="px-3 space-y-4 mt-2 pb-4">
            {navSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                  {sec.title}
                </span>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 text-left cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20 font-bold'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Logout Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0c1220]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-bold text-xs text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>
    </>
  );
}
