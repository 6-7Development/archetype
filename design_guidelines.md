# Lomu Platform - Design Guidelines

## Design Approach

**Reference Strategy**: Modern SaaS aesthetic with swarm/hive intelligence theme. Professional credibility with collaborative energy through honey-inspired warmth and mint freshness.

**Core Principle**: Professional-first with swarm intelligence—enterprise trust powered by collaborative AI agents.

---

## Typography System

**Fonts**: 
- Primary: Inter (400, 500, 600, 700) for UI/marketing copy
- Code: JetBrains Mono for technical examples

**Hierarchy**:
- Hero Headline: text-6xl font-bold leading-tight (72px)
- Section Headers: text-4xl font-bold (48px)
- Subheadings: text-2xl font-semibold (30px)
- Body Large: text-xl font-normal (20px) - feature descriptions
- Body: text-base (16px) - standard content
- Small: text-sm (14px) - metadata, captions

---

## Layout System

**Spacing Primitives**: Tailwind units of 4, 6, 8, 12, 16, 20, 24
- Component internal: p-6, gap-4
- Section padding: py-20 desktop, py-12 mobile
- Between major sections: space-y-24

**Container Strategy**:
- Full-width hero: w-full with max-w-7xl inner
- Content sections: max-w-6xl
- Text-heavy areas: max-w-4xl

**Responsive Grid**:
- Features: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Testimonials: grid-cols-1 lg:grid-cols-2
- Stats: grid-cols-2 lg:grid-cols-4
- Mobile: Always single column stacks

---

## Page Structure (7 Core Sections)

### 1. Hero Section (80vh)
**Layout**: Split layout with commanding headline + hero image
- Left: Headline, tagline, dual-CTA (primary + secondary), trust indicator ("Trusted by 500+ dev teams")
- Right: Hero image showing platform UI in action
- Background: Subtle animated gradient (lemon to mint, 12s duration)
- Floating lemon slice decorations (15% opacity) in corners

### 2. Social Proof Bar
**Layout**: Single row, centered
- Company logos (6-8) in grayscale, hover to brand color
- Testimonial highlight: "Lomu cut our debugging time by 60%" - CTO quote

### 3. Features Showcase (3-column grid)
**Layout**: Card-based, icon + title + description
- Each card: rounded-xl, bg-white, subtle shadow, hover lift effect
- Icons: Lucide React, tinted with lemon/mint gradient
- 6-9 feature cards total
- Examples: "AI Pair Programming", "Instant Bug Detection", "Smart Code Completion"

### 4. Platform Preview (Full-width)
**Layout**: Large centered image/video with context
- Heading: "Your AI Coding Companion in Action"
- Platform screenshot/demo video
- Surrounding UI: Floating annotation cards pointing to key features
- Background: Cream base with subtle lemon slice watermarks

### 5. Benefits Grid (2-column alternating)
**Layout**: Image-text alternating rows
- 3 rows total, each with image + benefit explanation
- Row 1: Image left, "Write Code Faster"
- Row 2: Image right, "Debug with Confidence"  
- Row 3: Image left, "Ship with Peace of Mind"
- Images show real platform usage scenarios

### 6. Testimonials (2-column grid)
**Layout**: Quote cards with avatars
- 4-6 testimonial cards
- Each: Customer photo, quote, name, title, company
- Card styling: White background, left border accent (lemon)
- Background: Very light mint tint (5% opacity)

### 7. Final CTA Section
**Layout**: Centered, generous padding
- Headline: "Ready to Make Your Code Sweet?"
- Subtext: "Join thousands of developers who turned lemons into lemonade"
- Dual CTAs: "Start Free Trial" + "Book a Demo"
- Background: Gradient bloom (lemon to citrus bloom)
- Lumo mascot illustration (subtle, corner placement)

---

## Component Library

### Buttons
**Primary** (Sparkling Lemon bg):
- px-8 py-4, rounded-full, text-slate-professional
- Font: font-semibold text-lg
- Shadow: warm glow on hover
- If on image: backdrop-blur-md bg-sparkling-lemon/90

**Secondary** (Outline):
- border-2 border-fresh-mint, bg-transparent
- Hover: bg-fresh-mint/10

### Cards
**Standard Card**:
- rounded-xl, bg-white, p-8
- border border-slate-100
- Hover: shadow-lg, translateY(-2px)

**Feature Card** (specific):
- Icon container: w-14 h-14, rounded-lg, gradient bg
- Title: text-xl font-semibold mb-3
- Description: text-muted leading-relaxed

### Navigation
**Header**: Sticky, backdrop-blur-xl, border-b
- Logo left, nav center, CTA right
- Links: font-medium, hover:text-lemon transition

**Footer**: Multi-column (4 columns desktop, stack mobile)
- Product, Company, Resources, Legal columns
- Social icons with mint hover states
- Newsletter signup with lemon CTA button

---

## Images

**Required Images**:
1. **Hero Image** (Right side): Platform dashboard screenshot showing AI suggestions panel, code editor, Lumo avatar - bright, clean UI with lemon accent colors visible
2. **Platform Preview**: Full IDE view with multiple panels, active AI chat, syntax highlighting
3. **Benefit Images** (3 total): 
   - Developer at desk with laptop showing Lomu
   - Close-up of AI debugging in action
   - Team celebrating shipping code
4. **Testimonial Avatars**: 4-6 professional headshots (developers/CTOs)
5. **Company Logos**: 6-8 recognizable tech companies (grayscale treatment)

**Image Treatment**:
- All screenshots: Subtle shadow, slight rotation (2deg) for dynamism
- Photos: Warm color grade matching lemon palette
- Rounded corners: rounded-2xl for images

---

## Visual Enhancements

**Lemon Motifs** (Strategic placement):
- Hero corners: Floating lemon slice SVGs (opacity 15%)
- Section dividers: Subtle seed pattern texture (opacity 8%)
- Loading states: Lemonade jar animation
- Empty states: Lumo mascot illustrations

**Animations** (Minimal, purposeful):
- Hero gradient: 12s slow shift
- Cards: Hover lift (transform translateY -4px, 200ms)
- Lumo breathing: Subtle scale pulse on load completion
- NO scroll-triggered animations (keep it fast)

---

## Dark Mode Adjustments

**Background System**:
- Base: hsl(220 20% 12%)
- Surface cards: hsl(220 18% 16%)
- Borders: hsl(220 15% 25%)

**Color Adaptations**:
- Sparkling Lemon: 50 90% 52% (muted but vibrant)
- Fresh Mint: 145 52% 38%
- Text: Cream base for primary text

**Maintain**: Lemon jar animation with adjusted colors, Lumo mascot unchanged

---

## Accessibility

- Contrast ratios: Minimum 4.5:1 for all text
- Focus indicators: 3px lemon ring on interactive elements
- Reduced motion: Disable gradient animations, keep functional transitions
- Semantic HTML: Proper heading hierarchy, landmark regions

---

**Brand Voice in Copy**: Friendly encouragement ("Turn those bugs into features!"), clear value ("Ship 3x faster with AI"), professional credibility ("Enterprise-grade security")