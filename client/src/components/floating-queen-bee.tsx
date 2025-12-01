/**
 * Floating Queen Bee Component
 * ============================
 * A draggable, persistent queen bee that floats across all pages.
 * - Draggable to any position on screen
 * - Stays within viewport bounds (never under headers)
 * - Shows actual QueenBeeCanvas animation at all times
 * - Responsive sizing for mobile/desktop
 * - Shows current AI emotional state
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { QueenBeeCanvas } from './queen-bee-canvas';
import { useQueenBee, SIZE_DIMENSIONS } from '@/contexts/queen-bee-context';
import { X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Get mode indicator color
function getModeColor(mode: string): string {
  switch (mode) {
    case 'LISTENING': return 'bg-blue-400';
    case 'TYPING': return 'bg-honey';
    case 'THINKING': return 'bg-purple-400';
    case 'CODING': return 'bg-green-400';
    case 'BUILDING': return 'bg-orange-400';
    case 'SUCCESS': return 'bg-mint';
    case 'ERROR': return 'bg-red-400';
    case 'SWARM': return 'bg-honey animate-pulse';
    default: return 'bg-gray-400';
  }
}

export function FloatingQueenBee() {
  const { mode, config, updatePosition, toggleVisibility, clampPosition } = useQueenBee();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
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
    <div
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
      data-testid="floating-queen-bee"
    >
      {/* Main container with glass effect */}
      <div 
        className={`relative w-full h-full rounded-full overflow-hidden 
          bg-background/80 backdrop-blur-sm border-2 
          ${isDragging ? 'border-honey shadow-lg scale-105' : 'border-honey/40 shadow-md'}
          transition-all duration-150`}
      >
        {/* Queen Bee Canvas - Always visible and animated */}
        <div className="absolute inset-0 flex items-center justify-center">
          <QueenBeeCanvas
            mode={mode}
            width={dimension - 8}
            height={dimension - 8}
          />
        </div>

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
          title={mode}
          data-testid="queen-bee-mode-indicator"
        />
      </div>
    </div>
  );
}
