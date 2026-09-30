import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function MealTypeTabs({ navbarHeight = 64 }) {
  const { selectedMealType, setSelectedMealType, activeMealWindows, loadingWindows } = useCart();
  const tabsContainerRef = useRef(null);
  const activeTabRef = useRef(null);
  const mobileDropdownRef = useRef(null);

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Close mobile dropdown on click outside
  useEffect(() => {
    if (!isMobileExpanded) return;
    const handleClickOutside = (e) => {
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target)) {
        setIsMobileExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobileExpanded]);

  // Collapse mobile expanded state when selectedMealType changes
  useEffect(() => {
    setIsMobileExpanded(false);
  }, [selectedMealType]);

  const MEAL_CONFIG = {
    breakfast: { label: 'Breakfast', icon: '🌅' },
    lunch: { label: 'Lunch', icon: '☀️' },
    snacks: { label: 'Snacks', icon: '☕' },
    dinner: { label: 'Dinner', icon: '🌙' },
  };

  const getMealMeta = (rawType) => {
    const type = (rawType || '').toLowerCase().trim();
    if (MEAL_CONFIG[type]) {
      return MEAL_CONFIG[type];
    }

    // Clean formatted label: e.g. milk_shake -> Milk Shake
    const formattedLabel = type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Context-sensitive icon mapping
    let icon = '🍱';
    if (type.includes('shake') || type.includes('smoothie')) icon = '🥤';
    else if (type.includes('coffee') || type.includes('cafe')) icon = '🧋';
    else if (type.includes('tea') || type.includes('chai')) icon = '🍵';
    else if (type.includes('momo') || type.includes('dimsum')) icon = '🥟';
    else if (type.includes('pasta') || type.includes('noodle') || type.includes('maggi') || type.includes('spaghetti')) icon = '🍝';
    else if (type.includes('pizza')) icon = '🍕';
    else if (type.includes('burger')) icon = '🍔';
    else if (type.includes('sandwich') || type.includes('toast')) icon = '🥪';
    else if (type.includes('rice') || type.includes('biryani') || type.includes('thali')) icon = '🍛';
    else if (type.includes('sweet') || type.includes('dessert') || type.includes('ice_cream') || type.includes('cake')) icon = '🍨';
    else if (type.includes('roll') || type.includes('wrap')) icon = '🌯';
    else if (type.includes('juice') || type.includes('drink') || type.includes('beverage')) icon = '🍹';
    else if (type.includes('snack') || type.includes('fast_food') || type.includes('fry') || type.includes('fries')) icon = '🍟';

    return { label: formattedLabel, icon };
  };

  // Build list of active meal type buttons dynamically
  const availableMealTypes = (activeMealWindows && activeMealWindows.length > 0)
    ? activeMealWindows.map((w) => {
        const type = (w.meal_type || '').toLowerCase();
        const meta = getMealMeta(type);
        return {
          id: type,
          label: meta.label,
          icon: meta.icon,
          isCurrentlyOpen: Boolean(w.is_currently_open),
          startTime: w.formatted_start_time,
          endTime: w.formatted_end_time,
        };
      })
    : [];

  const isCollapsibleOnMobile = availableMealTypes.length > 4;
  const currentSelectedMeal = availableMealTypes.find((m) => m.id === selectedMealType) || availableMealTypes[0];

  // Auto-scroll active tab into center view on desktop / wide view if container overflows horizontally
  useEffect(() => {
    if (activeTabRef.current && tabsContainerRef.current) {
      const container = tabsContainerRef.current;
      const tab = activeTabRef.current;

      const containerWidth = container.offsetWidth;
      const tabOffsetLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;

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

  if (loadingWindows) {
    return (
      <div
        style={{ top: `${navbarHeight}px` }}
        className="sticky z-30 bg-[#fffbf5]/95 backdrop-blur-md border-b border-amber-200/80 shadow-xs py-2.5 sm:py-3 transition-all w-full"
      >
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="flex items-center gap-2 sm:gap-3 animate-pulse">
            <div className="h-10 w-28 bg-amber-100/80 rounded-2xl" />
            <div className="h-10 w-28 bg-amber-100/80 rounded-2xl hidden sm:block" />
            <div className="h-10 w-28 bg-amber-100/80 rounded-2xl hidden sm:block" />
          </div>
        </div>
      </div>
    );
  }

  if (availableMealTypes.length === 0) {
    return null;
  }

  return (
    <div
      style={{ top: `${navbarHeight}px` }}
      className="sticky z-30 bg-[#fffbf5]/95 backdrop-blur-md border-b border-amber-200/80 shadow-xs py-2.5 sm:py-3 transition-all w-full"
    >
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* DESKTOP VIEW: Show all meal types directly */}
        <div
          ref={tabsContainerRef}
          className="hidden sm:flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-4xl mx-auto px-1 w-full"
        >
          {availableMealTypes.map((meal) => {
            const isSelected = selectedMealType === meal.id;
            const isOpen = meal.isCurrentlyOpen;

            return (
              <button
                key={meal.id}
                ref={isSelected ? activeTabRef : null}
                onClick={() => handleMealSelect(meal.id)}
                className={`min-h-[44px] sm:min-h-[48px] px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2 shadow-xs border cursor-pointer shrink-0 active:scale-95 ${
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
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-rose-500" />
                  )}
                </span>

                <span className="text-sm sm:text-base">{meal.icon}</span>
                <span>{meal.label}</span>

                {!isOpen && (
                  <span className="text-[9px] sm:text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    Closed
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* MOBILE VIEW: Collapsible if > 4 meal types, else standard layout */}
        <div className="block sm:hidden w-full max-w-md mx-auto">
          {!isCollapsibleOnMobile ? (
            /* Case 1: <= 4 meal types -> Render normally */
            <div className="flex flex-wrap items-center justify-center gap-2 px-1 w-full">
              {availableMealTypes.map((meal) => {
                const isSelected = selectedMealType === meal.id;
                const isOpen = meal.isCurrentlyOpen;

                return (
                  <button
                    key={meal.id}
                    onClick={() => handleMealSelect(meal.id)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-2xl font-extrabold text-xs transition-all duration-200 flex items-center gap-2 shadow-xs border cursor-pointer shrink-0 active:scale-95 ${
                      isSelected
                        ? 'bg-brand-dark text-white border-brand-dark shadow-md ring-2 ring-brand-orange/40 scale-[1.02]'
                        : isOpen
                        ? 'bg-white text-stone-700 border-amber-200/90 hover:border-amber-400'
                        : 'bg-stone-100/90 text-stone-500 border-stone-200'
                    }`}
                  >
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      {isOpen ? (
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      ) : (
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      )}
                    </span>
                    <span className="text-base">{meal.icon}</span>
                    <span>{meal.label}</span>
                    {!isOpen && (
                      <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                        Closed
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Case 2: > 4 meal types -> Minimized by default, expands on click */
            <div ref={mobileDropdownRef} className="w-full relative">
              {!isMobileExpanded ? (
                /* Minimized Single Button State */
                <button
                  type="button"
                  onClick={() => setIsMobileExpanded(true)}
                  className="w-full min-h-[46px] px-4 py-2 bg-brand-dark text-white rounded-2xl font-extrabold text-xs flex items-center justify-between shadow-md border border-brand-dark ring-2 ring-brand-orange/40 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  aria-expanded="false"
                  aria-label="Expand all meal categories"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      {currentSelectedMeal?.isCurrentlyOpen ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      )}
                    </span>
                    <span className="text-base shrink-0">{currentSelectedMeal?.icon}</span>
                    <span className="text-sm font-black tracking-tight truncate">
                      {currentSelectedMeal?.label}
                    </span>
                    {!currentSelectedMeal?.isCurrentlyOpen && (
                      <span className="text-[9px] font-black uppercase text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/30 shrink-0">
                        Closed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-xl text-amber-200 text-xs font-black shrink-0 transition-colors">
                    <span>All ({availableMealTypes.length})</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                  </div>
                </button>
              ) : (
                /* Expanded Dropdown State: Shows All Meal Types */
                <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl border-2 border-amber-300/90 shadow-xl p-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-stone-900 tracking-wide uppercase">
                        Meal Categories
                      </span>
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        {availableMealTypes.length} Available
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileExpanded(false)}
                      className="px-2.5 py-1 rounded-xl text-stone-600 hover:text-stone-900 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-black"
                    >
                      <span>Minimize</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-0.5">
                    {availableMealTypes.map((meal) => {
                      const isSelected = selectedMealType === meal.id;
                      const isOpen = meal.isCurrentlyOpen;

                      return (
                        <button
                          key={meal.id}
                          type="button"
                          onClick={() => {
                            handleMealSelect(meal.id);
                            setIsMobileExpanded(false);
                          }}
                          className={`min-h-[46px] px-3 py-2 rounded-2xl font-extrabold text-xs transition-all duration-150 flex items-center justify-between gap-1.5 shadow-2xs border cursor-pointer active:scale-95 text-left ${
                            isSelected
                              ? 'bg-brand-dark text-white border-brand-dark shadow-md ring-2 ring-brand-orange/40'
                              : isOpen
                              ? 'bg-amber-50/50 text-stone-700 border-amber-200/90 hover:border-amber-400 hover:bg-amber-100/60'
                              : 'bg-stone-50 text-stone-400 border-stone-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="relative flex h-2 w-2 shrink-0">
                              {isOpen ? (
                                <>
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </>
                              ) : (
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                              )}
                            </span>
                            <span className="text-base shrink-0">{meal.icon}</span>
                            <span className="truncate">{meal.label}</span>
                          </div>

                          {isSelected ? (
                            <span className="text-brand-orange text-xs font-black shrink-0">●</span>
                          ) : !isOpen ? (
                            <span className="text-[8px] font-black uppercase text-rose-500 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 shrink-0">
                              Closed
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
