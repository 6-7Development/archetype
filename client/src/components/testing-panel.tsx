import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, PlayCircle, CheckCircle2, XCircle, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TestStep {
  id: string;
  type: 'navigate' | 'action' | 'assertion' | 'screenshot';
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  timestamp: number;
  screenshot?: string; // base64 encoded
  error?: string;
}

export interface TestingSession {
  sessionId: string;
  url: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  narration: string[];
  steps: TestStep[];
  startedAt: number;
  completedAt?: number;
}

interface TestingPanelProps {
  session: TestingSession | null;
  onClose?: () => void;
}

export function TestingPanel({ session, onClose }: TestingPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  
  if (!session) return null;
  
  const currentStep = session.steps.find(s => s.status === 'running');
  const passedSteps = session.steps.filter(s => s.status === 'passed').length;
  const failedSteps = session.steps.filter(s => s.status === 'failed').length;
  const totalSteps = session.steps.length;
  
  // Reset screenshot when new session starts
  useEffect(() => {
    setLatestScreenshot(null);
  }, [session.sessionId]);
  
  // Track latest screenshot to persist preview after step completes
  useEffect(() => {
    const stepWithScreenshot = [...session.steps].reverse().find(s => s.screenshot);
    if (stepWithScreenshot?.screenshot) {
      setLatestScreenshot(stepWithScreenshot.screenshot);
    }
  }, [session.steps]);
  
  const statusColors = {
    initializing: 'bg-blue-500',
    running: 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };
  
  const statusIcons = {
    initializing: PlayCircle,
    running: PlayCircle,
    completed: CheckCircle2,
    failed: XCircle,
  };
  
  const StatusIcon = statusIcons[session.status];
  
  return (
    <div className={cn(
      "border-t",
      isExpanded ? "fixed inset-0 z-50 bg-background" : "relative"
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
          <CollapsibleTrigger className="flex items-center gap-2 hover-elevate active-elevate-2 rounded px-2 py-1">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <StatusIcon className="h-4 w-4" />
            <span className="font-medium">Testing your app</span>
            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'} className="ml-2">
              {session.status === 'running' && `${passedSteps}/${totalSteps} steps`}
              {session.status === 'completed' && `✓ ${passedSteps} passed`}
              {session.status === 'failed' && `✗ ${failedSteps} failed`}
              {session.status === 'initializing' && 'Starting...'}
            </Badge>
          </CollapsibleTrigger>
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="button-toggle-expand-test"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <CollapsibleContent>
          <div className={cn(
            "flex gap-4",
            isExpanded ? "h-[calc(100vh-56px)] p-4" : "max-h-[600px] p-4"
          )}>
            {/* Left: Browser Preview */}
            <Card className={cn(
              "flex-1 flex flex-col overflow-hidden",
              isExpanded ? "" : "max-w-2xl"
            )}>
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm text-muted-foreground ml-2">{session.url}</span>
                </div>
              </div>
              
              <div className="flex-1 bg-white dark:bg-gray-900 relative overflow-hidden">
                {latestScreenshot ? (
                  <img
                    src={`data:image/png;base64,${latestScreenshot}`}
                    alt="Browser preview"
                    className="w-full h-full object-contain"
                    data-testid="img-test-screenshot"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <PlayCircle className="h-12 w-12 animate-pulse" />
                    <span className="ml-3">Loading browser...</span>
                  </div>
                )}
                
                {/* Progress overlay */}
                {session.status === 'running' && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-background/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-pulse",
                          statusColors[session.status]
                        )} />
                        <span className="text-sm font-medium">
                          {currentStep?.description || 'Testing...'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Right: Narration & Steps */}
            <div className={cn(
              "flex flex-col gap-4",
              isExpanded ? "w-96" : "w-80"
            )}>
              {/* Narration */}
              <Card className="flex-1 overflow-hidden flex flex-col">
                <div className="p-3 border-b bg-muted/30">
                  <h3 className="text-sm font-medium">AI Narration</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="container-test-narration">
                  {session.narration.map((text, idx) => (
                    <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                      {text}
                    </p>
                  ))}
                  {session.narration.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">
                      Waiting for narration...
                    </p>
                  )}
                </div>
              </Card>
              
              {/* Test Steps */}
              <Card className="overflow-hidden flex flex-col max-h-64">
                <div className="p-3 border-b bg-muted/30">
                  <h3 className="text-sm font-medium">Test Steps</h3>
                </div>
                <div className="overflow-y-auto p-3 space-y-2" data-testid="container-test-steps">
                  {session.steps.map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-md border",
                        step.status === 'running' && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                        step.status === 'passed' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                        step.status === 'failed' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                        step.status === 'pending' && "bg-muted/30"
                      )}
                      data-testid={`step-${step.id}`}
                    >
                      {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 mt-0.5" />}
                      {step.status === 'running' && <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 animate-pulse" />}
                      {step.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />}
                      {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{step.description}</p>
                        {step.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{step.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {session.steps.length === 0 && (
                    <p className="text-sm text-muted-foreground italic p-2">
                      No steps yet...
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
