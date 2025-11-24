import { useEffect, useState } from 'react';

export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetAt: string;
  isThrottled: boolean;
  queuePosition?: number;
  estimatedWaitMs?: number;
}

export function useRateLimitPolling(enabled = true) {
  const [status, setStatus] = useState<RateLimitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/rate-limit/status', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (error) {
        console.warn('[RATE-LIMIT] Polling failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Poll every 5 seconds
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [enabled]);

  return { status, isLoading };
}
