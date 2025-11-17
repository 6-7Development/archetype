import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Clock, MessageSquare, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ConversationSession {
  id: string;
  projectId: string | null;
  currentGoal: string | null;
  sessionSummary: string | null;
  lastInteractionAt: string; // ISO date string from API
  apiCallCount: number;
  conversationStartTime: string; // ISO date string from API
}

interface MessageHistoryProps {
  onSessionSelect?: (session: ConversationSession) => void;
  onClose?: () => void;
  currentSessionId?: string | null;
}

export function MessageHistory({ onSessionSelect, onClose, currentSessionId }: MessageHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, refetch } = useQuery<{ sessions: ConversationSession[]; total: number }>({
    queryKey: ['/api/conversation/sessions', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      
      const res = await fetch(`/api/conversation/sessions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
  });

  const sessions = data?.sessions || [];

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const formatSessionTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const getSessionTitle = (session: ConversationSession) => {
    if (session.currentGoal) return session.currentGoal;
    if (session.sessionSummary) return session.sessionSummary;
    if (session.projectId) return `Project: ${session.projectId}`;
    return 'General conversation';
  };

  const getSessionPreview = (session: ConversationSession) => {
    if (session.sessionSummary && session.sessionSummary !== session.currentGoal) {
      return session.sessionSummary.slice(0, 100);
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Conversation History</h2>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-history"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-search-history"
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 animate-pulse" />
            Loading conversations...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchTerm ? 'No conversations match your search' : 'No conversation history yet'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const title = getSessionTitle(session);
              const preview = getSessionPreview(session);

              return (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect?.(session)}
                  className={cn(
                    "w-full text-left p-3 rounded-md transition-colors",
                    "hover:bg-accent/50",
                    isActive && "bg-accent border border-accent-border"
                  )}
                  data-testid={`session-item-${session.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-sm line-clamp-1 flex-1">
                      {title}
                    </h3>
                    {isActive && (
                      <Badge variant="default" className="text-xs shrink-0">
                        Active
                      </Badge>
                    )}
                  </div>

                  {preview && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {preview}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatSessionTime(session.lastInteractionAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{session.apiCallCount} calls</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {sessions.length > 0 && (
        <div className="p-3 border-t text-xs text-center text-muted-foreground">
          Showing {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
