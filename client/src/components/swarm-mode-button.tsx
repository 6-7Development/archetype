import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

interface SwarmModeButtonProps {
  onActivate?: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

/**
 * SWARM Mode Button - Replace ⚡ FAST with 🐝 SWARM
 * Activates parallel multi-agent execution (I AM Architect + sub-agents)
 * Uses beehive theme with animated bee swarm effect
 */
export function SwarmModeButton({
  onActivate,
  isActive = false,
  disabled = false,
}: SwarmModeButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    onActivate?.();
    setTimeout(() => setIsAnimating(false), 1500);
  };

  return (
    <div className="relative inline-block">
      <Button
        onClick={handleClick}
        disabled={disabled}
        className={`relative gap-2 transition-all ${
          isActive
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600'
        }`}
        data-testid="button-swarm-mode"
      >
        {/* Bee Swarm Animation */}
        {isAnimating && (
          <>
            <span className="absolute top-0 left-2 text-lg animate-bounce">🐝</span>
            <span className="absolute top-1 right-3 text-lg animate-bounce" style={{ animationDelay: '0.2s' }}>
              🐝
            </span>
            <span className="absolute top-3 left-1/2 text-lg animate-bounce" style={{ animationDelay: '0.4s' }}>
              🐝
            </span>
          </>
        )}

        {/* Static bee icon */}
        <span className="text-lg">🐝</span>
        <span className="font-semibold">SWARM</span>

        {/* Status badge */}
        <Badge
          variant={isActive ? 'secondary' : 'outline'}
          className={`ml-1 ${isActive ? 'bg-white/30 text-white' : ''}`}
          data-testid="badge-swarm-status"
        >
          {isActive ? 'Active' : 'Ready'}
        </Badge>
      </Button>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        Launch parallel I AM Architect + sub-agents for 2.5-3.2x speedup
      </div>
    </div>
  );
}

/**
 * Animated Bee Swarm Component for visual feedback
 * Shows during parallel execution
 */
export function SwarmVisualization() {
  const bees = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {bees.map((i) => (
        <div
          key={i}
          className="absolute text-2xl animate-pulse"
          style={{
            left: `${10 + i * 10}%`,
            top: `${20 + (i % 3) * 30}%`,
            animation: `swarm-flight ${3 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        >
          🐝
        </div>
      ))}

      <style>{`
        @keyframes swarm-flight {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          25% { opacity: 1; }
          50% { transform: translate(50px, -30px) rotate(180deg); }
          75% { opacity: 1; }
          100% { transform: translate(0, 0) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
