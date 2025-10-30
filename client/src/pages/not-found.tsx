import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Home, ArrowLeft, Search, Sparkles } from "lucide-react";
import logoPath from "@assets/logo.svg";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center gap-4">
          <img 
            src={logoPath} 
            alt="LemonAid" 
            className="w-20 h-20 rounded-2xl shadow-xl shadow-primary/20"
          />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              LemonAid
            </h1>
            <p className="text-sm text-muted-foreground">AI-Powered Code Generation Platform</p>
          </div>
        </div>

        {/* 404 Message */}
        <Card className="p-8 md:p-12">
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="text-8xl md:text-9xl font-bold bg-gradient-to-br from-primary via-secondary to-accent bg-clip-text text-transparent">
                404
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold">Page Not Found</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                The page you're looking for doesn't exist or has been moved. 
                Let's get you back on track.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button
                onClick={() => setLocation("/")}
                size="lg"
                className="gap-2"
                data-testid="button-home"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
              
              <Button
                onClick={() => window.history.back()}
                variant="outline"
                size="lg"
                className="gap-2"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </Button>
              
              <Button
                onClick={() => setLocation("/dashboard")}
                variant="outline"
                size="lg"
                className="gap-2"
                data-testid="button-dashboard"
              >
                <Sparkles className="w-4 h-4" />
                Dashboard
              </Button>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Need help? Contact{" "}
            <a 
              href="mailto:support@getdc360.com" 
              className="text-primary hover:underline"
            >
              support@getdc360.com
            </a>
          </p>
          <p className="mt-2">
            A product by{" "}
            <span className="font-semibold text-foreground">
              Drill Consulting 360 LLC
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
