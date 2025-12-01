/**
 * Gap #7: Dependency Intelligence Tool
 * npm audit integration, CVE scoring, safe upgrade paths
 * Callable by Scout agent to identify vulnerable dependencies
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface Vulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url?: string;
  cwe?: string[];
  range: string;
  fixAvailable: boolean;
  recommendation?: string;
}

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'dependencies' | 'devDependencies';
  isBreaking: boolean;
}

export interface DependencyAuditResult {
  success: boolean;
  vulnerabilities: Vulnerability[];
  outdatedPackages: OutdatedPackage[];
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    total: number;
    outdatedCount: number;
    fixableCount: number;
  };
  recommendations: string[];
  auditDuration: number;
}

function runCommand(command: string): { output: string; success: boolean; error?: string } {
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      cwd: process.cwd(),
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { output, success: true };
  } catch (error: any) {
    const output = error.stdout || error.stderr || '';
    return { 
      output, 
      success: false, 
      error: error.message || 'Command failed'
    };
  }
}

function parseNpmAudit(): { vulnerabilities: Vulnerability[]; error?: string } {
  const vulnerabilities: Vulnerability[] = [];
  
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { vulnerabilities: [], error: 'No package.json found' };
  }
  
  try {
    const result = runCommand('npm audit --json 2>/dev/null || true');
    
    if (!result.success && !result.output) {
      return { vulnerabilities: [], error: 'npm audit command failed' };
    }
    
    const audit = JSON.parse(result.output || '{}');
    
    if (audit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
        const v = vuln as any;
        vulnerabilities.push({
          name,
          severity: v.severity || 'moderate',
          title: v.via?.[0]?.title || v.via?.[0] || 'Unknown vulnerability',
          url: v.via?.[0]?.url,
          cwe: v.via?.[0]?.cwe ? [v.via[0].cwe] : [],
          range: v.range || '*',
          fixAvailable: !!v.fixAvailable,
          recommendation: v.fixAvailable ? `Run: npm audit fix` : 'Manual review required',
        });
      }
    }
    
    return { vulnerabilities };
  } catch (error: any) {
    console.warn('[DEP-AUDIT] npm audit parse failed:', error.message);
    return { vulnerabilities: [], error: `Parse error: ${error.message}` };
  }
}

function parseNpmOutdated(): { packages: OutdatedPackage[]; error?: string } {
  const outdated: OutdatedPackage[] = [];
  
  try {
    const result = runCommand('npm outdated --json 2>/dev/null || echo "{}"');
    const packages = JSON.parse(result.output || '{}');
    
    for (const [name, info] of Object.entries(packages)) {
      const p = info as any;
      const current = p.current || '0.0.0';
      const latest = p.latest || current;
      const wanted = p.wanted || current;
      
      const currentMajor = parseInt(current.split('.')[0]) || 0;
      const latestMajor = parseInt(latest.split('.')[0]) || 0;
      const isBreaking = latestMajor > currentMajor;
      
      outdated.push({
        name,
        current,
        wanted,
        latest,
        type: p.type || 'dependencies',
        isBreaking,
      });
    }
    
    return { packages: outdated };
  } catch (error: any) {
    console.warn('[DEP-AUDIT] npm outdated parse failed:', error.message);
    return { packages: [], error: `Parse error: ${error.message}` };
  }
}

function checkPackageJson(): { dependencies: number; devDependencies: number } {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return {
      dependencies: Object.keys(pkg.dependencies || {}).length,
      devDependencies: Object.keys(pkg.devDependencies || {}).length,
    };
  } catch {
    return { dependencies: 0, devDependencies: 0 };
  }
}

function generateRecommendations(
  vulnerabilities: Vulnerability[],
  outdated: OutdatedPackage[]
): string[] {
  const recommendations: string[] = [];
  
  const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
  const highVulns = vulnerabilities.filter(v => v.severity === 'high');
  const fixableVulns = vulnerabilities.filter(v => v.fixAvailable);
  const breakingUpdates = outdated.filter(p => p.isBreaking);
  const safeUpdates = outdated.filter(p => !p.isBreaking && p.wanted !== p.current);
  
  if (criticalVulns.length > 0) {
    recommendations.push(`🚨 CRITICAL: ${criticalVulns.length} critical vulnerabilities require immediate attention`);
    criticalVulns.slice(0, 3).forEach(v => {
      recommendations.push(`   - ${v.name}: ${v.title}`);
    });
  }
  
  if (highVulns.length > 0) {
    recommendations.push(`⚠️ HIGH: ${highVulns.length} high severity vulnerabilities found`);
  }
  
  if (fixableVulns.length > 0) {
    recommendations.push(`✅ AUTO-FIX: Run 'npm audit fix' to automatically fix ${fixableVulns.length} vulnerabilities`);
  }
  
  if (safeUpdates.length > 0) {
    recommendations.push(`📦 SAFE UPDATES: ${safeUpdates.length} packages can be updated without breaking changes`);
    recommendations.push(`   Run: npm update`);
  }
  
  if (breakingUpdates.length > 0) {
    recommendations.push(`⬆️ MAJOR UPDATES: ${breakingUpdates.length} packages have new major versions available`);
    breakingUpdates.slice(0, 5).forEach(p => {
      recommendations.push(`   - ${p.name}: ${p.current} → ${p.latest} (breaking)`);
    });
  }
  
  if (vulnerabilities.length === 0 && outdated.length === 0) {
    recommendations.push('✨ All dependencies are up-to-date and secure!');
  }
  
  return recommendations;
}

export async function auditDependencies(input: { 
  checkOutdated?: boolean;
  verbose?: boolean;
}): Promise<DependencyAuditResult> {
  const startTime = Date.now();
  
  console.log('[DEP-AUDIT] Starting dependency audit...');
  
  const packageInfo = checkPackageJson();
  console.log(`[DEP-AUDIT] Found ${packageInfo.dependencies} deps, ${packageInfo.devDependencies} devDeps`);
  
  const auditResult = parseNpmAudit();
  const vulnerabilities = auditResult.vulnerabilities;
  
  const outdatedResult = input.checkOutdated !== false ? parseNpmOutdated() : { packages: [] };
  const outdatedPackages = outdatedResult.packages;
  
  const errors: string[] = [];
  if (auditResult.error) errors.push(auditResult.error);
  if (outdatedResult.error) errors.push(outdatedResult.error);
  
  const summary = {
    critical: vulnerabilities.filter(v => v.severity === 'critical').length,
    high: vulnerabilities.filter(v => v.severity === 'high').length,
    moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
    low: vulnerabilities.filter(v => v.severity === 'low').length,
    total: vulnerabilities.length,
    outdatedCount: outdatedPackages.length,
    fixableCount: vulnerabilities.filter(v => v.fixAvailable).length,
  };
  
  const recommendations = generateRecommendations(vulnerabilities, outdatedPackages);
  if (errors.length > 0) {
    recommendations.unshift(`⚠️ WARNINGS: ${errors.join('; ')}`);
  }
  
  const duration = Date.now() - startTime;
  
  console.log(`[DEP-AUDIT] Completed in ${duration}ms`);
  console.log(`[DEP-AUDIT] Found ${summary.total} vulnerabilities, ${summary.outdatedCount} outdated packages`);
  
  return {
    success: errors.length === 0 || vulnerabilities.length > 0 || outdatedPackages.length > 0,
    vulnerabilities,
    outdatedPackages,
    summary,
    recommendations,
    auditDuration: duration,
  };
}

export const DEPENDENCY_AUDIT_TOOL = {
  name: 'dependency_audit',
  description: 'Audit project dependencies for security vulnerabilities (CVEs) and outdated packages. Uses npm audit to identify issues and provides recommendations for fixes.',
  input_schema: {
    type: 'object',
    properties: {
      checkOutdated: {
        type: 'boolean',
        description: 'Also check for outdated packages (default: true)',
      },
      verbose: {
        type: 'boolean',
        description: 'Include detailed vulnerability information',
      },
    },
    required: [],
  },
};
