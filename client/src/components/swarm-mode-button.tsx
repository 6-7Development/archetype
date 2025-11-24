import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Activity } from 'lucide-react';

interface SwarmModeButtonProps {
  onActivate?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * SWARM Mode Button - Parallel Multi-Agent Execution
 * Activates parallel multi-agent execution (I AM Architect + sub-agents)
 * Uses bee/swarm theme with animated activity indicators
 */
export function SwarmModeButton({
  onActivate,
  isActive = false,
  disabled = false,
  'data-testid': dataTestId = 'button-swarm-mode',
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
        variant={isActive ? 'default' : 'outline'}
        className="gap-2 relative"
        data-testid={dataTestId}
      >
        {/* Animated indicators during activation */}
        {isAnimating && (
          <>
            <Activity className="absolute top-2 left-3 h-4 w-4 animate-pulse text-amber-500" />
            <Activity className="absolute top-3 right-4 h-4 w-4 animate-pulse text-amber-500" style={{ animationDelay: '0.2s' }} />
            <Activity className="absolute top-4 left-1/2 h-4 w-4 animate-pulse text-amber-500" style={{ animationDelay: '0.4s' }} />
          </>
        )}

        {/* Main icon */}
        <Zap className={`h-5 w-5 ${isActive ? 'text-amber-500' : ''}`} />
        <span className="font-semibold">SWARM</span>

        {/* Status badge */}
        <Badge
          variant={isActive ? 'secondary' : 'outline'}
          data-testid="badge-swarm-status"
        >
          {isActive ? 'Active' : 'Ready'}
        </Badge>
      </Button>
    </div>
  );
}

/**
 * Animated Activity Visualization for parallel execution
 * Shows during parallel execution to indicate multiple agents working
 */
export function SwarmVisualization() {
  const indicators = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {indicators.map((i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${10 + i * 10}%`,
            top: `${20 + (i % 3) * 30}%`,
            animation: `swarm-flight ${3 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        >
          <Activity className="h-6 w-6 text-amber-500" />
        </div>
      ))}

      <style>{`
        @keyframes swarm-flight {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          25% { opacity: 0.8; }
          50% { transform: translate(50px, -30px) rotate(180deg); }
          75% { opacity: 0.8; }
          100% { transform: translate(0, 0) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
