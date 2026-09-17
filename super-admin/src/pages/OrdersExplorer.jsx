import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Filter, RefreshCw, Calendar, 
  CreditCard, CheckCircle2, Clock, AlertTriangle, Eye, ArrowRight
} from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';

export default function OrdersExplorer() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mealFilter, setMealFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [mealFilter, statusFilter, paymentFilter, page]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/data/orders?meal_type=${mealFilter}&status=${statusFilter}&payment_method=${paymentFilter}&search=${encodeURIComponent(search)}&page=${page}&limit=25`
      );
      if (res.data.success) {
        setOrders(res.data.orders || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalOrders(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const getStatusBadge = (status) => {
    if (status === 'collected') {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Collected</span>;
    }
    if (status === 'booked') {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">Booked (Live)</span>;
    }
    if (status === 'cancelled') {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">Cancelled</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">Expired</span>;
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-indigo-400" />
            <span>Orders & Sales Database</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Live database view of all student meal bookings, kitchen tokens, payment methods, and revenue
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search token (e.g. B-001) or student..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Meal filter */}
          <select
            value={mealFilter}
            onChange={(e) => {
              setMealFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          >
            <option value="">All Meal Types</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="snacks">Snacks</option>
            <option value="dinner">Dinner</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="booked">Booked</option>
            <option value="collected">Collected</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>

          {/* Payment filter */}
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          >
            <option value="">All Payments</option>
            <option value="cash">Cash on Counter</option>
            <option value="online">Online Payment</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
          <span>Querying orders from database...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center bg-[#0f172a] rounded-3xl border border-slate-800 text-slate-400 text-xs font-medium space-y-3">
          <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
          <p>No orders found matching your search filter.</p>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                  <th className="p-4">Token & Meal</th>
                  <th className="p-4">Student Name & Roll No</th>
                  <th className="p-4">Amount & Payment</th>
                  <th className="p-4">Order Status</th>
                  <th className="p-4">Created At</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {orders.map((o) => {
                  let items = [];
                  try {
                    items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
                  } catch (e) {
                    items = [];
                  }

                  return (
                    <tr key={o.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-xl bg-indigo-600/20 text-indigo-300 font-mono font-black text-xs border border-indigo-500/30">
                            {o.formatted_token}
                          </span>
                          <span className="capitalize font-bold text-slate-300 text-xs">
                            {o.meal_type}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-white">{o.student_name || 'Student User'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">Roll: {o.student_roll_no || '—'}</div>
                      </td>

                      <td className="p-4">
                        <span className="font-extrabold text-white text-sm block">
                          ₹{Number(o.total_amount).toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400 capitalize">
                          {o.payment_method} {o.is_paid ? '• Paid' : '• Unpaid'}
                        </span>
                      </td>

                      <td className="p-4">
                        {getStatusBadge(o.status)}
                      </td>

                      <td className="p-4 text-slate-400 text-[11px] font-mono">
                        {new Date(o.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedOrder({ ...o, parsedItems: items })}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 hover:text-white text-slate-300 font-bold rounded-xl border border-slate-800 transition-colors cursor-pointer text-[11px] inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Items</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {orders.length} of {totalOrders} orders (Page {page} of {totalPages})
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white rounded-xl border border-slate-800 font-bold cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white rounded-xl border border-slate-800 font-bold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER ITEMS MODAL */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Order Token: ${selectedOrder.formatted_token}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Student</span>
                <span className="font-bold text-white">{selectedOrder.student_name}</span> ({selectedOrder.student_roll_no})
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Meal Window</span>
                <span className="capitalize font-bold text-indigo-400">{selectedOrder.meal_type}</span>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dishes Ordered</span>
              <div className="divide-y divide-slate-800 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                {selectedOrder.parsedItems?.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 font-bold text-center leading-5 text-[11px]">
                        {it.quantity}x
                      </span>
                      <span className="font-bold text-white">{it.name}</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      ₹{(Number(it.price) * Number(it.quantity)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="font-bold text-slate-400">Total Order Amount</span>
              <span className="text-base font-black text-white font-mono">
                ₹{Number(selectedOrder.total_amount).toFixed(2)}
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
