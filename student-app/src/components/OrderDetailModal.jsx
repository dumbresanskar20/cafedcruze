import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, AlertCircle, Package } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import CAFE_D_CRUZE_LOGO from '../assets/logo';

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const orderId = order._id || order.id;
  const isParcel = Boolean(order.is_parcel || order.order_type === 'parcel');
  const [currentStatus, setCurrentStatus] = useState(order.order_status || 'placed');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    setCurrentStatus(order.order_status || 'placed');
  }, [order.order_status]);

  // Parcel countdown timer and status synchronization
  useEffect(() => {
    const checkTimer = () => {
      try {
        const stored = localStorage.getItem('mess_parcel_timers');
        if (stored) {
          const parsed = JSON.parse(stored);
          const tData = (orderId && parsed[orderId]) || (order.token_number && parsed[order.token_number]);
          if (tData && tData.readyAt) {
            const diff = Math.max(0, Math.floor((tData.readyAt - Date.now()) / 1000));
            setTimeLeft(diff);
            if (diff === 0 && currentStatus !== 'delivered' && currentStatus !== 'cancelled' && currentStatus !== 'expired') {
              setCurrentStatus('ready');
            }
            return;
          }
        }
      } catch (e) {
        console.error('Error checking parcel timer:', e);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);

    let bc;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('mess_parcel_channel');
        bc.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (
            (payload?.orderId && payload.orderId === orderId) ||
            (payload?.token_number && String(payload.token_number) === String(order.token_number))
          ) {
            if (type === 'TIMER_SET') {
              const diff = Math.max(0, Math.floor((payload.readyAt - Date.now()) / 1000));
              setTimeLeft(diff);
            } else if (type === 'TIMER_CLEARED' || type === 'STATUS_UPDATED') {
              setTimeLeft(0);
              if (payload?.order_status) {
                setCurrentStatus(payload.order_status);
              }
            }
          }
        };
      } catch (e) {
        console.error('BroadcastChannel error:', e);
      }
    }

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, [orderId, order.token_number, currentStatus]);

  const isDelivered = currentStatus === 'delivered';
  const isExpired = currentStatus === 'expired';
  const isReady = currentStatus === 'ready';
  const tokenNumber = order.token_number;

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const qrData = tokenNumber
    ? JSON.stringify({
        order_id: orderId || '',
        token_number: tokenNumber,
        meal_type: order.meal_type || '',
        payment_status: order.payment_status || 'paid',
        date: order.date || '',
      })
    : '';

  const getStatusBadge = () => {
    if (isDelivered) {
      return (
        <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="bg-rose-100 text-rose-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> Expired (Not Collected)
        </span>
      );
    }
    if (isReady) {
      return (
        <span className="bg-emerald-500 text-white text-xs font-black px-3.5 py-1 rounded-full uppercase flex items-center gap-1.5 shadow-sm animate-pulse">
          <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" /> Ready for Pickup
        </span>
      );
    }
    if (isParcel && timeLeft > 0) {
      return (
        <span className="bg-amber-100 text-amber-950 border border-amber-300 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
          <Clock className="w-3.5 h-3.5 text-brand-orange animate-spin" style={{ animationDuration: '3s' }} />
          <span>Ready in {formatCountdown(timeLeft)}</span>
        </span>
      );
    }
    return (
      <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" /> {currentStatus || 'Placed'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-4 sm:p-6 text-center animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header info */}
        <div className="mb-3">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <img
              src={CAFE_D_CRUZE_LOGO}
              alt="Cafe D Cruze Restaurant Logo"
              className="w-7 h-7 rounded-xl object-contain bg-white p-0.5 shadow-sm border border-amber-200"
            />
            <span className="font-display font-extrabold text-sm text-brand-dark tracking-tight leading-none">
              Cafe D Cruze <span className="text-brand-orange">Restaurant</span>
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Large Token & QR Box */}
        {tokenNumber && (
          <div className="my-3 p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-2.5">
            <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-widest">
              Daily Token Number
            </span>

            <div className={`text-4xl sm:text-5xl font-black font-display tracking-wider ${
              isExpired ? 'text-rose-600 line-through opacity-70' : 'text-brand-terracotta'
            }`}>
              {tokenNumber}
            </div>

            {/* Large Scannable QR Code */}
            <div className="relative my-1">
              <div
                className={`p-3 sm:p-4 bg-white rounded-3xl shadow-md border border-amber-200 inline-block transition-all ${
                  isDelivered || isExpired ? 'grayscale opacity-25 select-none' : ''
                }`}
              >
                <QRCodeSVG
                  value={qrData}
                  size={180}
                  level="M"
                  fgColor="#1c1917"
                  bgColor="#ffffff"
                />
              </div>

              {/* Overlay Badge for Delivered Orders */}
              {isDelivered && (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <div className="px-3.5 py-2 bg-emerald-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl border-2 border-white flex items-center gap-1.5 tracking-wide animate-in zoom-in">
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    <span>ALREADY DELIVERED</span>
                  </div>
                </div>
              )}

              {/* Overlay Badge for Expired Orders */}
              {isExpired && (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <div className="px-3.5 py-2 bg-rose-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl border-2 border-white flex items-center gap-1.5 tracking-wide animate-in zoom-in">
                    <AlertCircle className="w-4 h-4 text-white shrink-0" />
                    <span>TOKEN EXPIRED</span>
                  </div>
                </div>
              )}
            </div>

            {/* Ready for Pickup Alert */}
            {isReady && (
              <div className="w-full p-2.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-0.5 animate-in zoom-in-95">
                <p className="text-xs font-black text-emerald-800 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>🎉 Ready for Pickup!</span>
                </p>
                <p className="text-[11px] font-semibold text-emerald-700">
                  {isParcel ? 'Your parcel is packed and ready at the counter.' : 'Your meal is ready to collect at the counter.'}
                </p>
              </div>
            )}

            <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 max-w-xs leading-tight">
              {isDelivered
                ? 'This order has already been picked up and delivered.'
                : isExpired
                ? 'This token was not collected on the day of order and has expired.'
                : isReady
                ? 'Please collect your order at the counter immediately.'
                : 'Show this large QR code at the canteen counter for quick pickup.'}
            </p>
          </div>
        )}

        {/* Items Summary Breakdown */}
        <div className="text-left bg-stone-50 p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 space-y-2 mb-4 text-xs">
          <div className="flex justify-between font-bold text-stone-700 pb-2 border-b border-stone-200/80">
            <span>Meal: <span className="uppercase text-brand-terracotta">{order.meal_type}</span></span>
            <span>Type: <span className={`uppercase font-extrabold ${isParcel ? 'text-orange-600' : 'text-blue-600'}`}>{isParcel ? '📦 Parcel' : '🍽️ Dine-In'}</span></span>
          </div>
          <div className="flex justify-between font-semibold text-stone-500 pb-1">
            <span>Order Date:</span>
            <span className="text-stone-700 font-bold">{order.date}</span>
          </div>

          <div className="space-y-1">
            {(order.items || []).map((it, idx) => (
              <div key={idx} className="flex justify-between text-stone-700 font-semibold min-w-0 gap-2">
                <span className="truncate">
                  {it.quantity}x {it.item_name}
                  {it.variant_name && !it.item_name.includes(it.variant_name) && (
                    <span className="ml-1.5 text-brand-orange font-bold text-[11px]">
                      ({it.variant_name})
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-bold">₹{it.price * it.quantity}</span>
              </div>
            ))}
          </div>

          {Number(order.discount_amount || 0) > 0 && (
            <div className="border-t border-stone-200/80 pt-2 space-y-1">
              <div className="flex justify-between text-stone-500 font-medium">
                <span>Subtotal</span>
                <span>₹{order.subtotal_amount || order.total_amount}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                <span>Early Order Discount ({order.discount_percentage}%)</span>
                <span>-₹{order.discount_amount}</span>
              </div>
            </div>
          )}

          <div className="border-t border-stone-200/80 pt-2 flex justify-between font-black text-sm text-stone-900">
            <span>Total Amount Paid</span>
            <span className="text-brand-orange">₹{order.total_amount}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-brand-dark text-white font-extrabold rounded-2xl text-xs hover:bg-stone-800 transition-all cursor-pointer shadow-md"
        >
          Close Details
        </button>

      </div>
    </div>
  );
}
