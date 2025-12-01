/**
 * Gap #8: Performance Profiling & Optimization Tool
 * Bundle size analysis, test coverage, build speed metrics
 * Callable by Scout agent to identify optimization opportunities
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'good' | 'warning' | 'critical';
}

export interface PerformanceAnalysisResult {
  success: boolean;
  timestamp: string;
  metrics: PerformanceMetric[];
  summary: {
    buildTimeMs: number;
    bundleSizeBytes: number;
    testCoveragePercent: number;
    codeComplexity: string;
  };
  recommendations: string[];
  analyzeDuration: number;
}

function runCommand(command: string): { output: string; success: boolean } {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { output, success: true };
  } catch (error: any) {
    return { output: error.stdout || '', success: false };
  }
}

function analyzeBundle(): PerformanceMetric[] {
  const metrics: PerformanceMetric[] = [];
  
  try {
    const buildDir = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(buildDir)) {
      return [{
        name: 'Bundle Size',
        value: 0,
        unit: 'bytes',
        status: 'warning',
      }];
    }
    
    let totalSize = 0;
    const walkDir = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          totalSize += stat.size;
        }
      }
    };
    
    walkDir(buildDir);
    
    const status = totalSize > 500000 ? 'warning' : totalSize > 1000000 ? 'critical' : 'good';
    metrics.push({
      name: 'Bundle Size',
      value: totalSize,
      unit: 'bytes',
      threshold: 500000,
      status,
    });
    
    const jsFiles = fs.readdirSync(buildDir)
      .filter(f => f.endsWith('.js'))
      .map(f => ({
        name: f,
        size: fs.statSync(path.join(buildDir, f)).size,
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 3);
    
    jsFiles.forEach(file => {
      metrics.push({
        name: `Largest JS: ${file.name}`,
        value: file.size,
        unit: 'bytes',
        status: file.size > 200000 ? 'warning' : 'good',
      });
    });
  } catch (error) {
    console.warn('[PERF] Bundle analysis failed');
  }
  
  return metrics;
}

function analyzeBuildSpeed(): PerformanceMetric {
  try {
    const startTime = Date.now();
    const result = runCommand('npm run build 2>&1 || true');
    const duration = Date.now() - startTime;
    
    const status = duration > 30000 ? 'warning' : duration > 60000 ? 'critical' : 'good';
    
    return {
      name: 'Build Time',
      value: duration,
      unit: 'ms',
      threshold: 30000,
      status,
    };
  } catch (error) {
    return {
      name: 'Build Time',
      value: 0,
      unit: 'ms',
      status: 'warning',
    };
  }
}

function analyzeTestCoverage(): PerformanceMetric {
  try {
    const result = runCommand('npm test -- --coverage --reporter=json 2>&1 || true');
    
    let coverage = 0;
    try {
      const match = result.output.match(/"statements":\s*{\s*"pct":\s*([\d.]+)/);
      if (match) {
        coverage = parseFloat(match[1]);
      }
    } catch {
      const match = result.output.match(/Statements\s*:\s*([\d.]+)%/);
      if (match) {
        coverage = parseFloat(match[1]);
      }
    }
    
    const status = coverage < 50 ? 'critical' : coverage < 75 ? 'warning' : 'good';
    
    return {
      name: 'Test Coverage',
      value: coverage,
      unit: 'percent',
      threshold: 75,
      status,
    };
  } catch (error) {
    return {
      name: 'Test Coverage',
      value: 0,
      unit: 'percent',
      status: 'warning',
    };
  }
}

function analyzeCodeComplexity(): { metric: PerformanceMetric; complexity: string } {
  try {
    const srcDirs = ['client/src', 'server', 'shared'];
    let fileCount = 0;
    let lineCount = 0;
    
    for (const dir of srcDirs) {
      const fullDir = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullDir)) continue;
      
      const walkDir = (d: string) => {
        try {
          const items = fs.readdirSync(d);
          for (const item of items) {
            if (item.startsWith('.') || item === 'node_modules') continue;
            const fullPath = path.join(d, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
              walkDir(fullPath);
            } else if (['.ts', '.tsx', '.js', '.jsx'].some(ext => item.endsWith(ext))) {
              fileCount++;
              const content = fs.readFileSync(fullPath, 'utf-8');
              lineCount += content.split('\n').length;
            }
          }
        } catch {
          // ignore
        }
      };
      
      walkDir(fullDir);
    }
    
    const avgLinesPerFile = fileCount > 0 ? Math.round(lineCount / fileCount) : 0;
    let complexity = 'Low';
    let status: 'good' | 'warning' | 'critical' = 'good';
    
    if (avgLinesPerFile > 400) {
      complexity = 'High';
      status = 'warning';
    } else if (avgLinesPerFile > 300) {
      complexity = 'Moderate';
      status = 'good';
    }
    
    return {
      metric: {
        name: 'Code Complexity',
        value: avgLinesPerFile,
        unit: 'avg lines/file',
        threshold: 300,
        status,
      },
      complexity,
    };
  } catch (error) {
    return {
      metric: {
        name: 'Code Complexity',
        value: 0,
        unit: 'avg lines/file',
        status: 'warning',
      },
      complexity: 'Unknown',
    };
  }
}

function generateRecommendations(metrics: PerformanceMetric[], complexity: string): string[] {
  const recommendations: string[] = [];
  
  const bundleMetric = metrics.find(m => m.name === 'Bundle Size');
  if (bundleMetric && bundleMetric.status === 'critical') {
    recommendations.push('🚨 Bundle size is over 1MB - consider code splitting or removing unused dependencies');
  } else if (bundleMetric && bundleMetric.status === 'warning') {
    recommendations.push('⚠️ Bundle size exceeds 500KB - implement dynamic imports for routes');
  }
  
  const buildTimeMetric = metrics.find(m => m.name === 'Build Time');
  if (buildTimeMetric && buildTimeMetric.status === 'critical') {
    recommendations.push('🐢 Build time exceeds 60 seconds - enable esbuild minification or incremental builds');
  } else if (buildTimeMetric && buildTimeMetric.status === 'warning') {
    recommendations.push('⚠️ Build time over 30 seconds - profile with buildtime-webpack or rollup-plugin-analyzer');
  }
  
  const coverageMetric = metrics.find(m => m.name === 'Test Coverage');
  if (coverageMetric && coverageMetric.status === 'critical') {
    recommendations.push('❌ Test coverage below 50% - write tests for critical paths');
  } else if (coverageMetric && coverageMetric.status === 'warning') {
    recommendations.push('📝 Test coverage below 75% - target 80%+ for production readiness');
  }
  
  if (complexity === 'High') {
    recommendations.push('📦 High code complexity - break large files into smaller modules (target 200-300 lines max)');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Performance looks good! Continue monitoring metrics.');
  }
  
  return recommendations;
}

export async function analyzePerformance(input: {
  includeBuild?: boolean;
  verbose?: boolean;
}): Promise<PerformanceAnalysisResult> {
  const startTime = Date.now();
  
  console.log('[PERF] Starting performance analysis...');
  
  const metrics: PerformanceMetric[] = [];
  
  metrics.push(...analyzeBundle());
  
  if (input.includeBuild !== false) {
    metrics.push(analyzeBuildSpeed());
  }
  
  const coverageMetric = analyzeTestCoverage();
  metrics.push(coverageMetric);
  
  const { metric: complexityMetric, complexity } = analyzeCodeComplexity();
  metrics.push(complexityMetric);
  
  const bundleSize = metrics.find(m => m.name === 'Bundle Size')?.value || 0;
  const buildTime = metrics.find(m => m.name === 'Build Time')?.value || 0;
  const coverage = metrics.find(m => m.name === 'Test Coverage')?.value || 0;
  
  const summary = {
    buildTimeMs: buildTime,
    bundleSizeBytes: bundleSize,
    testCoveragePercent: coverage,
    codeComplexity: complexity,
  };
  
  const recommendations = generateRecommendations(metrics, complexity);
  const duration = Date.now() - startTime;
  
  console.log(`[PERF] Completed in ${duration}ms`);
  console.log(`[PERF] Bundle: ${bundleSize} bytes, Build: ${buildTime}ms, Coverage: ${coverage}%`);
  
  return {
    success: true,
    timestamp: new Date().toISOString(),
    metrics,
    summary,
    recommendations,
    analyzeDuration: duration,
  };
}

export const PERFORMANCE_ANALYSIS_TOOL = {
  name: 'analyze_performance',
  description: 'Analyze application performance including bundle size, build time, test coverage, and code complexity. Provides optimization recommendations.',
  input_schema: {
    type: 'object',
    properties: {
      includeBuild: {
        type: 'boolean',
        description: 'Run build process to measure build time (may take time, default: false)',
      },
      verbose: {
        type: 'boolean',
        description: 'Include detailed performance breakdown',
      },
    },
  },
};
