import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { StrictMode } from "react";

// Emergency diagnostic logging
console.log('[MAIN] Starting app initialization...');
console.log('[MAIN] Root element:', document.getElementById("root"));
console.log('[MAIN] Window location:', window.location.href);

try {
  const root = document.getElementById("root");
  if (!root) {
    console.error('[MAIN] CRITICAL: Root element not found!');
    document.body.innerHTML = '<div style="color: white; padding: 20px; font-size: 24px;">ERROR: Root element not found</div>';
  } else {
    // Suppress vite connection warnings in console
    if (import.meta.env.DEV) {
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (args[0]?.includes?.('[vite]')) return;
        originalWarn(...args);
      };
    }

    console.log('[MAIN] Creating React root...');
    const reactRoot = createRoot(root);
    console.log('[MAIN] App render initiated');
    reactRoot.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
} catch (error) {
  console.error('[MAIN] CRITICAL ERROR:', error);
  document.body.innerHTML = `<div style="color: white; padding: 20px; font-size: 18px;">CRITICAL ERROR: ${error}</div>`;
}
