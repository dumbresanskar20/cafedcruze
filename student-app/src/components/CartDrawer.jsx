import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, AlertCircle, Utensils, Info, Sparkles, MapPin, Phone, Check } from 'lucide-react';
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

  // Parcel Delivery Address State & Management
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressActionError, setAddressActionError] = useState('');

  // Add Address Form State
  const [newLabel, setNewLabel] = useState('Hostel');
  const [newAddressLine, setNewAddressLine] = useState('');
  const [newRoomOrFlat, setNewRoomOrFlat] = useState('');
  const [newPhone, setNewPhone] = useState(student?.phone || '');

  useEffect(() => {
    if (student?.phone && !newPhone) {
      setNewPhone(student.phone);
    }
  }, [student?.phone]);

  // Load addresses when parcel option is enabled
  useEffect(() => {
    if (!isParcel) return;

    let isMounted = true;
    const loadAddresses = async () => {
      setLoadingAddresses(true);
      try {
        if (isAuthenticated) {
          const res = await api.get('/auth/student/addresses');
          if (isMounted && res.data?.success && Array.isArray(res.data.addresses)) {
            setAddresses(res.data.addresses);
            try {
              localStorage.setItem('mess_student_addresses', JSON.stringify(res.data.addresses));
            } catch (e) {}

            if (res.data.addresses.length > 0) {
              const def = res.data.addresses.find((a) => a.is_default) || res.data.addresses[0];
              setSelectedAddressId((prev) => prev || def.id);
            }
          }
        } else {
          const cached = localStorage.getItem('mess_student_addresses');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAddresses(parsed);
              const def = parsed.find((a) => a.is_default) || parsed[0];
              setSelectedAddressId((prev) => prev || def.id);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load student addresses, reading cache:', err.message);
        const cached = localStorage.getItem('mess_student_addresses');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAddresses(parsed);
              const def = parsed.find((a) => a.is_default) || parsed[0];
              setSelectedAddressId((prev) => prev || def.id);
            }
          } catch (e) {}
        }
      } finally {
        if (isMounted) setLoadingAddresses(false);
      }
    };

    loadAddresses();
    return () => {
      isMounted = false;
    };
  }, [isParcel, isAuthenticated]);

  const selectedAddressObj = addresses.find((a) => a.id === selectedAddressId);
  const selectedAddressText = selectedAddressObj
    ? [
        selectedAddressObj.label ? `[${selectedAddressObj.label}]` : null,
        selectedAddressObj.room_or_flat ? `Room/Flat: ${selectedAddressObj.room_or_flat}` : null,
        selectedAddressObj.address_line,
        selectedAddressObj.phone ? `Ph: ${selectedAddressObj.phone}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const handleSaveAddress = async (e) => {
    e?.preventDefault();
    setAddressActionError('');

    if (!newAddressLine.trim()) {
      setAddressActionError('Please enter delivery address details.');
      return;
    }

    setIsSavingAddress(true);
    try {
      if (isAuthenticated) {
        const res = await api.post('/auth/student/addresses', {
          label: newLabel.trim() || 'Hostel',
          address_line: newAddressLine.trim(),
          room_or_flat: newRoomOrFlat.trim() || null,
          phone: newPhone.trim() || null,
          is_default: addresses.length === 0,
        });

        if (res.data?.success && res.data.address) {
          const created = res.data.address;
          const updated = [created, ...addresses];
          setAddresses(updated);
          setSelectedAddressId(created.id);
          try {
            localStorage.setItem('mess_student_addresses', JSON.stringify(updated));
          } catch (e) {}
          setShowAddAddressForm(false);
          setNewAddressLine('');
          setNewRoomOrFlat('');
        }
      } else {
        const localAddr = {
          id: `local_${Date.now()}`,
          label: newLabel.trim() || 'Hostel',
          address_line: newAddressLine.trim(),
          room_or_flat: newRoomOrFlat.trim() || null,
          phone: newPhone.trim() || null,
          is_default: addresses.length === 0,
        };
        const updated = [localAddr, ...addresses];
        setAddresses(updated);
        setSelectedAddressId(localAddr.id);
        try {
          localStorage.setItem('mess_student_addresses', JSON.stringify(updated));
        } catch (e) {}
        setShowAddAddressForm(false);
        setNewAddressLine('');
        setNewRoomOrFlat('');
      }
    } catch (err) {
      console.error('Error saving address:', err);
      setAddressActionError(err.response?.data?.message || 'Failed to save address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addrId, e) => {
    e?.stopPropagation();
    try {
      if (isAuthenticated && !String(addrId).startsWith('local_')) {
        await api.delete(`/auth/student/addresses/${addrId}`);
      }
      const updated = addresses.filter((a) => a.id !== addrId);
      setAddresses(updated);
      try {
        localStorage.setItem('mess_student_addresses', JSON.stringify(updated));
      } catch (e) {}
      if (selectedAddressId === addrId) {
        setSelectedAddressId(updated[0]?.id || null);
      }
    } catch (err) {
      console.error('Error deleting address:', err);
    }
  };

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

    // STRICT VALIDATION: If parcel is selected, delivery address is strictly required
    if (isParcel) {
      if (!selectedAddressId || !selectedAddressText || !selectedAddressText.trim()) {
        setErrorMessage('Delivery address is required for parcel orders. Please select or add an address above before proceeding.');
        return;
      }
    }

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
        meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
        cartTotal,
        isParcel,
        delivery_address: isParcel ? selectedAddressText : null,
      });

      const res = await api.post('/orders/create-razorpay-order', {
        items: cartItems,
        meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
        order_type: isParcel ? 'parcel' : 'dine_in',
        is_parcel: isParcel,
        delivery_address: isParcel ? selectedAddressText : null,
      });

      console.log('[Razorpay Diagnostics] 3. Backend order creation response received:', res.data);

      const { razorpay_order_id, amount, currency, key_id, order_db_id } = res.data;

      if (!razorpay_order_id) {
        throw new Error('Backend response did not contain a valid Razorpay Order ID.');
      }

      // Persist pending checkout in sessionStorage for mobile UPI redirect / reload resilience
      try {
        sessionStorage.setItem(
          'pending_mealbook_checkout',
          JSON.stringify({
            razorpay_order_id,
            order_db_id,
            itemsCount: cartItems.length,
            delivery_address: isParcel ? selectedAddressText : null,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        // Ignore storage errors
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
              order_db_id: order_db_id,
              items: cartItems,
              meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
              order_type: isParcel ? 'parcel' : 'dine_in',
              is_parcel: isParcel,
              delivery_address: isParcel ? selectedAddressText : null,
            });

            console.log('[Razorpay Diagnostics] Payment verification response:', verifyRes.data);

            if (verifyRes.data.success) {
              sessionStorage.removeItem('pending_mealbook_checkout');
              clearCart(); // Clear cart ONLY on successful checkout
              setIsCartOpen(false);
              setTimeout(() => {
                onOrderSuccess(verifyRes.data.token_number, verifyRes.data.order);
              }, 250);
              return;
            }
          } catch (verifyErr) {
            console.warn('[Razorpay Diagnostics] Direct verification call encountered error, checking payment status fallback...', verifyErr);
          }

          // Fallback auto-check: Check order status with backend (queries Razorpay API directly)
          try {
            const statusRes = await api.get(`/orders/check-payment-status/${response.razorpay_order_id || razorpay_order_id}`);
            if (statusRes.data?.is_paid && statusRes.data?.token_number) {
              console.log('[Razorpay Diagnostics] Payment confirmed via status check fallback!');
              sessionStorage.removeItem('pending_mealbook_checkout');
              clearCart();
              setIsCartOpen(false);
              setTimeout(() => {
                onOrderSuccess(statusRes.data.token_number, statusRes.data.order);
              }, 250);
              return;
            }
          } catch (chkErr) {
            console.error('[Razorpay Diagnostics] Status check fallback error:', chkErr);
          }

          // If both verification and fallback fail:
          const failReason = 'Payment verification could not be completed immediately. Please check your order history.';
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
          setCheckoutLoading(false);
        },
        prefill: {
          name: student?.name || 'User',
          email: student?.email || 'user@mess.com',
        },
        theme: {
          color: '#ea580c',
        },
        modal: {
          ondismiss: async function () {
            console.log('[Razorpay Diagnostics] Checkout modal dismissed. Checking if payment was completed in UPI/banking app...');
            setCheckoutLoading(false);
            try {
              // Resilience for mobile UPI: User may have completed payment in PhonePe/GPay before switching back
              const statusRes = await api.get(`/orders/check-payment-status/${razorpay_order_id}`);
              if (statusRes.data?.is_paid && statusRes.data?.token_number) {
                console.log('[Razorpay Diagnostics] Payment confirmed on modal dismiss check!');
                sessionStorage.removeItem('pending_mealbook_checkout');
                clearCart();
                setIsCartOpen(false);
                setTimeout(() => {
                  onOrderSuccess(statusRes.data.token_number, statusRes.data.order);
                }, 250);
              }
            } catch (e) {
              // Ignore dismiss check network failure
            }
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
              meal_type: selectedMealType || cartItems[0]?.meal_type || 'lunch',
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
                        {item.variant_name}
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

            {/* FEATURE: Parcel Delivery Address Selector & Management */}
            {isParcel && (
              <div className="p-3.5 bg-gradient-to-br from-amber-50/90 to-orange-50/60 border-2 border-amber-300 rounded-3xl space-y-3 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-brand-orange/15 text-brand-orange flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-stone-900 tracking-tight flex items-center gap-1.5">
                        <span>Delivery Address</span>
                        <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          Required
                        </span>
                      </h4>
                      <p className="text-[10px] text-stone-500 font-medium truncate">
                        {addresses.length > 0 ? 'Select or add your delivery location' : 'Add delivery location to proceed'}
                      </p>
                    </div>
                  </div>

                  {!showAddAddressForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddAddressForm(true);
                        setAddressActionError('');
                      }}
                      className="px-2.5 py-1 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  )}
                </div>

                {/* Saved Addresses Radio List */}
                {addresses.length > 0 && !showAddAddressForm && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                    {addresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-white border-brand-orange ring-2 ring-brand-orange/30 shadow-sm'
                              : 'bg-white/70 border-amber-200/80 hover:bg-white hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <div className={`w-4 h-4 rounded-full mt-0.5 border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-brand-orange bg-brand-orange' : 'border-stone-300'
                            }`}>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                                  {addr.label || 'Address'}
                                </span>
                                {addr.room_or_flat && (
                                  <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                                    {addr.room_or_flat}
                                  </span>
                                )}
                                {Boolean(addr.is_default) && (
                                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-stone-800 break-words mt-1 leading-snug">
                                {addr.address_line}
                              </p>
                              {addr.phone && (
                                <p className="text-[10px] text-stone-500 font-medium mt-0.5 flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5 text-stone-400" />
                                  <span>{addr.phone}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteAddress(addr.id, e)}
                            title="Remove address"
                            className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Empty State when no addresses exist */}
                {addresses.length === 0 && !showAddAddressForm && (
                  <div className="p-3 bg-white/80 rounded-2xl border border-dashed border-amber-300 text-center space-y-2">
                    <p className="text-xs text-stone-600 font-medium">
                      No saved addresses found. Please add a delivery address to proceed.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAddAddressForm(true)}
                      className="px-3.5 py-1.5 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Address</span>
                    </button>
                  </div>
                )}

                {/* Add Address Form */}
                {showAddAddressForm && (
                  <form onSubmit={handleSaveAddress} className="p-3 bg-white rounded-2xl border border-amber-300 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                      <span className="text-xs font-black text-stone-900 uppercase tracking-wide">
                        Add Delivery Address
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddAddressForm(false);
                          setAddressActionError('');
                        }}
                        className="text-stone-400 hover:text-stone-700 p-1 rounded-lg text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    {addressActionError && (
                      <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
                        {addressActionError}
                      </p>
                    )}

                    {/* Label selection */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-stone-500">Address Label</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['Hostel', 'Campus Block', 'Room', 'Home', 'Other'].map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => setNewLabel(lbl)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                              newLabel === lbl
                                ? 'bg-brand-dark text-white border-brand-dark shadow-2xs'
                                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase text-stone-500">Room / Flat No.</label>
                        <input
                          type="text"
                          placeholder="e.g. Room 204"
                          value={newRoomOrFlat}
                          onChange={(e) => setNewRoomOrFlat(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-brand-orange"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase text-stone-500">Contact Phone</label>
                        <input
                          type="tel"
                          placeholder="10-digit mobile"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-brand-orange"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-stone-500">Address Details *</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Hostel name, building, floor or campus landmark..."
                        value={newAddressLine}
                        onChange={(e) => setNewAddressLine(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-brand-orange resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSavingAddress}
                        className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {isSavingAddress ? 'Saving...' : 'Save & Select Address'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddAddressForm(false);
                          setAddressActionError('');
                        }}
                        className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

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

            {/* Warning if Parcel is checked but no address selected */}
            {isParcel && (!selectedAddressId || !selectedAddressText) && (
              <div className="p-3 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex items-center gap-2.5 text-amber-900 text-xs font-bold animate-pulse">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Please select or add a delivery address above to proceed with your parcel order.</span>
              </div>
            )}

            {/* Single Online Checkout Action */}
            <div className="space-y-2">
              <button
                onClick={handleProceedToPay}
                disabled={checkoutLoading || (isParcel && (!selectedAddressId || !selectedAddressText))}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-extrabold rounded-2xl text-sm shadow-warm hover:shadow-cardHover transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {checkoutLoading ? (
                  <span>Initiating Razorpay...</span>
                ) : isParcel && (!selectedAddressId || !selectedAddressText) ? (
                  <>
                    <MapPin className="w-4 h-4 shrink-0 text-amber-200" />
                    <span>Select Address to Pay (₹{finalPayable})</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Pay via Razorpay (₹{finalPayable})</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-stone-400 font-medium">
                {isParcel && (!selectedAddressId || !selectedAddressText)
                  ? 'Delivery address selection is mandatory for parcel orders'
                  : 'Pay online & get instant order token number'}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
