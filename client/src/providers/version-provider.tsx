import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Version = 'desktop' | 'mobile';

interface VersionContextType {
  version: Version;
  isMobile: boolean;
  isDesktop: boolean;
  forceVersion: (version: Version) => void;
  resetVersion: () => void;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

interface VersionProviderProps {
  children: ReactNode;
  mobileBreakpoint?: number;
}

export function VersionProvider({ children, mobileBreakpoint = 768 }: VersionProviderProps) {
  const [forcedVersion, setForcedVersion] = useState<Version | null>(() => {
    // Hydrate forced version from localStorage on mount
    const stored = localStorage.getItem('archetype-forced-version');
    return (stored === 'desktop' || stored === 'mobile') ? stored : null;
  });
  const [detectedVersion, setDetectedVersion] = useState<Version>('desktop');

  useEffect(() => {
    const detectVersion = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent.toLowerCase();
      
      // Check viewport width
      const isMobileViewport = width < mobileBreakpoint;
      
      // Check user agent for mobile devices
      const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      
      // Check if touch-enabled
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Determine version based on multiple factors
      const shouldBeMobile = isMobileViewport || (isMobileUserAgent && isTouchDevice);
      
      const newVersion: Version = shouldBeMobile ? 'mobile' : 'desktop';
      
      console.log('[VERSION-PROVIDER] Detection:', {
        width,
        isMobileViewport,
        isMobileUserAgent,
        isTouchDevice,
        detectedVersion: newVersion
      });
      
      setDetectedVersion(newVersion);
    };

    // Initial detection
    detectVersion();

    // Re-detect on window resize
    const handleResize = () => detectVersion();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [mobileBreakpoint]);

  const currentVersion = forcedVersion || detectedVersion;

  const value: VersionContextType = {
    version: currentVersion,
    isMobile: currentVersion === 'mobile',
    isDesktop: currentVersion === 'desktop',
    forceVersion: (version: Version) => {
      console.log('[VERSION-PROVIDER] Forcing version:', version);
      setForcedVersion(version);
      localStorage.setItem('archetype-forced-version', version);
    },
    resetVersion: () => {
      console.log('[VERSION-PROVIDER] Resetting to auto-detect');
      setForcedVersion(null);
      localStorage.removeItem('archetype-forced-version');
    }
  };

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
}
