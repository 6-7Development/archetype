/**
 * Christmas Decorations - Dynamic SVG-based system
 * Features:
 * - Realistic SVG icicles that can hang from any element
 * - Configurable ornaments with multiple styles
 * - Easy to edit density, colors, and placement
 * - Performance optimized with CSS animations
 */

import { useMemo, useEffect, useCallback, useRef } from 'react';

// ============================================
// CONFIGURATION - Easy to edit these values!
// ============================================
export const CHRISTMAS_CONFIG = {
  // Icicle settings
  icicles: {
    enabled: true,
    density: 12,           // Number of icicles per row
    minLength: 15,         // Minimum icicle length in px
    maxLength: 45,         // Maximum icicle length in px
    minWidth: 3,           // Minimum icicle width at top
    maxWidth: 8,           // Maximum width at top
    colors: {
      primary: '#E3F2FD',  // Light ice blue
      highlight: '#FFFFFF', // White highlight
      shadow: '#B3E5FC',   // Darker ice blue
    },
    drip: true,            // Animated drip effect
  },
  // Ornament settings
  ornaments: {
    enabled: true,
    count: 6,              // Number of floating ornaments
    colors: ['#DC2626', '#2563EB', '#16A34A', '#EAB308', '#9333EA', '#F97316'],
    sizes: [24, 28, 32],   // Available sizes
    twinkle: true,         // Twinkle animation
  },
  // Light string settings
  lights: {
    enabled: true,
    count: 14,             // Number of lights in string
    colors: ['#FF1744', '#2979F3', '#00E676', '#FFD600', '#FF6E40', '#1DE9B6'],
    glow: true,
  },
  // Corner wreaths
  wreaths: {
    enabled: true,
    size: 70,
    corners: ['tl', 'tr'] as const, // Which corners to decorate
  },
};

// ============================================
// SVG ICICLE COMPONENT
// ============================================
interface IcicleProps {
  length: number;
  width: number;
  offsetX: number;
  delay: number;
  index: number;
}

function Icicle({ length, width, offsetX, delay, index }: IcicleProps) {
  const { colors, drip } = CHRISTMAS_CONFIG.icicles;
  
  return (
    <svg
      width={width + 4}
      height={length + 8}
      viewBox={`0 0 ${width + 4} ${length + 8}`}
      style={{
        position: 'absolute',
        left: offsetX - width / 2,
        top: -2,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.1))',
        animation: drip ? `icicle-drip ${3 + delay}s ease-in-out infinite ${delay}s` : undefined,
      }}
    >
      <defs>
        <linearGradient id={`ice-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.shadow} stopOpacity="0.8" />
          <stop offset="30%" stopColor={colors.primary} stopOpacity="0.95" />
          <stop offset="50%" stopColor={colors.highlight} stopOpacity="1" />
          <stop offset="70%" stopColor={colors.primary} stopOpacity="0.95" />
          <stop offset="100%" stopColor={colors.shadow} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path
        d={`
          M ${width / 2 + 2} 0
          Q ${width + 2} 2, ${width + 1} ${length * 0.3}
          Q ${width} ${length * 0.6}, ${width / 2 + 2} ${length}
          Q 4 ${length * 0.6}, 3 ${length * 0.3}
          Q 2 2, ${width / 2 + 2} 0
          Z
        `}
        fill={`url(#ice-grad-${index})`}
      />
      <ellipse
        cx={width / 2 + 2}
        cy={length - 2}
        rx={2}
        ry={3}
        fill={colors.highlight}
        opacity={0.6}
      />
    </svg>
  );
}

// ============================================
// ICICLE ROW COMPONENT
// ============================================
interface IcicleRowProps {
  width: number;
  className?: string;
}

export function IcicleRow({ width, className = '' }: IcicleRowProps) {
  const { density, minLength, maxLength, minWidth, maxWidth } = CHRISTMAS_CONFIG.icicles;
  
  const icicles = useMemo(() => {
    const result = [];
    const spacing = width / density;
    
    for (let i = 0; i < density; i++) {
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      const rand = seed - Math.floor(seed);
      
      result.push({
        id: i,
        length: minLength + rand * (maxLength - minLength),
        width: minWidth + rand * (maxWidth - minWidth),
        offsetX: spacing * i + spacing / 2,
        delay: rand * 2,
      });
    }
    return result;
  }, [width, density, minLength, maxLength, minWidth, maxWidth]);
  
  if (!CHRISTMAS_CONFIG.icicles.enabled) return null;
  
  return (
    <div 
      className={`relative pointer-events-none ${className}`}
      style={{ width, height: maxLength + 10 }}
    >
      {icicles.map((icicle) => (
        <Icicle
          key={icicle.id}
          index={icicle.id}
          length={icicle.length}
          width={icicle.width}
          offsetX={icicle.offsetX}
          delay={icicle.delay}
        />
      ))}
    </div>
  );
}

// ============================================
// ORNAMENT COMPONENT
// ============================================
interface OrnamentProps {
  x: string;
  y: string;
  size: number;
  color: string;
  index: number;
}

function Ornament({ x, y, size, color, index }: OrnamentProps) {
  const { twinkle } = CHRISTMAS_CONFIG.ornaments;
  
  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 85,
        pointerEvents: 'none',
        animation: twinkle ? `ornament-swing ${4 + index * 0.5}s ease-in-out infinite` : undefined,
        transformOrigin: 'top center',
      }}
    >
      <svg 
        width={size} 
        height={size * 1.4} 
        viewBox="0 0 28 40"
      >
        <defs>
          <radialGradient id={`ornament-grad-${index}`} cx="30%" cy="30%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="40%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </radialGradient>
        </defs>
        <rect x="10" y="0" width="8" height="5" fill="#C9A227" rx="1" />
        <circle cx="14" cy="4" r="3" fill="#FFD700" />
        <line x1="14" y1="5" x2="14" y2="10" stroke="#888" strokeWidth="1" />
        <circle cx="14" cy="24" r="13" fill={`url(#ornament-grad-${index})`} />
        <ellipse cx="10" cy="20" rx="3" ry="4" fill="white" opacity="0.3" />
      </svg>
    </div>
  );
}

// ============================================
// LIGHT STRING COMPONENT
// ============================================
function LightString() {
  const { count, colors, glow } = CHRISTMAS_CONFIG.lights;
  
  if (!CHRISTMAS_CONFIG.lights.enabled) return null;
  
  const lights = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 3 + (i * 94) / (count - 1),
      y: 1.5 + Math.sin(i * 0.8) * 0.8,
      color: colors[i % colors.length],
    }));
  }, [count, colors]);
  
  return (
    <>
      <svg
        className="fixed top-0 left-0 w-full h-8 pointer-events-none z-[85]"
        preserveAspectRatio="none"
      >
        <path
          d={`M 0,8 ${lights.map(l => `Q ${l.x - 3}%,${l.y + 2}% ${l.x}%,${l.y + 1.5}%`).join(' ')} L 100%,8`}
          fill="none"
          stroke="#333"
          strokeWidth="2"
        />
      </svg>
      {lights.map((light) => (
        <div
          key={light.id}
          style={{
            position: 'fixed',
            left: `${light.x}%`,
            top: `${light.y}%`,
            width: 10,
            height: 14,
            borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
            background: light.color,
            zIndex: 86,
            pointerEvents: 'none',
            boxShadow: glow ? `0 0 8px ${light.color}, 0 0 12px ${light.color}80` : undefined,
            animation: `light-twinkle ${1.5 + (light.id % 3) * 0.5}s ease-in-out infinite ${light.id * 0.2}s`,
            transform: 'translateX(-50%)',
          }}
        />
      ))}
    </>
  );
}

// ============================================
// CORNER WREATH COMPONENT
// ============================================
function CornerWreath({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const { size } = CHRISTMAS_CONFIG.wreaths;
  
  const positions: Record<string, React.CSSProperties> = {
    tl: { top: 0, left: 0 },
    tr: { top: 0, right: 0 },
    bl: { bottom: 0, left: 0 },
    br: { bottom: 0, right: 0 },
  };

  return (
    <svg
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 85,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
        animation: 'wreath-sway 8s ease-in-out infinite',
        ...positions[corner],
      }}
      viewBox="0 0 80 80"
      width={size}
      height={size}
    >
      <defs>
        <linearGradient id="wreath-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E7D32" />
          <stop offset="100%" stopColor="#1B5E20" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="28" fill="none" stroke="url(#wreath-green)" strokeWidth="12" />
      <circle cx="40" cy="40" r="32" fill="none" stroke="#388E3C" strokeWidth="2" opacity="0.5" />
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = 40 + Math.cos(rad) * 28;
        const y = 40 + Math.sin(rad) * 28;
        const colors = ['#DC2626', '#FFD700', '#DC2626', '#FFD700', '#DC2626', '#FFD700'];
        return <circle key={i} cx={x} cy={y} r={4} fill={colors[i]} />;
      })}
      <path d="M 34 8 L 40 2 L 46 8 L 43 8 L 43 15 L 37 15 L 37 8 Z" fill="#FFD700" />
    </svg>
  );
}

// ============================================
// MAIN DECORATIONS COMPONENT
// ============================================
export interface DecorationObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'wreath' | 'ornament' | 'bulb';
}

interface ChristmasDecorationsProps {
  enabled?: boolean;
  className?: string;
  onObstaclesReady?: (obstacles: DecorationObstacle[]) => void;
  viewportWidth?: number;
  viewportHeight?: number;
}

export function ChristmasDecorations({
  enabled = true,
  className = '',
  onObstaclesReady,
  viewportWidth = 1000,
  viewportHeight = 800,
}: ChristmasDecorationsProps) {
  
  const ornaments = useMemo(() => {
    const { count, colors, sizes } = CHRISTMAS_CONFIG.ornaments;
    const positions = [
      { x: '6%', y: '18%' },
      { x: '94%', y: '15%' },
      { x: '4%', y: '75%' },
      { x: '92%', y: '78%' },
      { x: '15%', y: '45%' },
      { x: '85%', y: '50%' },
    ];
    
    return positions.slice(0, count).map((pos, i) => ({
      ...pos,
      color: colors[i % colors.length],
      size: sizes[i % sizes.length],
      index: i,
    }));
  }, []);

  const calculateObstacles = useCallback((): DecorationObstacle[] => {
    const obstacles: DecorationObstacle[] = [];
    const { size: wreathSize, corners } = CHRISTMAS_CONFIG.wreaths;

    corners.forEach((corner, i) => {
      const pos = {
        tl: { x: 0, y: 0 },
        tr: { x: viewportWidth - wreathSize, y: 0 },
        bl: { x: 0, y: viewportHeight - wreathSize },
        br: { x: viewportWidth - wreathSize, y: viewportHeight - wreathSize },
      }[corner];
      
      obstacles.push({
        id: `wreath-${corner}`,
        x: pos.x,
        y: pos.y,
        width: wreathSize,
        height: wreathSize,
        type: 'wreath',
      });
    });

    return obstacles;
  }, [viewportWidth, viewportHeight]);

  useEffect(() => {
    if (enabled && onObstaclesReady) {
      onObstaclesReady(calculateObstacles());
    }
  }, [enabled, onObstaclesReady, calculateObstacles]);

  if (!enabled) return null;

  return (
    <>
      <style>{`
        @keyframes icicle-drip {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.03); }
        }
        
        @keyframes ornament-swing {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        
        @keyframes light-twinkle {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(0.95); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
        }
        
        @keyframes wreath-sway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
      `}</style>

      <div className={`fixed inset-0 pointer-events-none z-[50] overflow-hidden ${className}`}>
        <LightString />
        
        {CHRISTMAS_CONFIG.wreaths.enabled && 
          CHRISTMAS_CONFIG.wreaths.corners.map((corner) => (
            <CornerWreath key={corner} corner={corner} />
          ))
        }

        {CHRISTMAS_CONFIG.ornaments.enabled &&
          ornaments.map((orn) => (
            <Ornament
              key={orn.index}
              x={orn.x}
              y={orn.y}
              size={orn.size}
              color={orn.color}
              index={orn.index}
            />
          ))
        }
      </div>
    </>
  );
}

export default ChristmasDecorations;
