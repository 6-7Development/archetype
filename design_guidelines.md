# Design Guidelines: LemonAid - "When Code Throws You Lemons"

## Brand Identity

**Platform Name**: LemonAid  
**Tagline**: "When code throws you lemons, you get LemonAid"  
**Mission**: The SaaS platform made to make life sweet  
**Mascot**: Lumo the Lemon - Your AI coding buddy

**Brand Story**: LemonAid transforms coding challenges (lemons) into delightful solutions. Fresh, optimistic, and energizing - we make development sweet with AI-powered assistance that feels like having a cheerful coding companion by your side.

## Design Philosophy

**Core Principles**:
- **Refreshingly Bright**: Citrus-inspired palette that energizes and uplifts
- **Playfully Professional**: Optimistic and friendly while maintaining credibility
- **Sweet Simplicity**: Clean, approachable interfaces without overwhelming users
- **Natural Motion**: Organic animations that feel alive (like Lumo breathing)
- **Developer-Focused**: IDE features wrapped in a delightful experience

## Color Palette

### Light Mode (Primary Theme)
**Foundation Colors**:
- `--sparkling-lemon`: 50 98% 58% (Primary - vibrant yellow, main actions)
- `--fresh-mint`: 145 60% 45% (Accent - success, positive actions)
- `--citrus-bloom`: 32 94% 62% (Supporting - warnings, highlights)
- `--slate-professional`: 210 14% 24% (Text, professional contrast)
- `--cream-base`: 48 46% 96% (Backgrounds, soft surfaces)

**Semantic Colors**:
- Primary: Sparkling Lemon (buttons, links, active states)
- Success: Fresh Mint (completed tasks, success messages)
- Warning: Citrus Bloom (alerts, important notices)
- Error: 0 85% 60% (errors, destructive actions)
- Muted: 210 12% 65% (secondary text, borders)

**Background System**:
- Background Base: 48 40% 98% (main page background)
- Surface: 0 0% 100% (white cards, panels)
- Elevated: 50 95% 95% (subtle lemon tint for hover states)

### Dark Mode (Optional)
**Foundation Colors**:
- `--lemon-dark`: 50 90% 52% (Primary - deeper yellow)
- `--mint-dark`: 145 52% 38% (Accent - deeper green)
- `--bloom-dark`: 32 88% 58% (Supporting - deeper orange)
- Background: 220 20% 12% (deep slate)
- Surface: 220 18% 16%

## Typography

**Font Family**:
- UI Text: Inter (400, 500, 600, 700) - Clean, modern, readable
- Code/Console: 'JetBrains Mono', monospace - Developer-friendly

**Type Scale**:
- Hero: text-4xl font-bold (48px) - Landing headlines
- Heading: text-2xl font-semibold (24px) - Section headers
- Subheading: text-lg font-medium (18px) - Card titles
- Body: text-base font-normal (16px) - Main content
- Small: text-sm (14px) - Secondary info
- Tiny: text-xs (12px) - Timestamps, metadata

## Layout & Spacing

**Spacing Scale**: Based on Tailwind's 4px unit system
- Tight: 2 (8px) - Between related items
- Normal: 4 (16px) - Standard component spacing
- Relaxed: 6 (24px) - Between sections
- Generous: 8 (32px) - Major layout divisions

**Container Widths**:
- Max content: 1280px (main workspace)
- Max reading: 720px (documentation, forms)
- Sidebar: 280px (navigation, file tree)

## Illustration & Visual Language

**Lemon Motifs**:
- Lemon slices as decorative accents (low opacity backgrounds)
- Ice cubes for loading states
- Bubbles for activity/processing indicators
- Seed patterns for subtle textures

**Usage Guidelines**:
- Use sparingly - illustration as background flourishes, not primary UI
- Keep opacity low (10-20%) for background elements
- Maintain professional credibility with restrained application
- Reserve playful elements for loading screens and empty states

## Components

### Lemonade Jar Loading Indicator
**Purpose**: Primary loading animation showing progress  
**Design**: SVG jar with:
- Clear glass jar outline
- Yellow gradient liquid fill (animated from bottom to top)
- Floating bubble particles
- Ice cube elements
- Lemon slice garnish

**States**:
- 0-25%: Light yellow, small bubbles
- 25-75%: Medium yellow, active bubbles
- 75-100%: Rich lemon color, celebratory sparkles

### Lumo Avatar (Mascot)
**Character**: Animated lemon with red goggles, tech aesthetic  
**Emotions**: 9 states (happy, excited, thinking, working, success, error, worried, sad, idle)  
**Usage**:
- AI chat companion (appears during conversations)
- Loading screens (Lumo animates while loading)
- Success celebrations (Lumo celebrates with user)
- Error states (Lumo shows empathy)

**Animation Principles**:
- Natural breathing motion (subtle sine wave)
- Varied frame timing for organic feel
- Smooth emotion transitions
- Background effects (pulsing glow, orbiting particles)

### Buttons & Controls

**Primary Button** (Sparkling Lemon):
- Background: Sparkling Lemon
- Text: Slate Professional
- Hover: Slight scale (1.02) + glow
- Active: Deeper yellow shade

**Secondary Button** (Fresh Mint):
- Border: Fresh Mint
- Text: Slate Professional
- Hover: Mint background (10% opacity)

**Ghost Button**:
- Transparent background
- Text: Slate Professional
- Hover: Cream Base background

### Cards & Surfaces

**Card Elevation**:
- Base: bg-white dark:bg-surface
- Hover: subtle lemon tint (elevated)
- Shadow: soft, warm shadows (not harsh gray)

**Borders**:
- Default: 1px solid muted (very subtle)
- Accent: 2px solid Sparkling Lemon (active states)
- Radius: rounded-lg (8px standard)

## Animation & Motion

**Timing Functions**:
- Standard: cubic-bezier(0.4, 0, 0.2, 1) - smooth ease
- Bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55) - playful
- Breathing: sine wave for organic motion

**Duration Guidelines**:
- Micro: 150ms (hover, focus states)
- Normal: 200-300ms (transitions, slides)
- Emphasis: 400-500ms (modals, major changes)
- Breathing: 2-4s (ambient animations)

**Background Animations**:
- Gradient shifts: <8s duration
- Particle movement: slow, subtle orbits
- Lemon slice rotation: 20-30s lazy spin
- Keep opacity low to avoid distraction

## Voice & Tone

**Communication Style**:
- Friendly and encouraging (not cutesy)
- Clear and helpful (not condescending)
- Optimistic and energizing (not overwhelming)
- Professional when needed (serious errors, billing)

**Example Messages**:
- ✅ "Your code is looking sweet!" (success)
- ⚠️ "Hang tight! Squeezing fresh code..." (loading)
- ❌ "Oops! That's a sour lemon. Let's fix it." (error)
- 💡 "Here's a fresh idea..." (suggestion)

## Responsive Design

**Breakpoints**:
- Mobile: < 640px (single column, drawer navigation)
- Tablet: 640-1024px (adapted layout, collapsible panels)
- Desktop: > 1024px (full workspace experience)

**Mobile Priorities**:
- Command console full-width
- Lumo avatar smaller (64px)
- Touch-friendly targets (44px minimum)
- Bottom sheet for secondary panels

## Accessibility

**Contrast Requirements**:
- Text on white: >= 4.5:1 ratio
- Sparkling Lemon buttons: use Slate text for contrast
- Maintain readability in both light and dark modes

**Motion**:
- Respect prefers-reduced-motion
- Disable ambient animations for users who request it
- Keep essential functionality working without animations

## Dark Mode Adaptation

**Philosophy**: Deeper citrus tones, maintain warmth  
**Adjustments**:
- Background: Deep slate (not pure black)
- Lemon: Muted but still vibrant (50 90% 52%)
- Mint: Deeper green with good contrast
- Maintain lemon jar loading animation with adjusted colors

## Implementation Notes

**CSS Variables**: Define in `:root` and `.dark` for theme switching  
**Tailwind Config**: Map custom colors to Tailwind utilities  
**Component Library**: Shadcn UI components styled with LemonAid palette  
**Icon System**: Lucide React for UI icons, custom lemon illustrations  

**File Structure**:
- `/components/ui/*` - Shadcn base components (restyled)
- `/components/lumo-pixel-avatar.tsx` - Mascot component
- `/components/lemonade-loader.tsx` - Loading animation
- `index.css` - Color system, animations, utilities

---

**Remember**: When code throws you lemons, LemonAid makes it sweet! 🍋✨
