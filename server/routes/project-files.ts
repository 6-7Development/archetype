import type { Express } from "express";
import { readdir } from "fs/promises";
import { join } from "path";

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileItem[];
}

const PROJECT_ROOT = "/home/runner/workspace";
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".cache",
  ".git",
  "dist",
  "build",
  ".next",
  "migrations",
  ".meta-sysop",
  ".upm",
]);

async function buildFileTree(dirPath: string, relativePath: string = "", depth: number = 0): Promise<FileItem[]> {
  // Limit depth to avoid deep recursion
  if (depth > 3) return [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const items: FileItem[] = [];
    let id = 0;

    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;

      const entryPath = join(dirPath, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const children = await buildFileTree(entryPath, relPath, depth + 1);
        if (children.length > 0) {
          items.push({
            id: `dir-${id++}`,
            name: entry.name,
            type: "folder",
            path: relPath,
            children,
          });
        }
      } else {
        // Include source files and configs
        if (/\.(ts|tsx|js|jsx|json|md|py|css|html|yaml|yml)$/.test(entry.name)) {
          items.push({
            id: `file-${id++}`,
            name: entry.name,
            type: "file",
            path: relPath,
          });
        }
      }
    }

    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error("[PROJECT-FILES] Error building tree:", error);
    return [];
  }
}

export function registerProjectFileRoutes(app: Express) {
  // GET /api/project-files - Get project file structure
  app.get("/api/project-files", async (req, res) => {
    try {
      console.log("[PROJECT-FILES] Building file tree...");
      const files = await buildFileTree(PROJECT_ROOT);
      console.log(`[PROJECT-FILES] Found ${files.length} root items`);
      res.json({ success: true, files });
    } catch (error) {
      console.error("[PROJECT-FILES-API] Error:", error);
      res.status(500).json({ success: false, error: "Failed to load project files" });
    }
  });
}
