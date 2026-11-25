import { useState, useEffect } from 'react';

export interface ViewportState {
  width: number;
  isSmallMobile: boolean; // < 640px
  isMobile: boolean;      // < 768px
  isTablet: boolean;      // < 1024px
}

function readViewport(): ViewportState {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  return {
    width,
    isSmallMobile: width < 640,
    isMobile: width < 768,
    isTablet: width < 1024,
  };
}

/**
 * Shared viewport breakpoint hook replacing per-component resize listeners.
 */
export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(readViewport);

  useEffect(() => {
    const handleResize = () => setViewport(readViewport());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}
