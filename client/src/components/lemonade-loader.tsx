import { useEffect, useState } from "react";
import { LomuIconLogo } from "./lomu-logos-new";

interface LemonadeLoaderProps {
  progress?: number; // 0-100
  size?: "small" | "medium" | "large";
  message?: string;
  className?: string;
  showLogo?: boolean;
}

// Cute loading messages based on progress
const getProgressMessage = (progress: number): string => {
  if (progress < 10) return "Squeezing lemons...";
  if (progress < 20) return "Adding fresh zest...";
  if (progress < 30) return "Pouring pitcher of water...";
  if (progress < 40) return "Stirring with love...";
  if (progress < 50) return "Adding ice cubes...";
  if (progress < 60) return "Garnishing with lemon slices...";
  if (progress < 70) return "Chilling to perfection...";
  if (progress < 80) return "Adding finishing touches...";
  if (progress < 90) return "Taste testing...";
  if (progress < 100) return "Almost refreshing...";
  return "Refreshingly ready!";
};

export function LemonadeLoader({
  progress = 0,
  size = "medium",
  message,
  className = "",
  showLogo = true,
}: LemonadeLoaderProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [bubbles, setBubbles] = useState<{ id: number; x: number; delay: number; duration: number }[]>([]);

  const sizeMap = {
    small: 120,
    medium: 200,
    large: 280,
  };

  const jarSize = sizeMap[size];

  // Animate progress smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedProgress((prev) => {
        if (prev < progress) {
          return Math.min(prev + 1, progress);
        }
        return prev;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [progress]);

  // Generate bubble particles
  useEffect(() => {
    const newBubbles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 40, // Random x position within jar
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 1.5,
    }));
    setBubbles(newBubbles);
  }, []);

  // Calculate liquid fill height
  const fillHeight = (animatedProgress / 100) * 60; // Max 60% of jar height

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Icon Logo */}
      {showLogo && (
        <div className="mb-2">
          <LomuIconLogo size={Math.min(jarSize * 0.4, 80)} />
        </div>
      )}
      
      {/* SVG Lemonade Jar */}
      <svg
        width={jarSize}
        height={jarSize}
        viewBox="0 0 100 100"
        className="overflow-visible"
      >
        <defs>
          {/* Lemonade gradient */}
          <linearGradient id="lemonade-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="hsl(50, 98%, 58%)" stopOpacity="0.95" />
            <stop offset="50%" stopColor="hsl(50, 98%, 65%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(50, 98%, 72%)" stopOpacity="0.85" />
          </linearGradient>

          {/* Glass shine gradient */}
          <linearGradient id="glass-shine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.4)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.1)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </linearGradient>

          {/* Ice cube pattern */}
          <pattern id="ice-texture" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="rgba(255, 255, 255, 0.1)" />
            <path d="M0,0 L4,4 M4,0 L0,4" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Jar body (glass container) */}
        <g className="jar-container">
          {/* Jar outline */}
          <path
            d="M 35 25 L 38 30 L 38 75 Q 38 80 43 80 L 57 80 Q 62 80 62 75 L 62 30 L 65 25 Z"
            fill="rgba(255, 255, 255, 0.15)"
            stroke="hsl(210, 14%, 24%)"
            strokeWidth="1.5"
            className="jar-glass"
          />

          {/* Lemonade liquid (animated fill) */}
          <path
            d={`M 38 ${80 - fillHeight} L 38 75 Q 38 80 43 80 L 57 80 Q 62 80 62 75 L 62 ${80 - fillHeight} Z`}
            fill="url(#lemonade-gradient)"
            opacity={fillHeight > 0 ? 1 : 0}
            className="transition-all duration-300"
          />

          {/* Bubbles */}
          {bubbles.map((bubble) => (
            <circle
              key={bubble.id}
              cx={bubble.x}
              cy="75"
              r="1.5"
              fill="rgba(255, 255, 255, 0.6)"
              opacity={fillHeight > 10 ? 1 : 0}
            >
              <animate
                attributeName="cy"
                from="75"
                to={`${80 - fillHeight}`}
                dur={`${bubble.duration}s`}
                begin={`${bubble.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.6;0"
                dur={`${bubble.duration}s`}
                begin={`${bubble.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}

          {/* Ice cubes (appear when >20% filled) */}
          {fillHeight > 20 && (
            <>
              <rect
                x="42"
                y={`${72 - fillHeight * 0.7}`}
                width="6"
                height="6"
                fill="url(#ice-texture)"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="0.5"
                rx="1"
                className="ice-cube"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 45 ${72 - fillHeight * 0.7}`}
                  to={`360 45 ${72 - fillHeight * 0.7}`}
                  dur="20s"
                  repeatCount="indefinite"
                />
              </rect>
              <rect
                x="52"
                y={`${70 - fillHeight * 0.5}`}
                width="5"
                height="5"
                fill="url(#ice-texture)"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="0.5"
                rx="1"
                className="ice-cube"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 54.5 ${70 - fillHeight * 0.5}`}
                  to={`-360 54.5 ${70 - fillHeight * 0.5}`}
                  dur="25s"
                  repeatCount="indefinite"
                />
              </rect>
            </>
          )}

          {/* Lemon slice garnish (when >50% filled) */}
          {fillHeight > 50 && (
            <g className="lemon-slice" opacity="0.9">
              <circle cx="50" cy={`${75 - fillHeight * 0.8}`} r="4" fill="hsl(50, 98%, 65%)" />
              <circle cx="50" cy={`${75 - fillHeight * 0.8}`} r="3" fill="hsl(50, 98%, 75%)" />
              {/* Lemon segments */}
              <path
                d={`M 50 ${75 - fillHeight * 0.8 - 3} L 50 ${75 - fillHeight * 0.8 + 3}`}
                stroke="hsl(50, 98%, 50%)"
                strokeWidth="0.5"
              />
              <path
                d={`M ${50 - 3} ${75 - fillHeight * 0.8} L ${50 + 3} ${75 - fillHeight * 0.8}`}
                stroke="hsl(50, 98%, 50%)"
                strokeWidth="0.5"
              />
            </g>
          )}

          {/* Glass shine effect */}
          <ellipse
            cx="45"
            cy="45"
            rx="8"
            ry="25"
            fill="url(#glass-shine)"
            opacity="0.6"
            className="glass-shine"
          />

          {/* Jar rim */}
          <ellipse
            cx="50"
            cy="25"
            rx="15"
            ry="3"
            fill="rgba(255, 255, 255, 0.2)"
            stroke="hsl(210, 14%, 24%)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="50"
            cy="25"
            rx="12"
            ry="2"
            fill="rgba(255, 255, 255, 0.1)"
          />
        </g>

        {/* Straw (optional decoration) */}
        <g className="straw" opacity="0.8">
          <rect
            x="58"
            y="15"
            width="3"
            height="35"
            fill="hsl(0, 80%, 60%)"
            stroke="hsl(0, 70%, 50%)"
            strokeWidth="0.5"
            rx="1.5"
          />
          <rect
            x="58"
            y="15"
            width="1"
            height="35"
            fill="rgba(255, 255, 255, 0.4)"
          />
          {/* Bendy straw part */}
          <path
            d="M 59.5 18 Q 65 18 65 23"
            fill="none"
            stroke="hsl(0, 80%, 60%)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* Progress text */}
      <div className="text-center space-y-1">
        <div className="text-2xl font-bold text-primary">
          {Math.round(animatedProgress)}%
        </div>
        <div className="text-sm text-muted-foreground font-medium">
          {message || getProgressMessage(animatedProgress)}
        </div>
      </div>

      {/* Sparkles when complete - SVG stars instead of emoji */}
      {animatedProgress >= 100 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <svg
              key={i}
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute animate-ping"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: "1s",
                left: `${50 + Math.cos((i * Math.PI * 2) / 6) * 40}%`,
                top: `${50 + Math.sin((i * Math.PI * 2) / 6) * 40}%`,
              }}
            >
              <path
                d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z"
                fill="hsl(50, 98%, 58%)"
                opacity="0.8"
              />
            </svg>
          ))}
        </div>
      )}
    </div>
  );
}
