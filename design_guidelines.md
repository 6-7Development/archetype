# Design Guidelines: Archetype - Console-First Interface

## Design Approach

**Selected Approach**: Command Console-Based (Terminal/CLI Inspired + Fortune 500 Polish)

**Rationale**: AI-powered website/webapp builder where users give natural language commands. The console is the hero element - center stage, large, and prominent. Drawing inspiration from professional terminal interfaces (iTerm2, Hyper) combined with enterprise sophistication.

**Core Principles**:
- Console-first interaction: Large, prominent command input as primary UI
- Command history visibility: Clear display of past commands and results
- Result preview: Generated code displayed elegantly post-command
- Enterprise sophistication: Polished visuals with corporate aesthetics
- Trust through design: Professional interface signals reliability

## Core Design Elements

### A. Color Palette

**Dark Mode (Enterprise)**:
- Background Deep: 220 20% 12%
- Background Surface: 220 18% 16%
- Background Elevated: 220 16% 20%
- Card Background: 220 15% 18%
- Border Default: 220 15% 28%
- Border Accent: 220 60% 50%
- Text Primary: 220 8% 98%
- Text Secondary: 220 10% 72%
- Text Muted: 220 12% 55%
- Navy Accent: 220 70% 60% (primary actions, active states)
- Slate Accent: 210 20% 65% (secondary highlights)
- Success: 142 65% 48%
- Warning: 38 88% 52%
- Error: 0 80% 62%
- Console Prompt: 142 65% 58% (terminal green)

**Light Mode (Corporate)**:
- Background: 220 15% 98%
- Surface: 0 0% 100%
- Card Background: 220 20% 99%
- Elevated: 220 25% 97%
- Border: 220 15% 88%
- Text Primary: 220 20% 18%
- Text Secondary: 220 15% 42%
- Navy Primary: 220 85% 42%
- Slate Secondary: 210 25% 48%
- Console Prompt: 142 70% 38% (darker green for light mode)

### B. Typography

**Font Stack**:
- UI Text: Inter (weights 400, 500, 600, 700 via Google Fonts)
- Console/Code: 'JetBrains Mono', 'SF Mono', Consolas, monospace

**Type Scale**:
- Console Command: text-base monospace font-normal
- Console Output: text-sm monospace font-normal
- Panel Headers: text-base font-semibold tracking-tight
- Interface Text: text-sm font-medium
- Secondary Text: text-xs font-normal

### C. Layout System

**Console-First Architecture**:
- Main focus: Large command console taking center stage (60-70% of viewport)
- Secondary: Code preview panel (collapsible, shows generated files)
- Tertiary: Project files sidebar (minimal, shows generated structure)

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8 for professional rhythm
- Console padding: p-6 for breathing room
- Card spacing: gap-4 between elements
- Generous spacing: p-8 for main containers

**Grid Structure**:
```
┌─────────────────────────────────────────────────────┐
│ Top Bar (h-14) - Branding, Status, Theme Toggle     │
├────┬────────────────────────────────────┬───────────┤
│ P  │                                    │           │
│ r  │   COMMAND CONSOLE (Main Focus)     │  Preview  │
│ o  │   ┌──────────────────────────────┐ │  Panel    │
│ j  │   │ Command History              │ │  (Code)   │
│ e  │   │ > build a coffee shop site   │ │           │
│ c  │   │ ✓ Generated 5 files          │ │  (Collap- │
│ t  │   │                              │ │   sible)  │
│    │   │ > create todo app...         │ │           │
│ F  │   │ ⟳ Processing...              │ │           │
│ i  │   ├──────────────────────────────┤ │           │
│ l  │   │ > █                          │ │           │
│ e  │   │ (Command Input - Large)      │ │           │
│ s  │   └──────────────────────────────┘ │           │
│    │                                    │           │
├────┴────────────────────────────────────┴───────────┤
│ Status Bar - Connection, File Count, AI Model        │
└─────────────────────────────────────────────────────┘
```

### D. Component Library

**Command Console (Hero Component)**:
- Large card elevation with shadow-xl
- Command history scrollable area with monospace font
- Command entries show: prompt symbol (>), command text, status icon
- Processing state: animated dots or spinner
- Success state: checkmark with file count
- Error state: red X with error message
- Command input: Large text area with console styling, auto-focus
- Prompt indicator: Terminal-style ">" or "$" in accent color

**Command History Display**:
- Each command as a row with timestamp
- Status indicators: ✓ (success), ⟳ (processing), ✗ (error)
- Expandable to show generated files list
- Hover to show full response details
- Click to re-run or edit command

**Code Preview Panel**:
- Monaco editor with generated code
- File tabs for multiple generated files
- Language badges for file types
- Copy code button
- Download project button
- Collapsible to give console more space

**Project Files Sidebar**:
- Minimal file tree showing generated structure
- Click to preview file in Monaco
- Language badges
- Generated file indicator (new badge)
- Collapsible to maximize console space

**Navigation & Structure**:
- Top Bar: Minimal - logo, "AI Builder" title, model badge, theme toggle
- No activity bar (not needed for console-first approach)
- Focus on command input and output

**Forms & Inputs**:
- Command Input: Large textarea with monospace, auto-expand, Enter to submit
- Primary Buttons: bg-navy text-white shadow-md hover:shadow-lg
- Secondary Buttons: border-2 border-slate bg-surface hover:bg-elevated

**Data Display**:
- Command log: Terminal-style output with syntax highlighting for responses
- File tree: Minimal hierarchical display
- Status indicators: Pill badges with color coding

### E. Micro-Interactions

**Polished Motion**:
- Command submission: Input slides up, response streams in
- Command history: Smooth scroll with fade-in for new entries
- Panel transitions: 200ms cubic-bezier(0.4, 0, 0.2, 1)
- Code preview: Slide-in from right when opened
- Processing animation: Pulsing dots or smooth spinner

**Interactive States**:
- Focus on command input: ring-2 ring-navy with glow
- Command hover: Subtle elevation increase
- Command submit: Brief highlight flash
- AI response streaming: Typing effect for text reveal

## Layout Architecture

### Console-First Workspace

**Desktop Layout** (>1280px):
```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar (h-14) - Minimal header with branding               │
├────┬────────────────────────────────────────┬───────────────┤
│ P  │ COMMAND CONSOLE CARD                   │ Code Preview  │
│ r  │ ┌────────────────────────────────────┐ │ (Collapsible) │
│ o  │ │ Command History (scrollable)       │ │               │
│ j  │ │                                    │ │ ┌───────────┐ │
│ e  │ │ > build landing page               │ │ │ File Tabs │ │
│ c  │ │ ✓ Generated 3 files                │ │ ├───────────┤ │
│ t  │ │                                    │ │ │           │ │
│    │ │ > create todo app                  │ │ │  Monaco   │ │
│ F  │ │ ⟳ Processing...                    │ │ │  Editor   │ │
│ i  │ │                                    │ │ │           │ │
│ l  │ ├────────────────────────────────────┤ │ │           │ │
│ e  │ │ > █                                │ │ └───────────┘ │
│ s  │ │ (Large command input area)         │ │               │
│    │ └────────────────────────────────────┘ │               │
├────┴────────────────────────────────────────┴───────────────┤
│ Status Bar - AI Model: GPT-4o | Files: 12 | Connected       │
└─────────────────────────────────────────────────────────────┘
```

**Console Sizing**:
- Project Files Sidebar: 280px (minimal, collapsible)
- Command Console: flex-1 (60-70% of space, hero element)
- Code Preview: 500px (collapsible, can hide to maximize console)

**Responsive Adaptation**:
- Tablet: Stack panels vertically, console takes full width
- Mobile: Full-screen console with drawer for preview/files

## Visual Refinements

**Shadow System**:
- Console card: shadow-xl (prominent, hero element)
- Command entries: shadow-sm on hover
- Code preview: shadow-lg when active
- Modals: shadow-2xl for dialogs

**Console Aesthetics**:
- Terminal-inspired prompt symbol (> or $) in accent color
- Monospace font for all console text
- Command history with subtle separators
- Processing states with animated indicators
- Success/error states with color-coded icons

**Corporate Polish**:
- All cards rounded-lg (8px radius)
- Smooth animations for command submission
- Professional color scheme for terminal output
- Enterprise-grade visual hierarchy

**Dark Mode Excellence**:
- Console background matches terminal aesthetics
- Syntax highlighting for command responses
- High contrast for readability
- Professional appearance

## Command Interface Patterns

**Command Examples**:
- "build a landing page for a coffee shop"
- "create a todo app with dark mode"
- "make a portfolio website"
- "build an e-commerce product page"
- "create a dashboard with charts"

**Command Feedback**:
- Instant visual feedback on submit
- Processing indicator while AI works
- Streaming response with file count
- Success notification with preview option
- Error messages with helpful suggestions

**User Flow**:
1. User types natural language command
2. Press Enter or click Submit
3. Command appears in history with processing state
4. AI generates project structure
5. Success state shows file count and preview
6. User can view code in preview panel
7. User can download or modify project

This design delivers a console-first AI builder experience with Fortune 500 polish - making command-based website creation feel professional and powerful.
