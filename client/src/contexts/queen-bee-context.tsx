/**
 * Global Queen Bee Context
 * ========================
 * Manages the queen bee's emotional state across the entire application.
 * - Connects to AI state for real-time emotion updates
 * - Cycles through animations randomly for guest users
 * - Provides responsive sizing for mobile/desktop
 * - Supports pixel-based draggable positioning
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  | 'SWARM';    // Multi-agent parallel execution

// Modes to cycle through for guests (excludes ERROR)
const GUEST_CYCLE_MODES: QueenBeeMode[] = [
  'IDLE', 'LISTENING', 'TYPING', 'THINKING', 'CODING', 'BUILDING', 'SUCCESS', 'SWARM'
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

// Create context
const QueenBeeContext = createContext<QueenBeeContextState | null>(null);

// Provider props
interface QueenBeeProviderProps {
  children: ReactNode;
  initialMode?: QueenBeeMode;
  initialGuest?: boolean;
}

/**
 * Queen Bee Provider
 * Wraps the application to provide global queen bee state
 */
export function QueenBeeProvider({ 
  children, 
  initialMode = 'IDLE',
  initialGuest = true 
}: QueenBeeProviderProps) {
  const [mode, setMode] = useState<QueenBeeMode>(initialMode);
  const [config, setConfigState] = useState<QueenBeeConfig>(DEFAULT_CONFIG);
  const [isGuest, setIsGuest] = useState(initialGuest);
  const [isAIActive, setIsAIActive] = useState(false);

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

  // Random animation cycling for guests
  useEffect(() => {
    if (!isGuest || isAIActive) return;

    // Cycle through animations randomly every 3-6 seconds
    const cycleAnimation = () => {
      const randomIndex = Math.floor(Math.random() * GUEST_CYCLE_MODES.length);
      setMode(GUEST_CYCLE_MODES[randomIndex]);
    };

    // Initial random mode
    cycleAnimation();

    // Set up interval with random timing
    const getRandomInterval = () => 3000 + Math.random() * 3000; // 3-6 seconds
    
    let timeoutId: NodeJS.Timeout;
    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        cycleAnimation();
        scheduleNext();
      }, getRandomInterval());
    };
    
    scheduleNext();

    return () => clearTimeout(timeoutId);
  }, [isGuest, isAIActive]);

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
  const { setMode, setIsAIActive, setIsGuest } = useQueenBee();

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

  const onAIError = useCallback(() => {
    setMode('ERROR');
    // Return to idle after 3 seconds
    setTimeout(() => {
      setMode('IDLE');
      setIsAIActive(false);
    }, 3000);
  }, [setMode, setIsAIActive]);

  const onSwarmMode = useCallback(() => {
    setIsAIActive(true);
    setMode('SWARM');
  }, [setMode, setIsAIActive]);

  const onIdle = useCallback(() => {
    setMode('IDLE');
    setIsAIActive(false);
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
  };
}
