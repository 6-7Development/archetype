/**
 * Global Queen Bee Context - Enhanced with Full Emotional Range
 * ==============================================================
 * Complete emotional AI companion that reacts to all user actions.
 * 
 * EMOTIONS:
 * - IDLE: Resting, gentle floating
 * - LISTENING: User is typing
 * - THINKING: Processing/reasoning
 * - TYPING: AI generating response
 * - CODING: Writing code
 * - BUILDING: Creating files/structure
 * - SUCCESS: Task completed
 * - ERROR: Something went wrong
 * - SWARM: Multi-agent parallel execution
 * - LOADING: Page loading
 * - CURIOUS: User clicked something
 * - ALERT: Attention needed
 * - EXCITED: Many rapid interactions
 * - HELPFUL: Hovering helpful elements
 * - SLEEPY: User inactive for a while
 * - CELEBRATING: Big achievement
 * - CONFUSED: Error or issue detected
 * - FOCUSED: User working on code
 * 
 * INTERACTIVE HINTS:
 * - Detects when user hovers over key UI elements
 * - Provides contextual suggestions and tips
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useLocation } from 'wouter';

// All possible queen bee emotional states (21 total)
export type QueenBeeMode = 
  | 'IDLE'        // Default resting state
  | 'LISTENING'   // User is typing/interacting
  | 'TYPING'      // AI is generating response
  | 'THINKING'    // AI is processing/reasoning
  | 'CODING'      // AI is writing/editing code
  | 'BUILDING'    // AI is creating files/structure
  | 'SUCCESS'     // Task completed successfully
  | 'ERROR'       // Something went wrong
  | 'SWARM'       // Multi-agent parallel execution
  | 'LOADING'     // Page is loading
  | 'CURIOUS'     // User clicked something
  | 'ALERT'       // Attention needed
  | 'EXCITED'     // Many rapid interactions
  | 'HELPFUL'     // Hovering helpful UI elements
  | 'SLEEPY'      // User inactive
  | 'CELEBRATING' // Big achievement
  | 'CONFUSED'    // Error or issue
  | 'FOCUSED'     // User working on code
  | 'FRENZY'      // Red mode - bees attacking/aggressive swarm
  | 'HUNTING'     // Bees actively chasing user
  | 'RESTING';    // Calm after activity ends

// Interactive hint types
export interface InteractiveHint {
  message: string;
  element: string;
  action?: string;
}

// Modes to cycle through for guests
const GUEST_CYCLE_MODES: QueenBeeMode[] = [
  'IDLE', 'LISTENING', 'CURIOUS', 'THINKING', 'CODING', 'BUILDING', 'EXCITED', 'HELPFUL'
];

// Interactive hints based on hovered elements
const ELEMENT_HINTS: Record<string, InteractiveHint> = {
  'login': { message: "Hey! Log in to save your projects", element: 'login', action: 'click' },
  'signup': { message: "Join the hive! Sign up for free", element: 'signup', action: 'click' },
  'pricing': { message: "Check out our pricing plans", element: 'pricing', action: 'explore' },
  'preview': { message: "See your app come to life!", element: 'preview', action: 'watch' },
  'chat': { message: "Ask Scout anything!", element: 'chat', action: 'type' },
  'files': { message: "Your project files live here", element: 'files', action: 'browse' },
  'terminal': { message: "Run commands here", element: 'terminal', action: 'type' },
  'deploy': { message: "Ready to go live?", element: 'deploy', action: 'click' },
  'settings': { message: "Customize your workspace", element: 'settings', action: 'explore' },
  'theme': { message: "Toggle light/dark mode", element: 'theme', action: 'click' },
  'dashboard': { message: "View all your projects", element: 'dashboard', action: 'explore' },
  'new-project': { message: "Start something amazing!", element: 'new-project', action: 'create' },
};

// Header height buffer
const HEADER_BUFFER = 60;

// Configuration for the queen bee
export interface QueenBeeConfig {
  size: 'sm' | 'md' | 'lg';
  position: { x: number; y: number };
  isVisible: boolean;
}

// Size dimensions - Increased for better visuals & holiday animations
export const SIZE_DIMENSIONS = {
  sm: 68,
  md: 100,
  lg: 120,
};

// Error state tracking
export interface ErrorState {
  hasError: boolean;
  message: string | null;
  timestamp: number;
}

// Swarm state for coordinated worker bee behavior
export interface SwarmState {
  isActive: boolean;
  intensity: number; // 0-1 scale of swarm intensity
  workerCount: number; // How many workers are visible
  isFrenzy: boolean; // Red/aggressive mode
  startTime: number;
}

// Default swarm state
const DEFAULT_SWARM_STATE: SwarmState = {
  isActive: false,
  intensity: 0,
  workerCount: 0,
  isFrenzy: false,
  startTime: 0,
};

// Autonomous velocity for queen bee movement
export interface AutonomousVelocity {
  x: number;
  y: number;
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
  errorState: ErrorState;
  triggerError: (message: string) => void;
  clearError: () => void;
  isPageLoading: boolean;
  lastActivity: string;
  recentClicks: number;
  // Interactive hints
  currentHint: InteractiveHint | null;
  setCurrentHint: (hint: InteractiveHint | null) => void;
  // Inactivity tracking
  inactivityTime: number;
  // Celebration trigger
  triggerCelebration: () => void;
  // Swarm management - Worker bee lifecycle
  swarmState: SwarmState;
  triggerSwarm: (options?: { frenzy?: boolean; workerCount?: number; duration?: number }) => void;
  endSwarm: () => void;
  triggerHunting: () => void;
  triggerFrenzy: () => void;
  // Autonomous movement velocity
  autonomousVelocity: AutonomousVelocity;
  updateAutonomousVelocity: (velocity: AutonomousVelocity) => void;
}

// Get default position
function getDefaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 100, y: 100 };
  }
  const size = SIZE_DIMENSIONS.md;
  return {
    x: window.innerWidth - size - 20,
    y: window.innerHeight - size - 80,
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
 * Queen Bee Provider - Full Emotional AI Companion
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
  const [currentHint, setCurrentHint] = useState<InteractiveHint | null>(null);
  const [inactivityTime, setInactivityTime] = useState(0);
  const [location] = useLocation();
  
  // Refs for debouncing
  const modeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousLocationRef = useRef(location);
  const clickCountRef = useRef(0);
  const clickResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef(Date.now());
  const hintClearTimeoutRef = useRef<NodeJS.Timeout | null>(null); // FIX: Track hint clearing timeout
  const swarmTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Swarm auto-end timeout
  
  // Swarm state for worker bee lifecycle
  const [swarmState, setSwarmState] = useState<SwarmState>(DEFAULT_SWARM_STATE);
  
  // Autonomous velocity for queen bee movement
  const [autonomousVelocity, setAutonomousVelocity] = useState<AutonomousVelocity>({ x: 0, y: 0 });

  // Clamp position to viewport
  const clampPosition = useCallback((x: number, y: number): { x: number; y: number } => {
    if (typeof window === 'undefined') return { x, y };
    
    const size = SIZE_DIMENSIONS[config.size];
    const padding = 10;
    
    return {
      x: Math.max(padding, Math.min(x, window.innerWidth - size - padding)),
      y: Math.max(HEADER_BUFFER, Math.min(y, window.innerHeight - size - padding)),
    };
  }, [config.size]);

  // Smart mode setter with priority
  const setMode = useCallback((newMode: QueenBeeMode) => {
    if (modeTimeoutRef.current) {
      clearTimeout(modeTimeoutRef.current);
      modeTimeoutRef.current = null;
    }
    
    // Error state takes highest priority
    if (errorState.hasError && newMode !== 'ERROR' && newMode !== 'IDLE') {
      return;
    }
    
    setModeState(newMode);
    lastActivityTimeRef.current = Date.now();
    setInactivityTime(0);
  }, [errorState.hasError]);

  // Trigger error state
  const triggerError = useCallback((message: string) => {
    setErrorState({
      hasError: true,
      message,
      timestamp: Date.now(),
    });
    setModeState('ERROR');
    
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

  // Trigger celebration
  const triggerCelebration = useCallback(() => {
    setModeState('CELEBRATING');
    modeTimeoutRef.current = setTimeout(() => {
      setModeState('IDLE');
    }, 3000);
  }, []);

  // SWARM MANAGEMENT: Trigger swarm with worker bees
  const triggerSwarm = useCallback((options?: { frenzy?: boolean; workerCount?: number; duration?: number }) => {
    const { frenzy = false, workerCount = 8, duration = 5000 } = options || {};
    
    // Clear any existing swarm timeout
    if (swarmTimeoutRef.current) {
      clearTimeout(swarmTimeoutRef.current);
    }
    
    // Activate swarm
    setSwarmState({
      isActive: true,
      intensity: frenzy ? 1 : 0.7,
      workerCount,
      isFrenzy: frenzy,
      startTime: Date.now(),
    });
    
    // Set appropriate mode
    setModeState(frenzy ? 'FRENZY' : 'SWARM');
    lastActivityTimeRef.current = Date.now();
    
    // Auto-end swarm after duration
    swarmTimeoutRef.current = setTimeout(() => {
      setSwarmState(prev => ({
        ...prev,
        isActive: false,
        intensity: 0,
        isFrenzy: false,
      }));
      setModeState('RESTING');
      
      // Transition to idle after brief rest
      setTimeout(() => {
        setModeState('IDLE');
      }, 1500);
    }, duration);
  }, []);

  // End swarm immediately
  const endSwarm = useCallback(() => {
    if (swarmTimeoutRef.current) {
      clearTimeout(swarmTimeoutRef.current);
    }
    
    // Smooth transition: active → resting → idle
    setSwarmState(prev => ({
      ...prev,
      isActive: false,
      intensity: 0,
      isFrenzy: false,
    }));
    setModeState('RESTING');
    
    setTimeout(() => {
      setModeState('IDLE');
    }, 1000);
  }, []);

  // Trigger hunting mode (bees actively chasing)
  const triggerHunting = useCallback(() => {
    setSwarmState(prev => ({
      ...prev,
      isActive: true,
      intensity: 0.5,
      workerCount: 6,
      isFrenzy: false,
      startTime: Date.now(),
    }));
    setModeState('HUNTING');
    lastActivityTimeRef.current = Date.now();
  }, []);

  // Trigger frenzy mode (aggressive red swarm)
  const triggerFrenzy = useCallback(() => {
    triggerSwarm({ frenzy: true, workerCount: 8, duration: 4000 });
  }, [triggerSwarm]);

  // Update autonomous velocity (used by the queen bee for ragdoll physics)
  const updateAutonomousVelocity = useCallback((velocity: AutonomousVelocity) => {
    setAutonomousVelocity(velocity);
  }, []);

  // Load saved config
  useEffect(() => {
    try {
      const saved = localStorage.getItem('queenBeeConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.position) {
          parsed.position = clampPosition(parsed.position.x, parsed.position.y);
        }
        setConfigState(prev => ({ ...prev, ...parsed }));
      } else {
        setConfigState(prev => ({
          ...prev,
          position: getDefaultPosition(),
        }));
      }
    } catch {
      setConfigState(prev => ({
        ...prev,
        position: getDefaultPosition(),
      }));
    }
  }, [clampPosition]);

  // Re-clamp on resize
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

  // Save config
  const setConfig = useCallback((updates: Partial<QueenBeeConfig>) => {
    setConfigState(prev => {
      const newConfig = { ...prev, ...updates };
      try {
        localStorage.setItem('queenBeeConfig', JSON.stringify(newConfig));
      } catch {
        // Ignore
      }
      return newConfig;
    });
  }, []);

  // Update position
  const updatePosition = useCallback((x: number, y: number) => {
    const clamped = clampPosition(x, y);
    setConfig({ position: clamped });
  }, [clampPosition, setConfig]);

  // Toggle visibility
  const toggleVisibility = useCallback(() => {
    setConfig({ isVisible: !config.isVisible });
  }, [config.isVisible, setConfig]);

  // PAGE NAVIGATION: Loading animation
  useEffect(() => {
    if (location !== previousLocationRef.current && !isAIActive && !errorState.hasError) {
      previousLocationRef.current = location;
      setIsPageLoading(true);
      setModeState('LOADING');
      setLastActivity('navigating');
      
      const timer = setTimeout(() => {
        setIsPageLoading(false);
        setModeState('IDLE');
        setLastActivity('idle');
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [location, isAIActive, errorState.hasError]);

  // INACTIVITY TRACKING: Go sleepy after 30 seconds
  useEffect(() => {
    const checkInactivity = () => {
      const elapsed = Date.now() - lastActivityTimeRef.current;
      setInactivityTime(elapsed);
      
      if (elapsed > 30000 && !isAIActive && !errorState.hasError) {
        setModeState('SLEEPY');
      }
    };

    inactivityTimerRef.current = setInterval(checkInactivity, 5000);
    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [isAIActive, errorState.hasError]);

  // HOVER DETECTION: Interactive hints for UI elements
  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check for data-bee-hint attribute or common selectors
      const hintKey = target.closest('[data-bee-hint]')?.getAttribute('data-bee-hint');
      const testId = target.closest('[data-testid]')?.getAttribute('data-testid');
      
      let detectedHint: string | null = null;
      
      // Check explicit hints
      if (hintKey && ELEMENT_HINTS[hintKey]) {
        detectedHint = hintKey;
      }
      // Check common testids
      else if (testId) {
        if (testId.includes('login') || testId.includes('signin')) detectedHint = 'login';
        else if (testId.includes('signup') || testId.includes('register')) detectedHint = 'signup';
        else if (testId.includes('pricing')) detectedHint = 'pricing';
        else if (testId.includes('preview')) detectedHint = 'preview';
        else if (testId.includes('chat') || testId.includes('message')) detectedHint = 'chat';
        else if (testId.includes('file') || testId.includes('browser')) detectedHint = 'files';
        else if (testId.includes('terminal')) detectedHint = 'terminal';
        else if (testId.includes('deploy') || testId.includes('publish')) detectedHint = 'deploy';
        else if (testId.includes('setting')) detectedHint = 'settings';
        else if (testId.includes('theme')) detectedHint = 'theme';
        else if (testId.includes('dashboard')) detectedHint = 'dashboard';
        else if (testId.includes('new-project') || testId.includes('create-project')) detectedHint = 'new-project';
      }
      
      if (detectedHint && ELEMENT_HINTS[detectedHint]) {
        // FIX: Cancel any pending hint clear timeout when entering a new hinted element
        if (hintClearTimeoutRef.current) {
          clearTimeout(hintClearTimeoutRef.current);
          hintClearTimeoutRef.current = null;
        }
        
        setCurrentHint(ELEMENT_HINTS[detectedHint]);
        if (!isAIActive && !errorState.hasError) {
          setModeState('HELPFUL');
        }
        lastActivityTimeRef.current = Date.now();
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      const hintKey = target.closest('[data-bee-hint]')?.getAttribute('data-bee-hint');
      const testId = target.closest('[data-testid]')?.getAttribute('data-testid');
      
      // FIX: Check if mouse moved to another hinted element - if so, don't clear
      const newHintKey = relatedTarget?.closest('[data-bee-hint]')?.getAttribute('data-bee-hint');
      const newTestId = relatedTarget?.closest('[data-testid]')?.getAttribute('data-testid');
      
      // FIX: Detect if newTestId would produce a valid hint (matches testid patterns)
      const wouldNewTestIdProduceHint = newTestId && (
        newTestId.includes('login') || newTestId.includes('signin') ||
        newTestId.includes('signup') || newTestId.includes('register') ||
        newTestId.includes('pricing') || newTestId.includes('preview') ||
        newTestId.includes('chat') || newTestId.includes('message') ||
        newTestId.includes('file') || newTestId.includes('browser') ||
        newTestId.includes('terminal') || newTestId.includes('deploy') ||
        newTestId.includes('publish') || newTestId.includes('setting') ||
        newTestId.includes('theme') || newTestId.includes('dashboard') ||
        newTestId.includes('new-project') || newTestId.includes('create-project')
      );
      
      // FIX: Check if entering any valid hinted element (explicit hint OR testid-derived hint)
      const isEnteringHintedElement = !!(newHintKey && ELEMENT_HINTS[newHintKey]) || wouldNewTestIdProduceHint;
      
      // Only schedule clear if leaving a hinted element AND not entering another
      if ((hintKey || testId) && !isEnteringHintedElement) {
        // FIX: Cancel any existing timeout before setting new one
        if (hintClearTimeoutRef.current) {
          clearTimeout(hintClearTimeoutRef.current);
        }
        
        // FIX: Extended delay from 500ms to 2000ms for smoother UX
        // Store timeout ID so it can be cancelled if user enters another hinted element
        hintClearTimeoutRef.current = setTimeout(() => {
          setCurrentHint(null);
          if (!isAIActive && !errorState.hasError && mode === 'HELPFUL') {
            setModeState('IDLE');
          }
          hintClearTimeoutRef.current = null;
        }, 2000);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      // Cleanup timeout on unmount
      if (hintClearTimeoutRef.current) {
        clearTimeout(hintClearTimeoutRef.current);
      }
    };
  }, [isAIActive, errorState.hasError, mode]);

  // USER CLICKS: React to document clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-testid="floating-queen-bee"]')) return;
      if (isAIActive || errorState.hasError) return;
      
      clickCountRef.current += 1;
      setRecentClicks(clickCountRef.current);
      lastActivityTimeRef.current = Date.now();
      
      // Show EXCITED if many rapid clicks
      if (clickCountRef.current > 5) {
        setModeState('EXCITED');
      } else {
        setModeState('CURIOUS');
      }
      setLastActivity('clicking');
      
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      activityTimeoutRef.current = setTimeout(() => {
        if (!isAIActive && !errorState.hasError) {
          setModeState('IDLE');
          setLastActivity('idle');
        }
      }, 1500);
      
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
      if (isAIActive || errorState.hasError) return;
      
      if (e.key && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) {
        lastActivityTimeRef.current = Date.now();
        
        // Check if in code editor
        const target = e.target as HTMLElement;
        const isInCodeEditor = target.closest('.monaco-editor') || 
                               target.closest('[data-testid*="code"]') ||
                               target.closest('textarea');
        
        if (isInCodeEditor) {
          setModeState('FOCUSED');
        } else {
          setModeState('LISTENING');
        }
        setLastActivity('typing');
        
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

  // USER SCROLLING
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;
    
    const handleScroll = () => {
      if (isAIActive || errorState.hasError) return;
      
      lastActivityTimeRef.current = Date.now();
      
      if (mode !== 'LOADING' && mode !== 'THINKING') {
        setLastActivity('scrolling');
      }
      
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

  // GLOBAL ERROR LISTENER
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

  // AI BRAIN CONNECTION: Listen for Scout activity and AI state changes
  useEffect(() => {
    const handleScoutActivity = (event: CustomEvent) => {
      const { status, phase } = event.detail || {};
      
      if (!status) return;
      
      // Map Scout phases to queen bee modes
      let newMode: QueenBeeMode = 'IDLE';
      if (status === 'thinking' || phase === 'ASSESS' || phase === 'PLAN') {
        newMode = 'THINKING';
      } else if (status === 'coding' || phase === 'EXECUTE') {
        newMode = 'CODING';
      } else if (status === 'building' || phase === 'PLAN' || status === 'refactoring') {
        newMode = 'BUILDING';
      } else if (status === 'testing' || phase === 'TEST' || phase === 'VERIFY') {
        newMode = 'LOADING';
      } else if (status === 'success' || phase === 'COMMIT') {
        newMode = 'SUCCESS';
        triggerCelebration();
      } else if (status === 'error' || status === 'failed') {
        newMode = 'ERROR';
      } else if (status === 'running' || status === 'active') {
        newMode = 'SWARM';
      }
      
      if (newMode !== 'IDLE') {
        setIsAIActive(true);
        setModeState(newMode);
        lastActivityTimeRef.current = Date.now();
      }
    };

    // Listen for custom Scout activity events
    document.addEventListener('scout-activity', handleScoutActivity as EventListener);
    
    // Also listen for generic AI events
    const handleAIStateChange = (event: CustomEvent) => {
      if (event.detail?.isActive) {
        setIsAIActive(true);
        const mode = event.detail?.mode || 'THINKING';
        setModeState(mode);
      } else {
        setIsAIActive(false);
        setModeState('IDLE');
      }
    };
    
    document.addEventListener('ai-state-change', handleAIStateChange as EventListener);
    
    return () => {
      document.removeEventListener('scout-activity', handleScoutActivity as EventListener);
      document.removeEventListener('ai-state-change', handleAIStateChange as EventListener);
    };
  }, [triggerCelebration]);

  // Random cycling for guests when idle
  useEffect(() => {
    if (!isGuest || isAIActive || errorState.hasError || isPageLoading) return;
    if (lastActivity !== 'idle') return;

    const cycleAnimation = () => {
      const randomIndex = Math.floor(Math.random() * GUEST_CYCLE_MODES.length);
      setModeState(GUEST_CYCLE_MODES[randomIndex]);
    };

    const getRandomInterval = () => 4000 + Math.random() * 4000;
    
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (modeTimeoutRef.current) clearTimeout(modeTimeoutRef.current);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      if (clickResetTimeoutRef.current) clearTimeout(clickResetTimeoutRef.current);
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
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
        currentHint,
        setCurrentHint,
        inactivityTime,
        triggerCelebration,
        swarmState,
        triggerSwarm,
        endSwarm,
        triggerHunting,
        triggerFrenzy,
        autonomousVelocity,
        updateAutonomousVelocity,
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
 */
export function useQueenBeeAI() {
  const { setMode, setIsAIActive, setIsGuest, triggerError, triggerCelebration } = useQueenBee();

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

  const onCelebrate = useCallback(() => {
    triggerCelebration();
  }, [triggerCelebration]);

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
    onCelebrate,
  };
}
