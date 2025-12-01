import { FileText, RefreshCw, Download, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
}

interface LogsViewerProps {
  refreshKey?: number;
}

export function LogsViewer({ refreshKey = 0 }: LogsViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: '14:32:15', level: 'info', message: 'Server started on port 5000', source: 'Express' },
    { timestamp: '14:32:16', level: 'info', message: 'Database connected', source: 'Postgres' },
    { timestamp: '14:32:18', level: 'warn', message: 'Slow query detected (245ms)', source: 'Database' },
    { timestamp: '14:32:20', level: 'info', message: 'Build completed successfully', source: 'Vite' },
  ]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      case 'debug':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-3 h-3" />;
      case 'warn':
        return <AlertCircle className="w-3 h-3" />;
      case 'info':
        return <CheckCircle className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <Tabs defaultValue="output" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2 my-3 flex-wrap">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-xs px-2 py-1 border rounded bg-background"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
          <Button size="sm" variant="ghost" className="h-6">
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
          <Button size="sm" variant="ghost" className="h-6">
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
          <Button size="sm" variant="ghost" className="h-6">
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
          <label className="text-xs flex items-center gap-1 ml-auto">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            Auto-scroll
          </label>
        </div>

        <TabsContent value="output" className="flex-1 overflow-hidden">
          <div className="h-full bg-background rounded border overflow-auto font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="p-4 text-muted-foreground text-center">
                No logs to display
              </div>
            ) : (
              <div className="p-2">
                {filteredLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`py-1 flex items-start gap-2 ${getLevelColor(log.level)}`}
                  >
                    <span className="text-muted-foreground text-xs flex-shrink-0">
                      {log.timestamp}
                    </span>
                    <span className="flex-shrink-0">{getLevelIcon(log.level)}</span>
                    <span className="text-muted-foreground text-xs flex-shrink-0 w-16">
                      [{log.source}]
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="build" className="flex-1 overflow-auto">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              Build logs will appear here when you run a build command
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="flex-1 overflow-auto">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              Errors will be highlighted here
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
