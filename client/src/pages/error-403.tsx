import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Home, Shield, ArrowLeft } from "lucide-react";
import { LogoEnhancedBadge, LogoAnimatedWordmark } from '@/components/final-logos';

export default function Error403() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <LogoEnhancedBadge size={64} />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              LemonAid
            </h1>
            <p className="text-sm text-muted-foreground">AI-Powered Code Generation Platform</p>
          </div>
        </div>

        <Card className="p-8 md:p-12">
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <Shield className="w-24 h-24 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">403 - Access Denied</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                You don't have permission to access this resource. 
                Please contact your administrator if you believe this is an error.
              </p>
            </div>

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
            </div>
          </div>
        </Card>

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
