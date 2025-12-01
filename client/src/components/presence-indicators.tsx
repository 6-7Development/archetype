/**
 * Presence Indicators Component
 * 
 * Displays real-time user presence for collaborative editing
 * Shows who is viewing/editing files, with colored cursors and avatars
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Edit3, Users } from "lucide-react";

export interface UserPresence {
  id: string;
  username: string;
  avatar?: string;
  color: string;
  currentFile?: string;
  cursorPosition?: { line: number; column: number };
  status: 'viewing' | 'editing' | 'idle';
  lastActive: Date;
}

interface PresenceIndicatorsProps {
  currentFile?: string;
  className?: string;
}

const PRESENCE_COLORS = [
  '#F7B500',
  '#00D4B3',
  '#3B82F6',
  '#EC4899',
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#EF4444',
];

let colorIndex = 0;
const userColors = new Map<string, string>();

function getUserColor(userId: string): string {
  if (!userColors.has(userId)) {
    userColors.set(userId, PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length]);
    colorIndex++;
  }
  return userColors.get(userId)!;
}

function usePresenceSocket(currentFile?: string) {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/presence`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (currentFile) {
          ws.send(JSON.stringify({ type: 'join', file: currentFile }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence-update') {
            setUsers(data.users.map((u: any) => ({
              ...u,
              color: getUserColor(u.id),
              lastActive: new Date(u.lastActive),
            })));
          }
        } catch (e) {
          console.warn('[PRESENCE] Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    } catch (e) {
      console.warn('[PRESENCE] WebSocket connection failed:', e);
    }

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentFile) {
      wsRef.current.send(JSON.stringify({ type: 'join', file: currentFile }));
    }
  }, [currentFile]);

  const updateCursor = useCallback((line: number, column: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'cursor', 
        line, 
        column,
        file: currentFile 
      }));
    }
  }, [currentFile]);

  const setEditingStatus = useCallback((isEditing: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'status', 
        status: isEditing ? 'editing' : 'viewing' 
      }));
    }
  }, []);

  return { users, connected, updateCursor, setEditingStatus };
}

export function PresenceIndicators({ currentFile, className }: PresenceIndicatorsProps) {
  const { users, connected } = usePresenceSocket(currentFile);
  
  const usersInCurrentFile = users.filter(u => u.currentFile === currentFile);
  const editingUsers = usersInCurrentFile.filter(u => u.status === 'editing');
  const viewingUsers = usersInCurrentFile.filter(u => u.status === 'viewing');

  if (!connected || usersInCurrentFile.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="presence-indicators">
      <AnimatePresence mode="popLayout">
        {usersInCurrentFile.slice(0, 5).map((user) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar 
                    className="w-7 h-7 border-2"
                    style={{ borderColor: user.color }}
                  >
                    {user.avatar ? (
                      <AvatarImage src={user.avatar} alt={user.username} />
                    ) : null}
                    <AvatarFallback 
                      className="text-xs"
                      style={{ backgroundColor: `${user.color}20`, color: user.color }}
                    >
                      {user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span 
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
                    style={{ 
                      backgroundColor: user.status === 'editing' ? '#00D4B3' : '#F7B500' 
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  {user.status === 'editing' ? (
                    <Edit3 className="w-3 h-3 text-mint" />
                  ) : (
                    <Eye className="w-3 h-3 text-honey" />
                  )}
                  <span>{user.username}</span>
                  <span className="text-muted-foreground">
                    {user.status === 'editing' ? 'editing' : 'viewing'}
                  </span>
                </div>
                {user.cursorPosition && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Line {user.cursorPosition.line}, Col {user.cursorPosition.column}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ))}
      </AnimatePresence>

      {usersInCurrentFile.length > 5 && (
        <Badge variant="secondary" className="text-xs">
          +{usersInCurrentFile.length - 5}
        </Badge>
      )}
    </div>
  );
}

export function PresenceSummary({ className }: { className?: string }) {
  const { users, connected } = usePresenceSocket();

  if (!connected) {
    return (
      <Badge variant="outline" className={cn("text-xs", className)}>
        <Users className="w-3 h-3 mr-1" />
        Offline
      </Badge>
    );
  }

  const activeUsers = users.filter(u => 
    new Date().getTime() - u.lastActive.getTime() < 60000
  );

  if (activeUsers.length === 0) {
    return (
      <Badge variant="outline" className={cn("text-xs", className)}>
        <Users className="w-3 h-3 mr-1" />
        Solo session
      </Badge>
    );
  }

  const editingCount = activeUsers.filter(u => u.status === 'editing').length;
  const viewingCount = activeUsers.filter(u => u.status === 'viewing').length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn("text-xs gap-1 cursor-default", className)}
          data-testid="presence-summary"
        >
          <Users className="w-3 h-3" />
          <span>{activeUsers.length} online</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          {editingCount > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Edit3 className="w-3 h-3 text-mint" />
              <span>{editingCount} editing</span>
            </div>
          )}
          {viewingCount > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Eye className="w-3 h-3 text-honey" />
              <span>{viewingCount} viewing</span>
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            {activeUsers.map(u => u.username).join(', ')}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function CursorOverlay({ users, currentFile }: { users: UserPresence[]; currentFile: string }) {
  const relevantUsers = users.filter(
    u => u.currentFile === currentFile && u.cursorPosition
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {relevantUsers.map((user) => (
        <motion.div
          key={user.id}
          className="absolute flex items-start gap-0.5"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            top: `${(user.cursorPosition!.line - 1) * 20}px`,
            left: `${(user.cursorPosition!.column - 1) * 8}px`
          }}
          transition={{ duration: 0.1 }}
          style={{ zIndex: 100 }}
        >
          <div 
            className="w-0.5 h-5 animate-pulse"
            style={{ backgroundColor: user.color }}
          />
          <div 
            className="text-[10px] px-1 py-0.5 rounded-sm -mt-3 whitespace-nowrap shadow-sm"
            style={{ 
              backgroundColor: user.color,
              color: 'white'
            }}
          >
            {user.username}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export { usePresenceSocket };
