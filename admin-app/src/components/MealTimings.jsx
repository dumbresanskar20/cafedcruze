import React, { useState, useEffect } from 'react';
import { Clock, Save, Check, AlertCircle, Sparkles, Sun, CheckCircle, Bell, Eye, EyeOff, Utensils, Edit2, X } from 'lucide-react';
import api from '../services/api';

const DEFAULT_SERVING_TIMES = {
  breakfast: '08:30',
  lunch: '12:30',
  snacks: '16:30',
  dinner: '19:30',
};

const format12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = String(time24).split(':').map(Number);
  if (isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  const minutes = String(m || 0).padStart(2, '0');
  return `${hours12}:${minutes} ${period}`;
};

export default function MealTimings() {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState({});
  const [notification, setNotification] = useState(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const MEAL_ICONS = {
    breakfast: '🌅',
    lunch: '☀️',
    snacks: '☕',
    dinner: '🌙',
  };

  useEffect(() => {
    fetchMealWindows();

    const clockTimer = setInterval(() => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 10000);

    return () => clearInterval(clockTimer);
  }, []);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchMealWindows = async () => {
    setLoading(true);
    try {
      const res = await api.get('/menu/windows');
      if (res.data.success) {
        const standardOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const existingMap = {};
        const allFetched = res.data.windows || [];
        allFetched.forEach((w) => {
          existingMap[w.meal_type.toLowerCase()] = w;
        });

        // 1. Include standard 4 meal categories in order
        const fullWindows = standardOrder.map((type) => {
          if (existingMap[type]) {
            return {
              ...existingMap[type],
              is_active: Boolean(existingMap[type].is_active),
              is_full_day: Boolean(existingMap[type].is_full_day),
              serving_start_time: existingMap[type].serving_start_time || DEFAULT_SERVING_TIMES[type] || '12:30',
              custom_note: existingMap[type].custom_note || '',
            };
          }
          return {
            meal_type: type,
            start_time: '08:00',
            end_time: '20:00',
            serving_start_time: DEFAULT_SERVING_TIMES[type] || '12:30',
            custom_note: '',
            is_active: true,
            is_full_day: false,
          };
        });

        // 2. Append any custom meal types registered in the system
        allFetched.forEach((w) => {
          const type = (w.meal_type || '').toLowerCase();
          if (!standardOrder.includes(type)) {
            fullWindows.push({
              ...w,
              is_active: Boolean(w.is_active),
              is_full_day: Boolean(w.is_full_day),
              serving_start_time: w.serving_start_time || w.start_time || '12:00',
              custom_note: w.custom_note || '',
            });
          }
        });

        setWindows(fullWindows);
      }
    } catch (err) {
      showToast('Error loading meal window timings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = (index) => {
    const updated = [...windows];
    updated[index].is_active = !Boolean(updated[index].is_active);
    setWindows(updated);
  };

  const handleToggleFullDay = (index) => {
    const updated = [...windows];
    updated[index].is_full_day = !Boolean(updated[index].is_full_day);
    setWindows(updated);
  };

  const handleTimingChange = (index, field, value) => {
    const updated = [...windows];
    updated[index][field] = value;
    setWindows(updated);
  };

  const handleSaveWindow = async (windowItem, index) => {
    setSavingMap((prev) => ({ ...prev, [windowItem.meal_type]: true }));
    try {
      const res = await api.put(`/menu/windows/${windowItem.meal_type}`, {
        start_time: windowItem.start_time,
        end_time: windowItem.end_time,
        serving_start_time: windowItem.serving_start_time,
        custom_note: windowItem.custom_note,
        is_active: Boolean(windowItem.is_active),
        is_full_day: Boolean(windowItem.is_full_day),
      });

      if (res.data.success && res.data.window) {
        const updated = [...windows];
        updated[index] = {
          ...res.data.window,
          is_active: Boolean(res.data.window.is_active),
          is_full_day: Boolean(res.data.window.is_full_day),
          custom_note: res.data.window.custom_note || '',
        };
        setWindows(updated);
      }

      const activeStatusText = windowItem.is_active ? 'ACTIVE' : 'OFFERED OFF';
      const servingStartText = `Service starts at ${format12Hour(windowItem.serving_start_time)}`;
      showToast(`${windowItem.meal_type.toUpperCase()} saved: ${activeStatusText} (${servingStartText})!`);
    } catch (err) {
      showToast("Couldn't save timing updates.", 'error');
    } finally {
      setSavingMap((prev) => ({ ...prev, [windowItem.meal_type]: false }));
    }
  };

  const openRenameModal = (mealType) => {
    setRenameTarget(mealType);
    setRenameNewName(mealType);
    setRenameModalOpen(true);
  };

  const handleRenameMealType = async (e) => {
    e.preventDefault();
    if (!renameTarget || !renameNewName.trim()) return;

    const cleanNew = renameNewName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (cleanNew.length < 2) {
      showToast('Meal type name must be at least 2 characters.', 'error');
      return;
    }
    if (cleanNew === renameTarget.toLowerCase()) {
      setRenameModalOpen(false);
      return;
    }

    setRenaming(true);
    try {
      const res = await api.put(`/menu/meal-types/${renameTarget}/rename`, {
        new_meal_type: cleanNew,
      });
      if (res.data && res.data.success) {
        showToast(`🎉 Renamed '${renameTarget}' to '${cleanNew}' successfully!`);
        setRenameModalOpen(false);
        fetchMealWindows();
      } else {
        showToast(res.data?.message || 'Failed to rename meal type.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error renaming meal type.', 'error');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border font-bold text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600" /> : <Check className="w-5 h-5 text-emerald-600" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Meal Timing Schedules</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Configure meal offering availability (ON/OFF), Full-Day 24/7 ordering, or specific time windows for Breakfast, Lunch, Snacks, &amp; Dinner.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-extrabold text-slate-700">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Server Time: {format12Hour(currentTime)}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading meal configuration...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {windows.map((w, idx) => {
            const isSaving = savingMap[w.meal_type];
            const capitalizedMeal = w.meal_type.charAt(0).toUpperCase() + w.meal_type.slice(1);

            // Calculate formatted serving time for dynamic text (no leading zero on hour to match "9:00 AM")
            const servingTime = w.serving_start_time || DEFAULT_SERVING_TIMES[w.meal_type.toLowerCase()] || '12:30';
            const formattedServingTime = format12Hour(servingTime);

            const iconMap = {
              breakfast: { emoji: '🌅', gradient: 'from-amber-400 to-orange-500' },
              lunch: { emoji: '☀️', gradient: 'from-amber-300 to-yellow-500' },
              snacks: { emoji: '☕', gradient: 'from-orange-400 to-amber-600' },
              dinner: { emoji: '🌙', gradient: 'from-indigo-500 to-purple-600' },
            };
            const visual = iconMap[w.meal_type.toLowerCase()] || { emoji: '🍱', gradient: 'from-emerald-400 to-teal-500' };

            return (
              <div
                key={w.meal_type}
                className="bg-white rounded-3xl border border-slate-200/90 p-6 space-y-4 shadow-sm"
              >
                {/* 1. Header & Active Switch */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-xl shadow-xs select-none shrink-0`}>
                      {visual.emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-xl capitalize text-slate-900 leading-tight">
                          {w.meal_type}
                        </h3>
                        <button
                          type="button"
                          onClick={() => openRenameModal(w.meal_type)}
                          title={`Rename '${w.meal_type}'`}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mt-0.5">
                        SHOWN IN STUDENT APP
                      </p>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        w.is_active ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {w.is_active ? 'ACTIVE' : 'OFF'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(idx)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                        w.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                          w.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 2. Full-Day Ordering Sub-Card */}
                <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Sun className="w-3.5 h-3.5" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        FULL-DAY ORDERING
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {w.is_full_day ? 'ON (24/7)' : 'OFF (TIME WINDOW)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleFullDay(idx)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                          w.is_full_day ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-md ${
                            w.is_full_day ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] font-medium text-slate-500">
                    {w.is_full_day
                      ? 'Full-day 24/7 ordering enabled with no cutoff.'
                      : 'Ordering is restricted between opening and closing time window hours below.'}
                  </p>
                </div>

                {/* 3. Meal Service Start Time (Shown on Note) — The Golden Box */}
                <div className="p-4 rounded-2xl border border-amber-300/80 bg-amber-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 uppercase tracking-wider">
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                      <span>MEAL SERVICE START TIME (SHOWN ON NOTE)</span>
                    </div>

                    <span className="bg-amber-200/90 text-amber-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                      Shown on Student App
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
                    <div className="sm:col-span-5">
                      <input
                        type="time"
                        value={
                          w.serving_start_time ||
                          DEFAULT_SERVING_TIMES[w.meal_type.toLowerCase()] ||
                          '12:30'
                        }
                        onChange={(e) =>
                          handleTimingChange(idx, 'serving_start_time', e.target.value)
                        }
                        className="w-full px-3.5 py-2 bg-white border border-amber-300/90 rounded-xl text-sm font-black text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none shadow-2xs"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <p className="text-[11px] font-medium text-amber-950 leading-relaxed">
                        Specifies when <strong className="font-bold">{w.meal_type.toLowerCase()}</strong> distribution starts.
                        This time is displayed on the student website so students always know when meal service starts!
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Ordering System Window (Open / Close) - Hidden when Full-Day is ON */}
                {!w.is_full_day && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>ORDERING SYSTEM WINDOW (OPEN / CLOSE)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Ordering Start Time
                        </label>
                        <input
                          type="time"
                          value={w.start_time || '08:00'}
                          onChange={(e) => handleTimingChange(idx, 'start_time', e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-600 outline-none shadow-2xs"
                        />
                        <p className="text-[10px] text-slate-400 font-semibold mt-1">
                          Starts ordering system
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Ordering End Time
                        </label>
                        <input
                          type="time"
                          value={w.end_time || '20:00'}
                          onChange={(e) => handleTimingChange(idx, 'end_time', e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-600 outline-none shadow-2xs"
                        />
                        <p className="text-[10px] text-slate-400 font-semibold mt-1">
                          Closes ordering system
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Live Student Note Preview */}
                <div className="border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5 bg-slate-50/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">
                      <span className="text-slate-400 text-sm leading-none">⊚</span>
                      <span>LIVE STUDENT NOTE PREVIEW</span>
                    </div>

                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      Auto-generated
                    </span>
                  </div>

                  <div className="p-3 bg-amber-100/70 border border-amber-200 rounded-xl text-xs shadow-2xs">
                    <p className="text-amber-950 text-[12px] leading-relaxed">
                      <strong className="font-bold">Note:</strong> {capitalizedMeal} will start from{' '}
                      <strong className="font-bold">{formattedServingTime}</strong>. Orders placed now will be served starting at{' '}
                      <strong className="font-bold">{formattedServingTime}</strong>.
                    </p>
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                    <span>ⓘ</span>
                    <span>
                      Visible on the student website whenever this meal category is active.
                    </span>
                  </p>
                </div>

                {/* 6. Save CTA Button */}
                <button
                  onClick={() => handleSaveWindow(w, idx)}
                  disabled={isSaving}
                  className="w-full py-3 bg-[#0b1329] hover:bg-slate-900 text-white font-extrabold text-xs tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <span>Saving to Database...</span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save {w.meal_type.toUpperCase()} Settings</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename Modal */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Rename Meal Type</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Update category name across timings, menu & rules</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameMealType} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Name
                </label>
                <input
                  type="text"
                  disabled
                  value={renameTarget}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed capitalize"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Meal Type Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Breakfast, Brunch, Refreshments"
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Will be saved as: <span className="font-bold text-slate-700">{renameNewName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || '...'}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Automatic Synchronization</span>
                </div>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Renaming will automatically update all existing menu items, meal timing schedules, order records, and discount rules linked to <strong className="capitalize font-bold">{renameTarget}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {renaming ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Renaming...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save New Name</span>
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

