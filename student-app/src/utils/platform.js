import { Capacitor } from '@capacitor/core';

/**
 * Determines whether the "Download App" button should be displayed.
 * 
 * Rules:
 * 1. Condition A: Capacitor.getPlatform() === 'web'
 *    Confirms that the client is viewing the website in a standard browser,
 *    and NOT running inside the installed native Capacitor APK/app itself.
 * 
 * 2. Condition B: /android/i.test(navigator.userAgent)
 *    Confirms that the browser's underlying operating system is Android specifically.
 *    Excludes iOS (iPhone/iPad), Windows, macOS, Linux desktop, etc.
 * 
 * Both conditions must be TRUE to show the button.
 * 
 * @returns {boolean} True if viewing website on an Android browser, false otherwise.
 */
export function shouldShowApkDownload() {
  const isWeb = Capacitor.getPlatform() === 'web';
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  return isWeb && isAndroid;
}
