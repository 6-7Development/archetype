import { useEffect, useState } from 'react';

// Enhanced Gradient Badge with Better Color Scheme
export function LogoEnhancedBadge({ size = 40 }: { size?: number }) {
  const [glow, setGlow] = useState(0);
  const [ringRotation, setRingRotation] = useState(0);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.015;
      setGlow(Math.sin(frame) * 0.4 + 0.6);
      setRingRotation(frame * 20); // Slow rotation
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      <defs>
        {/* Enhanced color scheme using LemonAid palette */}
        <radialGradient id="enhanced-badge-outer">
          <stop offset="0%" stopColor="hsl(50, 98%, 70%)" />
          <stop offset="40%" stopColor="hsl(50, 98%, 58%)" />
          <stop offset="100%" stopColor="hsl(50, 92%, 48%)" />
        </radialGradient>
        <radialGradient id="enhanced-badge-inner">
          <stop offset="0%" stopColor="hsl(50, 100%, 78%)" />
          <stop offset="60%" stopColor="hsl(50, 98%, 62%)" />
          <stop offset="100%" stopColor="hsl(50, 95%, 55%)" />
        </radialGradient>
        <linearGradient id="enhanced-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(145, 60%, 50%)" />
          <stop offset="33%" stopColor="hsl(50, 98%, 58%)" />
          <stop offset="66%" stopColor="hsl(32, 94%, 62%)" />
          <stop offset="100%" stopColor="hsl(145, 60%, 50%)" />
        </linearGradient>
        <filter id="enhanced-glow">
          <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="inner-glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Animated outer glow ring */}
      <g transform={`rotate(${ringRotation} 60 60)`}>
        <circle 
          cx="60" 
          cy="60" 
          r="52" 
          fill="none" 
          stroke="url(#enhanced-ring)" 
          strokeWidth="4"
          opacity={glow}
          filter="url(#enhanced-glow)"
        />
      </g>
      
      {/* Badge outer circle */}
      <circle cx="60" cy="60" r="46" fill="url(#enhanced-badge-outer)" />
      
      {/* Inner glowing circle */}
      <circle cx="60" cy="60" r="39" fill="url(#enhanced-badge-inner)" filter="url(#inner-glow)" />
      
      {/* Lemon segment pattern - enhanced */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const x1 = 60;
        const y1 = 60;
        const x2 = 60 + Math.cos((angle * Math.PI) / 180) * 34;
        const y2 = 60 + Math.sin((angle * Math.PI) / 180) * 34;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="white"
            strokeWidth="2.5"
            opacity="0.5"
          />
        );
      })}
      
      {/* Pulsing center circle */}
      <circle 
        cx="60" 
        cy="60" 
        r={18 + glow * 2} 
        fill="white" 
        opacity="0.95"
      />
      
      {/* Code symbol */}
      <text 
        x="60" 
        y="70" 
        textAnchor="middle" 
        fontSize="22" 
        fontWeight="bold" 
        fill="hsl(50, 98%, 48%)"
      >
        &lt;/&gt;
      </text>
      
      {/* Sparkle highlights */}
      {[0, 90, 180, 270].map((angle, i) => {
        const x = 60 + Math.cos((angle * Math.PI) / 180) * 42;
        const y = 60 + Math.sin((angle * Math.PI) / 180) * 42;
        const opacity = (Math.sin(glow * Math.PI * 2 + i) + 1) / 2;
        return (
          <g key={i} opacity={opacity * 0.8}>
            <circle cx={x} cy={y} r="2" fill="white" />
          </g>
        );
      })}
      
      {/* Premium shine overlay */}
      <path
        d="M 42 32 Q 48 26 60 28 Q 72 30 76 38 Q 68 34 60 36 Q 50 38 42 32 Z"
        fill="white"
        opacity="0.6"
      />
    </svg>
  );
}

// Animated Modern Wordmark - Premium Edition
export function LogoAnimatedWordmark({ size = 140, variant = "default" }: { size?: number; variant?: "default" | "compact" }) {
  const [lemonPulse, setLemonPulse] = useState(1);
  const [leafRotation, setLeafRotation] = useState(0);
  const [gradientShift, setGradientShift] = useState(0);
  const [letterWave, setLetterWave] = useState(0);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.01;
      // Lemon squeeze animation
      setLemonPulse(0.96 + Math.sin(frame * 1.2) * 0.04);
      // Leaf gentle sway
      setLeafRotation(Math.sin(frame * 0.8) * 8);
      // Gradient shimmer
      setGradientShift(frame * 30);
      // Letter wave effect
      setLetterWave(frame);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2.5" style={{ height: size / 3.5 }}>
        <svg width={size / 3.5} height={size / 3.5} viewBox="0 0 100 100">
          <defs>
            <radialGradient id="compact-grad">
              <stop offset="0%" stopColor="hsl(50, 98%, 70%)" />
              <stop offset="100%" stopColor="hsl(50, 95%, 52%)" />
            </radialGradient>
          </defs>
          <g transform={`scale(${lemonPulse}) translate(${(1 - lemonPulse) * 50} ${(1 - lemonPulse) * 50})`}>
            <circle cx="50" cy="50" r="42" fill="url(#compact-grad)" />
            <ellipse cx="38" cy="35" rx="12" ry="15" fill="white" opacity="0.5" />
            <text x="50" y="66" textAnchor="middle" fontSize="38" fontWeight="bold" fill="white">
              L
            </text>
          </g>
        </svg>
        <span 
          className="font-bold tracking-tight"
          style={{ 
            fontSize: size / 5.5,
            background: `linear-gradient(135deg, hsl(50, 98%, 58%) ${gradientShift % 100}%, hsl(145, 60%, 45%) ${(gradientShift + 50) % 100}%, hsl(32, 94%, 62%) ${(gradientShift + 100) % 100}%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            backgroundSize: '200% 200%'
          }}
        >
          LemonAid
        </span>
      </div>
    );
  }

  // Calculate wave offsets for each letter
  const getLetterY = (index: number) => {
    return Math.sin(letterWave + index * 0.3) * 2;
  };

  return (
    <div className="flex items-center gap-3" style={{ height: size / 3 }}>
      {/* Animated premium icon */}
      <svg width={size / 3} height={size / 3} viewBox="0 0 100 100" className="shrink-0">
        <defs>
          <linearGradient id="animated-lemon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(50, 98%, 72%)" />
            <stop offset="50%" stopColor="hsl(50, 98%, 60%)" />
            <stop offset="100%" stopColor="hsl(50, 90%, 48%)" />
          </linearGradient>
          <linearGradient id="animated-leaf" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(145, 70%, 58%)" />
            <stop offset="100%" stopColor="hsl(145, 60%, 42%)" />
          </linearGradient>
          <filter id="lemon-shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feFlood floodColor="hsl(50, 60%, 30%)" floodOpacity="0.2"/>
            <feComposite in2="offsetblur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <g 
          transform={`scale(${lemonPulse}) translate(${(1 - lemonPulse) * 50} ${(1 - lemonPulse) * 55})`}
          filter="url(#lemon-shadow)"
        >
          {/* Lemon body with squeeze animation */}
          <ellipse 
            cx="50" 
            cy="55" 
            rx={32 * (1.02 - (lemonPulse - 0.96) * 5)} 
            ry={38 * lemonPulse} 
            fill="url(#animated-lemon)" 
          />
          
          {/* Animated shine */}
          <ellipse 
            cx="38" 
            cy="38" 
            rx={14} 
            ry={18} 
            fill="white" 
            opacity={0.45 + Math.abs(lemonPulse - 1) * 5}
          />
          <ellipse cx="60" cy="50" rx="8" ry="12" fill="white" opacity="0.3" />
          
          {/* Animated leaf cluster with sway */}
          <g transform={`rotate(${leafRotation} 50 15)`}>
            <path d="M 45 20 Q 40 12 43 8 Q 47 10 48 15 Z" fill="url(#animated-leaf)" />
            <path d="M 50 18 Q 48 10 51 6 Q 54 8 54 14 Z" fill="url(#animated-leaf)" opacity="0.9" />
            <path d="M 55 20 Q 56 12 60 10 Q 62 14 59 18 Z" fill="url(#animated-leaf)" opacity="0.85" />
          </g>
        </g>
      </svg>
      
      {/* Animated Wordmark with wave effect */}
      <div className="flex flex-col">
        <div className="flex leading-none" style={{ fontSize: size / 4.5 }}>
          {"LemonAid".split('').map((letter, i) => (
            <span
              key={i}
              className="font-bold inline-block"
              style={{
                transform: `translateY(${getLetterY(i)}px)`,
                background: `linear-gradient(135deg, 
                  hsl(50, 98%, ${58 + Math.sin(letterWave + i * 0.5) * 10}%) 0%, 
                  hsl(145, 60%, ${45 + Math.sin(letterWave + i * 0.5 + 1) * 5}%) 50%, 
                  hsl(32, 94%, ${62 + Math.sin(letterWave + i * 0.5 + 2) * 8}%) 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: i === 4 ? '0.1em' : '-0.02em', // Space before "Aid"
                transition: 'transform 0.3s ease-out'
              }}
            >
              {letter}
            </span>
          ))}
        </div>
        <span 
          className="text-muted-foreground font-medium leading-none mt-1.5"
          style={{ 
            fontSize: size / 14,
            opacity: 0.7 + Math.sin(letterWave * 0.5) * 0.15
          }}
        >
          Code Made Sweet
        </span>
      </div>
    </div>
  );
}

// Side-by-side comparison component
export function LogoComparison({ size = 120 }: { size?: number }) {
  return (
    <div className="flex items-center gap-8 flex-wrap justify-center">
      <div className="text-center">
        <LogoEnhancedBadge size={size} />
        <p className="text-sm text-muted-foreground mt-2">Enhanced Badge</p>
      </div>
      <div className="text-center">
        <LogoAnimatedWordmark size={size * 1.4} />
        <p className="text-sm text-muted-foreground mt-2">Animated Wordmark</p>
      </div>
    </div>
  );
}
