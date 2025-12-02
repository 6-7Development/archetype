/**
 * Christmas Decorations Component - Optimized for Performance
 * =========================================================
 * Minimal, aesthetic placement like major websites (Netflix, Apple, Spotify)
 * - Wreaths in corners (partially off-screen)
 * - Sparse bulbs along edges
 * - 4 ornaments max (placed subtly)
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const BULB_COLORS = ['#FF1744', '#2979F3', '#00E676', '#FFD600', '#FF6E40', '#1DE9B6'];

interface ChristmasBulb {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface ChristmasDecorationsProps {
  enabled?: boolean;
  className?: string;
}

// Minimal Christmas Bulb - CSS animation for performance
function ChristmasBulb({ bulb }: { bulb: ChristmasBulb }) {
  const keyframes = `
    @keyframes bulb-flash-${bulb.id} {
      0%, 100% { opacity: 0.4; box-shadow: 0 0 8px ${bulb.color}; }
      50% { opacity: 1; box-shadow: 0 0 16px ${bulb.color}80; }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div
        className="fixed pointer-events-none rounded-full"
        style={{
          left: `${bulb.x}%`,
          top: `${bulb.y}%`,
          width: '6px',
          height: '6px',
          background: bulb.color,
          zIndex: 80,
          animation: `bulb-flash-${bulb.id} 2s infinite ease-in-out`,
        }}
      />
    </>
  );
}

// Corner Wreath - Positioned partially off-screen
function CornerWreath({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const positions = {
    tl: { top: '-20px', left: '-20px', rotate: 0 },
    tr: { top: '-20px', right: '-20px', rotate: 45 },
    bl: { bottom: '-20px', left: '-20px', rotate: -45 },
    br: { bottom: '-20px', right: '-20px', rotate: 90 },
  };

  const pos = positions[corner];

  return (
    <motion.svg
      className="fixed pointer-events-none"
      viewBox="0 0 80 80"
      width="80"
      height="80"
      animate={{ rotate: [pos.rotate, pos.rotate + 5, pos.rotate - 5, pos.rotate] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'ease-in-out' }}
      style={{
        ...pos,
        zIndex: 75,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
      }}
    >
      {/* Wreath circle */}
      <circle cx="40" cy="40" r="32" fill="none" stroke="#22863A" strokeWidth="10" opacity="0.85" />
      <circle cx="40" cy="40" r="36" fill="none" stroke="#2E7D32" strokeWidth="1.5" opacity="0.4" />

      {/* Holly leaves - simplified */}
      <path d="M 40 10 Q 45 12 50 14 Q 48 18 40 20 Q 32 18 30 14 Q 35 12 40 10" fill="#1B5E20" />
      <path d="M 40 70 Q 45 68 50 66 Q 48 62 40 60 Q 32 62 30 66 Q 35 68 40 70" fill="#1B5E20" />
      <path d="M 10 40 Q 12 45 14 50 Q 18 48 20 40 Q 18 32 14 30 Q 12 35 10 40" fill="#1B5E20" />
      <path d="M 70 40 Q 68 45 66 50 Q 62 48 60 40 Q 62 32 66 30 Q 68 35 70 40" fill="#1B5E20" />

      {/* Red berries - 4 points */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <circle
            key={angle}
            cx={40 + 28 * Math.cos(rad)}
            cy={40 + 28 * Math.sin(rad)}
            r="3.5"
            fill="#DC2626"
          />
        );
      })}

      {/* Gold bow at top */}
      <circle cx="40" cy="12" r="6" fill="#FFD700" />
      <rect x="34" y="17" width="2.5" height="8" fill="#FFD700" rx="1" />
      <rect x="46" y="17" width="2.5" height="8" fill="#FFD700" rx="1" />
    </motion.svg>
  );
}

// Floating Ornament - 4 total, positioned in discrete locations
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

  return (
    <motion.div
      className="fixed pointer-events-none"
      style={{ left: pos.x, top: pos.y, zIndex: 75 }}
      animate={{
        y: [0, -8, 0],
        rotate: [0, 360],
      }}
      transition={{
        duration: 4 + index * 0.3,
        delay: index * 0.5,
        repeat: Infinity,
        repeatType: 'reverse',
      }}
    >
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
        {/* Cap */}
        <rect x="8" y="0" width="12" height="3.5" fill="#FFD700" rx="1" />
        {/* Ball */}
        <circle cx="14" cy="18" r="10" fill={color} />
        {/* Shine */}
        <circle cx="11" cy="15" r="2.5" fill="white" opacity="0.3" />
        {/* String */}
        <line x1="14" y1="3.5" x2="14" y2="7" stroke="#FFD700" strokeWidth="0.8" />
      </svg>
    </motion.div>
  );
}

export function ChristmasDecorations({
  enabled = true,
  className = '',
}: ChristmasDecorationsProps) {
  // Generate sparse bulbs along edges only
  const bulbs = useMemo(() => {
    const positions: ChristmasBulb[] = [];

    // Top edge - 7 bulbs spaced out
    for (let i = 0; i < 7; i++) {
      positions.push({
        id: i,
        x: 5 + i * 13,
        y: 2,
        color: BULB_COLORS[i % BULB_COLORS.length],
      });
    }

    // Bottom edge - 7 bulbs spaced out
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

  if (!enabled) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none z-[75] ${className}`}>
      {/* Corner Wreaths */}
      <CornerWreath corner="tl" />
      <CornerWreath corner="tr" />
      <CornerWreath corner="bl" />
      <CornerWreath corner="br" />

      {/* Sparse Bulbs - Top and Bottom edges only */}
      {bulbs.map((bulb) => (
        <ChristmasBulb key={bulb.id} bulb={bulb} />
      ))}

      {/* 4 Ornaments in discrete positions */}
      {[0, 1, 2, 3].map((index) => (
        <FloatingOrnament key={`ornament-${index}`} index={index} />
      ))}
    </div>
  );
}

export default ChristmasDecorations;
