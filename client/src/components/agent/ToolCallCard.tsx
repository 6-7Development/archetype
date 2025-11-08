/**
 * Tool Call Card - Shows individual tool executions with collapsible details
 * Based on Agent Chatroom UX spec
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Copy,
  RotateCcw
} from 'lucide-react';
import { ToolCalledData, ToolSucceededData, ToolFailedData } from '@shared/agentEvents';

interface ToolCallCardProps {
  called: ToolCalledData;
  result?: ToolSucceededData | ToolFailedData;
}

export function ToolCallCard({ called, result }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isSuccess = result && 'result' in result;
  const isFailed = result && 'error' in result;
  const isPending = !result;
  
  const statusColor = isSuccess 
    ? 'text-green-600 dark:text-green-400' 
    : isFailed 
    ? 'text-red-600 dark:text-red-400'
    : 'text-blue-600 dark:text-blue-400';

  const statusIcon = isSuccess 
    ? <CheckCircle2 className="h-4 w-4" /> 
    : isFailed 
    ? <XCircle className="h-4 w-4" />
    : <Clock className="h-4 w-4 animate-pulse" />;

  const duration = result?.durationMs ? `${result.durationMs}ms` : '—';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card 
      className="mb-2 bg-card/50 border border-border/50" 
      data-testid={`tool-card-${called.correlationId}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 hover-elevate rounded transition-colors"
              data-testid="tool-card-toggle"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            <code className="text-sm font-mono font-semibold" data-testid="tool-name">
              {called.name}
            </code>
            
            <Badge variant="outline" className={`${statusColor} border-current`} data-testid="tool-status">
              <span className="mr-1">{statusIcon}</span>
              {isPending ? 'running' : isSuccess ? 'success' : 'failed'}
            </Badge>
            
            <span className="text-xs text-muted-foreground" data-testid="tool-duration">
              {duration}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => copyToClipboard(JSON.stringify(called.args, null, 2))}
              data-testid="tool-copy-args"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            
            {isFailed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-testid="tool-retry"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 pb-3">
          <Tabs defaultValue="args" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="args" className="text-xs" data-testid="tab-args">Arguments</TabsTrigger>
              <TabsTrigger value="result" className="text-xs" data-testid="tab-result">Result</TabsTrigger>
              <TabsTrigger value="stdout" className="text-xs" data-testid="tab-stdout">Stdout</TabsTrigger>
              <TabsTrigger value="stderr" className="text-xs" data-testid="tab-stderr">Stderr</TabsTrigger>
            </TabsList>

            <TabsContent value="args" className="mt-2">
              <pre className="text-xs bg-muted/50 p-3 rounded border border-border overflow-x-auto" data-testid="tool-args-content">
                {JSON.stringify(called.args, null, 2)}
              </pre>
            </TabsContent>

            <TabsContent value="result" className="mt-2">
              <pre className="text-xs bg-muted/50 p-3 rounded border border-border overflow-x-auto" data-testid="tool-result-content">
                {result && 'result' in result 
                  ? JSON.stringify(result.result, null, 2)
                  : result && 'error' in result
                  ? result.error
                  : 'Pending...'}
              </pre>
            </TabsContent>

            <TabsContent value="stdout" className="mt-2">
              <pre className="text-xs bg-muted/50 p-3 rounded border border-border overflow-x-auto font-mono" data-testid="tool-stdout-content">
                {result && 'result' in result && typeof result.result === 'object' && 'stdout' in result.result
                  ? result.result.stdout || '(empty)'
                  : '(not applicable)'}
              </pre>
            </TabsContent>

            <TabsContent value="stderr" className="mt-2">
              <pre className="text-xs bg-muted/50 p-3 rounded border border-border overflow-x-auto font-mono text-red-600 dark:text-red-400" data-testid="tool-stderr-content">
                {result && 'stderr' in result && result.stderr
                  ? result.stderr
                  : result && 'result' in result && typeof result.result === 'object' && 'stderr' in result.result
                  ? result.result.stderr || '(empty)'
                  : '(empty)'}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
