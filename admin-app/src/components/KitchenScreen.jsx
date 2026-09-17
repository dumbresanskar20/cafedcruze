import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  Check,
  UtensilsCrossed,
  Search,
  Printer,
  Grid,
  List,
  Plus,
  Timer,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useOrderAlerts } from '../context/OrderAlertContext';
import { createAdminSocketClient } from '../services/socket';
import SubscriptionWidget from './SubscriptionWidget';
import SubscriptionModal from './SubscriptionModal';
import ManualOrderModal from './ManualOrderModal';
import AlertControls from './AlertControls';

export default function KitchenScreen({ isStaffFullscreen = false }) {
  const { triggerOrderAlert } = useOrderAlerts();
  const {
    admin,
    token,
    isSuperAdmin,
    subscription,
    fetchSubscriptionStatus,
    setSubscription,
    setSubscriptionExpired,
  } = useAdminAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('all'); // 'all' | 'breakfast' | 'lunch' | 'snacks' | 'dinner'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [todayIncome, setTodayIncome] = useState(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [manualOrderModalOpen, setManualOrderModalOpen] = useState(false);

  const isStaff = isStaffFullscreen || admin?.role === 'staff';
  const isAdminOrSuperAdmin = !isStaff;

  const handleManualOrderCreated = (newOrder) => {
    // Add new order to top of list immediately
    setOrders((prev) => [newOrder, ...prev.filter((o) => (o._id || o.id) !== (newOrder._id || newOrder.id))]);
    // Trigger real-time sound chime and on-screen alert banner
    triggerOrderAlert(newOrder);
    // Refresh summary counts
    fetchKitchenData();
  };

  // Summary counts state
  const [orderCounts, setOrderCounts] = useState({
    breakfast: { total_orders_today: 0, active_tokens: 0 },
    lunch: { total_orders_today: 0, active_tokens: 0 },
    snacks: { total_orders_today: 0, active_tokens: 0 },
    dinner: { total_orders_today: 0, active_tokens: 0 },
    combined: { total_orders_today: 0, active_tokens: 0 },
    todays_menu_summary: [],
  });

  // Real-time Parcel Timers & Sockets
  const adminSocketRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const [parcelTimers, setParcelTimers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mess_parcel_timers') || '{}');
    } catch {
      return {};
    }
  });
  const [activeTimerDropdownId, setActiveTimerDropdownId] = useState(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [now, setNow] = useState(Date.now());

  // Fetch today's orders & summary counts
  const fetchKitchenData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      let ordersUrl = `/orders/kitchen-orders?date=${todayStr}`;
      if (selectedMeal && selectedMeal !== 'all' && selectedMeal !== 'parcel') {
        ordersUrl += `&meal_type=${selectedMeal}`;
      }
      if (selectedMeal === 'parcel') {
        ordersUrl += `&order_type=parcel`;
      }

      const [ordersRes, countsRes] = await Promise.all([
        api.get(ordersUrl),
        api.get(`/orders/kitchen-order-counts?date=${todayStr}`),
      ]);

      if (ordersRes.data.success) {
        setOrders(ordersRes.data.orders || []);
      }

      if (countsRes.data.success && countsRes.data.orderCounts) {
        setOrderCounts(countsRes.data.orderCounts);
      }

      if (isAdminOrSuperAdmin) {
        try {
          const incRes = await api.get('/orders/income/today');
          if (incRes.data.success) {
            setTodayIncome(incRes.data);
          }
        } catch (e) {
          console.warn('Income fetch error:', e);
        }
      }
    } catch (err) {
      console.error('Kitchen data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Clock ticker for real-time timer countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // BroadcastChannel for instant cross-tab real-time sync
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('mess_parcel_channel');
      broadcastChannelRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === 'TIMER_SET') {
          setParcelTimers((prev) => ({
            ...prev,
            [event.data.payload.orderId]: event.data.payload,
          }));
        } else if (event.data?.type === 'TIMER_CLEARED') {
          setParcelTimers((prev) => {
            const copy = { ...prev };
            delete copy[event.data.payload.orderId];
            return copy;
          });
        }
      };
      return () => channel.close();
    }
  }, []);

  // Clear parcel timer
  const clearParcelTimer = (orderId) => {
    const idStr = String(orderId);
    setParcelTimers((prev) => {
      const updated = { ...prev };
      delete updated[orderId];
      delete updated[idStr];
      delete updated[Number(orderId)];
      localStorage.setItem('mess_parcel_timers', JSON.stringify(updated));
      return updated;
    });

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'TIMER_CLEARED', payload: { orderId: idStr } });
    }
    if (adminSocketRef.current) {
      adminSocketRef.current.emit('order:timer_cleared', { orderId: idStr });
    }
  };

  // Handle Mark Ready status update for Parcel Orders
  const handleMarkReady = async (orderId) => {
    const idStr = String(orderId);
    clearParcelTimer(idStr);

    const previousOrders = [...orders];
    const previousCounts = { ...orderCounts };

    // 1. Optimistically update local state
    setOrders((prev) =>
      prev.map((o) =>
        String(o._id || o.id) === idStr ? { ...o, order_status: 'ready' } : o
      )
    );

    // 2. Broadcast across tabs and socket immediately
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'STATUS_UPDATED',
        payload: { orderId: idStr, order_status: 'ready' },
      });
    }
    if (adminSocketRef.current) {
      adminSocketRef.current.emit('order:status_updated', {
        orderId: idStr,
        order_status: 'ready',
      });
    }

    // 3. Persist status update to database
    try {
      const res = await api.patch(`/orders/status/${idStr}`, {
        order_status: 'ready',
      });

      if (res.data?.success && res.data?.orderCounts) {
        setOrderCounts(res.data.orderCounts);
      }
    } catch (err) {
      console.error('Failed to mark order as ready:', err);
      // Revert optimistic update only on error
      setOrders(previousOrders);
      setOrderCounts(previousCounts);
    }
  };

  // Handle Set Parcel Countdown Timer
  const handleSetParcelTimer = (ord, minutes) => {
    const orderId = String(ord._id || ord.id);
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins <= 0) return;
    const readyAt = Date.now() + mins * 60 * 1000;
    const timerData = {
      orderId,
      token_number: ord.token_number,
      studentId: ord.student_id?.id || ord.student_id?._id || ord.student_id,
      readyAt,
      minutes: mins,
    };

    setParcelTimers((prev) => {
      const updated = { ...prev, [orderId]: timerData };
      localStorage.setItem('mess_parcel_timers', JSON.stringify(updated));
      return updated;
    });

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'TIMER_SET', payload: timerData });
    }
    if (adminSocketRef.current) {
      adminSocketRef.current.emit('order:timer_set', timerData);
    }

    setActiveTimerDropdownId(null);
    setCustomMinutes('');
  };

  // Format remaining time MM:SS
  const formatTimeRemaining = (orderId) => {
    const timer = parcelTimers[orderId] || parcelTimers[String(orderId)];
    if (!timer || !timer.readyAt) return '';
    const diff = Math.max(0, Math.floor((timer.readyAt - now) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Handle Mark Delivered status update
  const handleMarkDelivered = async (orderId) => {
    const idStr = String(orderId);
    clearParcelTimer(idStr);

    const previousOrders = [...orders];
    const previousCounts = { ...orderCounts };

    setOrders((prev) =>
      prev.map((o) =>
        String(o._id || o.id) === idStr ? { ...o, order_status: 'delivered' } : o
      )
    );

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'STATUS_UPDATED',
        payload: { orderId: idStr, order_status: 'delivered' },
      });
    }
    if (adminSocketRef.current) {
      adminSocketRef.current.emit('order:status_updated', {
        orderId: idStr,
        order_status: 'delivered',
      });
    }

    try {
      const res = await api.patch(`/orders/status/${idStr}`, {
        order_status: 'delivered',
      });

      if (res.data?.success && res.data?.orderCounts) {
        setOrderCounts(res.data.orderCounts);
      }
    } catch (err) {
      console.error('Failed to mark order as delivered:', err);
      setOrders(previousOrders);
      setOrderCounts(previousCounts);
      alert('Failed to update status. Please check your network connection.');
    }
  };

  // Keep track of orders currently transitioning to ready to prevent duplicate API triggers
  const transitioningRef = useRef(new Set());

  // Auto-transition parcel orders to 'ready' when timer reaches zero
  useEffect(() => {
    Object.entries(parcelTimers).forEach(([orderId, timerInfo]) => {
      if (timerInfo && timerInfo.readyAt && timerInfo.readyAt <= now) {
        const idStr = String(orderId);
        if (transitioningRef.current.has(idStr)) return;
        transitioningRef.current.add(idStr);

        const ord = orders.find((o) => String(o._id || o.id) === idStr);
        if (ord && (ord.order_status === 'delivered' || ord.order_status === 'cancelled')) {
          clearParcelTimer(idStr);
          transitioningRef.current.delete(idStr);
          return;
        }

        handleMarkReady(idStr).finally(() => {
          transitioningRef.current.delete(idStr);
        });
      }
    });
  }, [now, parcelTimers, orders]);

  // Socket.IO Real-time setup + 15s polling fallback
  useEffect(() => {
    fetchKitchenData();

    const socket = createAdminSocketClient(token);
    adminSocketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:kitchen');
    });
    socket.emit('join:kitchen');

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Real-time new order listener
    socket.on('order:new', (newOrder) => {
      if (newOrder) {
        setOrders((prev) => {
          const exists = prev.some((o) => (o._id || o.id) === (newOrder._id || newOrder.id));
          if (exists) return prev;
          return [newOrder, ...prev];
        });
        // Trigger synchronized sound and on-screen alert banner
        triggerOrderAlert(newOrder);
        if (isAdminOrSuperAdmin) {
          api.get('/orders/income/today')
            .then((res) => { if (res.data?.success) setTodayIncome(res.data); })
            .catch(() => {});
        }
      }
    });

    // Real-time income update listener
    socket.on('income:updated', () => {
      if (isAdminOrSuperAdmin) {
        api.get('/orders/income/today')
          .then((res) => { if (res.data?.success) setTodayIncome(res.data); })
          .catch(() => {});
      }
    });

    // Real-time status update listener
    socket.on('order:status_updated', (updatedData) => {
      setOrders((prev) =>
        prev.map((o) =>
          (o._id || o.id) === (updatedData.orderId || updatedData.id)
            ? { ...o, order_status: updatedData.order_status }
            : o
        )
      );
    });

    // Real-time parcel timer updates from other sessions
    socket.on('parcel:timer_updated', (timerData) => {
      if (timerData && timerData.orderId) {
        setParcelTimers((prev) => {
          const updated = { ...prev, [timerData.orderId]: timerData };
          localStorage.setItem('mess_parcel_timers', JSON.stringify(updated));
          return updated;
        });
      }
    });

    socket.on('parcel:timer_cleared', (timerData) => {
      if (timerData && timerData.orderId) {
        setParcelTimers((prev) => {
          const updated = { ...prev };
          delete updated[timerData.orderId];
          localStorage.setItem('mess_parcel_timers', JSON.stringify(updated));
          return updated;
        });
      }
    });

    // Real-time aggregate count listener
    socket.on('order-counts-updated', (data) => {
      if (data && data.orderCounts) {
        setOrderCounts(data.orderCounts);
      }
    });

    // Polling fallback every 15s
    const pollInterval = setInterval(() => {
      fetchKitchenData();
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      adminSocketRef.current = null;
      socket.disconnect();
    };
  }, [token, selectedMeal]);

  // Print Token Invoice / Thermal Receipt with Discount & QR Code
  const printReceipt = (order) => {
    const customerOrStudentName = order.customer_name || order.student_id?.name || order.student_name || 'Customer';
    const rollNo = order.student_id?.roll_no || order.student?.roll_no || '';
    const isWalkIn = Boolean(order.customer_name);
    const mealType = (order.meal_type || '').toUpperCase();
    const tokenNumber = order.token_number || 'T-00';
    const dateStr = new Date(order.created_at || Date.now()).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const qrPayload = JSON.stringify({
      order_id: order._id || order.id || '',
      token_number: tokenNumber,
      meal_type: order.meal_type || '',
      customer_name: customerOrStudentName,
      payment_status: order.payment_status || 'paid',
      date: order.date || '',
    });

    const itemsHtml = (order.items || [])
      .map(
        (it) => `
      <tr style="border-bottom: 1px dashed #ccc;">
        <td style="padding: 6px 0; font-family: monospace; font-size: 13px;">${it.item_name || it.name}</td>
        <td style="padding: 6px 0; text-align: center; font-family: monospace; font-size: 13px;">${it.quantity}</td>
        <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 13px;">₹${Number(it.price || 0) * it.quantity}</td>
      </tr>
    `
      )
      .join('');

    const hasDiscount = Number(order.discount_amount || 0) > 0;
    const subtotal = Number(order.subtotal_amount || order.total_amount || 0);
    const discountAmount = Number(order.discount_amount || 0);
    const discountPercentage = Number(order.discount_percentage || 0);
    const paymentMethodDisplay = (order.payment_method || 'Cash').toUpperCase();

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) {
      alert('Pop-up blocker is preventing print view! Please allow popups for this site.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Receipt - ${tokenNumber}</title>
          <style>
            @media print {
              body { margin: 0; padding: 10px; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              padding: 15px;
              color: #000;
              width: 280px;
              margin: 0 auto;
              background: #fff;
            }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
            .title { font-size: 16px; font-weight: bold; margin: 2px 0; letter-spacing: 1px; }
            .subtitle { font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }
            .token-box {
              font-size: 32px;
              font-weight: 900;
              margin: 6px 0;
              border: 2px solid #000;
              display: inline-block;
              padding: 4px 16px;
              letter-spacing: 2px;
            }
            .details { font-size: 11px; margin-bottom: 8px; line-height: 1.4; border-bottom: 1px dashed #000; padding-bottom: 6px; }
            .table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
            .qr-container { text-align: center; margin: 10px 0; padding: 6px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
            .footer { text-align: center; border-top: 2px dashed #000; padding-top: 8px; margin-top: 10px; font-size: 10px; line-height: 1.3; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">CAFE D CRUZE RESTAURANT</div>
            <div class="subtitle">Order Token & Invoice</div>
            <div class="token-box">${tokenNumber}</div>
          </div>
          <div class="details">
            <div><strong>Date:</strong> ${dateStr}</div>
            <div><strong>${isWalkIn ? 'Customer' : 'Student'}:</strong> ${customerOrStudentName} ${rollNo ? `(${rollNo})` : ''}</div>
            <div><strong>Meal Window:</strong> ${mealType}</div>
            <div><strong>Dining:</strong> ${(order.is_parcel || order.order_type === 'parcel') ? '📦 PARCEL (TAKEAWAY)' : '🍽️ DINE IN'}</div>
            <div><strong>Payment:</strong> ${paymentMethodDisplay} (PAID)</div>
          </div>
          <table class="table">
            <thead>
              <tr style="border-bottom: 1px solid #000; font-size: 11px;">
                <th style="text-align: left; padding: 4px 0;">Item</th>
                <th style="text-align: center; padding: 4px 0;">Qty</th>
                <th style="text-align: right; padding: 4px 0;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              ${
                hasDiscount
                  ? `
                <tr style="border-top: 1px dashed #000; font-size: 11px;">
                  <td style="padding: 4px 0;" colspan="2">Subtotal</td>
                  <td style="padding: 4px 0; text-align: right;">₹${subtotal}</td>
                </tr>
                <tr style="font-size: 11px; color: #000;">
                  <td style="padding: 4px 0;" colspan="2">Early Discount (${discountPercentage}%)</td>
                  <td style="padding: 4px 0; text-align: right;">-₹${discountAmount}</td>
                </tr>
              `
                  : ''
              }
              <tr style="border-top: 1px solid #000; font-weight: bold; font-size: 13px;">
                <td style="padding: 6px 0;" colspan="2">TOTAL PAID</td>
                <td style="padding: 6px 0; text-align: right;">₹${Number(order.total_amount || 0)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Scannable Order QR Code -->
          <div class="qr-container">
            <div style="font-size: 9px; text-transform: uppercase; margin-bottom: 4px; font-weight: bold;">Counter Pickup QR</div>
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=115x115&margin=0&data=${encodeURIComponent(qrPayload)}" 
              alt="Order QR Code" 
              style="width: 115px; height: 115px; display: inline-block;"
            />
          </div>

          <div class="footer">
            Thank you for dining with us!<br/>
            Please present this token slip or QR at the counter.
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter active tokens (exclude delivered / cancelled / expired)
  const activeTokenList = orders.filter(
    (ord) => ord.order_status !== 'delivered' && ord.order_status !== 'cancelled' && ord.order_status !== 'expired'
  );

  const filteredTokenList = activeTokenList
    .filter((ord) => {
      const studentName = (ord.customer_name || ord.student_id?.name || ord.student_name || '').toLowerCase();
      const tokenNum = (ord.token_number || '').toLowerCase();
      const cleanQuery = searchQuery.toLowerCase().trim();
      const matchesSearch = studentName.includes(cleanQuery) || tokenNum.includes(cleanQuery);
      if (!matchesSearch) return false;

      // Meal Filter Tab
      if (selectedMeal && selectedMeal !== 'all') {
        if ((ord.meal_type || '').toLowerCase() !== selectedMeal.toLowerCase()) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const parcelCount = activeTokenList.filter((o) => Boolean(o.is_parcel) || o.order_type === 'parcel').length;
  const dineInCount = activeTokenList.length - parcelCount;

  // Derive menu ordered summary with remaining units to deliver in real-time
  const menuSummaryWithPending = useMemo(() => {
    const map = {};

    // 1. Calculate from orders state (instant real-time updates on status changes and new orders)
    (orders || []).forEach((ord) => {
      if (ord.order_status === 'cancelled' || ord.order_status === 'expired') return;

      const isDelivered = ord.order_status === 'delivered';
      (ord.items || []).forEach((it) => {
        const name = it.item_name || it.name;
        if (!name) return;
        const qty = Number(it.quantity) || 1;
        if (!map[name]) {
          map[name] = { item_name: name, total_quantity: 0, pending_quantity: 0, delivered_quantity: 0 };
        }
        map[name].total_quantity += qty;
        if (isDelivered) {
          map[name].delivered_quantity += qty;
        } else {
          map[name].pending_quantity += qty;
        }
      });
    });

    // 2. Incorporate / merge with orderCounts.todays_menu_summary if available
    (orderCounts.todays_menu_summary || []).forEach((it) => {
      if (!map[it.item_name]) {
        map[it.item_name] = {
          item_name: it.item_name,
          total_quantity: it.total_quantity || 0,
          pending_quantity: it.pending_quantity != null ? it.pending_quantity : (it.total_quantity || 0),
          delivered_quantity: it.delivered_quantity || 0,
        };
      } else {
        if (it.total_quantity > map[it.item_name].total_quantity) {
          map[it.item_name].total_quantity = it.total_quantity;
          if (it.pending_quantity != null) {
            map[it.item_name].pending_quantity = it.pending_quantity;
            map[it.item_name].delivered_quantity = it.delivered_quantity || 0;
          }
        }
      }
    });

    return Object.values(map).sort((a, b) => b.pending_quantity - a.pending_quantity || b.total_quantity - a.total_quantity);
  }, [orders, orderCounts.todays_menu_summary]);

  const totalPendingUnits = useMemo(() => {
    return menuSummaryWithPending.reduce((sum, it) => sum + (it.pending_quantity || 0), 0);
  }, [menuSummaryWithPending]);

  const MEAL_TYPES = [
    { id: 'all', label: 'All Meals' },
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'snacks', label: 'Snacks' },
    { id: 'dinner', label: 'Dinner' },
  ];

  return (
    <div className={`p-4 sm:p-6 space-y-6 ${isStaff ? 'w-full max-w-full' : 'max-w-screen-2xl mx-auto'}`}>
      
      {/* TOP BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center text-xl">
              {isStaff ? '👨‍🍳' : '🔥'}
            </span>
            <span>{isStaff ? 'Kitchen Operations Screen' : 'Order Fulfillment Screen'}</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {isStaff ? "Live Active Token Queue & Today's Order Summary • " : "Live Active Token Queue & Daily Order Analytics • "}
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Actions, Status Indicators & Refresh */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap">
          {/* New Manual Order CTA (Visible to Admin, Super Admin & Staff) */}
          <button
            onClick={() => setManualOrderModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-black shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
            title="Create Manual Walk-in Order"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Manual Order</span>
          </button>

          <button
            onClick={fetchKitchenData}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Sound & Notification Alert Controls */}
          <AlertControls isDarkHeader={false} />

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold border ${
              connected
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
            }`}
          >
            {connected ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-600" />
            )}
            <span>{connected ? 'Live Socket Connected' : 'Reconnecting...'}</span>
          </div>
        </div>
      </div>

      {/* 1. SYSTEM SUBSCRIPTION STATUS WIDGET (ADMIN & SUPER ADMIN) */}
      {isAdminOrSuperAdmin && (
        <SubscriptionWidget
          subscription={subscription}
          onOpenRenewModal={() => setRenewModalOpen(true)}
          onRefresh={fetchSubscriptionStatus}
        />
      )}

      {/* 2. TODAY'S REVENUE / DAILY INCOME SUMMARY WIDGET (ADMIN & SUPER ADMIN) */}
      {isAdminOrSuperAdmin && todayIncome && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              Super Admin Analytics • Today's Revenue
            </span>
            <span className="text-2xl font-black text-white">
              ₹{(todayIncome.total_income || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Razorpay (Online)</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.razorpay?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.razorpay?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Counter Cash</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.counter_cash?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.counter_cash?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Counter UPI</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.counter_upi?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.counter_upi?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Other</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.other?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.other?.count || 0} orders)</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. TODAY'S ORDER SUMMARY */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 px-1">
            TODAY'S ORDER SUMMARY
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            
            {/* Combined Total Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">
                COMBINED ALL MEALS
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                    {orderCounts.combined?.total_orders_today || 0}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-400 mt-1">Total Orders Today</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-brand-orange leading-none">
                    {orderCounts.combined?.active_tokens || 0}
                  </span>
                  <span className="block text-[10px] font-bold text-brand-orange uppercase mt-1">ACTIVE TOKENS</span>
                </div>
              </div>
            </div>

            {/* Meal Specific Cards */}
            {['breakfast', 'lunch', 'snacks', 'dinner'].map((meal) => {
              const data = orderCounts[meal] || { total_orders_today: 0, active_tokens: 0 };
              const label = meal.toUpperCase();

              return (
                <div
                  key={meal}
                  className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">
                    {label}
                  </span>
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                        {data.total_orders_today}
                      </span>
                      <span className="block text-[9px] font-semibold text-slate-400 mt-0.5">Total Orders</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl sm:text-2xl font-black text-brand-orange leading-none">
                        {data.active_tokens}
                      </span>
                      <span className="block text-[9px] font-bold text-brand-orange uppercase mt-0.5">ACTIVE</span>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* 4. TODAY'S MENU ORDERED ("WHAT'S COOKING TODAY") */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-brand-orange" />
                <span>Today's Menu Ordered ("What's Cooking Today")</span>
              </h3>
              {totalPendingUnits > 0 ? (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs">
                  ⚡ {totalPendingUnits} to deliver
                </span>
              ) : menuSummaryWithPending.length > 0 ? (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] px-2.5 py-0.5 rounded-full">
                  ✓ All Delivered
                </span>
              ) : null}
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              {menuSummaryWithPending.length} UNIQUE ITEMS
            </span>
          </div>

          {menuSummaryWithPending.length === 0 ? (
            <div className="text-xs text-slate-400 font-medium py-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No menu items ordered yet today.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {menuSummaryWithPending.map((item, idx) => {
                const hasPending = item.pending_quantity > 0;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2.5 shadow-2xs ${
                      hasPending
                        ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/60 border-amber-300 shadow-xs'
                        : 'bg-stone-50/80 border-stone-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-extrabold text-slate-900 line-clamp-1" title={item.item_name}>
                        {item.item_name}
                      </span>
                      {hasPending ? (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/90 text-amber-900 shrink-0">
                          Pending
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                          Done
                        </span>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-amber-200/60 space-y-1.5">
                      {/* Units to Deliver vs Total Sold */}
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span
                            className={`text-2xl font-black leading-none ${
                              hasPending ? 'text-brand-orange' : 'text-slate-400'
                            }`}
                          >
                            {item.pending_quantity}
                          </span>
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">
                            To Deliver
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold text-slate-700 leading-none">
                            {item.total_quantity}
                          </span>
                          <span className="block text-[9px] font-semibold text-slate-400 mt-0.5">
                            Total Sold
                          </span>
                        </div>
                      </div>

                      {/* Delivered Progress Indicator */}
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span>Delivered:</span>
                        <span className={`font-bold ${item.delivered_quantity > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {item.delivered_quantity} / {item.total_quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. ACTIVE TOKEN QUEUE SECTION - VISIBLE TO ADMIN, SUPER ADMIN & KITCHEN STAFF */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          
          {/* Controls & Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Active Token Queue</h3>
              <span className="bg-amber-100 text-amber-900 font-black text-xs px-3 py-1 rounded-full">
                {activeTokenList.length} Undelivered
              </span>
              <span className="bg-orange-100 text-orange-950 font-black text-[11px] px-2.5 py-0.5 rounded-full border border-orange-300 shadow-2xs">
                📦 {parcelCount} Parcel
              </span>
              <span className="bg-emerald-50 text-emerald-950 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                🍽️ {dineInCount} Dine In
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* View Mode Switch */}
              <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Live Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search token number or student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-700 bg-slate-50"
                />
              </div>

              {/* Meal Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
                {MEAL_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedMeal(type.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedMeal === type.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIVE TOKENS DISPLAY AREA */}
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
                Loading active tokens...
              </div>
            ) : filteredTokenList.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
                  {searchQuery.trim() ? '🔍' : '✨'}
                </div>
                <h4 className="text-slate-700 font-bold text-lg">
                  {searchQuery.trim() ? 'No matching tokens found' : 'No active tokens in queue!'}
                </h4>
                <p className="text-slate-400 text-xs max-w-sm mx-auto">
                  {searchQuery.trim()
                    ? 'Try adjusting your search term or selecting another meal tab.'
                    : `All placed orders for ${selectedMeal === 'all' ? 'today' : selectedMeal === 'parcel' ? 'parcel takeaway' : selectedMeal} have been delivered.`}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* RESPONSIVE MULTI-COLUMN GRID FORMAT */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {filteredTokenList.map((ord) => {
                  const ordId = ord._id || ord.id;
                  const ordIdStr = String(ordId);
                  const isWalkIn = Boolean(ord.customer_name);
                  const studentName = ord.customer_name || ord.student_id?.name || ord.student_name || 'Customer';
                  const rollNo = ord.student_id?.roll_no || ord.student?.roll_no || '';
                  const isTokenOnly = ord.payment_status === 'token_only';
                  const isParcel = Boolean(ord.is_parcel || ord.order_type === 'parcel');
                  const timerData = parcelTimers[ordId] || parcelTimers[ordIdStr];
                  const isTimerActive = Boolean(timerData && timerData.readyAt && timerData.readyAt > now);
                  const isOrderReady = ord.order_status === 'ready' || (isParcel && timerData && timerData.readyAt && timerData.readyAt <= now);

                  return (
                    <div
                      key={ordId}
                      className={`bg-white rounded-3xl border-2 ${
                        isOrderReady
                          ? 'border-emerald-400 ring-2 ring-emerald-100/70 shadow-emerald-50'
                          : isParcel
                          ? 'border-orange-300 hover:border-orange-500 ring-2 ring-orange-100/70 shadow-orange-50'
                          : 'border-slate-200/90 hover:border-emerald-500'
                      } p-5 shadow-sm flex flex-col justify-between space-y-4 transition-all duration-150 hover:shadow-md relative`}
                    >
                      {/* Card Top: Big Token & Badges */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className={`px-3 py-2 rounded-2xl ${isOrderReady ? 'bg-emerald-600' : 'bg-amber-500'} text-white font-black text-lg sm:text-xl flex items-center justify-center tracking-tight shadow-md shrink-0 whitespace-nowrap min-w-[4.2rem]`}>
                            {ord.token_number || 'T-00'}
                          </div>

                          <div className="text-right space-y-1.5">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isOrderReady ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-600 text-white shadow-xs tracking-wide animate-pulse">
                                  ✓ READY
                                </span>
                              ) : isParcel ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black uppercase px-2.5 py-1 rounded-xl bg-orange-500 text-white shadow-xs tracking-wide">
                                  📦 PARCEL
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 tracking-wide">
                                  🍽️ DINE IN
                                </span>
                              )}
                              <span className="inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-900 text-white tracking-wider">
                                {ord.meal_type}
                              </span>
                            </div>
                            <div>
                              <span
                                className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  isTokenOnly ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isTokenOnly ? 'Token Only' : isWalkIn ? `Paid (${ord.payment_method || 'Cash'})` : 'Paid'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Student & Time Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-base text-slate-900 truncate" title={studentName}>
                              {studentName}
                            </h4>
                            {isWalkIn && (
                              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                                Walk-in
                              </span>
                            )}
                            {rollNo && (
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {rollNo}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Placed at{' '}
                              {new Date(ord.created_at || Date.now()).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </p>
                        </div>

                        {/* Items List Pills */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Ordered Items:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(ord.items || []).map((it, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-xl border border-slate-200"
                              >
                                <strong className="text-amber-700 mr-1">{it.quantity}x</strong>
                                {it.item_name || it.name}
                                {it.variant_name && !(it.item_name || it.name || '').includes(it.variant_name) && (
                                  <span className="ml-1.5 text-amber-800 font-black text-[11px] bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                    🫓 {it.variant_name}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Card Actions: Parcel (Ready, Timer, Delivered) vs Dine-In (Delivered only, Print hidden) */}
                      <div className="pt-3 border-t border-slate-100">
                        {isParcel ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {/* 1. READY BUTTON */}
                              {isOrderReady ? (
                                <div className="py-2.5 px-3 bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 shadow-2xs">
                                  <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                                  <span>READY ✓</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleMarkReady(ordId)}
                                  className="py-2.5 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>READY</span>
                                </button>
                              )}

                              {/* 2. TIMER OPTION */}
                              <div className="relative">
                                {isTimerActive ? (
                                  <div className="w-full py-2 px-2 bg-amber-100 border border-amber-300 text-amber-950 font-mono font-black text-xs rounded-xl flex items-center justify-between shadow-2xs">
                                    <span className="flex items-center gap-1 min-w-0 truncate">
                                      <Clock className="w-3 h-3 text-brand-orange animate-spin shrink-0" style={{ animationDuration: '4s' }} />
                                      <span>{formatTimeRemaining(ordId)}</span>
                                    </span>
                                    <button
                                      onClick={() => clearParcelTimer(ordId)}
                                      title="Cancel timer"
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer shrink-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : isOrderReady ? (
                                  <div className="w-full py-2.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Ready</span>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setActiveTimerDropdownId(activeTimerDropdownId === ordIdStr ? null : ordIdStr)}
                                      disabled={isOrderReady}
                                      className="w-full py-2.5 px-2 bg-slate-100 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 border border-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Set Preparation Timer"
                                    >
                                      <Timer className="w-3.5 h-3.5 text-brand-orange" />
                                      <span>Timer</span>
                                    </button>

                                    {activeTimerDropdownId === ordIdStr && (
                                      <div className="absolute bottom-full left-0 right-0 mb-2 p-2.5 bg-white rounded-2xl shadow-xl border border-amber-200 z-30 space-y-2 animate-in fade-in zoom-in-95">
                                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                          <span className="text-[10px] font-black uppercase text-slate-600">Set Timer</span>
                                          <button
                                            onClick={() => setActiveTimerDropdownId(null)}
                                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1">
                                          {[5, 10, 15, 20].map((m) => (
                                            <button
                                              key={m}
                                              onClick={() => handleSetParcelTimer(ord, m)}
                                              className="py-1 text-[11px] font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors cursor-pointer text-center"
                                            >
                                              {m}m
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-1 pt-1">
                                          <input
                                            type="number"
                                            min="1"
                                            max="120"
                                            placeholder="Mins"
                                            value={customMinutes}
                                            onChange={(e) => setCustomMinutes(e.target.value)}
                                            className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none font-bold"
                                          />
                                          <button
                                            onClick={() => handleSetParcelTimer(ord, customMinutes)}
                                            disabled={!customMinutes}
                                            className="flex-1 py-1.5 px-3 text-xs font-black bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-colors text-center"
                                          >
                                            Start
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 3. DELIVERED BUTTON FOR PARCEL */}
                            <button
                              onClick={() => handleMarkDelivered(ord._id || ord.id)}
                              className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md shadow-orange-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>DELIVERED</span>
                            </button>
                          </div>
                        ) : (
                          /* DINE IN: ONLY DELIVERED BUTTON (Print is hidden) */
                          <button
                            onClick={() => handleMarkDelivered(ord._id || ord.id)}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>DELIVERED</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* COMPACT LIST / TABLE FORMAT */
              <div className="divide-y divide-slate-100">
                {filteredTokenList.map((ord) => {
                  const ordId = ord._id || ord.id;
                  const ordIdStr = String(ordId);
                  const isWalkIn = Boolean(ord.customer_name);
                  const studentName = ord.customer_name || ord.student_id?.name || ord.student_name || 'Customer';
                  const rollNo = ord.student_id?.roll_no || ord.student?.roll_no || '';
                  const isTokenOnly = ord.payment_status === 'token_only';
                  const isParcel = Boolean(ord.is_parcel || ord.order_type === 'parcel');
                  const timerData = parcelTimers[ordId] || parcelTimers[ordIdStr];
                  const isTimerActive = Boolean(timerData && timerData.readyAt && timerData.readyAt > now);
                  const isOrderReady = ord.order_status === 'ready' || (isParcel && timerData && timerData.readyAt && timerData.readyAt <= now);

                  return (
                    <div
                      key={ordId}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                        isOrderReady ? 'bg-emerald-50/50 hover:bg-emerald-50/80' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Left: Token Number & Student Info */}
                      <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                        <div className={`px-3.5 py-2 rounded-2xl ${isOrderReady ? 'bg-emerald-600' : 'bg-amber-500'} text-white font-black text-base sm:text-lg flex items-center justify-center tracking-tight shadow-md shrink-0 whitespace-nowrap min-w-[4.2rem]`}>
                          {ord.token_number || 'T-00'}
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
                              {studentName}
                            </span>
                            {isWalkIn && (
                              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                                Walk-in ({ord.payment_method || 'Cash'})
                              </span>
                            )}
                            {rollNo && (
                              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                {rollNo}
                              </span>
                            )}
                            {isOrderReady ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-600 text-white shadow-xs tracking-wide animate-pulse">
                                ✓ READY
                              </span>
                            ) : isParcel ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded-xl bg-orange-500 text-white shadow-xs tracking-wide">
                                📦 PARCEL
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 tracking-wide">
                                🍽️ DINE IN
                              </span>
                            )}
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                              {ord.meal_type}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                isTokenOnly ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isTokenOnly ? 'Token Only' : 'Paid'}
                            </span>
                          </div>

                          {/* Items Summary Pills */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {(ord.items || []).map((it, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200"
                              >
                                {it.quantity}x {it.item_name || it.name}
                              </span>
                            ))}
                          </div>

                          <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium pt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Placed at{' '}
                              {new Date(ord.created_at || Date.now()).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Right Action: Parcel (Ready, Timer, Delivered) vs Dine-In (Delivered only, Print hidden) */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center w-full sm:w-auto flex-wrap">
                        {isParcel ? (
                          <>
                            {/* READY BUTTON */}
                            {isOrderReady ? (
                              <div className="px-4 py-3 bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-xs rounded-2xl flex items-center gap-1 shadow-2xs">
                                <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                                <span>READY ✓</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleMarkReady(ordId)}
                                className="flex-1 sm:flex-initial px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-2xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>READY</span>
                              </button>
                            )}

                            {/* TIMER OPTION */}
                            <div className="relative">
                              {isTimerActive ? (
                                <div className="py-2.5 px-3 bg-amber-100 border border-amber-300 text-amber-950 font-mono font-black text-xs rounded-2xl flex items-center gap-2 shadow-2xs">
                                  <Clock className="w-3.5 h-3.5 text-brand-orange animate-spin" style={{ animationDuration: '4s' }} />
                                  <span>{formatTimeRemaining(ordId)}</span>
                                  <button
                                    onClick={() => clearParcelTimer(ordId)}
                                    title="Cancel timer"
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : isOrderReady ? (
                                <div className="px-3.5 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-2xl flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Ready</span>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setActiveTimerDropdownId(activeTimerDropdownId === ordIdStr ? null : ordIdStr)}
                                    disabled={isOrderReady}
                                    className="px-3.5 py-3 bg-slate-100 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 border border-slate-200 font-bold text-xs rounded-2xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Set Preparation Timer"
                                  >
                                    <Timer className="w-3.5 h-3.5 text-brand-orange" />
                                    <span>Timer</span>
                                  </button>

                                  {activeTimerDropdownId === ordIdStr && (
                                    <div className="absolute bottom-full right-0 mb-2 p-2.5 bg-white rounded-2xl shadow-xl border border-amber-200 z-30 space-y-2 w-48 animate-in fade-in zoom-in-95">
                                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                        <span className="text-[10px] font-black uppercase text-slate-600">Set Timer</span>
                                        <button
                                          onClick={() => setActiveTimerDropdownId(null)}
                                          className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1">
                                        {[5, 10, 15, 20].map((m) => (
                                          <button
                                            key={m}
                                            onClick={() => handleSetParcelTimer(ord, m)}
                                            className="py-1 text-[11px] font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-200 transition-colors cursor-pointer text-center"
                                          >
                                            {m}m
                                          </button>
                                        ))}
                                      </div>
                                      <div className="flex items-center gap-1 pt-1">
                                        <input
                                          type="number"
                                          min="1"
                                          max="120"
                                          placeholder="Mins"
                                          value={customMinutes}
                                          onChange={(e) => setCustomMinutes(e.target.value)}
                                          className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none font-bold"
                                        />
                                        <button
                                          onClick={() => handleSetParcelTimer(ord, customMinutes)}
                                          disabled={!customMinutes}
                                          className="flex-1 py-1 px-2 text-xs font-black bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-40 cursor-pointer"
                                        >
                                          Start
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* DELIVERED BUTTON */}
                            <button
                              onClick={() => handleMarkDelivered(ord._id || ord.id)}
                              className="flex-1 sm:flex-initial px-5 py-3.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 shadow-orange-200 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-1.5 min-w-[120px] justify-center cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>DELIVERED</span>
                            </button>
                          </>
                        ) : (
                          /* DINE IN: DELIVERED ONLY (Print is hidden) */
                          <button
                            onClick={() => handleMarkDelivered(ord._id || ord.id)}
                            className="flex-1 sm:flex-initial px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-200 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-1.5 min-w-[130px] justify-center cursor-pointer"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>DELIVERED</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      {/* SUPER ADMIN RENEWAL MODAL */}
      <SubscriptionModal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={(updatedSub) => {
          setSubscription(updatedSub);
          setSubscriptionExpired(false);
          fetchSubscriptionStatus();
        }}
      />

      {/* NEW MANUAL WALK-IN ORDER MODAL (FEATURE 1) */}
      <ManualOrderModal
        isOpen={manualOrderModalOpen}
        onClose={() => setManualOrderModalOpen(false)}
        onOrderCreated={handleManualOrderCreated}
        printReceipt={printReceipt}
      />
    </div>
  );
}
