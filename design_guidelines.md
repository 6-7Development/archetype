# Lomu Platform - Design Guidelines

## Design Approach

**Reference Strategy**: Modern developer tools aesthetic inspired by VS Code, Cursor, and Linear. Bold, high-contrast interface with vibrant honey-gold and mint-teal accents against deep charcoal. Professional power with collaborative hive intelligence energy.

**Core Principle**: Developer-first precision with swarm intelligence—enterprise trust through bold, confident design.

---

## Typography System

**Fonts**: 
- Primary: Inter (500, 600, 700) for UI/marketing
- Code: JetBrains Mono for technical examples
- Display: Inter (800) for impactful headlines

**Hierarchy**:
- Hero Headline: text-7xl font-extrabold leading-none tracking-tight (96px)
- Section Headers: text-5xl font-bold tracking-tight (48px)
- Feature Titles: text-3xl font-bold (36px)
- Body Large: text-xl font-medium (20px)
- Body: text-base font-normal (16px)
- Code/Technical: text-sm font-mono (14px)

---

## Layout System

**Spacing Primitives**: Tailwind units of 4, 6, 8, 12, 16, 20, 24, 32
- Cards: p-8, gap-6
- Section padding: py-24 desktop, py-16 mobile
- Major section gaps: space-y-32

**Container Strategy**:
- Full-width: w-full with max-w-7xl inner
- Content: max-w-6xl
- Text-focused: max-w-4xl

**Grid System**:
- Features: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8
- Benefits: lg:grid-cols-2 gap-12
- Stats: grid-cols-2 lg:grid-cols-4 gap-8

---

## Page Structure (8 Sections)

### 1. Hero Section (90vh, Full-Width)
**Layout**: Centered with powerful imagery
- Headline (max-w-5xl): Bold statement about AI coding power
- Tagline: Single line emphasizing speed/intelligence
- Dual CTAs: Primary "Start Building" + Secondary "Watch Demo"
- Trust bar below CTAs: "Trusted by 10,000+ developers at [company logos]"
- Background: Large hero image showing Lomu IDE with glowing mint accent highlights, code completions visible, AI chat panel active
- Treatment: Gradient overlay (charcoal to transparent) for text readability
- Accent: Subtle hexagonal grid pattern overlay (honey-gold, 5% opacity)

### 2. Stats Bar (Dark Charcoal Background)
**Layout**: 4-column grid, centered
- Large numbers (text-5xl font-bold honey-gold) with labels
- Examples: "10K+ Developers", "99.9% Uptime", "60% Faster", "24/7 AI"
- Glowing separator lines between stats (mint-teal, 1px)

### 3. Features Grid (3-Column)
**Layout**: Elevated cards with glow effects
- 6 feature cards total
- Card styling: Deep charcoal background, honey-gold border (2px), rounded-2xl, p-8
- Hover: Lift (translateY -8px) + mint-teal glow shadow
- Each card: Icon (gradient honey-to-mint), bold title, description
- Icons: Lucide React, 48px size
- Features: AI Pair Programming, Real-time Bug Detection, Smart Completions, Context-Aware Chat, Team Sync, Security Scanning

### 4. Platform Showcase (Full-Width, Light Background)
**Layout**: Large IDE screenshot with floating feature callouts
- Heading: "Your AI Command Center"
- Center: Large platform screenshot (rounded-3xl, shadow-2xl with mint glow)
- Screenshot shows: Split editor view, active AI panel, syntax highlighting with honey accents
- 4-6 floating annotation cards pointing to features (small cards with arrows)
- Background: Light cream with subtle honeycomb SVG pattern (8% opacity)

### 5. Benefits Section (2-Column Alternating)
**Layout**: Image-text pairs, 3 rows
- Row 1 (Image Right): "Write Code 3x Faster" - Screenshot of AI autocomplete
- Row 2 (Image Left): "Debug with Confidence" - Error detection panel
- Row 3 (Image Right): "Ship Production-Ready Code" - Testing dashboard
- Images: Elevated cards with honey-gold glow borders
- Text: Bold headline + 2-3 sentence description + metrics

### 6. Code Example Showcase (Dark Background)
**Layout**: Side-by-side comparison or interactive demo
- Heading: "See Lomu in Action"
- Code editor mockup showing before/after with AI suggestions
- Syntax highlighting: Honey-gold for functions, mint-teal for strings
- Background: Deep charcoal with hexagonal pattern

### 7. Testimonials (3-Column Grid, Light Background)
**Layout**: Quote cards with developer focus
- 6 testimonial cards
- Card: White background, mint-teal left border accent (4px), rounded-xl, p-6
- Content: Quote text, avatar (circular, honey-gold ring), name, title/company
- GitHub star icons for developer credibility
- Background: Soft mint tint (3% opacity)

### 8. Final CTA (Full-Width, Dark Gradient)
**Layout**: Centered, dramatic
- Headline: "Ready to Code with AI Power?"
- Subtext: "Join the hive. Ship faster. Build better."
- Large primary CTA: "Start Free Trial" (honey-gold, glowing)
- Secondary: "Talk to Sales" (outline)
- Background: Radial gradient (charcoal to darker charcoal) with animated hexagonal grid (mint-teal glow)
- Floating Lumo mascot (bottom right, waving)

---

## Component Library

### Buttons
**Primary** (Honey-Gold):
- px-10 py-4, rounded-lg, font-semibold text-lg
- bg-honey-gold text-charcoal
- Hover: Subtle lift + brighter glow shadow (honey-gold/50)
- On images: backdrop-blur-lg bg-honey-gold/95 (no hover states)

**Secondary** (Outline):
- border-2 border-mint-teal, text-mint-teal
- Hover: bg-mint-teal/10 + glow

### Cards
**Elevated Feature Card**:
- rounded-2xl, p-8, bg-charcoal-dark
- border-2 border-honey-gold/20
- Hover: shadow-2xl shadow-mint-teal/20, translateY(-8px), border-honey-gold/40
- Transition: all 300ms ease

**Standard Card**:
- rounded-xl, bg-white, p-6
- border border-gray-200
- Hover: shadow-lg, slight lift

### Navigation
**Header**: Sticky, bg-charcoal/95 backdrop-blur-xl, border-b border-honey-gold/10
- Logo left (with honey-gold accent), nav center, CTA right
- Links: font-semibold, text-gray-300, hover:text-honey-gold transition

**Footer**: 4-column dark charcoal background
- Columns: Product, Resources, Company, Community
- Social icons with mint-teal hover glow
- Bottom bar: Newsletter signup with honey-gold CTA

---

## Images Required

1. **Hero Background**: Full IDE screenshot with active AI features, glowing mint highlights, multiple code panels visible
2. **Platform Showcase**: Detailed IDE view with split panels, AI chat, code completions, debugging panel
3. **Benefit Screenshots** (3): Autocomplete in action, bug detection panel, deployment dashboard
4. **Testimonial Avatars**: 6 developer headshots
5. **Company Logos**: 8-10 tech company logos (grayscale with honey-gold on hover)

**Treatment**: All screenshots with rounded-3xl, shadow-2xl, subtle honey-gold or mint-teal glow borders

---

## Visual Enhancements

**Hexagonal Motifs**: Honeycomb patterns in backgrounds (subtle, 5-8% opacity), section dividers with hex grid lines

**Animations**:
- Cards: Hover lift + glow (300ms ease-out)
- CTA buttons: Pulse glow on primary (subtle, 2s loop)
- Hero background: Slow hexagonal grid shimmer (20s)
- Stats: Count-up animation on scroll into view
- NO excessive scroll animations

**Glow Accents**: Interactive elements get mint-teal or honey-gold shadow glow on hover/focus

---

## Accessibility

- Contrast: Minimum 7:1 for body text on charcoal
- Focus rings: 3px honey-gold with offset
- Reduced motion: Disable glows/animations
- Semantic HTML throughout