import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ConversationState } from '@shared/schema';

interface Message {
  id?: string;
  messageId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  images?: string[];
  [key: string]: any;
}

interface UseChatPersistenceOptions {
  projectId?: string | null;
  userId?: string;
  autoSave?: boolean;
  saveInterval?: number;
}

interface ChatSession {
  id: string;
  projectId?: string | null;
  userId: string;
  currentGoal?: string | null;
  sessionSummary?: string | null;
  context?: Record<string, any>;
  lastInteractionAt?: Date;
  createdAt: Date;
}

export function useChatPersistence({
  projectId,
  userId,
  autoSave = true,
  saveInterval = 5000,
}: UseChatPersistenceOptions = {}) {
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const queryKey = projectId 
    ? ['/api/conversation/sessions'] 
    : ['/api/conversation/sessions'];

  const { data: sessionsResponse, isLoading: loadingSessions } = useQuery<{ success: boolean; sessions: ChatSession[] }>({
    queryKey,
    enabled: !!userId,
  });
  
  const sessions = sessionsResponse?.sessions || [];

  const projectIdParam = projectId || 'general';
  const { data: currentSessionResponse, isLoading: loadingSession } = useQuery<{ success: boolean; state: ConversationState | null }>({
    queryKey: ['/api/conversation/state', projectIdParam],
    enabled: !!userId,
  });
  
  const currentSession = currentSessionResponse?.state;

  const createSessionMutation = useMutation({
    mutationFn: async (data: { projectId?: string }) => {
      const projectParam = data.projectId || 'general';
      return apiRequest<{ success: boolean; state: ConversationState }>('POST', `/api/conversation/state/${projectParam}/init`);
    },
    onSuccess: (response) => {
      if (response.state) {
        setSessionId(response.state.id);
      }
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveGoalMutation = useMutation({
    mutationFn: async (data: { projectId?: string; goal: string }) => {
      const projectParam = data.projectId || 'general';
      return apiRequest<{ success: boolean; state: ConversationState }>('POST', `/api/conversation/state/${projectParam}/goal`, { goal: data.goal });
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['/api/conversation/state', projectIdParam] });
    },
  });

  const clearSessionMutation = useMutation({
    mutationFn: async (projectIdToClear?: string) => {
      const projectParam = projectIdToClear || 'general';
      return apiRequest<{ success: boolean }>('POST', `/api/conversation/state/${projectParam}/clear`);
    },
    onSuccess: () => {
      setSessionId(null);
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveMessages = useCallback(async () => {
    if (!projectId || localMessages.length === 0 || !isDirty) return;

    try {
      const lastMessage = localMessages[localMessages.length - 1];
      if (lastMessage) {
        await saveGoalMutation.mutateAsync({
          projectId: projectId || undefined,
          goal: lastMessage.content.substring(0, 500),
        });
      }
    } catch (error) {
      console.error('[ChatPersistence] Failed to save session:', error);
    }
  }, [projectId, localMessages, isDirty, saveGoalMutation]);

  useEffect(() => {
    if (!autoSave || !isDirty) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveMessages();
    }, saveInterval);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [autoSave, isDirty, saveInterval, saveMessages]);

  useEffect(() => {
    return () => {
      if (isDirty && sessionId) {
        saveMessages();
      }
    };
  }, []);

  const addMessage = useCallback((message: Message) => {
    const messageWithId = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: message.timestamp || new Date(),
    };

    setLocalMessages(prev => [...prev, messageWithId]);
    setIsDirty(true);

    return messageWithId;
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setLocalMessages(prev => 
      prev.map(msg => 
        (msg.id === messageId || msg.messageId === messageId)
          ? { ...msg, ...updates }
          : msg
      )
    );
    setIsDirty(true);
  }, []);

  const clearMessages = useCallback(() => {
    setLocalMessages([]);
    setIsDirty(true);
  }, []);

  const startNewSession = useCallback(async () => {
    if (isDirty) {
      await saveMessages();
    }

    const response = await createSessionMutation.mutateAsync({
      projectId: projectId || undefined,
    });

    setLocalMessages([]);
    setIsDirty(false);
    
    return response.state;
  }, [createSessionMutation, isDirty, projectId, saveMessages]);

  const loadSession = useCallback(async (id: string) => {
    if (isDirty) {
      await saveMessages();
    }

    setSessionId(id);
    setIsDirty(false);
  }, [isDirty, saveMessages]);

  const deleteSession = useCallback(async (projectIdToDelete?: string) => {
    await clearSessionMutation.mutateAsync(projectIdToDelete);
  }, [clearSessionMutation]);

  const forceSave = useCallback(async () => {
    if (localMessages.length > 0) {
      await saveMessages();
    }
  }, [saveMessages, localMessages]);

  return {
    messages: localMessages,
    setMessages: setLocalMessages,
    sessions: sessions,
    currentSession,
    currentSessionId: sessionId || currentSession?.id,
    isLoading: loadingSessions || loadingSession,
    isSaving: saveGoalMutation.isPending || createSessionMutation.isPending,
    isDirty,
    addMessage,
    updateMessage,
    clearMessages,
    startNewSession,
    loadSession,
    deleteSession,
    forceSave,
  };
}

export function useChatHistory(projectId?: string | null) {
  const { data: history, isLoading } = useQuery<ChatMessage[]>({
    queryKey: projectId 
      ? ['/api/chat/history', projectId]
      : ['/api/chat/history'],
  });

  return {
    history: history || [],
    isLoading,
  };
}
