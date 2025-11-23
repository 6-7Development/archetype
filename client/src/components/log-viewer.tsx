import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Activity, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  FileCode, 
  Database, 
  Wifi, 
  Filter,
  X
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type LogLevel = 'error' | 'warning' | 'info' | 'success' | 'ai' | 'database' | 'websocket';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: string;
  fileContext?: string;
}

interface LogViewerProps {
  projectId?: string;
}

export function LogViewer({ projectId }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filters, setFilters] = useState<Set<LogLevel>>(new Set<LogLevel>(['error', 'warning', 'info', 'success', 'ai', 'database', 'websocket']));
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: recentLogs } = useQuery<LogEntry[]>({
    queryKey: ['/api/logs', projectId],
    enabled: !!projectId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (recentLogs) {
      setLogs(prev => {
        const newLogs = [...prev];
        recentLogs.forEach(log => {
          if (!newLogs.find(l => l.id === log.id)) {
            newLogs.push({
              ...log,
              timestamp: new Date(log.timestamp)
            });
          }
        });
        return newLogs.slice(-100);
      });
    }
  }, [recentLogs]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    const systemLog = (level: LogLevel, message: string, details?: string) => {
      setLogs(prev => [...prev.slice(-99), {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level,
        message,
        details
      }]);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        systemLog('info', 'Application resumed');
      }
    };

    const handleOnline = () => systemLog('success', 'Connection restored');
    const handleOffline = () => systemLog('error', 'Connection lost');
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    systemLog('info', 'Log viewer initialized');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getLogIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'success': return <CheckCircle2 className="h-4 w-4" />;
      case 'ai': return <Activity className="h-4 w-4" />;
      case 'database': return <Database className="h-4 w-4" />;
      case 'websocket': return <Wifi className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getLogColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-500/10';
      case 'warning': return 'text-amber-600 bg-amber-500/10';
      case 'success': return 'text-green-600 bg-green-500/10';
      case 'ai': return 'text-purple-600 bg-purple-500/10';
      case 'database': return 'text-blue-600 bg-blue-500/10';
      case 'websocket': return 'text-cyan-600 bg-cyan-500/10';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const toggleFilter = (level: LogLevel) => {
    setFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(level)) {
        newFilters.delete(level);
      } else {
        newFilters.add(level);
      }
      return newFilters;
    });
  };

  const filteredLogs = logs.filter(log => filters.has(log.level));

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 p-4 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">System Logs</h3>
          <Badge variant="outline" className="text-xs">
            {filteredLogs.length} entries
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-logs">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuCheckboxItem 
                checked={filters.has('error')}
                onCheckedChange={() => toggleFilter('error')}
              >
                <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                Errors
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={filters.has('warning')}
                onCheckedChange={() => toggleFilter('warning')}
              >
                <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
                Warnings
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={filters.has('success')}
                onCheckedChange={() => toggleFilter('success')}
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Success
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={filters.has('ai')}
                onCheckedChange={() => toggleFilter('ai')}
              >
                <Activity className="h-4 w-4 mr-2 text-purple-600" />
                AI Activity
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={filters.has('database')}
                onCheckedChange={() => toggleFilter('database')}
              >
                <Database className="h-4 w-4 mr-2 text-blue-600" />
                Database
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={filters.has('websocket')}
                onCheckedChange={() => toggleFilter('websocket')}
              >
                <Wifi className="h-4 w-4 mr-2 text-cyan-600" />
                WebSocket
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLogs([])}
            data-testid="button-clear-logs"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-2">
          {filteredLogs.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-muted/50 rounded-xl mb-4">
                  <Activity className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No logs to display</p>
                <p className="text-xs text-muted-foreground">
                  {logs.length === 0 
                    ? "System activity will appear here" 
                    : "Try adjusting your filters"}
                </p>
              </div>
            </Card>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${getLogColor(log.level)}`}
                data-testid={`log-entry-${log.level}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getLogIcon(log.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium">{log.message}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {log.fileContext && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <FileCode className="h-3 w-3 text-muted-foreground" />
                      <code className="text-xs text-muted-foreground font-mono">
                        {log.fileContext}
                      </code>
                    </div>
                  )}
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {log.details}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between gap-2 p-3 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoScroll(!autoScroll)}
          className={autoScroll ? 'text-primary' : ''}
          data-testid="button-toggle-autoscroll"
        >
          <span className="text-xs">
            {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
          </span>
        </Button>
      </div>
    </div>
  );
}
