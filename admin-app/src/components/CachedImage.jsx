import React, { useState } from 'react';
import { useCachedImage } from '../utils/imageCache';

/**
 * Reusable CachedImage Component (Admin App)
 * Renders an image backed by the 1-day browser cache memory session.
 */
export default function CachedImage({
  src,
  alt = '',
  className = '',
  placeholderEmoji = '🍱',
  fallbackSrc = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
  onLoad,
  onError,
  loading = 'lazy',
  ...rest
}) {
  const { displaySrc, isCached } = useCachedImage(src);
  const [imageLoaded, setImageLoaded] = useState(isCached);
  const [errorOccurred, setErrorOccurred] = useState(false);

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleImageError = (e) => {
    setErrorOccurred(true);
    if (onError) onError(e);
  };

  const finalSrc = errorOccurred ? fallbackSrc : (displaySrc || src || fallbackSrc);

  return (
    <>
      {!imageLoaded && (
        <div className="absolute inset-0 bg-slate-200/80 animate-pulse flex items-center justify-center pointer-events-none">
          <span className="text-3xl opacity-30">{placeholderEmoji}</span>
        </div>
      )}

      <img
        src={finalSrc}
        alt={alt}
        loading={loading}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`${className} transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...rest}
      />
    </>
  );
}
