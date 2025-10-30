import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserAvatarState } from "@shared/schema";

export type MoodType = 
  | "happy" | "excited" | "thinking" | "working" | "success" | "error"
  | "annoyed" | "sad" | "idle" | "confused" | "content" | "cheerful"
  | "love" | "angry" | "displeased";

interface UseLumoAvatarReturn {
  mood: MoodType;
  avatarState: UserAvatarState | undefined;
  isLoading: boolean;
  error: Error | null;
  setMood: (mood: MoodType, options?: { autoMoodEnabled?: boolean; particlePreference?: string }) => Promise<void>;
}

export function useLumoAvatar(userId?: string): UseLumoAvatarReturn {
  const [currentMood, setCurrentMood] = useState<MoodType>("happy");

  const { data: avatarState, isLoading, error } = useQuery<UserAvatarState>({
    queryKey: ["/api/avatar/state"],
    enabled: !!userId,
    staleTime: 30000,
  });

  useEffect(() => {
    if (avatarState?.currentMood) {
      setCurrentMood(avatarState.currentMood as MoodType);
    }
  }, [avatarState]);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ws) {
      const ws = (window as any).ws;
      
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "AVATAR_MOOD_CHANGE" && data.userId === userId) {
            setCurrentMood(data.mood as MoodType);
            queryClient.invalidateQueries({ queryKey: ["/api/avatar/state"] });
          }
        } catch (error) {
          console.error("[LUMO-HOOK] WebSocket message parse error:", error);
        }
      };
      
      ws.addEventListener("message", handleMessage);
      
      return () => {
        ws.removeEventListener("message", handleMessage);
      };
    }
  }, [userId]);

  const moodMutation = useMutation({
    mutationFn: async (params: { 
      mood: MoodType; 
      autoMoodEnabled?: boolean; 
      particlePreference?: string 
    }) => {
      const response = await apiRequest("POST", "/api/avatar/mood", params);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avatar/state"] });
    },
  });

  const setMood = useCallback(
    async (
      mood: MoodType, 
      options?: { autoMoodEnabled?: boolean; particlePreference?: string }
    ) => {
      setCurrentMood(mood);
      await moodMutation.mutateAsync({ mood, ...options });
    },
    [moodMutation]
  );

  return {
    mood: currentMood,
    avatarState,
    isLoading,
    error: error as Error | null,
    setMood,
  };
}
