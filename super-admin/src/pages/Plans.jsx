import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Plus, Edit2, History, IndianRupee, 
  CheckCircle2, Clock, Layers, ArrowRight, RefreshCw,
  Sparkles, Check, AlertCircle, TrendingUp, Trash2
} from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState([]);
  const [selectedPlanForHistory, setSelectedPlanForHistory] = useState(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetPlanForDelete, setTargetPlanForDelete] = useState(null);

  // Forms
  const [targetPlan, setTargetPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    code: '',
    billing_cycle: 'monthly',
    price: '',
    trial_days: 14,
    features: '',
  });

  const [priceForm, setPriceForm] = useState({
    new_price: '',
    reason: '',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/plans');
      if (res.data.success) {
        setPlans(res.data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const openPriceHistory = async (plan) => {
    setSelectedPlanForHistory(plan);
    try {
      const res = await api.get(`/plans/${plan.id}/price-history`);
      if (res.data.success) {
        setPriceHistory(res.data.history || []);
        setHistoryModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch price history:', err);
    }
  };

  const handleCreatePlanSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    try {
      const featuresArray = planForm.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const res = await api.post('/plans', {
        ...planForm,
        price: parseFloat(planForm.price),
        features: featuresArray,
      });

      if (res.data.success) {
        setCreateModalOpen(false);
        setPlanForm({ name: '', code: '', billing_cycle: 'monthly', price: '', trial_days: 14, features: '' });
        fetchPlans();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditPlanSubmit = async (e) => {
    e.preventDefault();
    if (!targetPlan) return;
    setActionLoading(true);
    setErrorMsg('');

    try {
      const featuresArray = planForm.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const res = await api.put(`/plans/${targetPlan.id}`, {
        name: planForm.name,
        billing_cycle: planForm.billing_cycle,
        trial_days: parseInt(planForm.trial_days, 10),
        features: featuresArray,
      });

      if (res.data.success) {
        setEditModalOpen(false);
        fetchPlans();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePriceSubmit = async (e) => {
    e.preventDefault();
    if (!targetPlan) return;
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post(`/plans/${targetPlan.id}/change-price`, {
        new_price: parseFloat(priceForm.new_price),
        reason: priceForm.reason,
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message || 'Price updated successfully.');
        setPriceModalOpen(false);
        setPriceForm({ new_price: '', reason: '' });
        fetchPlans();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update plan price.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePlanSubmit = async (e) => {
    e.preventDefault();
    if (!targetPlanForDelete) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.delete(`/plans/${targetPlanForDelete.id}`);
      if (res.data.success) {
        setSuccessMsg(res.data.message || `Plan '${targetPlanForDelete.name}' deleted successfully.`);
        setDeleteModalOpen(false);
        setTargetPlanForDelete(null);
        fetchPlans();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete plan.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-emerald-300 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white text-xs font-bold">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between gap-3 text-red-300 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white text-xs font-bold">Dismiss</button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
            Subscription Plans & Pricing Control
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Define client pricing tiers, billing cycles, and maintain an immutable price change audit trail
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setPlanForm({ name: '', code: '', billing_cycle: 'monthly', price: '', trial_days: 14, features: '' });
            setCreateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
          <span>Loading plans catalog...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => {
            const features = Array.isArray(p.features) ? p.features : [];
            return (
              <div
                key={p.id}
                className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all relative group"
              >
                <div className="space-y-4">
                  {/* Top bar */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold uppercase rounded-lg">
                      {p.code}
                    </span>

                    <span className="text-[11px] text-slate-400 font-bold bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">
                      {p.subscriber_count || 0} {p.subscriber_count === 1 ? 'Client' : 'Clients'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-white font-display">{p.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-black text-white font-display">
                        ₹{Number(p.price).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">/{p.billing_cycle}</span>
                    </div>
                  </div>

                  {/* Free Trial Badge */}
                  <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-[11px] text-sky-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Includes {p.trial_days}-Day Free Evaluation Trial</span>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Plan Features</span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center gap-2 text-xs font-bold">
                  <button
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      setTargetPlan(p);
                      setPriceForm({ new_price: p.price, reason: '' });
                      setPriceModalOpen(true);
                    }}
                    className="flex-1 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    title="Adjust Plan Price"
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>Change Price</span>
                  </button>

                  <button
                    onClick={() => openPriceHistory(p)}
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                    title="View Price Change Audit History"
                  >
                    <History className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      setTargetPlanForDelete(p);
                      setDeleteModalOpen(true);
                    }}
                    className="p-2.5 bg-red-600/15 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                    title="Delete Plan"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          CREATE NEW PLAN MODAL
          ========================================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Subscription Plan"
      >
        <form onSubmit={handleCreatePlanSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-300 mb-1">Plan Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Enterprise Tier"
              value={planForm.name}
              onChange={(e) => {
                const name = e.target.value;
                const code = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                setPlanForm({ ...planForm, name, code: planForm.code || code });
              }}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Plan Code (Unique ID) *</label>
              <input
                type="text"
                required
                placeholder="e.g. enterprise_custom"
                value={planForm.code}
                onChange={(e) => setPlanForm({ ...planForm, code: e.target.value.toLowerCase() })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Billing Cycle</label>
              <select
                value={planForm.billing_cycle}
                onChange={(e) => setPlanForm({ ...planForm, billing_cycle: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="six_month">Half-Yearly (6 Mo)</option>
                <option value="yearly">Annual (Yearly)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Subscription Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="1000.00"
                value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Included Free Trial Days</label>
              <input
                type="number"
                min="0"
                value={planForm.trial_days}
                onChange={(e) => setPlanForm({ ...planForm, trial_days: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Plan Features (One per line)</label>
            <textarea
              rows={4}
              placeholder="Unlimited student meal bookings&#10;Live Kitchen Display&#10;Inventory tracking..."
              value={planForm.features}
              onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-mono text-[11px]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {actionLoading ? 'Creating...' : 'Publish Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          CHANGE PLAN PRICE MODAL (With Audit Reason)
          ========================================================================= */}
      <Modal
        isOpen={priceModalOpen}
        onClose={() => setPriceModalOpen(false)}
        title={`Adjust Price: ${targetPlan?.name}`}
      >
        <form onSubmit={handleChangePriceSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Current Registered Price</span>
              <span className="text-xl font-extrabold text-white">₹{targetPlan?.price}</span>
            </div>
            <TrendingUp className="w-6 h-6 text-purple-400" />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">New Plan Price (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 1200.00"
              value={priceForm.new_price}
              onChange={(e) => setPriceForm({ ...priceForm, new_price: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reason for Price Adjustment (Audit Trail) *</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Annual inflation adjustment; added multi-counter kitchen features..."
              value={priceForm.reason}
              onChange={(e) => setPriceForm({ ...priceForm, reason: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            ⚠️ Every price adjustment creates an immutable audit log entry in `PlanPriceHistory` recording the old price, new price, your Super-Admin account, and timestamp.
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPriceModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {actionLoading ? 'Saving...' : 'Confirm Price Change'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          PRICE CHANGE AUDIT HISTORY TIMELINE MODAL
          ========================================================================= */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Price History: ${selectedPlanForHistory?.name}`}
      >
        <div className="space-y-4 text-xs">
          {priceHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No historical price modifications on record for this plan.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 space-y-3">
              {priceHistory.map((h) => (
                <div key={h.id} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 line-through">₹{h.old_price}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="font-extrabold text-emerald-400 text-sm">₹{h.new_price}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(h.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] font-medium italic">
                    "{h.reason || 'Price updated'}"
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Changed by {h.changed_by_name || 'Super Admin'}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => setHistoryModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          DELETE PLAN CONFIRMATION MODAL
          ========================================================================= */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={`Delete Plan: ${targetPlanForDelete?.name}`}
      >
        <form onSubmit={handleDeletePlanSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Permanent Plan Deletion</p>
              <p className="mt-1 leading-relaxed text-red-300">
                Deleting <strong>"{targetPlanForDelete?.name}"</strong> (₹{Number(targetPlanForDelete?.price || 0).toLocaleString('en-IN')}) will permanently remove it from the database.
              </p>
              <p className="mt-2 text-slate-300">
                This plan will <strong>instantly disappear</strong> from the Canteen Admin application's renewal screen in real-time.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{actionLoading ? 'Deleting...' : 'Confirm Delete Plan'}</span>
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
