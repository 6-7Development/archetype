/**
 * Reusable Error Page Template
 * Provides consistent styling for all error pages (404, 403, 500, etc.)
 * Uses hive/honey theme from BeeHive branding
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BeeHiveLogo } from "@/components/beehive-logo";
import { ReactNode } from "react";

interface ErrorPageProps {
  statusCode: number;
  title: string;
  description: string;
  icon: ReactNode;
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    icon?: ReactNode;
    testId: string;
  }>;
  supportEmail?: string;
  companyName?: string;
}

const DEFAULT_CONFIG = {
  supportEmail: 'support@getdc360.com',
  companyName: 'Drill Consulting 360 LLC',
};

export function ErrorPageTemplate({
  statusCode,
  title,
  description,
  icon,
  actions,
  supportEmail = DEFAULT_CONFIG.supportEmail,
  companyName = DEFAULT_CONFIG.companyName,
}: ErrorPageProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center gap-4">
          <BeeHiveLogo size={64} />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              BeeHive
            </h1>
            <p className="text-sm text-muted-foreground">Collaborative Hive Intelligence for Code</p>
          </div>
        </div>

        {/* Error Card */}
        <Card className="p-8 md:p-12">
          <div className="space-y-6">
            {/* Icon and Status Code */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  {icon}
                </div>
                <div className="text-7xl md:text-8xl font-bold bg-gradient-to-br from-primary via-secondary to-accent bg-clip-text text-transparent">
                  {statusCode}
                </div>
              </div>
            </div>
            
            {/* Text Content */}
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {description}
              </p>
            </div>

            {/* Action Buttons */}
            {actions.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                {actions.map((action) => (
                  <Button
                    key={action.testId}
                    onClick={action.onClick}
                    variant={action.variant || 'default'}
                    size="lg"
                    className="gap-2"
                    data-testid={action.testId}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Need help? Contact{" "}
            <a 
              href={`mailto:${supportEmail}`}
              className="text-primary hover:underline"
              data-testid="link-support"
            >
              {supportEmail}
            </a>
          </p>
          <p className="mt-2">
            A product by{" "}
            <span className="font-semibold text-foreground">
              {companyName}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
