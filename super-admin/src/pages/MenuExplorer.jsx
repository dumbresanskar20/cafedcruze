import React, { useState, useEffect } from 'react';
import { Utensils, Search, RefreshCw, CheckCircle2, XCircle, IndianRupee } from 'lucide-react';
import api from '../services/api';

export default function MenuExplorer() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mealFilter, setMealFilter] = useState('');

  useEffect(() => {
    fetchMenu();
  }, [mealFilter]);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/data/menu?meal_type=${mealFilter}`);
      if (res.data.success) {
        setMenuItems(res.data.menuItems || []);
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
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
            <Utensils className="w-6 h-6 text-amber-400" />
            <span>Cafe D Cruze Restaurant Menu Catalog</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Database records of all breakfast, lunch, snacks, and dinner dishes available for booking
          </p>
        </div>

        <button
          onClick={fetchMenu}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Menu</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: '', label: 'All Dishes' },
          { id: 'breakfast', label: 'Breakfast' },
          { id: 'lunch', label: 'Lunch' },
          { id: 'snacks', label: 'Snacks' },
          { id: 'dinner', label: 'Dinner' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMealFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              mealFilter === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
          <span>Loading menu catalog...</span>
        </div>
      ) : menuItems.length === 0 ? (
        <div className="py-16 text-center bg-[#0f172a] rounded-3xl border border-slate-800 text-slate-400 text-xs font-medium space-y-3">
          <Utensils className="w-10 h-10 text-slate-600 mx-auto" />
          <p>No dishes registered in this meal category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="relative h-36 bg-slate-900 overflow-hidden">
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-black/75 backdrop-blur-xs text-amber-300 border border-white/10">
                    {item.meal_type}
                  </span>
                </div>

                <div className="p-4 space-y-1.5">
                  <h3 className="font-bold text-white text-sm leading-tight">{item.name}</h3>
                  {item.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 pt-0 flex items-center justify-between border-t border-slate-800/80 mt-2">
                <span className="text-base font-black text-white font-mono">
                  ₹{Number(item.price).toFixed(2)}
                </span>

                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                    item.is_active
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {item.is_active ? 'Active' : 'Hidden'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
