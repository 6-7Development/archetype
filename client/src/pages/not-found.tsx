import { useLocation } from "wouter";
import { Home, ArrowLeft, Sparkles } from "lucide-react";
import { ErrorPageTemplate } from "@/components/error-page-template";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <ErrorPageTemplate
      statusCode={404}
      title="Page Not Found"
      description="The page you're looking for doesn't exist or has been moved. Let's get you back on track."
      icon={null}
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
        {
          label: "Dashboard",
          onClick: () => setLocation("/dashboard"),
          variant: "outline",
          icon: <Sparkles className="w-4 h-4" />,
          testId: "button-dashboard",
        },
      ]}
    />
  );
}
