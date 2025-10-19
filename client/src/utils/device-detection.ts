/**
 * Device detection utilities for responsive routing
 */

export function isMobileDevice(): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return false;

  // Check user agent for mobile patterns
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Mobile device patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  
  // Check screen width as additional indicator
  const isMobileWidth = window.innerWidth <= 768;
  
  // Check touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return mobileRegex.test(userAgent) || (isMobileWidth && isTouchDevice);
}

export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const tabletRegex = /iPad|Android(?!.*Mobile)/i;
  
  return tabletRegex.test(userAgent) && window.innerWidth >= 768 && window.innerWidth <= 1024;
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isMobileDevice()) return 'mobile';
  if (isTabletDevice()) return 'tablet';
  return 'desktop';
}
