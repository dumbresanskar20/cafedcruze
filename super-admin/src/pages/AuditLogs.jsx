import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Search, Filter, RefreshCw, Eye, 
  Calendar, ArrowRight, UserCheck, Layers, Sparkles
} from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Diff inspection modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/audit-logs?action=${actionFilter}&search=${encodeURIComponent(search)}&page=${page}&limit=25`
      );
      if (res.data.success) {
        setLogs(res.data.logs || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalLogs(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionColor = (action) => {
    if (action?.includes('SUSPEND')) return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (action?.includes('UNSUSPEND') || action?.includes('CREATE')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (action?.includes('PRICE')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    if (action?.includes('TRIAL')) return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
            Security & Governance Audit Trail
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Immutable log of all super-admin actions, pricing modifications, and organization status shifts
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor name, email, client name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-auto px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          >
            <option value="">All Action Types</option>
            <option value="CLIENT_CREATE">CLIENT_CREATE</option>
            <option value="CLIENT_UPDATE">CLIENT_UPDATE</option>
            <option value="CLIENT_SUSPEND">CLIENT_SUSPEND</option>
            <option value="CLIENT_UNSUSPEND">CLIENT_UNSUSPEND</option>
            <option value="CLIENT_STATUS_CHANGE">CLIENT_STATUS_CHANGE</option>
            <option value="CLIENT_ACCESS_TOGGLE">CLIENT_ACCESS_TOGGLE</option>
            <option value="TRIAL_EXTEND">TRIAL_EXTEND</option>
            <option value="SUBSCRIPTION_UPDATE">SUBSCRIPTION_UPDATE</option>
            <option value="PLAN_CREATE">PLAN_CREATE</option>
            <option value="PLAN_UPDATE">PLAN_UPDATE</option>
            <option value="PLAN_PRICE_CHANGE">PLAN_PRICE_CHANGE</option>
            <option value="AUTO_EXPIRE_TRIAL">AUTO_EXPIRE_TRIAL</option>
            <option value="AUTO_EXPIRE_SUBSCRIPTION">AUTO_EXPIRE_SUBSCRIPTION</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
          <span>Fetching audit stream...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center bg-[#0f172a] rounded-3xl border border-slate-800 text-slate-400 text-xs font-medium space-y-3">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
          <p>No audit log records found matching the query.</p>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target Organization</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-4 text-slate-400 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wider ${getActionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="p-4">
                      {log.client_name ? (
                        <span className="font-bold text-white">{log.client_name}</span>
                      ) : (
                        <span className="text-slate-500">System Wide / Global</span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="text-slate-200 font-semibold">{log.actor_name}</div>
                      <div className="text-[10px] text-slate-400">{log.actor_email}</div>
                    </td>

                    <td className="p-4 text-slate-500 font-mono text-[11px]">
                      {log.ip_address || '—'}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 hover:text-white text-slate-300 font-bold rounded-xl border border-slate-800 transition-colors cursor-pointer text-[11px] inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Diff</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {logs.length} of {totalLogs} events (Page {page} of {totalPages})
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white rounded-xl border border-slate-800 font-bold transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white rounded-xl border border-slate-800 font-bold transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DIFF / PAYLOAD INSPECTION MODAL
          ========================================================================= */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Payload: ${selectedLog.action}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Actor</span>
                <span className="font-bold text-white">{selectedLog.actor_name}</span> ({selectedLog.actor_email})
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Timestamp</span>
                <span className="font-mono text-slate-200">{new Date(selectedLog.created_at).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {selectedLog.before_value && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Before Value</span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.before_value, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.after_value && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">After Value / Recorded Changes</span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.after_value, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
