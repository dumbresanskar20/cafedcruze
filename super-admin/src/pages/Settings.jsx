import React, { useState } from 'react';
import { Settings as SettingsIcon, Lock, ShieldCheck, Check, AlertCircle, Eye, EyeOff, Server } from 'lucide-react';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';

export default function Settings() {
  const { admin, changePassword } = useSuperAdminAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const res = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
      
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
          Super-Admin Account & Platform Settings
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          Manage master security credentials and inspect infrastructure parameters
        </p>
      </div>

      {/* Account Profile Card */}
      <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Super-Admin Credentials</h3>
            <p className="text-[11px] text-slate-400">Authenticated with Super-Admin JWT authorization scope</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Name</span>
            <span className="font-bold text-white">{admin?.name || 'Master Super Admin'}</span>
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Email</span>
            <span className="font-bold text-indigo-400 font-mono">{admin?.email || 'superadmin@canteen.com'}</span>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Update Super-Admin Password</h3>
            <p className="text-[11px] text-slate-400">Change your master access password (minimum 6 characters)</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs max-w-md">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Current Password *</label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">New Password *</label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Confirm New Password *</label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="showP"
              checked={showPass}
              onChange={(e) => setShowPass(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <label htmlFor="showP" className="text-slate-400 cursor-pointer select-none">
              Show passwords
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>

      {/* System info */}
      <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-3 text-xs">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-bold text-white">System Architecture & Isolation</h3>
        </div>
        <p className="text-slate-400 leading-relaxed">
          The Super-Admin app is isolated from tenant operational code. All actions perform atomic MySQL mutations and broadcast real-time events to all connected clients and student terminals.
        </p>
      </div>

    </div>
  );
}
