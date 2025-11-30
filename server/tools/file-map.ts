/**
 * File Map Tool - Scout's file path identifier
 * Quickly identifies available files and their paths
 */

import fs from 'fs/promises';
import path from 'path';

export interface FileMapResult {
  success: boolean;
  projectRoot: string;
  fileMap: {
    [category: string]: string[];
  };
  error?: string;
}

/**
 * Get complete file map for Scout's file path identification
 * Scout calls this FIRST before any file operations
 */
export async function getFileMap(): Promise<FileMapResult> {
  const projectRoot = process.cwd();

  try {
    const fileMap: { [key: string]: string[] } = {
      client_pages: [],
      client_components: [],
      client_src: [],
      server_routes: [],
      server_tools: [],
      server_services: [],
      server_lib: [],
      shared_schema: [],
      config_files: [],
    };

    // Client pages
    const pagesDir = path.join(projectRoot, 'client/src/pages');
    try {
      const pages = await fs.readdir(pagesDir);
      fileMap.client_pages = pages
        .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
        .map(f => `client/src/pages/${f}`);
    } catch {}

    // Client components
    const componentsDir = path.join(projectRoot, 'client/src/components');
    try {
      const components = await fs.readdir(componentsDir);
      fileMap.client_components = components
        .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
        .slice(0, 20) // Limit to 20 for performance
        .map(f => `client/src/components/${f}`);
    } catch {}

    // Server routes
    const routesDir = path.join(projectRoot, 'server/routes');
    try {
      const routes = await fs.readdir(routesDir);
      fileMap.server_routes = routes
        .filter(f => f.endsWith('.ts'))
        .map(f => `server/routes/${f}`);
    } catch {}

    // Server tools
    const toolsDir = path.join(projectRoot, 'server/tools');
    try {
      const tools = await fs.readdir(toolsDir);
      fileMap.server_tools = tools
        .filter(f => f.endsWith('.ts'))
        .map(f => `server/tools/${f}`);
    } catch {}

    // Server services
    const servicesDir = path.join(projectRoot, 'server/services');
    try {
      const services = await fs.readdir(servicesDir);
      fileMap.server_services = services
        .filter(f => f.endsWith('.ts'))
        .map(f => `server/services/${f}`);
    } catch {}

    // Shared schema
    const schemaFile = path.join(projectRoot, 'shared/schema.ts');
    try {
      await fs.stat(schemaFile);
      fileMap.shared_schema = ['shared/schema.ts'];
    } catch {}

    // Config files
    const configFiles = ['vite.config.ts', 'tailwind.config.ts', 'tsconfig.json', 'drizzle.config.ts'];
    for (const cf of configFiles) {
      try {
        await fs.stat(path.join(projectRoot, cf));
        fileMap.config_files.push(cf);
      } catch {}
    }

    return {
      success: true,
      projectRoot,
      fileMap,
    };
  } catch (error: any) {
    return {
      success: false,
      projectRoot,
      fileMap: {},
      error: error.message,
    };
  }
}
