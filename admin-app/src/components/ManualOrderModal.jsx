import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  Search,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

export default function ManualOrderModal({ isOpen, onClose, onOrderCreated, printReceipt }) {
  // Data states
  const [mealWindows, setMealWindows] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [cart, setCart] = useState({}); // { [itemId]: { item, quantity } }
  const [paymentMethod, setPaymentMethod] = useState('counter_cash'); // 'counter_cash' | 'counter_upi' | 'other'
  const [orderType, setOrderType] = useState('dine_in'); // 'dine_in' | 'parcel'
  const [itemSearch, setItemSearch] = useState('');

  // Discount states
  const [discountStatus, setDiscountStatus] = useState({
    is_discount_active: false,
    discount_percentage: 0,
    discount_type: 'none',
    server_time: '',
  });
  const [linkedStudentId, setLinkedStudentId] = useState('');

  // Success state after creation
  const [createdOrder, setCreatedOrder] = useState(null);

  // 1. Fetch meal windows and initialize selected meal type
  useEffect(() => {
    if (!isOpen) return;

    // Reset states
    setCustomerName('');
    setLinkedStudentId('');
    setCart({});
    setPaymentMethod('counter_cash');
    setOrderType('dine_in');
    setErrorMessage('');
    setCreatedOrder(null);
    setItemSearch('');

    fetchWindows();
  }, [isOpen]);

  const fetchWindows = async () => {
    try {
      const res = await api.get('/menu/windows');
      if (res.data.success && Array.isArray(res.data.windows)) {
        setMealWindows(res.data.windows);
        // Default to first open meal window, or fallback to 'lunch'
        const openWindow = res.data.windows.find((w) => w.is_active && w.is_currently_open);
        if (openWindow) {
          setSelectedMeal(openWindow.meal_type.toLowerCase());
        }
      }
    } catch (err) {
      console.warn('Failed to load meal windows:', err);
    }
  };

  // 2. Fetch menu items and check discount status whenever selectedMeal changes
  useEffect(() => {
    if (!isOpen || !selectedMeal) return;

    fetchMealItems(selectedMeal);
    checkDiscountStatus(selectedMeal);
  }, [isOpen, selectedMeal]);

  const fetchMealItems = async (mealType) => {
    setLoadingMenu(true);
    try {
      const res = await api.get(`/menu/items?meal_type=${mealType}`);
      if (res.data.success) {
        setMenuItems(res.data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch menu items:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  const checkDiscountStatus = async (mealType, studentId = linkedStudentId) => {
    try {
      const studentQuery = studentId ? `&student_id=${studentId}` : '';
      const res = await api.get(`/orders/discount-status?meal_type=${mealType}${studentQuery}`);
      if (res.data.success) {
        const isActive = Boolean(res.data.is_discount_active) && Number(res.data.discount_percentage) > 0;
        setDiscountStatus({
          is_discount_active: isActive,
          discount_percentage: isActive ? Number(res.data.discount_percentage) : 0,
          discount_type: isActive ? (res.data.discount_type || 'none') : 'none',
          server_time: res.data.server_time || '',
        });
      }
    } catch (err) {
      // If live discount query fails, strictly default to 0% discount with zero static fallbacks
      setDiscountStatus({
        is_discount_active: false,
        discount_percentage: 0,
        discount_type: 'none',
        server_time: '',
      });
    }
  };

  // Cart operations
  const handleQuantityChange = (item, delta) => {
    const itemKey = item.cart_key || item.id;
    setCart((prev) => {
      const currentQty = prev[itemKey]?.quantity || 0;
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        const nextCart = { ...prev };
        delete nextCart[itemKey];
        return nextCart;
      }
      return {
        ...prev,
        [itemKey]: {
          item: {
            ...item,
            id: itemKey,
          },
          quantity: nextQty,
        },
      };
    });
  };

  const cartList = Object.values(cart);
  const subtotal = cartList.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);
  const discountAmount = discountStatus.is_discount_active
    ? Math.round((subtotal * (discountStatus.discount_percentage / 100)) * 100) / 100
    : 0;
  const totalPayable = Math.max(0, subtotal - discountAmount);

  // Submit manual order
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Please enter the customer name.');
      return;
    }

    if (cartList.length === 0) {
      setErrorMessage('Please add at least one menu item to the order.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        meal_type: selectedMeal,
        items: cartList.map((entry) => ({
          menu_item_id: entry.item.menu_item_id || entry.item.id,
          name: entry.item.name,
          variant_name: entry.item.variant_name || undefined,
          variant_id: entry.item.variant_id || undefined,
          quantity: entry.quantity,
          price: entry.item.price,
        })),
        payment_method: paymentMethod,
        order_type: orderType,
        is_parcel: orderType === 'parcel',
        student_id: linkedStudentId ? parseInt(linkedStudentId, 10) : undefined,
      };

      const res = await api.post('/orders/manual', payload);

      if (res.data.success) {
        const newOrder = res.data.order;
        setCreatedOrder(newOrder);

        if (onOrderCreated) {
          onOrderCreated(newOrder);
        }
      } else {
        setErrorMessage(res.data.message || 'Failed to create manual order.');
      }
    } catch (err) {
      console.error('Manual order creation error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Error creating manual order.';
      setErrorMessage(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Filtered menu items for search
  const filteredMenuItems = menuItems.filter((it) => {
    if (!itemSearch.trim()) return true;
    return it.name.toLowerCase().includes(itemSearch.toLowerCase().trim());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-5 sm:p-7 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold">
              📝
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {createdOrder ? 'Manual Order Confirmed!' : 'New Manual Walk-in Order'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {createdOrder
                  ? 'Token generated & added to active kitchen queue'
                  : 'Create order on behalf of walk-in customer paying at counter'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* VIEW 1: SUCCESS CONFIRMATION & PRINT SLIP */}
        {createdOrder ? (
          <div className="flex-1 overflow-y-auto py-5 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Order Placed Successfully</h3>
              <p className="text-xs text-slate-500 font-medium">
                Customer: <strong className="text-slate-800">{createdOrder.customer_name || createdOrder.student_name}</strong>
              </p>
            </div>

            {/* Token & QR Card */}
            <div className="max-w-sm mx-auto p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Daily Token Number
              </span>

              <div className="text-5xl font-black text-brand-orange tracking-wider">
                {createdOrder.token_number}
              </div>

              {/* Scannable QR Code */}
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-amber-200 inline-block">
                <QRCodeSVG
                  value={JSON.stringify({
                    order_id: createdOrder._id || createdOrder.id,
                    token_number: createdOrder.token_number,
                    meal_type: createdOrder.meal_type,
                    customer_name: createdOrder.customer_name || createdOrder.student_name,
                    payment_status: 'paid',
                    date: createdOrder.date,
                  })}
                  size={140}
                  level="M"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-lg bg-slate-900 text-white uppercase tracking-wider">
                  {createdOrder.meal_type}
                </span>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Paid ({createdOrder.payment_method?.toUpperCase()})
                </span>
              </div>
            </div>

            {/* Summary Breakdown */}
            <div className="max-w-sm mx-auto bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
              <div className="font-bold text-slate-700 pb-1.5 border-b border-slate-200 flex justify-between">
                <span>Items Ordered:</span>
                <span>Qty × Price</span>
              </div>
              <div className="space-y-1">
                {(createdOrder.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600 font-medium">
                    <span>{it.quantity}x {it.item_name}</span>
                    <span className="font-semibold text-slate-800">₹{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>

              {createdOrder.discount_amount > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Subtotal</span>
                    <span>₹{createdOrder.subtotal_amount}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>{createdOrder.discount_type === 'new_user' ? 'Welcome Discount' : 'Early Order Discount'} ({createdOrder.discount_percentage}%)</span>
                    <span>-₹{createdOrder.discount_amount}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900 text-sm">
                <span>Total Collected</span>
                <span className="text-brand-orange">₹{createdOrder.total_amount}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="max-w-sm mx-auto flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  if (printReceipt) printReceipt(createdOrder);
                }}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Token Slip</span>
              </button>

              <button
                onClick={() => {
                  setCreatedOrder(null);
                  setCart({});
                  setCustomerName('');
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl border border-slate-200 transition-all cursor-pointer"
              >
                + Another Order
              </button>

              <button
                onClick={onClose}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: ORDER CREATION FORM */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
            
            {/* Customer Name & Optional Student Link */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Walk-in Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g., Ramesh Kumar / Guest Faculty"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Link Student ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g., 42"
                  value={linkedStudentId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLinkedStudentId(val);
                    checkDiscountStatus(selectedMeal, val);
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Meal Type Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Meal Category <span className="text-rose-500">*</span>
                </label>
                {discountStatus.is_discount_active && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full animate-pulse">
                    <Sparkles className="w-3 h-3" /> {discountStatus.discount_percentage}% {discountStatus.discount_type === 'new_user' ? 'Welcome Discount' : 'Early Discount'} Active!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['breakfast', 'lunch', 'snacks', 'dinner'].map((type) => {
                  const windowInfo = mealWindows.find((w) => w.meal_type?.toLowerCase() === type);
                  const isCurrentlyOpen = windowInfo ? windowInfo.is_currently_open : true;
                  const isSelected = selectedMeal === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setSelectedMeal(type);
                        setCart({});
                      }}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold uppercase tracking-wide border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="capitalize">{type}</span>
                      <span
                        className={`text-[9px] font-semibold px-2 py-0.2 rounded-md ${
                          isCurrentlyOpen
                            ? isSelected
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isCurrentlyOpen ? 'Open' : 'Closed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menu Item Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Select Items from Active Menu ({menuItems.length})
                </label>
                {/* Search in Menu */}
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter item..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              {loadingMenu ? (
                <div className="p-8 text-center text-xs text-slate-400 font-semibold animate-pulse">
                  Loading menu items for {selectedMeal}...
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No active items available for this meal category.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                  {filteredMenuItems.map((item) => {
                    const isOutOfStock = item.is_in_stock === false;
                    const hasItemVariants = Boolean(
                      item.has_variants && Array.isArray(item.variants) && item.variants.length > 0
                    );

                    if (hasItemVariants) {
                      return (
                        <div
                          key={item.id}
                          className="pt-2 p-2.5 rounded-2xl bg-amber-50/40 border border-amber-200/70 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span>🫓</span>
                                <span>{item.name}</span>
                              </h4>
                              <p className="text-[10px] text-amber-800 font-semibold">Select Chapati Quantity:</p>
                            </div>
                            {isOutOfStock && (
                              <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                                Low Stock
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.variants.map((v) => {
                              const variantCartKey = `${item.id}_${v.id || v.name}`;
                              const vQty = cart[variantCartKey]?.quantity || 0;
                              const variantItem = {
                                ...item,
                                id: variantCartKey,
                                cart_key: variantCartKey,
                                menu_item_id: item.id,
                                name: `${item.name} (${v.name})`,
                                variant_name: v.name,
                                variant_id: v.id,
                                price: Number(v.price),
                              };

                              return (
                                <div
                                  key={v.id || v.name}
                                  className={`flex items-center justify-between gap-2 p-2 rounded-xl bg-white border transition-colors ${
                                    vQty > 0 ? 'border-orange-400 bg-orange-50/40 shadow-2xs' : 'border-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <span className="block text-[11px] font-black text-slate-900 truncate">
                                      {v.name}
                                    </span>
                                    <span className="text-xs font-black text-emerald-700">₹{v.price}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                                    <button
                                      type="button"
                                      disabled={vQty === 0}
                                      onClick={() => handleQuantityChange(variantItem, -1)}
                                      className="p-1 text-slate-500 hover:text-orange-600 disabled:opacity-30 cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-xs font-black text-slate-900 w-3.5 text-center">
                                      {vQty}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={isOutOfStock}
                                      onClick={() => handleQuantityChange(variantItem, 1)}
                                      className="p-1 text-slate-500 hover:text-orange-600 disabled:opacity-30 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    const selectedQty = cart[item.id]?.quantity || 0;

                    return (
                      <div
                        key={item.id}
                        className={`pt-2 flex items-center justify-between gap-3 p-2 rounded-2xl transition-colors ${
                          selectedQty > 0 ? 'bg-orange-50/60 border border-orange-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-extrabold text-slate-900 truncate">{item.name}</h4>
                          <span className="text-xs font-bold text-brand-orange">₹{item.price}</span>
                          {isOutOfStock && (
                            <span className="ml-2 text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                              Low Stock
                            </span>
                          )}
                        </div>

                        {/* Counter */}
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-slate-200 shrink-0">
                          <button
                            type="button"
                            disabled={selectedQty === 0}
                            onClick={() => handleQuantityChange(item, -1)}
                            className="p-1 text-slate-500 hover:text-orange-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-extrabold text-slate-900 w-4 text-center">
                            {selectedQty}
                          </span>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleQuantityChange(item, 1)}
                            className="p-1 text-slate-500 hover:text-orange-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dining Option (Dine In vs Parcel) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Dining Option <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'dine_in', label: 'Dine In', icon: '🍽️', desc: 'Eat at mess' },
                  { id: 'parcel', label: 'Parcel / Takeaway', icon: '📦', desc: 'Pack for takeaway' },
                ].map(({ id, label, icon, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOrderType(id)}
                    className={`py-2 px-3 rounded-2xl text-xs font-extrabold border transition-all flex items-center gap-2 cursor-pointer ${
                      orderType === id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="text-lg">{icon}</span>
                    <div className="text-left">
                      <span className="block leading-tight">{label}</span>
                      <span className={`text-[9px] font-semibold block ${orderType === id ? 'text-slate-300' : 'text-slate-400'}`}>
                        {desc}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Radio Selection */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Payment Method Collected <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'counter_cash', label: 'Counter Cash', icon: Banknote },
                  { id: 'counter_upi', label: 'Counter UPI', icon: Smartphone },
                  { id: 'other', label: 'Other', icon: CreditCard },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMethod === id || (id === 'counter_cash' && paymentMethod === 'cash') || (id === 'counter_upi' && paymentMethod === 'upi')
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Pricing Breakdown */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Subtotal ({cartList.reduce((acc, it) => acc + it.quantity, 0)} items)</span>
                <span className="font-semibold text-slate-800">₹{subtotal}</span>
              </div>

              {discountStatus.is_discount_active && (
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {discountStatus.discount_type === 'new_user' ? 'Welcome Discount' : 'Early Order Discount'} ({discountStatus.discount_percentage}%)
                  </span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                <span>Total Amount to Collect:</span>
                <span className="text-brand-orange text-lg">₹{totalPayable}</span>
              </div>
            </div>

            {/* Modal Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || cartList.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {submitting ? (
                  <span>Generating Token...</span>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Confirm & Generate Token (₹{totalPayable})</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
