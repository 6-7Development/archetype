import { useEffect, useRef, useState } from 'react';

// Concept 1: Animated Lumo Mini - Simplified mascot face
export function LogoLumoMini({ size = 40 }: { size?: number }) {
  const [glow, setGlow] = useState(0);
  
  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.02;
      setGlow(Math.sin(frame) * 0.5 + 0.5);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <defs>
        <radialGradient id="lumo-glow">
          <stop offset="0%" stopColor="hsl(50, 98%, 58%)" stopOpacity={0.8 + glow * 0.2} />
          <stop offset="100%" stopColor="hsl(50, 98%, 48%)" stopOpacity={1} />
        </radialGradient>
      </defs>
      
      {/* Lemon body */}
      <ellipse cx="50" cy="50" rx="35" ry="40" fill="url(#lumo-glow)" />
      
      {/* Shine */}
      <ellipse cx="38" cy="35" rx="12" ry="15" fill="white" opacity="0.4" />
      
      {/* Goggles */}
      <rect x="25" y="40" width="50" height="18" rx="9" fill="#ef4444" opacity="0.9" />
      <circle cx="35" cy="49" r="8" fill="#ffffff" opacity="0.3" />
      <circle cx="65" cy="49" r="8" fill="#ffffff" opacity="0.3" />
      
      {/* Eyes (glowing) */}
      <circle cx="35" cy="49" r="4" fill="#fbbf24" opacity={0.7 + glow * 0.3} />
      <circle cx="65" cy="49" r="4" fill="#fbbf24" opacity={0.7 + glow * 0.3} />
      
      {/* Smile */}
      <path d="M 35 62 Q 50 70 65 62" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Concept 2: Lemon Slice with Code Symbols (Static/Animated)
export function LogoLemonCode({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    if (!animated) return;
    let frame = 0;
    const animate = () => {
      frame += 0.01;
      setRotation(Math.sin(frame) * 5);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [animated]);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <defs>
        <radialGradient id="lemon-gradient">
          <stop offset="0%" stopColor="hsl(50, 98%, 68%)" />
          <stop offset="100%" stopColor="hsl(50, 98%, 48%)" />
        </radialGradient>
      </defs>
      
      <g transform={`rotate(${rotation} 50 50)`}>
        {/* Lemon slice */}
        <circle cx="50" cy="50" r="35" fill="url(#lemon-gradient)" />
        
        {/* Segments */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const x1 = 50;
          const y1 = 50;
          const x2 = 50 + Math.cos((angle * Math.PI) / 180) * 30;
          const y2 = 50 + Math.sin((angle * Math.PI) / 180) * 30;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="white"
              strokeWidth="1.5"
              opacity="0.5"
            />
          );
        })}
        
        {/* Center white circle */}
        <circle cx="50" cy="50" r="8" fill="white" opacity="0.7" />
        
        {/* Rind */}
        <circle cx="50" cy="50" r="35" fill="none" stroke="hsl(50, 90%, 35%)" strokeWidth="3" />
      </g>
      
      {/* Code symbols */}
      <text x="50" y="35" textAnchor="middle" fontSize="16" fill="hsl(210, 14%, 24%)" fontWeight="bold" opacity="0.8">
        &lt;/&gt;
      </text>
    </svg>
  );
}

// Concept 3: Lemonade Glass with Rising Bubbles
export function LogoLemonadeGlass({ size = 40 }: { size?: number }) {
  const [bubbles, setBubbles] = useState<Array<{ id: number; y: number; x: number; size: number }>>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBubbles(prev => {
        const newBubbles = prev
          .map(b => ({ ...b, y: b.y - 1 }))
          .filter(b => b.y > 20);
        
        if (Math.random() > 0.7) {
          newBubbles.push({
            id: nextId.current++,
            y: 75,
            x: 35 + Math.random() * 20,
            size: 2 + Math.random() * 2
          });
        }
        
        return newBubbles;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <defs>
        <linearGradient id="lemonade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(50, 98%, 68%)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(50, 98%, 58%)" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      
      {/* Glass outline */}
      <path
        d="M 35 30 L 30 80 Q 30 85 35 85 L 55 85 Q 60 85 60 80 L 65 30 Z"
        fill="none"
        stroke="hsl(210, 14%, 24%)"
        strokeWidth="2.5"
        opacity="0.3"
      />
      
      {/* Lemonade liquid */}
      <path
        d="M 35 40 L 31 78 Q 31 83 35 83 L 55 83 Q 59 83 59 78 L 63 40 Z"
        fill="url(#lemonade)"
      />
      
      {/* Bubbles */}
      {bubbles.map(bubble => (
        <circle
          key={bubble.id}
          cx={bubble.x}
          cy={bubble.y}
          r={bubble.size}
          fill="white"
          opacity="0.6"
        />
      ))}
      
      {/* Glass shine */}
      <ellipse cx="42" cy="50" rx="4" ry="15" fill="white" opacity="0.3" />
      
      {/* Ice cube */}
      <rect x="38" y="45" width="8" height="8" fill="white" opacity="0.4" rx="1" />
      
      {/* Straw */}
      <rect x="52" y="20" width="3" height="40" fill="#ef4444" opacity="0.8" rx="1.5" />
      <rect x="52" y="20" width="3" height="8" fill="#ef4444" opacity="0.6" rx="1.5" transform="rotate(-30 53.5 20)" />
    </svg>
  );
}

// Concept 4: Citrus Wordmark with Icon
export function LogoCitrusWordmark({ size = 120 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2" style={{ height: size / 3 }}>
      {/* Mini lemon icon */}
      <svg width={size / 3} height={size / 3} viewBox="0 0 100 100" className="shrink-0">
        <defs>
          <radialGradient id="wordmark-lemon">
            <stop offset="0%" stopColor="hsl(50, 98%, 68%)" />
            <stop offset="100%" stopColor="hsl(50, 98%, 48%)" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="50" rx="35" ry="40" fill="url(#wordmark-lemon)" />
        <ellipse cx="38" cy="35" rx="12" ry="15" fill="white" opacity="0.4" />
      </svg>
      
      {/* Wordmark */}
      <span 
        className="font-bold tracking-tight"
        style={{ 
          fontSize: size / 4.5,
          background: 'linear-gradient(135deg, hsl(50, 98%, 58%), hsl(145, 60%, 45%))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}
      >
        LemonAid
      </span>
    </div>
  );
}

// Concept 5: Minimal Lemon Drop (Simple & Clean)
export function LogoLemonDrop({ size = 40 }: { size?: number }) {
  const [pulse, setPulse] = useState(0);
  
  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.015;
      setPulse(Math.sin(frame) * 0.05 + 1);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <defs>
        <linearGradient id="drop-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(50, 98%, 68%)" />
          <stop offset="100%" stopColor="hsl(50, 98%, 48%)" />
        </linearGradient>
      </defs>
      
      {/* Lemon shape - modern teardrop */}
      <path
        d="M 50 20 Q 70 30 70 50 Q 70 75 50 85 Q 30 75 30 50 Q 30 30 50 20 Z"
        fill="url(#drop-gradient)"
        transform={`scale(${pulse} ${pulse}) translate(${(1 - pulse) * 50} ${(1 - pulse) * 50})`}
      />
      
      {/* Shine */}
      <ellipse cx="42" cy="40" rx="8" ry="12" fill="white" opacity="0.5" />
      
      {/* Small leaf on top */}
      <path
        d="M 50 20 Q 45 15 48 12 Q 51 15 50 20"
        fill="hsl(145, 60%, 45%)"
      />
    </svg>
  );
}
