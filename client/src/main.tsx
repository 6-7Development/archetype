import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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
    console.log('[MAIN] Creating React root...');
    createRoot(root).render(<App />);
    console.log('[MAIN] App render initiated');
  }
} catch (error) {
  console.error('[MAIN] CRITICAL ERROR:', error);
  document.body.innerHTML = `<div style="color: white; padding: 20px; font-size: 18px;">CRITICAL ERROR: ${error}</div>`;
}
