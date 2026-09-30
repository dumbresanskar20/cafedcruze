/**
 * MealBook Image Cache Utility (Student App)
 * Persists downloaded menu images PERMANENTLY in browser CacheStorage & Memory.
 * Images remain stored until the browser/app cache is explicitly cleared.
 * Enables instant display of menu images across logins, app reloads, and navigation without re-downloading.
 */

import { useState, useEffect } from 'react';

// Retained for backward-compatibility if referenced
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_NAME = 'mealbook-image-cache-v1';
const META_KEY = 'mealbook_img_cache_meta_v1';

// L1 In-Memory Cache (Instant synchronous access during active session: url -> blobUrl)
const memoryCache = new Map();

// In-flight fetch deduplication to avoid duplicate concurrent network requests
const inFlightRequests = new Map();

/**
 * Read metadata timestamps from localStorage
 */
function getMetaTimestamps() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save metadata timestamp for a cached image
 */
function setMetaTimestamp(url, timestamp) {
  try {
    const meta = getMetaTimestamps();
    meta[url] = timestamp;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.warn('[ImageCache] Could not update metadata:', err);
  }
}

/**
 * Remove metadata timestamp for a specific image
 */
function removeMetaTimestamp(url) {
  try {
    const meta = getMetaTimestamps();
    if (meta[url]) {
      delete meta[url];
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    }
  } catch {
    // Ignore error
  }
}

/**
 * Clean up expired cached images - Kept for backward compatibility.
 * Images are now stored permanently until the user/browser clears the cache.
 */
export async function cleanExpiredImageCache() {
  // Permanent cache: no automatic 1-day expiration deletion
  return Promise.resolve();
}

/**
 * Explicitly clear all cached images from Memory, CacheStorage, and localStorage
 */
export async function clearImageCache() {
  try {
    memoryCache.clear();
    if (typeof window !== 'undefined' && 'caches' in window) {
      await caches.delete(CACHE_NAME);
    }
    localStorage.removeItem(META_KEY);
  } catch (err) {
    console.warn('[ImageCache] Error clearing image cache:', err);
  }
}

/**
 * Get cached image URL (returns Blob URL from memory/CacheStorage permanently)
 * @param {string} url - Image URL to retrieve or download
 * @returns {Promise<string>} - Resolves to cached blob URL or original URL
 */
export async function getCachedImageUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Bypass inline base64 or blob URLs
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // 1. Check L1 In-Memory Cache (Instant permanent access for this session)
  const memBlobUrl = memoryCache.get(url);
  if (memBlobUrl) {
    return memBlobUrl;
  }

  // 2. Check if a request is already in-flight for this exact URL
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url);
  }

  // Create fetch & cache task
  const fetchTask = (async () => {
    try {
      // Check L2 Browser CacheStorage if supported
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(url);

        // Found in CacheStorage -> return blob permanently (no 1-day expiry)
        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          const blobUrl = URL.createObjectURL(blob);
          memoryCache.set(url, blobUrl);
          return blobUrl;
        }

        // Fetch fresh copy over network
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const headers = new Headers(response.headers);
          const now = Date.now();
          headers.set('X-MealBook-Cached-At', String(now));
          headers.set('Content-Type', blob.type || 'image/jpeg');

          const responseToCache = new Response(blob, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });

          // Store permanently in browser CacheStorage
          await cache.put(url, responseToCache);
          setMetaTimestamp(url, now);

          const blobUrl = URL.createObjectURL(blob);
          memoryCache.set(url, blobUrl);
          return blobUrl;
        }
      }

      // Fallback: return original URL
      return url;
    } catch (err) {
      // If CORS or network fails, fallback to direct original URL
      return url;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchTask);
  return fetchTask;
}

/**
 * Preload multiple images into permanent cache in the background
 * @param {string[]} urls - List of image URLs to cache
 */
export function preloadImages(urls = []) {
  if (!Array.isArray(urls) || urls.length === 0) return;

  const validUrls = urls.filter((u) => u && typeof u === 'string' && !u.startsWith('data:'));
  
  // Non-blocking background caching
  setTimeout(() => {
    Promise.allSettled(validUrls.map((url) => getCachedImageUrl(url))).catch(() => {
      // Ignore background errors
    });
  }, 100);
}

/**
 * React Hook for using permanently cached image URLs in components
 * @param {string} src - Image URL
 * @returns {{ displaySrc: string, loading: boolean, isCached: boolean }}
 */
export function useCachedImage(src) {
  const [displaySrc, setDisplaySrc] = useState(() => {
    if (!src) return '';
    const memBlob = memoryCache.get(src);
    if (memBlob) {
      return memBlob;
    }
    return src;
  });

  const [loading, setLoading] = useState(() => {
    if (!src) return false;
    return !memoryCache.has(src);
  });

  const [isCached, setIsCached] = useState(() => {
    if (!src) return false;
    return memoryCache.has(src);
  });

  useEffect(() => {
    if (!src) {
      setDisplaySrc('');
      setLoading(false);
      setIsCached(false);
      return;
    }

    // If already in L1 memory cache, resolve immediately
    const memBlob = memoryCache.get(src);
    if (memBlob) {
      setDisplaySrc(memBlob);
      setLoading(false);
      setIsCached(true);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getCachedImageUrl(src).then((cachedUrl) => {
      if (isMounted) {
        setDisplaySrc(cachedUrl || src);
        setLoading(false);
        setIsCached(cachedUrl !== src);
      }
    }).catch(() => {
      if (isMounted) {
        setDisplaySrc(src);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src]);

  return { displaySrc, loading, isCached };
}
