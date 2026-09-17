/**
 * MealBook Image Cache Utility
 * Persists downloaded menu images in browser CacheStorage & Memory for a maximum of 1 day (24 hours).
 * Enables instant display of menu images across logins, app reloads, and navigation without re-downloading.
 */

import { useState, useEffect } from 'react';

// Maximum cache retention: 1 Day (24 hours in milliseconds)
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_NAME = 'mealbook-image-cache-v1';
const META_KEY = 'mealbook_img_cache_meta_v1';

// L1 In-Memory Cache (Instant synchronous access during active session)
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
 * Clean up expired cached images (older than 1 day)
 */
export async function cleanExpiredImageCache() {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const now = Date.now();
    const meta = getMetaTimestamps();
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let updatedMeta = { ...meta };
    let hasChanges = false;

    for (const request of keys) {
      const url = request.url;
      const cachedAt = meta[url] || 0;

      if (!cachedAt || now - cachedAt > ONE_DAY_MS) {
        await cache.delete(request);
        if (updatedMeta[url]) {
          delete updatedMeta[url];
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      localStorage.setItem(META_KEY, JSON.stringify(updatedMeta));
    }
  } catch (err) {
    console.warn('[ImageCache] Auto-cleanup error:', err);
  }
}

/**
 * Get cached image URL (returns Blob URL from memory/CacheStorage if valid within 1 day)
 * @param {string} url - Image URL to retrieve or download
 * @returns {Promise<string>} - Resolves to cached blob URL or original URL
 */
export async function getCachedImageUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Bypass inline base64 or blob URLs
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const now = Date.now();

  // 1. Check L1 In-Memory Cache
  const memEntry = memoryCache.get(url);
  if (memEntry && memEntry.expiresAt > now) {
    return memEntry.blobUrl;
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

        if (cachedResponse) {
          const meta = getMetaTimestamps();
          let cachedAt = meta[url];

          // Check custom header if metadata missing
          if (!cachedAt) {
            const headerVal = cachedResponse.headers.get('X-MealBook-Cached-At');
            if (headerVal) cachedAt = parseInt(headerVal, 10);
          }

          // If still fresh (<= 1 day old), return cached blob
          if (cachedAt && now - cachedAt <= ONE_DAY_MS) {
            const blob = await cachedResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            memoryCache.set(url, { blobUrl, expiresAt: cachedAt + ONE_DAY_MS });
            return blobUrl;
          } else {
            // Expired (> 1 day), delete stale entry
            await cache.delete(url);
            removeMetaTimestamp(url);
          }
        }

        // Fetch fresh copy over network
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const headers = new Headers(response.headers);
          headers.set('X-MealBook-Cached-At', String(now));
          headers.set('Content-Type', blob.type || 'image/jpeg');

          const responseToCache = new Response(blob, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });

          await cache.put(url, responseToCache);
          setMetaTimestamp(url, now);

          const blobUrl = URL.createObjectURL(blob);
          memoryCache.set(url, { blobUrl, expiresAt: now + ONE_DAY_MS });
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
 * Preload multiple images into cache in the background
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
 * React Hook for using 1-day cached image URLs in components
 * @param {string} src - Image URL
 * @returns {{ displaySrc: string, loading: boolean, isCached: boolean }}
 */
export function useCachedImage(src) {
  const [displaySrc, setDisplaySrc] = useState(() => {
    if (!src) return '';
    const mem = memoryCache.get(src);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.blobUrl;
    }
    return src;
  });

  const [loading, setLoading] = useState(() => {
    if (!src) return false;
    const mem = memoryCache.get(src);
    return !(mem && mem.expiresAt > Date.now());
  });

  const [isCached, setIsCached] = useState(() => {
    if (!src) return false;
    const mem = memoryCache.get(src);
    return Boolean(mem && mem.expiresAt > Date.now());
  });

  useEffect(() => {
    if (!src) {
      setDisplaySrc('');
      setLoading(false);
      setIsCached(false);
      return;
    }

    // If already in L1 memory cache, resolve immediately
    const mem = memoryCache.get(src);
    if (mem && mem.expiresAt > Date.now()) {
      setDisplaySrc(mem.blobUrl);
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

// Auto-run cleanup of expired cache entries on module load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    cleanExpiredImageCache();
  }, 3000);
}
