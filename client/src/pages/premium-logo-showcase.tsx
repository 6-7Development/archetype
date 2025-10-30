import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "wouter";
import {
  LogoIsometricLemon,
  LogoGradientBadge,
  LogoGeometricLemon,
  LogoLiquidSplash,
  LogoModernWordmark,
  LogoNeonGlow
} from "@/components/premium-logos";

export default function PremiumLogoShowcase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Premium Logo Collection
              </h1>
              <p className="text-muted-foreground text-lg">
                Professional-grade designs for the Lomu platform
              </p>
            </div>
          </div>
        </div>

        {/* Grid of premium logos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Logo 1: Isometric 3D */}
          <Card className="p-6 hover-elevate" data-testid="card-logo-isometric">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">3D Isometric</h3>
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">Premium</span>
              </div>
              
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-8 flex items-center justify-center border-2">
                <LogoIsometricLemon size={120} />
              </div>
              
              <div className="flex items-center justify-center gap-4 bg-white/50 dark:bg-slate-950/50 rounded-lg p-4">
                <LogoIsometricLemon size={32} />
                <LogoIsometricLemon size={48} />
                <LogoIsometricLemon size={64} />
              </div>
              
              <p className="text-sm text-muted-foreground">
                Modern 3D isometric design with shadow depth and hover rotation. Perfect for app icons.
              </p>
            </div>
          </Card>

          {/* Logo 2: Gradient Badge */}
          <Card className="p-6 hover-elevate" data-testid="card-logo-badge">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Gradient Badge</h3>
                <span className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded-full">Animated</span>
              </div>
              
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-8 flex items-center justify-center border-2">
                <LogoGradientBadge size={120} />
              </div>
              
              <div className="flex items-center justify-center gap-4 bg-white/50 dark:bg-slate-950/50 rounded-lg p-4">
                <LogoGradientBadge size={32} />
                <LogoGradientBadge size={48} />
                <LogoGradientBadge size={64} />
              </div>
              
              <p className="text-sm text-muted-foreground">
                Vibrant badge with pulsing glow ring. Ideal for achievements and branding marks.
              </p>
            </div>
          </Card>

          {/* Logo 3: Geometric */}
          <Card className="p-6 hover-elevate" data-testid="card-logo-geometric">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Geometric</h3>
                <span className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-full">Modern</span>
              </div>
              
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-8 flex items-center justify-center border-2">
                <LogoGeometricLemon size={120} />
              </div>
              
              <div className="flex items-center justify-center gap-4 bg-white/50 dark:bg-slate-950/50 rounded-lg p-4">
                <LogoGeometricLemon size={32} />
                <LogoGeometricLemon size={48} />
                <LogoGeometricLemon size={64} />
              </div>
              
              <p className="text-sm text-muted-foreground">
                Clean geometric hexagon with gradient triangles. Sophisticated and tech-forward.
              </p>
            </div>
          </Card>

          {/* Logo 4: Liquid Splash */}
          <Card className="p-6 hover-elevate" data-testid="card-logo-liquid">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Liquid Splash</h3>
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">Dynamic</span>
              </div>
              
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-8 flex items-center justify-center border-2">
                <LogoLiquidSplash size={120} />
              </div>
              
              <div className="flex items-center justify-center gap-4 bg-white/50 dark:bg-slate-950/50 rounded-lg p-4">
                <LogoLiquidSplash size={32} />
                <LogoLiquidSplash size={48} />
                <LogoLiquidSplash size={64} />
              </div>
              
              <p className="text-sm text-muted-foreground">
                Organic liquid effect with animated particles. Refreshing and energetic vibe.
              </p>
            </div>
          </Card>

          {/* Logo 5: Neon Glow */}
          <Card className="p-6 hover-elevate" data-testid="card-logo-neon">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Neon Glow</h3>
                <span className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded-full">Trendy</span>
              </div>
              
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 flex items-center justify-center border-2 border-primary/20">
                <LogoNeonGlow size={120} />
              </div>
              
              <div className="flex items-center justify-center gap-4 bg-slate-950/80 rounded-lg p-4">
                <LogoNeonGlow size={32} />
                <LogoNeonGlow size={48} />
                <LogoNeonGlow size={64} />
              </div>
              
              <p className="text-sm text-muted-foreground">
                Cyberpunk-inspired neon glow effect. Perfect for dark mode interfaces.
              </p>
            </div>
          </Card>

          {/* Logo 6: Modern Wordmark - Full Width */}
          <Card className="md:col-span-2 lg:col-span-3 p-6 hover-elevate" data-testid="card-logo-wordmark">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Modern Wordmark (Full Branding)</h3>
                <span className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-full">Recommended</span>
              </div>
              
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-12 flex items-center justify-center border-2">
                <LogoModernWordmark size={240} />
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-950 rounded-lg p-6 flex items-center justify-center">
                  <LogoModernWordmark size={180} />
                </div>
                <div className="bg-white dark:bg-slate-950 rounded-lg p-6 flex items-center justify-center">
                  <LogoModernWordmark size={140} />
                </div>
                <div className="bg-white dark:bg-slate-950 rounded-lg p-6 flex items-center justify-center">
                  <LogoModernWordmark size={140} variant="compact" />
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Premium wordmark with gradient text and tagline "Code Made Sweet". Includes compact variant for smaller spaces. Best for navigation headers and landing pages.
              </p>
            </div>
          </Card>
        </div>

        {/* Recommendations */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <h3 className="text-xl font-bold mb-4">🎯 Usage Recommendations</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div>
                  <p className="font-semibold">Desktop Headers</p>
                  <p className="text-muted-foreground">Modern Wordmark (full version)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-secondary mt-1.5" />
                <div>
                  <p className="font-semibold">Mobile Navigation</p>
                  <p className="text-muted-foreground">Geometric or 3D Isometric</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-1.5" />
                <div>
                  <p className="font-semibold">Favicon/App Icon</p>
                  <p className="text-muted-foreground">Gradient Badge or Neon Glow</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div>
                  <p className="font-semibold">Loading States</p>
                  <p className="text-muted-foreground">Liquid Splash (pairs with lemonade loader)</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <h3 className="text-xl font-bold mb-4">✨ What Makes These Premium</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>SVG-based for infinite scalability</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>Smooth CSS/JS animations (60fps)</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>Advanced gradients & filters</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>Dark mode optimized</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>Accessibility compliant</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>Production-ready components</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
