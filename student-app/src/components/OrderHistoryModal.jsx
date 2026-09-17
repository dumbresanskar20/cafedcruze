import React, { useState, useEffect } from 'react';
import { X, Receipt, CheckCircle2, Maximize2, Star } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';
import OrderDetailModal from './OrderDetailModal';
import RatingModal from './RatingModal';
import CAFE_D_CRUZE_LOGO from '../assets/logo';

export default function OrderHistoryModal({ isOpen, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);
  const [selectedRatingOrder, setSelectedRatingOrder] = useState(null);
  const [ratedOrdersMap, setRatedOrdersMap] = useState({});
  const [timersMap, setTimersMap] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  // Keep timers ticking
  useEffect(() => {
    if (!isOpen) return;

    const syncTimers = () => {
      try {
        const stored = localStorage.getItem('mess_parcel_timers');
        if (stored) {
          setTimersMap(JSON.parse(stored));
        } else {
          setTimersMap({});
        }
      } catch {
        setTimersMap({});
      }
    };

    syncTimers();
    const timerInterval = setInterval(syncTimers, 1000);
    return () => clearInterval(timerInterval);
  }, [isOpen]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/my-orders');
      if (res.data.success) {
        setOrders(res.data.orders);
        const initialRatedMap = {};
        res.data.orders.forEach((ord) => {
          const orderId = ord._id || ord.id;
          if (ord.is_rated && ord.rating != null) {
            initialRatedMap[orderId] = ord.rating;
          }
        });
        setRatedOrdersMap((prev) => ({ ...initialRatedMap, ...prev }));
      }
    } catch (err) {
      console.error('Error fetching order history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getStatusBadge = (ord) => {
    const orderId = ord._id || ord.id;
    const isParcel = Boolean(ord.is_parcel || ord.order_type === 'parcel');
    const timerData = (orderId && timersMap[orderId]) || (ord.token_number && timersMap[ord.token_number]);
    const timeLeft = timerData?.readyAt ? Math.max(0, Math.floor((timerData.readyAt - Date.now()) / 1000)) : 0;

    if (ord.order_status === 'ready' || (isParcel && timerData?.readyAt && timeLeft === 0 && ord.order_status !== 'delivered' && ord.order_status !== 'expired')) {
      return (
        <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 shadow-xs shrink-0 animate-pulse">
          <CheckCircle2 className="w-3 h-3 stroke-[3]" /> Ready for Pickup
        </span>
      );
    }

    if (isParcel && timeLeft > 0 && ord.order_status !== 'delivered' && ord.order_status !== 'expired') {
      return (
        <span className="bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-mono font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-2xs">
          <Clock className="w-2.5 h-2.5 text-brand-orange animate-spin" style={{ animationDuration: '3s' }} />
          <span>{formatCountdown(timeLeft)}</span>
        </span>
      );
    }

    switch (ord.order_status) {
      case 'placed':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Placed</span>;
      case 'preparing':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase animate-pulse shrink-0">Preparing</span>;
      case 'ready':
        return <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0 animate-pulse"><CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" /> Ready</span>;
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3 h-3" /> Delivered</span>;
      case 'expired':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Expired</span>;
      case 'cancelled':
        return <span className="bg-stone-200 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Cancelled</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">{ord.order_status}</span>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in overflow-hidden">
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-100 p-4 sm:p-6 flex flex-col max-h-[88vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={CAFE_D_CRUZE_LOGO}
                alt="Cafe D Cruze Restaurant Logo"
                className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 border border-amber-200 shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <h2 className="font-display font-extrabold text-base sm:text-lg text-brand-dark truncate">Cafe D Cruze Restaurant • Orders</h2>
                <p className="text-[10px] sm:text-[11px] text-stone-500 font-medium truncate">Tap any order to view large scannable QR code</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer shrink-0 ml-2"
              aria-label="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Orders List Body */}
          <div className="flex-1 overflow-y-auto py-3.5 space-y-3">
            {loading ? (
              <div className="text-center py-12 text-stone-400 text-xs font-semibold">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-xs font-medium">
                You haven't placed any meal orders yet!
              </div>
            ) : (
              orders.map((ord) => {
                const isDelivered = ord.order_status === 'delivered';
                const orderId = ord._id || ord.id;
                const qrData = ord.token_number
                  ? JSON.stringify({
                      order_id: orderId,
                      token_number: ord.token_number,
                      meal_type: ord.meal_type,
                      payment_status: ord.payment_status,
                      date: ord.date,
                    })
                  : '';

                const isRated = Boolean(ord.is_rated) || ratedOrdersMap[orderId] !== undefined;
                const ratedScore = ratedOrdersMap[orderId] !== undefined ? ratedOrdersMap[orderId] : ord.rating;

                return (
                  <div
                    key={orderId}
                    onClick={() => setSelectedDetailOrder(ord)}
                    className="p-3.5 bg-stone-50/90 hover:bg-amber-50/40 hover:border-amber-300 rounded-2xl border border-stone-200/80 space-y-2.5 transition-all cursor-pointer shadow-sm group min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="font-display font-extrabold text-lg sm:text-xl text-brand-terracotta bg-amber-100/80 px-2.5 py-1 rounded-xl shrink-0">
                          {ord.token_number || 'Pending'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-stone-800 uppercase block truncate">{ord.meal_type}</span>
                            {(ord.is_parcel || ord.order_type === 'parcel') ? (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">Parcel</span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Dine-In</span>
                            )}
                          </div>
                          <span className="text-[10px] text-brand-orange font-semibold block truncate">{ord.date}</span>
                        </div>
                      </div>

                      {getStatusBadge(ord)}
                    </div>

                    {/* QR Code Card Thumbnail */}
                    {ord.token_number && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200/80 group-hover:border-amber-200 transition-colors gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`relative shrink-0 ${isDelivered ? 'grayscale opacity-35' : ''}`}>
                            <QRCodeSVG value={qrData} size={52} level="M" />
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-stone-600 font-medium min-w-0">
                            <span className="font-bold text-stone-900 block truncate">
                              {isDelivered ? '✅ Delivered' : 'Pickup QR Code'}
                            </span>
                            <span className="text-[10px] text-stone-400 block truncate">
                              {isDelivered ? 'Redeemed' : 'Tap to view full QR code'}
                            </span>
                          </div>
                        </div>
                        <Maximize2 className="w-4 h-4 text-stone-400 group-hover:text-brand-orange transition-colors shrink-0" />
                      </div>
                    )}

                    {/* Items list summary */}
                    <div className="border-t border-stone-200/60 pt-2 space-y-1">
                      {ord.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-stone-600 font-medium min-w-0 gap-2">
                          <span className="truncate">{it.item_name} × {it.quantity}</span>
                          <span className="shrink-0">₹{it.price * it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Payment Row with Discount breakdown */}
                    <div className="pt-1.5 border-t border-stone-100 space-y-1">
                      {Number(ord.discount_amount || 0) > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                          <span>Early Order Discount ({ord.discount_percentage}%)</span>
                          <span>-₹{ord.discount_amount}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs text-stone-500 font-semibold">
                        <span>Paid via {ord.payment_method === 'cash' ? 'Cash' : ord.payment_method === 'upi' ? 'UPI' : 'Razorpay'}</span>
                        <span className="text-brand-orange font-extrabold text-sm">Total: ₹{ord.total_amount}</span>
                      </div>
                    </div>

                    {/* Rate the Meal button for Delivered orders */}
                    {isDelivered && (
                      <div className="pt-2 border-t border-amber-100">
                        {isRated ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 border border-emerald-500 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-default select-none"
                          >
                            <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                            <span>Rated {ratedScore != null ? ratedScore : 5} ★</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 ml-1" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRatingOrder(ord);
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-brand-orange hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                          >
                            <Star className="w-4 h-4 fill-white text-white" />
                            <span>Rate the meal</span>
                            <span>⭐</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* Render Large Order Details Modal */}
      {selectedDetailOrder && (
        <OrderDetailModal
          order={selectedDetailOrder}
          onClose={() => setSelectedDetailOrder(null)}
        />
      )}

      {/* Render Meal Rating Modal */}
      {selectedRatingOrder && (
        <RatingModal
          order={selectedRatingOrder}
          isOpen={Boolean(selectedRatingOrder)}
          onClose={() => setSelectedRatingOrder(null)}
          onRatingSubmitted={(id, ratingsPayload) => {
            let avgRating = 5;
            if (Array.isArray(ratingsPayload) && ratingsPayload.length > 0) {
              const sum = ratingsPayload.reduce((acc, r) => acc + Number(r.rating || 0), 0);
              const avg = sum / ratingsPayload.length;
              avgRating = avg % 1 === 0 ? avg : Math.round(avg * 10) / 10;
            }
            setRatedOrdersMap((prev) => ({ ...prev, [id]: avgRating }));
            setOrders((prev) =>
              prev.map((o) =>
                (o._id === id || o.id === id)
                  ? { ...o, is_rated: true, rating: avgRating }
                  : o
              )
            );
          }}
        />
      )}
    </>
  );
}
