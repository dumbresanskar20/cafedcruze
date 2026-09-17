import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldAlert, CheckCircle2, Clock, Ban, 
  AlertTriangle, IndianRupee, Layers, Save, RefreshCw, 
  Check, Calendar, ShieldCheck, FileText, ToggleLeft, ToggleRight,
  Trash2, CalendarPlus
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function CanteenControl() {
  const [canteen, setCanteen] = useState(null);
  const [plans, setPlans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [extendTrialModalOpen, setExtendTrialModalOpen] = useState(false);
  const [changeSubModalOpen, setChangeSubModalOpen] = useState(false);
  const [suspendConfirmModalOpen, setSuspendConfirmModalOpen] = useState(false);
  const [manualDaysModalOpen, setManualDaysModalOpen] = useState(false);
  const [deleteSubModalOpen, setDeleteSubModalOpen] = useState(false);

  // Forms
  const [trialExtendForm, setTrialExtendForm] = useState({ days: 14, reason: '' });
  const [subForm, setSubForm] = useState({ plan_id: '', custom_price: '', duration_days: 30, reason: '' });
  const [manualDaysForm, setManualDaysForm] = useState({ days: 30, reason: '' });
  const [deleteSubReason, setDeleteSubReason] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  // Alerts
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchCanteenData();
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await api.get('/plans');
      if (res.data.success) {
        setPlans(res.data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  };

  const fetchCanteenData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/canteen');
      if (res.data.success) {
        setCanteen(res.data.canteen);
        setNotesDraft(res.data.canteen?.notes || '');
        setAuditLogs(res.data.auditLogs || []);
      }
    } catch (err) {
      console.error('Failed to fetch canteen data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Master Cascading Status Change (Suspend / Unsuspend / Expire)
  const handleStatusChange = async (targetStatus, reason = '') => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/canteen/status', {
        status: targetStatus,
        reason: reason || `Status changed to ${targetStatus} by Super-Admin`,
      });
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setSuspendConfirmModalOpen(false);
        fetchCanteenData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update canteen status.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Toggle Panel Access Privileges
  const handleTogglePanel = async (type) => {
    if (!canteen) return;
    setActionLoading(true);
    setErrorMsg('');

    const newAdmin = type === 'admin' ? !canteen.is_admin_enabled : canteen.is_admin_enabled;
    const newStudent = type === 'student' ? !canteen.is_student_enabled : canteen.is_student_enabled;

    try {
      const res = await api.post('/canteen/toggle-access', {
        is_admin_enabled: newAdmin,
        is_student_enabled: newStudent,
      });
      if (res.data.success) {
        setCanteen({
          ...canteen,
          is_admin_enabled: res.data.is_admin_enabled,
          is_student_enabled: res.data.is_student_enabled,
        });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to toggle access.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Extend Trial Handler
  const handleExtendTrialSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/canteen/extend-trial', trialExtendForm);
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setExtendTrialModalOpen(false);
        fetchCanteenData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to extend trial.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Update Subscription Handler
  const handleUpdateSubscriptionSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/canteen/update-subscription', subForm);
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setChangeSubModalOpen(false);
        fetchCanteenData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Add Manual Days Handler (Without Plan Selection)
  const handleAddManualDaysSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/canteen/add-manual-days', manualDaysForm);
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setManualDaysModalOpen(false);
        fetchCanteenData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to add manual days.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Delete All Subscription Plans of Project Handler
  const handleDeleteSubscriptionSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/canteen/delete-subscription', { reason: deleteSubReason });
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setDeleteSubModalOpen(false);
        setDeleteSubReason('');
        fetchCanteenData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete project subscription plan.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Save Internal Notes Handler
  const handleSaveNotes = async () => {
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/canteen/notes', { notes: notesDraft });
      if (res.data.success) {
        setSuccessMsg('Canteen internal notes saved successfully.');
        fetchCanteenData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save notes.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 sm:p-10 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading Cafe D Cruze Restaurant configurations...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
            Cafe D Cruze Restaurant Control & Subscription
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Control master cascading suspension, trial periods, subscription plan billing, and panel switches
          </p>
        </div>

        <button
          onClick={fetchCanteenData}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-300 text-xs font-semibold animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-semibold animate-in fade-in">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: Overview & Plan Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Organization Details */}
        <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold font-display text-base">
              DY
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">{canteen?.name}</h3>
              <span className="text-[11px] text-slate-400 font-mono">slug: {canteen?.slug}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Contact Email</span>
              <span className="text-slate-200 font-semibold">{canteen?.contact_email || 'contact@cafedcruze.com'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Contact Phone</span>
              <span className="text-slate-200 font-semibold">{canteen?.contact_phone || '+91 9876543210'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Campus Location</span>
              <span className="text-slate-300 leading-relaxed block">{canteen?.address || 'Cafe D Cruze Restaurant, Campus Food Court'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Current Operating Status</span>
              <div className="mt-1">
                <StatusBadge status={canteen?.status} size="lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Middle & Right: Subscription & Trial Management */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Subscription Card */}
          <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Subscription & Plan Tier</h3>
                  <p className="text-[11px] text-slate-400">Current package configured for Cafe D Cruze Restaurant</p>
                </div>
              </div>

              <span className="text-lg font-black text-purple-400">
                ₹{Number(canteen?.subscription_price || canteen?.plan_default_price || 0).toLocaleString('en-IN')}/mo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-300">
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Active Plan</span>
                <span className="font-extrabold text-white text-sm">{canteen?.plan_name || 'Standard Monthly'}</span>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Started On</span>
                <span className="font-bold text-slate-200">
                  {canteen?.subscription_started_at ? new Date(canteen.subscription_started_at).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Valid Through</span>
                <span className="font-bold text-emerald-400">
                  {canteen?.subscription_ends_at ? new Date(canteen.subscription_ends_at).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setSubForm({
                    plan_id: canteen?.plan_id || (plans[0]?.id || ''),
                    custom_price: canteen?.subscription_price || '',
                    duration_days: 30,
                    reason: '',
                  });
                  setChangeSubModalOpen(true);
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Change Plan / Extend Subscription</span>
              </button>

              <button
                onClick={() => {
                  setManualDaysForm({ days: 30, reason: '' });
                  setManualDaysModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center gap-2"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Add Days Manually</span>
              </button>

              <button
                onClick={() => {
                  setTrialExtendForm({ days: 14, reason: '' });
                  setExtendTrialModalOpen(true);
                }}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md flex items-center gap-2"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Extend Free Trial Days</span>
              </button>

              <button
                onClick={() => {
                  setDeleteSubReason('');
                  setDeleteSubModalOpen(true);
                }}
                className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white font-bold rounded-xl text-xs border border-red-500/40 transition-all cursor-pointer shadow-md flex items-center gap-2 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All Subscription Plans</span>
              </button>
            </div>
          </div>

          {/* Master Cascading Access & Panel Switches */}
          <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Master Cascading Access & Panel Controls</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Suspending the canteen immediately blocks BOTH the Admin management panel and Student meal portal.
              </p>
            </div>

            {/* Master Suspend Action Button */}
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Master Canteen Operating Switch</p>
                <p className="text-[11px] text-slate-400">Controls overall platform access for the entire campus</p>
              </div>

              {canteen?.status === 'suspended' ? (
                <button
                  onClick={() => handleStatusChange('active', 'Un-suspended by Super-Admin')}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Unsuspend (Reactivate Both Panels)</span>
                </button>
              ) : (
                <button
                  onClick={() => setSuspendConfirmModalOpen(true)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0"
                >
                  <Ban className="w-4 h-4" />
                  <span>Suspend App (Lock Both Panels)</span>
                </button>
              )}
            </div>

            {/* Individual Panel Switches */}
            <div className="divide-y divide-slate-800 text-xs">
              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-white">Canteen Admin Dashboard Access</p>
                  <p className="text-[11px] text-slate-400">Controls kitchen display and meal timing setup for canteen staff</p>
                </div>
                <button
                  onClick={() => handleTogglePanel('admin')}
                  disabled={actionLoading}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    canteen?.is_admin_enabled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {canteen?.is_admin_enabled ? 'Enabled (ON)' : 'Disabled (OFF)'}
                </button>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-white">Student Meal Booking Portal</p>
                  <p className="text-[11px] text-slate-400">Controls student token generation and menu browsing</p>
                </div>
                <button
                  onClick={() => handleTogglePanel('student')}
                  disabled={actionLoading}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    canteen?.is_student_enabled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {canteen?.is_student_enabled ? 'Enabled (ON)' : 'Disabled (OFF)'}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Internal Notes Section */}
      <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Internal Canteen Notes & Agreements</span>
            </h3>
            <p className="text-[11px] text-slate-400">Internal Super-Admin records and renewal agreements</p>
          </div>

          <button
            onClick={handleSaveNotes}
            disabled={actionLoading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Notes</span>
          </button>
        </div>

        <textarea
          rows={4}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="Enter notes, payment terms, or registrar contact history here..."
          className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none font-medium leading-relaxed"
        />
      </div>

      {/* Modals */}
      {/* EXTEND TRIAL MODAL */}
      <Modal
        isOpen={extendTrialModalOpen}
        onClose={() => setExtendTrialModalOpen(false)}
        title="Extend Free Trial Days: Cafe D Cruze Restaurant"
      >
        <form onSubmit={handleExtendTrialSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Days to Add *</label>
            <input
              type="number"
              min="1"
              required
              value={trialExtendForm.days}
              onChange={(e) => setTrialExtendForm({ ...trialExtendForm, days: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reason (Recorded in Audit Trail) *</label>
            <input
              type="text"
              required
              placeholder="e.g. Extended for new semester orientation trial"
              value={trialExtendForm.reason}
              onChange={(e) => setTrialExtendForm({ ...trialExtendForm, reason: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setExtendTrialModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              {actionLoading ? 'Extending...' : 'Confirm Trial Extension'}
            </button>
          </div>
        </form>
      </Modal>

      {/* UPDATE SUBSCRIPTION MODAL */}
      <Modal
        isOpen={changeSubModalOpen}
        onClose={() => setChangeSubModalOpen(false)}
        title="Update Subscription: Cafe D Cruze Restaurant"
      >
        <form onSubmit={handleUpdateSubscriptionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Subscription Plan *</label>
            <select
              required
              value={subForm.plan_id}
              onChange={(e) => {
                const pid = e.target.value;
                const p = plans.find((pl) => String(pl.id) === String(pid));
                setSubForm({
                  ...subForm,
                  plan_id: pid,
                  custom_price: p ? p.price : subForm.custom_price,
                });
              }}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="">Select Plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Standard ₹{p.price} ({p.billing_cycle})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Monthly Billing Price (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Custom price"
                value={subForm.custom_price}
                onChange={(e) => setSubForm({ ...subForm, custom_price: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Duration to Add (Days)</label>
              <input
                type="number"
                min="1"
                value={subForm.duration_days}
                onChange={(e) => setSubForm({ ...subForm, duration_days: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reason (Recorded in Audit Trail)</label>
            <input
              type="text"
              placeholder="e.g. Verified offline bank transfer for annual renewal"
              value={subForm.reason}
              onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setChangeSubModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              {actionLoading ? 'Updating...' : 'Confirm Subscription Renewal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* SUSPEND CONFIRM MODAL */}
      <Modal
        isOpen={suspendConfirmModalOpen}
        onClose={() => setSuspendConfirmModalOpen(false)}
        title="Confirm Cascading Suspension: Cafe D Cruze Restaurant"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Cascading Suspension Notice</p>
              <p className="mt-1 leading-relaxed text-red-300">
                Suspending Cafe D Cruze Restaurant will instantly lock access for <strong>BOTH</strong> the canteen Admin kitchen panel and the Student meal booking app until unsuspended.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSuspendConfirmModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('suspended', 'Master suspension executed by Super-Admin')}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              {actionLoading ? 'Suspending...' : 'Confirm & Suspend Both Panels'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD MANUAL DAYS MODAL */}
      <Modal
        isOpen={manualDaysModalOpen}
        onClose={() => setManualDaysModalOpen(false)}
        title="Add Days Manually: Cafe D Cruze Restaurant"
      >
        <form onSubmit={handleAddManualDaysSubmit} className="space-y-4 text-xs">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 flex items-start gap-2.5">
            <CalendarPlus className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">
              Add extra validity days to the canteen's active subscription directly without changing or selecting any pre-defined plan tier.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Days to Add *</label>
            <input
              type="number"
              min="1"
              required
              placeholder="e.g. 30"
              value={manualDaysForm.days}
              onChange={(e) => setManualDaysForm({ ...manualDaysForm, days: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reason / Note (Recorded in Audit Trail)</label>
            <input
              type="text"
              placeholder="e.g. Direct manual extension without plan selection"
              value={manualDaysForm.reason}
              onChange={(e) => setManualDaysForm({ ...manualDaysForm, reason: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setManualDaysModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>{actionLoading ? 'Adding Days...' : 'Confirm Add Days'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE SUBSCRIPTION PLAN CONFIRM MODAL */}
      <Modal
        isOpen={deleteSubModalOpen}
        onClose={() => setDeleteSubModalOpen(false)}
        title="Delete All Subscription Plans: Cafe D Cruze Project"
      >
        <form onSubmit={handleDeleteSubscriptionSubmit} className="space-y-4 text-xs">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Delete Project Subscription Plan</p>
              <p className="mt-1 leading-relaxed text-red-300">
                This will delete and remove all active subscription plans from the Cafe D Cruze project. The project's subscription status will instantly be reset to <strong>Expired</strong>, removing all active validity dates.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Reason for Deletion (Recorded in Audit Trail)</label>
            <input
              type="text"
              placeholder="e.g. Contract terminated / Manual plan reset"
              value={deleteSubReason}
              onChange={(e) => setDeleteSubReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteSubModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{actionLoading ? 'Deleting Plan...' : 'Confirm Delete All Plans'}</span>
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
