'use client';

import { useState } from 'react';

interface Props {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}

/** Lazy image with a graceful placeholder when src is missing or fails to load. */
export default function ItemImage({ src, alt, className, eager }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-hidden
        className={
          'flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-300 ' +
          (className ?? '')
        }
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
