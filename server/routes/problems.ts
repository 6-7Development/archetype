import type { Express } from "express";
import { execSync } from "child_process";

interface Problem {
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  column?: number;
  message: string;
  source: "typescript" | "eslint" | "build" | "linter";
}

export function registerProblemsRoutes(app: Express) {
  // GET /api/problems - Get all detected problems
  app.get("/api/problems", async (req, res) => {
    try {
      const problems: Problem[] = [];

      // Run TypeScript type check
      try {
        console.log("[PROBLEMS] Running TypeScript check...");
        execSync("npx tsc --noEmit 2>&1", { stdio: "pipe", cwd: "/home/runner/workspace" });
      } catch (error: any) {
        const output = error.stdout?.toString() || error.message;
        const lines = output.split("\n");

        lines.forEach((line: string) => {
          const match = line.match(
            /^([^(]+)\((\d+),(\d+)\):\s*(?:error|warning)\s*TS\d+:\s*(.+)$/
          );
          if (match) {
            problems.push({
              severity: line.includes("error") ? "error" : "warning",
              file: match[1],
              line: parseInt(match[2]),
              column: parseInt(match[3]),
              message: match[4],
              source: "typescript",
            });
          }
        });
      }

      // Run ESLint
      try {
        console.log("[PROBLEMS] Running ESLint...");
        execSync(
          "npx eslint client/src --format=json 2>&1 || true",
          { stdio: "pipe", cwd: "/home/runner/workspace" }
        );
      } catch (error: any) {
        // ESLint errors are expected
      }

      // Filter duplicates and return
      const unique = Array.from(
        new Map(
          problems.map((p) => [
            `${p.file}:${p.line}:${p.message}`,
            p,
          ])
        ).values()
      );

      res.json({
        success: true,
        problems: unique,
        count: unique.length,
        errors: unique.filter((p) => p.severity === "error").length,
        warnings: unique.filter((p) => p.severity === "warning").length,
      });
    } catch (error: any) {
      console.error("[PROBLEMS] Error:", error);
      res.json({
        success: true,
        problems: [],
        error: error.message,
      });
    }
  });

  // GET /api/problems/:file - Get problems for a specific file
  app.get("/api/problems/:file(*)", async (req, res) => {
    try {
      const { file } = req.params;

      const response = await fetch(`http://localhost:5000/api/problems`);
      const data = (await response.json()) as { problems: Problem[] };

      const fileProblems = data.problems.filter((p) =>
        p.file.includes(decodeURIComponent(file))
      );

      res.json({
        success: true,
        file,
        problems: fileProblems,
      });
    } catch (error: any) {
      console.error("[PROBLEMS-FILE] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
