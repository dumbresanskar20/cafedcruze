import React, { useState, useEffect } from 'react';
import { X, Check, ShieldCheck, Zap, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { createAdminSocketClient } from '../services/socket';

const FALLBACK_PLANS = [
  {
    id: 'monthly',
    code: 'monthly',
    name: 'Monthly Pro Plan',
    price: 999,
    duration_days: 30,
    billing_cycle: 'monthly',
    perDay: '₹33.30/day',
    badge: 'Popular',
  },
  {
    id: 'quarterly',
    code: 'quarterly',
    name: 'Quarterly Saver',
    price: 2499,
    duration_days: 90,
    billing_cycle: 'quarterly',
    perDay: '₹27.76/day',
    badge: 'Save 15%',
  },
  {
    id: 'yearly',
    code: 'yearly',
    name: 'Annual Enterprise',
    price: 8999,
    duration_days: 365,
    billing_cycle: 'yearly',
    perDay: '₹24.65/day',
    badge: 'Best Value',
  },
];

export default function SubscriptionModal({ isOpen, onClose, onSuccess }) {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('monthly');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchLivePlans();

      // Real-time synchronization with Super-Admin plan modifications & deletions
      const token = localStorage.getItem('admin_token');
      const socket = createAdminSocketClient(token);

      const handlePlansUpdated = () => {
        fetchLivePlans();
      };

      socket.on('subscription:plans_updated', handlePlansUpdated);
      socket.on('subscription:plan_deleted', handlePlansUpdated);

      return () => {
        socket.off('subscription:plans_updated', handlePlansUpdated);
        socket.off('subscription:plan_deleted', handlePlansUpdated);
        socket.disconnect();
      };
    }
  }, [isOpen]);

  const fetchLivePlans = async () => {
    setLoadingPlans(true);
    setErrorMessage('');
    try {
      const res = await api.get('/subscription/plans');
      if (res.data.success && Array.isArray(res.data.plans) && res.data.plans.length > 0) {
        const livePlans = res.data.plans;
        setPlans(livePlans);
        setSelectedPlanId((prev) => {
          const exists = livePlans.some((p) => p.id === prev || p.code === prev);
          return exists ? prev : (livePlans[0].id || livePlans[0].code || 'monthly');
        });
        return;
      }

      // Secondary check via /subscription/status
      const statusRes = await api.get('/subscription/status');
      if (statusRes.data.success && Array.isArray(statusRes.data.plans) && statusRes.data.plans.length > 0) {
        const statusPlans = statusRes.data.plans;
        setPlans(statusPlans);
        setSelectedPlanId((prev) => {
          const exists = statusPlans.some((p) => p.id === prev || p.code === prev);
          return exists ? prev : (statusPlans[0].id || statusPlans[0].code || 'monthly');
        });
        return;
      }

      // Fallback
      setPlans(FALLBACK_PLANS);
      setSelectedPlanId('monthly');
    } catch (err) {
      console.warn('[Subscription Modal] Using fallback plans due to network response:', err.message);
      setPlans(FALLBACK_PLANS);
      setSelectedPlanId('monthly');
    } finally {
      setLoadingPlans(false);
    }
  };

  if (!isOpen) return null;

  // Helper to dynamically inject Razorpay Checkout script if needed
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async () => {
    setProcessing(true);
    setErrorMessage('');

    try {
      const res = await api.post('/subscription/create-order', { plan_type: selectedPlanId });

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to create subscription order');
      }

      const { dev_razorpay_order_id, amount, key_id, plan } = res.data;

      // Handle mock fallback mode in local development when keys aren't real live keys
      if (dev_razorpay_order_id.startsWith('sub_order_mock_')) {
        console.log('[Subscription Checkout] Mock order detected, performing instant dev verification');
        const verifyRes = await api.post('/subscription/verify-payment', {
          dev_razorpay_order_id,
          dev_razorpay_payment_id: `pay_dev_mock_${Date.now()}`,
          dev_razorpay_signature: 'mock_dev_sig',
          plan_type: selectedPlanId,
        });

        if (verifyRes.data.success) {
          if (onSuccess) onSuccess(verifyRes.data.subscription);
          onClose();
        } else {
          setErrorMessage(verifyRes.data.message || 'Mock verification failed');
        }
        setProcessing(false);
        return;
      }

      // Load SDK
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setErrorMessage('Failed to load Razorpay SDK. Check your internet connection.');
        setProcessing(false);
        return;
      }

      const options = {
        key: key_id,
        amount: amount,
        currency: 'INR',
        name: 'Mess Management System',
        description: `Canteen Application Subscription - ${plan?.name || 'Plan Renewal'}`,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80',
        order_id: dev_razorpay_order_id,
        webview_intent: true,
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/subscription/verify-payment', {
              dev_razorpay_order_id: response.razorpay_order_id,
              dev_razorpay_payment_id: response.razorpay_payment_id,
              dev_razorpay_signature: response.razorpay_signature,
              plan_type: selectedPlanId,
            });

            if (verifyRes.data.success) {
              if (onSuccess) onSuccess(verifyRes.data.subscription);
              onClose();
            } else {
              setErrorMessage(verifyRes.data.message || 'Payment verification failed.');
            }
          } catch (err) {
            console.error('Subscription verification error:', err);
            setErrorMessage(err.response?.data?.message || 'Payment verification error.');
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: 'Canteen Administrator',
          email: 'contact@cafedcruze.com',
        },
        theme: {
          color: '#F97316',
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error('Create subscription order error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Payment processing error.');
      setProcessing(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId || p.code === selectedPlanId);

  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-6 sm:p-8 text-white relative shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>Super-Admin Subscription Billing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Renew Canteen App Subscription
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Select a plan to extend or reactivate application access. Prices are managed dynamically by the Super-Admin.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Plans Grid */}
        {loadingPlans ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
            <p className="text-xs text-slate-400 font-semibold">Loading live subscription plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="py-10 text-center bg-slate-850 bg-slate-800/40 rounded-2xl border border-slate-800 p-6 space-y-3 mb-6">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="font-bold text-white text-sm">No Active Subscription Plans Available</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All subscription packages have been removed or deactivated in Super-Admin. Please contact your Super-Administrator to publish active pricing packages.
            </p>
            <button
              type="button"
              onClick={fetchLivePlans}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Plans</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id || selectedPlanId === plan.code;
              const days = plan.duration_days || (plan.billing_cycle === 'yearly' ? 365 : plan.billing_cycle === 'six_month' ? 180 : plan.billing_cycle === 'quarterly' ? 90 : 30);
              const perDay = plan.perDay || `₹${(plan.price / days).toFixed(2)}/day`;

              return (
                <div
                  key={plan.id || plan.code}
                  onClick={() => setSelectedPlanId(plan.id || plan.code)}
                  className={`cursor-pointer rounded-2xl p-5 border transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute top-3 right-3 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                      {plan.badge}
                    </span>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-slate-950'
                            : 'border-slate-600 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="font-bold text-sm text-white">{plan.name}</span>
                    </div>

                    <div className="pt-2">
                      <span className="text-2xl font-black text-white">
                        ₹{Number(plan.price).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">/ {days} days</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>Full App Access</span>
                    <span className="text-amber-400 font-bold">{perDay}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Safeguard Notice */}
        <div className="mb-6 p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Connected to Super-Admin Plan Pricing</span>
          </div>
          <p>
            Subscription renewals immediately synchronize with Super-Admin organization records and automatically reactivate canteen operations.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={processing || !selectedPlan}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            {processing ? (
              <span>Initiating Razorpay...</span>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Pay ₹{Number(selectedPlan?.price || 0).toLocaleString('en-IN')} & Reactivate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
