/**
 * Walkthrough Overlay Component
 * 
 * Interactive tutorial overlay that guides users through features
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Lightbulb, 
  BookOpen, 
  GraduationCap,
  Clock,
  Award,
  Play,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

interface WalkthroughStep {
  id: string;
  title: string;
  content: string;
  target?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  tips?: string[];
  codeExample?: string;
}

interface Walkthrough {
  id: string;
  title: string;
  description: string;
  category: 'onboarding' | 'feature' | 'advanced' | 'ai-sync';
  estimatedMinutes: number;
  steps: WalkthroughStep[];
  prerequisites?: string[];
  badge?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface WalkthroughProgress {
  walkthroughId: string;
  currentStepIndex: number;
  completedSteps: string[];
  status: 'in_progress' | 'completed' | 'skipped';
}

interface WalkthroughOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  walkthroughId?: string;
}

export function WalkthroughOverlay({ isOpen, onClose, walkthroughId }: WalkthroughOverlayProps) {
  const [activeWalkthroughId, setActiveWalkthroughId] = useState<string | null>(walkthroughId || null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const { data: walkthroughs } = useQuery<Walkthrough[]>({
    queryKey: ['/api/walkthroughs/list'],
    enabled: isOpen,
  });

  const { data: activeWalkthrough } = useQuery<Walkthrough>({
    queryKey: ['/api/walkthroughs', activeWalkthroughId],
    enabled: !!activeWalkthroughId,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/walkthroughs/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/walkthroughs/progress/all'] });
    },
  });

  const completeStepMutation = useMutation({
    mutationFn: ({ id, stepId }: { id: string; stepId: string }) => 
      apiRequest('POST', `/api/walkthroughs/${id}/step/${stepId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/walkthroughs/progress/all'] });
    },
  });

  const skipMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/walkthroughs/${id}/skip`),
    onSuccess: () => {
      setActiveWalkthroughId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/walkthroughs/progress/all'] });
    },
  });

  const handleStartWalkthrough = useCallback((id: string) => {
    setActiveWalkthroughId(id);
    setCurrentStepIndex(0);
    startMutation.mutate(id);
  }, [startMutation]);

  const handleNextStep = useCallback(() => {
    if (!activeWalkthrough || !activeWalkthroughId) return;
    
    const currentStep = activeWalkthrough.steps[currentStepIndex];
    completeStepMutation.mutate({ id: activeWalkthroughId, stepId: currentStep.id });
    
    if (currentStepIndex < activeWalkthrough.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setActiveWalkthroughId(null);
      setCurrentStepIndex(0);
    }
  }, [activeWalkthrough, activeWalkthroughId, currentStepIndex, completeStepMutation]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(() => {
    if (activeWalkthroughId) {
      skipMutation.mutate(activeWalkthroughId);
    }
  }, [activeWalkthroughId, skipMutation]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-mint/10 text-mint border-mint/20';
      case 'intermediate': return 'bg-honey/10 text-honey border-honey/20';
      case 'advanced': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'onboarding': return <BookOpen className="w-4 h-4" />;
      case 'feature': return <Lightbulb className="w-4 h-4" />;
      case 'advanced': return <GraduationCap className="w-4 h-4" />;
      case 'ai-sync': return <Award className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        data-testid="walkthrough-overlay"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="fixed inset-4 md:inset-10 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {!activeWalkthroughId ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-6 h-6 text-honey" />
                    <div>
                      <CardTitle>Tutorials & Walkthroughs</CardTitle>
                      <CardDescription>Learn how to use BeeHive effectively</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-walkthrough">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                    {walkthroughs?.map((walkthrough) => (
                      <Card 
                        key={walkthrough.id} 
                        className="hover-elevate cursor-pointer transition-all"
                        onClick={() => handleStartWalkthrough(walkthrough.id)}
                        data-testid={`walkthrough-card-${walkthrough.id}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={getDifficultyColor(walkthrough.difficulty)}>
                              {walkthrough.difficulty}
                            </Badge>
                            <Badge variant="secondary" className="gap-1">
                              {getCategoryIcon(walkthrough.category)}
                              {walkthrough.category}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg mt-2">{walkthrough.title}</CardTitle>
                          <CardDescription>{walkthrough.description}</CardDescription>
                        </CardHeader>
                        <CardFooter className="pt-0">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {walkthrough.estimatedMinutes} min
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {walkthrough.steps.length} steps
                            </div>
                            <Button size="sm" variant="ghost" className="gap-1">
                              <Play className="w-3 h-3" />
                              Start
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : activeWalkthrough ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getDifficultyColor(activeWalkthrough.difficulty)}>
                      Step {currentStepIndex + 1} of {activeWalkthrough.steps.length}
                    </Badge>
                    <CardTitle className="text-lg">{activeWalkthrough.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleSkip}
                      data-testid="button-skip-walkthrough"
                    >
                      Skip Tutorial
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                <Progress 
                  value={(currentStepIndex / activeWalkthrough.steps.length) * 100} 
                  className="h-1 mt-2"
                />
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStepIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full flex flex-col"
                  >
                    {activeWalkthrough.steps[currentStepIndex] && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-2xl font-bold mb-2">
                            {activeWalkthrough.steps[currentStepIndex].title}
                          </h3>
                          <p className="text-muted-foreground text-lg">
                            {activeWalkthrough.steps[currentStepIndex].content}
                          </p>
                        </div>

                        {activeWalkthrough.steps[currentStepIndex].tips && (
                          <div className="bg-honey/10 border border-honey/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="w-4 h-4 text-honey" />
                              <span className="font-medium text-honey">Tips</span>
                            </div>
                            <ul className="space-y-1">
                              {activeWalkthrough.steps[currentStepIndex].tips?.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <CheckCircle2 className="w-4 h-4 text-honey mt-0.5 flex-shrink-0" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {activeWalkthrough.steps[currentStepIndex].codeExample && (
                          <div className="bg-muted rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-2">Example:</p>
                            <code className="text-sm font-mono text-honey">
                              {activeWalkthrough.steps[currentStepIndex].codeExample}
                            </code>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </CardContent>

              <CardFooter className="flex-shrink-0 border-t flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={handlePrevStep}
                  disabled={currentStepIndex === 0}
                  data-testid="button-prev-step"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <Button 
                  onClick={handleNextStep}
                  className="bg-honey text-black hover:bg-honey/90"
                  data-testid="button-next-step"
                >
                  {currentStepIndex === activeWalkthrough.steps.length - 1 ? (
                    <>
                      Complete
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function WalkthroughTrigger({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(true)}
        className={className}
        data-testid="button-open-walkthrough"
      >
        <BookOpen className="w-5 h-5" />
      </Button>
      <WalkthroughOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
