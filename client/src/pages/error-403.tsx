import { useLocation } from "wouter";
import { Home, Shield, ArrowLeft } from "lucide-react";
import { ErrorPageTemplate } from "@/components/error-page-template";

export default function Error403() {
  const [, setLocation] = useLocation();

  return (
    <ErrorPageTemplate
      statusCode={403}
      title="Access Denied"
      description="You don't have permission to access this resource. Please contact your administrator if you believe this is an error."
      icon={<Shield className="w-24 h-24 text-destructive" />}
      actions={[
        {
          label: "Go Home",
          onClick: () => setLocation("/"),
          variant: "default",
          icon: <Home className="w-4 h-4" />,
          testId: "button-home",
        },
        {
          label: "Go Back",
          onClick: () => window.history.back(),
          variant: "outline",
          icon: <ArrowLeft className="w-4 h-4" />,
          testId: "button-back",
        },
      ]}
    />
  );
}
