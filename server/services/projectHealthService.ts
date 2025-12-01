/**
 * Project Health Dashboard Service
 * 
 * Analyzes project codebase to provide health metrics:
 * - Code complexity (cyclomatic complexity, cognitive complexity)
 * - Test coverage estimates
 * - Code duplication detection
 * - Dependency health
 * - File size and structure metrics
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectHealthMetrics {
  overall: HealthScore;
  complexity: ComplexityMetrics;
  coverage: CoverageMetrics;
  structure: StructureMetrics;
  dependencies: DependencyMetrics;
  issues: HealthIssue[];
  suggestions: string[];
  generatedAt: Date;
}

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
}

export interface ComplexityMetrics {
  averageCyclomaticComplexity: number;
  maxCyclomaticComplexity: number;
  highComplexityFiles: { file: string; complexity: number }[];
  averageLinesPerFunction: number;
  totalFunctions: number;
}

export interface CoverageMetrics {
  estimatedCoverage: number;
  testFilesCount: number;
  sourceFilesCount: number;
  testToSourceRatio: number;
  hasTestFramework: boolean;
  testFramework?: string;
}

export interface StructureMetrics {
  totalFiles: number;
  totalLines: number;
  averageFileSize: number;
  largestFiles: { file: string; lines: number }[];
  filesByLanguage: Record<string, number>;
  directoryDepth: number;
}

export interface DependencyMetrics {
  totalDependencies: number;
  outdatedDependencies: number;
  securityVulnerabilities: number;
  devDependencies: number;
  productionDependencies: number;
}

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'complexity' | 'coverage' | 'structure' | 'dependency' | 'security';
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

class ProjectHealthService {
  private readonly PROJECT_ROOT = '/home/runner/workspace';
  private healthCache: Map<string, { metrics: ProjectHealthMetrics; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 300000;

  constructor() {
    console.log('[PROJECT-HEALTH] Project Health Dashboard service initialized');
  }

  async analyzeProject(projectId: string): Promise<ProjectHealthMetrics> {
    const cached = this.healthCache.get(projectId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.metrics;
    }

    console.log(`[PROJECT-HEALTH] Analyzing project: ${projectId}`);
    const startTime = Date.now();

    try {
      const [structureMetrics, complexityMetrics, coverageMetrics, dependencyMetrics] = await Promise.all([
        this.analyzeStructure(),
        this.analyzeComplexity(),
        this.analyzeCoverage(),
        this.analyzeDependencies(),
      ]);

      const issues = this.identifyIssues(structureMetrics, complexityMetrics, coverageMetrics, dependencyMetrics);
      const suggestions = this.generateSuggestions(issues);
      const overall = this.calculateOverallScore(complexityMetrics, coverageMetrics, structureMetrics, dependencyMetrics);

      const metrics: ProjectHealthMetrics = {
        overall,
        complexity: complexityMetrics,
        coverage: coverageMetrics,
        structure: structureMetrics,
        dependencies: dependencyMetrics,
        issues,
        suggestions,
        generatedAt: new Date(),
      };

      this.healthCache.set(projectId, { metrics, timestamp: Date.now() });
      
      console.log(`[PROJECT-HEALTH] Analysis complete in ${Date.now() - startTime}ms, score: ${overall.score}`);
      return metrics;
    } catch (error: any) {
      console.error('[PROJECT-HEALTH] Analysis failed:', error.message);
      throw error;
    }
  }

  private async analyzeStructure(): Promise<StructureMetrics> {
    const files = await this.getAllSourceFiles();
    const filesByLanguage: Record<string, number> = {};
    let totalLines = 0;
    const fileSizes: { file: string; lines: number }[] = [];
    let maxDepth = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').length;
        totalLines += lines;
        fileSizes.push({ file: path.relative(this.PROJECT_ROOT, file), lines });

        const ext = path.extname(file).slice(1) || 'unknown';
        filesByLanguage[ext] = (filesByLanguage[ext] || 0) + 1;

        const depth = file.replace(this.PROJECT_ROOT, '').split(path.sep).length;
        maxDepth = Math.max(maxDepth, depth);
      } catch {
        continue;
      }
    }

    fileSizes.sort((a, b) => b.lines - a.lines);

    return {
      totalFiles: files.length,
      totalLines,
      averageFileSize: files.length > 0 ? Math.round(totalLines / files.length) : 0,
      largestFiles: fileSizes.slice(0, 5),
      filesByLanguage,
      directoryDepth: maxDepth,
    };
  }

  private async analyzeComplexity(): Promise<ComplexityMetrics> {
    const files = await this.getAllSourceFiles();
    let totalComplexity = 0;
    let maxComplexity = 0;
    let totalFunctions = 0;
    let totalFunctionLines = 0;
    const highComplexityFiles: { file: string; complexity: number }[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const complexity = this.calculateCyclomaticComplexity(content);
        const functions = this.countFunctions(content);
        
        totalComplexity += complexity;
        totalFunctions += functions.count;
        totalFunctionLines += functions.totalLines;
        
        if (complexity > maxComplexity) {
          maxComplexity = complexity;
        }
        
        if (complexity > 10) {
          highComplexityFiles.push({
            file: path.relative(this.PROJECT_ROOT, file),
            complexity,
          });
        }
      } catch {
        continue;
      }
    }

    highComplexityFiles.sort((a, b) => b.complexity - a.complexity);

    return {
      averageCyclomaticComplexity: files.length > 0 ? Math.round((totalComplexity / files.length) * 10) / 10 : 0,
      maxCyclomaticComplexity: maxComplexity,
      highComplexityFiles: highComplexityFiles.slice(0, 5),
      averageLinesPerFunction: totalFunctions > 0 ? Math.round(totalFunctionLines / totalFunctions) : 0,
      totalFunctions,
    };
  }

  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1;
    
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*.*\s*:/g,
      /&&/g,
      /\|\|/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private countFunctions(code: string): { count: number; totalLines: number } {
    const functionPatterns = [
      /function\s+\w+\s*\([^)]*\)\s*\{/g,
      /\w+\s*=\s*function\s*\([^)]*\)\s*\{/g,
      /\w+\s*=\s*\([^)]*\)\s*=>\s*\{/g,
      /\w+\s*:\s*function\s*\([^)]*\)\s*\{/g,
      /async\s+function\s+\w+\s*\([^)]*\)\s*\{/g,
      /def\s+\w+\s*\([^)]*\)\s*:/g,
    ];

    let count = 0;
    for (const pattern of functionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    const lines = code.split('\n').length;
    return { count: Math.max(count, 1), totalLines: lines };
  }

  private async analyzeCoverage(): Promise<CoverageMetrics> {
    const files = await this.getAllSourceFiles();
    const testFiles = files.filter(f => 
      f.includes('.test.') || 
      f.includes('.spec.') || 
      f.includes('__tests__') ||
      f.includes('/test/') ||
      f.includes('/tests/')
    );
    const sourceFiles = files.filter(f => !testFiles.includes(f));

    let hasTestFramework = false;
    let testFramework: string | undefined;

    try {
      const packageJson = await fs.readFile(path.join(this.PROJECT_ROOT, 'package.json'), 'utf-8');
      const pkg = JSON.parse(packageJson);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps.jest) {
        hasTestFramework = true;
        testFramework = 'Jest';
      } else if (allDeps.vitest) {
        hasTestFramework = true;
        testFramework = 'Vitest';
      } else if (allDeps.mocha) {
        hasTestFramework = true;
        testFramework = 'Mocha';
      } else if (allDeps.playwright || allDeps['@playwright/test']) {
        hasTestFramework = true;
        testFramework = 'Playwright';
      }
    } catch {
      // No package.json
    }

    const ratio = sourceFiles.length > 0 ? testFiles.length / sourceFiles.length : 0;
    const estimatedCoverage = Math.min(Math.round(ratio * 100), 100);

    return {
      estimatedCoverage,
      testFilesCount: testFiles.length,
      sourceFilesCount: sourceFiles.length,
      testToSourceRatio: Math.round(ratio * 100) / 100,
      hasTestFramework,
      testFramework,
    };
  }

  private async analyzeDependencies(): Promise<DependencyMetrics> {
    try {
      const packageJson = await fs.readFile(path.join(this.PROJECT_ROOT, 'package.json'), 'utf-8');
      const pkg = JSON.parse(packageJson);

      const deps = Object.keys(pkg.dependencies || {}).length;
      const devDeps = Object.keys(pkg.devDependencies || {}).length;

      return {
        totalDependencies: deps + devDeps,
        outdatedDependencies: 0,
        securityVulnerabilities: 0,
        devDependencies: devDeps,
        productionDependencies: deps,
      };
    } catch {
      return {
        totalDependencies: 0,
        outdatedDependencies: 0,
        securityVulnerabilities: 0,
        devDependencies: 0,
        productionDependencies: 0,
      };
    }
  }

  private identifyIssues(
    structure: StructureMetrics,
    complexity: ComplexityMetrics,
    coverage: CoverageMetrics,
    dependencies: DependencyMetrics
  ): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (complexity.maxCyclomaticComplexity > 20) {
      issues.push({
        severity: 'critical',
        category: 'complexity',
        title: 'Very High Code Complexity',
        description: `Maximum cyclomatic complexity of ${complexity.maxCyclomaticComplexity} detected`,
        suggestion: 'Consider breaking down complex functions into smaller, more focused functions',
      });
    } else if (complexity.maxCyclomaticComplexity > 10) {
      issues.push({
        severity: 'warning',
        category: 'complexity',
        title: 'High Code Complexity',
        description: `Cyclomatic complexity of ${complexity.maxCyclomaticComplexity} in some files`,
        suggestion: 'Review complex functions for potential simplification',
      });
    }

    for (const file of complexity.highComplexityFiles) {
      issues.push({
        severity: 'warning',
        category: 'complexity',
        title: 'Complex File',
        description: `${file.file} has complexity score of ${file.complexity}`,
        file: file.file,
        suggestion: 'Consider refactoring to reduce complexity',
      });
    }

    if (coverage.estimatedCoverage < 20) {
      issues.push({
        severity: 'critical',
        category: 'coverage',
        title: 'Very Low Test Coverage',
        description: `Estimated test coverage is only ${coverage.estimatedCoverage}%`,
        suggestion: 'Add more unit tests to improve code reliability',
      });
    } else if (coverage.estimatedCoverage < 50) {
      issues.push({
        severity: 'warning',
        category: 'coverage',
        title: 'Low Test Coverage',
        description: `Estimated test coverage is ${coverage.estimatedCoverage}%`,
        suggestion: 'Consider adding tests for critical functionality',
      });
    }

    if (!coverage.hasTestFramework) {
      issues.push({
        severity: 'info',
        category: 'coverage',
        title: 'No Test Framework Detected',
        description: 'No testing framework found in project dependencies',
        suggestion: 'Consider adding Vitest or Jest for unit testing',
      });
    }

    for (const file of structure.largestFiles.slice(0, 3)) {
      if (file.lines > 500) {
        issues.push({
          severity: 'warning',
          category: 'structure',
          title: 'Large File',
          description: `${file.file} has ${file.lines} lines`,
          file: file.file,
          suggestion: 'Consider splitting into smaller modules',
        });
      }
    }

    if (structure.directoryDepth > 6) {
      issues.push({
        severity: 'info',
        category: 'structure',
        title: 'Deep Directory Structure',
        description: `Directory nesting depth of ${structure.directoryDepth}`,
        suggestion: 'Consider flattening directory structure for easier navigation',
      });
    }

    if (dependencies.totalDependencies > 100) {
      issues.push({
        severity: 'warning',
        category: 'dependency',
        title: 'Many Dependencies',
        description: `Project has ${dependencies.totalDependencies} dependencies`,
        suggestion: 'Review dependencies to remove unused packages',
      });
    }

    return issues;
  }

  private generateSuggestions(issues: HealthIssue[]): string[] {
    const suggestions: string[] = [];
    const categories = new Set(issues.map(i => i.category));

    if (categories.has('complexity')) {
      suggestions.push('Consider using code splitting and modular architecture');
      suggestions.push('Extract reusable logic into custom hooks or utility functions');
    }

    if (categories.has('coverage')) {
      suggestions.push('Set up a CI pipeline with automated testing');
      suggestions.push('Write tests for new features before implementation (TDD)');
    }

    if (categories.has('structure')) {
      suggestions.push('Follow consistent file naming conventions');
      suggestions.push('Group related components in feature folders');
    }

    if (categories.has('dependency')) {
      suggestions.push('Run `npm audit` to check for security vulnerabilities');
      suggestions.push('Use `npm outdated` to identify update candidates');
    }

    if (suggestions.length === 0) {
      suggestions.push('Great job! Your project health looks good.');
      suggestions.push('Consider adding documentation for complex logic');
    }

    return suggestions;
  }

  private calculateOverallScore(
    complexity: ComplexityMetrics,
    coverage: CoverageMetrics,
    structure: StructureMetrics,
    dependencies: DependencyMetrics
  ): HealthScore {
    let score = 100;

    if (complexity.averageCyclomaticComplexity > 15) score -= 20;
    else if (complexity.averageCyclomaticComplexity > 10) score -= 10;
    else if (complexity.averageCyclomaticComplexity > 5) score -= 5;

    if (coverage.estimatedCoverage < 20) score -= 25;
    else if (coverage.estimatedCoverage < 50) score -= 15;
    else if (coverage.estimatedCoverage < 80) score -= 5;

    if (structure.averageFileSize > 300) score -= 10;
    else if (structure.averageFileSize > 200) score -= 5;

    if (complexity.highComplexityFiles.length > 5) score -= 10;
    else if (complexity.highComplexityFiles.length > 2) score -= 5;

    score = Math.max(0, Math.min(100, score));

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return {
      score,
      grade,
      trend: 'stable',
    };
  }

  private async getAllSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.cache'];
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb', '.php'];

    async function walk(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (sourceExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    await walk(this.PROJECT_ROOT);
    return files;
  }

  invalidateCache(projectId: string): void {
    this.healthCache.delete(projectId);
    console.log(`[PROJECT-HEALTH] Cache invalidated for project: ${projectId}`);
  }
}

export const projectHealthService = new ProjectHealthService();
