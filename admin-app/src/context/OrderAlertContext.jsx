import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAdminAuth } from './AdminAuthContext';
import { createAdminSocketClient } from '../services/socket';
import OnScreenOrderAlerts from '../components/OnScreenOrderAlerts';

const OrderAlertContext = createContext(null);

export function OrderAlertProvider({ children }) {
  const { token, isAuthenticated } = useAdminAuth();

  // Mute preference persisted in localStorage
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('admin_order_sound_muted') === 'true';
    } catch {
      return false;
    }
  });

  // Browser notification permission state: 'default' | 'granted' | 'denied' | 'unsupported'
  const [permission, setPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Whether user has already answered or dismissed the initial permission prompt
  const [hasPrompted, setHasPrompted] = useState(() => {
    try {
      return localStorage.getItem('admin_notification_prompted') === 'true';
    } catch {
      return false;
    }
  });

  // Whether the friendly pre-permission modal is open
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Active On-Screen Alerts (floating banners)
  const [activeAlerts, setActiveAlerts] = useState([]);

  // Audio elements & unlocked state ref
  const audioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const audioContextRef = useRef(null);
  const lastAlertTimestampRef = useRef(0);
  const recentAlertIdsRef = useRef(new Set());

  // Initialize Audio element with sound file
  useEffect(() => {
    try {
      const audio = new Audio('/notification-sound.wav');
      audio.preload = 'auto';
      audioRef.current = audio;
    } catch (err) {
      console.warn('[OrderAlert] Failed to initialize Audio object:', err);
    }
  }, []);

  // Web Audio API Synthesizer Fallback Chime (Guarantees sound plays even if audio file fails to decode)
  const playWebAudioChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Note 2: G#5 (830.61 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(830.61, now + 0.12);
      gain2.gain.setValueAtTime(0.45, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);

      // Note 3: B5 (987.77 Hz - harmonious major triad ring)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(987.77, now + 0.24);
      gain3.gain.setValueAtTime(0.5, now + 0.24);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.24);
      osc3.stop(now + 0.85);
    } catch (e) {
      console.warn('[OrderAlert] Web Audio API chime error:', e);
    }
  }, []);

  // Unlock Audio autoplay restriction on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioCtx();
          }
          if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
        }
      } catch {}

      // Attempt brief silent playback to warm up browser audio element
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }).catch(() => {});
      }

      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Play Sound Alert (Respects mute toggle; plays synthesizer chime and audio file)
  const playSound = useCallback(() => {
    if (isMuted) return;

    // Always trigger the synthesizer chime immediately (reliable across browsers)
    playWebAudioChime();

    // Also attempt to play the audio file for maximum acoustic impact
    try {
      const audio = audioRef.current || new Audio('/notification-sound.wav');
      audio.currentTime = 0;
      audio.volume = 1.0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback to mp3 if wav failed
          const mp3 = new Audio('/notification-sound.mp3');
          mp3.volume = 1.0;
          mp3.play().catch(() => {});
        });
      }
    } catch {
      // Synthesizer chime was already triggered
    }
  }, [isMuted, playWebAudioChime]);

  // Trigger Native Desktop Notification Popup
  const showNotification = useCallback((order) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const tokenNum = order?.token_number || 'New Order';
      const mealType = (order?.meal_type || 'Meal').toUpperCase();
      const isParcel = Boolean(order?.is_parcel) || order?.order_type === 'parcel';
      const diningTag = isParcel ? '📦 PARCEL (Takeaway)' : '🍽️ DINE IN';
      const studentName = order?.customer_name || order?.student_id?.name || order?.student_name || 'Customer';
      
      const itemsList = (order?.items || [])
        .map((it) => `${it.quantity || 1}x ${it.item_name || it.name}`)
        .join(', ');

      const title = `🔔 New Order Received — Token #${tokenNum}`;
      const body = `${diningTag} • ${mealType}\nCustomer: ${studentName}${itemsList ? `\nItems: ${itemsList}` : ''}`;

      const notif = new Notification(title, {
        body,
        icon: '/cafe-d-cruze-logo.png',
        badge: '/cafe-d-cruze-logo.png',
        tag: `order-${order?._id || order?.id || Date.now()}`,
        requireInteraction: true,
      });

      // Clicking notification brings tab to focus
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (err) {
      console.warn('[OrderAlert] Native browser notification failed:', err);
    }
  }, []);

  // Dismiss an individual on-screen alert banner
  const dismissAlert = useCallback((alertId) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  // Clear all on-screen alerts
  const clearAllAlerts = useCallback(() => {
    setActiveAlerts([]);
  }, []);

  // Dispatch Sound, Desktop Notification, and On-Screen Alert on incoming order
  const handleNewOrderAlert = useCallback((order) => {
    if (!order) return;

    const orderId = String(order._id || order.id || order.token_number || Date.now());

    // Deduplicate alerts if already triggered in the last 25 seconds
    if (recentAlertIdsRef.current.has(orderId)) {
      return;
    }
    recentAlertIdsRef.current.add(orderId);
    setTimeout(() => {
      recentAlertIdsRef.current.delete(orderId);
    }, 25000);

    const now = Date.now();
    // Throttle sound chimes to avoid jarring overlap if multiple orders hit simultaneously
    if (now - lastAlertTimestampRef.current >= 350) {
      lastAlertTimestampRef.current = now;
      // 1. Play sound alert (synthesizer chime + audio file)
      playSound();
    }

    // 2. Trigger desktop notification (if permitted by browser)
    showNotification(order);

    // 3. Add to On-Screen Active Alerts Banner queue
    const newAlert = {
      id: orderId,
      token_number: order.token_number || 'NEW',
      student_name: order.customer_name || order.student_name || order.student?.name || 'Customer',
      meal_type: (order.meal_type || 'Meal').toUpperCase(),
      is_parcel: Boolean(order.is_parcel) || order.order_type === 'parcel',
      order_type: order.order_type || (order.is_parcel ? 'parcel' : 'dine_in'),
      items: order.items || [],
      total_amount: order.total_amount || 0,
      timestamp: now,
    };

    setActiveAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== orderId).slice(0, 3)]);
  }, [playSound, showNotification]);

  // Toggle Mute setting (persisted)
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('admin_order_sound_muted', String(next));
      } catch (e) {
        console.error('LocalStorage error:', e);
      }
      return next;
    });
  }, []);

  // Request Notification Permission
  const requestNotificationPermission = useCallback(async (isUserInitiated = false) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      if (isUserInitiated) {
        alert('Desktop notifications are not supported by this browser.');
      }
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      try {
        localStorage.setItem('admin_notification_prompted', 'true');
      } catch {}
      setHasPrompted(true);
      setShowPromptModal(false);

      // If user manually enabled it, show a confirmation test notification
      if (result === 'granted' && isUserInitiated) {
        try {
          const testNotif = new Notification('✅ Notifications Enabled!', {
            body: 'You will receive instant alerts whenever a new order is placed.',
            icon: '/cafe-d-cruze-logo.png',
          });
          testNotif.onclick = () => {
            window.focus();
            testNotif.close();
          };
        } catch {}
      }

      return result;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }, []);

  // Dismiss initial prompt modal
  const dismissPromptModal = useCallback(() => {
    setShowPromptModal(false);
    try {
      localStorage.setItem('admin_notification_prompted', 'true');
    } catch {}
    setHasPrompted(true);
  }, []);

  // Test Alert helper (Sound + On-screen banner + Desktop notification)
  const testAlert = useCallback(() => {
    const testOrderId = `test-${Date.now()}`;
    handleNewOrderAlert({
      _id: testOrderId,
      id: testOrderId,
      token_number: 'TEST-99',
      meal_type: 'Snacks',
      order_type: 'parcel',
      is_parcel: true,
      customer_name: 'Test Walk-in Order',
      items: [
        { item_name: 'Tea / Special Chai', quantity: 2 },
        { item_name: 'Hot Samosa', quantity: 2 },
      ],
      total_amount: 60,
    });
  }, [handleNewOrderAlert]);

  // First-load check: prompt user friendly modal if permission is default and not prompted before
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default' && !hasPrompted) {
      // Delay slightly for smooth page load experience
      const timer = setTimeout(() => {
        setShowPromptModal(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasPrompted]);

  // Persistent Socket.IO Listener: listens to 'order:new' across ALL admin screens and roles
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let socket = null;
    try {
      socket = createAdminSocketClient(token);

      socket.on('connect', () => {
        socket.emit('join:kitchen');
      });
      socket.emit('join:kitchen');

      socket.on('order:new', (newOrder) => {
        if (newOrder) {
          handleNewOrderAlert(newOrder);
        }
      });
    } catch (err) {
      console.error('[OrderAlert] Socket initialization error:', err);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated, token, handleNewOrderAlert]);

  const value = {
    isMuted,
    toggleMute,
    permission,
    showPromptModal,
    setShowPromptModal,
    requestNotificationPermission,
    dismissPromptModal,
    playSound,
    showNotification,
    testAlert,
    triggerOrderAlert: handleNewOrderAlert,
    activeAlerts,
    dismissAlert,
    clearAllAlerts,
  };

  return (
    <OrderAlertContext.Provider value={value}>
      {children}
      <OnScreenOrderAlerts />
    </OrderAlertContext.Provider>
  );
}

export function useOrderAlerts() {
  const context = useContext(OrderAlertContext);
  if (!context) {
    throw new Error('useOrderAlerts must be used within an OrderAlertProvider');
  }
  return context;
}
