import React, { useState, useRef } from 'react';
import { Plus, Check, Flame, Clock, Star, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import CachedImage from './CachedImage';

export default function MenuCard({ item, isCurrentlyOpen = true }) {
  const { addToCart, discountInfo } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [added, setAdded] = useState(false);
  const cardRef = useRef(null);

  const hasItemVariants = Boolean(
    item.has_variants && Array.isArray(item.variants) && item.variants.length > 0
  );
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(
    hasItemVariants ? item.variants[0] : null
  );

  const minPrice = hasItemVariants
    ? Math.min(...item.variants.map((v) => Number(v.price)))
    : Number(item.price);
  const maxPrice = hasItemVariants
    ? Math.max(...item.variants.map((v) => Number(v.price)))
    : Number(item.price);

  // 3D Tilt Effect calculations
  const [transformStyle, setTransformStyle] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    setTransformStyle(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
  };

  const handleMouseLeave = () => {
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  };

  const isInStock = item.is_in_stock !== false && (!item.track_stock || Number(item.available_quantity) > 0);

  const handleAdd = () => {
    if (!isCurrentlyOpen || !isInStock) return;
    if (!isAuthenticated) {
      openAuthModal(false, 'login');
      return;
    }

    if (hasItemVariants) {
      if (!selectedVariant && item.variants.length > 0) {
        setSelectedVariant(item.variants[0]);
      }
      setIsVariantModalOpen(true);
      return;
    }

    const success = addToCart(item);
    if (success !== false) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    }
  };

  const handleConfirmVariant = () => {
    if (!selectedVariant) return;
    const success = addToCart(item, 1, selectedVariant);
    if (success !== false) {
      setAdded(true);
      setIsVariantModalOpen(false);
      setTimeout(() => setAdded(false), 1200);
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform: transformStyle, transition: 'transform 0.15s ease-out' }}
      className={`group relative bg-white rounded-3xl overflow-hidden border transition-all flex flex-col justify-between ${
        !isCurrentlyOpen
          ? 'border-stone-200/80 bg-stone-50/40 opacity-90'
          : !isInStock
          ? 'border-stone-200/80 bg-stone-50/40 opacity-70 grayscale-50'
          : 'border-amber-100/80 shadow-warm hover:shadow-cardHover'
      }`}
    >
      {/* Top Food Image Container backed by 1-day browser cache memory session */}
      <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-stone-100">
        <CachedImage
          src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}
          alt={item.name}
          className={`w-full h-full object-cover ${
            isCurrentlyOpen && isInStock ? 'group-hover:scale-110 transition-transform duration-500' : 'grayscale-25'
          }`}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity pointer-events-none" />

        {/* Meal Category Badge */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md text-brand-terracotta text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
          <Flame className="w-3 h-3 text-brand-orange" />
          <span>{item.meal_type}</span>
        </div>

        {/* Top-Right Badge: Top Rated or Best Seller */}
        {Number(item.avg_rating || 0) >= 4.5 && Number(item.rating_count || 0) >= 1 ? (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1 border border-amber-300/40">
            <Star className="w-3 h-3 fill-white text-white" />
            <span>Top Rated</span>
          </div>
        ) : Number(item.total_sold || 0) >= 15 ? (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1 border border-orange-300/40">
            <Flame className="w-3 h-3 fill-white text-white" />
            <span>Best Seller</span>
          </div>
        ) : null}

        {/* Overall Average Rating & Sales Count Badge Overlay (Bottom-Left) */}
        <div className="absolute bottom-3 left-3 bg-stone-900/85 backdrop-blur-md text-white px-2.5 py-1.5 rounded-2xl text-xs font-black shadow-lg flex items-center gap-1.5 border border-white/10 flex-wrap max-w-[65%]">
          <div className="flex items-center gap-1 shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span className="text-amber-300 font-extrabold text-xs">
              {Number(item.avg_rating || 0) > 0 ? Number(item.avg_rating).toFixed(1) : 'New'}
            </span>
            {Number(item.rating_count || 0) > 0 && (
              <span className="text-[10px] text-stone-300 font-semibold">
                ({item.rating_count})
              </span>
            )}
          </div>
          {Number(item.total_sold || 0) > 0 && (
            <span className="text-[10px] text-orange-300 font-bold bg-orange-500/20 px-1.5 py-0.5 rounded-md border border-orange-400/20 shrink-0">
              🔥 {item.total_sold} sold
            </span>
          )}
        </div>

        {/* Price Tag Overlay (Bottom-Right) with Early Discount */}
        <div className="absolute bottom-3 right-3 bg-brand-dark/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl font-display font-extrabold shadow-lg flex items-baseline gap-1.5">
          {discountInfo?.is_discount_active && Number(discountInfo?.discount_percentage) > 0 ? (
            <>
              <span className="text-amber-300 text-lg">
                ₹{Math.max(0, Math.round(Number(minPrice) * (1 - Number(discountInfo.discount_percentage) / 100)))}
              </span>
              <span className="text-[11px] text-stone-400 line-through font-medium">
                ₹{minPrice}
              </span>
            </>
          ) : (
            <span className="text-lg">
              {hasItemVariants && minPrice !== maxPrice ? `From ₹${minPrice}` : `₹${minPrice}`}
            </span>
          )}
        </div>
      </div>

      {/* Item Details Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold font-display text-brand-dark group-hover:text-brand-orange transition-colors leading-snug">
            {item.name}
          </h3>

          {hasItemVariants && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.variants.map((v, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVariant(v);
                    setIsVariantModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 px-2.5 py-1 rounded-xl shadow-2xs transition-all cursor-pointer hover:scale-105"
                >
                  <span>🫓 {v.name}:</span>
                  <span className="text-emerald-700 font-black">₹{v.price}</span>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
            {item.description || 'Piping hot authentic preparation cooked fresh in the campus kitchen.'}
          </p>
        </div>

        {/* Add to Cart CTA */}
        <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between">
          {!isInStock ? (
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
              Out of Stock
            </span>
          ) : item.track_stock && Number(item.available_quantity) <= 5 ? (
            <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg animate-pulse">
              Only {item.available_quantity} Left!
            </span>
          ) : isCurrentlyOpen ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              Fresh & Ready
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Browsing Only</span>
            </span>
          )}

          <button
            onClick={handleAdd}
            disabled={!isCurrentlyOpen || !isInStock || added}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 shadow-sm ${
              !isCurrentlyOpen || !isInStock
                ? 'bg-stone-200 text-stone-500 cursor-not-allowed border border-stone-300/60'
                : added
                ? 'bg-emerald-600 text-white scale-105'
                : 'bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white hover:scale-105 active:scale-95'
            }`}
          >
            {!isCurrentlyOpen ? (
              <>
                <Clock className="w-4 h-4 text-stone-400" />
                <span>Ordering Closed</span>
              </>
            ) : !isInStock ? (
              <>
                <span>Out of Stock</span>
              </>
            ) : added ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added to Tray</span>
              </>
            ) : hasItemVariants ? (
              <>
                <Plus className="w-4 h-4" />
                <span>Select Quantity</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add to Tray</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chapati Quantity Selection Modal */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-100 space-y-5 animate-in zoom-in-95 duration-200 text-left"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-stone-100 shrink-0 border border-amber-200">
                  <CachedImage
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-black text-base text-brand-dark truncate">
                    {item.name}
                  </h3>
                  <p className="text-xs text-brand-orange font-bold flex items-center gap-1">
                    <span>🫓</span>
                    <span>Select Chapati Quantity ({item.meal_type ? item.meal_type.toUpperCase() : 'MEAL'})</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options Selection Cards */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black uppercase tracking-wider text-stone-600">
                Choose Portion / Chapati Quantity:
              </label>

              {item.variants.map((v) => {
                const isSelected = selectedVariant?.id === v.id || selectedVariant?.name === v.name;
                const vPrice = Number(v.price);
                const isDiscounted = discountInfo?.is_discount_active && Number(discountInfo?.discount_percentage) > 0;
                const discountedVPrice = isDiscounted
                  ? Math.max(0, Math.round(vPrice * (1 - Number(discountInfo.discount_percentage) / 100)))
                  : vPrice;

                return (
                  <div
                    key={v.id || v.name}
                    onClick={() => setSelectedVariant(v)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-brand-orange bg-amber-50/70 shadow-sm'
                        : 'border-stone-200 hover:border-amber-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'border-brand-orange bg-brand-orange' : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div>
                        <span className="font-extrabold text-sm text-brand-dark block">
                          🫓 {v.name}
                        </span>
                        <span className="text-[11px] text-stone-500 font-medium">
                          {Number(v.quantity) > 0
                            ? `${v.quantity} hot chapatis served with homestyle bhaji`
                            : 'Served fresh with homestyle bhaji'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isDiscounted ? (
                        <>
                          <div className="text-base font-black text-brand-orange">
                            ₹{discountedVPrice}
                          </div>
                          <div className="text-[10px] text-stone-400 line-through font-semibold">
                            ₹{vPrice}
                          </div>
                        </>
                      ) : (
                        <div className="text-base font-black text-brand-dark">
                          ₹{vPrice}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Selected Price Summary Bar */}
            {selectedVariant && (
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/80 rounded-2xl border border-amber-200 flex items-center justify-between text-xs font-bold text-stone-800">
                <span className="flex items-center gap-1.5">
                  <span>Selected:</span>
                  <strong className="text-amber-950 font-black">{selectedVariant.name}</strong>
                </span>
                <span className="text-base font-black text-brand-orange">
                  {discountInfo?.is_discount_active && Number(discountInfo?.discount_percentage) > 0
                    ? `₹${Math.max(0, Math.round(Number(selectedVariant.price) * (1 - Number(discountInfo.discount_percentage) / 100)))}`
                    : `₹${selectedVariant.price}`}
                </span>
              </div>
            )}

            {/* Action CTA Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="px-4 py-3 rounded-2xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmVariant}
                disabled={!selectedVariant}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>
                  Add {selectedVariant ? `${selectedVariant.name} • ₹${selectedVariant.price}` : 'to Tray'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
