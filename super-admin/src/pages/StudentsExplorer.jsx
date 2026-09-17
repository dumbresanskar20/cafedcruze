import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, CheckCircle2, XCircle, ShoppingBag, IndianRupee, Mail, Phone, Calendar } from 'lucide-react';
import api from '../services/api';

export default function StudentsExplorer() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    fetchStudents();
  }, [page]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/data/students?search=${encodeURIComponent(search)}&page=${page}&limit=25`
      );
      if (res.data.success) {
        setStudents(res.data.students || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalStudents(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-sky-400" />
            <span>Registered Campus Students</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Database records of all registered Cafe D Cruze customers & students, verification status, and meal booking activity
          </p>
        </div>

        <button
          onClick={fetchStudents}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, roll no, email, or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none font-medium"
          />
        </form>
      </div>

      {/* Students Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-sky-500 animate-spin" />
          <span>Querying students from database...</span>
        </div>
      ) : students.length === 0 ? (
        <div className="py-16 text-center bg-[#0f172a] rounded-3xl border border-slate-800 text-slate-400 text-xs font-medium space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <p>No student records match your search criteria.</p>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                  <th className="p-4">Student Name & Roll No</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4">Total Orders</th>
                  <th className="p-4">Total Spent</th>
                  <th className="p-4 text-right">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{s.name}</div>
                      <div className="text-[11px] text-sky-400 font-mono font-bold">Roll: {s.roll_no}</div>
                    </td>

                    <td className="p-4">
                      <div className="text-slate-300 text-xs flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{s.email}</span>
                      </div>
                      {s.phone && (
                        <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      {s.is_verified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <XCircle className="w-3 h-3" />
                          <span>Pending OTP</span>
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-slate-200">
                      <span className="font-bold text-white text-xs">{s.total_orders || 0}</span> orders
                    </td>

                    <td className="p-4">
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        ₹{Number(s.total_spent || 0).toFixed(2)}
                      </span>
                    </td>

                    <td className="p-4 text-right text-slate-400 font-mono text-[11px]">
                      {new Date(s.created_at).toLocaleDateString('en-IN', {
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

          {/* Pagination */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {students.length} of {totalStudents} students (Page {page} of {totalPages})
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

    </div>
  );
}
