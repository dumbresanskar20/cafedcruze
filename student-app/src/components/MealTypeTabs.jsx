import React, { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';

export default function MealTypeTabs({ navbarHeight = 64 }) {
  const { selectedMealType, setSelectedMealType, activeMealWindows } = useCart();
  const tabsContainerRef = useRef(null);
  const activeTabRef = useRef(null);

  const MEAL_CONFIG = {
    breakfast: { label: 'Breakfast', icon: '🌅' },
    lunch: { label: 'Lunch', icon: '☀️' },
    snacks: { label: 'Snacks', icon: '☕' },
    dinner: { label: 'Dinner', icon: '🌙' },
  };

  // Build list of active meal type buttons dynamically
  const availableMealTypes = (activeMealWindows && activeMealWindows.length > 0)
    ? activeMealWindows.map((w) => {
        const type = w.meal_type.toLowerCase();
        return {
          id: type,
          label: MEAL_CONFIG[type]?.label || type.charAt(0).toUpperCase() + type.slice(1),
          icon: MEAL_CONFIG[type]?.icon || '🍱',
          isCurrentlyOpen: w.is_currently_open,
          startTime: w.formatted_start_time,
          endTime: w.formatted_end_time,
        };
      })
    : [
        { id: 'breakfast', label: 'Breakfast', icon: '🌅', isCurrentlyOpen: true },
        { id: 'lunch', label: 'Lunch', icon: '☀️', isCurrentlyOpen: true },
        { id: 'snacks', label: 'Snacks', icon: '☕', isCurrentlyOpen: true },
        { id: 'dinner', label: 'Dinner', icon: '🌙', isCurrentlyOpen: true },
      ];

  // Auto-scroll active tab into center view if container overflows horizontally
  useEffect(() => {
    if (activeTabRef.current && tabsContainerRef.current) {
      const container = tabsContainerRef.current;
      const tab = activeTabRef.current;

      const containerWidth = container.offsetWidth;
      const tabOffsetLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;

      // Calculate center position
      const scrollTo = tabOffsetLeft - (containerWidth / 2) + (tabWidth / 2);

      container.scrollTo({
        left: Math.max(0, scrollTo),
        behavior: 'smooth',
      });
    }
  }, [selectedMealType]);

  const handleMealSelect = (typeId) => {
    setSelectedMealType(typeId);
  };

  return (
    <div
      style={{ top: `${navbarHeight}px` }}
      className="sticky z-30 bg-[#fffbf5] border-b border-amber-200/80 shadow-xs py-2.5 sm:py-3 transition-all w-full"
    >
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-center">
        <div
          ref={tabsContainerRef}
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-2xl mx-auto px-1 w-full"
        >
          {availableMealTypes.map((meal) => {
            const isSelected = selectedMealType === meal.id;
            const isOpen = meal.isCurrentlyOpen;

            return (
              <button
                key={meal.id}
                ref={isSelected ? activeTabRef : null}
                onClick={() => handleMealSelect(meal.id)}
                className={`min-h-[44px] sm:min-h-[48px] px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2 shadow-sm border cursor-pointer shrink-0 active:scale-95 ${
                  isSelected
                    ? 'bg-brand-dark text-white border-brand-dark shadow-md ring-2 ring-brand-orange/40 scale-[1.03]'
                    : isOpen
                    ? 'bg-white text-stone-700 border-amber-200/90 hover:border-amber-400 hover:bg-amber-50/50'
                    : 'bg-stone-100/90 text-stone-500 border-stone-200 hover:bg-stone-200/60'
                }`}
              >
                {/* Status Light Indicator */}
                <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0">
                  {isOpen ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500" />
                    </>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-rose-500" />
                    </>
                  )}
                </span>

                <span className="text-sm sm:text-base">{meal.icon}</span>
                <span>{meal.label}</span>

                {!isOpen && (
                  <span className="text-[9px] sm:text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                    Closed
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
