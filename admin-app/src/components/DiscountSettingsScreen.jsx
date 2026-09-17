import React, { useState, useEffect } from 'react';
import {
  Percent,
  Sparkles,
  Gift,
  Clock,
  Save,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  History,
  Info,
  Sun,
  Sunrise,
  Coffee,
  Moon,
  RotateCcw,
  Plus,
  Trash2,
  X,
  Utensils,
} from 'lucide-react';
import api from '../services/api';

/**
 * Visual styling configuration helper based on meal type
 */
const getMealVisuals = (mealType) => {
  switch ((mealType || '').toLowerCase()) {
    case 'breakfast':
      return {
        icon: <Sunrise className="w-5 h-5" />,
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-700',
        borderHover: 'hover:border-amber-300',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-200',
        peerCheckedBg: 'peer-checked:bg-emerald-600',
        ringFocus: 'focus:ring-emerald-500',
        previewBg: 'bg-amber-50/70 border-amber-200 text-amber-900',
        clockText: 'text-amber-600',
        boldText: 'text-amber-950 font-black',
      };
    case 'lunch':
      return {
        icon: <Sun className="w-5 h-5" />,
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-600',
        borderHover: 'hover:border-orange-300',
        badgeBg: 'bg-orange-50',
        badgeText: 'text-orange-800',
        badgeBorder: 'border-orange-200',
        peerCheckedBg: 'peer-checked:bg-emerald-600',
        ringFocus: 'focus:ring-emerald-500',
        previewBg: 'bg-orange-50/70 border-orange-200 text-orange-900',
        clockText: 'text-orange-600',
        boldText: 'text-orange-950 font-black',
      };
    case 'snacks':
      return {
        icon: <Coffee className="w-5 h-5" />,
        bgColor: 'bg-emerald-100',
        textColor: 'text-emerald-700',
        borderHover: 'hover:border-emerald-300',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-800',
        badgeBorder: 'border-emerald-200',
        peerCheckedBg: 'peer-checked:bg-emerald-600',
        ringFocus: 'focus:ring-emerald-500',
        previewBg: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
        clockText: 'text-emerald-600',
        boldText: 'text-emerald-950 font-black',
      };
    case 'dinner':
      return {
        icon: <Moon className="w-5 h-5" />,
        bgColor: 'bg-indigo-100',
        textColor: 'text-indigo-700',
        borderHover: 'hover:border-indigo-300',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-800',
        badgeBorder: 'border-indigo-200',
        peerCheckedBg: 'peer-checked:bg-emerald-600',
        ringFocus: 'focus:ring-emerald-500',
        previewBg: 'bg-indigo-50/70 border-indigo-200 text-indigo-900',
        clockText: 'text-indigo-600',
        boldText: 'text-indigo-950 font-black',
      };
    default:
      return {
        icon: <Utensils className="w-5 h-5" />,
        bgColor: 'bg-teal-100',
        textColor: 'text-teal-700',
        borderHover: 'hover:border-teal-300',
        badgeBg: 'bg-teal-50',
        badgeText: 'text-teal-800',
        badgeBorder: 'border-teal-200',
        peerCheckedBg: 'peer-checked:bg-emerald-600',
        ringFocus: 'focus:ring-emerald-500',
        previewBg: 'bg-teal-50/70 border-teal-200 text-teal-900',
        clockText: 'text-teal-600',
        boldText: 'text-teal-950 font-black',
      };
  }
};

export default function DiscountSettingsScreen() {
  const [settings, setSettings] = useState({
    new_user_discount_enabled: true,
    new_user_discount_percentage: 10,
    new_user_discount_days: 5,
    meal_rules: [],
    // Legacy backwards compatibility keys
    breakfast_early_discount_enabled: true,
    breakfast_early_discount_percentage: 10,
    breakfast_early_discount_cutoff_time: '09:00',
    lunch_early_discount_enabled: true,
    lunch_early_discount_percentage: 10,
    lunch_early_discount_cutoff_time: '12:00',
    snacks_early_discount_enabled: true,
    snacks_early_discount_percentage: 10,
    snacks_early_discount_cutoff_time: '17:00',
    dinner_early_discount_enabled: true,
    dinner_early_discount_percentage: 10,
    dinner_early_discount_cutoff_time: '20:30',
  });

  const [initialSettings, setInitialSettings] = useState(null);
  const [updatedByAdmin, setUpdatedByAdmin] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Modal state for adding a dynamic discount rule
  const [showAddModal, setShowAddModal] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [availableWindows, setAvailableWindows] = useState([]);
  const [newRule, setNewRule] = useState({
    meal_type: '',
    display_name: '',
    discount_percentage: 10,
    cutoff_time: '12:00',
    is_enabled: true,
  });

  useEffect(() => {
    fetchSettings();
    fetchAvailableWindows();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAvailableWindows = async () => {
    try {
      const res = await api.get('/menu/windows');
      if (res.data && res.data.windows) {
        setAvailableWindows(res.data.windows);
      }
    } catch (e) {
      console.warn('Could not fetch windows for dropdown', e);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/discount-settings');
      if (res.data && res.data.success) {
        const data = res.data.data;

        // Default standard 4 rules if not in database yet
        let rules = Array.isArray(data.meal_rules) && data.meal_rules.length > 0 ? data.meal_rules : [
          { meal_type: 'breakfast', display_name: 'Early Breakfast Discount', discount_percentage: data.breakfast_early_discount_percentage != null ? Number(data.breakfast_early_discount_percentage) : 0, cutoff_time: data.breakfast_early_discount_cutoff_time || '09:00', is_enabled: Boolean(data.breakfast_early_discount_enabled) },
          { meal_type: 'lunch',     display_name: 'Early Lunch Discount',     discount_percentage: data.lunch_early_discount_percentage != null ? Number(data.lunch_early_discount_percentage) : 0, cutoff_time: data.lunch_early_discount_cutoff_time || '12:00', is_enabled: Boolean(data.lunch_early_discount_enabled) },
          { meal_type: 'snacks',    display_name: 'Early Snacks Discount',    discount_percentage: data.snacks_early_discount_percentage != null ? Number(data.snacks_early_discount_percentage) : 0, cutoff_time: data.snacks_early_discount_cutoff_time || '17:00', is_enabled: Boolean(data.snacks_early_discount_enabled != null ? data.snacks_early_discount_enabled : true) },
          { meal_type: 'dinner',    display_name: 'Early Dinner Discount',    discount_percentage: data.dinner_early_discount_percentage != null ? Number(data.dinner_early_discount_percentage) : 0, cutoff_time: data.dinner_early_discount_cutoff_time || '20:30', is_enabled: Boolean(data.dinner_early_discount_enabled != null ? data.dinner_early_discount_enabled : true) },
        ];

        const cleanData = {
          new_user_discount_enabled: Boolean(data.new_user_discount_enabled),
          new_user_discount_percentage: data.new_user_discount_percentage != null ? Number(data.new_user_discount_percentage) : 0,
          new_user_discount_days: parseInt(data.new_user_discount_days, 10) || 5,
          breakfast_early_discount_enabled: Boolean(data.breakfast_early_discount_enabled),
          breakfast_early_discount_percentage: data.breakfast_early_discount_percentage != null ? Number(data.breakfast_early_discount_percentage) : 0,
          breakfast_early_discount_cutoff_time: data.breakfast_early_discount_cutoff_time || '09:00',
          lunch_early_discount_enabled: Boolean(data.lunch_early_discount_enabled),
          lunch_early_discount_percentage: data.lunch_early_discount_percentage != null ? Number(data.lunch_early_discount_percentage) : 0,
          lunch_early_discount_cutoff_time: data.lunch_early_discount_cutoff_time || '12:00',
          snacks_early_discount_enabled: Boolean(data.snacks_early_discount_enabled != null ? data.snacks_early_discount_enabled : true),
          snacks_early_discount_percentage: data.snacks_early_discount_percentage != null ? Number(data.snacks_early_discount_percentage) : 0,
          snacks_early_discount_cutoff_time: data.snacks_early_discount_cutoff_time || '17:00',
          dinner_early_discount_enabled: Boolean(data.dinner_early_discount_enabled != null ? data.dinner_early_discount_enabled : true),
          dinner_early_discount_percentage: data.dinner_early_discount_percentage != null ? Number(data.dinner_early_discount_percentage) : 0,
          dinner_early_discount_cutoff_time: data.dinner_early_discount_cutoff_time || '20:30',
          meal_rules: rules.map((r) => ({
            ...r,
            discount_percentage: r.discount_percentage != null ? Number(r.discount_percentage) : 0,
            cutoff_time: r.cutoff_time || '12:00',
            is_enabled: Boolean(r.is_enabled),
          })),
        };

        setSettings(cleanData);
        setInitialSettings(cleanData);
        setUpdatedByAdmin(data.updated_by_admin || null);
        setAuditLogs(res.data.audit_logs || []);
      }
    } catch (err) {
      console.error('Error fetching discount settings:', err);
      showToast('Could not fetch discount settings. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRuleChange = (mealType, field, value) => {
    setSettings((prev) => {
      const updatedRules = prev.meal_rules.map((r) => {
        if (r.meal_type === mealType) {
          return { ...r, [field]: value };
        }
        return r;
      });

      const next = {
        ...prev,
        meal_rules: updatedRules,
      };

      // Keep legacy core keys synchronized
      if (mealType === 'breakfast') {
        if (field === 'is_enabled') next.breakfast_early_discount_enabled = value;
        if (field === 'discount_percentage') next.breakfast_early_discount_percentage = value;
        if (field === 'cutoff_time') next.breakfast_early_discount_cutoff_time = value;
      } else if (mealType === 'lunch') {
        if (field === 'is_enabled') next.lunch_early_discount_enabled = value;
        if (field === 'discount_percentage') next.lunch_early_discount_percentage = value;
        if (field === 'cutoff_time') next.lunch_early_discount_cutoff_time = value;
      } else if (mealType === 'snacks') {
        if (field === 'is_enabled') next.snacks_early_discount_enabled = value;
        if (field === 'discount_percentage') next.snacks_early_discount_percentage = value;
        if (field === 'cutoff_time') next.snacks_early_discount_cutoff_time = value;
      } else if (mealType === 'dinner') {
        if (field === 'is_enabled') next.dinner_early_discount_enabled = value;
        if (field === 'discount_percentage') next.dinner_early_discount_percentage = value;
        if (field === 'cutoff_time') next.dinner_early_discount_cutoff_time = value;
      }

      return next;
    });
  };

  const handleReset = () => {
    if (initialSettings) {
      setSettings({ ...initialSettings });
      showToast('Reverted unsaved changes to saved database values.', 'info');
    }
  };

  const hasUnsavedChanges =
    initialSettings &&
    JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        new_user_discount_enabled: Boolean(settings.new_user_discount_enabled),
        new_user_discount_percentage: Number(settings.new_user_discount_percentage),
        new_user_discount_days: parseInt(settings.new_user_discount_days, 10),
        breakfast_early_discount_enabled: Boolean(settings.breakfast_early_discount_enabled),
        breakfast_early_discount_percentage: Number(settings.breakfast_early_discount_percentage),
        breakfast_early_discount_cutoff_time: settings.breakfast_early_discount_cutoff_time,
        lunch_early_discount_enabled: Boolean(settings.lunch_early_discount_enabled),
        lunch_early_discount_percentage: Number(settings.lunch_early_discount_percentage),
        lunch_early_discount_cutoff_time: settings.lunch_early_discount_cutoff_time,
        snacks_early_discount_enabled: Boolean(settings.snacks_early_discount_enabled),
        snacks_early_discount_percentage: Number(settings.snacks_early_discount_percentage),
        snacks_early_discount_cutoff_time: settings.snacks_early_discount_cutoff_time,
        dinner_early_discount_enabled: Boolean(settings.dinner_early_discount_enabled),
        dinner_early_discount_percentage: Number(settings.dinner_early_discount_percentage),
        dinner_early_discount_cutoff_time: settings.dinner_early_discount_cutoff_time,
        meal_rules: (settings.meal_rules || []).map((r) => ({
          meal_type: r.meal_type,
          display_name: r.display_name,
          discount_percentage: Number(r.discount_percentage),
          cutoff_time: r.cutoff_time,
          is_enabled: Boolean(r.is_enabled),
        })),
      };

      const res = await api.put('/admin/discount-settings', payload);
      if (res.data && res.data.success) {
        showToast('🎉 Discount settings saved and applied dynamically across the canteen!', 'success');
        setInitialSettings({ ...settings });
        fetchSettings();
      } else {
        showToast(res.data?.message || 'Failed to save settings.', 'error');
      }
    } catch (err) {
      console.error('Error saving discount settings:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to save discount settings.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!newRule.meal_type || !newRule.meal_type.trim()) {
      showToast('Please specify a meal type name.', 'error');
      return;
    }

    setCreatingRule(true);
    try {
      const res = await api.post('/admin/discount-settings/rules', {
        meal_type: newRule.meal_type.trim().toLowerCase(),
        display_name: newRule.display_name?.trim() || `Early ${newRule.meal_type.trim().charAt(0).toUpperCase() + newRule.meal_type.trim().slice(1)} Discount`,
        discount_percentage: newRule.discount_percentage != null ? Number(newRule.discount_percentage) : 0,
        cutoff_time: newRule.cutoff_time || '12:00',
        is_enabled: Boolean(newRule.is_enabled),
      });

      if (res.data && res.data.success) {
        showToast(`🎉 Dynamic discount rule for '${newRule.meal_type}' added successfully!`, 'success');
        setShowAddModal(false);
        setNewRule({
          meal_type: '',
          display_name: '',
          discount_percentage: 10,
          cutoff_time: '12:00',
          is_enabled: true,
        });
        await fetchSettings();
        await fetchAvailableWindows();
      } else {
        showToast(res.data?.message || 'Failed to create discount rule.', 'error');
      }
    } catch (err) {
      console.error('Error creating discount rule:', err);
      showToast(err.response?.data?.message || err.message || 'Failed to create rule.', 'error');
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (mealType) => {
    if (!window.confirm(`Are you sure you want to delete the discount rule for "${mealType}"?`)) {
      return;
    }
    try {
      const res = await api.delete(`/admin/discount-settings/rules/${mealType}`);
      if (res.data && res.data.success) {
        showToast(`Discount rule for '${mealType}' deleted.`, 'info');
        await fetchSettings();
      } else {
        showToast(res.data?.message || 'Failed to delete rule.', 'error');
      }
    } catch (err) {
      console.error('Error deleting rule:', err);
      showToast(err.response?.data?.message || err.message || 'Failed to delete rule.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold tracking-tight">Loading Dynamic Discount Rules...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-all animate-in slide-in-from-top-4 ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : toast.type === 'info'
              ? 'bg-slate-800 border-slate-700 text-white'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black shadow-xs">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Discount Settings
                </h1>
                <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs tracking-wider">
                  Admin & Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Single source of truth: configure dynamic welcome deals & early-order discount rules for all meal types.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add Discount Rule</span>
          </button>

          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-black transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              saving
                ? 'bg-slate-400 cursor-not-allowed'
                : hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                : 'bg-slate-800 hover:bg-slate-900'
            }`}
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Settings Grid: Dynamic Meal & Welcome Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* SECTION 1: New User Welcome Discount */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-5 transition-all hover:border-purple-300">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    New User Welcome Deal
                  </h2>
                  <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                    Applies to ALL Meal Types
                  </span>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.new_user_discount_enabled}
                  onChange={(e) => handleChange('new_user_discount_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Automatically applies to newly registered students across any meal category for their initial days.
            </p>

            {/* Inputs */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Discount Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.new_user_discount_percentage}
                    onChange={(e) => handleChange('new_user_discount_percentage', e.target.value)}
                    disabled={!settings.new_user_discount_enabled}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 transition-all pr-8"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Duration (Full Days from Account Creation)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={settings.new_user_discount_days}
                    onChange={(e) => handleChange('new_user_discount_days', e.target.value)}
                    disabled={!settings.new_user_discount_enabled}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 transition-all pr-12"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                    Days
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Live Preview Box */}
          <div className={`p-3.5 rounded-2xl border transition-all ${
            settings.new_user_discount_enabled
              ? 'bg-purple-50/70 border-purple-200 text-purple-900'
              : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}>
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Live Rule Preview</span>
            </div>
            <p className="text-xs font-semibold leading-snug">
              {settings.new_user_discount_enabled ? (
                <>
                  New students get <strong className="text-purple-950 font-black">{settings.new_user_discount_percentage}% OFF</strong> on <strong className="text-purple-950">ANY meal</strong> for their first <strong className="text-purple-950 font-black">{settings.new_user_discount_days} days</strong>.
                </>
              ) : (
                'Welcome Deal is currently turned off. New students will pay normal prices or early-bird rates.'
              )}
            </p>
          </div>
        </div>

        {/* DYNAMIC MEAL DISCOUNT RULES: Breakfast, Lunch, Snacks, Dinner + All Custom Meal Types */}
        {settings.meal_rules.map((rule) => {
          const isStandard = ['breakfast', 'lunch', 'snacks', 'dinner'].includes(rule.meal_type.toLowerCase());
          const visuals = getMealVisuals(rule.meal_type);

          return (
            <div
              key={rule.meal_type}
              className={`bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-5 transition-all ${visuals.borderHover}`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl ${visuals.bgColor} ${visuals.textColor} flex items-center justify-center shrink-0`}>
                      {visuals.icon}
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 tracking-tight capitalize">
                        {rule.display_name || `Early ${rule.meal_type} Discount`}
                      </h2>
                      <span className={`text-[11px] ${visuals.badgeText} font-semibold ${visuals.badgeBg} px-2 py-0.5 rounded-md border ${visuals.badgeBorder} capitalize`}>
                        {rule.meal_type} Category Only
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isStandard && (
                      <button
                        type="button"
                        title={`Delete rule for ${rule.meal_type}`}
                        onClick={() => handleDeleteRule(rule.meal_type)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(rule.is_enabled)}
                        onChange={(e) => handleRuleChange(rule.meal_type, 'is_enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${visuals.peerCheckedBg}`}></div>
                    </label>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Rewards advance <span className="font-bold capitalize">{rule.meal_type}</span> orders placed before cutoff time. Evaluated strictly via server time.
                </p>

                {/* Inputs */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Discount Percentage (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={rule.discount_percentage}
                        onChange={(e) => handleRuleChange(rule.meal_type, 'discount_percentage', e.target.value)}
                        disabled={!rule.is_enabled}
                        className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 ${visuals.ringFocus} outline-none disabled:opacity-50 transition-all pr-8`}
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Cutoff Time (HH:MM 24-Hour)
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={rule.cutoff_time}
                        onChange={(e) => handleRuleChange(rule.meal_type, 'cutoff_time', e.target.value)}
                        disabled={!rule.is_enabled}
                        className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 ${visuals.ringFocus} outline-none disabled:opacity-50 transition-all cursor-pointer`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Preview Box */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                rule.is_enabled
                  ? visuals.previewBg
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-1">
                  <Clock className={`w-3.5 h-3.5 ${visuals.clockText}`} />
                  <span>Live Rule Preview</span>
                </div>
                <p className="text-xs font-semibold leading-snug">
                  {rule.is_enabled ? (
                    <>
                      <span className="capitalize">{rule.meal_type}</span> orders placed before <strong className={visuals.boldText}>{rule.cutoff_time}</strong> receive <strong className={visuals.boldText}>{rule.discount_percentage}% OFF</strong>.
                    </>
                  ) : (
                    `Early ${rule.meal_type} Discount is disabled. Standard pricing applies.`
                  )}
                </p>
              </div>
            </div>
          );
        })}

      </div>

      {/* System Policy & Precedence Architecture Banner */}
      <div className="bg-slate-900 text-slate-200 rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white tracking-tight">
              Precedence & No-Stacking Business Rule
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              1. <strong>New User Welcome Deal</strong> takes absolute priority for any meal while active.<br />
              2. <strong>Early Category Discounts</strong> apply once the new-user window expires based on respective category cutoffs.<br />
              3. <strong>Zero Stacking:</strong> Only ONE discount rule ever applies to an order. All evaluations use server time.
            </p>
          </div>
        </div>

        {updatedByAdmin && (
          <div className="bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700/80 text-right shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Last Updated By
            </span>
            <span className="text-xs font-bold text-white block">
              {updatedByAdmin.username} ({updatedByAdmin.role})
            </span>
          </div>
        )}
      </div>

      {/* Audit Log Trail */}
      {auditLogs.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Recent Settings Audit Trail
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-extrabold">Timestamp</th>
                  <th className="py-2.5 px-3 font-extrabold">Updated By</th>
                  <th className="py-2.5 px-3 font-extrabold">Modified Fields</th>
                  <th className="py-2.5 px-3 font-extrabold">Changes Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{log.admin_username}</span>{' '}
                      <span className="text-[10px] text-slate-400">({log.admin_role})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(log.changed_fields || []).map((f) => (
                          <span
                            key={f}
                            className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md"
                          >
                            {f.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      {(log.changed_fields || []).slice(0, 2).map((f) => (
                        <span key={f} className="block truncate max-w-xs">
                          {f}: {String(log.previous_values?.[f])} → {String(log.new_values?.[f])}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Add New Dynamic Discount Rule */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add Discount Rule</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Create early-order discount rule for any meal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meal Type Category
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    placeholder="e.g. beverages, brunch, snacks"
                    value={newRule.meal_type}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                      setNewRule({
                        ...newRule,
                        meal_type: val,
                        display_name: `Early ${val ? val.charAt(0).toUpperCase() + val.slice(1) : ''} Discount`,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  {availableWindows.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center pt-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Existing:</span>
                      {availableWindows.map((w) => (
                        <button
                          key={w.meal_type}
                          type="button"
                          onClick={() => {
                            const val = w.meal_type.toLowerCase();
                            setNewRule({
                              ...newRule,
                              meal_type: val,
                              display_name: `Early ${val.charAt(0).toUpperCase() + val.slice(1)} Discount`,
                            });
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                            newRule.meal_type === w.meal_type.toLowerCase()
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {w.meal_type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Rule Display Name
                </label>
                <input
                  type="text"
                  required
                  value={newRule.display_name}
                  onChange={(e) => setNewRule({ ...newRule, display_name: e.target.value })}
                  placeholder="e.g. Early Beverages Discount"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={newRule.discount_percentage}
                    onChange={(e) => setNewRule({ ...newRule, discount_percentage: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cutoff Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newRule.cutoff_time}
                    onChange={(e) => setNewRule({ ...newRule, cutoff_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800">Enable Discount Rule</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newRule.is_enabled}
                    onChange={(e) => setNewRule({ ...newRule, is_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRule}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creatingRule ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Rule...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Discount Rule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
