/**
 * Floating Queen Bee Component - Enhanced with User Reaction
 * ===========================================================
 * A draggable, persistent queen bee that floats across all pages.
 * - Draggable to any position on screen
 * - Stays within viewport bounds (never under headers)
 * - Reacts to user actions (clicks, typing, scrolling)
 * - Shows error animations when errors occur
 * - Shows loading state during page navigation
 * - Displays current AI emotional state with visual feedback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { QueenBeeCanvas, BeeMode } from './queen-bee-canvas';
import { useQueenBee, SIZE_DIMENSIONS, QueenBeeMode } from '@/contexts/queen-bee-context';
import { X, GripVertical, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

// Map QueenBeeMode to canvas BeeMode
function mapToCanvasMode(mode: QueenBeeMode): BeeMode {
  switch (mode) {
    case 'LOADING':
    case 'THINKING':
      return 'THINKING';
    case 'LISTENING':
    case 'CURIOUS':
      return 'IDLE'; // Subtle idle with attention
    case 'TYPING':
      return 'THINKING';
    case 'CODING':
      return 'CODING';
    case 'BUILDING':
      return 'BUILDING';
    case 'SUCCESS':
      return 'IDLE';
    case 'ERROR':
    case 'ALERT':
      return 'SWARM'; // Swarm mode for error/alert (more dramatic)
    case 'SWARM':
      return 'SWARM';
    default:
      return 'IDLE';
  }
}

// Get mode indicator color with animation classes
function getModeColor(mode: QueenBeeMode): string {
  switch (mode) {
    case 'LISTENING': return 'bg-blue-400';
    case 'TYPING': return 'bg-honey';
    case 'THINKING': return 'bg-purple-400 animate-pulse';
    case 'CODING': return 'bg-green-400';
    case 'BUILDING': return 'bg-orange-400';
    case 'SUCCESS': return 'bg-mint animate-bounce';
    case 'ERROR': return 'bg-red-500 animate-pulse';
    case 'ALERT': return 'bg-yellow-500 animate-pulse';
    case 'SWARM': return 'bg-honey animate-pulse';
    case 'LOADING': return 'bg-blue-400 animate-spin';
    case 'CURIOUS': return 'bg-purple-300';
    default: return 'bg-gray-400';
  }
}

// Get mode label for tooltip
function getModeLabel(mode: QueenBeeMode): string {
  switch (mode) {
    case 'LISTENING': return 'Listening...';
    case 'TYPING': return 'Typing...';
    case 'THINKING': return 'Thinking...';
    case 'CODING': return 'Coding...';
    case 'BUILDING': return 'Building...';
    case 'SUCCESS': return 'Success!';
    case 'ERROR': return 'Error!';
    case 'ALERT': return 'Attention!';
    case 'SWARM': return 'SWARM Mode';
    case 'LOADING': return 'Loading...';
    case 'CURIOUS': return 'Curious';
    default: return 'Idle';
  }
}

// Get border/glow effect based on mode
function getModeGlow(mode: QueenBeeMode): string {
  switch (mode) {
    case 'ERROR':
      return 'ring-2 ring-red-500/50 ring-offset-2 ring-offset-background';
    case 'ALERT':
      return 'ring-2 ring-yellow-500/50 ring-offset-1 ring-offset-background';
    case 'SUCCESS':
      return 'ring-2 ring-green-500/30 ring-offset-1 ring-offset-background';
    case 'SWARM':
      return 'ring-2 ring-honey/40 ring-offset-1 ring-offset-background';
    case 'LOADING':
      return 'ring-1 ring-blue-400/30';
    default:
      return '';
  }
}

export function FloatingQueenBee() {
  const { 
    mode, 
    config, 
    updatePosition, 
    toggleVisibility, 
    clampPosition,
    errorState,
    clearError,
    isPageLoading,
    lastActivity,
    recentClicks,
  } = useQueenBee();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get current size
  const currentSize = isMobile ? 'sm' : config.size;
  const dimension = SIZE_DIMENSIONS[currentSize];
  const canvasMode = mapToCanvasMode(mode);

  // Handle pointer down - start dragging
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    
    // Capture pointer for smooth dragging
    containerRef.current.setPointerCapture(e.pointerId);
  }, []);

  // Handle pointer move - update position
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Clamp and update position
    const clamped = clampPosition(newX, newY);
    updatePosition(clamped.x, clamped.y);
  }, [isDragging, dragOffset, clampPosition, updatePosition]);

  // Handle pointer up - stop dragging
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    if (containerRef.current) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }, [isDragging]);

  // Show tooltip on mode changes
  useEffect(() => {
    if (mode !== 'IDLE') {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // Don't render if hidden - show small restore button
  if (!config.isVisible) {
    return (
      <Button
        size="icon"
        variant="outline"
        className="fixed bottom-4 right-4 z-[100] w-10 h-10 rounded-full bg-honey/20 border-honey/40 hover:bg-honey/30"
        onClick={toggleVisibility}
        data-testid="button-show-queen-bee"
      >
        <QueenBeeCanvas mode="IDLE" width={24} height={24} />
      </Button>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      className={`fixed z-[100] select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: config.position.x,
        top: config.position.y,
        width: dimension,
        height: dimension,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      animate={{
        scale: isDragging ? 1.1 : 1,
        rotate: mode === 'ERROR' ? [0, -5, 5, -5, 5, 0] : 0,
      }}
      transition={{
        scale: { duration: 0.15 },
        rotate: { duration: 0.5, repeat: mode === 'ERROR' ? Infinity : 0, repeatDelay: 1 },
      }}
      data-testid="floating-queen-bee"
    >
      {/* Main container with glass effect */}
      <div 
        className={`relative w-full h-full rounded-full overflow-hidden 
          bg-background/80 backdrop-blur-sm border-2 
          ${isDragging ? 'border-honey shadow-lg scale-105' : 'border-honey/40 shadow-md'}
          ${getModeGlow(mode)}
          transition-all duration-150`}
      >
        {/* Queen Bee Canvas - Always visible and animated */}
        <div className="absolute inset-0 flex items-center justify-center">
          <QueenBeeCanvas
            mode={canvasMode}
            width={dimension - 8}
            height={dimension - 8}
          />
        </div>

        {/* Error Overlay */}
        <AnimatePresence>
          {mode === 'ERROR' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-500/20 rounded-full flex items-center justify-center"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Spinner Overlay */}
        <AnimatePresence>
          {isPageLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click excitement particles */}
        <AnimatePresence>
          {recentClicks > 2 && (
            <>
              {[...Array(Math.min(recentClicks, 6))].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                  animate={{ 
                    opacity: 0, 
                    scale: 1,
                    x: Math.cos(i * 60 * Math.PI / 180) * 30,
                    y: Math.sin(i * 60 * Math.PI / 180) * 30,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-honey -translate-x-1/2 -translate-y-1/2"
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Drag handle indicator (subtle) */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-30 hover:opacity-60 transition-opacity">
          <GripVertical className="w-3 h-3 text-foreground/50" />
        </div>

        {/* Close/Hide button */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background/90 border border-border/50 
            hover:bg-destructive hover:text-destructive-foreground p-0"
          onClick={(e) => {
            e.stopPropagation();
            toggleVisibility();
          }}
          data-testid="button-hide-queen-bee"
        >
          <X className="w-3 h-3" />
        </Button>

        {/* Mode Indicator Dot */}
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getModeColor(mode)}`}
          title={getModeLabel(mode)}
          data-testid="queen-bee-mode-indicator"
        />
      </div>

      {/* Floating Tooltip */}
      <AnimatePresence>
        {(showTooltip || errorState.hasError) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className={`absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap z-10`}
          >
            {errorState.hasError ? (
              <Badge 
                variant="destructive" 
                className="text-xs cursor-pointer shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  clearError();
                }}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {errorState.message?.slice(0, 30) || 'Error'}
                {(errorState.message?.length || 0) > 30 ? '...' : ''}
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className={`text-xs shadow-sm ${
                  mode === 'SUCCESS' ? 'border-green-500/30 bg-green-500/10 text-green-600' :
                  mode === 'ERROR' ? 'border-red-500/30 bg-red-500/10 text-red-600' :
                  mode === 'SWARM' ? 'border-honey/30 bg-honey/10 text-honey' :
                  'border-border/50'
                }`}
              >
                {getModeLabel(mode)}
              </Badge>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity indicator */}
      <AnimatePresence>
        {lastActivity !== 'idle' && lastActivity !== 'navigating' && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute -top-2 -left-2"
          >
            <span className="text-xs">
              {lastActivity === 'clicking' && '👆'}
              {lastActivity === 'typing' && '⌨️'}
              {lastActivity === 'scrolling' && '📜'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
