/**
 * BeeHive Logo Demo - Editable Showcase
 * Customize colors, sizes, and variants here
 */

import { BeeHiveLogo } from '@/components/beehive-logo';

export default function LogoDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream to-white dark:from-charcoal dark:to-graphite p-8">
      <div className="max-w-4xl mx-auto">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-black text-charcoal dark:text-cream mb-2">
            BeeHive Logo
          </h1>
          <p className="text-muted-foreground">
            Fully editable React component. Customize in <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">client/src/components/beehive-logo.tsx</code>
          </p>
        </div>

        {/* Size Variants */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-charcoal dark:text-cream mb-6">Sizes</h2>
          <div className="grid grid-cols-3 gap-8 p-8 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center gap-4">
              <BeeHiveLogo size="sm" />
              <span className="text-sm text-muted-foreground">Small</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BeeHiveLogo size="md" />
              <span className="text-sm text-muted-foreground">Medium</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BeeHiveLogo size="lg" />
              <span className="text-sm text-muted-foreground">Large</span>
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-charcoal dark:text-cream mb-6">Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center gap-4">
              <BeeHiveLogo variant="icon-only" size="lg" />
              <span className="text-sm text-muted-foreground">Icon Only</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BeeHiveLogo variant="with-text" size="md" />
              <span className="text-sm text-muted-foreground">With Text</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BeeHiveLogo variant="stacked" size="sm" />
              <span className="text-sm text-muted-foreground">Stacked</span>
            </div>
          </div>
        </div>

        {/* Customization Guide */}
        <div className="p-8 bg-honey/10 dark:bg-honey/5 rounded-lg border border-honey/30">
          <h3 className="text-lg font-bold text-charcoal dark:text-cream mb-4">How to Customize:</h3>
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <div>
              <strong>Colors:</strong> Edit the color tokens at the top of <code className="bg-slate-100 dark:bg-slate-800 px-1">beehive-logo.tsx</code>
              <ul className="mt-2 ml-4 space-y-1">
                <li>• <code className="bg-slate-100 dark:bg-slate-800 px-1">honeyColor</code> - Main logo color (gold)</li>
                <li>• <code className="bg-slate-100 dark:bg-slate-800 px-1">mintColor</code> - Accent color (teal)</li>
                <li>• <code className="bg-slate-100 dark:bg-slate-800 px-1">charcoalColor</code> - Dark elements</li>
              </ul>
            </div>
            <p>
              <strong>Text:</strong> Change "BeeHive" wordmark directly in the component
            </p>
            <p>
              <strong>Size Presets:</strong> Modify the <code className="bg-slate-100 dark:bg-slate-800 px-1">sizeMap</code> object to adjust hex and icon dimensions
            </p>
            <p>
              <strong>Animation:</strong> Add Framer Motion or CSS animations to the SVG for hover/loading states
            </p>
          </div>
        </div>

        {/* Live Preview */}
        <div className="mt-12 p-8 bg-gradient-to-r from-honey/20 via-mint/20 to-honey/20 dark:from-honey/10 dark:via-mint/10 dark:to-honey/10 rounded-lg border border-honey/30 dark:border-honey/20">
          <h3 className="text-lg font-bold text-charcoal dark:text-cream mb-6">Live Preview</h3>
          <div className="flex flex-wrap items-center justify-center gap-12 py-8">
            <BeeHiveLogo size="md" />
            <BeeHiveLogo size="md" variant="icon-only" />
            <BeeHiveLogo size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
