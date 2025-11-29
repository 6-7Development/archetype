import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, AlertCircle, Loader2, PlayCircle, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  startedAt?: Date;
  completedAt?: Date;
  output?: string;
  error?: string;
  subSteps?: WorkflowStep[];
}

export interface WorkflowExecution {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStep[];
  startedAt?: Date;
  completedAt?: Date;
  totalDuration?: number;
  currentStepIndex?: number;
}

interface WorkflowStepDisplayProps {
  workflow: WorkflowExecution;
  compact?: boolean;
  showOutput?: boolean;
}

function StepIcon({ status }: { status: WorkflowStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" data-testid="icon-step-completed" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-primary animate-spin" data-testid="icon-step-running" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-destructive" data-testid="icon-step-failed" />;
    case 'skipped':
      return <Pause className="w-4 h-4 text-muted-foreground" data-testid="icon-step-skipped" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" data-testid="icon-step-pending" />;
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function StepItem({ step, showOutput = false }: { step: WorkflowStep; showOutput?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(step.status === 'running' || step.status === 'failed');
  const hasDetails = step.output || step.error || (step.subSteps && step.subSteps.length > 0);

  return (
    <div 
      className={cn(
        "border-l-2 pl-3 py-1.5 transition-colors",
        step.status === 'completed' && "border-green-500/50",
        step.status === 'running' && "border-primary",
        step.status === 'failed' && "border-destructive",
        step.status === 'pending' && "border-muted-foreground/30",
        step.status === 'skipped' && "border-muted-foreground/20"
      )}
      data-testid={`workflow-step-${step.id}`}
    >
      <div className="flex items-center gap-2">
        <StepIcon status={step.status} />
        <span className={cn(
          "text-sm font-medium flex-1",
          step.status === 'completed' && "text-green-600 dark:text-green-400",
          step.status === 'running' && "text-primary",
          step.status === 'failed' && "text-destructive",
          (step.status === 'pending' || step.status === 'skipped') && "text-muted-foreground"
        )}>
          {step.name}
        </span>
        {step.duration && (
          <span className="text-xs text-muted-foreground" data-testid={`step-duration-${step.id}`}>
            {formatDuration(step.duration)}
          </span>
        )}
        {hasDetails && showOutput && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
            data-testid={`button-expand-step-${step.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>
      
      {step.description && (
        <p className="text-xs text-muted-foreground mt-0.5 ml-6">{step.description}</p>
      )}
      
      {isExpanded && hasDetails && showOutput && (
        <div className="mt-2 ml-6 space-y-2">
          {step.output && (
            <pre className="text-xs bg-secondary/30 p-2 rounded overflow-x-auto max-h-32 font-mono" data-testid={`step-output-${step.id}`}>
              {step.output}
            </pre>
          )}
          {step.error && (
            <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-x-auto max-h-32 font-mono" data-testid={`step-error-${step.id}`}>
              {step.error}
            </pre>
          )}
          {step.subSteps && step.subSteps.length > 0 && (
            <div className="space-y-1 ml-2">
              {step.subSteps.map((subStep) => (
                <StepItem key={subStep.id} step={subStep} showOutput={showOutput} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkflowStepDisplay({ workflow, compact = false, showOutput = true }: WorkflowStepDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  
  const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
  const totalSteps = workflow.steps.length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div 
      className="bg-card border border-border rounded-lg overflow-hidden"
      data-testid={`workflow-display-${workflow.id}`}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors"
            data-testid={`button-toggle-workflow-${workflow.id}`}
          >
            <PlayCircle className={cn(
              "w-5 h-5 flex-shrink-0",
              workflow.status === 'running' && "text-primary animate-pulse",
              workflow.status === 'completed' && "text-green-500",
              workflow.status === 'failed' && "text-destructive"
            )} />
            
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{workflow.name}</span>
                <Badge 
                  variant={
                    workflow.status === 'completed' ? 'default' :
                    workflow.status === 'running' ? 'secondary' :
                    workflow.status === 'failed' ? 'destructive' :
                    'outline'
                  }
                  className="text-xs"
                  data-testid={`badge-workflow-status-${workflow.id}`}
                >
                  {workflow.status}
                </Badge>
              </div>
              
              {!compact && (
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{completedSteps}/{totalSteps} steps</span>
                  <span>•</span>
                  <span>{progress}%</span>
                  {workflow.totalDuration && (
                    <>
                      <span>•</span>
                      <span>{formatDuration(workflow.totalDuration)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Progress bar */}
            <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-300",
                  workflow.status === 'failed' ? "bg-destructive" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
                data-testid={`progress-bar-${workflow.id}`}
              />
            </div>
            
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t border-border px-3 py-2 space-y-1 bg-secondary/10">
            {workflow.steps.map((step) => (
              <StepItem key={step.id} step={step} showOutput={showOutput} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function WorkflowStepInline({ step }: { step: WorkflowStep }) {
  return (
    <div className="flex items-center gap-2 text-sm" data-testid={`inline-step-${step.id}`}>
      <StepIcon status={step.status} />
      <span className={cn(
        step.status === 'running' && "text-primary font-medium",
        step.status === 'completed' && "text-green-600 dark:text-green-400",
        step.status === 'failed' && "text-destructive"
      )}>
        {step.name}
      </span>
      {step.status === 'running' && (
        <span className="text-xs text-muted-foreground animate-pulse">in progress...</span>
      )}
    </div>
  );
}
