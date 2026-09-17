import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, AlertCircle, Utensils, Info, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { loadRazorpayScript } from '../utils/loadRazorpay';
import CachedImage from './CachedImage';

export default function CartDrawer({ onOrderSuccess, onPaymentFailure }) {
  const {
    cartItems,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    selectedMealType,
    currentMealWindow,
    clearCart,
    isParcel,
    setIsParcel,
    clientCurrentTime,
    discountInfo: contextDiscountInfo,
    fetchDiscountStatus,
    triggerStockAlert,
  } = useCart();
  const { student, isAuthenticated, openAuthModal } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const lastFailureDataRef = useRef(null);

  const discountInfo = contextDiscountInfo || {
    is_discount_active: false,
    discount_percentage: 0,
    server_time: '',
  };

  useEffect(() => {
    if (isCartOpen && fetchDiscountStatus) {
      fetchDiscountStatus(selectedMealType);
    }
  }, [isCartOpen, selectedMealType, fetchDiscountStatus]);

  const isDiscountActive = Boolean(discountInfo?.is_discount_active) && Number(discountInfo?.discount_percentage) > 0;
  const discountAmount = isDiscountActive
    ? Math.round((cartTotal * (Number(discountInfo.discount_percentage) / 100)) * 100) / 100
    : 0;
  const finalPayable = Math.max(0, Math.round((cartTotal - discountAmount) * 100) / 100);

  if (!isCartOpen) return null;

  const handleBackToMenu = () => {
    setIsCartOpen(false);
    setTimeout(() => {
      const menuEl = document.getElementById('menu-section');
      if (menuEl) {
        menuEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleProceedToPay = async () => {
    setErrorMessage('');

    // Check auth boundary: If user is not logged in, prompt Auth Modal and preserve cart
    if (!isAuthenticated) {
      openAuthModal(true); // Passes forCheckout = true so login triggers payment on success
      return;
    }

    if (cartItems.length === 0) return;

    setCheckoutLoading(true);

    try {
      // 1. Verify Razorpay Checkout.js SDK script loading
      console.log('[Razorpay Diagnostics] 1. Verifying Razorpay Checkout SDK script presence...');
      const scriptReady = await loadRazorpayScript();

      if (!scriptReady || typeof window.Razorpay === 'undefined') {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        setErrorMessage('Razorpay SDK failed to load — check network connection or ad-blocker extension.');
        setCheckoutLoading(false);
        return;
      }

      // 2. Request backend Razorpay Order creation (Backend creates order with live .env credentials)
      console.log('[Razorpay Diagnostics] 2. Calling backend /orders/create-razorpay-order...', {
        itemsCount: cartItems.length,
        meal_type: selectedMealType,
        cartTotal,
      });

      const res = await api.post('/orders/create-razorpay-order', {
        items: cartItems,
        meal_type: selectedMealType,
        order_type: isParcel ? 'parcel' : 'dine_in',
        is_parcel: isParcel,
      });

      console.log('[Razorpay Diagnostics] 3. Backend order creation response received:', res.data);

      const { razorpay_order_id, amount, currency, key_id, order_db_id } = res.data;

      if (!razorpay_order_id) {
        throw new Error('Backend response did not contain a valid Razorpay Order ID.');
      }

      // Dynamically use backend key_id (from .env), falling back to discountInfo or frontend env
      const activeKey = key_id || discountInfo?.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      console.log('[Razorpay Diagnostics] 4. Active Razorpay Key ID:', activeKey ? `${activeKey.substring(0, 10)}...` : 'NOT FOUND');

      if (!activeKey) {
        throw new Error('Razorpay Key ID is not available. Please verify RAZORPAY_KEY_ID in backend .env.');
      }

      // 3. Configure Razorpay SDK Checkout options
      const options = {
        key: activeKey,
        amount: amount,
        currency: currency || 'INR',
        name: 'Campus Mess Canteen',
        description: `${selectedMealType.toUpperCase()} Meal Order Token (${isParcel ? 'Parcel' : 'Dine-In'})`,
        order_id: razorpay_order_id.startsWith('order_mock_') ? undefined : razorpay_order_id,
        webview_intent: true,
        handler: async function (response) {
          console.log('[Razorpay Diagnostics] Payment succeeded on client, verifying signature with backend...', response);
          try {
            // Verify Payment Signature & Fulfill Order Token
            const verifyRes = await api.post('/orders/verify-payment', {
              razorpay_order_id: response.razorpay_order_id || razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id || `pay_mock_${Date.now()}`,
              razorpay_signature: response.razorpay_signature || 'mock_signature',
              items: cartItems,
              meal_type: selectedMealType,
              order_type: isParcel ? 'parcel' : 'dine_in',
              is_parcel: isParcel,
            });

            console.log('[Razorpay Diagnostics] Payment verification response:', verifyRes.data);

            if (verifyRes.data.success) {
              clearCart(); // Clear cart ONLY on successful checkout
              setIsCartOpen(false);
              setTimeout(() => {
                onOrderSuccess(verifyRes.data.token_number, verifyRes.data.order);
              }, 250);
            } else {
              const failReason = verifyRes.data.message || 'Payment verification failed.';
              setErrorMessage(failReason);
              const failurePayload = {
                reason: failReason,
                orderId: response.razorpay_order_id || razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                amount: finalPayable,
                mealType: selectedMealType,
                studentName: student?.name,
                studentRollNo: student?.roll_no,
              };
              lastFailureDataRef.current = failurePayload;
              if (onPaymentFailure) {
                onPaymentFailure(failurePayload);
              }
            }
          } catch (verifyErr) {
            console.error('[Razorpay Diagnostics] Payment verification error:', verifyErr);
            const failReason = verifyErr.response?.data?.message || 'Payment verification failed. Please check your order status.';
            setErrorMessage(failReason);
            const failurePayload = {
              reason: failReason,
              orderId: response?.razorpay_order_id || razorpay_order_id,
              paymentId: response?.razorpay_payment_id,
              amount: finalPayable,
              mealType: selectedMealType,
              studentName: student?.name,
              studentRollNo: student?.roll_no,
            };
            lastFailureDataRef.current = failurePayload;
            if (onPaymentFailure) {
              onPaymentFailure(failurePayload);
            }
          } finally {
            setCheckoutLoading(false);
          }
        },
        prefill: {
          name: student?.name || 'Student',
          email: student?.email || 'student@mess.com',
        },
        theme: {
          color: '#ea580c',
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay Diagnostics] Checkout modal dismissed by user.');
            setCheckoutLoading(false);
          },
        },
      };

      // 5. Instantiate and launch Razorpay Checkout window
      if (typeof window.Razorpay !== 'undefined' && !razorpay_order_id.startsWith('order_mock_')) {
        console.log(`[Razorpay Diagnostics] 5. Instantiating Razorpay modal with Order ID: ${razorpay_order_id}`);
        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', function (failureResponse) {
          console.error('[Razorpay Diagnostics] Razorpay Payment Failed Event:', failureResponse.error);
          const failReason = failureResponse.error?.description || failureResponse.error?.reason || 'Transaction aborted.';
          setErrorMessage(`Payment failed: ${failReason}`);
          setCheckoutLoading(false);
          const failurePayload = {
            reason: failReason,
            orderId: razorpay_order_id,
            paymentId: failureResponse.error?.metadata?.payment_id,
            amount: finalPayable,
            mealType: selectedMealType,
            studentName: student?.name,
            studentRollNo: student?.roll_no,
          };
          lastFailureDataRef.current = failurePayload;
          if (onPaymentFailure) {
            onPaymentFailure(failurePayload);
          }
        });

        rzp.open();
      } else if (razorpay_order_id.startsWith('order_mock_')) {
        console.warn('[Razorpay Diagnostics] Local dev mock order ID received. Simulating sandbox fulfillment...');
        // Dev Sandbox Simulation fallback when test keys aren't live
        setTimeout(async () => {
          try {
            const verifyRes = await api.post('/orders/verify-payment', {
              razorpay_order_id: razorpay_order_id,
              razorpay_payment_id: `pay_sandbox_${Date.now()}`,
              razorpay_signature: 'sandbox_test_sig',
              items: cartItems,
              meal_type: selectedMealType,
            });

            if (verifyRes.data.success) {
              clearCart(); // Clear cart ONLY on successful checkout
              setIsCartOpen(false);
              setTimeout(() => {
                onOrderSuccess(verifyRes.data.token_number, verifyRes.data.order);
              }, 250);
            } else {
              const failReason = verifyRes.data.message || 'Sandbox order verification failed.';
              setErrorMessage(failReason);
              const failurePayload = {
                reason: failReason,
                orderId: razorpay_order_id,
                amount: finalPayable,
                mealType: selectedMealType,
                studentName: student?.name,
                studentRollNo: student?.roll_no,
              };
              lastFailureDataRef.current = failurePayload;
              if (onPaymentFailure) {
                onPaymentFailure(failurePayload);
              }
            }
          } catch (e) {
            const failReason = e.response?.data?.message || 'Sandbox order fulfillment failed.';
            setErrorMessage(failReason);
            const failurePayload = {
              reason: failReason,
              orderId: razorpay_order_id,
              amount: finalPayable,
              mealType: selectedMealType,
              studentName: student?.name,
              studentRollNo: student?.roll_no,
            };
            lastFailureDataRef.current = failurePayload;
            if (onPaymentFailure) {
              onPaymentFailure(failurePayload);
            }
          } finally {
            setCheckoutLoading(false);
          }
        }, 1000);
      } else {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        setErrorMessage('Razorpay SDK failed to load — check network connection or ad-blocker.');
        setCheckoutLoading(false);
      }
    } catch (err) {
      console.error('[Razorpay Diagnostics] Checkout initiation failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to initiate Razorpay order.';
      setErrorMessage(msg);
      if (typeof triggerStockAlert === 'function' && (err.response?.data?.is_insufficient_stock || err.response?.data?.is_out_of_stock || msg.includes('available right now') || msg.includes('out of stock'))) {
        triggerStockAlert(msg);
      }
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Desktop Backdrop Overlay (Hidden on mobile full screen) */}
      <div
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in hidden sm:block"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Main Tray Container: FULL SCREEN ON MOBILE (< 640px), Drawer on Desktop (sm: >= 640px) */}
      <div className="w-full h-full sm:h-auto sm:max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-amber-100 z-50 animate-in slide-in-from-bottom sm:slide-in-from-right duration-300 overflow-hidden">

        {/* Drawer Header */}
        <div className="p-3.5 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/90 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-2 bg-amber-100 text-brand-orange rounded-xl shrink-0">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-sm sm:text-lg text-brand-dark leading-tight truncate">Your Meal Tray</h2>
              <p className="text-[10px] sm:text-[11px] text-stone-500 font-semibold uppercase tracking-wider truncate">
                Target: <span className="text-brand-orange">{selectedMealType}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Back to Menu Button */}
            <button
              onClick={handleBackToMenu}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-brand-terracotta bg-amber-100 hover:bg-amber-200/80 border border-amber-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
              aria-label="Back to Menu"
            >
              <Utensils className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span className="whitespace-nowrap">Back to Menu</span>
            </button>

            {/* Close Button */}
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 sm:p-2 rounded-xl sm:rounded-full text-stone-500 hover:text-stone-800 bg-stone-200/60 hover:bg-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
              aria-label="Close Tray"
            >
              <span className="text-xs font-bold sm:hidden">Close</span>
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Note on top of the Tray Section */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-3.5 sm:px-4 py-2.5 flex items-start gap-2.5 text-amber-900 shrink-0">
          <div className="p-1 bg-amber-200/70 text-amber-800 rounded-lg shrink-0 mt-0.5">
            <Info className="w-3.5 h-3.5 text-brand-orange shrink-0" />
          </div>
          <p className="text-[11px] sm:text-xs font-semibold text-stone-800 leading-snug">
            <span className="font-extrabold text-brand-terracotta">Note:</span> Kindly wait for few seconds for the token generation after successful payment and the amount is non-refundable!
          </p>
        </div>

        {/* Drawer Items Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-2xl text-red-800 text-xs font-medium space-y-1.5 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const dataToPass = lastFailureDataRef.current || {
                    reason: errorMessage,
                    amount: finalPayable,
                    mealType: selectedMealType,
                    studentName: student?.name,
                    studentRollNo: student?.roll_no,
                  };
                  if (onPaymentFailure) {
                    onPaymentFailure(dataToPass);
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-orange hover:text-amber-800 underline underline-offset-2 cursor-pointer pt-0.5"
              >
                <span>Money debited? Don't worry — tap here for canteen instructions</span>
              </button>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-4xl sm:text-5xl shadow-inner animate-bounce">
                🍽️
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-stone-800">Your tray is empty — let's fix that!</h3>
              <p className="text-xs sm:text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
                Explore today's active meal menu items below and tap 'Add to Tray'.
              </p>
              <button
                onClick={handleBackToMenu}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold text-xs shadow-warm hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Browse Menu Items</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200/80 hover:border-amber-300 transition-all shadow-xs"
                >
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-stone-100">
                    <CachedImage
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-brand-dark line-clamp-2 leading-snug">
                      {item.base_item_name || item.name}
                    </h4>
                    {item.variant_name && (
                      <span className="inline-block text-[10px] font-extrabold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200 mt-0.5">
                        🫓 {item.variant_name}
                      </span>
                    )}
                    <p className="text-xs font-display font-extrabold text-brand-orange mt-1">₹{item.price}</p>
                  </div>

                  {/* Quantity Counter */}
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-stone-200 shadow-xs">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 text-stone-500 hover:text-brand-orange transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-extrabold text-stone-800 w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 text-stone-500 hover:text-brand-orange transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer & Checkout CTA */}
        {cartItems.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-stone-100 bg-white space-y-3.5 shrink-0 shadow-lg">

            {/* Dynamic Discount Banner (Welcome Discount or Early Order) */}
            {isDiscountActive && discountAmount > 0 && (
              <div className="p-3 bg-gradient-to-r from-emerald-50 via-amber-50 to-orange-50 border border-emerald-300/80 rounded-2xl flex items-center gap-2.5 animate-in fade-in">
                <span className="text-xl">🎉</span>
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-black text-emerald-800 tracking-tight flex items-center gap-1">
                    <span>
                      {discountInfo.discount_type === 'new_user'
                        ? `Welcome Discount: ${discountInfo.discount_percentage}% OFF!`
                        : discountInfo.discount_type === 'early_breakfast'
                          ? `Early Breakfast Discount: ${discountInfo.discount_percentage}% OFF!`
                          : discountInfo.discount_type === 'early_lunch'
                            ? `Early Lunch Discount: ${discountInfo.discount_percentage}% OFF!`
                            : discountInfo.discount_type === 'early_snacks'
                              ? `Early Snacks Discount: ${discountInfo.discount_percentage}% OFF!`
                              : discountInfo.discount_type === 'early_dinner'
                                ? `Early Dinner Discount: ${discountInfo.discount_percentage}% OFF!`
                                : `${discountInfo.discount_percentage}% Discount Applied!`}
                    </span>
                    <Sparkles className="w-3 h-3 text-emerald-600 fill-emerald-500" />
                  </h5>
                  <p className="text-[10px] text-emerald-700 font-semibold truncate">
                    {discountInfo.discount_type === 'new_user'
                      ? `Welcome perk: ${discountInfo.discount_percentage}% off all meals for your first ${discountInfo.new_user_discount_days || 5} days!`
                      : discountInfo.cutoffs?.[selectedMealType]
                        ? `Early bird ${selectedMealType} before ${discountInfo.cutoffs[selectedMealType]}`
                        : `Early bird discount applied!`}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-xs text-stone-600 font-medium">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>

              {isDiscountActive && discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    {discountInfo.discount_type === 'new_user'
                      ? `Welcome Discount (${discountInfo.discount_percentage}%)`
                      : discountInfo.discount_type === 'early_breakfast'
                        ? `Early Breakfast Discount (${discountInfo.discount_percentage}%)`
                        : discountInfo.discount_type === 'early_lunch'
                          ? `Early Lunch Discount (${discountInfo.discount_percentage}%)`
                          : discountInfo.discount_type === 'early_snacks'
                            ? `Early Snacks Discount (${discountInfo.discount_percentage}%)`
                            : discountInfo.discount_type === 'early_dinner'
                              ? `Early Dinner Discount (${discountInfo.discount_percentage}%)`
                              : `Discount (${discountInfo.discount_percentage}%)`}
                  </span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Taxes & Canteen Handling</span>
                <span className="text-emerald-600 font-bold">FREE</span>
              </div>

              <div className="flex justify-between items-center text-sm sm:text-base font-extrabold font-display text-brand-dark pt-2 border-t border-stone-100">
                <span>Total Payable</span>
                <div className="text-right">
                  {isDiscountActive && discountAmount > 0 && (
                    <span className="text-xs text-stone-400 line-through mr-2 font-medium">
                      ₹{cartTotal}
                    </span>
                  )}
                  <span className="text-brand-orange text-lg sm:text-xl">₹{finalPayable}</span>
                </div>
              </div>
            </div>

            {/* FEATURE: Parcel / Takeaway Checkbox Option */}
            <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-100/70 transition-all shadow-xs">
              <label htmlFor="tray-parcel-checkbox" className="flex items-center gap-2.5 cursor-pointer select-none min-w-0 flex-1">
                <span className="text-xl shrink-0">📦</span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-stone-900 flex items-center gap-1.5 flex-wrap">
                    <span>Pack as Parcel</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${isParcel ? 'bg-amber-500 text-white shadow-xs' : 'bg-stone-200 text-stone-700'
                      }`}>
                      {isParcel ? 'Parcel' : 'Dine In'}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-600 font-semibold truncate mt-0.5">
                    {isParcel ? 'Kitchen staff will pack this as takeaway' : 'Default: Dine-in order at mess counter'}
                  </p>
                </div>
              </label>
              <input
                id="tray-parcel-checkbox"
                type="checkbox"
                checked={isParcel}
                onChange={(e) => setIsParcel(e.target.checked)}
                className="w-5 h-5 rounded-lg text-brand-orange border-stone-300 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer accent-orange-500 shrink-0"
              />
            </div>

            {/* Meal Service Distribution Notice in Cart */}
            {currentMealWindow?.is_note_visible && (
              <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-amber-950 text-xs shadow-2xs animate-in fade-in">
                <span className="text-base shrink-0 mt-0.5">⏰</span>
                <div className="space-y-0.5">
                  <p className="font-extrabold text-amber-950">
                    {(selectedMealType || currentMealWindow?.meal_type || 'meal').charAt(0).toUpperCase() + (selectedMealType || currentMealWindow?.meal_type || 'meal').slice(1)} Service {currentMealWindow.is_serving_started ? 'Started at' : 'Starts at'} {currentMealWindow.formatted_serving_start_time || '12:30 PM'}
                  </p>
                  <p className="text-[11px] text-amber-900/90 font-medium">
                    {currentMealWindow.is_serving_started
                      ? `Service is ongoing from ${currentMealWindow.formatted_serving_start_time || '12:30 PM'}. Fresh orders are being prepared & served.`
                      : `Orders placed now will be prepared & served starting from ${currentMealWindow.formatted_serving_start_time || '12:30 PM'}. Pickup begins once service starts.`}
                  </p>
                </div>
              </div>
            )}

            {/* Single Online Checkout Action */}
            <div className="space-y-2">
              <button
                onClick={handleProceedToPay}
                disabled={checkoutLoading}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-extrabold rounded-2xl text-sm shadow-warm hover:shadow-cardHover transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {checkoutLoading ? (
                  <span>Initiating Razorpay...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Pay via Razorpay (₹{finalPayable})</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-stone-400 font-medium">
                Pay online & get instant order token number
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
