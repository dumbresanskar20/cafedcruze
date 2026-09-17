import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { createSocketClient } from '../services/socket';

const CartContext = createContext();

const ANONYMOUS_CART_KEY = 'mess_cart';

const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage getItem failed:', e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage setItem failed:', e);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage removeItem failed:', e);
    }
  },
};

export const CartProvider = ({ children }) => {
  const { student, isAuthenticated, openAuthModal } = useAuth();
  const [selectedMealType, setSelectedMealTypeState] = useState(() => {
    try {
      return sessionStorage.getItem('selected_meal_type') || 'breakfast';
    } catch (e) {
      return 'breakfast';
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  
  // Parcel Checkbox State (Default is false = Dine In)
  const [isParcel, setIsParcel] = useState(false);

  // Discount Status State (Dynamic from DiscountSettings & Student Created Date)
  const [discountInfo, setDiscountInfo] = useState({
    is_discount_active: false,
    discount_percentage: 0,
    discount_type: 'none',
    is_new_user: false,
    new_user_discount_days: 0,
    new_user_discount_percentage: 0,
    server_time: '',
    cutoffs: {},
    settings: null,
  });

  // Dynamic Meal Windows State
  const [mealWindows, setMealWindows] = useState([]);
  const [loadingWindows, setLoadingWindows] = useState(true);
  const [redirectNotice, setRedirectNotice] = useState(null);

  // Real-time client clock ticker (HH:mm) updated every 10 seconds for seamless live notice toggling
  const [clientCurrentTime, setClientCurrentTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClientCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Determine current cart key based on user login status
  const studentId = student?.id || student?._id;
  const cartKey = isAuthenticated && studentId ? `mess_cart_${studentId}` : ANONYMOUS_CART_KEY;

  // Initialize cart state synchronously from localStorage on app load / page refresh
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedUser = safeLocalStorage.getItem('student_user');
      let initialKey = ANONYMOUS_CART_KEY;

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        const savedId = parsedUser?.id || parsedUser?._id;
        if (savedId) {
          initialKey = `mess_cart_${savedId}`;
        }
      }

      const savedCart = safeLocalStorage.getItem(initialKey);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }

      const anonCart = safeLocalStorage.getItem(ANONYMOUS_CART_KEY);
      if (anonCart) {
        const parsedAnon = JSON.parse(anonCart);
        if (Array.isArray(parsedAnon)) return parsedAnon;
      }

      return [];
    } catch (err) {
      console.warn('Error reading initial cart from localStorage:', err);
      return [];
    }
  });

  // Fetch dynamic meal types & windows from single source of truth API
  const fetchMealWindows = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoadingWindows(true);
    try {
      const res = await api.get('/menu/windows');
      if (res.data.success && Array.isArray(res.data.windows)) {
        setMealWindows(res.data.windows);
      }
    } catch (err) {
      console.warn('Could not fetch meal windows, using defaults:', err);
    } finally {
      if (!isSilent) setLoadingWindows(false);
    }
  }, []);

  useEffect(() => {
    fetchMealWindows();

    // Auto-refresh meal window timings & open status every 60 seconds or on window focus
    const interval = setInterval(() => {
      fetchMealWindows(true);
    }, 60000);

    const handleFocus = () => fetchMealWindows(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchMealWindows]);

  // Fetch server-side discount status for selected meal category strictly from database
  const fetchDiscountStatus = useCallback(async (mealType) => {
    try {
      const targetType = (mealType || selectedMealType || 'lunch').toLowerCase();
      const res = await api.get(`/orders/discount-status?meal_type=${targetType}`);
      if (res.data && res.data.success) {
        const isDiscountActive = Boolean(res.data.is_discount_active) && Number(res.data.discount_percentage) > 0;
        setDiscountInfo({
          is_discount_active: isDiscountActive,
          discount_percentage: isDiscountActive ? Number(res.data.discount_percentage) : 0,
          discount_type: isDiscountActive ? (res.data.discount_type || 'none') : 'none',
          is_new_user: Boolean(res.data.is_new_user),
          new_user_discount_days: parseInt(res.data.new_user_discount_days, 10) || 0,
          new_user_discount_percentage: Number(res.data.new_user_discount_percentage) || 0,
          server_time: res.data.server_time || '',
          cutoffs: res.data.cutoffs || {},
          settings: res.data.settings || null,
        });
        return;
      }
    } catch (err) {
      console.warn('Could not fetch live discount status:', err);
    }
    // If fetching fails or no rule active: strictly 0% discount with zero hardcoded fallbacks
    setDiscountInfo({
      is_discount_active: false,
      discount_percentage: 0,
      discount_type: 'none',
      is_new_user: false,
      new_user_discount_days: 0,
      new_user_discount_percentage: 0,
      server_time: '',
      cutoffs: {},
      settings: null,
    });
  }, [selectedMealType]);

  useEffect(() => {
    fetchDiscountStatus(selectedMealType);
    const timer = setInterval(() => {
      fetchDiscountStatus(selectedMealType);
    }, 30000);

    // Real-time socket listener: update discounts immediately whenever admin modifies discount rules
    let socket;
    try {
      socket = createSocketClient();
      socket.on('discount_settings:updated', () => {
        console.log('[CartContext] Real-time discount settings updated, refreshing discount status...');
        fetchDiscountStatus(selectedMealType);
      });
    } catch (sockErr) {
      console.warn('[CartContext] Socket initialization notice:', sockErr);
    }

    return () => {
      clearInterval(timer);
      if (socket) {
        socket.off('discount_settings:updated');
        socket.disconnect();
      }
    };
  }, [selectedMealType, fetchDiscountStatus, student]);

  const setSelectedMealType = (type) => {
    const target = (type || 'breakfast').toLowerCase();
    try {
      sessionStorage.setItem('selected_meal_type', target);
    } catch (e) {}
    setSelectedMealTypeState(target);
  };

  // Handle Login / Logout Cart State Transition
  useEffect(() => {
    if (isAuthenticated && studentId) {
      try {
        const studentCartKey = `mess_cart_${studentId}`;
        const studentSaved = safeLocalStorage.getItem(studentCartKey);
        const anonSaved = safeLocalStorage.getItem(ANONYMOUS_CART_KEY);

        let parsedAnon = [];
        let parsedStudent = [];

        try {
          if (anonSaved) parsedAnon = JSON.parse(anonSaved);
        } catch (e) {
          parsedAnon = [];
        }

        try {
          if (studentSaved) parsedStudent = JSON.parse(studentSaved);
        } catch (e) {
          parsedStudent = [];
        }

        // Priority 1: Current tray in React state or anonymous cart from guest session
        const currentTray = (cartItems && cartItems.length > 0)
          ? cartItems
          : (Array.isArray(parsedAnon) && parsedAnon.length > 0)
          ? parsedAnon
          : null;

        if (currentTray && currentTray.length > 0) {
          // User added items before login: Preserve these exact items without duplicating quantity
          setCartItems(currentTray);
          safeLocalStorage.setItem(studentCartKey, JSON.stringify(currentTray));
          safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
        } else if (Array.isArray(parsedStudent) && parsedStudent.length > 0) {
          // User logged in with empty tray: Restore their previously saved student cart
          setCartItems(parsedStudent);
        } else {
          setCartItems([]);
        }

        safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
      } catch (err) {
        console.warn('Error handling cart on login:', err);
      }
    } else if (!isAuthenticated) {
      // On logout: Reset active tray
      safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
    }
  }, [isAuthenticated, studentId]);

  // Sync cart items to localStorage on every state update
  useEffect(() => {
    if (cartItems && cartItems.length > 0) {
      safeLocalStorage.setItem(cartKey, JSON.stringify(cartItems));
    } else {
      safeLocalStorage.removeItem(cartKey);
      safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
    }
  }, [cartItems, cartKey]);

  const [stockAlert, setStockAlert] = useState(null);

  const triggerStockAlert = (message) => {
    setStockAlert(message);
    setTimeout(() => {
      setStockAlert(null);
    }, 4500);
  };

  const triggerCartPulse = () => {
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 400);
  };

  const addToCart = (item, quantity = 1, selectedVariant = null) => {
    if (!isAuthenticated) {
      if (openAuthModal) {
        openAuthModal(false, 'login');
      }
      return false;
    }

    const targetId = item._id || item.id || item.menu_item;
    const cartItemId = selectedVariant
      ? `${targetId}_${selectedVariant.id || selectedVariant.name}`
      : targetId;
    const existing = cartItems.find((i) => i.id === cartItemId || i.cart_item_id === cartItemId);
    const currentQty = existing ? Number(existing.quantity) : 0;
    const requestedQty = currentQty + Number(quantity);

    // Stock verification if tracking is enabled
    if (item.track_stock && item.available_quantity !== undefined) {
      const avail = Number(item.available_quantity);
      if (avail <= 0 || item.is_available === false) {
        triggerStockAlert(`Sorry, "${item.name}" is currently out of stock.`);
        return false;
      }
      if (requestedQty > avail) {
        triggerStockAlert(`Only ${avail} portion${avail === 1 ? '' : 's'} of "${item.name}" are available right now!`);
        return false;
      }
    }

    const itemPrice = selectedVariant ? Number(selectedVariant.price) : Number(item.price);
    const itemName = selectedVariant ? `${item.name} (${selectedVariant.name})` : item.name;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === cartItemId || i.cart_item_id === cartItemId);

      let updated;
      if (existingIndex > -1) {
        updated = [...prev];
        updated[existingIndex].quantity += quantity;
      } else {
        updated = [
          ...prev,
          {
            id: cartItemId,
            cart_item_id: cartItemId,
            menu_item: targetId,
            menu_item_id: targetId,
            name: itemName,
            base_item_name: item.name,
            variant_id: selectedVariant?.id,
            variant_name: selectedVariant?.name,
            variant_quantity: selectedVariant?.quantity,
            price: itemPrice,
            quantity: Number(quantity),
            image_url: item.image_url,
            meal_type: item.meal_type || selectedMealType,
            available_quantity: item.available_quantity,
            track_stock: item.track_stock,
          },
        ];
      }

      safeLocalStorage.setItem(cartKey, JSON.stringify(updated));
      return updated;
    });

    triggerCartPulse();
    return true;
  };

  const removeFromCart = (itemId) => {
    setCartItems((prev) => {
      const updated = prev.filter((i) => i.id !== itemId && i.cart_item_id !== itemId);
      if (updated.length > 0) {
        safeLocalStorage.setItem(cartKey, JSON.stringify(updated));
      } else {
        safeLocalStorage.removeItem(cartKey);
        safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
      }
      return updated;
    });
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const existing = cartItems.find((i) => i.id === itemId || i.cart_item_id === itemId);
    if (existing && existing.track_stock && existing.available_quantity !== undefined) {
      const avail = Number(existing.available_quantity);
      if (Number(quantity) > avail) {
        triggerStockAlert(`Only ${avail} portion${avail === 1 ? '' : 's'} of "${existing.name}" are available right now!`);
        return;
      }
    }

    setCartItems((prev) => {
      const updated = prev.map((i) => (i.id === itemId || i.cart_item_id === itemId ? { ...i, quantity: Number(quantity) } : i));
      safeLocalStorage.setItem(cartKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Clear cart from state & localStorage ONLY on explicit removal or successful checkout
  const clearCart = () => {
    setCartItems([]);
    safeLocalStorage.removeItem(cartKey);
    safeLocalStorage.removeItem(ANONYMOUS_CART_KEY);
    if (studentId) {
      safeLocalStorage.removeItem(`mess_cart_${studentId}`);
    }
  };

  const cartCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

  // Dynamic notice visibility calculation against live clock (HH:mm)
  const effectiveCurrentTime = clientCurrentTime || discountInfo?.server_time;

  const enhancedMealWindows = mealWindows.map((w) => {
    const defaultServingTimes = { breakfast: '08:30', lunch: '12:30', snacks: '16:30', dinner: '19:30' };
    const mealTypeLower = (w.meal_type || '').toLowerCase();
    const servingStartTime = w.serving_start_time || defaultServingTimes[mealTypeLower] || w.start_time || '12:30';
    const isActive = w.is_active !== false;
    const isServingStarted = Boolean(servingStartTime && effectiveCurrentTime >= servingStartTime);
    const isUpcoming = Boolean(servingStartTime && effectiveCurrentTime < servingStartTime);
    // Note is visible whenever meal is active and serving_start_time is configured
    const isNoteVisible = Boolean(servingStartTime && isActive);

    return {
      ...w,
      serving_start_time: servingStartTime,
      is_note_visible: isNoteVisible,
      is_serving_started: isServingStarted,
      is_upcoming: isUpcoming,
    };
  });

  const activeMealWindows = enhancedMealWindows.filter((w) => w.is_active !== false);
  const currentMealWindow = enhancedMealWindows.find(
    (w) => (w.meal_type || '').toLowerCase() === selectedMealType.toLowerCase()
  );
  const allMealsInactive = mealWindows.length > 0 && activeMealWindows.length === 0;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        selectedMealType,
        setSelectedMealType,
        mealWindows: enhancedMealWindows,
        activeMealWindows,
        currentMealWindow,
        clientCurrentTime,
        loadingWindows,
        allMealsInactive,
        redirectNotice,
        setRedirectNotice,
        fetchMealWindows,
        isCartOpen,
        setIsCartOpen,
        isCartBouncing,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        triggerCartPulse,
        isParcel,
        setIsParcel,
        discountInfo,
        fetchDiscountStatus,
        stockAlert,
        triggerStockAlert,
      }}
    >
      {/* High-visibility temporary popup alert for low stock or out of stock items */}
      {stockAlert && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92%] px-5 py-3.5 bg-rose-600/95 backdrop-blur-md text-white font-bold text-xs sm:text-sm rounded-2xl shadow-2xl border border-rose-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-base">
            ⚠️
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold leading-snug">{stockAlert}</p>
          </div>
          <button
            type="button"
            onClick={() => setStockAlert(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer shrink-0 text-xs font-black"
          >
            ✕
          </button>
        </div>
      )}
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
