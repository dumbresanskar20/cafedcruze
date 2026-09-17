import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, X, Clock, Utensils } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function OrderSuccessModal({ tokenNumber, order, onClose }) {
  const [currentStatus, setCurrentStatus] = React.useState(order?.order_status || 'placed');
  const [timeLeft, setTimeLeft] = React.useState(0);

  const orderId = order?._id || order?.id;
  const isParcel = Boolean(order?.is_parcel || order?.order_type === 'parcel');

  useEffect(() => {
    if (order?.order_status) {
      setCurrentStatus(order.order_status);
    }
  }, [order?.order_status]);

  // Sync and tick parcel countdown timer
  useEffect(() => {
    const checkTimer = () => {
      try {
        const stored = localStorage.getItem('mess_parcel_timers');
        if (stored) {
          const parsed = JSON.parse(stored);
          const tData = (orderId && parsed[orderId]) || (tokenNumber && parsed[tokenNumber]);
          if (tData && tData.readyAt) {
            const diff = Math.max(0, Math.floor((tData.readyAt - Date.now()) / 1000));
            setTimeLeft(diff);
            if (diff === 0) {
              setCurrentStatus('ready');
            }
            return;
          }
        }
      } catch (e) {
        console.error('Error reading parcel timers:', e);
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
            (payload?.token_number && String(payload.token_number) === String(tokenNumber))
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
  }, [orderId, tokenNumber]);

  useEffect(() => {
    if (tokenNumber) {
      // Fire confetti burst upon confirmed token reveal
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ea580c', '#f59e0b', '#10b981', '#ffffff'],
        });
      } catch (e) {
        console.log('Confetti error:', e);
      }
    }
  }, [tokenNumber]);

  if (!tokenNumber && !order) return null;

  const qrPayload = tokenNumber
    ? JSON.stringify({
        order_id: orderId || '',
        token_number: tokenNumber,
        meal_type: order?.meal_type || '',
        payment_status: order?.payment_status || 'paid',
        date: order?.date || '',
      })
    : '';

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-4 sm:p-6 text-center animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Paid Token Icon */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 animate-bounce">
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold font-display text-brand-dark">Payment Confirmed!</h2>
        <p className="text-xs text-stone-500 mt-1">Show this token or QR code at the canteen counter</p>

        {/* Prominent Token & QR Card */}
        <div className="my-4 p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-2.5">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
            Your Daily Token Number
          </span>
          
          <div className="text-4xl sm:text-5xl font-extrabold font-display text-brand-terracotta tracking-wider animate-pulse">
            {tokenNumber}
          </div>

          {/* QR Code */}
          {qrPayload && (
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-amber-200 inline-block my-1">
              <QRCodeSVG
                value={qrPayload}
                size={120}
                level="M"
                fgColor="#1c1917"
                bgColor="#ffffff"
              />
            </div>
          )}
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
            Scan at Counter for Pickup
          </span>

          {/* Status & Live Countdown for Parcel vs Dine In */}
          {currentStatus === 'ready' ? (
            <div className="space-y-1 w-full flex flex-col items-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-300 animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>🎉 READY FOR PICKUP</span>
              </span>
              <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-center w-full">
                Your food is packed and ready! Collect it now at the counter.
              </p>
            </div>
          ) : isParcel && timeLeft > 0 ? (
            <div className="space-y-1.5 w-full flex flex-col items-center">
              <div className="inline-flex items-center gap-2 text-xs font-black text-amber-950 bg-amber-100 px-4 py-2 rounded-2xl border border-amber-300 shadow-xs">
                <Clock className="w-4 h-4 text-brand-orange animate-spin" style={{ animationDuration: '3s' }} />
                <span>Parcel Ready In: <span className="font-mono text-sm text-brand-orange font-black">{formatCountdown(timeLeft)}</span></span>
              </div>
              <p className="text-[10px] font-semibold text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200">
                ⏳ Kitchen has started preparation. Status will become ready automatically!
              </p>
            </div>
          ) : isParcel ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-800 bg-orange-100 px-3.5 py-1.5 rounded-full border border-orange-200">
              <Clock className="w-3.5 h-3.5 text-orange-600" /> 📦 Parcel Preparing in Kitchen
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
              <Clock className="w-3 h-3" /> 🍽️ Preparing in Kitchen
            </span>
          )}
        </div>

        {/* Order Details Brief */}
        {order && (
          <div className="text-left text-xs bg-stone-50 p-3 sm:p-3.5 rounded-2xl border border-stone-100 space-y-1.5 mb-5">
            <div className="flex justify-between text-stone-500">
              <span>Order Type:</span>
              <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                isParcel ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-blue-100 text-blue-800'
              }`}>
                {isParcel ? '📦 Parcel / Takeaway' : '🍽️ Dine-In'}
              </span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Meal Type:</span>
              <span className="font-bold text-stone-800 uppercase">{order.meal_type}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Status:</span>
              <span className={`font-extrabold uppercase px-2 py-0.5 rounded text-[10px] ${
                currentStatus === 'ready'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {currentStatus === 'ready' ? 'Ready for Pickup' : 'Paid & In Queue'}
              </span>
            </div>

            {Number(order.discount_amount || 0) > 0 && (
              <>
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-stone-700">₹{order.subtotal_amount || order.total_amount}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg text-[11px]">
                  <span>Early Bird Discount ({order.discount_percentage}%):</span>
                  <span>-₹{order.discount_amount}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-stone-500 font-bold">
              <span>Total Paid:</span>
              <span className="text-brand-orange text-sm font-extrabold">₹{order.total_amount}</span>
            </div>
            
            {/* Itemized list */}
            {order.items && order.items.length > 0 && (
              <div className="border-t border-stone-200/80 pt-1.5 space-y-1">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-stone-700 font-semibold min-w-0 gap-2">
                    <span className="truncate">
                      {it.quantity}x {it.item_name}
                      {it.variant_name && !it.item_name.includes(it.variant_name) && (
                        <span className="ml-1.5 text-brand-orange font-bold text-[10px]">
                          ({it.variant_name})
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold">₹{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-brand-dark text-white font-bold rounded-2xl text-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Utensils className="w-4 h-4" />
          <span>Done & Back to Menu</span>
        </button>

      </div>
    </div>
  );
}
