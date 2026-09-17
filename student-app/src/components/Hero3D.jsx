import React from 'react';
import { Sparkles } from 'lucide-react';
import CANTEEN_EMBLEM from '../assets/canteen-emblem.png';
import MEALBOOK_LOGO from '../assets/meal-book-logo.jpeg';

export default function Hero3D() {
  return (
    <div className="relative overflow-clip bg-gradient-to-b from-amber-100/70 via-orange-50/50 to-brand-warmBg py-8 sm:py-12 md:py-16 w-full">
      {/* Background Subtle Ambient Orbs */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[300px] rounded-full bg-gradient-to-tr from-amber-300/30 to-orange-400/20 blur-3xl pointer-events-none" />

      <div className="max-w-screen-xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10 text-center w-full">
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
          
          {/* Top Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-amber-100/90 border border-amber-300 text-brand-terracotta text-[11px] sm:text-xs md:text-sm font-semibold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-sm max-w-full">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange animate-spin shrink-0" style={{ animationDuration: '6s' }} />
            <span className="truncate">Piping Hot & Fresh Daily • Cafe D Cruze Restaurant</span>
          </div>

          {/* Brand Logos: Cafe D Cruze Restaurant & MealBook App */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 md:gap-14 pt-1 pb-1">
            {/* MealBook App Logo */}
            <div className="flex flex-col items-center group">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-2xl sm:rounded-3xl bg-white p-2 sm:p-2.5 shadow-md border border-amber-200/80 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-warm">
                <img
                  src={MEALBOOK_LOGO}
                  alt="MealBook Logo"
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    e.currentTarget.src = '/meal-book-logo.jpeg';
                  }}
                />
              </div>
              <span className="mt-2.5 sm:mt-3 font-display font-bold text-xs sm:text-sm md:text-base text-brand-dark tracking-wide group-hover:text-brand-orange transition-colors">
                MealBook App
              </span>
            </div>

            {/* Cafe D Cruze Restaurant Logo */}
            <div className="flex flex-col items-center group">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-2xl sm:rounded-3xl bg-white p-2 sm:p-2.5 shadow-md border border-amber-200/80 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-warm">
                <img
                  src={CANTEEN_EMBLEM}
                  alt="Cafe D Cruze Restaurant Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="mt-2.5 sm:mt-3 font-display font-bold text-xs sm:text-sm md:text-base text-brand-dark tracking-wide group-hover:text-brand-orange transition-colors">
                Cafe D Cruze Restaurant
              </span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-extrabold font-display tracking-tight text-brand-dark leading-[1.15]">
            Canteen <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange via-amber-600 to-brand-terracotta">
              Pre-Order Booking App
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-xs sm:text-base lg:text-lg text-stone-600 max-w-xl mx-auto leading-relaxed font-medium px-2">
            Browse breakfast & lunch, pick your tray, and get instant digital meal tokens right on your phone. Fresh, hygienic, and prepared with love.
          </p>

        </div>
      </div>
    </div>
  );
}

