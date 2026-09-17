import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, CheckCircle2, XCircle, Mail, Copy, Check, Clock, AlertCircle, X, Trash2 } from 'lucide-react';
import api from '../services/api';

export default function StaffManagement() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetAccount, setDeleteTargetAccount] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [password, setPassword] = useState('');
  
  const [createdInviteLink, setCreatedInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchStaffAccounts();
  }, []);

  const fetchStaffAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/admin/staff');
      if (res.data.success) {
        setAccounts(res.data.accounts);
      }
    } catch (err) {
      console.error('Error fetching staff accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setCreatedInviteLink('');

    try {
      const res = await api.post('/auth/admin/staff', { username, email, role, password });
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setCreatedInviteLink(res.data.inviteLink);
        fetchStaffAccounts();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create staff account.');
    }
  };

  const handleToggleStatus = async (account) => {
    try {
      const res = await api.patch(`/auth/admin/staff/${account._id}/toggle`);
      if (res.data.success) {
        setAccounts((prev) =>
          prev.map((acc) => (acc._id === account._id ? { ...acc, is_active: res.data.is_active } : acc))
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update account status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetAccount) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/auth/admin/staff/${deleteTargetAccount._id}`);
      if (res.data.success) {
        setAccounts((prev) => prev.filter((acc) => acc._id !== deleteTargetAccount._id));
        setDeleteTargetAccount(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete staff account from database.');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Staff Account Management</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Super Admin control panel to create staff accounts and audit activity
          </p>
        </div>

        {/* =========================================================================
            SECTION TO CREATE/REGISTER NEW STAFF - CURRENTLY COMMENTED OUT
            (Uncomment this block in the future if staff creation is needed)
            ========================================================================= */}
        {/* 
        <button
          onClick={() => {
            setUsername('');
            setEmail('');
            setPassword('');
            setRole('staff');
            setCreatedInviteLink('');
            setErrorMsg('');
            setSuccessMsg('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95"
        >
          <UserPlus className="w-5 h-5" />
          <span>Create New Staff Account</span>
        </button>
        */}
      </div>

      {/* Staff Accounts List Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 font-bold">Loading staff directory...</div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4">Created By</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {accounts.map((acc) => (
                  <tr key={acc._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div>{acc.username}</div>
                      <div className="text-[11px] font-normal text-slate-500">{acc.email}</div>
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                        acc.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {acc.role === 'super_admin' ? 'Super Admin' : 'Staff'}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        acc.is_active ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {acc.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{acc.is_active ? 'Active' : 'Deactivated'}</span>
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`text-[11px] font-bold ${acc.is_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {acc.is_verified ? 'Verified (Password Set)' : 'Pending Link Setup'}
                      </span>
                    </td>

                    <td className="p-4 text-slate-600">
                      {acc.created_by?.username || 'System Seed'}
                    </td>

                    <td className="p-4 text-slate-600">
                      {acc.last_login_at ? new Date(acc.last_login_at).toLocaleString() : 'Never'}
                    </td>

                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleStatus(acc)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-colors ${
                          acc.is_active
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {acc.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      {acc.role !== 'super_admin' && (
                        <button
                          onClick={() => setDeleteTargetAccount(acc)}
                          className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Delete staff account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE STAFF ACCOUNT MODAL - CURRENTLY COMMENTED OUT
          (Uncomment this block in the future if staff modal is needed)
          ========================================================================= */}
      {/* 
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Create Staff Account</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" /> {successMsg}
                </div>
                {createdInviteLink && (
                  <div className="mt-2 p-2 bg-white rounded-lg border border-emerald-200">
                    <p className="text-[11px] text-slate-500 font-bold mb-1">Dev Invitation Link:</p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={createdInviteLink}
                        className="w-full text-[10px] font-mono bg-slate-50 p-1.5 rounded border outline-none select-all"
                      />
                      <button
                        onClick={() => copyToClipboard(createdInviteLink)}
                        className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!createdInviteLink && (
              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="chef_rahul"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@canteen.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="Leave blank to send email setup link"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role Assignment</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                  >
                    <option value="staff">Staff (Kitchen Screen, Menu, Timings)</option>
                    <option value="super_admin">Super Admin (Full Access + Account Mgmt)</option>
                  </select>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Creating an account sends an email invite with a password-creation link. Self-service admin signup is disabled.
                </p>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all"
                >
                  Generate Invitation & Create Account
                </button>
              </form>
            )}

          </div>
        </div>
      )}
      */}

      {/* Delete Account Confirmation Modal */}
      {deleteTargetAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 text-slate-900 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Delete Staff Account</h3>
                <p className="text-xs text-slate-500 font-semibold">Confirm permanent database deletion</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Are you sure you want to permanently delete staff account <strong className="text-slate-900">{deleteTargetAccount.username}</strong> ({deleteTargetAccount.email}) from the database? This record will be removed permanently and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetAccount(null)}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                {deleting ? 'Removing...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
