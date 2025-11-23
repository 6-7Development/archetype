# LomuAI Platform - Design Guidelines

## Design Approach

**Reference Strategy**: Modern AI platforms aesthetic inspired by Linear, Notion, and Vercel. Light, vibrant interface with honey-gold (#F7B500) and mint-teal (#00D9A3) against cream (#FFF8E6) backgrounds. Premium energy with swarm intelligence collaboration.

**Core Principle**: Intelligent collaboration through vibrant, approachable design—enterprise trust with human-centered warmth.

---

## Typography System

**Fonts**: 
- Primary: Inter (500, 600, 700, 800) via Google Fonts
- Code: JetBrains Mono for technical content
- Display: Inter (800) for hero impact

**Hierarchy**:
- Hero: text-7xl font-extrabold tracking-tight (charcoal)
- Section Headers: text-5xl font-bold tracking-tight (charcoal)
- Feature Titles: text-3xl font-semibold (charcoal)
- Body Large: text-xl font-medium (gray-700)
- Body: text-base (gray-600)
- Code: text-sm font-mono (mint-teal)

---

## Layout System

**Spacing Primitives**: 4, 6, 8, 12, 16, 20, 24, 32
- Cards: p-8, gap-6
- Sections: py-24 desktop, py-16 mobile
- Major gaps: space-y-32

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

### 1. Hero Section (85vh, Cream Background)
**Layout**: Centered with immersive platform imagery
- Headline (max-w-5xl): "Build with AI Swarm Intelligence"
- Tagline: "10,000+ developers shipping faster with collaborative AI"
- Dual CTAs: Primary "Start Free" (honey-gold, blurred bg) + Secondary "Watch Demo" (outline mint-teal, blurred bg)
- Background: Large hero image showing LomuAI IDE with multiple AI agents collaborating, honey-gold and mint-teal UI accents visible, code panels with syntax highlighting
- Treatment: Soft gradient overlay (cream to transparent top-to-bottom) for depth
- Floating elements: Animated hexagonal particles (honey-gold, subtle drift animation)

### 2. Stats Bar (White Background, Honey-Gold Accents)
**Layout**: 4-column centered grid
- Large numbers (text-6xl font-bold honey-gold gradient) + labels (gray-600)
- Metrics: "15K+ Developers", "99.9% Uptime", "3x Faster", "6 AI Agents"
- Subtle mint-teal divider lines between stats

### 3. Features Grid (3-Column, Cream Background)
**Layout**: 6 elevated cards with gradient borders
- Card styling: White bg, gradient border (honey-gold to mint-teal, 2px), rounded-2xl, p-8, shadow-lg
- Hover: Lift (translateY -4px) + stronger shadow with honey-gold glow
- Each card: Gradient icon (honey to mint circle bg), bold title, 2-sentence description
- Icons: Heroicons, 56px
- Features: Multi-Agent Collaboration, Intelligent Code Review, Context-Aware Suggestions, Real-time Team Sync, Smart Testing, Security Analysis

### 4. Platform Showcase (Full-Width White, Mint-Teal Gradient Top)
**Layout**: Large IDE screenshot with feature callouts
- Heading: "Your Intelligent Development Hive"
- Subheading: "Watch AI agents collaborate in real-time"
- Center: Massive platform screenshot (rounded-3xl, shadow-2xl with subtle honey-gold border glow)
- Screenshot shows: Multi-panel IDE, 3-4 AI agent avatars in sidebar, active code suggestions with honey highlights, collaboration chat panel
- 5 floating annotation cards with arrows pointing to features
- Background: White with subtle honeycomb SVG pattern (mint-teal, 4% opacity)

### 5. Benefits Section (2-Column Alternating, Cream Background)
**Layout**: 3 rows, image-text pairs
- Row 1 (Image Right): "Ship Production Code 3x Faster" - Multi-agent code completion screenshot
- Row 2 (Image Left): "Collaborate Like a Hive" - Team sync dashboard with agent activity
- Row 3 (Image Right): "Intelligent Quality Assurance" - AI testing + security panel
- Images: Rounded-2xl with gradient border (honey-to-mint), shadow-xl
- Text: Bold headline (text-4xl) + description + key metrics in honey-gold
- Each row includes 2-3 bullet points with mint-teal checkmarks

### 6. Agent Showcase (White Background, Gradient Accents)
**Layout**: Interactive agent demonstration
- Heading: "Meet Your AI Swarm"
- 6 agent cards in 3-column grid
- Each card: Agent avatar (hexagonal frame, gradient border), name, specialty, example interaction
- Agent types: Code Writer, Debugger, Reviewer, Tester, Security Expert, DevOps Assistant
- Hover: Glow effect matching agent's accent gradient

### 7. Testimonials (3-Column Grid, Cream Background)
**Layout**: 6 developer testimonial cards
- Card: White bg, mint-teal left accent bar (4px), rounded-xl, p-8, shadow-md
- Content: Quote text (text-lg gray-700), avatar (circular with honey-gold ring, 64px), name (font-semibold), title + company (gray-500)
- GitHub star count badge (honey-gold)
- Testimonials emphasize speed, collaboration, quality improvements

### 8. Final CTA (Full-Width, Honey-Gold to Mint-Teal Gradient)
**Layout**: Centered, vibrant
- Headline: "Ready to Join the Hive?" (white text-6xl)
- Subtext: "Start building with AI swarm intelligence today" (white/90)
- Large CTA: "Start Free Trial" (white bg, charcoal text, font-bold, shadow-xl)
- Secondary: "Schedule Demo" (white outline)
- Background: Smooth diagonal gradient (honey-gold to mint-teal) with animated hexagonal grid overlay (white, 8% opacity, slow pulse)
- Decorative: Floating Lomu bee mascot (bottom right, waving animation)

---

## Component Library

### Buttons
**Primary** (Honey-Gold):
- px-10 py-4, rounded-lg, font-semibold text-lg
- bg-honey-gold text-white shadow-lg
- Hover: shadow-xl shadow-honey-gold/30, slight scale
- On images: backdrop-blur-lg bg-honey-gold/95 (no hover states)

**Secondary** (Outline):
- border-2 border-mint-teal text-mint-teal
- Hover: bg-mint-teal/10

### Cards
**Feature Card**:
- White bg, rounded-2xl, p-8
- Gradient border (honey-to-mint, 2px via border-image or pseudo-element)
- shadow-lg, hover: shadow-2xl shadow-honey-gold/20 + translateY(-4px)

**Testimonial Card**:
- White bg, rounded-xl, p-6, shadow-md
- 4px mint-teal left border accent

### Navigation
**Header**: Sticky, white/95 backdrop-blur-xl, border-b border-gray-200
- Logo left (honey-gold accent), nav center (gray-700, hover:honey-gold), CTA right
- Mobile: Hamburger with smooth slide menu

**Footer**: 4-column cream background
- Columns: Product, Developers, Company, Community
- Newsletter: Honey-gold CTA button
- Social icons with mint-teal hover

---

## Images Required

1. **Hero Background**: Full LomuAI IDE showing 4-5 AI agent panels collaborating, syntax highlighting with honey-gold/mint-teal accents, live code completion, chat panel with agent avatars
2. **Platform Showcase**: Detailed multi-panel IDE with agent sidebar, collaborative coding session, real-time suggestions, team activity feed
3. **Benefit Screenshots** (3): Multi-agent autocomplete demo, team collaboration dashboard, AI testing/security panel
4. **Agent Avatars**: 6 unique AI agent hexagonal portraits with gradient frames
5. **Testimonial Photos**: 6 developer headshots
6. **Company Logos**: 10 tech company logos (grayscale, honey-gold on hover)

**Treatment**: All screenshots rounded-2xl minimum, shadow-xl, subtle gradient borders (honey-to-mint)

---

## Visual Enhancements

**Honeycomb Motifs**: SVG hexagonal patterns in backgrounds (mint-teal or honey-gold, 3-6% opacity), section transitions with hex grid dividers

**Gradients**: Smooth linear/radial blends (honey-gold to mint-teal) for CTAs, accents, backgrounds. Never harsh transitions.

**Animations** (Minimal):
- Cards: Hover lift + shadow (250ms ease-out)
- Hero hexagons: Slow float drift (30s loop)
- CTA gradient: Subtle shimmer (4s)
- Stats: Count-up on viewport entry
- Agent cards: Glow pulse on hover

**Glow Effects**: Soft, generous shadows with honey-gold or mint-teal tint on interactive elements

---

## Accessibility

- Contrast: 7:1 minimum for body text
- Focus: 3px honey-gold ring with offset
- Reduced motion: Disable animations
- Semantic HTML, ARIA labels
- Form inputs: Consistent styling with mint-teal focus rings