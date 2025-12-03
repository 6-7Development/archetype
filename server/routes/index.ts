import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer } from "ws";
import healthRouter from "../api/health";
import monitoringRouter from "./monitoring";

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
import { registerDatabaseRoutes } from "./database";
import { registerProblemsRoutes } from "./problems";
import { registerConsultationRoutes } from "./consultations";
import { registerRateLimitRoutes } from "./rate-limit-status";
import { registerProgressRoutes } from "./progress";
import { registerGdprRoutes } from "./gdpr";
import { registerShareRoutes } from "./share";
import { registerScoutWorkflowRoutes } from "./scout-workflow";

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

  // Register health check routes FIRST (bypass all middleware, should never be rate limited)
  app.use(healthRouter);
  app.use('/api/monitoring', monitoringRouter);
  console.log("[ROUTES] Health check and monitoring routes registered");

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
  registerDatabaseRoutes(app);
  registerProblemsRoutes(app);
  registerConsultationRoutes(app);
  registerRateLimitRoutes(app);
  registerProgressRoutes(app);
  registerGdprRoutes(app);
  registerShareRoutes(app);
  
  // Register WebSocket terminal routes (must be after HTTP routes)
  console.log("[ROUTES] Registering WebSocket terminal routes...");
  registerTerminalRoutes(wss, server);
  
  // Register BeeHiveAI chat routes from the main beehiveChat.ts file
  console.log("[BEEHIVE-AI] BeeHiveAI router mounted at /api/beehive-ai");
  try {
    const { default: beehiveChatRouter } = await import("../beehiveChat.js");
    if (beehiveChatRouter) {
      app.use("/api/beehive-ai", beehiveChatRouter);
    }
  } catch (e) {
    console.warn("[BEEHIVE-AI] Failed to load beehiveChat router (non-critical):", (e as any).message);
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
      app.use("/api/git", gitRouter);
      console.log("[GIT] Git router mounted at /api/git");
    }
  } catch (e) {
    console.warn("[GIT] Failed to load git router:", (e as any).message);
  }

  // SWARM Mode - Parallel Multi-Agent Execution
  try {
    const { default: swarmRouter } = await import("./swarm-mode.js");
    if (swarmRouter) {
      app.use("/api/swarm", swarmRouter);
      console.log("[SWARM] SWARM Mode router mounted at /api/swarm");
    }
  } catch (e) {
    console.warn("[SWARM] Failed to load SWARM Mode router:", (e as any).message);
  }

  // Additional specialized routers
  try {
    const { default: toolsRouter } = await import("./tools.js");
    if (toolsRouter) {
      app.use("/api/tools", toolsRouter);
      console.log("[TOOLS] Tools router mounted at /api/tools");
    }
  } catch (e) {
    console.warn("[TOOLS] Failed to load tools router:", (e as any).message);
  }

  try {
    const { default: automationsRouter } = await import("./automations.js");
    if (automationsRouter) {
      app.use("/api/automations", automationsRouter);
      console.log("[AUTOMATIONS] Automations router mounted at /api/automations");
    }
  } catch (e) {
    console.warn("[AUTOMATIONS] Failed to load automations router:", (e as any).message);
  }

  try {
    const { default: imageGenRouter } = await import("./imageGeneration.js");
    if (imageGenRouter) {
      app.use("/api/image-gen", imageGenRouter);
      console.log("[IMAGE-GEN] Image Generation router mounted at /api/image-gen");
    }
  } catch (e) {
    console.warn("[IMAGE-GEN] Failed to load image generation router:", (e as any).message);
  }

  // Code Execution Sandbox
  try {
    const { default: sandboxRouter } = await import("./sandbox.js");
    if (sandboxRouter) {
      app.use("/api/sandbox", sandboxRouter);
      console.log("[SANDBOX] Code execution sandbox router mounted at /api/sandbox");
    }
  } catch (e) {
    console.warn("[SANDBOX] Failed to load sandbox router:", (e as any).message);
  }

  // Pinned Items
  try {
    const { default: pinnedRouter } = await import("./pinned.js");
    if (pinnedRouter) {
      app.use("/api/pinned", pinnedRouter);
      console.log("[PINNED] Pinned items router mounted at /api/pinned");
    }
  } catch (e) {
    console.warn("[PINNED] Failed to load pinned items router:", (e as any).message);
  }

  // AI Models Catalogue
  try {
    const { default: modelsRouter } = await import("./models.js");
    if (modelsRouter) {
      app.use("/api/models", modelsRouter);
      console.log("[MODELS] AI Models router mounted at /api/models");
    }
  } catch (e) {
    console.warn("[MODELS] Failed to load models router:", (e as any).message);
  }

  // Chat/Code Exports
  try {
    const { default: exportsRouter } = await import("./exports.js");
    if (exportsRouter) {
      app.use("/api/exports", exportsRouter);
      console.log("[EXPORTS] Exports router mounted at /api/exports");
    }
  } catch (e) {
    console.warn("[EXPORTS] Failed to load exports router:", (e as any).message);
  }

  // AI Suggestions (Suggest Next Steps)
  try {
    const { default: suggestionsRouter } = await import("./suggestions.js");
    if (suggestionsRouter) {
      app.use("/api/ai", suggestionsRouter);
      console.log("[SUGGESTIONS] AI Suggestions router mounted at /api/ai");
    }
  } catch (e) {
    console.warn("[SUGGESTIONS] Failed to load suggestions router:", (e as any).message);
  }

  // API Documentation (OpenAPI/Swagger)
  try {
    const { default: apiDocsRouter } = await import("./api-docs.js");
    if (apiDocsRouter) {
      app.use("/api", apiDocsRouter);
      console.log("[API-DOCS] API Documentation mounted at /api/docs");
    }
  } catch (e) {
    console.warn("[API-DOCS] Failed to load API documentation router:", (e as any).message);
  }

  // Smart Code Completion
  try {
    const { default: codeCompletionRouter } = await import("./codeCompletion.js");
    if (codeCompletionRouter) {
      app.use("/api/code-completion", codeCompletionRouter);
      console.log("[CODE-COMPLETION] Smart Code Completion router mounted at /api/code-completion");
    }
  } catch (e) {
    console.warn("[CODE-COMPLETION] Failed to load code completion router:", (e as any).message);
  }

  // Project Health Dashboard
  try {
    const { default: projectHealthRouter } = await import("./projectHealth.js");
    if (projectHealthRouter) {
      app.use("/api/project-health", projectHealthRouter);
      console.log("[PROJECT-HEALTH] Project Health Dashboard router mounted at /api/project-health");
    }
  } catch (e) {
    console.warn("[PROJECT-HEALTH] Failed to load project health router:", (e as any).message);
  }

  // Walkthrough/Tutorial System
  try {
    const { default: walkthroughRouter } = await import("./walkthrough.js");
    if (walkthroughRouter) {
      app.use("/api/walkthroughs", walkthroughRouter);
      console.log("[WALKTHROUGH] Walkthrough/Tutorial router mounted at /api/walkthroughs");
    }
  } catch (e) {
    console.warn("[WALKTHROUGH] Failed to load walkthrough router:", (e as any).message);
  }

  // Scout Workflow Routes
  try {
    registerScoutWorkflowRoutes(app);
  } catch (e) {
    console.warn("[SCOUT-WORKFLOW] Failed to register Scout workflow routes:", (e as any).message);
  }

  console.log("✅ All routes registered successfully");

  // Attach wss to server for access by other modules
  (server as any).wss = wss;
  
  return server;
}

export default registerRoutes;
