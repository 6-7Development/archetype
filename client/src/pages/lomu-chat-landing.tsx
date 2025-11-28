/**
 * Redirect page to help users navigate to HexadChat
 * Shows clear instructions and auto-redirects to /lomu
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function HexadChatLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Auto-redirect to /lomu after 2 seconds
    const timer = setTimeout(() => {
      setLocation('/lomu');
    }, 2000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-background to-card">
      <div className="text-center space-y-4 p-8 max-w-md">
        <h1 className="text-3xl font-bold">Loading LomuAI Chat...</h1>
        <p className="text-muted-foreground">Redirecting to chat interface</p>
        <div className="pt-4">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-xs text-muted-foreground">If not redirected, <a href="/lomu" className="underline hover:text-foreground">click here</a></p>
      </div>
    </div>
  );
}
