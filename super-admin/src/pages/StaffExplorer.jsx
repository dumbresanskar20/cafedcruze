import React, { useState, useEffect } from 'react';
import { UserCog, Search, RefreshCw, ShieldCheck, CheckCircle2, XCircle, Mail, Clock } from 'lucide-react';
import api from '../services/api';

export default function StaffExplorer() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/data/staff');
      if (res.data.success) {
        setStaff(res.data.staff || []);
      }
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <UserCog className="w-6 h-6 text-rose-400" />
            <span>Cafe D Cruze Restaurant Staff & Admin Accounts</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Database records of authorized canteen managers, kitchen staff, and terminal operators
          </p>
        </div>

        <button
          onClick={fetchStaff}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Staff</span>
        </button>
      </div>

      {/* Staff Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-rose-500 animate-spin" />
          <span>Reading staff accounts...</span>
        </div>
      ) : staff.length === 0 ? (
        <div className="py-16 text-center bg-[#0f172a] rounded-3xl border border-slate-800 text-slate-400 text-xs font-medium space-y-3">
          <UserCog className="w-10 h-10 text-slate-600 mx-auto" />
          <p>No staff or admin accounts registered in database.</p>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                  <th className="p-4">Username & Email</th>
                  <th className="p-4">Role Privileges</th>
                  <th className="p-4">Account Status</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {staff.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{u.username}</div>
                      <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{u.email}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'super_admin'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : u.role === 'admin'
                            ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {u.role === 'super_admin' ? 'Canteen Manager (Admin)' : u.role === 'staff' ? 'Kitchen Staff' : u.role}
                      </span>
                    </td>

                    <td className="p-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      {u.is_verified ? (
                        <span className="text-slate-300 text-xs font-semibold">Verified</span>
                      ) : (
                        <span className="text-amber-400 text-xs font-semibold">Invite Pending</span>
                      )}
                    </td>

                    <td className="p-4 text-slate-400 text-[11px] font-mono">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never logged in'}
                    </td>

                    <td className="p-4 text-right text-slate-500 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
