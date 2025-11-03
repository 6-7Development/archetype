/**
 * Design guidelines generation tool for Lomu AI
 * Creates design systems for new UI projects
 */

import fs from 'fs/promises';
import path from 'path';

export interface DesignGuidelinesResult {
  success: boolean;
  message: string;
  filePath?: string;
  content?: string;
  error?: string;
}

/**
 * Generate design guidelines document
 * Creates a comprehensive design system based on description
 */
export async function generateDesignGuidelines(params: {
  description: string;
  projectName?: string;
  colorScheme?: 'light' | 'dark' | 'both';
  includeComponents?: boolean;
}): Promise<DesignGuidelinesResult> {
  const {
    description,
    projectName = 'Project',
    colorScheme = 'both',
    includeComponents = true,
  } = params;
  
  try {
    // Generate design guidelines content
    const content = `# Design Guidelines: ${projectName}

## Overview
${description}

## Design Philosophy

**Core Principles**:
- **Consistency**: Maintain visual and functional consistency throughout the application
- **Accessibility**: Ensure WCAG 2.1 AA compliance
- **Responsiveness**: Mobile-first, adaptive design
- **Performance**: Optimize for fast load times and smooth interactions

## Color Palette

### ${colorScheme === 'light' || colorScheme === 'both' ? 'Light Mode' : 'Dark Mode'}
**Foundation Colors**:
- Primary: HSL format (define based on brand)
- Secondary: Complementary color
- Accent: Highlight color for CTAs
- Background: Base surface color
- Foreground: Text color

**Semantic Colors**:
- Success: Green variants
- Warning: Yellow/Orange variants
- Error: Red variants
- Info: Blue variants
- Muted: Gray variants

${colorScheme === 'both' ? `
### Dark Mode
**Adjustments**:
- Invert background/foreground
- Reduce saturation slightly
- Maintain sufficient contrast (4.5:1 minimum)
` : ''}

## Typography

**Font Family**:
- Primary: Inter, system-ui, sans-serif
- Monospace: 'JetBrains Mono', Consolas, monospace

**Type Scale**:
- Hero: 3rem (48px) - Major headlines
- H1: 2rem (32px) - Page titles
- H2: 1.5rem (24px) - Section headers
- H3: 1.25rem (20px) - Subsections
- Body: 1rem (16px) - Main content
- Small: 0.875rem (14px) - Secondary text
- Tiny: 0.75rem (12px) - Metadata

## Spacing

**Scale**: Based on 4px base unit
- xs: 0.25rem (4px)
- sm: 0.5rem (8px)
- md: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)
- 2xl: 3rem (48px)

## Layout

**Breakpoints**:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Container Widths**:
- Max content: 1280px
- Reading width: 720px

${includeComponents ? `
## Component Library

### Buttons
**Variants**:
- Primary: Main actions (filled background)
- Secondary: Alternative actions (outlined)
- Ghost: Subtle actions (transparent)
- Destructive: Dangerous actions (red)

**Sizes**: sm, md (default), lg

### Cards
**Structure**:
- Border radius: 8px (rounded-lg)
- Shadow: Subtle elevation
- Padding: 1rem minimum

### Forms
**Guidelines**:
- Label above input (mobile-friendly)
- Clear error messages below field
- Disabled states with reduced opacity
- Focus indicators (ring)

### Navigation
**Patterns**:
- Top nav for main navigation
- Sidebar for secondary navigation
- Breadcrumbs for hierarchy
- Mobile: Hamburger menu or bottom tabs
` : ''}

## Accessibility

**Requirements**:
- Color contrast >= 4.5:1 for text
- Focus indicators on all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Alt text for images
- ARIA labels where needed

## Animation & Motion

**Timing**:
- Micro: 150ms (hover states)
- Normal: 200-300ms (transitions)
- Slow: 400-500ms (complex animations)

**Easing**: Use ease-in-out for natural feel

**Principles**:
- Respect prefers-reduced-motion
- Don't animate layout shifts
- Use transform for better performance

## Icons

**System**: Lucide React (preferred) or Heroicons
**Size**: 16px, 20px, 24px
**Usage**: Consistent sizing within components

---

Generated: ${new Date().toISOString()}
`;

    // Optionally save to file in attached_assets
    const fileName = `design_guidelines_${Date.now()}.md`;
    const filePath = path.join(process.cwd(), 'attached_assets', fileName);
    
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      
      return {
        success: true,
        message: `Design guidelines generated successfully for ${projectName}`,
        filePath: fileName,
        content,
      };
    } catch (writeError) {
      // If can't write file, just return content
      return {
        success: true,
        message: `Design guidelines generated (file write failed, returning content only)`,
        content,
      };
    }
  } catch (error: any) {
    console.error('[GENERATE-DESIGN-GUIDELINES] Error:', error);
    return {
      success: false,
      message: `Failed to generate design guidelines: ${error.message}`,
      error: error.message,
    };
  }
}
