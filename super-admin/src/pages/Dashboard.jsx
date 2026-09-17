import React, { useState, useEffect } from 'react';
import { 
  Building2, CheckCircle2, Clock, Ban, AlertTriangle, 
  IndianRupee, ArrowUpRight, ShieldAlert, ShoppingBag, Users, 
  Utensils, Boxes, UserCog, RefreshCw, Sparkles, Calendar, Key
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard({ setActiveTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/metrics');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 sm:p-10 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Connecting to Cafe D Cruze Restaurant database...</p>
      </div>
    );
  }

  const canteen = data?.canteen || {};
  const stats = data?.stats || {};
  const recentOrders = data?.recentOrders || [];
  const recentLogs = data?.recentLogs || [];

  const kpis = [
    {
      label: 'Total Canteen Revenue',
      value: `₹${Number(stats.totalRevenue || 0).toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      linkTab: 'orders',
      sublabel: 'All-time meal booking sales',
    },
    {
      label: 'Total Orders Processed',
      value: Number(stats.totalOrders || 0).toLocaleString('en-IN'),
      icon: ShoppingBag,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      linkTab: 'orders',
      sublabel: 'Tokens generated for kitchen',
    },
    {
      label: 'Registered Students',
      value: Number(stats.totalStudents || 0).toLocaleString('en-IN'),
      icon: Users,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
      linkTab: 'students',
      sublabel: 'Verified campus accounts',
    },
    {
      label: 'Menu Dishes Active',
      value: `${stats.activeMenuItems || 0} / ${stats.totalMenuItems || 0}`,
      icon: Utensils,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      linkTab: 'menu',
      sublabel: 'Available meal windows',
    },
    {
      label: 'Inventory Stock Items',
      value: `${stats.totalInventory || 0} Items`,
      icon: Boxes,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      linkTab: 'inventory',
      sublabel: stats.lowStockCount > 0 ? `⚠️ ${stats.lowStockCount} Low stock alerts` : 'All ingredients in healthy stock',
    },
    {
      label: 'Staff & Kitchen Crew',
      value: `${stats.totalStaff || 0} Accounts`,
      icon: UserCog,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      linkTab: 'staff',
      sublabel: 'Admin and kitchen operators',
    },
  ];

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Top Banner: Cafe D Cruze Restaurant Status Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/70 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cafe D Cruze Restaurant</span>
            </span>
            <StatusBadge status={canteen.status} size="lg" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight">
            Cafe D Cruze Restaurant Operations & Database
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
            <span>
              Plan: <strong className="text-white">{canteen.plan_name || 'Standard Monthly'}</strong>
            </span>
            <span>•</span>
            <span>
              Price: <strong className="text-purple-400">₹{Number(canteen.subscription_price || canteen.plan_default_price || 0).toLocaleString('en-IN')}/mo</strong>
            </span>
            <span>•</span>
            <span>
              Validity: <strong className={canteen.days_remaining <= 5 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{canteen.days_remaining} Days Remaining</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab('canteen_control')}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Manage Access & Plan</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-indigo-400" />
            <span>View All Orders</span>
          </button>
        </div>
      </div>

      {/* Database KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div
              key={i}
              onClick={() => setActiveTab(k.linkTab)}
              className="bg-[#0f172a] rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-lg space-y-4 hover:border-slate-700 hover:bg-slate-900/80 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl ${k.bg} ${k.color} border flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-400 flex items-center gap-1 transition-colors">
                  <span>Explore Data</span>
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400">{k.label}</p>
                <h3 className="text-2xl sm:text-3xl font-black text-white font-display mt-0.5 tracking-tight">
                  {k.value}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-1">{k.sublabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Split View: Recent Live Orders & Recent Super-Admin Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Live Orders */}
        <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Recent Canteen Orders</h2>
                <p className="text-[11px] text-slate-400">Live order flow from student meal portal</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('orders')}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No orders recorded in database yet.</div>
          ) : (
            <div className="divide-y divide-slate-800 font-medium">
              {recentOrders.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30 shrink-0">
                      {o.formatted_token}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white font-bold truncate">{o.student_name || 'Student'}</p>
                      <p className="text-[10px] text-slate-400 capitalize">
                        {o.meal_type} • {o.payment_method}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-extrabold text-white text-xs block">
                      ₹{Number(o.total_amount).toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-bold uppercase ${
                      o.status === 'collected' ? 'text-emerald-400' : o.status === 'booked' ? 'text-indigo-400' : 'text-slate-400'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Super-Admin Audit Log */}
        <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Super-Admin Audit Log</h2>
                <p className="text-[11px] text-slate-400">Security and configuration modifications</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('audit')}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No recent audit log entries.</div>
          ) : (
            <div className="divide-y divide-slate-800 font-medium">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[10px] font-bold uppercase border border-slate-700">
                      {log.action}
                    </span>
                    <p className="text-[11px] text-slate-300 font-medium mt-1 truncate">
                      By {log.actor_name}
                    </p>
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono shrink-0">
                    {new Date(log.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
