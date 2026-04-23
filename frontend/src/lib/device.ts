import { DeviceType } from './types';

export function detectDevice(): DeviceType {
  const ua = navigator.userAgent;
  const uaPlatform = (navigator as any).userAgentData?.platform || navigator.platform;

  // iOS devices (iPhone/iPod)
  if (/iPhone|iPod/.test(ua)) {
    return 'ios';
  }
  
  // iPad detection
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) {
    return 'ipad';
  }
  
  // Android devices
  if (/Android/.test(ua)) {
    const screenWidth = window.screen.width;
    if (screenWidth >= 768) {
      return 'tablet';
    }
    return 'mobile';
  }
  
  // All other devices (Windows, Mac, Linux) = PC
  return 'pc';
}

export function getDeviceBasePath(): string {
  const device = detectDevice();
  return `/${device}`;
}

// Get device-specific optimizations
export function getDeviceOptimizations() {
  const device = detectDevice();
  
  return {
    isIOS: device === 'ios',
    isMobile: device === 'mobile' || device === 'ios',
    isTablet: device === 'tablet' || device === 'ipad',
    isPC: device === 'pc',
    // iOS-specific optimizations
    iosSafeAreaTop: device === 'ios' ? 'env(safe-area-inset-top)' : '0px',
    iosSafeAreaBottom: device === 'ios' ? 'env(safe-area-inset-bottom)' : '0px',
    // Performance settings
    maxConcurrentRequests: device === 'pc' ? 10 : 4,
    imageQuality: device === 'pc' ? 'high' : device === 'ios' ? 'medium' : 'low',
    enableAnimations: !['mobile', 'ios'].includes(device)
  };
}
