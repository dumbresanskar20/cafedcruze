import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  TrendingUp,
  ShoppingBag,
  Utensils,
  DollarSign,
  Filter,
  Download,
  RefreshCw,
  Search,
  Package,
  Layers,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Award,
} from 'lucide-react';
import api from '../services/api';

const MEAL_BADGE_COLORS = {
  breakfast: 'bg-amber-100 text-amber-800 border-amber-200',
  lunch: 'bg-orange-100 text-orange-800 border-orange-200',
  snacks: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  dinner: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export default function MenuReportScreen() {
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly' | 'yearly'

  const todayStr = () => new Date().toISOString().split('T')[0];
  const currentMonthStr = () => new Date().toISOString().slice(0, 7);
  const currentYearStr = () => String(new Date().getFullYear());

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [searchItem, setSearchItem] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchReport();
  }, [period, selectedDate, selectedMonth, selectedYear]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = { period };
      if (period === 'daily' || period === 'weekly') params.date = selectedDate;
      if (period === 'monthly') params.month = selectedMonth;
      if (period === 'yearly') params.year = selectedYear;

      const res = await api.get('/admin/orders/menu-report', { params });
      if (res.data.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Error fetching menu report:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReport();
  };

  // Quick Preset Handlers
  const handleQuickDaily = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleQuickMonth = (offsetMonths = 0) => {
    const d = new Date();
    d.setMonth(d.getMonth() - offsetMonths);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  // Filtered menu items
  const filteredItems = (reportData?.menu_items || []).filter((item) => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchItem.toLowerCase());
    const matchesCat = filterCategory === 'all' || (item.meal_type || '').toLowerCase() === filterCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  // Export report summary to CSV
  const handleExportCSV = () => {
    if (!reportData || !reportData.menu_items) return;

    const headers = ['Item Name', 'Meal Category', 'Quantity Sold', 'Total Revenue (INR)', 'Orders Count', 'Share of Total Sales (%)', 'Current Stock'];
    const rows = reportData.menu_items.map((it) => [
      `"${it.item_name.replace(/"/g, '""')}"`,
      it.meal_type,
      it.quantity_sold,
      it.total_sales,
      it.orders_count,
      it.sales_share_pct,
      it.available_quantity,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Menu_Report_${period}_${selectedDate || selectedMonth || selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {/* 1. Header with Export & Refresh */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Menu Report
                </h1>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Sales &amp; Stock Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Analyze daily, weekly, monthly, and yearly sales volume, top recipes, and inventory consumption.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!reportData || reportData.menu_items?.length === 0}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Period Filter Selector Tabs & Date Input */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Period Toggle Tabs: Daily (Default) -> Weekly -> Monthly -> Yearly */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200/70 overflow-x-auto">
            {[
              { id: 'daily', label: 'Daily Report' },
              { id: 'weekly', label: 'Weekly Report' },
              { id: 'monthly', label: 'Monthly Report' },
              { id: 'yearly', label: 'Yearly Report' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  period === tab.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dynamic Filter Controls depending on selected period */}
          <div className="flex items-center gap-2 flex-wrap">
            {period === 'daily' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => handleQuickDaily(0)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDaily(1)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Yesterday
                </button>
              </div>
            )}

            {period === 'weekly' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Week ending on:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => handleQuickDaily(0)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  This Week
                </button>
              </div>
            )}

            {period === 'monthly' && (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => handleQuickMonth(0)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickMonth(1)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Last Month
                </button>
              </div>
            )}

            {period === 'yearly' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {reportData?.period_title && (
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50/70 border border-indigo-100 px-3.5 py-2 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Viewing: {reportData.period_title}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-24 text-slate-400 font-bold flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Compiling {period} sales &amp; inventory report...</span>
        </div>
      ) : (
        <>
          {/* 3. High-Level Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Total Sales Revenue</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  ₹
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{Number(reportData?.summary?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] font-semibold text-slate-400">
                Gross: ₹{Number(reportData?.summary?.subtotal_revenue || 0).toFixed(2)}
              </p>
            </div>

            {/* Total Orders */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Completed Orders</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {reportData?.summary?.total_orders || 0}
              </div>
              <p className="text-[11px] font-semibold text-slate-400">
                Fulfilled digital &amp; manual tokens
              </p>
            </div>

            {/* Total Portions Sold */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Total Portions Sold</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {reportData?.summary?.total_items_sold || 0}
              </div>
              <p className="text-[11px] font-semibold text-slate-400">
                Portions served to students
              </p>
            </div>

            {/* Average Order Value & Discount */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Avg Order Value (AOV)</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{Number(reportData?.summary?.avg_order_value || 0).toFixed(2)}
              </div>
              <p className="text-[11px] font-semibold text-emerald-600">
                Discounts given: ₹{Number(reportData?.summary?.total_discounts || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* 4. Meal Categories Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['breakfast', 'lunch', 'snacks', 'dinner'].map((cat) => {
              const catData = (reportData?.categories || []).find((c) => c.meal_type === cat) || {
                orders_count: 0,
                revenue: 0,
                items_sold: 0,
              };
              const badgeStyle = MEAL_BADGE_COLORS[cat] || 'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <div key={cat} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase border ${badgeStyle}`}>
                      {cat}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {catData.orders_count} orders
                    </span>
                  </div>

                  <div>
                    <div className="text-xl font-black text-slate-900">
                      ₹{Number(catData.revenue).toFixed(2)}
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                      {catData.items_sold} portions sold
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Menu Items Performance Table */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Item-by-Item Sales Performance
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Breakdown of portions ordered, generated sales, and current portion inventory.
                </p>
              </div>

              {/* Search & Category Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search menu item..."
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="snacks">Snacks</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl text-slate-400">
                <Utensils className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No menu sales recorded for this period &amp; filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Menu Item</th>
                      <th className="py-3 px-3">Meal Category</th>
                      <th className="py-3 px-3 text-right">Portions Sold</th>
                      <th className="py-3 px-3 text-right">Total Revenue</th>
                      <th className="py-3 px-3 text-right">Share of Sales</th>
                      <th className="py-3 px-3 text-right">Remaining Stock</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {filteredItems.map((item, idx) => {
                      const badgeStyle = MEAL_BADGE_COLORS[(item.meal_type || '').toLowerCase()] || 'bg-slate-100 text-slate-700';

                      return (
                        <tr key={item.menu_item_id || item.item_name} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 font-extrabold text-slate-900">
                            {item.item_name}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${badgeStyle}`}>
                              {item.meal_type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                            {item.quantity_sold}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-emerald-700 text-sm">
                            ₹{Number(item.total_sales).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="bg-indigo-600 h-full rounded-full"
                                  style={{ width: `${Math.min(100, item.sales_share_pct || 0)}%` }}
                                />
                              </div>
                              <span className="font-extrabold text-slate-700 text-xs">
                                {item.sales_share_pct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-800">
                            {item.available_quantity !== undefined ? item.available_quantity : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.available_quantity <= 0 || item.is_available === false ? (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                                Out of Stock
                              </span>
                            ) : item.available_quantity <= 5 ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                                Low ({item.available_quantity})
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                                In Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 6. Raw Inventory Deductions Log during this period */}
          {reportData?.inventory_logs && reportData.inventory_logs.length > 0 && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Raw Inventory Consumption ({reportData.period_title})
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Ingredient usage automatically deducted by prepared student orders during this selected timeframe.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {reportData.inventory_logs.map((log) => (
                  <div key={log.item_name} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900">{log.item_name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{log.unit}</span>
                    </div>
                    <div className="text-sm font-black text-rose-700">
                      -{Number(log.total_deducted).toFixed(2)} {log.unit}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      Current Stock: {Number(log.current_stock).toFixed(2)} {log.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
