/**
 * Floating Queen Bee Component - Enhanced with Woosh & Worker Bee Effects
 * ========================================================================
 * A draggable, persistent queen bee that floats across all pages.
 * - Woosh trail effect when dragging
 * - Worker bees that chase the mouse (attacking animation)
 * - Expressive emotional reactions to user actions
 * - Error and success animations
 * - Fully CSS-driven animations for performance
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { QueenBeeCanvas, BeeMode } from './queen-bee-canvas';
import { useQueenBee, SIZE_DIMENSIONS, QueenBeeMode } from '@/contexts/queen-bee-context';
import { X, GripVertical, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
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
      return 'IDLE';
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
      return 'SWARM';
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

// Worker bee component that chases the mouse
interface WorkerBeeProps {
  id: number;
  targetX: number;
  targetY: number;
  queenX: number;
  queenY: number;
  isChasing: boolean;
}

function WorkerBee({ id, targetX, targetY, queenX, queenY, isChasing }: WorkerBeeProps) {
  const [pos, setPos] = useState({ x: queenX, y: queenY });
  const delay = id * 50; // Stagger the workers
  
  useEffect(() => {
    if (!isChasing) {
      // Return to queen when not chasing
      const timer = setTimeout(() => {
        setPos({ x: queenX, y: queenY });
      }, delay);
      return () => clearTimeout(timer);
    }
    
    // Chase the target with some randomness
    const timer = setTimeout(() => {
      const angle = Math.random() * Math.PI * 2;
      const spread = 20 + Math.random() * 30;
      setPos({
        x: targetX + Math.cos(angle) * spread,
        y: targetY + Math.sin(angle) * spread,
      });
    }, delay);
    
    return () => clearTimeout(timer);
  }, [targetX, targetY, queenX, queenY, isChasing, delay]);

  return (
    <motion.div
      className="fixed pointer-events-none z-[99]"
      animate={{
        left: pos.x - 6,
        top: pos.y - 6,
        scale: isChasing ? [1, 1.2, 1] : 1,
        rotate: isChasing ? [0, 10, -10, 0] : 0,
      }}
      transition={{
        type: 'spring',
        stiffness: 150 - id * 10,
        damping: 15 + id * 2,
        mass: 0.5 + id * 0.1,
      }}
    >
      <div 
        className={`w-3 h-3 rounded-full bg-gradient-to-br from-honey to-amber-600 
          shadow-sm border border-amber-700/30
          ${isChasing ? 'animate-pulse' : ''}`}
        style={{
          boxShadow: isChasing 
            ? '0 0 8px rgba(247, 181, 0, 0.6), 0 0 16px rgba(247, 181, 0, 0.3)' 
            : '0 1px 2px rgba(0,0,0,0.2)',
        }}
      >
        {/* Tiny wings */}
        <div className="absolute -left-1 top-0.5 w-1.5 h-1 bg-white/60 rounded-full transform -rotate-45" />
        <div className="absolute -right-1 top-0.5 w-1.5 h-1 bg-white/60 rounded-full transform rotate-45" />
      </div>
    </motion.div>
  );
}

// Woosh trail particle
interface WooshParticle {
  id: number;
  x: number;
  y: number;
  timestamp: number;
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMouseNearBee, setIsMouseNearBee] = useState(false);
  const [wooshTrail, setWooshTrail] = useState<WooshParticle[]>([]);
  const [dragVelocity, setDragVelocity] = useState({ x: 0, y: 0 });
  const [lastDragPos, setLastDragPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wooshIdRef = useRef(0);
  
  // Worker bees configuration
  const NUM_WORKERS = 6;
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track mouse position globally
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      
      // Check if mouse is near the bee
      const beeCenter = {
        x: config.position.x + dimension / 2,
        y: config.position.y + dimension / 2,
      };
      const distance = Math.sqrt(
        Math.pow(e.clientX - beeCenter.x, 2) + 
        Math.pow(e.clientY - beeCenter.y, 2)
      );
      setIsMouseNearBee(distance < 150);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [config.position]);

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
    setLastDragPos({ x: e.clientX, y: e.clientY });
    
    // Capture pointer for smooth dragging
    containerRef.current.setPointerCapture(e.pointerId);
  }, []);

  // Handle pointer move - update position with woosh effect
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Calculate velocity for woosh effect
    const vx = e.clientX - lastDragPos.x;
    const vy = e.clientY - lastDragPos.y;
    setDragVelocity({ x: vx, y: vy });
    setLastDragPos({ x: e.clientX, y: e.clientY });
    
    // Add woosh particles based on velocity
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > 5) {
      const newParticle: WooshParticle = {
        id: wooshIdRef.current++,
        x: config.position.x + dimension / 2,
        y: config.position.y + dimension / 2,
        timestamp: Date.now(),
      };
      setWooshTrail(prev => [...prev.slice(-15), newParticle]);
    }
    
    // Clamp and update position
    const clamped = clampPosition(newX, newY);
    updatePosition(clamped.x, clamped.y);
  }, [isDragging, dragOffset, clampPosition, updatePosition, lastDragPos, config.position, dimension]);

  // Handle pointer up - stop dragging
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragVelocity({ x: 0, y: 0 });
    
    if (containerRef.current) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }, [isDragging]);

  // Clean up old woosh particles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setWooshTrail(prev => prev.filter(p => now - p.timestamp < 500));
    }, 100);
    return () => clearInterval(interval);
  }, []);

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

  const queenCenterX = config.position.x + dimension / 2;
  const queenCenterY = config.position.y + dimension / 2;

  return (
    <>
      {/* Woosh Trail Effect */}
      <AnimatePresence>
        {wooshTrail.map((particle, index) => (
          <motion.div
            key={particle.id}
            className="fixed pointer-events-none z-[98]"
            initial={{ 
              left: particle.x - 4, 
              top: particle.y - 4, 
              opacity: 0.8,
              scale: 1,
            }}
            animate={{ 
              opacity: 0,
              scale: 0.3,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div 
              className="w-2 h-2 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(247,181,0,0.8) 0%, rgba(247,181,0,0) 70%)`,
                boxShadow: '0 0 8px rgba(247,181,0,0.5)',
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Speed Lines when dragging fast */}
      <AnimatePresence>
        {isDragging && Math.abs(dragVelocity.x) + Math.abs(dragVelocity.y) > 15 && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={`speedline-${i}`}
                className="fixed pointer-events-none z-[97]"
                style={{
                  left: queenCenterX - dragVelocity.x * (i + 1) * 0.5,
                  top: queenCenterY - dragVelocity.y * (i + 1) * 0.5,
                }}
                initial={{ opacity: 0.6 - i * 0.1, scale: 1 - i * 0.15 }}
                animate={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.3 }}
              >
                <div 
                  className="w-4 h-1 bg-gradient-to-r from-honey/60 to-transparent rounded-full"
                  style={{
                    transform: `rotate(${Math.atan2(dragVelocity.y, dragVelocity.x) * 180 / Math.PI}deg)`,
                  }}
                />
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Worker Bees that chase the mouse */}
      {!isMobile && (
        <>
          {[...Array(NUM_WORKERS)].map((_, i) => (
            <WorkerBee
              key={i}
              id={i}
              targetX={mousePos.x}
              targetY={mousePos.y}
              queenX={queenCenterX}
              queenY={queenCenterY}
              isChasing={isDragging || isMouseNearBee}
            />
          ))}
        </>
      )}

      {/* Main Queen Bee Container */}
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
          scale: isDragging ? 1.15 : isMouseNearBee ? 1.05 : 1,
          rotate: mode === 'ERROR' ? [0, -8, 8, -8, 8, 0] : isDragging ? dragVelocity.x * 0.5 : 0,
        }}
        transition={{
          scale: { type: 'spring', stiffness: 400, damping: 25 },
          rotate: { duration: 0.5, repeat: mode === 'ERROR' ? Infinity : 0, repeatDelay: 1 },
        }}
        data-testid="floating-queen-bee"
      >
        {/* Glow effect when dragging */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              className="absolute inset-0 rounded-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.3 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                background: 'radial-gradient(circle, rgba(247,181,0,0.4) 0%, transparent 70%)',
                filter: 'blur(8px)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Main container with glass effect */}
        <div 
          className={`relative w-full h-full rounded-full overflow-hidden 
            bg-background/80 backdrop-blur-sm border-2 
            ${isDragging ? 'border-honey shadow-xl scale-105' : 'border-honey/40 shadow-md'}
            ${getModeGlow(mode)}
            transition-all duration-150`}
          style={{
            boxShadow: isDragging 
              ? '0 0 30px rgba(247,181,0,0.5), 0 10px 40px rgba(0,0,0,0.3)' 
              : undefined,
          }}
        >
          {/* Queen Bee Canvas - Always visible and animated */}
          <div className="absolute inset-0 flex items-center justify-center">
            <QueenBeeCanvas
              mode={canvasMode}
              width={dimension - 8}
              height={dimension - 8}
            />
          </div>

          {/* Sparkle effect when excited (many clicks) */}
          <AnimatePresence>
            {recentClicks > 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Sparkles className="w-4 h-4 text-honey animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Overlay */}
          <AnimatePresence>
            {mode === 'ERROR' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="absolute inset-0 bg-red-500/30 rounded-full flex items-center justify-center"
              >
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Celebration */}
          <AnimatePresence>
            {mode === 'SUCCESS' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-mint"
                    animate={{
                      x: [0, Math.cos(i * 45 * Math.PI / 180) * 25],
                      y: [0, Math.sin(i * 45 * Math.PI / 180) * 25],
                      opacity: [1, 0],
                      scale: [1, 0.5],
                    }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading Spinner Overlay */}
          <AnimatePresence>
            {isPageLoading && (
              <motion.div
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 1, repeat: Infinity, ease: 'linear' } }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <RefreshCw className="w-4 h-4 text-blue-400" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* SWARM Mode - Orbiting particles */}
          <AnimatePresence>
            {mode === 'SWARM' && (
              <>
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-honey"
                    style={{
                      left: '50%',
                      top: '50%',
                      marginLeft: -3,
                      marginTop: -3,
                    }}
                    animate={{
                      x: [
                        Math.cos(i * 60 * Math.PI / 180) * 20,
                        Math.cos((i * 60 + 360) * Math.PI / 180) * 20,
                      ],
                      y: [
                        Math.sin(i * 60 * Math.PI / 180) * 20,
                        Math.sin((i * 60 + 360) * Math.PI / 180) * 20,
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                      delay: i * 0.1,
                    }}
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
      </motion.div>

      {/* Floating Tooltip */}
      <AnimatePresence>
        {(showTooltip || errorState.hasError || isDragging) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed z-[101] whitespace-nowrap pointer-events-auto"
            style={{
              left: config.position.x + dimension / 2,
              top: config.position.y + dimension + 10,
              transform: 'translateX(-50%)',
            }}
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
            ) : isDragging ? (
              <Badge 
                variant="outline" 
                className="text-xs shadow-sm border-honey/50 bg-honey/10 text-honey animate-pulse"
              >
                Whoooosh!
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

      {/* Activity indicator emoji */}
      <AnimatePresence>
        {lastActivity !== 'idle' && lastActivity !== 'navigating' && (
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0, rotate: 45 }}
            className="fixed z-[101] pointer-events-none"
            style={{
              left: config.position.x - 8,
              top: config.position.y - 8,
            }}
          >
            <span className="text-sm drop-shadow-md">
              {lastActivity === 'clicking' && '👆'}
              {lastActivity === 'typing' && '⌨️'}
              {lastActivity === 'scrolling' && '📜'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
