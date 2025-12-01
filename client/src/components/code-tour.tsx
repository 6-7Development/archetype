import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Compass, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Play,
  Pause,
  RotateCcw,
  FileCode,
  MapPin,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TourStep {
  id: string;
  title: string;
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet?: string;
  highlightType?: 'function' | 'component' | 'config' | 'api' | 'style';
}

interface CodeTourProps {
  projectId: string;
  steps?: TourStep[];
  onStepChange?: (step: TourStep) => void;
  onFileSelect?: (filePath: string, line: number) => void;
  className?: string;
}

const defaultSteps: TourStep[] = [
  {
    id: '1',
    title: 'Entry Point',
    description: 'This is where the application starts. The main component is rendered here.',
    filePath: 'src/App.tsx',
    lineStart: 1,
    lineEnd: 20,
    highlightType: 'component'
  },
  {
    id: '2',
    title: 'Routing',
    description: 'Routes define the navigation structure of your app.',
    filePath: 'src/App.tsx',
    lineStart: 25,
    lineEnd: 45,
    highlightType: 'config'
  },
  {
    id: '3',
    title: 'API Layer',
    description: 'API calls and data fetching logic lives here.',
    filePath: 'src/lib/queryClient.ts',
    lineStart: 1,
    lineEnd: 30,
    highlightType: 'api'
  }
];

export function CodeTour({ 
  projectId, 
  steps = defaultSteps, 
  onStepChange,
  onFileSelect,
  className 
}: CodeTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tourSteps, setTourSteps] = useState<TourStep[]>(steps);
  
  const currentStep = tourSteps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / tourSteps.length) * 100;

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < tourSteps.length) {
      setCurrentStepIndex(index);
      const step = tourSteps[index];
      onStepChange?.(step);
      onFileSelect?.(step.filePath, step.lineStart);
    }
  }, [tourSteps, onStepChange, onFileSelect]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < tourSteps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentStepIndex, tourSteps.length, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  const resetTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const timer = setTimeout(() => {
        nextStep();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentStepIndex, nextStep]);

  const getHighlightColor = (type?: string) => {
    switch (type) {
      case 'function': return 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30';
      case 'component': return 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/30';
      case 'config': return 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/30';
      case 'api': return 'border-green-500/50 bg-green-50/50 dark:bg-green-950/30';
      case 'style': return 'border-pink-500/50 bg-pink-50/50 dark:bg-pink-950/30';
      default: return 'border-gray-500/50 bg-gray-50/50 dark:bg-gray-950/30';
    }
  };

  const getHighlightBadge = (type?: string) => {
    switch (type) {
      case 'function': return { label: 'Function', color: 'bg-blue-500' };
      case 'component': return { label: 'Component', color: 'bg-purple-500' };
      case 'config': return { label: 'Configuration', color: 'bg-amber-500' };
      case 'api': return { label: 'API', color: 'bg-green-500' };
      case 'style': return { label: 'Styles', color: 'bg-pink-500' };
      default: return { label: 'Code', color: 'bg-gray-500' };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          data-testid="button-code-tour"
        >
          <Compass className="w-4 h-4" />
          Code Tour
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Code Tour
            <Badge variant="outline" className="ml-2 text-xs">
              {currentStepIndex + 1} / {tourSteps.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {currentStepIndex + 1}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </div>

          {/* Current Step Content */}
          <AnimatePresence mode="wait">
            {currentStep && (
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(
                  "p-4 border-2",
                  getHighlightColor(currentStep.highlightType)
                )}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{currentStep.title}</h3>
                        <Badge className={cn("text-xs text-white", getHighlightBadge(currentStep.highlightType).color)}>
                          {getHighlightBadge(currentStep.highlightType).label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {currentStep.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <FileCode className="w-4 h-4 text-muted-foreground" />
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {currentStep.filePath}:{currentStep.lineStart}-{currentStep.lineEnd}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onFileSelect?.(currentStep.filePath, currentStep.lineStart)}
                          className="text-xs h-7"
                          data-testid="button-goto-file"
                        >
                          Go to file
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step Indicators */}
          <div className="flex justify-center gap-2">
            {tourSteps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentStepIndex
                    ? "w-6 bg-primary"
                    : index < currentStepIndex
                    ? "bg-primary/50"
                    : "bg-muted"
                )}
                data-testid={`button-step-${index}`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={resetTour}
              data-testid="button-reset-tour"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Restart
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                data-testid="button-prev-step"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <Button
                variant={isPlaying ? "default" : "outline"}
                size="icon"
                onClick={() => setIsPlaying(!isPlaying)}
                data-testid="button-play-pause"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={nextStep}
                disabled={currentStepIndex === tourSteps.length - 1}
                data-testid="button-next-step"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-tour"
            >
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
