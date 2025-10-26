import { useMemo } from 'react';

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  progressSteps?: any[];
  checkpoint?: any;
  isSummary?: boolean;
  images?: string[];
}

export function useDisplayMessages(messages: Message[]) {
  const displayMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

  return {
    displayMessages,
    isReversed: true
  };
}