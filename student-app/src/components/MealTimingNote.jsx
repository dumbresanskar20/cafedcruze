import React from 'react';
import { Clock, Utensils, CheckCircle2 } from 'lucide-react';
import { useCart } from '../context/CartContext';

const DEFAULT_SERVING_TIMES = {
  breakfast: '08:30',
  lunch: '12:30',
  snacks: '16:30',
  dinner: '19:30',
};

const format12HourTime = (time24) => {
  if (!time24) return '';
  const [h, m] = String(time24).split(':').map(Number);
  if (isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  const minutes = String(m || 0).padStart(2, '0');
  return `${hours12}:${minutes} ${period}`;
};

/**
 * MealTimingNote Component
 * ────────────────────────
 * Displays dynamic food service / distribution timing notice configured by Admin.
 *
 * Visibility:
 * - Visible to students whenever the meal category has a meal service start time set.
 * - Dynamically adapts badge and guidance based on whether service is upcoming or ongoing.
 */
export default function MealTimingNote() {
  const { currentMealWindow, selectedMealType, clientCurrentTime } = useCart();

  if (!currentMealWindow) return null;

  // Check if notice is active and visible
  const isVisible = Boolean(currentMealWindow.is_note_visible);
  if (!isVisible) return null;

  const mealKey = (selectedMealType || currentMealWindow.meal_type || 'lunch').toLowerCase();
  const capitalizedMeal = mealKey.charAt(0).toUpperCase() + mealKey.slice(1);

  const rawServingTime =
    currentMealWindow.serving_start_time ||
    DEFAULT_SERVING_TIMES[mealKey] ||
    currentMealWindow.start_time ||
    '12:30';

  const formattedServingTime =
    currentMealWindow.formatted_serving_start_time || format12HourTime(rawServingTime);

  const customNote = currentMealWindow.custom_note && currentMealWindow.custom_note.trim();

  // Determine if service has already started today
  const isStarted = currentMealWindow.is_serving_started ?? (
    clientCurrentTime && rawServingTime ? clientCurrentTime >= rawServingTime : false
  );

  return (
    <div className="mb-5 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-100/60 border-2 border-amber-400/90 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 animate-pulse">
            <Clock className="w-5 h-5 fill-white/20" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm sm:text-base tracking-tight text-amber-950 flex items-center gap-1.5">
                <span>⏰</span>
                <span>{capitalizedMeal} Distribution Notice</span>
              </span>
              <span className="bg-amber-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                {isStarted ? `Service Started ${formattedServingTime}` : `Starts at ${formattedServingTime}`}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-amber-900 font-semibold leading-relaxed">
              {customNote ? (
                <span>{customNote}</span>
              ) : isStarted ? (
                <>
                  <strong className="font-extrabold text-amber-950">Note:</strong> {capitalizedMeal} service started from{' '}
                  <strong className="font-black text-brand-orange bg-amber-200/60 px-1.5 py-0.5 rounded-md">
                    {formattedServingTime}
                  </strong>
                  . Fresh orders are being prepared &amp; served.
                </>
              ) : (
                <>
                  <strong className="font-extrabold text-amber-950">Note:</strong> {capitalizedMeal} service will start from{' '}
                  <strong className="font-black text-brand-orange bg-amber-200/60 px-1.5 py-0.5 rounded-md">
                    {formattedServingTime}
                  </strong>
                  . Orders placed now will be prepared &amp; served starting from {formattedServingTime}.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/90 text-amber-950 text-xs font-black border border-amber-300 shadow-2xs">
            {isStarted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Serving Now (Started {formattedServingTime})
              </>
            ) : (
              <>
                <Utensils className="w-3.5 h-3.5 text-amber-700" />
                Food Ready: {formattedServingTime}
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
