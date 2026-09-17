import React, { useState, useEffect } from 'react';
import { X, Star, CheckCircle, MessageSquare, Utensils } from 'lucide-react';
import api from '../services/api';
import CAFE_D_CRUZE_LOGO from '../assets/logo';

export default function RatingModal({ order, isOpen, onClose, onRatingSubmitted }) {
  const [itemRatings, setItemRatings] = useState({});
  const [itemReviews, setItemReviews] = useState({});
  const [hoveredStars, setHoveredStars] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      setSubmitted(false);
      setErrorMessage('');

      // Initialize default 5-star ratings for all items in the order
      const initialRatings = {};
      const initialReviews = {};
      const items = order.items || [];

      items.forEach((it) => {
        const itemId = it.menu_item_id || it._id || it.id;
        if (itemId) {
          initialRatings[itemId] = 5;
          initialReviews[itemId] = '';
        }
      });

      setItemRatings(initialRatings);
      setItemReviews(initialReviews);

      // Fetch existing reviews if previously submitted
      fetchExistingReviews();
    }
  }, [isOpen, order]);

  const fetchExistingReviews = async () => {
    if (!order) return;
    const orderId = order._id || order.id;
    setLoading(true);
    try {
      const res = await api.get(`/reviews/order/${orderId}`);
      if (res.data.success && Array.isArray(res.data.reviews) && res.data.reviews.length > 0) {
        const existingRatings = {};
        const existingReviews = {};
        res.data.reviews.forEach((r) => {
          existingRatings[r.menu_item_id] = Number(r.rating);
          existingReviews[r.menu_item_id] = r.review_text || '';
        });
        setItemRatings((prev) => ({ ...prev, ...existingRatings }));
        setItemReviews((prev) => ({ ...prev, ...existingReviews }));
      }
    } catch (err) {
      console.warn('Could not fetch existing reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !order) return null;

  const items = order.items || [];
  const orderId = order._id || order.id;

  const handleStarClick = (itemId, starValue) => {
    setItemRatings((prev) => ({
      ...prev,
      [itemId]: starValue,
    }));
  };

  const handleReviewChange = (itemId, text) => {
    setItemReviews((prev) => ({
      ...prev,
      [itemId]: text,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    const ratingsPayload = items.map((it) => {
      const itemId = it.menu_item_id || it._id || it.id;
      return {
        menu_item_id: it.menu_item_id || it.menu_item || null,
        order_item_id: it.id || it._id || null,
        item_name: it.item_name || it.name,
        rating: itemRatings[itemId] || itemRatings[it.item_name] || 5,
        review_text: itemReviews[itemId] || itemReviews[it.item_name] || '',
      };
    });

    try {
      const res = await api.post('/reviews/rate-order', {
        order_id: orderId,
        ratings: ratingsPayload,
      });

      if (res.data.success) {
        setSubmitted(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rating_submitted', {
            detail: { order_id: orderId, meal_type: order.meal_type, ratings: ratingsPayload },
          }));
        }
        if (onRatingSubmitted) {
          onRatingSubmitted(orderId, ratingsPayload);
        }
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setErrorMessage(res.data.message || 'Failed to submit ratings.');
      }
    } catch (err) {
      console.error('Rating submit error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Error submitting your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-100 p-5 sm:p-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-lg font-black shrink-0">
              ⭐
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-extrabold text-base sm:text-lg text-brand-dark truncate">
                Rate Your Meal
              </h3>
              <p className="text-[11px] text-stone-500 font-semibold truncate">
                Token #{order.token_number} • {order.meal_type?.toUpperCase()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Message Banner */}
        {submitted ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto animate-bounce">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-extrabold text-stone-900">Thank You For Your Feedback!</h4>
            <p className="text-xs text-stone-500 max-w-xs mx-auto font-medium">
              Your review helps the campus canteen serve you better delicious meals every day.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            {loading ? (
              <div className="py-8 text-center text-xs text-stone-400 font-semibold animate-pulse">
                Loading meal details...
              </div>
            ) : items.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-500 font-medium">
                No items found for this order.
              </div>
            ) : (
              items.map((it, idx) => {
                const itemId = it.menu_item_id || it._id || it.id || idx;
                const currentRating = itemRatings[itemId] || 5;
                const currentHover = hoveredStars[itemId] || 0;
                const currentReview = itemReviews[itemId] || '';

                return (
                  <div
                    key={itemId}
                    className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                          {it.item_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 font-semibold shrink-0">
                        Qty: {it.quantity}
                      </span>
                    </div>

                    {/* Interactive Star Rating Selector */}
                    <div className="flex items-center gap-1.5 py-1">
                      {[1, 2, 3, 4, 5].map((starVal) => {
                        const isFilled = (currentHover || currentRating) >= starVal;
                        return (
                          <button
                            key={starVal}
                            type="button"
                            onClick={() => handleStarClick(itemId, starVal)}
                            onMouseEnter={() => setHoveredStars((prev) => ({ ...prev, [itemId]: starVal }))}
                            onMouseLeave={() => setHoveredStars((prev) => ({ ...prev, [itemId]: 0 }))}
                            className="p-1 text-2xl transition-transform active:scale-125 focus:outline-none cursor-pointer"
                            aria-label={`${starVal} Star`}
                          >
                            <Star
                              className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                                isFilled
                                  ? 'fill-amber-400 text-amber-400 filter drop-shadow-xs'
                                  : 'text-stone-300'
                              }`}
                            />
                          </button>
                        );
                      })}
                      <span className="ml-2 text-xs font-black text-amber-600">
                        {currentRating} / 5
                      </span>
                    </div>

                    {/* Optional Review Text Field */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        <MessageSquare className="w-3 h-3 text-stone-400" />
                        <span>Write a Review (Optional)</span>
                      </div>
                      <textarea
                        rows={2}
                        value={currentReview}
                        onChange={(e) => handleReviewChange(itemId, e.target.value)}
                        placeholder={`What did you think of the ${it.item_name}? (Taste, portion, freshness...)`}
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 outline-none resize-none font-medium"
                      />
                    </div>
                  </div>
                );
              })
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-brand-orange to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span>Submitting Review...</span>
                ) : (
                  <>
                    <span>Submit Rating & Review</span>
                    <span>⭐</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
