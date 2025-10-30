import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  FileText, 
  FolderOpen, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Wrench,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealMessage {
  id: string;
  type: 'init' | 'thought' | 'tool' | 'write-pending' | 'approved' | 'rejected' | 'completed' | 'error';
  text?: string;
  path?: string;
  directory?: string;
  diff?: string;
  timestamp: Date;
  sessionId?: string;
}

interface PlatformHealingChatProps {
  messages: HealMessage[];
  pendingWrite: { path: string; diff: string; sessionId: string } | null;
  onApprove: (sessionId: string) => void;
  onReject: (sessionId: string) => void;
  isLoading?: boolean;
}

export function PlatformHealingChat({
  messages,
  pendingWrite,
  onApprove,
  onReject,
  isLoading = false
}: PlatformHealingChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, autoScroll]);

  const handleScroll = (e: any) => {
    const target = e.target;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setAutoScroll(isAtBottom);
  };

  function renderMessage(msg: HealMessage) {
    switch (msg.type) {
      case 'init':
        return (
          <div className="flex gap-3" data-testid={`message-init-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground mb-1">LomuAI initialized</div>
              <div className="text-sm">{msg.text}</div>
            </div>
          </div>
        );

      case 'thought':
        return (
          <div className="flex gap-3" data-testid={`message-thought-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground mb-1">Thinking</div>
              <div className="text-sm">{msg.text}</div>
            </div>
          </div>
        );

      case 'tool':
        return (
          <div className="flex gap-3" data-testid={`message-tool-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                {msg.directory ? (
                  <FolderOpen className="w-4 h-4 text-green-500" />
                ) : (
                  <FileText className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground mb-1">
                {msg.directory ? 'Listing directory' : 'Reading file'}
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {msg.path || msg.directory}
              </Badge>
            </div>
          </div>
        );

      case 'write-pending':
        return (
          <div className="flex gap-3" data-testid={`message-write-pending-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-yellow-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground mb-1">Approval required</div>
              <div className="text-sm mb-2">Proposed file change: <code className="text-xs">{msg.path}</code></div>
            </div>
          </div>
        );

      case 'approved':
        return (
          <div className="flex gap-3" data-testid={`message-approved-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-green-600 dark:text-green-400">
                ✓ Change approved: {msg.path}
              </div>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="flex gap-3" data-testid={`message-rejected-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-red-600 dark:text-red-400">
                ✗ Change rejected: {msg.path}
              </div>
            </div>
          </div>
        );

      case 'completed':
        return (
          <div className="flex gap-3" data-testid={`message-completed-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ Healing session completed
              </div>
              {msg.text && <div className="text-sm text-muted-foreground mt-1">{msg.text}</div>}
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex gap-3" data-testid={`message-error-${msg.id}`}>
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-red-600 dark:text-red-400">Error</div>
              <div className="text-sm text-muted-foreground mt-1">{msg.text}</div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea 
        className="flex-1 px-4" 
        onScroll={handleScroll}
        ref={scrollRef}
        data-testid="chat-scroll-area"
      >
        <div className="space-y-4 py-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground py-12">
              <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No healing session in progress</p>
              <p className="text-sm mt-2">Start a new healing run below</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id}>{renderMessage(msg)}</div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-blue-500 animate-pulse" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground">LomuAI is analyzing...</div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {pendingWrite && (
        <Card className="m-4 p-4 border-yellow-500/50 bg-yellow-500/5" data-testid="approval-card">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm mb-1">Approval Required</h4>
              <p className="text-sm text-muted-foreground">
                LomuAI wants to modify: <code className="text-xs">{pendingWrite.path}</code>
              </p>
            </div>
          </div>
          {pendingWrite.diff && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-2">Proposed changes:</div>
              <pre className="text-xs bg-background border rounded p-2 overflow-x-auto max-h-48">
                {pendingWrite.diff}
              </pre>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onApprove(pendingWrite.sessionId)}
              data-testid="button-approve"
              className="flex-1"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject(pendingWrite.sessionId)}
              data-testid="button-reject"
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
