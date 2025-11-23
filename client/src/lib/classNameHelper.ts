/**
 * Centralized className builder to avoid hard-coded Tailwind classes
 * Import from here instead of scattering className strings everywhere
 */

export const classes = {
  // Buttons
  button: {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    outline: 'border border-input hover:bg-accent',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },

  // Cards & Containers
  card: 'rounded-lg border border-border bg-card shadow-sm',
  cardSection: 'rounded-lg border border-border/50 bg-background/50 p-4',

  // Text
  text: {
    heading1: 'text-2xl font-bold',
    heading2: 'text-xl font-bold',
    heading3: 'text-lg font-semibold',
    body: 'text-sm text-foreground',
    bodySecondary: 'text-sm text-muted-foreground',
    small: 'text-xs text-muted-foreground',
  },

  // Layout
  container: 'max-w-7xl mx-auto px-4',
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexColumn: 'flex flex-col',
  grid: {
    cols1: 'grid grid-cols-1',
    cols2: 'grid grid-cols-2 gap-4',
    cols3: 'grid grid-cols-3 gap-4',
    responsive: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  },

  // Spacing
  spacing: {
    p2: 'p-2',
    p3: 'p-3',
    p4: 'p-4',
    m2: 'm-2',
    m3: 'm-3',
    m4: 'm-4',
    gap2: 'gap-2',
    gap3: 'gap-3',
    gap4: 'gap-4',
  },

  // States
  loading: 'opacity-50 pointer-events-none',
  disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
  hover: 'hover:opacity-80 hover:shadow-md transition-all',
  active: 'opacity-100 shadow-lg',

  // Messages/Alerts
  alert: {
    error: 'rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive',
    success: 'rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-green-700',
    warning: 'rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-yellow-700',
    info: 'rounded-lg border border-blue-500/50 bg-blue-500/10 p-3 text-blue-700',
  },

  // Chat
  messageBubble: {
    user: 'bg-primary text-primary-foreground rounded-lg rounded-tr-sm',
    assistant: 'bg-secondary/50 text-foreground rounded-lg rounded-tl-sm',
  },
  avatar: {
    user: 'bg-primary/15 text-primary',
    assistant: 'bg-secondary/20 text-secondary-foreground',
  },

  // Inputs
  input: 'min-h-[44px] rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
  textarea: 'min-h-[100px] rounded-lg border border-border/70 bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',

  // Dividers
  divider: 'border-b border-border',
  dividerVertical: 'border-r border-border',

  // Backgrounds
  bgMuted: 'bg-muted/30',
  bgSecondary: 'bg-secondary/20',
  bgPrimary: 'bg-primary/10',

  // Responsive
  responsiveHidden: 'hidden md:block',
  responsibleVisibleMobile: 'md:hidden',
} as const;

/**
 * Helper to combine multiple class objects
 */
export function combineClasses(...classObjects: (Record<string, string> | string)[]): string {
  return classObjects
    .flatMap(obj => typeof obj === 'string' ? obj : Object.values(obj))
    .filter(Boolean)
    .join(' ');
}

/**
 * Conditional class helper
 */
export function conditionalClass(condition: boolean, trueClass: string, falseClass = ''): string {
  return condition ? trueClass : falseClass;
}
