import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteDevServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteDevServer({
    server: {
      middlewareMode: true,
      hmr: {
        server,
        host: '0.0.0.0',
        port: 5000,
        protocol: 'ws',
      },
    },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      let template = await fs.readFile(
        path.resolve(viteConfig.root!, "index.html"),
        "utf-8",
      );
      template = await vite.transformIndexHtml(url, template);
      const ssrManifest = undefined;
      const { render } = await vite.ssrLoadModule("/src/main.tsx", {
        fixStacktrace: true,
      });
      const appHtml = await render(url, ssrManifest);
      const html = template.replace(`<!--ssr-outlet-->`, appHtml);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}