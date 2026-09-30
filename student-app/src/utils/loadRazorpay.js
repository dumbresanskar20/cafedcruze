/**
 * Utility to check and dynamically load the Razorpay Checkout SDK script.
 * @returns {Promise<boolean>} Resolves true if Razorpay SDK is loaded and available, false otherwise.
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    // 1. Check if window.Razorpay is already available
    if (typeof window !== 'undefined' && window.Razorpay) {
      console.log('[Razorpay Diagnostics] Razorpay SDK is already loaded on window.');
      return resolve(true);
    }

    // 2. Check if the script tag is already in DOM but still loading
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      console.log('[Razorpay Diagnostics] Razorpay script tag exists in DOM, waiting for load event...');
      existingScript.addEventListener('load', () => {
        if (window.Razorpay) {
          console.log('[Razorpay Diagnostics] Razorpay SDK loaded successfully.');
          resolve(true);
        } else {
          console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
          resolve(false);
        }
      });
      existingScript.addEventListener('error', () => {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        resolve(false);
      });
      return;
    }

    // 3. Dynamically inject script tag if missing
    console.log('[Razorpay Diagnostics] Dynamically injecting Razorpay Checkout script...');
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        console.log('[Razorpay Diagnostics] Razorpay Checkout script dynamically loaded successfully.');
        resolve(true);
      } else {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        resolve(false);
      }
    };

    script.onerror = () => {
      console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
      resolve(false);
    };

    document.body.appendChild(script);
  });
};
