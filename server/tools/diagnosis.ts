import { promises as fs } from 'fs';
import path from 'path';

export interface DiagnosisParams {
  target: 'performance' | 'security' | 'memory' | 'database' | 'system' | 'all';
  focus?: string[]; // Specific files to check
}

export interface DiagnosisFinding {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  issue: string;
  evidence: string; // Actual code snippets or numbers
  location: string; // File:line
}

export interface DiagnosisResult {
  success: boolean;
  summary: string;
  findings: DiagnosisFinding[];
  recommendations: string[];
  metrics?: {
    filesAnalyzed: number;
    totalLines: number;
    issuesFound: number;
  };
  error?: string;
}

/**
 * Sanitize file path to prevent path traversal and command injection
 * @param filePath - The file path to sanitize (absolute or relative)
 * @returns Sanitized relative path or null if invalid
 */
function sanitizeFilePath(filePath: string): string | null {
  // Reject null, undefined, or empty paths
  if (!filePath || typeof filePath !== 'string') {
    console.warn(`🚨 SECURITY: Invalid file path type: ${typeof filePath}`);
    return null;
  }
  
  const projectRoot = process.cwd();
  
  // Handle absolute paths - normalize to relative if within workspace
  let pathToValidate = filePath;
  if (path.isAbsolute(filePath)) {
    // Check if absolute path is within our workspace
    if (filePath.startsWith(projectRoot + path.sep) || filePath === projectRoot) {
      // Strip PROJECT_ROOT to convert to relative path
      pathToValidate = path.relative(projectRoot, filePath);
      console.log(`🔧 NORMALIZED: Absolute path ${filePath} → ${pathToValidate}`);
    } else {
      // Absolute path outside workspace - reject for security
      console.warn(`🚨 SECURITY: Rejected absolute path outside workspace: ${filePath}`);
      return null;
    }
  }
  
  // Reject path traversal attempts (..) - CRITICAL security check
  if (pathToValidate.includes('..')) {
    console.warn(`🚨 SECURITY: Rejected path traversal: ${pathToValidate}`);
    return null;
  }
  
  // Reject paths with shell metacharacters or dangerous characters
  // Allow normal spaces, dashes, dots, slashes, and underscores in filenames
  // Block shell injection characters: ; & | ` $ ( ) { } [ ] < > " ' and dangerous whitespace
  if (/[;&|`$(){}[\]<>"\t\n\r]/.test(pathToValidate)) {
    console.warn(`🚨 SECURITY: Rejected unsafe file path with shell metacharacters: ${pathToValidate}`);
    return null;
  }
  
  // Normalize the path
  const normalized = path.normalize(pathToValidate);
  
  // Resolve to absolute for validation
  const resolved = path.resolve(projectRoot, normalized);
  const workspaceRoot = projectRoot + path.sep;
  
  // Ensure it's within the workspace
  if (!resolved.startsWith(workspaceRoot) && resolved !== projectRoot) {
    console.warn(`🚨 SECURITY: Rejected path outside workspace: ${pathToValidate} -> ${resolved}`);
    return null;
  }
  
  // Get relative path for return
  const relativePath = path.relative(projectRoot, resolved);
  
  // Additional safety: Only block the most critical sensitive files
  // More permissive to allow normal diagnosis of platform code
  const criticalPatterns = [
    /^\.env($|\.)/,  // .env, .env.local, etc. (secrets)
    /^\.git\//,       // .git directory (version control internals)
  ];
  
  for (const pattern of criticalPatterns) {
    if (pattern.test(relativePath)) {
      console.warn(`🚨 SECURITY: Rejected access to critical file: ${relativePath}`);
      return null;
    }
  }
  
  // Return workspace-relative path (safe for diagnosis)
  return relativePath;
}

/**
 * Count lines in a file safely (replaces `wc -l`)
 * @param filePath - Workspace-relative path to the file
 * @returns Number of lines in the file, or 0 if file doesn't exist
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

/**
 * Count pattern matches in content (replaces `grep -c`)
 * @param content - The content to search
 * @param pattern - Regular expression pattern to match
 * @returns Number of matches found
 */
function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Perform automated code diagnosis - analyze actual code for issues
 * This tool gives SySop the ability to verify claims with real evidence
 */
export async function performDiagnosis(params: DiagnosisParams): Promise<DiagnosisResult> {
  try {
    const findings: DiagnosisFinding[] = [];
    const filesAnalyzed: Set<string> = new Set();
    let totalLines = 0;

    // Default files to check - updated for actual platform structure
    const DEFAULT_FILES = [
      'server/routes/lomuChat.ts',
      'server/lomuSuperCore.ts',
      'server/services/healOrchestrator.ts',
      'server/gemini.ts',
      'server/anthropic.ts',
      'server/index.ts',
      'server/db.ts',
      'shared/schema.ts',
    ];

    // Sanitize all file paths to prevent command injection
    // FIX: Handle both string and array for focus parameter (AI agents sometimes pass strings)
    let rawFiles: string[];
    if (!params.focus) {
      rawFiles = DEFAULT_FILES;
    } else if (typeof params.focus === 'string') {
      // Convert single string to array
      console.log(`[DIAGNOSIS] ⚠️ Focus parameter was a string, converting to array`);
      rawFiles = [params.focus];
    } else if (Array.isArray(params.focus)) {
      rawFiles = params.focus;
    } else {
      console.warn(`[DIAGNOSIS] Invalid focus parameter type: ${typeof params.focus}, falling back to defaults`);
      rawFiles = DEFAULT_FILES;
    }
    
    console.log(`[DIAGNOSIS] Raw files to check: ${JSON.stringify(rawFiles)}`);
    
    const filesToCheck = rawFiles
      .map(sanitizeFilePath)
      .filter((path): path is string => path !== null);

    console.log(`[DIAGNOSIS] After sanitization: ${JSON.stringify(filesToCheck)}`);

    // Warn if some paths were filtered out (BEFORE fallback logic)
    if (filesToCheck.length < rawFiles.length) {
      console.warn(
        `⚠️  ${rawFiles.length - filesToCheck.length} file path(s) were rejected by security validation`
      );
    }

    // FIX: Use separate variable for effective files to avoid mutation issues
    let effectiveFiles: string[];
    
    if (filesToCheck.length === 0) {
      console.warn('[DIAGNOSIS] All paths rejected, falling back to DEFAULT_FILES');
      const defaultSanitized = DEFAULT_FILES
        .map(sanitizeFilePath)
        .filter((path): path is string => path !== null);
      
      if (defaultSanitized.length === 0) {
        return {
          success: false,
          summary: 'No valid files to diagnose',
          findings: [],
          recommendations: [],
          error: 'All file paths (including defaults) were rejected by security validation. This is likely a configuration issue.',
        };
      }
      
      // Use sanitized defaults as effective files
      effectiveFiles = defaultSanitized;
      console.log(`[DIAGNOSIS] Using ${effectiveFiles.length} default files`);
    } else {
      // Use sanitized user-provided files
      effectiveFiles = filesToCheck;
    }

    // Run diagnosis based on target (using effectiveFiles instead of filesToCheck)
    // 'system' target runs all checks (same as 'all')
    console.log(`[DIAGNOSIS] Target: ${params.target}, Files: ${effectiveFiles.length}`);
    const runAll = params.target === 'all' || params.target === 'system';
    
    if (params.target === 'performance' || runAll) {
      console.log('[DIAGNOSIS] Running performance checks...');
      await diagnosePerformance(findings, effectiveFiles, filesAnalyzed);
    }

    if (params.target === 'memory' || runAll) {
      console.log('[DIAGNOSIS] Running memory checks...');
      await diagnoseMemory(findings, effectiveFiles, filesAnalyzed);
    }

    if (params.target === 'database' || runAll) {
      console.log('[DIAGNOSIS] Running database checks...');
      await diagnoseDatabase(findings, effectiveFiles, filesAnalyzed);
    }

    if (params.target === 'security' || runAll) {
      console.log('[DIAGNOSIS] Running security checks...');
      await diagnoseSecurity(findings, effectiveFiles, filesAnalyzed);
    }
    
    console.log(`[DIAGNOSIS] Completed checks: ${filesAnalyzed.size} files analyzed, ${findings.length} findings`);

    // Calculate metrics
    for (const file of Array.from(filesAnalyzed)) {
      try {
        const absolutePath = path.resolve(process.cwd(), file);
        const content = await fs.readFile(absolutePath, 'utf-8');
        totalLines += content.split('\n').length;
      } catch (e) {
        // File might not exist, skip
      }
    }

    const recommendations = generateRecommendations(findings);

    return {
      success: true,
      summary: `Analyzed ${filesAnalyzed.size} files, found ${findings.length} issues (${findings.filter(f => f.severity === 'critical').length} critical, ${findings.filter(f => f.severity === 'warning').length} warnings)`,
      findings,
      recommendations,
      metrics: {
        filesAnalyzed: filesAnalyzed.size,
        totalLines,
        issuesFound: findings.length,
      },
    };
  } catch (error: any) {
    console.error('❌ Diagnosis failed:', error);
    return {
      success: false,
      summary: 'Diagnosis failed',
      findings: [],
      recommendations: [],
      error: error.message || 'Unknown error during diagnosis',
    };
  }
}

/**
 * Performance Diagnosis
 */
async function diagnosePerformance(
  findings: DiagnosisFinding[],
  files: string[],
  analyzed: Set<string>
): Promise<void> {
  for (const file of files) {
    try {
      analyzed.add(file);

      // SECURITY FIX: Use safe countLines instead of execAsync with wc
      const lines = await countLines(file);

      if (lines > 3000) {
        findings.push({
          severity: 'critical',
          category: 'Code Organization',
          issue: `File is ${lines} lines - should be split into smaller modules`,
          evidence: `File has ${lines} lines`,
          location: file,
        });
      } else if (lines > 1500) {
        findings.push({
          severity: 'warning',
          category: 'Code Organization',
          issue: `File is ${lines} lines - consider refactoring`,
          evidence: `File has ${lines} lines`,
          location: file,
        });
      }

      // Read file content for pattern analysis
      const absolutePath = path.resolve(process.cwd(), file);
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Check for synchronous blocking operations
      const syncOpsCount = countMatches(content, /fs\.readFileSync|fs\.writeFileSync|execSync/g);
      if (syncOpsCount > 0) {
        findings.push({
          severity: 'warning',
          category: 'Blocking Operations',
          issue: `Found ${syncOpsCount} synchronous file/exec operations that could block the event loop`,
          evidence: `Found ${syncOpsCount} sync operations in file`,
          location: file,
        });
      }

      // Check for N+1 query patterns (multiple DB calls in loops)
      const loopDbPattern = /(for|while|forEach|map)\s*\([^)]*\)[^{]*{[^}]*await\s+(storage\.|db\.)/g;
      const n1Issues = content.match(loopDbPattern);
      if (n1Issues && n1Issues.length > 0) {
        findings.push({
          severity: 'critical',
          category: 'Database N+1',
          issue: `Found ${n1Issues.length} potential N+1 query patterns (DB calls inside loops)`,
          evidence: `Detected await storage/db calls inside loops`,
          location: file,
        });
      }

      // Check for missing caching
      if (file.includes('routes.ts')) {
        const dbCallsCount = countMatches(content, /await\s+storage\./g);
        const hasCaching = content.includes('cache') || content.includes('Cache');
        
        if (dbCallsCount > 50 && !hasCaching) {
          findings.push({
            severity: 'warning',
            category: 'Caching',
            issue: `${dbCallsCount} database calls found but no caching detected`,
            evidence: `Found ${dbCallsCount} database calls with no caching`,
            location: file,
          });
        }
      }

      // Check system prompt size
      if (file.includes('routes.ts') || file.includes('anthropic.ts')) {
        const promptMatches = content.match(/const\s+\w*[Pp]rompt\w*\s*=\s*`[\s\S]*?`/g) || [];
        for (const prompt of promptMatches) {
          const size = prompt.length;
          if (size > 10000) {
            findings.push({
              severity: 'warning',
              category: 'Performance',
              issue: `Large prompt detected (${(size / 1024).toFixed(2)}KB) - consider caching`,
              evidence: `Prompt size: ${size} characters`,
              location: file,
            });
          }
        }
      }

    } catch (error: any) {
      // File doesn't exist or can't be read, skip
      if (error.code !== 'ENOENT') {
        console.warn(`Warning analyzing ${file}:`, error.message);
      }
    }
  }
}

/**
 * Memory Diagnosis
 */
async function diagnoseMemory(
  findings: DiagnosisFinding[],
  files: string[],
  analyzed: Set<string>
): Promise<void> {
  for (const file of files) {
    try {
      analyzed.add(file);
      const absolutePath = path.resolve(process.cwd(), file);
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Check for Maps without cleanup
      if (content.includes('new Map') || content.includes('new WeakMap')) {
        const hasCleanup = content.includes('.delete(') || content.includes('.clear()');
        if (!hasCleanup) {
          findings.push({
            severity: 'critical',
            category: 'Memory Leak',
            issue: 'Map/WeakMap created but no cleanup (.delete or .clear) found',
            evidence: 'Map instances without cleanup can cause memory leaks',
            location: file,
          });
        }
      }

      // Check WebSocket cleanup
      if (content.includes('WebSocket') || content.includes('ws.on')) {
        const hasErrorHandler = content.includes('ws.on("error"') || content.includes("ws.on('error'");
        const hasCloseHandler = content.includes('ws.on("close"') || content.includes("ws.on('close'");
        
        if (!hasErrorHandler) {
          findings.push({
            severity: 'critical',
            category: 'Memory Leak',
            issue: 'WebSocket connections without error handler - can leak memory',
            evidence: 'No ws.on("error") handler found',
            location: file,
          });
        }
        
        if (!hasCloseHandler) {
          findings.push({
            severity: 'warning',
            category: 'Connection Management',
            issue: 'WebSocket without close handler - connections may not be cleaned up',
            evidence: 'No ws.on("close") handler found',
            location: file,
          });
        }
      }

      // Check for event listeners without cleanup
      const addListenerCount = (content.match(/\.addEventListener\(/g) || []).length;
      const removeListenerCount = (content.match(/\.removeEventListener\(/g) || []).length;
      
      if (addListenerCount > removeListenerCount && addListenerCount > 2) {
        findings.push({
          severity: 'warning',
          category: 'Memory Leak',
          issue: `${addListenerCount} event listeners added but only ${removeListenerCount} removed`,
          evidence: `Potential memory leak from event listeners`,
          location: file,
        });
      }

      // Check for large in-memory caches
      const cacheDeclarations = content.match(/const\s+\w*[Cc]ache\w*\s*=\s*new\s+Map/g) || [];
      if (cacheDeclarations.length > 0) {
        const hasSizeLimit = content.includes('maxSize') || content.includes('max_size') || content.includes('MAX_SIZE');
        if (!hasSizeLimit) {
          findings.push({
            severity: 'warning',
            category: 'Memory Management',
            issue: `${cacheDeclarations.length} cache(s) without size limits - can grow unbounded`,
            evidence: 'Cache declarations found without maxSize configuration',
            location: file,
          });
        }
      }

    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Warning analyzing ${file}:`, error.message);
      }
    }
  }
}

/**
 * Database Diagnosis
 */
async function diagnoseDatabase(
  findings: DiagnosisFinding[],
  files: string[],
  analyzed: Set<string>
): Promise<void> {
  for (const file of files) {
    try {
      analyzed.add(file);
      const absolutePath = path.resolve(process.cwd(), file);
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Count database queries
      const queryCount = countMatches(content, /await\s+(storage\.|db\.)/g);
      
      if (queryCount > 100) {
        findings.push({
          severity: 'warning',
          category: 'Database Performance',
          issue: `${queryCount} database calls in single file - consider caching or batching`,
          evidence: `Found ${queryCount} database calls in file`,
          location: file,
        });
      }

      // Check for missing error handling on DB calls
      const dbCallsWithoutTryCatch = content.match(/await\s+storage\.[^;]+;(?!\s*}\s*catch)/g) || [];
      if (dbCallsWithoutTryCatch.length > 5) {
        findings.push({
          severity: 'warning',
          category: 'Error Handling',
          issue: `${dbCallsWithoutTryCatch.length} database calls without try/catch`,
          evidence: 'DB operations should be wrapped in error handling',
          location: file,
        });
      }

      // Check for missing indexes
      if (file.includes('schema.ts')) {
        const hasIndexes = content.includes('index(') || content.includes('.index');
        const tableCount = (content.match(/export const \w+ = \w+Table/g) || []).length;
        
        if (tableCount > 3 && !hasIndexes) {
          findings.push({
            severity: 'warning',
            category: 'Database Performance',
            issue: `${tableCount} tables defined but no indexes found`,
            evidence: 'Missing database indexes can severely impact query performance',
            location: file,
          });
        }
      }

    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Warning analyzing ${file}:`, error.message);
      }
    }
  }
}

/**
 * Security Diagnosis
 */
async function diagnoseSecurity(
  findings: DiagnosisFinding[],
  files: string[],
  analyzed: Set<string>
): Promise<void> {
  for (const file of files) {
    try {
      analyzed.add(file);
      const absolutePath = path.resolve(process.cwd(), file);
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Check for hardcoded secrets
      const secretPatterns = [
        /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,
        /secret\s*=\s*['"][^'"]+['"]/gi,
        /password\s*=\s*['"][^'"]+['"]/gi,
        /token\s*=\s*['"][^'"]+['"]/gi,
      ];

      for (const pattern of secretPatterns) {
        const matches = content.match(pattern) || [];
        // Filter out env variable references
        const hardcoded = matches.filter(m => !m.includes('process.env') && !m.includes('import.meta.env'));
        if (hardcoded.length > 0) {
          findings.push({
            severity: 'critical',
            category: 'Security',
            issue: `${hardcoded.length} potential hardcoded secrets found`,
            evidence: 'Secrets should be in environment variables',
            location: file,
          });
        }
      }

      // Check for SQL injection risks
      const sqlConcatCount = (content.match(/\+\s*['"`][^'"`]*SELECT|WHERE|FROM[^'"`]*['"`]\s*\+/gi) || []).length;
      if (sqlConcatCount > 0) {
        findings.push({
          severity: 'critical',
          category: 'Security',
          issue: `${sqlConcatCount} potential SQL injection vulnerabilities (string concatenation)`,
          evidence: 'Use parameterized queries instead of string concatenation',
          location: file,
        });
      }

      // Check for missing input validation
      if (file.includes('routes.ts')) {
        const routeCount = (content.match(/\.(get|post|put|patch|delete)\(/gi) || []).length;
        const validationCount = (content.match(/\.parse\(|\.safeParse\(|validate\(/gi) || []).length;
        
        if (routeCount > validationCount * 1.5) {
          findings.push({
            severity: 'warning',
            category: 'Security',
            issue: `${routeCount} routes but only ${validationCount} validations - missing input validation`,
            evidence: 'All user inputs should be validated',
            location: file,
          });
        }
      }

    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Warning analyzing ${file}:`, error.message);
      }
    }
  }
}

/**
 * Generate recommendations based on findings
 */
function generateRecommendations(findings: DiagnosisFinding[]): string[] {
  const recommendations: string[] = [];
  const categories = new Set(findings.map(f => f.category));

  if (categories.has('Code Organization')) {
    recommendations.push('Split large files into smaller modules (< 500 lines each)');
    recommendations.push('Extract reusable logic into separate utility files');
  }

  if (categories.has('Memory Leak')) {
    recommendations.push('Add cleanup handlers for WebSockets (ws.on("error") and ws.on("close"))');
    recommendations.push('Implement .delete() or .clear() for Map instances when items are no longer needed');
    recommendations.push('Remove event listeners in cleanup functions');
  }

  if (categories.has('Database Performance') || categories.has('Database N+1')) {
    recommendations.push('Implement caching layer for frequently accessed data');
    recommendations.push('Use batch queries instead of loops with individual queries');
    recommendations.push('Add database indexes for commonly queried fields');
  }

  if (categories.has('Caching')) {
    recommendations.push('Add Redis or in-memory cache for expensive operations');
    recommendations.push('Cache system prompts and user sessions');
  }

  if (categories.has('Security')) {
    recommendations.push('Move all secrets to environment variables');
    recommendations.push('Use parameterized queries to prevent SQL injection');
    recommendations.push('Add input validation using Zod schemas for all API routes');
  }

  if (categories.has('Performance')) {
    recommendations.push('Cache large prompts at module level instead of rebuilding on each request');
    recommendations.push('Use async operations instead of sync (readFileSync → readFile)');
  }

  if (categories.has('Connection Management')) {
    recommendations.push('Implement connection pooling with proper limits');
    recommendations.push('Add timeout handling for long-running operations');
  }

  // Add general best practices if we found critical issues
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  if (criticalCount > 3) {
    recommendations.push('PRIORITY: Address critical issues first - they can cause production outages');
    recommendations.push('Run diagnosis tool regularly during development');
  }

  return recommendations;
}
