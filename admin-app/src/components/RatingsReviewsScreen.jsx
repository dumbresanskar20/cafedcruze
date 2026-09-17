import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Search, Filter, RefreshCw, ThumbsUp, UtensilsCrossed, Calendar, User, CheckCircle2, ChevronRight } from 'lucide-react';
import api from '../services/api';

export default function RatingsReviewsScreen() {
  const [mealSummary, setMealSummary] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('meals'); // 'meals' or 'feed'

  const fetchReviewsSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('meal_type', selectedCategory);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await api.get(`/reviews/admin/summary?${params.toString()}`);
      if (res.data.success) {
        setMealSummary(res.data.meal_summary || []);
        setRecentReviews(res.data.recent_reviews || []);
        setOverallStats(res.data.overall_stats || null);
      }
    } catch (err) {
      console.error('Error fetching reviews summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewsSummary();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReviewsSummary();
  };

  const resolveFoodImage = (url) => {
    if (!url) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'https://cafe-d-cruze-api.mealbook.in';
    return `${base.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const categories = [
    { id: 'all', label: 'All Meals', icon: '🍱' },
    { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { id: 'lunch', label: 'Lunch', icon: '☀️' },
    { id: 'snacks', label: 'Snacks', icon: '☕' },
    { id: 'dinner', label: 'Dinner', icon: '🌙' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-md shadow-amber-500/20 shrink-0">
            ⭐
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Ratings & Reviews</span>
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Meal-wise average customer satisfaction and student reviews
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReviewsSummary}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh Ratings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-1.5 rounded-2xl flex items-center gap-1.5 font-black text-xs">
            <span>Overall:</span>
            <span className="text-amber-600 text-sm">⭐ {overallStats?.overall_average || '0.0'} / 5.0</span>
          </div>
        </div>
      </div>

      {/* Top Metrics Cards */}
      {overallStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Overall Average */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl border border-slate-700 shadow-md space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
              Average Canteen Rating
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white">
                {overallStats.overall_average > 0 ? Number(overallStats.overall_average).toFixed(1) : 'N/A'}
              </span>
              <span className="text-amber-400 text-lg">★★★★★</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Based on {overallStats.total_reviews} student ratings
            </p>
          </div>

          {/* Total Reviews Count */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Total Student Reviews
            </span>
            <div className="text-3xl sm:text-4xl font-black text-slate-900">
              {overallStats.total_reviews}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Delivered orders feedback collected
            </p>
          </div>

          {/* 5-Star Percentage */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600">
              5-Star Satisfaction
            </span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-600">
              {overallStats.five_star_percentage}%
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {overallStats.breakdown?.[5] || 0} reviews rated 5 stars
            </p>
          </div>
        </div>
      )}

      {/* Filter and View Switcher Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('meals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'meals' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Meal-wise Breakdown
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'feed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Recent Reviews Feed ({recentReviews.length})
            </button>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="relative pt-1">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meal by name (e.g. Tea, Upma, Poha, Thali...)"
            className="w-full pl-10 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-2.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 font-semibold animate-pulse bg-white rounded-3xl border border-slate-200">
          Loading meal ratings & analytics...
        </div>
      ) : activeTab === 'meals' ? (
        /* View 1: Meal-Wise Performance Grid */
        mealSummary.length === 0 ? (
          <div className="p-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
              🍱
            </div>
            <h4 className="text-slate-800 font-bold text-base">No meals found</h4>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Try selecting a different meal category or resetting the search keyword.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mealSummary.map((meal) => {
              const avg = Number(meal.average_rating) || 0;
              const total = Number(meal.total_reviews) || 0;

              return (
                <div
                  key={meal.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
                >
                  {/* Top Item Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveFoodImage(meal.image_url)}
                        alt={meal.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
                        }}
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shadow-xs shrink-0 bg-slate-100"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {meal.meal_type}
                          </span>
                          {!meal.is_active && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 truncate mt-1">
                          {meal.name}
                        </h4>
                        <span className="text-xs font-bold text-slate-500">
                          ₹{meal.price}
                        </span>
                      </div>
                    </div>

                    {/* Overall Rating Badge Row */}
                    <div className="flex items-center justify-between p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80">
                      <div>
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                          Overall Rating
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-2xl font-black text-amber-900">
                            {avg > 0 ? avg.toFixed(1) : 'No Ratings'}
                          </span>
                          {avg > 0 && <span className="text-xs font-extrabold text-amber-600">/ 5.0</span>}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-amber-500 text-base">
                          {'★'.repeat(Math.round(avg))}
                          {'☆'.repeat(5 - Math.round(avg))}
                        </span>
                        <span className="text-[11px] font-semibold text-amber-800 block">
                          {total} {total === 1 ? 'review' : 'reviews'}
                        </span>
                      </div>
                    </div>

                    {/* Star Distribution Progress Bars */}
                    <div className="space-y-1.5 pt-1">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = meal[`stars_${star}`] || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-[11px]">
                            <span className="w-6 font-bold text-slate-500 text-right">{star}★</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className={`h-full rounded-full ${
                                  star >= 4 ? 'bg-amber-400' : star === 3 ? 'bg-amber-300' : 'bg-rose-400'
                                }`}
                              />
                            </div>
                            <span className="w-8 font-semibold text-slate-400 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>ID: #{meal.id}</span>
                    <span className="text-emerald-600 font-bold">
                      {total > 0 ? `${Math.round(((meal.stars_5 || 0) / total) * 100)}% Loved it` : 'Awaiting feedback'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* View 2: Recent Student Reviews Feed */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {recentReviews.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
                💬
              </div>
              <h4 className="text-slate-800 font-bold text-base">No reviews recorded yet</h4>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                Student ratings and review comments will appear here in real time as orders are delivered.
              </p>
            </div>
          ) : (
            recentReviews.map((rev) => (
              <div key={rev.id} className="p-5 hover:bg-slate-50/70 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {rev.student_name ? rev.student_name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-extrabold text-sm text-slate-900">
                          {rev.student_name || 'Student'}
                        </h5>
                        {rev.token_number && (
                          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                            Token #{rev.token_number}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {rev.meal_type}
                        </span>
                      </div>
                      {rev.student_email && (
                        <span className="text-[11px] text-slate-400 block font-medium">
                          {rev.student_email} {rev.student_roll_no ? `• ${rev.student_roll_no}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1">
                      <span>{'★'.repeat(rev.rating)}</span>
                      <span>({rev.rating}/5)</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                      {new Date(rev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Review Item & Comment */}
                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-1 mt-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                    <span>{rev.menu_item_name}</span>
                  </div>
                  {rev.review_text ? (
                    <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
                      "{rev.review_text}"
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 font-medium italic">
                      (No written comment provided with this star rating)
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
