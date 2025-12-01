/**
 * BeeHive Logo - Premium Honeycomb Mark with Polished Hero Bee
 * Fully configurable - edit CONFIG objects below for easy customization
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  variant?: 'primary' | 'dark' | 'light';
  iconSize?: number;
  textHeight?: number;
  animated?: boolean;
}

// ============================================================================
// CONFIGURATION OBJECTS - Edit these for easy customization
// ============================================================================

// SVG viewBox and overall dimensions
const CONFIG = {
  viewBox: { width: 64, height: 64 },
  
  // Honeycomb configuration
  honeycomb: {
    size: 8, // Cell size (affects all positions)
    centerX: 32,
    centerY: 32,
    cells: [
      { x: 36, y: 25.072, label: 'center' },
      { x: 48, y: 32, label: 'right' },
      { x: 36, y: 38.928, label: 'bottom-center' },
      { x: 24, y: 32, label: 'left' },
      { x: 24, y: 18.144, label: 'top-left' },
      { x: 36, y: 11.216, label: 'top-center' },
      { x: 48, y: 18.144, label: 'top-right' },
    ],
    strokeWidth: 1.25,
    highlightOpacity: 0.6,
  },

  // Hero bee configuration
  heroBee: {
    position: { x: 38, y: 2 },
    
    // Head
    head: {
      x: 10,
      y: 6.4,
      radius: 2.3,
    },
    
    // Eyes
    eyes: {
      leftX: 9.0,
      rightX: 11.0,
      y: 5.8,
      radius: 0.55,
      shineRadius: 0.25,
      shineY: 5.55,
    },
    
    // Antennae
    antennae: {
      leftBase: { x: 8.4, y: 4.2 },
      leftTip: { x: 6.6, y: 1.8 },
      rightBase: { x: 11.6, y: 4.2 },
      rightTip: { x: 13.4, y: 1.8 },
      tipRadius: 0.35,
      strokeWidth: 0.7,
    },
    
    // Wings
    wings: {
      left: {
        path: "M5.8 7.4 C1.2 4.2 1.4 1.2 6.8 2.0 C11.0 2.6 11.2 6.4 5.8 7.4 Z",
        opacity: 0.58,
        strokeOpacity: 0.3,
        strokeWidth: 0.4,
      },
      right: {
        path: "M14.2 7.4 C18.8 4.2 18.6 1.2 13.2 2.0 C9.0 2.6 8.8 6.4 14.2 7.4 Z",
        opacity: 0.48,
        strokeOpacity: 0.3,
        strokeWidth: 0.4,
      },
    },
    
    // Thorax
    thorax: {
      cx: 10,
      cy: 9.2,
      rx: 2.6,
      ry: 2.0,
      shadowCy: 9.0,
      shadowRx: 2.4,
      shadowRy: 0.6,
      shadowOpacity: 0.3,
    },
    
    // Abdomen
    abdomen: {
      cx: 10,
      cy: 15.9,
      pathStart: 11.2,
      pathEnd: 20.4,
      width: 10.8,
      stripes: [
        {
          ellipse: { cx: 10, cy: 12.9, rx: 3.6, ry: 1.0, opacity: 0.35 },
          rect: { x: 6.2, y: 13.2, width: 7.6, height: 1.1, rx: 0.55 },
        },
        {
          ellipse: { cx: 10, cy: 15.2, rx: 3.8, ry: 1.1, opacity: 0.25 },
          rect: { x: 5.8, y: 15.2, width: 8.4, height: 1.2, rx: 0.6 },
        },
        {
          ellipse: { cx: 10, cy: 17.6, rx: 3.5, ry: 0.95, opacity: 0.3 },
          rect: { x: 6.2, y: 17.8, width: 7.6, height: 1.0, rx: 0.5 },
        },
      ],
    },
    
    // Stinger
    stinger: {
      startX: 10,
      startY: 20.4,
      tipY: 22.2,
      forkY: 23.0,
      strokeWidth: 0.9,
      forkStrokeWidth: 0.7,
    },
    
    // Legs
    legs: {
      strokeWidth: 0.75,
      left: [
        { paths: ["M6.2 12.6 L3.8 13.9 L3.4 14.8"] },
        { paths: ["M5.6 15.0 L3.0 16.3 L2.4 17.4"] },
        { paths: ["M5.8 17.6 L3.4 19.1 L2.8 20.2"] },
      ],
      right: [
        { paths: ["M13.8 12.6 L16.2 13.9 L16.6 14.8"] },
        { paths: ["M14.4 15.0 L17.0 16.3 L17.6 17.4"] },
        { paths: ["M14.2 17.6 L16.6 19.1 L17.2 20.2"] },
      ],
    },
  },

  // Animation configuration
  animations: {
    heroBee: {
      duration: 0.3,
    },
  },

  // Gradients and effects
  gradients: {
    honeyFill: {
      x1: 18,
      y1: 14,
      x2: 46,
      y2: 50,
    },
    cellShadow: {
      cx: "40%",
      cy: "40%",
    },
    beeGlow: {
      blur: 0.8,
    },
  },
};

const SIZE_MAP = {
  sm: 48,
  md: 64,
  lg: 96,
  xl: 128,
};

const SIZE_TEXT = {
  sm: '16px',
  md: '22px',
  lg: '32px',
  xl: '42px',
};

const VARIANT_COLORS = {
  primary: {
    text: '#101113',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#D4860F',
    dark: '#101113',
    thorax: '#141B2E',
    honeyDark: '#E39200',
  },
  dark: {
    text: '#FFF8E6',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#D4860F',
    dark: '#101113',
    thorax: '#141B2E',
    honeyDark: '#E39200',
  },
  light: {
    text: '#F7B500',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#D4860F',
    dark: '#101113',
    thorax: '#141B2E',
    honeyDark: '#E39200',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate honeycomb hex path
 * Flat-top hexagon with center at (x,y)
 */
function generateHexPath(x: number, y: number, size: number = 8): string {
  const h = (size * Math.sqrt(3)) / 2; // height
  const v = size / 2; // vertical offset
  return [
    `M${x + size / 2} ${y - h}`,
    `L${x + size} ${y - v}`,
    `L${x + size} ${y + v}`,
    `L${x + size / 2} ${y + h}`,
    `L${x - size / 2} ${y + h}`,
    `L${x - size} ${y + v}`,
    `L${x - size} ${y - v}`,
    `Z`,
  ].join(' ');
}

/**
 * Generate shadow layer hex path (darker, offset)
 */
function generateShadowHexPath(
  x: number,
  y: number,
  size: number = 8
): string {
  const h = (size * Math.sqrt(3)) / 2;
  return [
    `M${x + size / 2} ${y - h}`,
    `L${x + size} ${y - size / 2}`,
    `L${x + size} ${y + size / 2}`,
    `L${x + size / 2} ${y + h}`,
    `L${x - size / 2} ${y + h}`,
    `L${x - size} ${y + size / 2}`,
    `L${x - size} ${y - size / 2}`,
    `Z`,
  ].join(' ');
}

export function BeeHiveLogo({
  size = 'md',
  className = '',
  showText = true,
  variant = 'primary',
  iconSize,
  textHeight,
  animated = true,
}: BeeHiveLogoProps) {
  const svgSize = iconSize || SIZE_MAP[size];
  const textSize = textHeight ? `${textHeight}px` : SIZE_TEXT[size];
  const colors = VARIANT_COLORS[variant];

  // Render honeycomb cells
  const honeycombPaths = CONFIG.honeycomb.cells.map((cell) =>
    generateHexPath(cell.x, cell.y, CONFIG.honeycomb.size)
  );

  const honeycombShadows = CONFIG.honeycomb.cells.map((cell) =>
    generateShadowHexPath(cell.x, cell.y, CONFIG.honeycomb.size)
  );

  return (
    <div
      className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`}
      style={{ overflow: 'hidden' }}
    >
      {/* Professional Honeycomb Mark with Polished Hero Bee */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${CONFIG.viewBox.width} ${CONFIG.viewBox.height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, overflow: 'hidden' }}
        overflow="hidden"
        className="beehive-logo-mark"
      >
        <defs>
          {/* Primary honey gradient */}
          <linearGradient
            id="honeyFill"
            x1={CONFIG.gradients.honeyFill.x1}
            y1={CONFIG.gradients.honeyFill.y1}
            x2={CONFIG.gradients.honeyFill.x2}
            y2={CONFIG.gradients.honeyFill.y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={colors.nectar} />
            <stop offset="1" stopColor={colors.honey} />
          </linearGradient>

          {/* Inner cell shadow gradient */}
          <radialGradient
            id="cellShadow"
            cx={CONFIG.gradients.cellShadow.cx}
            cy={CONFIG.gradients.cellShadow.cy}
          >
            <stop offset="0" stopColor={colors.nectar} stopOpacity="0.4" />
            <stop offset="1" stopColor={colors.honey} stopOpacity="0" />
          </radialGradient>

          {/* Bee glow effect */}
          <filter id="beeGlow">
            <feGaussianBlur
              stdDeviation={CONFIG.gradients.beeGlow.blur}
              result="coloredBlur"
            />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* HONEYCOMB SHADOW LAYER */}
        <g opacity="0.15">
          {honeycombShadows.map((path, idx) => (
            <path key={`shadow-${idx}`} d={path} fill="#000" />
          ))}
        </g>

        {/* HONEYCOMB CELLS WITH POLISH */}
        <g
          id="honeycomb"
          stroke={colors.stroke}
          strokeWidth={CONFIG.honeycomb.strokeWidth}
          strokeLinejoin="round"
        >
          {honeycombPaths.map((path, idx) => (
            <g key={`cell-${idx}`}>
              <path d={path} fill="url(#honeyFill)" />
              {/* Inner shadow for depth */}
              {idx === 0 && (
                <path d={path} fill="url(#cellShadow)" opacity="0.3" />
              )}
            </g>
          ))}
        </g>

        {/* HIGHLIGHT EDGES */}
        <g
          stroke={colors.nectar}
          strokeWidth="0.6"
          fill="none"
          opacity={CONFIG.honeycomb.highlightOpacity}
        >
          <path d="M28 25.072 L36 25.072" />
          <path d="M40 18.144 L48 18.144" />
          <path d="M16 18.144 L24 18.144" />
        </g>

        {/* HERO BEE */}
        <g
          id="hero-bee"
          className={animated ? 'hero-bee' : ''}
          transform={`translate(${CONFIG.heroBee.position.x} ${CONFIG.heroBee.position.y})`}
          filter={animated ? 'url(#beeGlow)' : ''}
        >
          {/* Wings */}
          <path
            className={animated ? 'bee-wing-left' : ''}
            d={CONFIG.heroBee.wings.left.path}
            fill={colors.mint}
            opacity={CONFIG.heroBee.wings.left.opacity}
            strokeWidth={CONFIG.heroBee.wings.left.strokeWidth}
            stroke={colors.mint}
            strokeOpacity={CONFIG.heroBee.wings.left.strokeOpacity}
          />
          <path
            className={animated ? 'bee-wing-right' : ''}
            d={CONFIG.heroBee.wings.right.path}
            fill={colors.mint}
            opacity={CONFIG.heroBee.wings.right.opacity}
            strokeWidth={CONFIG.heroBee.wings.right.strokeWidth}
            stroke={colors.mint}
            strokeOpacity={CONFIG.heroBee.wings.right.strokeOpacity}
          />

          {/* Head */}
          <circle
            cx={CONFIG.heroBee.head.x}
            cy={CONFIG.heroBee.head.y}
            r={CONFIG.heroBee.head.radius}
            fill={colors.dark}
          />

          {/* Eyes */}
          <circle
            cx={CONFIG.heroBee.eyes.leftX}
            cy={CONFIG.heroBee.eyes.y}
            r={CONFIG.heroBee.eyes.radius}
            fill={colors.nectar}
            opacity="0.95"
          />
          <circle
            cx={CONFIG.heroBee.eyes.rightX}
            cy={CONFIG.heroBee.eyes.y}
            r={CONFIG.heroBee.eyes.radius}
            fill={colors.nectar}
            opacity="0.95"
          />
          <circle
            cx={CONFIG.heroBee.eyes.leftX - 0.25}
            cy={CONFIG.heroBee.eyes.shineY}
            r={CONFIG.heroBee.eyes.shineRadius}
            fill="#FFF"
            opacity="0.7"
          />
          <circle
            cx={CONFIG.heroBee.eyes.rightX - 0.25}
            cy={CONFIG.heroBee.eyes.shineY}
            r={CONFIG.heroBee.eyes.shineRadius}
            fill="#FFF"
            opacity="0.7"
          />

          {/* Antennae */}
          <path
            d={`Q${CONFIG.heroBee.antennae.leftBase.x - 0.6} ${CONFIG.heroBee.antennae.leftBase.y - 1.6} ${CONFIG.heroBee.antennae.leftTip.x} ${CONFIG.heroBee.antennae.leftTip.y}`}
            stroke={colors.dark}
            strokeWidth={CONFIG.heroBee.antennae.strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`Q${CONFIG.heroBee.antennae.rightBase.x + 0.6} ${CONFIG.heroBee.antennae.rightBase.y - 1.6} ${CONFIG.heroBee.antennae.rightTip.x} ${CONFIG.heroBee.antennae.rightTip.y}`}
            stroke={colors.dark}
            strokeWidth={CONFIG.heroBee.antennae.strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
          <circle
            cx={CONFIG.heroBee.antennae.leftTip.x}
            cy={CONFIG.heroBee.antennae.leftTip.y}
            r={CONFIG.heroBee.antennae.tipRadius}
            fill={colors.dark}
          />
          <circle
            cx={CONFIG.heroBee.antennae.rightTip.x}
            cy={CONFIG.heroBee.antennae.rightTip.y}
            r={CONFIG.heroBee.antennae.tipRadius}
            fill={colors.dark}
          />

          {/* Thorax */}
          <ellipse
            cx={CONFIG.heroBee.thorax.cx}
            cy={CONFIG.heroBee.thorax.cy}
            rx={CONFIG.heroBee.thorax.rx}
            ry={CONFIG.heroBee.thorax.ry}
            fill={colors.thorax}
          />
          <ellipse
            cx={CONFIG.heroBee.thorax.cx}
            cy={CONFIG.heroBee.thorax.shadowCy}
            rx={CONFIG.heroBee.thorax.shadowRx}
            ry={CONFIG.heroBee.thorax.shadowRy}
            fill={colors.dark}
            opacity={CONFIG.heroBee.thorax.shadowOpacity}
          />

          {/* Abdomen */}
          <path
            d={`M${CONFIG.heroBee.abdomen.cx} ${CONFIG.heroBee.abdomen.pathStart} C${CONFIG.heroBee.abdomen.cx + CONFIG.heroBee.abdomen.width / 2} ${CONFIG.heroBee.abdomen.pathStart} ${CONFIG.heroBee.abdomen.cx + CONFIG.heroBee.abdomen.width / 2 - 0.4} ${CONFIG.heroBee.abdomen.cy} ${CONFIG.heroBee.abdomen.cx} ${CONFIG.heroBee.abdomen.pathEnd} C${CONFIG.heroBee.abdomen.cx - CONFIG.heroBee.abdomen.width / 2 + 0.4} ${CONFIG.heroBee.abdomen.cy} ${CONFIG.heroBee.abdomen.cx - CONFIG.heroBee.abdomen.width / 2} ${CONFIG.heroBee.abdomen.pathStart} ${CONFIG.heroBee.abdomen.cx} ${CONFIG.heroBee.abdomen.pathStart} Z`}
            fill={colors.honey}
          />

          {/* Abdomen stripes */}
          {CONFIG.heroBee.abdomen.stripes.map((stripe, idx) => (
            <g key={`stripe-${idx}`}>
              <ellipse
                cx={stripe.ellipse.cx}
                cy={stripe.ellipse.cy}
                rx={stripe.ellipse.rx}
                ry={stripe.ellipse.ry}
                fill={colors.dark}
                opacity={stripe.ellipse.opacity}
              />
              <rect
                x={stripe.rect.x}
                y={stripe.rect.y}
                width={stripe.rect.width}
                height={stripe.rect.height}
                rx={stripe.rect.rx}
                fill={idx % 2 === 0 ? colors.honeyDark : colors.dark}
                opacity={idx % 2 === 0 ? 1 : 0.4}
              />
            </g>
          ))}

          {/* Stinger */}
          <path
            d={`M${CONFIG.heroBee.stinger.startX} ${CONFIG.heroBee.stinger.startY} L${CONFIG.heroBee.stinger.startX} ${CONFIG.heroBee.stinger.tipY}`}
            stroke={colors.dark}
            strokeWidth={CONFIG.heroBee.stinger.strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={`M${CONFIG.heroBee.stinger.startX} ${CONFIG.heroBee.stinger.tipY} L${CONFIG.heroBee.stinger.startX - 0.7} ${CONFIG.heroBee.stinger.forkY}`}
            stroke={colors.dark}
            strokeWidth={CONFIG.heroBee.stinger.forkStrokeWidth}
            strokeLinecap="round"
          />
          <path
            d={`M${CONFIG.heroBee.stinger.startX} ${CONFIG.heroBee.stinger.tipY} L${CONFIG.heroBee.stinger.startX + 0.7} ${CONFIG.heroBee.stinger.forkY}`}
            stroke={colors.dark}
            strokeWidth={CONFIG.heroBee.stinger.forkStrokeWidth}
            strokeLinecap="round"
          />

          {/* Legs */}
          <g
            stroke={colors.dark}
            strokeWidth={CONFIG.heroBee.legs.strokeWidth}
            fill="none"
            strokeLinecap="round"
          >
            {CONFIG.heroBee.legs.left.map((leg, idx) => (
              <path key={`leg-left-${idx}`} d={leg.paths[0]} />
            ))}
            {CONFIG.heroBee.legs.right.map((leg, idx) => (
              <path key={`leg-right-${idx}`} d={leg.paths[0]} />
            ))}
          </g>
        </g>

      </svg>

      {/* BeeHive Wordmark */}
      {showText && (
        <div className="flex flex-col" style={{ lineHeight: 1 }}>
          <span
            style={{
              fontSize: textSize,
              fontWeight: 800,
              color: colors.honey,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            BeeHive
          </span>
          <span
            style={{
              fontSize: `calc(${textSize} * 0.32)`,
              fontWeight: 600,
              color: colors.honey,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.75,
            }}
          >
            Collective
          </span>
        </div>
      )}
    </div>
  );
}

export default BeeHiveLogo;
