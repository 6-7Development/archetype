/**
 * Progress Journey Component
 * ==========================
 * Visual progress bar to represent user's journey through processes.
 */

import { cn } from '@/lib/utils';
import { Check, Circle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface JourneyStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface ProgressJourneyProps {
  steps: JourneyStep[];
  currentStep?: number;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
}

export function ProgressJourney({ 
  steps, 
  currentStep = 0, 
  className,
  orientation = 'horizontal',
  showLabels = true,
}: ProgressJourneyProps) {
  const isVertical = orientation === 'vertical';
  const progressPercent = steps.length > 1 
    ? (currentStep / (steps.length - 1)) * 100 
    : 0;

  return (
    <div 
      className={cn(
        'relative',
        isVertical ? 'flex flex-col gap-4' : 'flex items-center gap-2',
        className
      )}
      data-testid="progress-journey"
    >
      {/* Progress Line Background */}
      <div 
        className={cn(
          'absolute bg-muted rounded-full',
          isVertical 
            ? 'left-4 top-4 bottom-4 w-0.5' 
            : 'top-4 left-4 right-4 h-0.5'
        )}
      />
      
      {/* Active Progress Line */}
      <motion.div 
        className={cn(
          'absolute bg-primary rounded-full',
          isVertical 
            ? 'left-4 top-4 w-0.5' 
            : 'top-4 left-4 h-0.5'
        )}
        initial={isVertical ? { height: 0 } : { width: 0 }}
        animate={isVertical 
          ? { height: `${progressPercent}%` }
          : { width: `${progressPercent}%` }
        }
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />

      {/* Steps */}
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = step.status === 'completed';
        const isError = step.status === 'error';
        const isPending = step.status === 'pending';

        return (
          <div 
            key={step.id}
            className={cn(
              'relative z-10',
              isVertical ? 'flex items-start gap-3' : 'flex flex-col items-center'
            )}
            data-testid={`step-${step.id}`}
          >
            {/* Step Indicator */}
            <motion.div 
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                isCompleted && 'bg-primary border-primary text-primary-foreground',
                isActive && 'bg-background border-primary text-primary',
                isError && 'bg-destructive border-destructive text-destructive-foreground',
                isPending && 'bg-muted border-muted-foreground/30 text-muted-foreground'
              )}
              animate={{
                scale: isActive ? [1, 1.1, 1] : 1,
              }}
              transition={{
                scale: { duration: 1, repeat: isActive ? Infinity : 0 },
              }}
            >
              <AnimatePresence mode="wait">
                {isCompleted ? (
                  <motion.div
                    key="check"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                  >
                    <Check className="w-4 h-4" />
                  </motion.div>
                ) : isActive ? (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="circle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Circle className="w-3 h-3 fill-current" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Step Label */}
            {showLabels && (
              <div className={cn(
                isVertical ? 'flex-1' : 'text-center mt-2',
                'min-w-0'
              )}>
                <p className={cn(
                  'text-sm font-medium truncate',
                  isCompleted && 'text-primary',
                  isActive && 'text-foreground',
                  isError && 'text-destructive',
                  isPending && 'text-muted-foreground'
                )}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {step.description}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Simple Linear Progress Bar
 */
interface SimpleProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  color?: 'default' | 'success' | 'warning' | 'error';
}

export function SimpleProgress({ 
  value, 
  max = 100, 
  className,
  showLabel = false,
  label,
  color = 'default',
}: SimpleProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  
  const colorClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)} data-testid="simple-progress">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-sm font-medium">{Math.round(percent)}%</span>
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div 
          className={cn('h-full rounded-full', colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
