/**
 * Global Queen Bee Context
 * ========================
 * Manages the queen bee's emotional state across the entire application.
 * - Connects to AI state for real-time emotion updates
 * - Cycles through animations randomly for guest users
 * - Provides responsive sizing for mobile/desktop
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

// Configuration for the queen bee
export interface QueenBeeConfig {
  size: 'sm' | 'md' | 'lg';
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  isMinimized: boolean;
  isVisible: boolean;
}

// Context state interface
interface QueenBeeContextState {
  mode: QueenBeeMode;
  setMode: (mode: QueenBeeMode) => void;
  config: QueenBeeConfig;
  setConfig: (config: Partial<QueenBeeConfig>) => void;
  toggleMinimized: () => void;
  toggleVisibility: () => void;
  isGuest: boolean;
  setIsGuest: (isGuest: boolean) => void;
  isAIActive: boolean;
  setIsAIActive: (active: boolean) => void;
}

// Default configuration
const DEFAULT_CONFIG: QueenBeeConfig = {
  size: 'md',
  position: 'bottom-right',
  isMinimized: false,
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

  // Load saved config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('queenBeeConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfigState(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

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

  // Toggle minimized state
  const toggleMinimized = useCallback(() => {
    setConfig({ isMinimized: !config.isMinimized });
  }, [config.isMinimized, setConfig]);

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
        toggleMinimized,
        toggleVisibility,
        isGuest,
        setIsGuest,
        isAIActive,
        setIsAIActive,
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
