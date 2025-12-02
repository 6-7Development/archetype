/**
 * Global Queen Bee Context - Enhanced with User Action Reactions
 * ===============================================================
 * Manages the queen bee's emotional state across the entire application.
 * - Reacts to user actions (clicks, typing, scrolling, errors)
 * - Shows loading animation on page navigation
 * - Displays error animations when errors occur
 * - Cycles through animations for guest users
 * - Supports pixel-based draggable positioning
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useLocation } from 'wouter';

// All possible queen bee emotional states
export type QueenBeeMode = 
  | 'IDLE'      // Default resting state
  | 'LISTENING' // User is typing/interacting
  | 'TYPING'    // AI is generating response
  | 'THINKING'  // AI is processing/reasoning
  | 'CODING'    // AI is writing/editing code
  | 'BUILDING'  // AI is creating files/structure
  | 'SUCCESS'   // Task completed successfully
  | 'ERROR'     // Something went wrong
  | 'SWARM'     // Multi-agent parallel execution
  | 'LOADING'   // Page is loading
  | 'CURIOUS'   // User clicked something
  | 'ALERT';    // Attention needed

// Modes to cycle through for guests (excludes ERROR, LOADING, ALERT)
const GUEST_CYCLE_MODES: QueenBeeMode[] = [
  'IDLE', 'LISTENING', 'TYPING', 'THINKING', 'CODING', 'BUILDING', 'SUCCESS', 'SWARM', 'CURIOUS'
];

// Header height buffer to prevent bee from going under headers
const HEADER_BUFFER = 60;

// Configuration for the queen bee with pixel-based positioning
export interface QueenBeeConfig {
  size: 'sm' | 'md' | 'lg';
  position: { x: number; y: number }; // Pixel-based position
  isVisible: boolean;
}

// Size dimensions for clamping
export const SIZE_DIMENSIONS = {
  sm: 48,
  md: 64,
  lg: 80,
};

// Error state tracking
export interface ErrorState {
  hasError: boolean;
  message: string | null;
  timestamp: number;
}

// Context state interface
interface QueenBeeContextState {
  mode: QueenBeeMode;
  setMode: (mode: QueenBeeMode) => void;
  config: QueenBeeConfig;
  setConfig: (config: Partial<QueenBeeConfig>) => void;
  updatePosition: (x: number, y: number) => void;
  toggleVisibility: () => void;
  isGuest: boolean;
  setIsGuest: (isGuest: boolean) => void;
  isAIActive: boolean;
  setIsAIActive: (active: boolean) => void;
  clampPosition: (x: number, y: number) => { x: number; y: number };
  // New: Error state
  errorState: ErrorState;
  triggerError: (message: string) => void;
  clearError: () => void;
  // New: Page loading
  isPageLoading: boolean;
  // New: User activity tracking
  lastActivity: string;
  recentClicks: number;
}

// Get default position (bottom-right, above footer)
function getDefaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 100, y: 100 };
  }
  const size = SIZE_DIMENSIONS.md;
  return {
    x: window.innerWidth - size - 20,
    y: window.innerHeight - size - 80, // Above typical footer
  };
}

// Default configuration
const DEFAULT_CONFIG: QueenBeeConfig = {
  size: 'md',
  position: getDefaultPosition(),
  isVisible: true,
};

// Default error state
const DEFAULT_ERROR_STATE: ErrorState = {
  hasError: false,
  message: null,
  timestamp: 0,
};

// Create context
const QueenBeeContext = createContext<QueenBeeContextState | null>(null);

// Provider props
interface QueenBeeProviderProps {
  children: ReactNode;
  initialMode?: QueenBeeMode;
  initialGuest?: boolean;
}

/**
 * Queen Bee Provider - Enhanced with User Action Reactions
 * Wraps the application to provide global queen bee state
 */
export function QueenBeeProvider({ 
  children, 
  initialMode = 'IDLE',
  initialGuest = true 
}: QueenBeeProviderProps) {
  const [mode, setModeState] = useState<QueenBeeMode>(initialMode);
  const [config, setConfigState] = useState<QueenBeeConfig>(DEFAULT_CONFIG);
  const [isGuest, setIsGuest] = useState(initialGuest);
  const [isAIActive, setIsAIActive] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>(DEFAULT_ERROR_STATE);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [lastActivity, setLastActivity] = useState<string>('idle');
  const [recentClicks, setRecentClicks] = useState(0);
  const [location] = useLocation();
  
  // Refs for debouncing and tracking
  const modeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousLocationRef = useRef(location);
  const clickCountRef = useRef(0);
  const clickResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clamp position to viewport bounds
  const clampPosition = useCallback((x: number, y: number): { x: number; y: number } => {
    if (typeof window === 'undefined') return { x, y };
    
    const size = SIZE_DIMENSIONS[config.size];
    const padding = 10;
    
    return {
      x: Math.max(padding, Math.min(x, window.innerWidth - size - padding)),
      y: Math.max(HEADER_BUFFER, Math.min(y, window.innerHeight - size - padding)),
    };
  }, [config.size]);

  // Smart mode setter that respects priority (errors take precedence)
  const setMode = useCallback((newMode: QueenBeeMode) => {
    // Clear any pending mode timeout
    if (modeTimeoutRef.current) {
      clearTimeout(modeTimeoutRef.current);
      modeTimeoutRef.current = null;
    }
    
    // Error state takes highest priority
    if (errorState.hasError && newMode !== 'ERROR' && newMode !== 'IDLE') {
      return; // Don't override error state
    }
    
    setModeState(newMode);
  }, [errorState.hasError]);

  // Trigger error state
  const triggerError = useCallback((message: string) => {
    setErrorState({
      hasError: true,
      message,
      timestamp: Date.now(),
    });
    setModeState('ERROR');
    
    // Auto-clear after 5 seconds
    modeTimeoutRef.current = setTimeout(() => {
      setErrorState(DEFAULT_ERROR_STATE);
      setModeState('IDLE');
    }, 5000);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState(DEFAULT_ERROR_STATE);
    if (modeTimeoutRef.current) {
      clearTimeout(modeTimeoutRef.current);
    }
    setModeState('IDLE');
  }, []);

  // Load saved config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('queenBeeConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clamp saved position to current viewport
        if (parsed.position) {
          parsed.position = clampPosition(parsed.position.x, parsed.position.y);
        }
        setConfigState(prev => ({ ...prev, ...parsed }));
      } else {
        // Set default position on first load
        setConfigState(prev => ({
          ...prev,
          position: getDefaultPosition(),
        }));
      }
    } catch {
      // Set default position on error
      setConfigState(prev => ({
        ...prev,
        position: getDefaultPosition(),
      }));
    }
  }, [clampPosition]);

  // Re-clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setConfigState(prev => ({
        ...prev,
        position: clampPosition(prev.position.x, prev.position.y),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Save config to localStorage when it changes
  const setConfig = useCallback((updates: Partial<QueenBeeConfig>) => {
    setConfigState(prev => {
      const newConfig = { ...prev, ...updates };
      try {
        localStorage.setItem('queenBeeConfig', JSON.stringify(newConfig));
      } catch {
        // Ignore storage errors
      }
      return newConfig;
    });
  }, []);

  // Update position with clamping
  const updatePosition = useCallback((x: number, y: number) => {
    const clamped = clampPosition(x, y);
    setConfig({ position: clamped });
  }, [clampPosition, setConfig]);

  // Toggle visibility
  const toggleVisibility = useCallback(() => {
    setConfig({ isVisible: !config.isVisible });
  }, [config.isVisible, setConfig]);

  // PAGE NAVIGATION: React to route changes with loading animation
  useEffect(() => {
    if (location !== previousLocationRef.current && !isAIActive && !errorState.hasError) {
      previousLocationRef.current = location;
      setIsPageLoading(true);
      setModeState('LOADING');
      setLastActivity('navigating');
      
      // Show loading briefly then return to idle
      const timer = setTimeout(() => {
        setIsPageLoading(false);
        setModeState('IDLE');
        setLastActivity('idle');
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [location, isAIActive, errorState.hasError]);

  // USER CLICKS: React to document clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't react to clicks on the bee itself
      const target = e.target as HTMLElement;
      if (target.closest('[data-testid="floating-queen-bee"]')) return;
      
      // Don't react if AI is active or there's an error
      if (isAIActive || errorState.hasError) return;
      
      // Track click count for excitement
      clickCountRef.current += 1;
      setRecentClicks(clickCountRef.current);
      
      // Show curious reaction
      setModeState('CURIOUS');
      setLastActivity('clicking');
      
      // Reset after brief curiosity
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      activityTimeoutRef.current = setTimeout(() => {
        if (!isAIActive && !errorState.hasError) {
          setModeState('IDLE');
          setLastActivity('idle');
        }
      }, 1000);
      
      // Reset click count after 3 seconds of no clicks
      if (clickResetTimeoutRef.current) {
        clearTimeout(clickResetTimeoutRef.current);
      }
      clickResetTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        setRecentClicks(0);
      }, 3000);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isAIActive, errorState.hasError]);

  // USER TYPING: React to keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't react if AI is active or there's an error
      if (isAIActive || errorState.hasError) return;
      
      // Only react to actual character input
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
        setModeState('LISTENING');
        setLastActivity('typing');
        
        // Reset after brief listening
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current);
        }
        activityTimeoutRef.current = setTimeout(() => {
          if (!isAIActive && !errorState.hasError) {
            setModeState('IDLE');
            setLastActivity('idle');
          }
        }, 2000);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAIActive, errorState.hasError]);

  // USER SCROLLING: React to scroll events
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;
    
    const handleScroll = () => {
      // Don't react if AI is active or there's an error
      if (isAIActive || errorState.hasError) return;
      
      // Only trigger if not already in loading/thinking state
      if (mode !== 'LOADING' && mode !== 'THINKING') {
        setLastActivity('scrolling');
      }
      
      // Debounce scroll end detection
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        if (!isAIActive && !errorState.hasError) {
          setLastActivity('idle');
        }
      }, 500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [mode, isAIActive, errorState.hasError]);

  // GLOBAL ERROR LISTENER: Catch unhandled errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      triggerError(event.message || 'An unexpected error occurred');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || event.reason?.toString() || 'Promise rejected';
      triggerError(message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [triggerError]);

  // Random animation cycling for guests (when not reacting to user)
  useEffect(() => {
    if (!isGuest || isAIActive || errorState.hasError || isPageLoading) return;
    
    // Only cycle if truly idle
    if (lastActivity !== 'idle') return;

    // Cycle through animations randomly every 4-8 seconds
    const cycleAnimation = () => {
      const randomIndex = Math.floor(Math.random() * GUEST_CYCLE_MODES.length);
      setModeState(GUEST_CYCLE_MODES[randomIndex]);
    };

    // Set up interval with random timing
    const getRandomInterval = () => 4000 + Math.random() * 4000; // 4-8 seconds
    
    let timeoutId: NodeJS.Timeout;
    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        if (lastActivity === 'idle' && !isAIActive && !errorState.hasError) {
          cycleAnimation();
        }
        scheduleNext();
      }, getRandomInterval());
    };
    
    scheduleNext();

    return () => clearTimeout(timeoutId);
  }, [isGuest, isAIActive, errorState.hasError, isPageLoading, lastActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (modeTimeoutRef.current) clearTimeout(modeTimeoutRef.current);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      if (clickResetTimeoutRef.current) clearTimeout(clickResetTimeoutRef.current);
    };
  }, []);

  return (
    <QueenBeeContext.Provider
      value={{
        mode,
        setMode,
        config,
        setConfig,
        updatePosition,
        toggleVisibility,
        isGuest,
        setIsGuest,
        isAIActive,
        setIsAIActive,
        clampPosition,
        errorState,
        triggerError,
        clearError,
        isPageLoading,
        lastActivity,
        recentClicks,
      }}
    >
      {children}
    </QueenBeeContext.Provider>
  );
}

/**
 * Hook to access the queen bee context
 */
export function useQueenBee() {
  const context = useContext(QueenBeeContext);
  if (!context) {
    throw new Error('useQueenBee must be used within a QueenBeeProvider');
  }
  return context;
}

/**
 * Hook to connect queen bee to AI activity
 * Call this from components that interact with AI
 */
export function useQueenBeeAI() {
  const { setMode, setIsAIActive, setIsGuest, triggerError } = useQueenBee();

  const onUserTyping = useCallback(() => {
    setIsGuest(false);
    setIsAIActive(true);
    setMode('LISTENING');
  }, [setMode, setIsAIActive, setIsGuest]);

  const onAIThinking = useCallback(() => {
    setIsAIActive(true);
    setMode('THINKING');
  }, [setMode, setIsAIActive]);

  const onAITyping = useCallback(() => {
    setIsAIActive(true);
    setMode('TYPING');
  }, [setMode, setIsAIActive]);

  const onAICoding = useCallback(() => {
    setIsAIActive(true);
    setMode('CODING');
  }, [setMode, setIsAIActive]);

  const onAIBuilding = useCallback(() => {
    setIsAIActive(true);
    setMode('BUILDING');
  }, [setMode, setIsAIActive]);

  const onAISuccess = useCallback(() => {
    setMode('SUCCESS');
    // Return to idle after 3 seconds
    setTimeout(() => {
      setMode('IDLE');
      setIsAIActive(false);
    }, 3000);
  }, [setMode, setIsAIActive]);

  const onAIError = useCallback((message?: string) => {
    triggerError(message || 'AI encountered an error');
  }, [triggerError]);

  const onSwarmMode = useCallback(() => {
    setIsAIActive(true);
    setMode('SWARM');
  }, [setMode, setIsAIActive]);

  const onIdle = useCallback(() => {
    setMode('IDLE');
    setIsAIActive(false);
  }, [setMode, setIsAIActive]);

  const onLoading = useCallback(() => {
    setIsAIActive(true);
    setMode('LOADING');
  }, [setMode, setIsAIActive]);

  return {
    onUserTyping,
    onAIThinking,
    onAITyping,
    onAICoding,
    onAIBuilding,
    onAISuccess,
    onAIError,
    onSwarmMode,
    onIdle,
    onLoading,
  };
}
