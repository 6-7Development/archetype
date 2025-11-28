import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Terminal as TerminalIcon, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface TerminalProps {
  projectId: string;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  content: string;
}

export function Terminal({ projectId }: TerminalProps) {
  const { user } = useAuth();
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', content: 'Welcome to Hexad Terminal' },
    { type: 'output', content: 'Type commands to interact with your project...' },
    { type: 'output', content: '' }
  ]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isConnected, setIsConnected] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId || !user?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?terminal=true&projectId=${projectId}`;
    
    console.log('[TERMINAL] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[TERMINAL] Connected');
      setIsConnected(true);
      setError(null);
      
      ws.send(JSON.stringify({
        type: 'auth',
        userId: user.id
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[TERMINAL] Message:', message);

        switch (message.type) {
          case 'welcome':
            setLines(prev => [...prev, { type: 'output', content: message.message }]);
            break;
          
          case 'output':
            setLines(prev => [...prev, { type: 'output', content: message.data }]);
            setIsExecuting(false);
            break;
          
          case 'error':
            setLines(prev => [...prev, { type: 'error', content: `Error: ${message.data}` }]);
            setIsExecuting(false);
            break;
          
          case 'command_complete':
            setLines(prev => [...prev, { type: 'output', content: '' }]);
            setIsExecuting(false);
            break;
        }
      } catch (err) {
        console.error('[TERMINAL] Failed to parse message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[TERMINAL] WebSocket error:', err);
      setError('Terminal connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('[TERMINAL] Disconnected');
      setIsConnected(false);
      setLines(prev => [...prev, { type: 'error', content: 'Terminal disconnected' }]);
    };

    return () => {
      console.log('[TERMINAL] Cleanup');
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [projectId, user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentCommand.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (currentCommand.trim() === 'clear') {
      setLines([]);
      setCurrentCommand('');
      return;
    }

    setLines(prev => [...prev, { type: 'input', content: `$ ${currentCommand}` }]);
    
    setCommandHistory(prev => [...prev, currentCommand]);
    setHistoryIndex(-1);
    
    setIsExecuting(true);
    wsRef.current.send(JSON.stringify({
      type: 'execute',
      command: currentCommand
    }));
    
    setCurrentCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-green-400 font-mono text-sm" data-testid="container-terminal">
      <div className="h-10 border-b border-green-800 bg-black/50 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" />
          <span className="text-xs">Terminal</span>
          {isConnected ? (
            <span className="text-xs text-green-500" data-testid="status-terminal-connected">● Connected</span>
          ) : (
            <span className="text-xs text-red-500" data-testid="status-terminal-disconnected">● Disconnected</span>
          )}
        </div>
        
        {isExecuting && (
          <div className="flex items-center gap-2 text-xs text-yellow-400" data-testid="status-terminal-executing">
            <Loader2 className="w-3 h-3 animate-spin" />
            Executing...
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="m-2 bg-red-950 border-red-800" data-testid="alert-terminal-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription data-testid="text-terminal-error">{error}</AlertDescription>
        </Alert>
      )}

      <div 
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto overflow-x-hidden" 
        data-testid="scroll-terminal-output"
      >
        <div className="space-y-1">
          {lines.map((line, i) => (
            <div
              key={i}
              data-testid={`text-terminal-line-${i}`}
              className={cn(
                "font-mono whitespace-pre-wrap break-all",
                line.type === 'input' && "text-green-300 font-semibold",
                line.type === 'error' && "text-red-400"
              )}
            >
              {line.content}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-green-800 bg-black/50 p-2">
        <div className="flex items-center gap-2">
          <span className="text-green-300 font-semibold">$</span>
          <Input
            ref={inputRef}
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected || isExecuting}
            placeholder={isConnected ? "Enter command..." : "Connecting..."}
            className="flex-1 bg-transparent border-0 text-green-400 placeholder:text-green-700 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
            autoComplete="off"
            data-testid="input-terminal-command"
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={!isConnected || isExecuting || !currentCommand.trim()}
            className="text-green-400 hover:text-green-300 hover:bg-green-950"
            data-testid="button-terminal-submit"
          >
            Run
          </Button>
        </div>
      </form>
    </div>
  );
}
