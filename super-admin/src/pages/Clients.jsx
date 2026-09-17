import React, { useState, useEffect } from 'react';
import { 
  Building2, Search, Plus, Filter, ShieldAlert, CheckCircle2, 
  Clock, Ban, AlertTriangle, ChevronRight, Edit3, Key, Calendar, 
  Save, RefreshCw, Layers, ToggleLeft, ToggleRight, X, ExternalLink,
  MessageSquare, UserCheck, ShieldOff, Sparkles, Check
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Selected client for detail drawer
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientAuditLogs, setClientAuditLogs] = useState([]);
  const [activeDetailTab, setActiveDetailTab] = useState('overview'); // 'overview', 'subscription', 'trial', 'access', 'notes', 'audit'

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [extendTrialModalOpen, setExtendTrialModalOpen] = useState(false);
  const [changeSubModalOpen, setChangeSubModalOpen] = useState(false);
  const [suspendConfirmModalOpen, setSuspendConfirmModalOpen] = useState(false);

  // Forms
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    slug: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    plan_id: '',
    trial_days: 14,
    is_active_direct: false,
    notes: '',
  });

  const [trialExtendForm, setTrialExtendForm] = useState({ days: 14, reason: '' });
  const [subForm, setSubForm] = useState({ plan_id: '', custom_price: '', duration_days: 30, reason: '' });
  const [notesDraft, setNotesDraft] = useState('');

  // Status & Feedback alerts
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchClients();
    fetchPlans();
  }, [statusFilter]);

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

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clients?status=${statusFilter}&search=${encodeURIComponent(search)}`);
      if (res.data.success) {
        setClients(res.data.clients || []);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchClients();
  };

  const openClientDetail = async (client) => {
    setSelectedClient(client);
    setNotesDraft(client.notes || '');
    setActiveDetailTab('overview');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.get(`/clients/${client.id}`);
      if (res.data.success) {
        setSelectedClient(res.data.client);
        setClientAuditLogs(res.data.auditLogs || []);
        setNotesDraft(res.data.client.notes || '');
      }
    } catch (err) {
      console.error('Failed to fetch client detail:', err);
    }
  };

  // 1. Create New Client Handler
  const handleCreateClientSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/clients', newClientForm);
      if (res.data.success) {
        setCreateModalOpen(false);
        setNewClientForm({
          name: '',
          slug: '',
          contact_email: '',
          contact_phone: '',
          address: '',
          plan_id: '',
          trial_days: 14,
          is_active_direct: false,
          notes: '',
        });
        fetchClients();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create client.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Master Cascading Status Change (Active <-> Suspended <-> Trial <-> Expired)
  const handleStatusChange = async (targetStatus, reason = '') => {
    if (!selectedClient) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post(`/clients/${selectedClient.id}/status`, {
        status: targetStatus,
        reason: reason || `Changed to ${targetStatus} by Super-Admin`,
      });
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setSuspendConfirmModalOpen(false);
        // Refresh detail and list
        const updated = { ...selectedClient, status: targetStatus };
        setSelectedClient(updated);
        fetchClients();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update client status.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Toggle Panel Access Privileges
  const handleTogglePanel = async (type) => {
    if (!selectedClient) return;
    setActionLoading(true);
    setErrorMsg('');

    const newAdmin = type === 'admin' ? !selectedClient.is_admin_enabled : selectedClient.is_admin_enabled;
    const newStudent = type === 'student' ? !selectedClient.is_student_enabled : selectedClient.is_student_enabled;

    try {
      const res = await api.post(`/clients/${selectedClient.id}/toggle-access`, {
        is_admin_enabled: newAdmin,
        is_student_enabled: newStudent,
      });
      if (res.data.success) {
        setSelectedClient({
          ...selectedClient,
          is_admin_enabled: res.data.is_admin_enabled,
          is_student_enabled: res.data.is_student_enabled,
        });
        fetchClients();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to toggle access.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Extend Trial Handler
  const handleExtendTrialSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post(`/clients/${selectedClient.id}/extend-trial`, trialExtendForm);
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setExtendTrialModalOpen(false);
        setSelectedClient({
          ...selectedClient,
          trial_ends_at: res.data.trial_ends_at,
          status: 'trial',
        });
        fetchClients();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to extend trial.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Update Subscription Handler
  const handleUpdateSubscriptionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post(`/clients/${selectedClient.id}/update-subscription`, subForm);
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setChangeSubModalOpen(false);
        setSelectedClient({
          ...selectedClient,
          subscription_ends_at: res.data.subscription_ends_at,
          subscription_price: res.data.subscription_price,
          status: 'active',
        });
        fetchClients();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Save Internal Notes Handler
  const handleSaveNotes = async () => {
    if (!selectedClient) return;
    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post(`/clients/${selectedClient.id}/notes`, { notes: notesDraft });
      if (res.data.success) {
        setSuccessMsg('Notes saved successfully.');
        setSelectedClient({ ...selectedClient, notes: notesDraft });
        fetchClients();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save notes.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
            Client Organizations
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Manage multi-tenant campuses, trial periods, subscription billing, and master panel access
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setCreateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard New Client</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name, slug, email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
          />
        </form>

        {/* Status Pills Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: '', label: 'All Status' },
            { id: 'active', label: 'Active' },
            { id: 'trial', label: 'Trial' },
            { id: 'suspended', label: 'Suspended' },
            { id: 'expired', label: 'Expired' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
          <span>Loading client directory...</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="py-16 text-center bg-[#0f172a] rounded-3xl border border-slate-800 text-slate-400 text-xs font-medium space-y-3">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <p>No client organizations match your filter criteria.</p>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                  <th className="p-4">Client Name & Slug</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Plan & Billing</th>
                  <th className="p-4">Trial / Expiry</th>
                  <th className="p-4 text-center">Panel Access</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openClientDetail(c)}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                  >
                    {/* Name & Contact */}
                    <td className="p-4">
                      <div className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">slug: {c.slug}</div>
                      <div className="text-[11px] text-slate-400">{c.contact_email}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      <StatusBadge status={c.status} />
                    </td>

                    {/* Plan */}
                    <td className="p-4">
                      <span className="font-bold text-slate-200 block truncate">
                        {c.plan_name || 'Custom Plan'}
                      </span>
                      <span className="text-[11px] text-indigo-400 font-semibold">
                        ₹{Number(c.subscription_price || c.plan_default_price || 0).toLocaleString('en-IN')}/mo
                      </span>
                    </td>

                    {/* Trial / Expiry */}
                    <td className="p-4 text-slate-300">
                      {c.status === 'trial' ? (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-indigo-400 block">Trial Ends</span>
                          <span>{c.trial_ends_at ? new Date(c.trial_ends_at).toLocaleDateString('en-IN') : 'N/A'}</span>
                        </div>
                      ) : c.subscription_ends_at ? (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Renews / Ends</span>
                          <span>{new Date(c.subscription_ends_at).toLocaleDateString('en-IN')}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    {/* Access Indicators */}
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            c.is_admin_enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          }`}
                          title="Admin Panel Status"
                        >
                          Admin: {c.is_admin_enabled ? 'ON' : 'OFF'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            c.is_student_enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          }`}
                          title="Student Portal Status"
                        >
                          Student: {c.is_student_enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openClientDetail(c);
                        }}
                        className="p-2 rounded-xl bg-slate-900 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          CLIENT DETAIL DRAWER / MODAL
          ========================================================================= */}
      {selectedClient && (
        <Modal
          isOpen={Boolean(selectedClient)}
          onClose={() => setSelectedClient(null)}
          title={`Client: ${selectedClient.name}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            
            {/* Top Summary Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-900 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-lg font-display">
                  {selectedClient.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white font-display tracking-tight">
                    {selectedClient.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-indigo-400">slug: {selectedClient.slug}</span>
                    <span>•</span>
                    <span>{selectedClient.contact_email}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={selectedClient.status} size="lg" />
              </div>
            </div>

            {/* Error or Success feedback inside drawer */}
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Navigation Tabs inside Client Detail */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: Building2 },
                { id: 'subscription', label: 'Subscription & Plan', icon: Layers },
                { id: 'trial', label: 'Trial Management', icon: Clock },
                { id: 'access', label: 'Access Controls', icon: ShieldAlert },
                { id: 'notes', label: 'Internal Notes', icon: MessageSquare },
                { id: 'audit', label: 'Activity Logs', icon: History },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeDetailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDetailTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      active
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: 1. OVERVIEW */}
            {activeDetailTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Contact Email</span>
                  <span className="text-slate-200 font-semibold">{selectedClient.contact_email || '—'}</span>
                </div>

                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Phone Number</span>
                  <span className="text-slate-200 font-semibold">{selectedClient.contact_phone || '—'}</span>
                </div>

                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Physical Address / Campus</span>
                  <span className="text-slate-200 font-semibold">{selectedClient.address || '—'}</span>
                </div>

                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Current Status</span>
                  <StatusBadge status={selectedClient.status} />
                </div>

                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Created On</span>
                  <span className="text-slate-200 font-semibold">
                    {new Date(selectedClient.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. SUBSCRIPTION & PLAN */}
            {activeDetailTab === 'subscription' && (
              <div className="space-y-4">
                <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-indigo-400 block">Assigned Plan</span>
                      <h4 className="text-base font-extrabold text-white">
                        {selectedClient.plan_name || 'Standard Monthly'}
                      </h4>
                    </div>
                    <span className="text-base font-black text-purple-400">
                      ₹{Number(selectedClient.subscription_price || selectedClient.plan_default_price || 0).toLocaleString('en-IN')}/mo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-slate-300">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Started On</span>
                      <span>
                        {selectedClient.subscription_started_at
                          ? new Date(selectedClient.subscription_started_at).toLocaleDateString('en-IN')
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Valid Until</span>
                      <span className="font-bold text-emerald-400">
                        {selectedClient.subscription_ends_at
                          ? new Date(selectedClient.subscription_ends_at).toLocaleDateString('en-IN')
                          : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setSubForm({
                          plan_id: selectedClient.plan_id || (plans[0]?.id || ''),
                          custom_price: selectedClient.subscription_price || '',
                          duration_days: 30,
                          reason: '',
                        });
                        setChangeSubModalOpen(true);
                      }}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow"
                    >
                      Update Plan / Extend Subscription
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. TRIAL MANAGEMENT */}
            {activeDetailTab === 'trial' && (
              <div className="space-y-4">
                <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-sky-400 block">Free Trial Status</span>
                      <h4 className="text-sm font-extrabold text-white">
                        {selectedClient.status === 'trial' ? 'Trial Period Active' : 'Trial Concluded / Inactive'}
                      </h4>
                    </div>
                    <StatusBadge status={selectedClient.status} />
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Current Trial End Date</span>
                      <span className="font-bold text-white">
                        {selectedClient.trial_ends_at
                          ? new Date(selectedClient.trial_ends_at).toLocaleDateString('en-IN')
                          : 'No trial date configured'}
                      </span>
                    </div>
                    <Clock className="w-5 h-5 text-sky-400" />
                  </div>

                  <button
                    onClick={() => {
                      setTrialExtendForm({ days: 14, reason: '' });
                      setExtendTrialModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow"
                  >
                    Extend Free Trial Days (+ Days)
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. ACCESS CONTROLS & MASTER SUSPENSION */}
            {activeDetailTab === 'access' && (
              <div className="space-y-4">
                {/* Master Cascading Suspend / Unsuspend */}
                <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                        <span>Master Cascading Status Control</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Suspending locks BOTH the Admin panel and Student app simultaneously via single tenant status.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2.5">
                    {selectedClient.status === 'suspended' ? (
                      <button
                        onClick={() => handleStatusChange('active', 'Un-suspended by Super-Admin')}
                        disabled={actionLoading}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Unsuspend Client (Restore Access to Both Panels)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setSuspendConfirmModalOpen(true)}
                        disabled={actionLoading}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Ban className="w-4 h-4" />
                        <span>Suspend Client (Lock Both Admin & Student)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Independent Panel Access Toggles */}
                <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-white">Independent Panel Toggles</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Selectively disable either the Admin management panel or the Student meal ordering portal.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {/* Admin Panel Toggle */}
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-white">Client Admin Dashboard Access</p>
                        <p className="text-[11px] text-slate-400">Controls login & kitchen screen access for canteen staff</p>
                      </div>
                      <button
                        onClick={() => handleTogglePanel('admin')}
                        disabled={actionLoading}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedClient.is_admin_enabled
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {selectedClient.is_admin_enabled ? 'Enabled (ON)' : 'Disabled (OFF)'}
                      </button>
                    </div>

                    {/* Student Panel Toggle */}
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-white">Student Meal Booking Portal</p>
                        <p className="text-[11px] text-slate-400">Controls student token ordering and menu browsing</p>
                      </div>
                      <button
                        onClick={() => handleTogglePanel('student')}
                        disabled={actionLoading}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedClient.is_student_enabled
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {selectedClient.is_student_enabled ? 'Enabled (ON)' : 'Disabled (OFF)'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 5. INTERNAL NOTES */}
            {activeDetailTab === 'notes' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Freeform Organization Notes</span>
                    <span className="text-[10px] text-slate-500">Internal only — not visible to client</span>
                  </div>
                  <textarea
                    rows={6}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="E.g. Discount agreed on annual renewal; follow up with registrar on 15th..."
                    className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none font-medium leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveNotes}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Internal Notes</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 6. CLIENT ACTIVITY LOGS */}
            {activeDetailTab === 'audit' && (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {clientAuditLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">No activity logs recorded for this client.</div>
                ) : (
                  clientAuditLogs.map((l) => (
                    <div key={l.id} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-indigo-400 font-bold">{l.action}</span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(l.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px]">Performed by {l.actor_name} ({l.actor_email})</p>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </Modal>
      )}

      {/* =========================================================================
          ONBOARD NEW CLIENT MODAL
          ========================================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Onboard New Client Organization"
      >
        <form onSubmit={handleCreateClientSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Organization / Canteen Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. MIT Pune Central Mess"
              value={newClientForm.name}
              onChange={(e) => {
                const name = e.target.value;
                const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                setNewClientForm({ ...newClientForm, name, slug: newClientForm.slug || slug });
              }}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Tenant Slug (Unique URL key) *</label>
              <input
                type="text"
                required
                placeholder="e.g. mit-pune"
                value={newClientForm.slug}
                onChange={(e) => setNewClientForm({ ...newClientForm, slug: e.target.value.toLowerCase() })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Initial Free Trial Days</label>
              <input
                type="number"
                min="0"
                value={newClientForm.trial_days}
                onChange={(e) => setNewClientForm({ ...newClientForm, trial_days: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Contact Email *</label>
              <input
                type="email"
                required
                placeholder="admin@campusmess.com"
                value={newClientForm.contact_email}
                onChange={(e) => setNewClientForm({ ...newClientForm, contact_email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={newClientForm.contact_phone}
                onChange={(e) => setNewClientForm({ ...newClientForm, contact_phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Subscription Plan Assignment</label>
            <select
              value={newClientForm.plan_id}
              onChange={(e) => setNewClientForm({ ...newClientForm, plan_id: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="">Select Plan (or leave blank for custom)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.price} ({p.billing_cycle})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Initial Notes</label>
            <textarea
              rows={2}
              placeholder="Any onboarding agreements or special instructions..."
              value={newClientForm.notes}
              onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
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
              {actionLoading ? 'Creating...' : 'Onboard Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          EXTEND TRIAL MODAL
          ========================================================================= */}
      <Modal
        isOpen={extendTrialModalOpen}
        onClose={() => setExtendTrialModalOpen(false)}
        title={`Extend Trial: ${selectedClient?.name}`}
      >
        <form onSubmit={handleExtendTrialSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Additional Trial Days to Add *</label>
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
            <label className="block font-bold text-slate-300 mb-1">Reason for Extension (Logged to Audit Trail) *</label>
            <input
              type="text"
              required
              placeholder="e.g. University requested 2 extra weeks before semester starts"
              value={trialExtendForm.reason}
              onChange={(e) => setTrialExtendForm({ ...trialExtendForm, reason: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setExtendTrialModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {actionLoading ? 'Extending...' : 'Confirm Trial Extension'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          UPDATE SUBSCRIPTION MODAL
          ========================================================================= */}
      <Modal
        isOpen={changeSubModalOpen}
        onClose={() => setChangeSubModalOpen(false)}
        title={`Update Subscription: ${selectedClient?.name}`}
      >
        <form onSubmit={handleUpdateSubscriptionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Target Subscription Plan *</label>
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
                placeholder="Custom price if any"
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
            <label className="block font-bold text-slate-300 mb-1">Reason for Change (Audit Trail)</label>
            <input
              type="text"
              placeholder="e.g. Offline bank transfer confirmed for 1 year renewal"
              value={subForm.reason}
              onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setChangeSubModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {actionLoading ? 'Updating...' : 'Activate / Renew Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          CONFIRM SUSPENSION MODAL (Explains Cascade to Both Panels)
          ========================================================================= */}
      <Modal
        isOpen={suspendConfirmModalOpen}
        onClose={() => setSuspendConfirmModalOpen(false)}
        title="Confirm Master Project Suspension"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Cascading Suspension Notice</p>
              <p className="mt-1 leading-relaxed text-red-300">
                Suspending client <strong className="text-white">{selectedClient?.name}</strong> will immediately lock access for <strong>BOTH</strong> the canteen Admin management panel and the Student meal booking portal until unsuspended.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSuspendConfirmModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('suspended', 'Master suspension executed by Super-Admin')}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {actionLoading ? 'Suspending...' : 'Confirm & Suspend Both Panels'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
