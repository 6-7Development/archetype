import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoLumoMini, LogoLemonCode, LogoLemonadeGlass, LogoCitrusWordmark, LogoLemonDrop } from "@/components/logo-concepts";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function LogoPreview() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/5 p-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2">LemonAid Logo Concepts</h1>
          <p className="text-muted-foreground">
            Choose your favorite logo design - all options are production-ready and optimized for the LemonAid brand.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Concept 1: Animated Lumo Mini */}
          <Card data-testid="card-logo-lumo">
            <CardHeader>
              <CardTitle className="text-lg">Lumo Mini</CardTitle>
              <CardDescription>Animated mascot face with subtle glow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview on white */}
              <div className="bg-white dark:bg-slate-950 rounded-lg p-8 flex items-center justify-center border">
                <LogoLumoMini size={80} />
              </div>
              
              {/* Size variations */}
              <div className="flex items-center justify-center gap-4 bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                <LogoLumoMini size={24} />
                <LogoLumoMini size={32} />
                <LogoLumoMini size={48} />
              </div>
              
              <div className="text-sm space-y-1">
                <p className="font-semibold">Pros:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Brand mascot recognition</li>
                  <li>Playful & memorable</li>
                  <li>Animated breathing effect</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Concept 2: Lemon Code Icon */}
          <Card data-testid="card-logo-code">
            <CardHeader>
              <CardTitle className="text-lg">Lemon Slice Code</CardTitle>
              <CardDescription>Lemon with code symbols (static or animated)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview on white */}
              <div className="bg-white dark:bg-slate-950 rounded-lg p-8 flex items-center justify-center border">
                <LogoLemonCode size={80} animated={true} />
              </div>
              
              {/* Size variations */}
              <div className="flex items-center justify-center gap-4 bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                <LogoLemonCode size={24} />
                <LogoLemonCode size={32} />
                <LogoLemonCode size={48} />
              </div>
              
              <div className="text-sm space-y-1">
                <p className="font-semibold">Pros:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Tech + citrus fusion</li>
                  <li>Clean & professional</li>
                  <li>Scales beautifully</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Concept 3: Lemonade Glass */}
          <Card data-testid="card-logo-glass">
            <CardHeader>
              <CardTitle className="text-lg">Lemonade Glass</CardTitle>
              <CardDescription>Glass with rising bubbles animation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview on white */}
              <div className="bg-white dark:bg-slate-950 rounded-lg p-8 flex items-center justify-center border">
                <LogoLemonadeGlass size={80} />
              </div>
              
              {/* Size variations */}
              <div className="flex items-center justify-center gap-4 bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                <LogoLemonadeGlass size={24} />
                <LogoLemonadeGlass size={32} />
                <LogoLemonadeGlass size={48} />
              </div>
              
              <div className="text-sm space-y-1">
                <p className="font-semibold">Pros:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Matches loading animation</li>
                  <li>Refreshing & dynamic</li>
                  <li>Unique visual identity</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Concept 4: Citrus Wordmark */}
          <Card className="md:col-span-2" data-testid="card-logo-wordmark">
            <CardHeader>
              <CardTitle className="text-lg">Citrus Wordmark</CardTitle>
              <CardDescription>Full branding with lemon icon + text (best for headers)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview on white */}
              <div className="bg-white dark:bg-slate-950 rounded-lg p-8 flex items-center justify-center border">
                <LogoCitrusWordmark size={180} />
              </div>
              
              {/* Size variations */}
              <div className="flex items-center justify-center gap-8 bg-slate-100 dark:bg-slate-900 rounded-lg p-4 flex-wrap">
                <LogoCitrusWordmark size={90} />
                <LogoCitrusWordmark size={120} />
                <LogoCitrusWordmark size={160} />
              </div>
              
              <div className="text-sm space-y-1">
                <p className="font-semibold">Pros:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Full brand visibility</li>
                  <li>Perfect for navigation headers</li>
                  <li>Gradient text for visual interest</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Concept 5: Lemon Drop */}
          <Card data-testid="card-logo-drop">
            <CardHeader>
              <CardTitle className="text-lg">Lemon Drop</CardTitle>
              <CardDescription>Minimal teardrop shape with subtle pulse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview on white */}
              <div className="bg-white dark:bg-slate-950 rounded-lg p-8 flex items-center justify-center border">
                <LogoLemonDrop size={80} />
              </div>
              
              {/* Size variations */}
              <div className="flex items-center justify-center gap-4 bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                <LogoLemonDrop size={24} />
                <LogoLemonDrop size={32} />
                <LogoLemonDrop size={48} />
              </div>
              
              <div className="text-sm space-y-1">
                <p className="font-semibold">Pros:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Modern & minimal</li>
                  <li>Works at tiny sizes</li>
                  <li>Sophisticated look</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommendation */}
        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-bold mb-2">Recommendation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              For maximum versatility, consider using:
            </p>
            <ul className="text-sm space-y-2 ml-4 list-disc">
              <li><strong>Citrus Wordmark</strong> - For main navigation and headers (desktop)</li>
              <li><strong>Lumo Mini</strong> or <strong>Lemon Drop</strong> - For favicon, mobile nav, and compact spaces</li>
              <li><strong>Lemonade Glass</strong> - For loading states and splash screens</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
