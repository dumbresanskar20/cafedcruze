import React, { useState } from 'react';
import { AlertTriangle, X, Copy, Check, Receipt, RefreshCw, HelpCircle, Utensils, ShieldAlert } from 'lucide-react';
import CAFE_D_CRUZE_LOGO from '../assets/logo';

export default function PaymentFailureModal({
  isOpen,
  onClose,
  failureData,
  onOpenOrderHistory,
  onRetry,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const orderId = failureData?.orderId || '';
  const paymentId = failureData?.paymentId || '';
  const amount = failureData?.amount != null ? failureData.amount : '';
  const mealType = failureData?.mealType || '';
  const failureReason = failureData?.reason || '';
  const studentName = failureData?.studentName || '';
  const studentRollNo = failureData?.studentRollNo || '';
  const timestamp = failureData?.timestamp || new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const referenceText = [
    orderId ? `Order ID: ${orderId}` : '',
    paymentId ? `Payment ID: ${paymentId}` : '',
    amount ? `Amount: ₹${amount}` : '',
    mealType ? `Meal: ${mealType.toUpperCase()}` : '',
    studentName ? `Student: ${studentName}` : '',
    studentRollNo ? `Roll No: ${studentRollNo}` : '',
    `Date & Time: ${timestamp}`,
  ]
    .filter(Boolean)
    .join('\n');

  const handleCopyDetails = () => {
    if (referenceText && navigator.clipboard) {
      navigator.clipboard.writeText(referenceText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 text-stone-800 animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Top Decorative Header Accent */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 h-2.5 w-full" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors z-10 cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-6 text-center space-y-4">
          
          {/* Reassuring Alert Icon */}
          <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20">
            <div className="w-full h-full rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner border border-amber-200">
              <ShieldAlert className="w-9 h-9 sm:w-11 sm:h-11 text-brand-orange animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-amber-200">
              <img src={CAFE_D_CRUZE_LOGO} alt="Cafe D Cruze Restaurant" className="w-5 h-5 object-contain" />
            </div>
          </div>

          {/* Main Title */}
          <div>
            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 font-extrabold text-[11px] sm:text-xs rounded-full uppercase tracking-wider mb-1.5 border border-amber-200">
              Payment & Token Notice
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-brand-dark tracking-tight">
              Don't worry!
            </h2>
          </div>

          {/* Reassuring Notice Box - Exact User Prompt Content Highlighted */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/70 border-2 border-amber-300/80 rounded-2xl p-4 sm:p-4.5 text-left shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-200/70 text-amber-900 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-800" />
              </div>
              <div className="text-xs sm:text-sm text-amber-950 font-semibold leading-relaxed">
                <p className="font-extrabold text-brand-dark text-sm sm:text-base mb-1">
                  Payment failed or token pending?
                </p>
                <p className="text-stone-800 font-medium">
                  If your payment was successful or money got debited but the token was not generated,{' '}
                  <span className="font-extrabold text-amber-900 underline decoration-amber-400 decoration-2">
                    kindly contact the mess/canteen to get your token.
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Transaction Info (if order ID or error exists) */}
          {(orderId || paymentId || failureReason) && (
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 text-left text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
                <span className="font-bold text-stone-600 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-brand-orange" />
                  Transaction Reference
                </span>
                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-orange hover:text-amber-700 bg-white px-2 py-0.5 rounded-lg border border-amber-200 hover:border-amber-300 shadow-2xs transition-all cursor-pointer"
                  title="Copy details to share with canteen staff"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-extrabold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Details</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1 text-stone-600 font-medium font-mono text-[11px] overflow-hidden">
                {orderId && (
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-400 font-sans">Order ID:</span>
                    <span className="font-bold text-stone-800 truncate" title={orderId}>{orderId}</span>
                  </div>
                )}
                {paymentId && (
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-400 font-sans">Payment ID:</span>
                    <span className="font-bold text-stone-800 truncate" title={paymentId}>{paymentId}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex justify-between gap-2 font-sans">
                    <span className="text-stone-400">Amount:</span>
                    <span className="font-extrabold text-stone-900">₹{amount}</span>
                  </div>
                )}
                {failureReason && (
                  <div className="pt-1 text-[10px] text-stone-500 font-sans border-t border-stone-200/60 leading-tight">
                    <span className="text-stone-400">Gateway Note: </span>
                    <span className="italic">{failureReason}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Helpful Next Steps */}
          <div className="text-left text-xs bg-amber-50/50 p-3 rounded-2xl border border-amber-100 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
            <div className="text-stone-600 space-y-0.5 text-[11px] sm:text-xs">
              <p className="font-bold text-stone-800">What to do next:</p>
              <p>1. Show your payment SMS/UPI transaction ID at the mess counter.</p>
              <p>2. Or tap <b>Check Order History</b> below to see if the token was recorded.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {/* Action 1: Check Order History */}
            {onOpenOrderHistory && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOrderHistory();
                }}
                className="w-full py-3 px-4 bg-brand-dark hover:bg-stone-800 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>Check Order History</span>
              </button>
            )}

            {/* Action 2: Retry Payment (if in cart drawer) */}
            {onRetry && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetry();
                }}
                className="w-full py-2.5 px-4 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Payment Again</span>
              </button>
            )}

            {/* Action 3: Close / Got it */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
            >
              I Understand / Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
