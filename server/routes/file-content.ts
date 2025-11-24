import type { Express } from "express";
import { readFile, writeFile } from "fs/promises";
import { extname } from "path";
import { join } from "path";

const PROJECT_ROOT = "/home/runner/workspace";

function getLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".json": "json",
    ".py": "python",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".md": "markdown",
    ".yaml": ".yaml",
    ".yml": "yaml",
    ".sql": "sql",
    ".sh": "shell",
  };
  return languageMap[ext] || "plaintext";
}

function sanitizePath(filePath: string): string {
  // Prevent path traversal attacks
  const normalized = join(filePath).replace(/\.\./g, "");
  if (normalized.startsWith("/")) {
    return normalized.slice(1);
  }
  return normalized;
}

export function registerFileContentRoutes(app: Express) {
  // GET /api/file-content/:path - Get file contents
  app.get("/api/file-content/:path(*)", async (req, res) => {
    try {
      const filePath = sanitizePath(req.params.path);
      const fullPath = join(PROJECT_ROOT, filePath);

      // Security: ensure the file is within PROJECT_ROOT
      if (!fullPath.startsWith(PROJECT_ROOT)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const content = await readFile(fullPath, "utf-8");
      const language = getLanguage(filePath);

      res.json({
        success: true,
        path: filePath,
        content,
        language,
        size: content.length,
      });
    } catch (error: any) {
      console.error("[FILE-CONTENT] Error reading file:", error);
      if (error.code === "ENOENT") {
        return res.status(404).json({ error: "File not found" });
      }
      res.status(500).json({ error: error.message || "Failed to read file" });
    }
  });

  // POST /api/file-content/:path - Save file contents
  app.post("/api/file-content/:path(*)", async (req, res) => {
    try {
      const filePath = sanitizePath(req.params.path);
      const fullPath = join(PROJECT_ROOT, filePath);
      const { content } = req.body;

      // Security: ensure the file is within PROJECT_ROOT
      if (!fullPath.startsWith(PROJECT_ROOT)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!content) {
        return res.status(400).json({ error: "Content required" });
      }

      await writeFile(fullPath, content, "utf-8");

      res.json({
        success: true,
        path: filePath,
        size: content.length,
      });
    } catch (error: any) {
      console.error("[FILE-CONTENT] Error writing file:", error);
      res.status(500).json({ error: error.message || "Failed to save file" });
    }
  });
}
