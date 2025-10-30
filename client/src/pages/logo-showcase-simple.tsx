import { Card } from "@/components/ui/card";
import { LogoLumoMini, LogoLemonCode, LogoLemonadeGlass, LogoCitrusWordmark, LogoLemonDrop } from "@/components/logo-concepts";

export default function LogoShowcaseSimple() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">LemonAid Logo Options</h1>
          <p className="text-muted-foreground">5 production-ready concepts for your platform</p>
        </div>

        {/* Option 1: Lumo Mini */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">1. Lumo Mini (Animated)</h2>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-8 flex items-center justify-center border-2">
              <LogoLumoMini size={120} />
            </div>
            <div className="flex items-center justify-center gap-6">
              <LogoLumoMini size={32} />
              <LogoLumoMini size={48} />
              <LogoLumoMini size={64} />
            </div>
            <p className="text-sm text-muted-foreground">
              ✨ Playful mascot face with breathing glow effect
            </p>
          </div>
        </Card>

        {/* Option 2: Lemon Code */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">2. Lemon Slice + Code (Static/Animated)</h2>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-8 flex items-center justify-center border-2">
              <LogoLemonCode size={120} animated={true} />
            </div>
            <div className="flex items-center justify-center gap-6">
              <LogoLemonCode size={32} />
              <LogoLemonCode size={48} />
              <LogoLemonCode size={64} />
            </div>
            <p className="text-sm text-muted-foreground">
              💻 Tech + citrus fusion with optional subtle rotation
            </p>
          </div>
        </Card>

        {/* Option 3: Lemonade Glass */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">3. Lemonade Glass (Animated Bubbles)</h2>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-8 flex items-center justify-center border-2">
              <LogoLemonadeGlass size={120} />
            </div>
            <div className="flex items-center justify-center gap-6">
              <LogoLemonadeGlass size={32} />
              <LogoLemonadeGlass size={48} />
              <LogoLemonadeGlass size={64} />
            </div>
            <p className="text-sm text-muted-foreground">
              🥤 Matches your lemonade loading animation perfectly
            </p>
          </div>
        </Card>

        {/* Option 4: Citrus Wordmark */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">4. Citrus Wordmark (Full Brand)</h2>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-8 flex items-center justify-center border-2">
              <LogoCitrusWordmark size={200} />
            </div>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <LogoCitrusWordmark size={120} />
              <LogoCitrusWordmark size={160} />
            </div>
            <p className="text-sm text-muted-foreground">
              🎯 Best for headers and navigation - includes full "LemonAid" text
            </p>
          </div>
        </Card>

        {/* Option 5: Lemon Drop */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">5. Lemon Drop (Minimal, Pulsing)</h2>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-8 flex items-center justify-center border-2">
              <LogoLemonDrop size={120} />
            </div>
            <div className="flex items-center justify-center gap-6">
              <LogoLemonDrop size={32} />
              <LogoLemonDrop size={48} />
              <LogoLemonDrop size={64} />
            </div>
            <p className="text-sm text-muted-foreground">
              💧 Modern & sophisticated with subtle pulse animation
            </p>
          </div>
        </Card>

        {/* Recommendation */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <h2 className="text-xl font-bold mb-3">💡 My Recommendation</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Desktop Header:</strong> Citrus Wordmark (full branding)</p>
            <p><strong>Mobile/Favicon:</strong> Lumo Mini or Lemon Drop (compact)</p>
            <p><strong>Loading States:</strong> Lemonade Glass (matches theme)</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
