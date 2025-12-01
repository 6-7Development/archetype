/**
 * Gap #5: Enhanced Code Health Monitoring Tool
 * LSP error detection, test failure detection, import validation
 * Callable by Scout agent for proactive issue detection
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportIssue {
  file: string;
  line: number;
  importPath: string;
  reason: string;
}

export interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  failedTests: string[];
}

export interface CodeHealthResult {
  success: boolean;
  timestamp: string;
  typeErrors: TypeScriptError[];
  importIssues: ImportIssue[];
  testResults: TestResult | null;
  buildable: boolean;
  summary: {
    typeErrorCount: number;
    warningCount: number;
    importIssueCount: number;
    testsPassed: boolean;
    overallHealthy: boolean;
  };
  recommendations: string[];
  scanDuration: number;
}

function runCommand(command: string, silent = true): { stdout: string; success: boolean } {
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      timeout: 120000,
      stdio: silent ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    });
    return { stdout, success: true };
  } catch (error: any) {
    return { 
      stdout: error.stdout || error.message || '', 
      success: false 
    };
  }
}

function checkTypeScript(): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  
  try {
    const { stdout } = runCommand('npx tsc --noEmit --pretty false 2>&1 || true');
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/);
      if (match) {
        errors.push({
          file: match[1].replace(process.cwd() + '/', ''),
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          severity: match[4] as 'error' | 'warning',
          code: match[5],
          message: match[6],
        });
      }
    }
  } catch (error) {
    console.warn('[CODE-HEALTH] TypeScript check failed');
  }
  
  return errors;
}

function checkImports(): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const srcDirs = ['client/src', 'server', 'shared'];
  
  for (const dir of srcDirs) {
    const fullDir = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullDir)) continue;
    
    try {
      const files = findFiles(fullDir, ['.ts', '.tsx', '.js', '.jsx']);
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const importMatch = line.match(/(?:import|from)\s+['"]([^'"]+)['"]/);
          
          if (importMatch) {
            const importPath = importMatch[1];
            
            if (importPath.startsWith('.')) {
              const resolved = resolveRelativeImport(file, importPath);
              if (resolved === null) {
                issues.push({
                  file: file.replace(process.cwd() + '/', ''),
                  line: i + 1,
                  importPath,
                  reason: 'File not found',
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[CODE-HEALTH] Import check failed for ${dir}`);
    }
  }
  
  return issues;
}

function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === 'node_modules' || item.startsWith('.')) continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...findFiles(fullPath, extensions));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory not accessible
  }
  
  return files;
}

function resolveRelativeImport(fromFile: string, importPath: string): string | null {
  const dir = path.dirname(fromFile);
  
  const resolved = path.join(dir, importPath);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
    for (const idx of indexFiles) {
      const indexPath = path.join(resolved, idx);
      if (fs.existsSync(indexPath)) return indexPath;
    }
  }
  
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }
  
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    const withExt = path.join(dir, importPath + ext);
    if (fs.existsSync(withExt)) return withExt;
  }
  
  return null;
}

function runTests(): TestResult | null {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    
    if (!pkg.scripts?.test) return null;
    
    const { stdout, success } = runCommand('npm test -- --reporter=json 2>&1 || true');
    
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"numPassedTests"[\s\S]*\}/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        return {
          suite: 'vitest',
          passed: results.numPassedTests || 0,
          failed: results.numFailedTests || 0,
          skipped: results.numPendingTests || 0,
          failedTests: results.testResults
            ?.filter((t: any) => t.status === 'failed')
            ?.map((t: any) => t.name) || [],
        };
      }
    } catch {
      const passedMatch = stdout.match(/(\d+)\s+pass/i);
      const failedMatch = stdout.match(/(\d+)\s+fail/i);
      
      if (passedMatch || failedMatch) {
        return {
          suite: 'test',
          passed: passedMatch ? parseInt(passedMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0,
          skipped: 0,
          failedTests: [],
        };
      }
    }
    
    return null;
  } catch (error) {
    console.warn('[CODE-HEALTH] Test run failed');
    return null;
  }
}

function checkBuildable(): boolean {
  try {
    const { success } = runCommand('npx tsc --noEmit');
    return success;
  } catch {
    return false;
  }
}

function generateRecommendations(
  typeErrors: TypeScriptError[],
  importIssues: ImportIssue[],
  testResults: TestResult | null
): string[] {
  const recommendations: string[] = [];
  
  if (typeErrors.length > 0) {
    const errorCount = typeErrors.filter(e => e.severity === 'error').length;
    const warningCount = typeErrors.filter(e => e.severity === 'warning').length;
    
    if (errorCount > 0) {
      recommendations.push(`🔴 ${errorCount} TypeScript errors must be fixed before deployment`);
      
      const byFile = new Map<string, TypeScriptError[]>();
      typeErrors.filter(e => e.severity === 'error').forEach(e => {
        const list = byFile.get(e.file) || [];
        list.push(e);
        byFile.set(e.file, list);
      });
      
      const topFiles = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
      topFiles.forEach(([file, errs]) => {
        recommendations.push(`   - ${file}: ${errs.length} errors`);
      });
    }
    
    if (warningCount > 0) {
      recommendations.push(`⚠️ ${warningCount} TypeScript warnings should be reviewed`);
    }
  }
  
  if (importIssues.length > 0) {
    recommendations.push(`📦 ${importIssues.length} broken imports detected`);
    importIssues.slice(0, 3).forEach(issue => {
      recommendations.push(`   - ${issue.file}:${issue.line}: ${issue.importPath}`);
    });
  }
  
  if (testResults) {
    if (testResults.failed > 0) {
      recommendations.push(`🧪 ${testResults.failed} tests failing - fix before deployment`);
      testResults.failedTests.slice(0, 3).forEach(test => {
        recommendations.push(`   - ${test}`);
      });
    } else if (testResults.passed > 0) {
      recommendations.push(`✅ All ${testResults.passed} tests passing`);
    }
  }
  
  if (typeErrors.length === 0 && importIssues.length === 0 && (!testResults || testResults.failed === 0)) {
    recommendations.push('✨ Code health is excellent! No issues detected.');
  }
  
  return recommendations;
}

export async function checkCodeHealth(input: {
  skipTests?: boolean;
  verbose?: boolean;
}): Promise<CodeHealthResult> {
  const startTime = Date.now();
  
  console.log('[CODE-HEALTH] Starting code health check...');
  
  const typeErrors = checkTypeScript();
  const importIssues = checkImports();
  const testResults = input.skipTests ? null : runTests();
  const buildable = checkBuildable();
  
  const errorCount = typeErrors.filter(e => e.severity === 'error').length;
  const warningCount = typeErrors.filter(e => e.severity === 'warning').length;
  const testsPassed = !testResults || testResults.failed === 0;
  
  const summary = {
    typeErrorCount: errorCount,
    warningCount,
    importIssueCount: importIssues.length,
    testsPassed,
    overallHealthy: errorCount === 0 && importIssues.length === 0 && testsPassed,
  };
  
  const recommendations = generateRecommendations(typeErrors, importIssues, testResults);
  
  const duration = Date.now() - startTime;
  
  console.log(`[CODE-HEALTH] Completed in ${duration}ms`);
  console.log(`[CODE-HEALTH] ${errorCount} errors, ${warningCount} warnings, ${importIssues.length} import issues`);
  
  return {
    success: true,
    timestamp: new Date().toISOString(),
    typeErrors,
    importIssues,
    testResults,
    buildable,
    summary,
    recommendations,
    scanDuration: duration,
  };
}

export const CODE_HEALTH_TOOL = {
  name: 'check_code_health',
  description: 'Perform a comprehensive code health check including TypeScript errors, broken imports, and test status. Use this to proactively identify issues before they cause problems.',
  input_schema: {
    type: 'object',
    properties: {
      skipTests: {
        type: 'boolean',
        description: 'Skip running tests (faster check)',
      },
      verbose: {
        type: 'boolean',
        description: 'Include detailed error information',
      },
    },
    required: [],
  },
};
