import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { shouldShowApkDownload } from '../utils/platform';

/**
 * "Get App" button component.
 * Rendered ONLY when the user is visiting the website on an Android browser
 * (i.e. Capacitor.getPlatform() === 'web' AND /android/i.test(navigator.userAgent)).
 *
 * When clicked, triggers the direct native download of DYPCOEI-Canteen.apk
 * with appropriate visual feedback.
 *
 * @param {string} [props.className] - Additional Tailwind classes
 */
export default function DownloadAppButton({ className = '' }) {
  const [downloading, setDownloading] = useState(false);

  if (!shouldShowApkDownload()) {
    return null;
  }

  const apkDownloadUrl = '/dypcoei-canteen.apk';
  const apkFileName = 'DYPCOEI-Canteen.apk';

  const handleClick = () => {
    setDownloading(true);
    setTimeout(() => setDownloading(false), 3500);
  };

  return (
    <a
      href={apkDownloadUrl}
      download={apkFileName}
      onClick={handleClick}
      id="nav-download-app-btn"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95 whitespace-nowrap cursor-pointer ${className}`}
      title="Download Android App (APK)"
      aria-label="Download Android App"
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        <Download className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{downloading ? 'Downloading...' : 'Get App'}</span>
    </a>
  );
}
