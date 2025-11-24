import type { Express } from "express";
import { pool } from "../db";

export function registerDatabaseRoutes(app: Express) {
  // POST /api/db/query - Execute SQL query
  app.post("/api/db/query", async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query required" });
      }

      // Safety: prevent destructive operations in IDE
      const upperQuery = query.toUpperCase().trim();
      if (
        upperQuery.startsWith("DROP") ||
        upperQuery.startsWith("DELETE") ||
        upperQuery.startsWith("TRUNCATE")
      ) {
        return res.status(403).json({
          error: "Destructive operations not allowed in IDE",
        });
      }

      console.log("[DB-QUERY] Executing:", query.slice(0, 100));

      const result = await pool.query(query);

      res.json({
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map((f: any) => f.name),
      });
    } catch (error: any) {
      console.error("[DB-QUERY] Error:", error);
      res.status(400).json({ error: error.message || "Query failed" });
    }
  });

  // GET /api/db/schema - Get database schema
  app.get("/api/db/schema", async (req, res) => {
    try {
      const query = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM 
          information_schema.columns
        WHERE 
          table_schema = 'public'
        ORDER BY 
          table_name, ordinal_position
      `;

      const result = await pool.query(query);

      // Group by table
      const schema: Record<string, any[]> = {};
      result.rows.forEach((row: any) => {
        if (!schema[row.table_name]) {
          schema[row.table_name] = [];
        }
        schema[row.table_name].push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === "YES",
          default: row.column_default,
        });
      });

      res.json({ success: true, schema });
    } catch (error: any) {
      console.error("[DB-SCHEMA] Error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch schema" });
    }
  });

  // GET /api/db/tables/:table - Get table data
  app.get("/api/db/tables/:table", async (req, res) => {
    try {
      const { table } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

      // Validate table name (prevent SQL injection)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        return res.status(400).json({ error: "Invalid table name" });
      }

      const query = `SELECT * FROM "${table}" LIMIT ${limit}`;
      const result = await pool.query(query);

      res.json({
        success: true,
        table,
        rows: result.rows,
        count: result.rowCount,
      });
    } catch (error: any) {
      console.error("[DB-TABLE] Error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch table" });
    }
  });
}
