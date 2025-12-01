/**
 * Code Sandbox Runner - Execute AI-generated code safely in chat
 * Provides inline code execution with output display
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Square, Loader2, AlertTriangle, CheckCircle, Copy, Check, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CodeSandboxRunnerProps {
  code: string;
  language: 'javascript' | 'typescript' | 'python';
  onResult?: (result: ExecutionResult) => void;
  className?: string;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export function CodeSandboxRunner({ code, language, onResult, className }: CodeSandboxRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const executeCode = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch('/api/sandbox/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, language }),
      });

      const data = await response.json();
      
      const result = data.result || {};
      const executionResult: ExecutionResult = {
        success: data.success && result.success !== false,
        output: result.stdout || '',
        error: result.stderr || result.killedReason || data.error,
        executionTime: result.duration || 0,
      };

      setResult(executionResult);
      onResult?.(executionResult);

      if (!executionResult.success) {
        toast({
          title: 'Execution Error',
          description: executionResult.error || 'Code execution failed',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorResult: ExecutionResult = {
        success: false,
        output: '',
        error: error.message || 'Failed to execute code',
        executionTime: 0,
      };
      setResult(errorResult);
      toast({
        title: 'Sandbox Error',
        description: 'Failed to connect to sandbox',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languageColors: Record<string, string> = {
    javascript: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    typescript: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    python: 'bg-green-500/10 text-green-600 border-green-500/30',
  };

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="code-sandbox-runner">
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Code Sandbox</CardTitle>
          <Badge variant="outline" className={cn("text-xs", languageColors[language])}>
            {language}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={copyCode}
            data-testid="button-copy-code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            variant={isRunning ? "destructive" : "default"}
            className="h-7 gap-1"
            onClick={isRunning ? () => setIsRunning(false) : executeCode}
            disabled={!code.trim()}
            data-testid="button-run-code"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Running</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span className="text-xs">Run</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Code Display */}
        <ScrollArea className="max-h-48">
          <pre className="p-3 text-xs font-mono bg-slate-950 text-slate-100 overflow-x-auto">
            <code>{code}</code>
          </pre>
        </ScrollArea>

        {/* Output Display */}
        {result && (
          <div className={cn(
            "border-t p-3",
            result.success ? "bg-green-50/50 dark:bg-green-950/20" : "bg-red-50/50 dark:bg-red-950/20"
          )}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              <span className={cn(
                "text-xs font-medium",
                result.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
              )}>
                {result.success ? 'Success' : 'Error'}
                {result.executionTime > 0 && ` (${result.executionTime}ms)`}
              </span>
            </div>
            <ScrollArea className="max-h-32">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {result.success ? result.output : result.error}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CodeSandboxRunner;
