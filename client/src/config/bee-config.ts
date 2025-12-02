/**
 * Queen Bee Mascot Configuration
 * ============================
 * Easily editable configuration for the Scout Queen Bee mascot
 * All styling, sizing, colors, and animations in one place
 */

export const BeeConfig = {
  // ====== SIZES (in pixels) ======
  // Optimized to match typical website mascots (Google, Slack, Intercom, Zendesk)
  sizes: {
    mobile: 100,      // Small screens - like Slack/Zendesk mascots
    desktop: 120,     // Standard desktop - noticeable but not intrusive
    large: 150,       // Large displays - still balanced, not dominating
  },

  // ====== COLORS & GLOWS (for different emotional states) ======
  glows: {
    idle: 'rgba(247,181,0,0)',        // No glow when idle
    thinking: 'rgba(0,240,255,0.3)',  // Cyan glow for thinking
    typing: 'rgba(56,189,248,0.3)',   // Blue glow for AI response
    success: 'rgba(16,185,129,0.3)',  // Green glow for success
    error: 'rgba(255,107,107,0.4)',   // Red glow for errors
    evading: 'rgba(247,181,0,0.5)',   // Golden glow when evading
    frenzy: 'rgba(255,50,50,0.6)',    // Aggressive red for frenzy
  },

  // ====== BLUR EFFECTS ======
  blur: {
    glow: '10px',      // Blur on aura effects
    trail: '8px',      // Blur on movement trail
  },

  // ====== SCALE ANIMATIONS (multiplier) ======
  scale: {
    default: 1.0,      // Normal size
    evading: 1.12,     // Slightly larger when fleeing
    sleepy: 0.95,      // Slightly smaller when sleepy
    frenzy: 1.15,      // Larger during aggressive mode
  },

  // ====== ROTATION ANIMATIONS (in degrees) ======
  rotation: {
    error: { min: -10, max: 10, duration: 0.5 },
    confused: { min: -10, max: 10, duration: 0.5 },
    frenzy: { min: -5, max: 5, duration: 0.3 },
    sleepy: { min: -3, max: 3, duration: 2 },
    idle: 0,
  },

  // ====== TRANSPARENCY & VISIBILITY ======
  visibility: {
    background: 'transparent',    // Always transparent - NO visible box
    border: 'none',               // NO borders
    pointerEvents: 'none',        // NOT interactable
    boxShadow: 'none',            // NO shadow creating square effect
  },

  // ====== WORKER BEE BEHAVIOR ======
  workers: {
    count: 8,                     // Number of worker bees
    showDistance: 100,            // How close user must be to see workers
    chaseDistance: 150,           // Distance at which workers chase
  },

  // ====== MASCOT BEHAVIOR ======
  behavior: {
    followDelay: 200,             // ms delay in following user (smoother movement)
    autonomousModeTimeout: 5000,  // ms before returning to autonomous after interaction
    avoidanceDistance: 150,       // pixels - how far to flee from user
    maxSpeed: 8,                  // pixels per frame
  },

  // ====== Z-INDEX LAYERING ======
  zIndex: {
    trail: 98,       // Movement trail behind mascot
    glow: 99,        // Aura/glow effects
    mascot: 100,     // Main bee
    workers: 97,     // Worker bees
  },

  // ====== THOUGHT BUBBLE CONFIG ======
  thoughts: {
    maxWidth: 280,           // Maximum width of thought bubble
    fontSize: 13,            // Font size in pixels
    backgroundColor: 'rgba(0,0,0,0.8)',  // Dark background
    textColor: 'rgba(255,255,255,0.95)', // Light text
    showDuration: 3000,      // ms to show thought before fading
    offsetY: -60,            // pixels above the bee to display thought
  },

  // ====== HOLIDAY CONFIG ======
  holiday: {
    enabled: true,           // Enable/disable all holiday effects
    season: 'christmas',     // 'christmas', 'halloween', 'easter', 'thanksgiving'
    
    // Christmas-specific config
    christmas: {
      snowHatStyle: 'classic',  // 'classic' (fluffy), 'stocking' (festive), 'elf' (pointy)
      snowHatColor: '#FFFFFF',
      snowHatTrim: '#FF0000',
      
      // Snow effects on page elements
      snowOnLetters: true,     // Add snow accumulation to text
      snowOnBorders: true,     // Add snow on element borders
      snowOnHeroImages: true,  // Add snow effect overlay on hero sections
      
      // Decorative elements
      ornamentCount: 12,       // Number of ornaments to render
      wreathCount: 4,          // Wreaths in corners
      garlandEnabled: true,    // Garland across top/bottom
      
      // Holiday thoughts (random mascot messages)
      thoughts: [
        "The snow is falling... so peaceful! ❄️",
        "I love the holiday season! 🎄",
        "Time for some festive coding! 🎅",
        "Spreading holiday cheer to all developers! 🎁",
        "Winter code is the best code! ⛄",
        "Let's build something magical this season! ✨",
      ],
    },
  },
};

export default BeeConfig;
