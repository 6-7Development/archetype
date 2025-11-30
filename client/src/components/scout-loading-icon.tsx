import { cn } from "@/lib/utils";

export function ScoutLoadingIcon() {
  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Animated hexagon pattern - Purple/Blue like Replit */}
      <div className="relative w-4 h-4">
        <style>{`
          @keyframes scout-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
          .scout-hex-1 { animation: scout-pulse 1.2s ease-in-out 0s infinite; }
          .scout-hex-2 { animation: scout-pulse 1.2s ease-in-out 0.1s infinite; }
          .scout-hex-3 { animation: scout-pulse 1.2s ease-in-out 0.2s infinite; }
          .scout-hex-4 { animation: scout-pulse 1.2s ease-in-out 0.3s infinite; }
          .scout-hex-5 { animation: scout-pulse 1.2s ease-in-out 0.4s infinite; }
          .scout-hex-6 { animation: scout-pulse 1.2s ease-in-out 0.5s infinite; }
        `}</style>
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          {/* Hexagon 1 - Top Left */}
          <circle cx="6" cy="6" r="2" fill="currentColor" className="scout-hex-1 text-purple-500 dark:text-purple-400" />
          {/* Hexagon 2 - Top Right */}
          <circle cx="14" cy="6" r="2" fill="currentColor" className="scout-hex-2 text-purple-500 dark:text-purple-400" />
          {/* Hexagon 3 - Right */}
          <circle cx="18" cy="12" r="2" fill="currentColor" className="scout-hex-3 text-purple-500 dark:text-purple-400" />
          {/* Hexagon 4 - Bottom Right */}
          <circle cx="14" cy="18" r="2" fill="currentColor" className="scout-hex-4 text-purple-500 dark:text-purple-400" />
          {/* Hexagon 5 - Bottom Left */}
          <circle cx="6" cy="18" r="2" fill="currentColor" className="scout-hex-5 text-purple-500 dark:text-purple-400" />
          {/* Hexagon 6 - Left */}
          <circle cx="2" cy="12" r="2" fill="currentColor" className="scout-hex-6 text-purple-500 dark:text-purple-400" />
        </svg>
      </div>
      {/* "Working..." Text */}
      <span className="text-xs font-medium text-muted-foreground">Working...</span>
    </div>
  );
}
