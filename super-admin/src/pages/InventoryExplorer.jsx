import React, { useState, useEffect } from 'react';
import { Boxes, Search, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function InventoryExplorer() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/data/inventory');
      if (res.data.success) {
        setInventory(res.data.inventory || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = inventory.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.unique_inventory_id?.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = inventory.filter((i) => Number(i.quantity_in_stock) <= Number(i.low_stock_threshold)).length;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-purple-400" />
            <span>Cafe D Cruze Kitchen Inventory & Ingredients</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Database records of kitchen stocks, units, automated deductions, and re-order thresholds
          </p>
        </div>

        <button
          onClick={fetchInventory}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* Stock Health Banner if low stock */}
      {lowStockCount > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-bold animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{lowStockCount} ingredient(s) are currently at or below their low-stock safety threshold!</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredient, category, or ID (e.g. INV-001)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 outline-none font-medium"
          />
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-purple-500 animate-spin" />
          <span>Reading inventory records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-[#0f172a] rounded-3xl border border-slate-800 text-slate-400 text-xs font-medium space-y-3">
          <Boxes className="w-10 h-10 text-slate-600 mx-auto" />
          <p>No inventory items found matching your search query.</p>
        </div>
      ) : (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                  <th className="p-4">Item ID & Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Quantity in Stock</th>
                  <th className="p-4">Low Stock Threshold</th>
                  <th className="p-4">Stock Status</th>
                  <th className="p-4 text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filtered.map((item) => {
                  const isLow = Number(item.quantity_in_stock) <= Number(item.low_stock_threshold);
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{item.name}</div>
                        <span className="text-[11px] text-purple-400 font-mono font-bold">
                          {item.unique_inventory_id}
                        </span>
                      </td>

                      <td className="p-4 text-slate-300 capitalize">
                        {item.category || 'General'}
                      </td>

                      <td className="p-4">
                        <span className={`font-black text-sm font-mono ${isLow ? 'text-red-400' : 'text-white'}`}>
                          {Number(item.quantity_in_stock).toFixed(2)}
                        </span>
                        <span className="text-slate-400 text-xs ml-1 font-semibold">{item.unit}</span>
                      </td>

                      <td className="p-4 text-slate-400 font-mono">
                        {Number(item.low_stock_threshold).toFixed(2)} {item.unit}
                      </td>

                      <td className="p-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/15 text-red-400 border border-red-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Low Stock Alert</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Healthy Stock</span>
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right text-slate-500 font-mono text-[11px]">
                        {new Date(item.updated_at || item.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
