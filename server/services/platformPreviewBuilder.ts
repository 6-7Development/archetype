import * as esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// LRU Cache for transpiled assets (max 100 entries, ~50MB)
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove oldest entries if over max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache for transpiled assets
const assetCache = new LRUCache<string, string>(100);

export interface BuildArtifact {
  path: string;
  size: number;
  hash: string;
}

export interface PreviewManifest {
  sessionId: string;
  buildStatus: 'pending' | 'building' | 'success' | 'failed';
  artifacts: BuildArtifact[];
  errors: string[];
  timestamp: string;
  entryPoints?: string[];
  dependencies?: string[];
  ttl: number; // Time-to-live in seconds (300 = 5 minutes)
}

// Session storage for preview manifests (auto-cleanup)
const manifestStore = new Map<string, PreviewManifest>();
const sessionTimers = new Map<string, NodeJS.Timeout>();

// Cleanup session after TTL expires
function scheduleCleanup(sessionId: string, ttlSeconds: number = 300) {
  // Clear existing timer if any
  const existingTimer = sessionTimers.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    console.log(`[PREVIEW-BUILDER] Cleaning up session: ${sessionId}`);
    
    // Delete manifest
    manifestStore.delete(sessionId);
    sessionTimers.delete(sessionId);
    
    // Delete artifacts directory
    const sessionDir = path.join('/tmp/platform-previews', sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
      console.log(`[PREVIEW-BUILDER] ✅ Cleaned up artifacts for session: ${sessionId}`);
    } catch (error) {
      console.error(`[PREVIEW-BUILDER] Failed to cleanup session ${sessionId}:`, error);
    }
  }, ttlSeconds * 1000);

  sessionTimers.set(sessionId, timer);
}

/**
 * Build platform preview with esbuild
 * @param sessionId - Unique session identifier
 * @param changedFiles - Array of file paths that changed
 * @returns Preview manifest with build status and artifacts
 */
export async function buildPlatformPreview(
  sessionId: string,
  changedFiles: string[]
): Promise<PreviewManifest> {
  const startTime = Date.now();
  const sessionDir = path.join('/tmp/platform-previews', sessionId);
  const outputDir = path.join(sessionDir, 'dist');

  console.log(`[PREVIEW-BUILDER] Starting build for session: ${sessionId}`);
  console.log(`[PREVIEW-BUILDER] Changed files:`, changedFiles);

  // Initialize manifest
  const manifest: PreviewManifest = {
    sessionId,
    buildStatus: 'building',
    artifacts: [],
    errors: [],
    timestamp: new Date().toISOString(),
    entryPoints: [],
    dependencies: [],
    ttl: 300, // 5 minutes
  };

  manifestStore.set(sessionId, manifest);

  try {
    // Create session directory
    await fs.mkdir(outputDir, { recursive: true });

    // Determine entry points from changed files
    const entryPoints: string[] = [];
    const clientEntry = changedFiles.find(f => 
      f.includes('client/src/main.tsx') || 
      f.includes('client/src/index.tsx')
    );
    const serverEntry = changedFiles.find(f => 
      f.includes('server/index.ts') || 
      f.includes('server/app.ts')
    );

    if (clientEntry) {
      entryPoints.push(path.join(PROJECT_ROOT, 'client/src/main.tsx'));
    } else {
      // Default client entry
      entryPoints.push(path.join(PROJECT_ROOT, 'client/src/main.tsx'));
    }

    manifest.entryPoints = entryPoints;

    // Build with timeout (30 seconds max)
    const buildPromise = esbuild.build({
      entryPoints,
      bundle: true,
      outdir: outputDir,
      format: 'esm',
      splitting: true,
      minify: false, // Skip minification for faster builds
      sourcemap: true,
      platform: 'browser',
      target: 'es2020',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'css',
        '.svg': 'file',
        '.png': 'file',
        '.jpg': 'file',
      },
      metafile: true,
      write: true,
      logLevel: 'warning',
      // Sandbox: Disable dangerous Node.js modules
      external: ['fs', 'child_process', 'path', 'os', 'crypto'],
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Build timeout: exceeded 30 seconds')), 30000);
    });

    const result = await Promise.race([buildPromise, timeoutPromise]);

    // Extract artifacts from build result
    if (result.metafile) {
      const outputs = Object.keys(result.metafile.outputs);
      
      for (const outputPath of outputs) {
        const fullPath = path.resolve(outputPath);
        const stats = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

        // Cache transpiled asset
        assetCache.set(hash, content.toString());

        manifest.artifacts.push({
          path: path.relative(sessionDir, fullPath),
          size: stats.size,
          hash,
        });
      }

      // Extract dependencies
      const inputs = Object.keys(result.metafile.inputs);
      manifest.dependencies = inputs.slice(0, 20); // Top 20 dependencies
    }

    manifest.buildStatus = 'success';
    const duration = Date.now() - startTime;
    console.log(`[PREVIEW-BUILDER] ✅ Build successful in ${duration}ms for session: ${sessionId}`);
    console.log(`[PREVIEW-BUILDER] Generated ${manifest.artifacts.length} artifacts`);

  } catch (error: any) {
    manifest.buildStatus = 'failed';
    manifest.errors.push(error.message || 'Unknown build error');
    console.error(`[PREVIEW-BUILDER] ❌ Build failed for session ${sessionId}:`, error);
  }

  // Update manifest store
  manifestStore.set(sessionId, manifest);

  // Schedule cleanup after TTL
  scheduleCleanup(sessionId, manifest.ttl);

  return manifest;
}

/**
 * Get preview manifest for a session
 */
export function getPreviewManifest(sessionId: string): PreviewManifest | undefined {
  return manifestStore.get(sessionId);
}

/**
 * Get cached asset by hash
 */
export function getCachedAsset(hash: string): string | undefined {
  return assetCache.get(hash);
}

/**
 * Serve preview file from session directory
 */
export async function servePreviewFile(
  sessionId: string,
  filePath: string
): Promise<{ content: Buffer; mimeType: string } | null> {
  const sessionDir = path.join('/tmp/platform-previews', sessionId);
  const fullPath = path.join(sessionDir, filePath);

  // Security: Prevent path traversal
  const normalizedPath = path.normalize(fullPath);
  if (!normalizedPath.startsWith(sessionDir)) {
    throw new Error('Invalid file path: path traversal detected');
  }

  try {
    const content = await fs.readFile(fullPath);
    
    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.map': 'application/json',
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    return { content, mimeType };
  } catch (error) {
    console.error(`[PREVIEW-BUILDER] Failed to serve file ${filePath}:`, error);
    return null;
  }
}

/**
 * Clear all cached assets and manifests
 */
export function clearAllCaches(): void {
  assetCache.clear();
  manifestStore.clear();
  
  // Clear all timers
  for (const timer of Array.from(sessionTimers.values())) {
    clearTimeout(timer);
  }
  sessionTimers.clear();
  
  console.log('[PREVIEW-BUILDER] ✅ Cleared all caches and manifests');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    assetCacheSize: assetCache['cache'].size,
    manifestStoreSize: manifestStore.size,
    activeTimers: sessionTimers.size,
  };
}
