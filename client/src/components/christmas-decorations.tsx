/**
 * Christmas Decorations Component - Optimized Pure CSS
 * Pure CSS animations, no Framer Motion, no string styles
 * Now with obstacle registry support for bee avoidance!
 */

import { useMemo, useEffect, useCallback } from 'react';

const BULB_COLORS = ['#FF1744', '#2979F3', '#00E676', '#FFD600', '#FF6E40', '#1DE9B6'];

export interface DecorationObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'wreath' | 'ornament' | 'bulb';
}

interface ChristmasBulb {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface ChristmasDecorationsProps {
  enabled?: boolean;
  className?: string;
  onObstaclesReady?: (obstacles: DecorationObstacle[]) => void;
  viewportWidth?: number;
  viewportHeight?: number;
}

// Minimal Christmas Bulb - Pure CSS animation
function ChristmasBulb({ bulb }: { bulb: ChristmasBulb }) {
  return (
    <div
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        borderRadius: '50%',
        left: `${bulb.x}%`,
        top: `${bulb.y}%`,
        width: '6px',
        height: '6px',
        background: bulb.color,
        zIndex: 85,
        animation: `bulb-flash-${bulb.id} 2s infinite ease-in-out`,
        boxShadow: `0 0 8px ${bulb.color}`,
      }}
    />
  );
}

// Corner Wreath - CSS animation only
function CornerWreath({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const positions: Record<string, React.CSSProperties> = {
    tl: { top: 0, left: 0 },
    tr: { top: 0, right: 0 },
    bl: { bottom: 0, left: 0 },
    br: { bottom: 0, right: 0 },
  };

  const svgStyle: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: 85,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
    animation: 'wreath-sway 6s infinite ease-in-out',
    transformOrigin: corner.includes('tl') || corner.includes('bl') ? 'top left' : 'top right',
    ...positions[corner],
  };

  return (
    <svg
      style={svgStyle}
      viewBox="0 0 80 80"
      width="80"
      height="80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="40" cy="40" r="32" fill="none" stroke="#22863A" strokeWidth="10" opacity={0.85} />
      <circle cx="40" cy="40" r="36" fill="none" stroke="#2E7D32" strokeWidth="1.5" opacity={0.4} />
      <path d="M 40 10 Q 45 12 50 14 Q 48 18 40 20 Q 32 18 30 14 Q 35 12 40 10" fill="#1B5E20" />
      <path d="M 40 70 Q 45 68 50 66 Q 48 62 40 60 Q 32 62 30 66 Q 35 68 40 70" fill="#1B5E20" />
      <path d="M 10 40 Q 12 45 14 50 Q 18 48 20 40 Q 18 32 14 30 Q 12 35 10 40" fill="#1B5E20" />
      <path d="M 70 40 Q 68 45 66 50 Q 62 48 60 40 Q 62 32 66 30 Q 68 35 70 40" fill="#1B5E20" />
      <circle cx="68" cy="40" r="3.5" fill="#DC2626" />
      <circle cx="40" cy="68" r="3.5" fill="#DC2626" />
      <circle cx="12" cy="40" r="3.5" fill="#DC2626" />
      <circle cx="40" cy="12" r="3.5" fill="#DC2626" />
      <circle cx="40" cy="12" r="6" fill="#FFD700" />
      <rect x="34" y="17" width="2.5" height="8" fill="#FFD700" rx="1" />
      <rect x="46" y="17" width="2.5" height="8" fill="#FFD700" rx="1" />
    </svg>
  );
}

// Floating Ornament - CSS animation
function FloatingOrnament({ index }: { index: number }) {
  const positions = [
    { x: '8%', y: '15%' },
    { x: '92%', y: '12%' },
    { x: '5%', y: '82%' },
    { x: '88%', y: '85%' },
  ];

  const colors = ['#FF1744', '#2979F3', '#00E676', '#FFD600'];
  const pos = positions[index];
  const color = colors[index % colors.length];

  const ornamentStyle: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    left: pos.x,
    top: pos.y,
    zIndex: 85,
    animation: `ornament-bob-${index} 4s infinite reverse`,
  };

  return (
    <div style={ornamentStyle}>
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="0" width="12" height="3.5" fill="#FFD700" rx="1" />
        <circle cx="14" cy="18" r="10" fill={color} />
        <circle cx="11" cy="15" r="2.5" fill="white" opacity={0.3} />
        <line x1="14" y1="3.5" x2="14" y2="7" stroke="#FFD700" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

export function ChristmasDecorations({
  enabled = true,
  className = '',
  onObstaclesReady,
  viewportWidth = 1000,
  viewportHeight = 800,
}: ChristmasDecorationsProps) {
  const bulbs = useMemo(() => {
    const positions: ChristmasBulb[] = [];

    for (let i = 0; i < 7; i++) {
      positions.push({
        id: i,
        x: 5 + i * 13,
        y: 2,
        color: BULB_COLORS[i % BULB_COLORS.length],
      });
    }

    for (let i = 0; i < 7; i++) {
      positions.push({
        id: 7 + i,
        x: 5 + i * 13,
        y: 98,
        color: BULB_COLORS[(i + 2) % BULB_COLORS.length],
      });
    }

    return positions;
  }, []);

  // Calculate and report obstacle positions for bee avoidance
  const calculateObstacles = useCallback((): DecorationObstacle[] => {
    const obstacles: DecorationObstacle[] = [];
    const wreathSize = 80;
    const ornamentWidth = 28;
    const ornamentHeight = 36;

    // Corner wreaths (fixed positions)
    const wreathPositions = [
      { id: 'wreath-tl', x: 0, y: 0 },
      { id: 'wreath-tr', x: viewportWidth - wreathSize, y: 0 },
      { id: 'wreath-bl', x: 0, y: viewportHeight - wreathSize },
      { id: 'wreath-br', x: viewportWidth - wreathSize, y: viewportHeight - wreathSize },
    ];

    wreathPositions.forEach(pos => {
      obstacles.push({
        id: pos.id,
        x: pos.x,
        y: pos.y,
        width: wreathSize,
        height: wreathSize,
        type: 'wreath',
      });
    });

    // Floating ornaments (percentage-based positions)
    const ornamentPositions = [
      { id: 'ornament-0', xPercent: 8, yPercent: 15 },
      { id: 'ornament-1', xPercent: 92, yPercent: 12 },
      { id: 'ornament-2', xPercent: 5, yPercent: 82 },
      { id: 'ornament-3', xPercent: 88, yPercent: 85 },
    ];

    ornamentPositions.forEach(pos => {
      obstacles.push({
        id: pos.id,
        x: (pos.xPercent / 100) * viewportWidth,
        y: (pos.yPercent / 100) * viewportHeight,
        width: ornamentWidth,
        height: ornamentHeight,
        type: 'ornament',
      });
    });

    return obstacles;
  }, [viewportWidth, viewportHeight]);

  // Report obstacles when component mounts or viewport changes
  useEffect(() => {
    if (enabled && onObstaclesReady) {
      const obstacles = calculateObstacles();
      onObstaclesReady(obstacles);
    }
  }, [enabled, onObstaclesReady, calculateObstacles]);

  if (!enabled) return null;

  return (
    <>
      <style>{`
        @keyframes bulb-flash-0 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FF1744; } 50% { opacity: 1; box-shadow: 0 0 16px #FF174480; } }
        @keyframes bulb-flash-1 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FF1744; } 50% { opacity: 1; box-shadow: 0 0 16px #FF174480; } }
        @keyframes bulb-flash-2 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #2979F3; } 50% { opacity: 1; box-shadow: 0 0 16px #2979F380; } }
        @keyframes bulb-flash-3 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #00E676; } 50% { opacity: 1; box-shadow: 0 0 16px #00E67680; } }
        @keyframes bulb-flash-4 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FFD600; } 50% { opacity: 1; box-shadow: 0 0 16px #FFD60080; } }
        @keyframes bulb-flash-5 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FF6E40; } 50% { opacity: 1; box-shadow: 0 0 16px #FF6E4080; } }
        @keyframes bulb-flash-6 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #1DE9B6; } 50% { opacity: 1; box-shadow: 0 0 16px #1DE9B680; } }
        @keyframes bulb-flash-7 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FF1744; } 50% { opacity: 1; box-shadow: 0 0 16px #FF174480; } }
        @keyframes bulb-flash-8 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #2979F3; } 50% { opacity: 1; box-shadow: 0 0 16px #2979F380; } }
        @keyframes bulb-flash-9 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #00E676; } 50% { opacity: 1; box-shadow: 0 0 16px #00E67680; } }
        @keyframes bulb-flash-10 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FFD600; } 50% { opacity: 1; box-shadow: 0 0 16px #FFD60080; } }
        @keyframes bulb-flash-11 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FF6E40; } 50% { opacity: 1; box-shadow: 0 0 16px #FF6E4080; } }
        @keyframes bulb-flash-12 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #1DE9B6; } 50% { opacity: 1; box-shadow: 0 0 16px #1DE9B680; } }
        @keyframes bulb-flash-13 { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px #FF1744; } 50% { opacity: 1; box-shadow: 0 0 16px #FF174480; } }

        @keyframes wreath-sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(5deg); }
        }

        @keyframes ornament-bob-0 { 0%, 100% { transform: translateY(0px) rotateZ(0deg); } 50% { transform: translateY(-8px) rotateZ(180deg); } }
        @keyframes ornament-bob-1 { 0%, 100% { transform: translateY(0px) rotateZ(0deg); } 50% { transform: translateY(-8px) rotateZ(180deg); } }
        @keyframes ornament-bob-2 { 0%, 100% { transform: translateY(0px) rotateZ(0deg); } 50% { transform: translateY(-8px) rotateZ(180deg); } }
        @keyframes ornament-bob-3 { 0%, 100% { transform: translateY(0px) rotateZ(0deg); } 50% { transform: translateY(-8px) rotateZ(180deg); } }
      `}</style>

      <div className={`fixed inset-0 pointer-events-none z-[50] ${className}`}>
        <CornerWreath corner="tl" />
        <CornerWreath corner="tr" />
        <CornerWreath corner="bl" />
        <CornerWreath corner="br" />

        {bulbs.map((bulb) => (
          <ChristmasBulb key={`bulb-${bulb.id}`} bulb={bulb} />
        ))}

        {[0, 1, 2, 3].map((index) => (
          <FloatingOrnament key={`ornament-${index}`} index={index} />
        ))}
      </div>
    </>
  );
}

export default ChristmasDecorations;
