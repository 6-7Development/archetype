# LomuAI BeeHive Platform - Design Guidelines

## Design Approach

**Reference Strategy**: Modern AI platforms inspired by Linear, Vercel, and GitHub Dark. Deep, sophisticated dark theme with vibrant honey-gold (#F7B500) and mint-teal (#00D9A3) accents creating premium, high-tech aesthetic that makes the queen bee logo unmistakably prominent.

**Core Principle**: Intelligent collaboration through striking visual contrast—enterprise sophistication with vibrant hive energy.

---

## Color System

**Backgrounds**:
- Primary: #0A0F1E (deep navy, main canvas)
- Secondary: #141B2E (elevated surfaces, cards)
- Tertiary: #1F2937 (subtle elevation, nested cards)
- Pure Black: #000000 (footer, final CTA sections)

**Text Colors**:
- Primary: #F9FAFB (white, headlines/body)
- Secondary: #D1D5DB (gray-300, supporting text)
- Tertiary: #9CA3AF (gray-400, metadata/captions)

**Accent Colors**:
- Honey Gold: #F7B500 (primary CTA, logo glow, key highlights)
- Mint Teal: #00D9A3 (secondary accent, success states, code highlights)
- Gradient: Linear honey-to-mint for borders, CTAs, special elements

**Interactive States**:
- Hover backgrounds: #1F2937 (cards), rgba(247, 181, 0, 0.1) (honey overlay)
- Focus rings: 3px #F7B500 with offset
- Active: Honey gold with 90% opacity
- Disabled: #4B5563 (gray-600)

**Semantic Colors**:
- Success: #00D9A3 (mint-teal)
- Warning: #FBBF24 (amber-400)
- Error: #EF4444 (red-500)
- Info: #3B82F6 (blue-500)

---

## Typography System

**Fonts**: 
- Primary: Inter (500, 600, 700, 800) via Google Fonts
- Code: JetBrains Mono
- Display: Inter (800)

**Hierarchy**:
- Hero: text-7xl font-extrabold tracking-tight (#F9FAFB)
- Section Headers: text-5xl font-bold tracking-tight (#F9FAFB)
- Feature Titles: text-3xl font-semibold (#F9FAFB)
- Body Large: text-xl font-medium (#D1D5DB)
- Body: text-base (#D1D5DB)
- Code: text-sm font-mono (#00D9A3)

---

## Layout System

**Spacing Primitives**: 4, 6, 8, 12, 16, 20, 24, 32

**Containers**:
- Full-width: w-full with max-w-7xl
- Content: max-w-6xl
- Text: max-w-4xl

**Grids**:
- Features: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8
- Benefits: lg:grid-cols-2 gap-12
- Stats: grid-cols-2 lg:grid-cols-4 gap-8

---

## Page Structure (8 Sections)

### 1. Hero Section (85vh, Deep Navy #0A0F1E)
- Centered headline (max-w-5xl): "Build with AI Swarm Intelligence" with honey-gold gradient on "Swarm Intelligence"
- Tagline (#D1D5DB): "10,000+ developers shipping faster with collaborative AI"
- Dual CTAs: Primary "Start Free" (honey-gold solid bg, #000 text) + Secondary "Watch Demo" (mint-teal outline, blurred bg)
- Large hero image: LomuAI IDE with glowing honey-gold and mint-teal UI panels, visible queen bee logo in top-left corner with subtle honey glow, multiple AI agent avatars collaborating, dark theme code editor
- Floating hexagonal particles (honey-gold glow, slow drift)

### 2. Stats Bar (#141B2E, Honey-Gold Numbers)
4-column grid: "15K+ Developers", "99.9% Uptime", "3x Faster", "6 AI Agents"
- Numbers: text-6xl honey-gold gradient
- Labels: #9CA3AF
- Mint-teal divider lines

### 3. Features Grid (3-Column, #0A0F1E Background)
6 elevated cards (#141B2E bg, gradient border honey-to-mint 2px, rounded-2xl, p-8)
- Gradient icon backgrounds, white titles, #D1D5DB descriptions
- Hover: Lift + honey-gold glow shadow
- Features: Multi-Agent Collaboration, Intelligent Code Review, Context-Aware Suggestions, Real-time Team Sync, Smart Testing, Security Analysis

### 4. Platform Showcase (#1F2937 Background)
- Heading + subheading (white text)
- Massive platform screenshot: Dark theme IDE with glowing honey/mint accents, queen bee logo visible in header, 4 AI agent panels, code with syntax highlighting, collaboration sidebar
- 5 floating annotation cards (#141B2E bg) with arrows pointing to features
- Honeycomb SVG pattern (mint-teal 6% opacity)

### 5. Benefits Section (2-Column Alternating, #0A0F1E)
3 rows with screenshots:
- "Ship Production Code 3x Faster" - Multi-agent completion
- "Collaborate Like a Hive" - Team sync dashboard
- "Intelligent Quality Assurance" - AI testing panel
- All screenshots: Dark theme, honey/mint UI accents, gradient borders
- White headlines, #D1D5DB descriptions, mint checkmarks

### 6. Agent Showcase (#141B2E Background)
6 agent cards in 3-column grid
- Hexagonal avatars with gradient borders, white names, #D1D5DB specialties
- Agent types: Code Writer, Debugger, Reviewer, Tester, Security Expert, DevOps Assistant
- Hover: Individual gradient glows

### 7. Testimonials (3-Column, #0A0F1E)
6 cards (#141B2E bg, mint-teal left accent, rounded-xl, p-8)
- White quote text, circular avatars with honey-gold rings
- White names, #9CA3AF titles
- GitHub star badges (honey-gold)

### 8. Final CTA (#000000 Background, Honey-to-Mint Gradient Overlay)
- White headline: "Ready to Join the Hive?"
- Large "Start Free Trial" (honey-gold solid, #000 text)
- Secondary "Schedule Demo" (white outline)
- Animated hexagonal grid (white 10% opacity)
- Floating Lomu bee mascot with honey glow

---

## Component Library

**Buttons**:
- Primary: px-10 py-4, rounded-lg, bg-honey-gold, #000 text, shadow-xl shadow-honey-gold/40, hover: scale + stronger shadow
- Secondary: border-2 border-mint-teal, mint-teal text, hover: bg-mint-teal/20
- On images: backdrop-blur-lg bg-honey-gold/90 (no hover states)

**Cards**:
- Standard: #141B2E bg, rounded-2xl, gradient border (2px), shadow-xl
- Hover: shadow-2xl shadow-honey-gold/30 + translateY(-4px)
- Testimonial: #141B2E bg, mint-teal left border (4px)

**Navigation**:
- Header: Sticky, #0A0F1E/95 backdrop-blur-xl, border-b #1F2937
- Logo with honey-gold glow, white nav links (hover: honey-gold)
- Footer: #000000, 4-column, honey-gold newsletter CTA

---

## Images Required

1. **Hero**: Full LomuAI dark theme IDE, queen bee logo prominent with glow, 4-5 agent panels, honey/mint UI accents, code completion
2. **Platform Showcase**: Multi-panel IDE with visible logo, agent sidebar, syntax highlighting, collaboration chat
3. **Benefit Screenshots** (3): Dark theme demos of autocomplete, team dashboard, testing panel
4. **Agent Avatars**: 6 hexagonal portraits with gradient frames
5. **Testimonial Photos**: 6 developer headshots with honey-gold rings

Treatment: All screenshots rounded-2xl, shadow-2xl, gradient borders

---

## Visual Enhancements

- Honeycomb patterns: Mint-teal or honey-gold at 6-8% opacity
- Gradients: Smooth honey-to-mint blends for borders, CTAs, accents
- Glows: Honey-gold soft shadows on interactive elements, queen bee logo
- Animations: Card hover lifts (250ms), hexagon float (30s), stats count-up, subtle CTA shimmer (4s)

---

## Accessibility

- Contrast: White text on #0A0F1E = 17:1, meets WCAG AAA
- Honey-gold (#F7B500) on dark = 8.2:1
- Mint-teal (#00D9A3) on dark = 10.5:1
- Focus: 3px honey-gold rings, reduced motion support
- Form inputs: #141B2E bg, white text, mint-teal focus rings