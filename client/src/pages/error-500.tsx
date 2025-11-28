import { useLocation } from "wouter";
import { Home, AlertTriangle, RefreshCw } from "lucide-react";
import { ErrorPageTemplate } from "@/components/error-page-template";

export default function Error500() {
  const [, setLocation] = useLocation();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <ErrorPageTemplate
      statusCode={500}
      title="Server Error"
      description="Oops! Something went wrong on our end. Our team has been notified and is working on a fix."
      icon={<AlertTriangle className="w-24 h-24 text-destructive" />}
      actions={[
        {
          label: "Refresh Page",
          onClick: handleRefresh,
          variant: "default",
          icon: <RefreshCw className="w-4 h-4" />,
          testId: "button-refresh",
        },
        {
          label: "Go Home",
          onClick: () => setLocation("/"),
          variant: "outline",
          icon: <Home className="w-4 h-4" />,
          testId: "button-home",
        },
      ]}
    />
  );
}
