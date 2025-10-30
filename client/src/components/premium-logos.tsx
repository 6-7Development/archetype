import { useEffect, useState } from 'react';

// Premium Logo 1: 3D Isometric Lemon with Shadow
export function LogoIsometricLemon({ size = 40 }: { size?: number }) {
  const [hover, setHover] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.01;
      setRotation(hover ? Math.sin(frame) * 3 : 0);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [hover]);

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 120 120" 
      className="shrink-0"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <defs>
        <linearGradient id="lemon-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(50, 98%, 75%)" />
          <stop offset="100%" stopColor="hsl(50, 98%, 58%)" />
        </linearGradient>
        <linearGradient id="lemon-left" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(50, 90%, 48%)" />
          <stop offset="100%" stopColor="hsl(50, 95%, 58%)" />
        </linearGradient>
        <linearGradient id="lemon-right" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(50, 95%, 58%)" />
          <stop offset="100%" stopColor="hsl(50, 85%, 45%)" />
        </linearGradient>
        <filter id="shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="2" dy="4" result="offsetblur"/>
          <feFlood floodColor="hsl(50, 60%, 30%)" floodOpacity="0.3"/>
          <feComposite in2="offsetblur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <g transform={`rotate(${rotation} 60 60)`} filter="url(#shadow)">
        {/* Shadow ellipse */}
        <ellipse cx="60" cy="95" rx="35" ry="8" fill="hsl(50, 60%, 30%)" opacity="0.15" />
        
        {/* Isometric cube-like lemon - Left face */}
        <path
          d="M 60 25 L 35 40 L 35 70 L 60 85 Z"
          fill="url(#lemon-left)"
        />
        
        {/* Isometric cube-like lemon - Right face */}
        <path
          d="M 60 25 L 85 40 L 85 70 L 60 85 Z"
          fill="url(#lemon-right)"
        />
        
        {/* Isometric cube-like lemon - Top face */}
        <path
          d="M 60 25 L 35 40 L 60 48 L 85 40 Z"
          fill="url(#lemon-top)"
        />
        
        {/* Highlights */}
        <ellipse cx="52" cy="45" rx="8" ry="12" fill="white" opacity="0.4" />
        <ellipse cx="68" cy="50" rx="6" ry="8" fill="white" opacity="0.25" />
        
        {/* Code bracket overlay */}
        <text x="60" y="65" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white" opacity="0.9">
          &lt;/&gt;
        </text>
        
        {/* Leaf on top */}
        <path
          d="M 58 22 Q 53 18 55 15 Q 58 12 60 15 Q 62 12 65 15 Q 67 18 62 22 Z"
          fill="hsl(145, 65%, 45%)"
        />
        <path
          d="M 60 15 L 60 22"
          stroke="hsl(145, 55%, 35%)"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

// Premium Logo 2: Gradient Mesh Lemon Badge
export function LogoGradientBadge({ size = 40 }: { size?: number }) {
  const [glow, setGlow] = useState(0);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.02;
      setGlow(Math.sin(frame) * 0.3 + 0.7);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      <defs>
        <radialGradient id="badge-glow">
          <stop offset="0%" stopColor="hsl(50, 98%, 68%)" />
          <stop offset="50%" stopColor="hsl(50, 98%, 58%)" />
          <stop offset="100%" stopColor="hsl(50, 90%, 48%)" />
        </radialGradient>
        <radialGradient id="badge-inner">
          <stop offset="0%" stopColor="hsl(50, 100%, 75%)" />
          <stop offset="100%" stopColor="hsl(50, 95%, 55%)" />
        </radialGradient>
        <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(145, 60%, 50%)" />
          <stop offset="50%" stopColor="hsl(50, 98%, 58%)" />
          <stop offset="100%" stopColor="hsl(32, 94%, 62%)" />
        </linearGradient>
        <filter id="glow-filter">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Outer glow ring */}
      <circle 
        cx="60" 
        cy="60" 
        r="50" 
        fill="none" 
        stroke="url(#ring-gradient)" 
        strokeWidth="3"
        opacity={glow}
        filter="url(#glow-filter)"
      />
      
      {/* Badge circle */}
      <circle cx="60" cy="60" r="45" fill="url(#badge-glow)" />
      
      {/* Inner circle */}
      <circle cx="60" cy="60" r="38" fill="url(#badge-inner)" />
      
      {/* Lemon segments pattern */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const x1 = 60;
        const y1 = 60;
        const x2 = 60 + Math.cos((angle * Math.PI) / 180) * 32;
        const y2 = 60 + Math.sin((angle * Math.PI) / 180) * 32;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="white"
            strokeWidth="2"
            opacity="0.4"
          />
        );
      })}
      
      {/* Center code symbol */}
      <circle cx="60" cy="60" r="18" fill="white" opacity="0.9" />
      <text x="60" y="70" textAnchor="middle" fontSize="20" fontWeight="bold" fill="hsl(50, 98%, 48%)">
        &lt;/&gt;
      </text>
      
      {/* Shine overlay */}
      <path
        d="M 45 35 Q 50 30 60 32 Q 70 34 72 40 Q 65 38 60 40 Q 52 42 45 35 Z"
        fill="white"
        opacity="0.5"
      />
    </svg>
  );
}

// Premium Logo 3: Geometric Abstract Lemon
export function LogoGeometricLemon({ size = 40 }: { size?: number }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.015;
      setScale(0.98 + Math.sin(frame) * 0.02);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      <defs>
        <linearGradient id="geo-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(50, 98%, 68%)" />
          <stop offset="100%" stopColor="hsl(50, 95%, 55%)" />
        </linearGradient>
        <linearGradient id="geo-2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(50, 90%, 48%)" />
          <stop offset="100%" stopColor="hsl(50, 95%, 58%)" />
        </linearGradient>
        <linearGradient id="geo-3" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(50, 100%, 75%)" />
          <stop offset="100%" stopColor="hsl(50, 92%, 52%)" />
        </linearGradient>
      </defs>
      
      <g transform={`scale(${scale}) translate(${(1 - scale) * 60} ${(1 - scale) * 60})`}>
        {/* Geometric hexagon base */}
        <path
          d="M 60 15 L 90 35 L 90 70 L 60 90 L 30 70 L 30 35 Z"
          fill="url(#geo-1)"
          stroke="white"
          strokeWidth="2"
          opacity="0.95"
        />
        
        {/* Inner geometric pattern - triangles */}
        <path d="M 60 15 L 90 35 L 60 52.5 Z" fill="url(#geo-2)" opacity="0.8" />
        <path d="M 90 35 L 90 70 L 60 52.5 Z" fill="url(#geo-3)" opacity="0.7" />
        <path d="M 90 70 L 60 90 L 60 52.5 Z" fill="url(#geo-2)" opacity="0.8" />
        <path d="M 60 90 L 30 70 L 60 52.5 Z" fill="url(#geo-3)" opacity="0.7" />
        <path d="M 30 70 L 30 35 L 60 52.5 Z" fill="url(#geo-2)" opacity="0.8" />
        <path d="M 30 35 L 60 15 L 60 52.5 Z" fill="url(#geo-3)" opacity="0.7" />
        
        {/* Center circle */}
        <circle cx="60" cy="52.5" r="15" fill="white" />
        
        {/* L letter */}
        <text x="60" y="63" textAnchor="middle" fontSize="24" fontWeight="bold" fill="hsl(50, 98%, 48%)">
          L
        </text>
      </g>
    </svg>
  );
}

// Premium Logo 4: Liquid Lemonade Splash
export function LogoLiquidSplash({ size = 40 }: { size?: number }) {
  const [particles, setParticles] = useState<Array<{ x: number; y: number; size: number; delay: number }>>([]);

  useEffect(() => {
    const initial = Array.from({ length: 8 }, (_, i) => ({
      x: 60 + Math.cos((i * 45 * Math.PI) / 180) * (20 + Math.random() * 15),
      y: 60 + Math.sin((i * 45 * Math.PI) / 180) * (20 + Math.random() * 15),
      size: 2 + Math.random() * 3,
      delay: Math.random() * 2
    }));
    setParticles(initial);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      <defs>
        <radialGradient id="splash-main">
          <stop offset="0%" stopColor="hsl(50, 100%, 75%)" />
          <stop offset="100%" stopColor="hsl(50, 98%, 58%)" />
        </radialGradient>
        <filter id="liquid-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
        </filter>
      </defs>
      
      <g filter="url(#liquid-goo)">
        {/* Main splash blob */}
        <circle cx="60" cy="60" r="32" fill="url(#splash-main)" />
        
        {/* Animated splash particles */}
        {particles.map((p, i) => (
          <circle 
            key={i}
            cx={p.x} 
            cy={p.y} 
            r={p.size}
            fill="hsl(50, 98%, 60%)"
          >
            <animate
              attributeName="r"
              values={`${p.size};${p.size + 2};${p.size}`}
              dur="2s"
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0.6;1"
              dur="2s"
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
      
      {/* Code symbol on top */}
      <text x="60" y="70" textAnchor="middle" fontSize="22" fontWeight="bold" fill="white" opacity="0.95">
        &lt;/&gt;
      </text>
    </svg>
  );
}

// Premium Logo 5: Modern Wordmark with Icon
export function LogoModernWordmark({ size = 140, variant = "default" }: { size?: number; variant?: "default" | "compact" }) {
  const [pulse, setPulse] = useState(1);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.01;
      setPulse(0.95 + Math.sin(frame) * 0.05);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2" style={{ height: size / 3.5 }}>
        <svg width={size / 3.5} height={size / 3.5} viewBox="0 0 100 100">
          <defs>
            <radialGradient id="wordmark-grad-compact">
              <stop offset="0%" stopColor="hsl(50, 98%, 68%)" />
              <stop offset="100%" stopColor="hsl(50, 95%, 52%)" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="40" fill="url(#wordmark-grad-compact)" />
          <text x="50" y="65" textAnchor="middle" fontSize="36" fontWeight="bold" fill="white">
            L
          </text>
        </svg>
        <span 
          className="font-bold tracking-tight"
          style={{ 
            fontSize: size / 5.5,
            background: 'linear-gradient(135deg, hsl(50, 98%, 58%) 0%, hsl(145, 60%, 45%) 50%, hsl(32, 94%, 62%) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Lomu
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3" style={{ height: size / 3 }}>
      {/* Premium icon */}
      <svg width={size / 3} height={size / 3} viewBox="0 0 100 100" className="shrink-0">
        <defs>
          <linearGradient id="wordmark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(50, 98%, 68%)" />
            <stop offset="50%" stopColor="hsl(50, 95%, 58%)" />
            <stop offset="100%" stopColor="hsl(50, 90%, 48%)" />
          </linearGradient>
          <linearGradient id="leaf-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(145, 70%, 55%)" />
            <stop offset="100%" stopColor="hsl(145, 60%, 40%)" />
          </linearGradient>
        </defs>
        
        <g transform={`scale(${pulse}) translate(${(1 - pulse) * 50} ${(1 - pulse) * 50})`}>
          {/* Lemon body */}
          <ellipse cx="50" cy="55" rx="32" ry="38" fill="url(#wordmark-grad)" />
          
          {/* Shine */}
          <ellipse cx="38" cy="38" rx="14" ry="18" fill="white" opacity="0.5" />
          <ellipse cx="60" cy="50" rx="8" ry="12" fill="white" opacity="0.3" />
          
          {/* Leaf cluster */}
          <path d="M 45 20 Q 40 12 43 8 Q 47 10 48 15 Z" fill="url(#leaf-grad)" />
          <path d="M 50 18 Q 48 10 51 6 Q 54 8 54 14 Z" fill="url(#leaf-grad)" opacity="0.9" />
          <path d="M 55 20 Q 56 12 60 10 Q 62 14 59 18 Z" fill="url(#leaf-grad)" opacity="0.85" />
        </g>
      </svg>
      
      {/* Wordmark */}
      <div className="flex flex-col">
        <span 
          className="font-bold leading-none"
          style={{ 
            fontSize: size / 4.5,
            background: 'linear-gradient(135deg, hsl(50, 98%, 58%) 0%, hsl(145, 60%, 45%) 50%, hsl(32, 94%, 62%) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em'
          }}
        >
          Lomu
        </span>
        <span 
          className="text-muted-foreground font-medium leading-none mt-1"
          style={{ fontSize: size / 14 }}
        >
          Code Made Sweet
        </span>
      </div>
    </div>
  );
}

// Premium Logo 6: Neon Glow Lemon
export function LogoNeonGlow({ size = 40 }: { size?: number }) {
  const [intensity, setIntensity] = useState(1);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 0.03;
      setIntensity(0.7 + Math.sin(frame) * 0.3);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      <defs>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <radialGradient id="neon-fill">
          <stop offset="0%" stopColor="hsl(50, 100%, 80%)" />
          <stop offset="100%" stopColor="hsl(50, 98%, 58%)" />
        </radialGradient>
      </defs>
      
      {/* Glow layer */}
      <ellipse 
        cx="60" 
        cy="60" 
        rx="40" 
        ry="45" 
        fill="hsl(50, 98%, 58%)" 
        opacity={intensity * 0.3}
        filter="url(#neon-glow)"
      />
      
      {/* Main lemon */}
      <ellipse cx="60" cy="60" rx="35" ry="40" fill="url(#neon-fill)" />
      
      {/* Neon outline */}
      <ellipse 
        cx="60" 
        cy="60" 
        rx="35" 
        ry="40" 
        fill="none" 
        stroke="hsl(50, 100%, 75%)" 
        strokeWidth="2"
        opacity={intensity}
        filter="url(#neon-glow)"
      />
      
      {/* Inner glow ring */}
      <ellipse 
        cx="60" 
        cy="60" 
        rx="28" 
        ry="32" 
        fill="none" 
        stroke="white" 
        strokeWidth="1"
        opacity={intensity * 0.6}
      />
      
      {/* Code symbol with glow */}
      <text 
        x="60" 
        y="70" 
        textAnchor="middle" 
        fontSize="26" 
        fontWeight="bold" 
        fill="white"
        filter="url(#neon-glow)"
        opacity={0.95}
      >
        &lt;/&gt;
      </text>
      
      {/* Sparkle effects */}
      {[35, 85].map((x, i) => (
        <g key={i}>
          <line x1={x} y1="30" x2={x} y2="40" stroke="white" strokeWidth="2" opacity={intensity} />
          <line x1={x - 5} y1="35" x2={x + 5} y2="35" stroke="white" strokeWidth="2" opacity={intensity} />
        </g>
      ))}
    </svg>
  );
}
