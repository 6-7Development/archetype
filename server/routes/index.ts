import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer } from "ws";

// Import all route registration functions
import { registerAuthRoutes } from "./auth";
import { registerAdminRoutes } from "./admin";
import { registerChatRoutes } from "./chat";
import { registerFileRoutes } from "./files";
import { registerFolderRoutes } from "./folders";
import { registerProjectRoutes } from "./projects";
import { registerDeploymentRoutes } from "./deployments";
import { registerFileUploadRoutes } from "./fileUploads";
import { registerFileOperationRoutes } from "./fileOps";
import { registerSubscriptionRoutes } from "./subscriptions";
import { registerUserPreferencesRoutes } from "./user-preferences";
import { registerMigrationRoutes } from "./migrations";
import { registerOwnerSetupRoutes } from "./owner-setup";
import { registerScratchpadRoutes } from "./scratchpad";
import { registerTerminalRoutes } from "./terminal";
import { registerArchitectNotesRoutes } from "./architect-notes";
import { registerProjectFileRoutes } from "./project-files";
import { registerFileContentRoutes } from "./file-content";

/**
 * Main route registration function
 * Initializes all API routes and WebSocket server
 */
export async function registerRoutes(app: Express): Promise<Server & { wss?: WebSocketServer }> {
  // Create HTTP server for WebSocket support (ES module import)
  const http = await import("http");
  const server = http.createServer(app) as Server;
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server });
  console.log("[ROUTES] WebSocket server created");

  // Register HTTP API routes (order matters - register more specific routes first)
  console.log("[ROUTES] Registering HTTP routes...");
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerChatRoutes(app, { wss });
  registerFileRoutes(app);
  registerFolderRoutes(app);
  registerProjectRoutes(app);
  registerDeploymentRoutes(app);
  registerFileUploadRoutes(app);
  registerFileOperationRoutes(app);
  registerSubscriptionRoutes(app);
  registerUserPreferencesRoutes(app);
  registerMigrationRoutes(app);
  registerOwnerSetupRoutes(app);
  registerScratchpadRoutes(app, { wss });
  registerArchitectNotesRoutes(app);
  registerProjectFileRoutes(app);
  registerFileContentRoutes(app);
  
  // Register WebSocket terminal routes (must be after HTTP routes)
  console.log("[ROUTES] Registering WebSocket terminal routes...");
  registerTerminalRoutes(wss, server);
  
  // Register LomuAI chat routes from the main lomuChat.ts file
  console.log("[LOMU-AI] LomuAI router mounted at /api/lomu-ai");
  try {
    const { default: lomuChatRouter } = await import("../lomuChat.js");
    if (lomuChatRouter) {
      app.use("/api/lomu-ai", lomuChatRouter);
    }
  } catch (e) {
    console.warn("[LOMU-AI] Failed to load lomuChat router (non-critical):", (e as any).message);
  }

  // Register other specialized routers
  console.log("[ROUTES] Registering specialized routers...");
  try {
    const { default: architectRouter } = await import("./architect.js");
    if (architectRouter) {
      app.use("/api/architect", architectRouter);
      console.log("[ARCHITECT] I AM Architect router mounted at /api/architect");
    }
  } catch (e) {
    console.warn("[ARCHITECT] Failed to load architect router:", (e as any).message);
  }

  try {
    const { default: creditsRouter } = await import("./credits.js");
    if (creditsRouter) {
      app.use("/api/credits", creditsRouter);
      console.log("[CREDITS] Credits router mounted at /api/credits");
    }
  } catch (e) {
    console.warn("[CREDITS] Failed to load credits router:", (e as any).message);
  }

  try {
    const { default: approvalRouter } = await import("./approvalRoutes.js");
    if (approvalRouter) {
      app.use("/api", approvalRouter);
      console.log("[APPROVALS] Approval router mounted at /api");
    }
  } catch (e) {
    console.warn("[APPROVALS] Failed to load approval router:", (e as any).message);
  }

  try {
    const { default: agentsRouter } = await import("./agents.js");
    if (agentsRouter) {
      app.use("/api/agents", agentsRouter);
      console.log("[AGENTS] Agents router mounted at /api/agents");
    }
  } catch (e) {
    console.warn("[AGENTS] Failed to load agents router:", (e as any).message);
  }

  try {
    const { default: webhooksRouter } = await import("./webhooks.js");
    if (webhooksRouter) {
      app.use("/api/webhooks", webhooksRouter);
      console.log("[WEBHOOKS] Webhooks router mounted at /api/webhooks");
    }
  } catch (e) {
    console.warn("[WEBHOOKS] Failed to load webhooks router:", (e as any).message);
  }

  try {
    const { default: gitRouter } = await import("./git.js");
    if (gitRouter) {
      app.use(gitRouter);
      console.log("[GIT] Git router mounted");
    }
  } catch (e) {
    console.warn("[GIT] Failed to load git router:", (e as any).message);
  }

  console.log("✅ All routes registered successfully");

  // Attach wss to server for access by other modules
  (server as any).wss = wss;
  
  return server;
}

export default registerRoutes;
