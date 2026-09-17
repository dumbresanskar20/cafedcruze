import React, { useState, useEffect } from 'react';
import { 
  History, Filter, RefreshCw, Calendar, ChevronLeft, ChevronRight, 
  CreditCard, Banknote, QrCode, Receipt, AlertCircle, TrendingUp, 
  TrendingDown, Minus, CalendarDays, CheckCircle2, BarChart3, 
  ArrowUpRight, ArrowDownRight, Sparkles, X, ArrowUpDown, Package
} from 'lucide-react';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function OrderHistoryScreen() {
  const { isSuperAdmin } = useAdminAuth();

  const [orders, setOrders] = useState([]);
  const [incomeSummary, setIncomeSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Monthly Analytics State
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);

  // Filter States
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mealType, setMealType] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [orderType, setOrderType] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch monthly analytics (Grid System & Growth)
  const fetchMonthlyAnalytics = async () => {
    setMonthlyLoading(true);
    try {
      const res = await api.get('/orders/admin/orders/monthly-analytics');
      if (res.data.success) {
        setMonthlyStats(res.data);
      }
    } catch (err) {
      console.error('Error loading monthly order analytics:', err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  // Fetch paginated order list
  const fetchOrderHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from && from.trim() && from.trim() !== 'dd-mm-yyyy') {
        params.append('from', from.trim());
      }
      if (to && to.trim() && to.trim() !== 'dd-mm-yyyy') {
        params.append('to', to.trim());
      }
      if (mealType && mealType.trim() && mealType.toLowerCase() !== 'all') {
        params.append('meal_type', mealType.trim());
      }
      if (orderStatus && orderStatus.trim() && orderStatus.toLowerCase() !== 'all') {
        params.append('order_status', orderStatus.trim());
      }
      if (orderType && orderType.trim() && orderType.toLowerCase() !== 'all') {
        params.append('order_type', orderType.trim());
      }
      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);
      params.append('page', page);
      params.append('limit', limit);

      const res = await api.get(`/orders/admin/orders/history?${params.toString()}`);
      if (res.data.success) {
        setOrders(res.data.orders || []);
        setTotalPages(res.data.total_pages || 1);
        setTotalCount(res.data.total_count || 0);
        if (res.data.income_summary) {
          setIncomeSummary(res.data.income_summary);
        } else {
          setIncomeSummary(null);
        }
        setError(null);
      }
    } catch (err) {
      console.error('Error loading order history:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error loading order history.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyAnalytics();
  }, []);

  useEffect(() => {
    fetchOrderHistory();
  }, [page, from, to, mealType, orderStatus, orderType, sortBy, sortOrder]);

  const handleRefreshAll = () => {
    fetchMonthlyAnalytics();
    fetchOrderHistory();
  };

  // Clicking a month card filters the table to that month
  const handleSelectMonth = (monthKey) => {
    if (!monthKey || typeof monthKey !== 'string') return;
    if (selectedMonthKey === monthKey) {
      // Deselect and reset filter
      setSelectedMonthKey(null);
      setFrom('');
      setTo('');
      setPage(1);
      return;
    }

    setSelectedMonthKey(monthKey);
    const parts = monthKey.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const [year, month] = parts;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      setFrom(startDate);
      setTo(endDate);
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedMonthKey(null);
    setFrom('');
    setTo('');
    setMealType('');
    setOrderStatus('');
    setOrderType('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  };

  const formatPaymentMethod = (method) => {
    switch (method) {
      case 'razorpay':
        return { label: 'Razorpay (Online)', icon: CreditCard, color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'counter_cash':
        return { label: 'Counter Cash', icon: Banknote, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'counter_upi':
        return { label: 'Counter UPI', icon: QrCode, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      default:
        return { label: method || 'N/A', icon: Receipt, color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg shadow-sm">📜</span>
            <span>Order History & Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Monthly order trends, comparison insights, and complete order transaction log
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefreshAll}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh All Records & Monthly Stats"
          >
            <RefreshCw className={`w-4 h-4 ${loading || monthlyLoading ? 'animate-spin' : ''}`} />
          </button>
          <span className="bg-slate-100 text-slate-800 font-extrabold text-xs px-3.5 py-2 rounded-2xl border border-slate-200">
            {totalCount} Logged Orders
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MONTHLY ORDERS GRID SYSTEM & CURRENT MONTH GROWTH ANALYSIS      */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        
        {/* Current Month Growth Analysis Hero Banner */}
        {monthlyStats?.analysis && (
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-5 sm:p-6 rounded-3xl border border-slate-700 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
              
              {/* Left: Summary Title & Analysis Message */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Current Month Growth Analysis
                  </span>
                  {selectedMonthKey && (
                    <span className="text-[11px] font-bold text-slate-400">
                      (Filtered by Month)
                    </span>
                  )}
                </div>
                
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {monthlyStats.months?.[0]?.month_name || 'Current Month'} Performance
                </h3>
                
                <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl leading-relaxed">
                  {monthlyStats.analysis.message}
                </p>
              </div>

              {/* Right: Trend Comparison Pill & Volume */}
              <div className="flex items-center gap-3 shrink-0">
                {monthlyStats.analysis.trend === 'increased' ? (
                  <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                        Orders Increased
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-white">
                        +{monthlyStats.analysis.growth_percentage}%
                      </span>
                    </div>
                  </div>
                ) : monthlyStats.analysis.trend === 'decreased' ? (
                  <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 px-4 py-3 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 block">
                        Orders Decreased
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-white">
                        -{monthlyStats.analysis.growth_percentage}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-700/50 border border-slate-600 text-slate-200 px-4 py-3 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-600 text-slate-300 flex items-center justify-center shrink-0">
                      <Minus className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Comparison Trend
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-white">
                        0.0%
                      </span>
                    </div>
                  </div>
                )}

                {/* Orders Volume Snapshot */}
                <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-2xl text-center min-w-[100px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    This Month
                  </span>
                  <span className="text-lg font-black text-white">
                    {monthlyStats.analysis.current_orders}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    orders placed
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Monthly Breakdown Grid Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-700" />
            <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Monthly Orders Breakdown
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">
              (Click any month card to filter orders below)
            </span>
          </div>

          {selectedMonthKey && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 transition-colors cursor-pointer"
            >
              <span>Clear Month Filter ({selectedMonthKey})</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Monthly Grid Cards System */}
        {monthlyLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 bg-white rounded-3xl border border-slate-200 animate-pulse p-5" />
            ))}
          </div>
        ) : !monthlyStats?.months || monthlyStats.months.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs font-medium">
            No monthly order records found yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {monthlyStats.months.map((m) => {
              const isSelected = selectedMonthKey === m.month_key;
              const isCurrent = m.is_current_month;
              const mom = m.mom_comparison || {};
              const deliveredPct = m.total_orders > 0 ? Math.round((m.delivered_orders / m.total_orders) * 100) : 0;

              return (
                <div
                  key={m.month_key}
                  onClick={() => handleSelectMonth(m.month_key)}
                  className={`relative bg-white rounded-3xl p-5 border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md bg-amber-50/20'
                      : isCurrent
                      ? 'border-slate-300 shadow-sm hover:border-slate-400 hover:shadow-md'
                      : 'border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Top Badge & Relative Time */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        isCurrent
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {m.relative_label}
                    </span>

                    {/* Month-over-Month Comparison Tag */}
                    {mom.trend === 'increased' ? (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                        <span>+{mom.growth_percentage}%</span>
                      </span>
                    ) : mom.trend === 'decreased' ? (
                      <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <ArrowDownRight className="w-3 h-3 text-rose-600" />
                        <span>-{mom.growth_percentage}%</span>
                      </span>
                    ) : mom.trend === 'neutral' ? (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        0.0%
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                        First Record
                      </span>
                    )}
                  </div>

                  {/* Month Name & Total Orders */}
                  <div>
                    <h5 className="text-base font-black text-slate-900 tracking-tight">
                      {m.month_name}
                    </h5>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">
                        {m.total_orders}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        orders
                      </span>
                    </div>
                  </div>

                  {/* Delivery Rate & Super Admin Revenue */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>Delivered:</span>
                      <span className="font-bold text-slate-800">
                        {m.delivered_orders} ({deliveredPct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${deliveredPct}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>

                    {/* Super Admin Revenue */}
                    {isSuperAdmin && typeof m.total_revenue !== 'undefined' && (
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-1">
                        <span>Revenue:</span>
                        <span className="font-black text-emerald-700">
                          ₹{m.total_revenue.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Interactive Filter Footer */}
                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    <span className={`font-bold ${isSelected ? 'text-amber-700' : 'text-slate-400'}`}>
                      {isSelected ? '✓ Filter Applied' : 'Tap to filter'}
                    </span>
                    {mom.orders_diff !== 0 && mom.prev_month_name && (
                      <span className="text-[10px] text-slate-400 font-medium truncate">
                        {mom.orders_diff > 0 ? `+${mom.orders_diff}` : mom.orders_diff} vs {mom.prev_month_name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: SUPER ADMIN INCOME BREAKDOWN (WHEN FILTERED / AGGREGATED)       */}
      {/* ========================================================================= */}
      {isSuperAdmin && incomeSummary && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-5 border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                Super Admin Financial Analytics
              </span>
              <h3 className="text-3xl font-black tracking-tight text-white mt-0.5">
                ₹{incomeSummary.total_income.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Filtered Income Total ({incomeSummary.total_paid_orders} paid orders)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                Live Aggregation
              </span>
            </div>
          </div>

          {/* Breakdown Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Razorpay Online */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Razorpay (Online)</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.razorpay?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.razorpay?.count || 0} orders)</span>
              </div>
            </div>

            {/* Counter Cash */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Counter Cash</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.counter_cash?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.counter_cash?.count || 0} orders)</span>
              </div>
            </div>

            {/* Counter UPI */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Counter UPI</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.counter_upi?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.counter_upi?.count || 0} orders)</span>
              </div>
            </div>

            {/* Other */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Other</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.other?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.other?.count || 0} orders)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: FILTER CONTROLS TOOLBAR                                        */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filter Order History Records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Date From */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setSelectedMonthKey(null); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setSelectedMonthKey(null); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          {/* Meal Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Meal Category</label>
            <select
              value={mealType}
              onChange={(e) => { setMealType(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none capitalize"
            >
              <option value="">All Categories</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="snacks">Snacks</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>

          {/* Dining Option (Dine In vs Parcel) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dining Option</label>
            <select
              value={orderType}
              onChange={(e) => { setOrderType(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
            >
              <option value="">All (Dine In & Parcel)</option>
              <option value="dine_in">🍽️ Dine In</option>
              <option value="parcel">📦 Parcel (Takeaway)</option>
            </select>
          </div>

          {/* Order Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Order Status</label>
            <select
              value={orderStatus}
              onChange={(e) => { setOrderStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none capitalize"
            >
              <option value="">All Statuses</option>
              <option value="placed">Placed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sort Orders</label>
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':');
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
            >
              <option value="created_at:desc">🕒 Newest First</option>
              <option value="created_at:asc">🕒 Oldest First</option>
              <option value="total_amount:desc">💰 Highest Amount</option>
              <option value="total_amount:asc">💰 Lowest Amount</option>
              <option value="token_number:asc">🔢 Token # (Ascending)</option>
              <option value="token_number:desc">🔢 Token # (Descending)</option>
            </select>
          </div>
        </div>

        {(from || to || mealType || orderStatus || orderType || sortBy !== 'created_at' || sortOrder !== 'desc' || selectedMonthKey) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: ORDERS TRANSACTION TABLE WITH PAGINATION                       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
            Fetching order history records...
          </div>
        ) : error ? (
          <div className="p-14 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-2xl mx-auto border border-rose-200">
              ⚠️
            </div>
            <h4 className="text-slate-800 font-bold text-base">Unable to load order history</h4>
            <p className="text-rose-600 text-xs max-w-md mx-auto font-medium">
              {error}
            </p>
            <button
              onClick={fetchOrderHistory}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
              📂
            </div>
            <h4 className="text-slate-800 font-bold text-base">No order records match your criteria</h4>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Try selecting a different month card above or adjusting your filter dates.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Token #</th>
                  <th className="py-3.5 px-4">Dining</th>
                  <th className="py-3.5 px-4">Student Info</th>
                  <th className="py-3.5 px-4">Meal Type</th>
                  <th className="py-3.5 px-4">Items Ordered</th>
                  <th className="py-3.5 px-4">Order Status</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  {isSuperAdmin && <th className="py-3.5 px-4 text-right">Total Amount</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {orders.map((ord) => {
                  const studentName = ord.student?.name || ord.student_id?.name || ord.student_name || 'Student';
                  const rollNo = ord.student?.roll_no || ord.student_id?.roll_no || ord.student_roll_no || '';
                  const pmInfo = formatPaymentMethod(ord.payment_method);
                  const PmIcon = pmInfo.icon;

                  return (
                    <tr key={ord._id || ord.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        <div className="font-bold text-slate-900">
                          {new Date(ord.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div>
                          {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Token # */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-sm font-black bg-amber-100 text-amber-900 px-2.5 py-1 rounded-xl border border-amber-300">
                          #{ord.token_number}
                        </span>
                      </td>

                      {/* Dining Option */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {Boolean(ord.is_parcel || ord.order_type === 'parcel') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-orange-100 text-orange-800 border border-orange-200">
                            📦 Parcel
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                            🍽️ Dine In
                          </span>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{studentName}</div>
                        {rollNo && <div className="text-[10px] text-slate-400 font-semibold">{rollNo}</div>}
                        {ord.student?.email && <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{ord.student.email}</div>}
                      </td>

                      {/* Meal Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="capitalize text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {ord.meal_type}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-0.5">
                          {(ord.items || []).map((it, idx) => (
                            <div key={idx} className="text-[11px] text-slate-700 truncate font-semibold">
                              <span className="text-amber-700 font-bold">{it.quantity}x</span> {it.item_name}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Order Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                            ord.order_status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.order_status === 'ready'
                              ? 'bg-amber-100 text-amber-800'
                              : ord.order_status === 'preparing'
                              ? 'bg-blue-100 text-blue-800'
                              : ord.order_status === 'expired'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {ord.order_status}
                        </span>
                      </td>

                      {/* Payment Method & Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${pmInfo.color}`}>
                            <PmIcon className="w-3 h-3 shrink-0" />
                            <span>{pmInfo.label}</span>
                          </span>
                        </div>
                      </td>

                      {/* Total Amount (Super Admin Only) */}
                      {isSuperAdmin && (
                        <td className="py-3.5 px-4 whitespace-nowrap text-right font-black text-slate-900 text-sm">
                          ₹{Number(ord.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-xs text-slate-500 font-semibold">
              Showing Page <span className="font-bold text-slate-800">{page}</span> of{' '}
              <span className="font-bold text-slate-800">{totalPages}</span> ({totalCount} total orders)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
