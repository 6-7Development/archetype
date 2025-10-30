import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";
import { Link } from "wouter";
import { LogoEnhancedBadge, LogoAnimatedWordmark, LogoComparison } from "@/components/final-logos";

export default function FinalLogoShowcase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Your Final Logo Designs
            </h1>
            <p className="text-muted-foreground text-lg">
              Enhanced with better colors and smooth animations
            </p>
          </div>
        </div>

        {/* Side-by-side preview */}
        <Card className="p-8 mb-8 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-2">
          <LogoComparison size={140} />
        </Card>

        {/* Detailed Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Enhanced Badge */}
          <Card className="p-6 hover-elevate" data-testid="card-final-badge">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Enhanced Gradient Badge</h2>
                <Sparkles className="w-6 h-6 text-primary" />
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl p-12 flex items-center justify-center border-2 border-primary/20">
                <LogoEnhancedBadge size={160} />
              </div>

              <div className="flex items-center justify-center gap-6 bg-white dark:bg-slate-950 rounded-xl p-6">
                <LogoEnhancedBadge size={40} />
                <LogoEnhancedBadge size={56} />
                <LogoEnhancedBadge size={72} />
                <LogoEnhancedBadge size={88} />
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Enhanced Features:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span>Vibrant Lomu color palette (Sparkling Lemon, Fresh Mint, Citrus Bloom)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span>Rotating outer ring with gradient shimmer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span>Pulsing center circle with code symbol</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span>Animated sparkle highlights at cardinal points</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span>Enhanced lemon segment pattern</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span>Premium shine overlay</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Best For:</h3>
                <p className="text-sm text-muted-foreground">
                  Favicon, app icons, badges, mobile navigation, loading indicators
                </p>
              </div>
            </div>
          </Card>

          {/* Animated Wordmark */}
          <Card className="p-6 hover-elevate" data-testid="card-final-wordmark">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Animated Wordmark</h2>
                <Zap className="w-6 h-6 text-secondary" />
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl p-12 flex items-center justify-center border-2 border-secondary/20">
                <LogoAnimatedWordmark size={220} />
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-950 rounded-xl p-6 flex items-center justify-center">
                  <LogoAnimatedWordmark size={180} />
                </div>
                <div className="bg-white dark:bg-slate-950 rounded-xl p-6 flex items-center justify-center">
                  <LogoAnimatedWordmark size={140} variant="compact" />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Animation Features:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5" />
                    <span>Lemon squeeze/pulse animation (breathing effect)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5" />
                    <span>Leaf cluster gentle sway (organic movement)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5" />
                    <span>Letter wave effect (each letter bounces independently)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5" />
                    <span>Gradient shimmer across text (living color)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5" />
                    <span>Tagline pulse opacity (subtle emphasis)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5" />
                    <span>Compact variant for smaller spaces</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Best For:</h3>
                <p className="text-sm text-muted-foreground">
                  Main navigation header, landing page hero, marketing materials, desktop apps
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Implementation Guide */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <h2 className="text-2xl font-bold mb-4">🎯 Recommended Implementation</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Desktop Experience</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                  <div>
                    <p className="font-semibold">Header/Navigation</p>
                    <p className="text-muted-foreground">Animated Wordmark (full version)</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary mt-1" />
                  <div>
                    <p className="font-semibold">Browser Tab</p>
                    <p className="text-muted-foreground">Enhanced Badge (32x32)</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent mt-1" />
                  <div>
                    <p className="font-semibold">Loading States</p>
                    <p className="text-muted-foreground">Enhanced Badge (spinning variant)</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Mobile Experience</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                  <div>
                    <p className="font-semibold">Mobile Header</p>
                    <p className="text-muted-foreground">Animated Wordmark (compact)</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary mt-1" />
                  <div>
                    <p className="font-semibold">App Icon</p>
                    <p className="text-muted-foreground">Enhanced Badge (180x180, 512x512)</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent mt-1" />
                  <div>
                    <p className="font-semibold">Splash Screen</p>
                    <p className="text-muted-foreground">Enhanced Badge + "Lomu" text</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-background/50 rounded-lg">
            <h3 className="font-semibold mb-2">Technical Specs</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Format</p>
                <p className="font-mono">SVG (scalable)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Animation</p>
                <p className="font-mono">60fps smooth</p>
              </div>
              <div>
                <p className="text-muted-foreground">Performance</p>
                <p className="font-mono">Optimized</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
