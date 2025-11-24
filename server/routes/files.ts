import { Router } from "express";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const router = Router();

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
]);

async function buildFileTree(dirPath: string, relativePath: string = ""): Promise<FileItem[]> {
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
        const children = await buildFileTree(entryPath, relPath);
        items.push({
          id: `dir-${id++}`,
          name: entry.name,
          type: "folder",
          path: relPath,
          children: children.length > 0 ? children : undefined,
        });
      } else {
        // Only include source files
        if (/\.(ts|tsx|js|jsx|json|md|py|css|html)$/.test(entry.name)) {
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
    console.error("[FILES] Error building tree:", error);
    return [];
  }
}

// GET /api/files - Get project file structure
router.get("/", async (req, res) => {
  try {
    const files = await buildFileTree(PROJECT_ROOT);
    res.json({ success: true, files });
  } catch (error) {
    console.error("[FILES-API] Error:", error);
    res.status(500).json({ success: false, error: "Failed to load files" });
  }
});

export default router;
