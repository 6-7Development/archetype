/**
 * Floating Queen Bee Component
 * ============================
 * A persistent, draggable queen bee that follows users across all pages.
 * - Responsive sizing for mobile/desktop
 * - Minimizable to stay out of the way
 * - Shows current AI emotional state
 * - Draggable to different corners
 */

import { useState, useEffect } from 'react';
import { QueenBeeCanvas } from './queen-bee-canvas';
import { useQueenBee } from '@/contexts/queen-bee-context';
import { Minimize2, X, Move, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Size configurations for different screen sizes
const SIZE_CONFIG = {
  sm: { width: 48, height: 48, iconSize: 12 },
  md: { width: 80, height: 80, iconSize: 16 },
  lg: { width: 120, height: 120, iconSize: 20 },
};

// Position configurations
const POSITION_CONFIG = {
  'bottom-right': { bottom: 16, right: 16 },
  'bottom-left': { bottom: 16, left: 16 },
  'top-right': { top: 80, right: 16 }, // Account for navbar
  'top-left': { top: 80, left: 16 },
};

// Mode display names and colors for tooltip
const MODE_INFO: Record<string, { label: string; color: string }> = {
  IDLE: { label: 'Ready', color: 'text-muted-foreground' },
  LISTENING: { label: 'Listening...', color: 'text-blue-500' },
  TYPING: { label: 'Responding...', color: 'text-green-500' },
  THINKING: { label: 'Thinking...', color: 'text-purple-500' },
  CODING: { label: 'Coding...', color: 'text-cyan-500' },
  BUILDING: { label: 'Building...', color: 'text-orange-500' },
  SUCCESS: { label: 'Done!', color: 'text-emerald-500' },
  ERROR: { label: 'Oops!', color: 'text-red-500' },
  SWARM: { label: 'Swarming!', color: 'text-yellow-500' },
};

export function FloatingQueenBee() {
  const { mode, config, setConfig, toggleMinimized, toggleVisibility } = useQueenBee();
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-minimize on mobile if not interacting with AI
  useEffect(() => {
    if (isMobile && !config.isMinimized) {
      // Start minimized on mobile for better UX
      const hasBeenShown = sessionStorage.getItem('queenBeeShown');
      if (!hasBeenShown) {
        sessionStorage.setItem('queenBeeShown', 'true');
        // Show for 3 seconds then minimize
        const timer = setTimeout(() => {
          setConfig({ isMinimized: true });
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isMobile, config.isMinimized, setConfig]);

  // Don't render if hidden
  if (!config.isVisible) {
    return (
      <Button
        size="icon"
        variant="outline"
        className="fixed bottom-4 right-4 z-50 w-8 h-8 rounded-full bg-honey/20 border-honey/40 hover:bg-honey/30"
        onClick={toggleVisibility}
        data-testid="button-show-queen-bee"
      >
        <Bug className="w-4 h-4 text-honey" />
      </Button>
    );
  }

  // Get current size based on config and mobile state
  const currentSize = isMobile ? 'sm' : config.size;
  const sizeConfig = SIZE_CONFIG[currentSize];
  const positionConfig = POSITION_CONFIG[config.position];

  // Calculate minimized size
  const minimizedSize = { width: 32, height: 32 };

  // Current dimensions
  const dimensions = config.isMinimized ? minimizedSize : sizeConfig;

  // Mode info for display
  const modeInfo = MODE_INFO[mode] || MODE_INFO.IDLE;

  // Cycle through positions
  const cyclePosition = () => {
    const positions: Array<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'> = [
      'bottom-right', 'bottom-left', 'top-right', 'top-left'
    ];
    const currentIndex = positions.indexOf(config.position);
    const nextIndex = (currentIndex + 1) % positions.length;
    setConfig({ position: positions[nextIndex] });
  };

  // Cycle through sizes
  const cycleSize = () => {
    const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];
    const currentIndex = sizes.indexOf(config.size);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setConfig({ size: sizes[nextIndex] });
  };

  return (
    <div
      className="fixed z-50 transition-all duration-300 ease-out"
      style={{
        ...positionConfig,
        width: dimensions.width,
        height: dimensions.height,
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isDragging && setShowControls(false)}
      onTouchStart={() => setShowControls(true)}
      data-testid="floating-queen-bee"
    >
      {/* Main Queen Bee Container */}
      <div
        className={`relative w-full h-full rounded-full overflow-hidden cursor-pointer transition-all duration-300 ${
          config.isMinimized 
            ? 'bg-honey/30 border border-honey/50 shadow-md' 
            : 'bg-background/80 backdrop-blur-sm border border-honey/30 shadow-lg'
        }`}
        onClick={() => {
          if (config.isMinimized) {
            toggleMinimized();
          }
        }}
      >
        {/* Queen Bee Canvas */}
        {!config.isMinimized && (
          <QueenBeeCanvas
            mode={mode}
            width={dimensions.width}
            height={dimensions.height}
          />
        )}

        {/* Minimized State - Just show a small bee icon */}
        {config.isMinimized && (
          <div className="w-full h-full flex items-center justify-center">
            <Bug className="w-4 h-4 text-honey animate-pulse" />
          </div>
        )}

        {/* Mode Indicator Dot */}
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
            mode === 'ERROR' ? 'bg-red-500' :
            mode === 'SUCCESS' ? 'bg-emerald-500' :
            mode === 'SWARM' ? 'bg-yellow-500 animate-pulse' :
            mode === 'IDLE' ? 'bg-gray-400' :
            'bg-honey animate-pulse'
          }`}
          title={modeInfo.label}
        />
      </div>

      {/* Control Buttons - Show on hover/touch */}
      {showControls && !config.isMinimized && (
        <div 
          className="absolute -top-2 -right-2 flex gap-1 bg-background/90 backdrop-blur-sm rounded-full p-1 border border-border shadow-md"
          onMouseEnter={() => setShowControls(true)}
        >
          {/* Move/Position Button */}
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              cyclePosition();
            }}
            title="Move to different corner"
            data-testid="button-move-queen-bee"
          >
            <Move className="w-3 h-3" />
          </Button>

          {/* Size Toggle (desktop only) */}
          {!isMobile && (
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                cycleSize();
              }}
              title={`Size: ${config.size.toUpperCase()}`}
              data-testid="button-resize-queen-bee"
            >
              <span className="text-[10px] font-bold">{config.size.toUpperCase()}</span>
            </Button>
          )}

          {/* Minimize Button */}
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimized();
            }}
            title="Minimize"
            data-testid="button-minimize-queen-bee"
          >
            <Minimize2 className="w-3 h-3" />
          </Button>

          {/* Hide Button */}
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6 rounded-full text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility();
            }}
            title="Hide queen bee"
            data-testid="button-hide-queen-bee"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Mode Label - Show below when not minimized */}
      {!config.isMinimized && showControls && (
        <div 
          className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap ${modeInfo.color}`}
        >
          {modeInfo.label}
        </div>
      )}
    </div>
  );
}
