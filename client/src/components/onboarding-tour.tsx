import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Rocket, Code, Eye, CheckCircle2, ArrowRight, Palette, BarChart3, CheckSquare, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingTourProps {
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to Lomu",
    description: "Your AI-powered development platform for building professional web applications instantly.",
    icon: Sparkles,
    features: [
      "Build complete apps with natural language",
      "Professional Fortune 500 design system",
      "Deploy with one click",
      "AI-powered code generation"
    ]
  },
  {
    title: "Start Building",
    description: "Use the Build tab to chat with Lomu AI and generate your first project.",
    icon: Code,
    features: [
      'Try: "Build a modern landing page"',
      'Or: "Create a todo app with dark mode"',
      "AI generates complete full-stack projects",
      "Review and edit all generated code"
    ]
  },
  {
    title: "Explore Your Workspace",
    description: "Professional IDE with everything you need to develop, test, and deploy.",
    icon: Eye,
    features: [
      "Files: Browse and edit your project",
      "Preview: See changes in real-time",
      "Versions: Track your project history",
      "Deploy: Publish to production"
    ]
  },
  {
    title: "Ready to Build",
    description: "You're all set! Start with a quickstart template or describe your own project.",
    icon: Rocket,
    features: [
      "Choose a template below",
      "Or chat with Lomu AI",
      "Build anything you can imagine",
      "Deploy in minutes, not days"
    ]
  }
];

const quickstartTemplates = [
  {
    name: "Landing Page",
    description: "Modern landing page with hero section",
    prompt: "Build a professional landing page for a SaaS product with hero section, features, pricing, and contact form. Use modern design with gradients and animations.",
    icon: Palette
  },
  {
    name: "Dashboard",
    description: "Analytics dashboard with charts",
    prompt: "Create an analytics dashboard with charts, metrics cards, and data tables. Include dark mode support and responsive design.",
    icon: BarChart3
  },
  {
    name: "Todo App",
    description: "Task manager with categories",
    prompt: "Build a todo application with task categories, due dates, priority levels, and local storage persistence. Include a clean, minimal UI.",
    icon: CheckSquare
  },
  {
    name: "Portfolio",
    description: "Personal portfolio website",
    prompt: "Create a professional portfolio website with project showcase, about section, skills, and contact form. Use a clean, modern design.",
    icon: Briefcase
  }
];

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      setShowTemplates(true);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleTemplateSelect = (template: typeof quickstartTemplates[0]) => {
    localStorage.setItem('lomu_quickstart_prompt', template.prompt);
    onComplete();
  };

  return (
    <Dialog open={true} onOpenChange={handleSkip}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-onboarding">
        <AnimatePresence mode="wait">
          {!showTemplates ? (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Step {currentStep + 1} of {steps.length}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl">{currentStepData.title}</DialogTitle>
                <DialogDescription className="text-base">
                  {currentStepData.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 my-6">
                {currentStepData.features.map((feature, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </motion.div>
                ))}
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
                <Button variant="ghost" onClick={handleSkip} data-testid="button-skip-tour">
                  Skip Tour
                </Button>
                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <Button variant="outline" onClick={() => setCurrentStep(prev => prev - 1)} data-testid="button-prev-step">
                      Previous
                    </Button>
                  )}
                  <Button onClick={handleNext} data-testid="button-next-step">
                    {isLastStep ? "Show Templates" : "Next"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl">Choose a Quickstart Template</DialogTitle>
                <DialogDescription>
                  Select a template to get started, or skip to build from scratch
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
                {quickstartTemplates.map((template, idx) => {
                  const TemplateIcon = template.icon;
                  return (
                    <Card
                      key={idx}
                      className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                      onClick={() => handleTemplateSelect(template)}
                      data-testid={`template-${template.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                          <TemplateIcon className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={onComplete} data-testid="button-skip-templates">
                  Skip & Build from Scratch
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
