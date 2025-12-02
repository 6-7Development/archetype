# BeeHive Mascot Implementation - Working Setup Guide

## Quick Reference

This is the **complete working mascot setup from BeeHive**. Share this guide to troubleshoot mascot rendering issues in other Replit projects.

---

## Architecture Overview

The mascot system has 3 core layers:

### Layer 1: Queen Bee Context (`client/src/contexts/queen-bee-context.tsx`)
**Manages**: Emotional state, hover detection, AI activity tracking

**18 Emotional States**:
- IDLE, LISTENING, TYPING, THINKING, CODING, BUILDING
- SUCCESS, ERROR, SWARM, LOADING, CURIOUS, ALERT
- EXCITED, HELPFUL, SLEEPY, CELEBRATING, CONFUSED, FOCUSED

### Layer 2: Floating Queen Bee (`client/src/components/floating-queen-bee.tsx`)
**Manages**: Visual rendering, drag interactions, worker bees, seasonal themes

**Features**:
- Draggable position + grip handle
- Worker bees spawn near queen (not random)
- Tooltip/thought bubble display
- Christmas season detection (Nov 15 - Jan 5)
- Falling snowflakes with deterministic animation

### Layer 3: Queen Bee Canvas (`client/src/components/queen-bee-canvas.tsx`)
**Manages**: SVG 2D rendering with 5 visual states

---

## Critical Implementation Details

### 1. Tooltip Hover Management (Most Important)

**Problem**: Tooltips disappear immediately when moving between hinted UI elements

**Solution**: Use a ref to track and cancel pending timeouts

```typescript
// In context initialization:
const hintClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// In mouseover handler - CANCEL any pending timeout:
const handleMouseOver = (e: MouseEvent) => {
  // ... detect hint ...
  
  if (detectedHint && ELEMENT_HINTS[detectedHint]) {
    // CRITICAL: Cancel pending timeout when entering new hinted element
    if (hintClearTimeoutRef.current) {
      clearTimeout(hintClearTimeoutRef.current);
      hintClearTimeoutRef.current = null;
    }
    
    setCurrentHint(ELEMENT_HINTS[detectedHint]);
  }
};

// In mouseout handler - STORE timeout for cancellation:
const handleMouseOut = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const relatedTarget = e.relatedTarget as HTMLElement | null;
  
  // ... detect current and next hinted elements ...
  
  // Detect if newTestId would produce a valid hint
  const wouldNewTestIdProduceHint = newTestId && (
    newTestId.includes('login') || newTestId.includes('signin') ||
    newTestId.includes('signup') || newTestId.includes('register') ||
    newTestId.includes('pricing') || newTestId.includes('preview') ||
    newTestId.includes('chat') || newTestId.includes('message') ||
    newTestId.includes('file') || newTestId.includes('browser') ||
    newTestId.includes('terminal') || newTestId.includes('deploy') ||
    newTestId.includes('publish') || newTestId.includes('setting') ||
    newTestId.includes('theme') || newTestId.includes('dashboard') ||
    newTestId.includes('new-project') || newTestId.includes('create-project')
  );
  
  const isEnteringHintedElement = !!(newHintKey && ELEMENT_HINTS[newHintKey]) || wouldNewTestIdProduceHint;
  
  // Only schedule clear if leaving a hinted element AND not entering another
  if ((hintKey || testId) && !isEnteringHintedElement) {
    if (hintClearTimeoutRef.current) {
      clearTimeout(hintClearTimeoutRef.current);
    }
    
    // 2000ms display duration is CRITICAL for smooth UX
    hintClearTimeoutRef.current = setTimeout(() => {
      setCurrentHint(null);
      // ... reset mode if needed ...
      hintClearTimeoutRef.current = null;
    }, 2000);
  }
};

// In useEffect cleanup - ALWAYS clear timeout on unmount:
return () => {
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);
  if (hintClearTimeoutRef.current) {
    clearTimeout(hintClearTimeoutRef.current);
  }
};
```

### 2. Client-Safe Snowflake Animation (SSR Safety)

**Problem**: Hydration mismatch with randomized snowflake positions

**Solution**: Use deterministic positions based on particle ID

```typescript
function FallingSnowflake({ id, startX, delay, windowHeight }: SnowflakeProps) {
  // CRITICAL: Use stable scale based on id, NOT random()
  const scale = useMemo(() => 0.5 + (id % 10) * 0.05, [id]);
  const duration = useMemo(() => 8 + (id % 5), [id]);
  
  return (
    <motion.div
      className="fixed pointer-events-none z-[95]"
      initial={{ 
        x: startX, 
        y: -20, 
        opacity: 0.8,
        rotate: 0,
        scale,
      }}
      animate={{ 
        y: [null, windowHeight + 20],
        x: [null, startX + Math.sin(id) * 50], // Deterministic sway
        opacity: [0.8, 0.6, 0.4, 0],
        rotate: [0, 360],
      }}
      transition={{ 
        duration,
        delay: delay,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <Snowflake className="w-3 h-3 text-blue-200 drop-shadow-md" />
    </motion.div>
  );
}
```

### 3. Seasonal Christmas Theme Detection

**Simple and Reliable**:

```typescript
function isChristmasSeason(): boolean {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0=Jan, 11=Dec)
  const day = now.getDate();
  
  // November 15 - December 31
  if (month === 10 && day >= 15) return true;
  if (month === 11) return true;
  // January 1-5
  if (month === 0 && day <= 5) return true;
  
  return false;
}
```

**Christmas Messages** (All 18 modes):

```typescript
const CHRISTMAS_MESSAGES: Record<QueenBeeMode, string> = {
  'IDLE': 'Ho ho ho! Merry coding!',
  'LISTENING': 'Santa Bee is listening...',
  'TYPING': 'Writing your wishlist...',
  'THINKING': 'Checking the nice list...',
  'CODING': 'Coding presents!',
  'BUILDING': 'Building a toy factory!',
  'SUCCESS': 'Gift wrapped!',
  'ERROR': 'Uh oh, coal!',
  'SWARM': 'Elf swarm activated!',
  'LOADING': 'Loading the sleigh...',
  'CURIOUS': 'Peeking at presents?',
  'ALERT': 'Jingle alert!',
  'EXCITED': 'Holiday cheer!',
  'HELPFUL': 'Spreading joy!',
  'SLEEPY': 'Dreaming of sugarplums...',
  'CELEBRATING': 'Merry celebration!',
  'CONFUSED': 'Tangled lights?',
  'FOCUSED': 'Wrapping focus!',
};
```

---

## Setup Instructions

### Step 1: Copy Core Files

```
From BeeHive → To Your Project:
client/src/contexts/queen-bee-context.tsx
client/src/components/floating-queen-bee.tsx
client/src/components/queen-bee-canvas.tsx
```

### Step 2: Wrap App with Context Provider

```jsx
// App.tsx
import { QueenBeeProvider } from '@/contexts/queen-bee-context';

export default function App() {
  return (
    <QueenBeeProvider>
      <YourThemeProvider>
        {/* Your routes and content */}
      </YourThemeProvider>
    </QueenBeeProvider>
  );
}
```

### Step 3: Add Mascot to Layout

```jsx
import { FloatingQueenBee } from '@/components/floating-queen-bee';

export default function YourLayout() {
  return (
    <>
      {/* Your main content */}
      <FloatingQueenBee />
    </>
  );
}
```

### Step 4: Add Data Attributes for Hints

```jsx
// On UI elements you want the mascot to react to:
<Button data-bee-hint="chat">Start Chat</Button>
<Button data-testid="button-deploy">Deploy Now</Button>
<Button data-testid="link-settings">Settings</Button>
```

---

## Troubleshooting Checklist

### Mascot Not Appearing
- [ ] Is `QueenBeeProvider` wrapping the entire app?
- [ ] Is `FloatingQueenBee` component in your layout?
- [ ] Check z-index: Should be `z-[100]` or higher
- [ ] Check CSS: Parent element has `position: relative`?
- [ ] Check console for import errors

### Tooltips Disappearing Too Fast
- [ ] Verify `hintClearTimeoutRef` is created with `useRef`
- [ ] Verify timeout is cleared in mouseover handler
- [ ] Verify timeout is stored and can be cancelled
- [ ] Test timeout duration is 2000ms (not less)
- [ ] Check that cleanup in useEffect unmounts properly

### Snowflakes Cause Errors
- [ ] Ensure snowflake scale uses `useMemo` with ID-based calculation
- [ ] Ensure no `Math.random()` during render
- [ ] Ensure window height passed as prop (not accessed directly)
- [ ] Check for hydration warnings in console

### Christmas Theme Not Showing
- [ ] Verify current date: Check `new Date().getMonth()` and `.getDate()`
- [ ] Should return true if Nov 15+ through Jan 5
- [ ] Check `isChristmasSeason()` function logic
- [ ] Test in browser console:
  ```javascript
  const now = new Date();
  console.log(now.getMonth(), now.getDate()); 
  // Should match ranges above for Christmas theme
  ```

### Worker Bees Spawning Wrong
- [ ] Verify worker bees use queen's position as origin
- [ ] Should spawn NEAR queen, not random screen locations
- [ ] Check that offset calculation uses queen's x/y

---

## Icon Library

Uses `lucide-react` exclusively (NO emoji):

```javascript
import { 
  Snowflake, Gift, Star, TreePine, Candy,
  PartyPopper, Heart, Zap, Coffee, Sparkles,
  Brain, Code, Hammer, CheckCircle, Bell, Bug,
  Lightbulb, Moon, HelpCircle, Target, Hand,
  Keyboard, ScrollText, Ear, Pencil, RefreshCw,
  GripVertical
} from 'lucide-react';
```

---

## Performance Tips

1. **Canvas Rendering**: Uses requestAnimationFrame (60fps)
2. **Memory**: Snowflakes repeat infinitely (Framer Motion handles cleanup)
3. **Event Listeners**: Properly added and removed on mount/unmount
4. **Timeouts**: Always stored as refs for cancellation
5. **Framer Motion**: Ensures smooth animations, GPU acceleration

---

## Common Integration Points

### Trigger Emotional Responses

```jsx
import { useQueenBee } from '@/contexts/queen-bee-context';

export default function ChatComponent() {
  const { setMode, triggerError } = useQueenBee();

  const handleUserTyping = () => setMode('LISTENING');
  
  const handleAIResponse = () => {
    setMode('TYPING');
    // ... when done:
    setMode('SUCCESS');
  };
  
  const handleCodeChange = () => setMode('CODING');
  
  const handleError = (msg) => triggerError(msg);
  
  return (/* JSX */);
}
```

---

## Quick Testing

1. **Drag mascot** - Should move smoothly with woosh effect
2. **Hover buttons** - Tooltip appears, stays visible on move, disappears 2s after leaving
3. **Click elements** - Mascot reacts with `CURIOUS` mode
4. **Inactive 30s+** - Mascot goes `SLEEPY`
5. **Dec 2-Jan 5** - Santa hat visible, snowflakes falling, festive messages
6. **Mobile** - Responsive sizing, touch-friendly position

---

## Files Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `queen-bee-context.tsx` | State management, AI brain connection | `useQueenBee()`, `QueenBeeProvider`, `QueenBeeMode` |
| `floating-queen-bee.tsx` | UI component, drag, workers, seasonal | `FloatingQueenBee` component |
| `queen-bee-canvas.tsx` | SVG rendering, animation states | `QueenBeeCanvas` component, `BeeMode` |

---

## Support Notes

- All files are **fully TypeScript typed** for IDE support
- Context uses **custom events** for external state management
- Animations are **GPU-accelerated** via Framer Motion
- Mobile support is **built-in** with responsive sizing
- Christmas theme is **completely automatic** (date-based)

**Need help?** Check the context provider - it has detailed JSDoc comments explaining every feature.
