import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero3D from './components/Hero3D';
import MealTypeTabs from './components/MealTypeTabs';
import MealDiscountNote from './components/MealDiscountNote';
import MealTimingNote from './components/MealTimingNote';
import MenuCard from './components/MenuCard';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import OrderSuccessModal from './components/OrderSuccessModal';
import PaymentFailureModal from './components/PaymentFailureModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import OrderDetailModal from './components/OrderDetailModal';
import SubscriptionExpiredScreen from './components/SubscriptionExpiredScreen';
import { useCart } from './context/CartContext';
import { useAuth } from './context/AuthContext';
import { Utensils, Clock, AlertCircle, Info, CheckCircle2, Package, X } from 'lucide-react';
import CAFE_D_CRUZE_LOGO from './assets/logo';
import api from './services/api';
import { createSocketClient } from './services/socket';
import { preloadImages } from './utils/imageCache';

export default function App() {
  const {
    selectedMealType,
    setSelectedMealType,
    activeMealWindows,
    currentMealWindow,
    allMealsInactive,
    redirectNotice,
    clearCart,
    discountInfo,
    fetchDiscountStatus,
    fetchMealWindows,
    setIsCartOpen,
  } = useCart();

  const { student, isAuthenticated, logout, openAuthModal } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [backendStatus, setBackendStatus] = useState({ is_active: true, is_currently_open: true });
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [navbarHeight, setNavbarHeight] = useState(64);

  // Modals state
  const [successToken, setSuccessToken] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [paymentFailureData, setPaymentFailureData] = useState(null);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [detailModalOrder, setDetailModalOrder] = useState(null);

  // Real-time Parcel Countdown Timers & Alerts
  const [now, setNow] = useState(Date.now());
  const [parcelTimers, setParcelTimers] = useState(() => {
    try {
      const stored = localStorage.getItem('mess_parcel_timers');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [dismissedParcelAlerts, setDismissedParcelAlerts] = useState({});

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  // Dynamically measure navbar height for sticky positioning
  useEffect(() => {
    const updateNavbarHeight = () => {
      const headerEl = document.querySelector('header');
      if (headerEl) {
        setNavbarHeight(headerEl.offsetHeight);
      }
    };

    updateNavbarHeight();
    window.addEventListener('resize', updateNavbarHeight);

    let observer;
    const headerEl = document.querySelector('header');
    if (headerEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateNavbarHeight());
      observer.observe(headerEl);
    }

    return () => {
      window.removeEventListener('resize', updateNavbarHeight);
      if (observer) observer.disconnect();
    };
  }, []);

  const selectedMealTypeRef = React.useRef(selectedMealType);
  useEffect(() => {
    selectedMealTypeRef.current = selectedMealType;
  }, [selectedMealType]);

  const fetchMenuItems = React.useCallback(async (mealTypeToFetch) => {
    const meal = mealTypeToFetch || selectedMealTypeRef.current || 'breakfast';
    setLoadingMenu(true);
    try {
      const res = await api.get(`/menu/items?meal_type=${meal}&active_only=true`);
      if (res.data.success) {
        setBackendStatus({
          is_active: res.data.is_active !== false,
          is_currently_open: res.data.is_currently_open !== false,
        });
        const items = res.data.items || [];
        setMenuItems(items);
        preloadImages(items.map((i) => i.image_url));
      } else {
        setMenuItems([]);
      }
    } catch (err) {
      if (err.response?.status === 402) {
        setSubscriptionExpired(true);
      } else {
        console.warn('API error fetching menu items:', err?.message || err);
        setMenuItems([]);
      }
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  const checkSub = async () => {
    try {
      const res = await api.get('/subscription/status');
      const isExp = res.data.subscription?.is_expired || res.data.subscription?.status !== 'active';
      setSubscriptionExpired(Boolean(isExp));
    } catch (err) {
      if (err.response?.status === 402) {
        setSubscriptionExpired(true);
      }
    }
  };

  // Check subscription status on mount, via periodic polling, and listen for 402 event
  useEffect(() => {
    checkSub();
    const interval = setInterval(checkSub, 15000); // Polling every 15s to keep state synchronized

    const handleExpired = () => setSubscriptionExpired(true);
    window.addEventListener('subscription_expired', handleExpired);
    return () => {
      clearInterval(interval);
      window.removeEventListener('subscription_expired', handleExpired);
    };
  }, []);

  // Global socket listener for live subscription, rating updates, and menu sales re-ranking
  useEffect(() => {
    const socket = createSocketClient();

    socket.on('subscription:status_changed', (payload) => {
      console.log('[Student Socket] Subscription status changed:', payload);
      const isExp = payload.is_expired || payload.status !== 'active';
      setSubscriptionExpired(Boolean(isExp));
      if (!isExp) {
        fetchMenuItems(selectedMealTypeRef.current);
      }
    });

    // Real-time live re-ranking when students rate items or new orders occur
    const handleLiveMenuUpdate = (data) => {
      console.log('[Student Socket] Live menu rating/sales update received:', data);
      fetchMenuItems(selectedMealTypeRef.current);
    };

    socket.on('menu:rating_updated', handleLiveMenuUpdate);
    socket.on('menu:sales_updated', handleLiveMenuUpdate);
    socket.on('menu:updated', handleLiveMenuUpdate);
    socket.on('menu:stock_updated', handleLiveMenuUpdate);
    socket.on('inventory:tracking_toggled', handleLiveMenuUpdate);
    socket.on('review:new', handleLiveMenuUpdate);

    // Live meal window timing updates broadcast from admin panel
    socket.on('meal_window:updated', (data) => {
      console.log('[Student Socket] Meal window update received:', data);
      if (typeof fetchMealWindows === 'function') {
        fetchMealWindows(true);
      }
    });

    // Live discount settings updates broadcast from admin panel
    socket.on('discount_settings:updated', (data) => {
      console.log('[Student Socket] Discount settings update received:', data);
      if (typeof fetchDiscountStatus === 'function') {
        fetchDiscountStatus(selectedMealType);
      }
    });

    // Real-time parcel preparation timers broadcast from admin
    const handleTimerUpdate = (data) => {
      if (data && data.orderId) {
        setParcelTimers((prev) => {
          const updated = { ...prev, [data.orderId]: data };
          if (data.token_number) updated[data.token_number] = data;
          localStorage.setItem('mess_parcel_timers', JSON.stringify(updated));
          return updated;
        });
      }
    };

    const handleTimerCleared = (data) => {
      if (data && data.orderId) {
        setParcelTimers((prev) => {
          const updated = { ...prev };
          delete updated[data.orderId];
          if (data.token_number) delete updated[data.token_number];
          localStorage.setItem('mess_parcel_timers', JSON.stringify(updated));
          return updated;
        });
      }
    };

    socket.on('order:timer_broadcast', handleTimerUpdate);
    socket.on('parcel:timer_updated', handleTimerUpdate);
    socket.on('order:timer_cleared_broadcast', handleTimerCleared);
    socket.on('parcel:timer_cleared', handleTimerCleared);

    // Cross-tab BroadcastChannel sync
    let bc;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('mess_parcel_channel');
        bc.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'TIMER_SET' && payload?.orderId) {
            handleTimerUpdate(payload);
          } else if (type === 'TIMER_CLEARED' && payload?.orderId) {
            handleTimerCleared(payload);
          }
        };
      } catch (err) {
        console.error('BroadcastChannel error in App.jsx:', err);
      }
    }

    // Also listen for local rating submission event
    const handleLocalRating = () => {
      console.log('[Student Event] Local rating submitted, refreshing ranked menu...');
      fetchMenuItems(selectedMealTypeRef.current);
    };

    window.addEventListener('rating_submitted', handleLocalRating);

    return () => {
      socket.disconnect();
      if (bc) bc.close();
      window.removeEventListener('rating_submitted', handleLocalRating);
    };
  }, [fetchMenuItems]);

  // Real-time Socket.IO listener for live student order updates
  useEffect(() => {
    if (!isAuthenticated || !student) return;

    const studentId = student._id || student.id;
    const socket = createSocketClient();

    socket.on('connect', () => {
      if (studentId) {
        socket.emit('join:student', studentId);
      }
    });

    socket.on('student:order_updated', (payload) => {
      console.log('[Student Socket] Live order update received:', payload);
      if (payload.token_number && payload.payment_status === 'paid') {
        clearCart();
        setSuccessToken(payload.token_number);
        setSuccessOrder(payload.order || { token_number: payload.token_number, payment_status: 'paid' });
      }

      if (payload.order_status) {
        setSuccessOrder((prev) => {
          if (prev && ((prev._id || prev.id) === payload.orderId || prev.token_number === payload.token_number)) {
            return { ...prev, order_status: payload.order_status };
          }
          return prev;
        });

        if (payload.order_status === 'delivered') {
          setParcelTimers((prev) => {
            const updated = { ...prev };
            if (payload.orderId) delete updated[payload.orderId];
            if (payload.token_number) delete updated[payload.token_number];
            localStorage.setItem('mess_parcel_timers', JSON.stringify(updated));
            return updated;
          });
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, student, clearCart]);

  // Check for reset_token in URL query parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenVal = params.get('reset_token') || params.get('token');
      if (tokenVal) {
        openAuthModal(false, 'reset-password', tokenVal);
      }
    }
  }, []);

  // Event listener to allow triggering the Payment Failure Modal for testing / support
  useEffect(() => {
    const handleSimulate = (e) => {
      setPaymentFailureData(e.detail || {
        reason: 'Payment transaction failed or token pending verification.',
        orderId: 'order_test_987654321',
        paymentId: 'pay_test_123456789',
        amount: 80,
        mealType: selectedMealType || 'lunch',
        studentName: student?.name || 'Student',
        studentRollNo: student?.roll_no || 'CS-2024',
      });
    };
    window.addEventListener('test_payment_failure_modal', handleSimulate);
    return () => window.removeEventListener('test_payment_failure_modal', handleSimulate);
  }, [selectedMealType, student]);

  useEffect(() => {
    fetchMenuItems(selectedMealType);
  }, [selectedMealType, fetchMenuItems]);

  const handleOrderSuccess = (tokenNumber, order) => {
    clearCart();
    setSuccessToken(tokenNumber);
    setSuccessOrder(order);
  };

  const mealNameCapitalized = selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1);
  const isCurrentlyOpen = currentMealWindow ? currentMealWindow.is_currently_open : backendStatus.is_currently_open;
  const isFullDay = currentMealWindow ? currentMealWindow.is_full_day : false;
  const formattedStartTime = currentMealWindow?.formatted_start_time || '08:00 AM';
  const formattedEndTime = currentMealWindow?.formatted_end_time || '08:00 PM';

  if (subscriptionExpired) {
    return <SubscriptionExpiredScreen onRetry={checkSub} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-warmBg w-full max-w-full overflow-x-clip pt-16 sm:pt-20">

      {/* Top Header with Persistent Top-Right Auth Control & Dynamic Navbar */}
      <Header onOpenOrders={() => setOrdersModalOpen(true)} />

      {/* Redirect Notice Toast Banner */}
      {redirectNotice && (
        <div className="bg-amber-500 text-white font-bold text-xs py-2.5 px-3 text-center flex items-center justify-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 w-full">
          <Info className="w-4 h-4 shrink-0" />
          <span className="truncate">{redirectNotice}</span>
        </div>
      )}

      {/* Hero Section */}
      <Hero3D />

      {/* Sticky Meal Category Tabs directly below navbar */}
      <MealTypeTabs navbarHeight={navbarHeight} />

      {/* Main Menu Section */}
      <main id="menu-section" className="flex-1 max-w-screen-2xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* ALL MEAL TYPES INACTIVE EDGE CASE (CANTEEN CLOSED FOR HOLIDAY) */}
        {allMealsInactive ? (
          <div className="text-center py-16 sm:py-20 px-4 bg-white/80 backdrop-blur-md rounded-3xl border border-amber-200 shadow-sm max-w-2xl mx-auto my-6 space-y-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-100/80 text-brand-orange flex items-center justify-center text-4xl sm:text-5xl mx-auto shadow-inner animate-bounce">
              🍱
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-brand-dark tracking-tight">
              We're closed right now — check back soon!
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 font-medium max-w-md mx-auto">
              Canteen Management has temporarily paused all meal offerings today. Please check back during standard operating hours.
            </p>
          </div>
        ) : (
          <>
            {/* TIME-CLOSED BROWSING BANNER */}
            {!isCurrentlyOpen && (
              <div className="mb-6 sm:mb-8 p-3.5 sm:p-4 bg-amber-50 border border-amber-300 rounded-3xl shadow-sm text-amber-900 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-in fade-in">
                <div className="p-2 sm:p-2.5 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-amber-950">
                    🕐 {mealNameCapitalized} ordering opens at {formattedStartTime} and closes at {formattedEndTime}.
                  </p>
                  <p className="text-amber-800 text-xs mt-0.5 font-medium">
                    You can browse today's menu items below, but ordering is currently closed until the next window opening.
                  </p>
                </div>
              </div>
            )}

            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-3 sm:pb-4 border-b border-amber-200/60 gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold text-brand-orange uppercase tracking-wider bg-orange-100/80 px-2.5 sm:px-3 py-1 rounded-full mb-2">
                  <Utensils className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
                  <span>Campus Mess Kitchen</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold font-display text-brand-dark tracking-tight">
                  Today's <span className="text-brand-orange capitalize">{selectedMealType}</span> Menu
                </h2>

                {/* Operating Window Badge */}
                {currentMealWindow && (
                  <div className="mt-1.5 inline-flex items-center gap-2 text-xs font-bold flex-wrap">
                    <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span className="text-stone-600">
                      {isFullDay ? '24/7 Full-Day Ordering' : `Window: ${formattedStartTime} – ${formattedEndTime}`}
                    </span>

                    {isCurrentlyOpen ? (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase">
                        Ordering Open
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase">
                        Ordering Closed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Meal Service / Distribution Notice (Visible only before set time) */}
            <MealTimingNote />

            {/* 24/7 Meal Discount Note */}
            <MealDiscountNote />

            {/* Menu Cards Grid */}
            {loadingMenu ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-80 bg-white/70 rounded-3xl border border-stone-200" />
                ))}
              </div>
            ) : !backendStatus.is_active ? (
              <div className="text-center py-12 sm:py-16 bg-amber-50/60 rounded-3xl border border-amber-200 space-y-2 px-4">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                <p className="font-display font-bold text-stone-800 text-base sm:text-lg">
                  {selectedMealType.toUpperCase()} is currently not offered by Canteen Management.
                </p>
                <p className="text-xs text-stone-500">Please select another active meal category above.</p>
              </div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-12 sm:py-16 bg-white/60 rounded-3xl border border-dashed border-amber-200 px-4">
                <p className="font-display font-bold text-stone-700 text-base sm:text-lg">No active items for this meal time right now.</p>
                <p className="text-xs text-stone-500 mt-1">Please select another meal category above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                {menuItems.map((item) => (
                  <MenuCard key={item._id || item.id} item={item} isCurrentlyOpen={isCurrentlyOpen} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-300 py-3 sm:py-3.5 border-t border-stone-800 w-full">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <img
              src={CAFE_D_CRUZE_LOGO}
              alt="Cafe D Cruze Restaurant Logo"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-contain bg-white p-0.5"
            />
            <span className="font-display font-bold text-sm sm:text-base text-white tracking-tight">
              Cafe D Cruze <span className="text-brand-orange">Restaurant</span>
            </span>
          </div>

          <p className="text-xs text-stone-400">
            Made by{' '}
            <a
              href="https://dypcoeiincubationcentre.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-200 hover:text-brand-orange font-medium underline underline-offset-2 transition-colors"
            >
              DYPCOEI incubation Centre
            </a>{' '}
            and{' '}
            <a
              href="https://mealbook.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-200 hover:text-brand-orange font-medium underline underline-offset-2 transition-colors"
            >
              MealBook
            </a>
          </p>
        </div>
      </footer>

      {/* Global Modals & Drawers */}
      <AuthModal />
      <CartDrawer
        onOrderSuccess={handleOrderSuccess}
        onPaymentFailure={(data) => setPaymentFailureData(data)}
      />
      <OrderSuccessModal
        tokenNumber={successToken}
        order={successOrder}
        onClose={() => {
          setSuccessToken(null);
          setSuccessOrder(null);
        }}
      />
      <PaymentFailureModal
        isOpen={Boolean(paymentFailureData)}
        failureData={paymentFailureData}
        onClose={() => setPaymentFailureData(null)}
        onOpenOrderHistory={() => {
          setPaymentFailureData(null);
          setOrdersModalOpen(true);
        }}
        onRetry={() => {
          setPaymentFailureData(null);
          setIsCartOpen(true);
        }}
      />
      <OrderHistoryModal
        isOpen={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
      />
      {detailModalOrder && (
        <OrderDetailModal
          order={detailModalOrder}
          onClose={() => setDetailModalOrder(null)}
        />
      )}

      {/* Floating Live Parcel Tracker Banner for active timer / ready status */}
      {(() => {
        // Collect active timers
        const activeTimerEntries = Object.entries(parcelTimers).filter(([k, t]) => {
          if (!t || !t.readyAt) return false;
          if (dismissedParcelAlerts[t.orderId || k]) return false;
          return true;
        });

        if (activeTimerEntries.length === 0) return null;

        // Show the top active timer
        const [targetKey, activeTimer] = activeTimerEntries[0];
        const diffSeconds = Math.max(0, Math.floor((activeTimer.readyAt - now) / 1000));
        const isReady = diffSeconds === 0;

        const mins = Math.floor(diffSeconds / 60);
        const secs = diffSeconds % 60;
        const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        return (
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-sm w-[calc(100%-2rem)] sm:w-80 animate-in slide-in-from-bottom-5 duration-300">
            <div className={`p-4 rounded-3xl shadow-2xl border-2 backdrop-blur-md transition-all ${
              isReady
                ? 'bg-emerald-600/95 text-white border-emerald-300 shadow-emerald-500/30 ring-4 ring-emerald-400/30'
                : 'bg-stone-900/95 text-white border-amber-400/80 shadow-orange-500/20 ring-4 ring-amber-400/20'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shadow-sm shrink-0 ${
                    isReady ? 'bg-white text-emerald-700 animate-bounce' : 'bg-brand-orange text-white'
                  }`}>
                    {isReady ? <CheckCircle2 className="w-6 h-6 stroke-[3]" /> : <Package className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-black tracking-wider opacity-85 block truncate">
                      {isReady ? '🎉 Parcel Ready for Pickup!' : '📦 Kitchen Preparing Parcel'}
                    </span>
                    <div className="font-extrabold text-sm flex items-center gap-1.5 flex-wrap">
                      <span>Token #{activeTimer.token_number || targetKey}</span>
                      {!isReady && (
                        <span className="font-mono text-amber-300 bg-black/40 px-2 py-0.5 rounded-lg text-xs font-black flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
                          {timeFormatted}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setDismissedParcelAlerts((prev) => ({ ...prev, [activeTimer.orderId || targetKey]: true }))}
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium opacity-90 truncate">
                  {isReady ? 'Collect now at canteen counter' : 'Synchronized with kitchen'}
                </p>
                <button
                  onClick={() => {
                    setDetailModalOrder({
                      id: activeTimer.orderId || targetKey,
                      _id: activeTimer.orderId || targetKey,
                      token_number: activeTimer.token_number || targetKey,
                      order_status: isReady ? 'ready' : 'preparing',
                      is_parcel: true,
                      order_type: 'parcel',
                      date: new Date().toISOString().split('T')[0],
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-sm shrink-0 cursor-pointer ${
                    isReady
                      ? 'bg-white text-emerald-800 hover:bg-emerald-50'
                      : 'bg-amber-400 text-stone-950 hover:bg-amber-300'
                  }`}
                >
                  View QR
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

