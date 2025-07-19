'use client';

import { useEffect, useState } from 'react';

export function useDeviceDetect() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    
    const checkDevice = () => {
      const width = window.innerWidth;
      const isMobileDevice = mobileRegex.test(userAgent);

      if (isMobileDevice) {
        if (width < 768) {
          setIsMobile(true);
          setIsTablet(false);
        } else {
          setIsMobile(false);
          setIsTablet(true);
        }
      } else {
        setIsMobile(width < 768);
        setIsTablet(width >= 768 && width < 1024);
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  return { isMobile, isTablet };
}
