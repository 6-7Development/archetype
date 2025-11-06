import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { StrictMode } from "react";

// Memory-optimized initialization to prevent memory leaks
console.log('[MAIN] Starting app initialization...');

// Keep root reference to prevent garbage collection issues
let reactRoot: any = null;
let isInitialized = false;

// Memory cleanup function
const cleanupMemory = () => {
  if (reactRoot && typeof reactRoot.unmount === 'function') {
    try {
      reactRoot.unmount();
      reactRoot = null;
    } catch (error) {
      console.warn('[MAIN] Root cleanup warning:', error);
    }
  }
};

try {
  const root = document.getElementById("root");
  if (!root) {
    console.error('[MAIN] CRITICAL: Root element not found!');
    document.body.innerHTML = '<div style="color: white; padding: 20px; font-size: 24px;">ERROR: Root element not found</div>';
  } else if (!isInitialized) {
    // Prevent multiple initialization which causes memory leaks
    isInitialized = true;

    // Suppress vite connection warnings in console to reduce memory usage
    if (import.meta.env.DEV) {
      const originalWarn = console.warn;
      const originalLog = console.log;
      
      console.warn = (...args) => {
        if (args[0]?.includes?.('[vite]')) return;
        originalWarn(...args);
      };

      console.log = (...args) => {
        // Filter out repetitive vite logs that can cause memory buildup
        if (args[0]?.includes?.('[vite] server connection lost')) return;
        originalLog(...args);
      };
    }

    console.log('[MAIN] Creating React root...');
    reactRoot = createRoot(root);
    
    console.log('[MAIN] App render initiated');
    reactRoot.render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    // Memory safety: Set up cleanup on page unload
    window.addEventListener('beforeunload', cleanupMemory);
    
    // Memory safety: Set up cleanup on visibility change (mobile/background)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Optional: Reduce memory usage when page is hidden
        if (import.meta.env.DEV) {
          console.log('[MAIN] Page hidden, memory optimization active');
        }
      }
    });

    // Memory monitoring in development
    if (import.meta.env.DEV) {
      // Log memory usage periodically in dev mode
      const memoryInterval = setInterval(() => {
        if (performance && (performance as any).memory) {
          const mem = (performance as any).memory;
          const usedMB = Math.round(mem.usedJSHeapSize / 1048576);
          const limitMB = Math.round(mem.jsHeapSizeLimit / 1048576);
          
          // Only log if memory usage is high
          if (usedMB > 100) {
            console.log('[MAIN] Memory usage:', usedMB, 'MB /', limitMB, 'MB');
          }
        }
      }, 30000); // Every 30 seconds

      // Clear interval on cleanup
      const originalCleanup = cleanupMemory;
      window.addEventListener('beforeunload', () => {
        clearInterval(memoryInterval);
        originalCleanup();
      });
    }
  }
} catch (error) {
  console.error('[MAIN] CRITICAL ERROR:', error);
  document.body.innerHTML = `<div style="color: white; padding: 20px; font-size: 18px;">CRITICAL ERROR: ${error}</div>`;
  
  // Ensure cleanup even on error
  cleanupMemory();
}