/**
 * Parity KPI Tracker
 * 
 * Measures BeeHive behavioral parity with Replit Agent across key metrics:
 * - Task list creation rate: Target ≥99%
 * - Test execution rate: Target ≥97%
 * - Premature completion attempts: Target ≤1%
 * - Workflow compliance score: Target ≥95%
 * 
 * Tracks both real-time (per job) and aggregate (platform-wide) metrics.
 */

export interface JobKPIs {
  jobId: string;
  taskListCreated: boolean;
  testsExecuted: boolean;
  prematureCompletionAttempts: number;
  workflowComplianceScore: number; // 0-100
  violationCount: number;
  phasesCompleted: string[];
  tokenEfficiency: number; // actions per 1000 tokens
}

export interface AggregateKPIs {
  totalJobs: number;
  taskListCreationRate: number; // percentage
  testExecutionRate: number; // percentage
  prematureCompletionRate: number; // percentage
  averageComplianceScore: number;
  architectEscalationRate: number; // percentage of jobs escalated
  targets: {
    taskListCreation: number; // 99%
    testExecution: number; // 97%
    prematureCompletion: number; // 1%
    compliance: number; // 95%
  };
}

export class ParityKPIs {
  private jobMetrics: Map<string, JobKPIs> = new Map();
  
  /**
   * Initialize tracking for a new job
   */
  startJob(jobId: string): void {
    this.jobMetrics.set(jobId, {
      jobId,
      taskListCreated: false,
      testsExecuted: false,
      prematureCompletionAttempts: 0,
      workflowComplianceScore: 100,
      violationCount: 0,
      phasesCompleted: [],
      tokenEfficiency: 0,
    });
  }
  
  /**
   * Record task list creation
   */
  recordTaskListCreation(jobId: string): void {
    const metrics = this.jobMetrics.get(jobId);
    if (metrics) {
      metrics.taskListCreated = true;
    }
  }
  
  /**
   * Record test execution
   */
  recordTestExecution(jobId: string): void {
    const metrics = this.jobMetrics.get(jobId);
    if (metrics) {
      metrics.testsExecuted = true;
    }
  }
  
  /**
   * Record premature completion attempt
   */
  recordPrematureCompletion(jobId: string): void {
    const metrics = this.jobMetrics.get(jobId);
    if (metrics) {
      metrics.prematureCompletionAttempts++;
    }
  }
  
  /**
   * Record violation
   */
  recordViolation(jobId: string, severity: number): void {
    const metrics = this.jobMetrics.get(jobId);
    if (metrics) {
      metrics.violationCount++;
      metrics.workflowComplianceScore = Math.max(0, metrics.workflowComplianceScore - severity);
    }
  }
  
  /**
   * Record phase completion
   */
  recordPhaseCompletion(jobId: string, phase: string): void {
    const metrics = this.jobMetrics.get(jobId);
    if (metrics && !metrics.phasesCompleted.includes(phase)) {
      metrics.phasesCompleted.push(phase);
    }
  }
  
  /**
   * Calculate token efficiency (tool calls per 1000 tokens)
   */
  calculateTokenEfficiency(jobId: string, toolCalls: number, tokens: number): void {
    const metrics = this.jobMetrics.get(jobId);
    if (metrics) {
      metrics.tokenEfficiency = (toolCalls / tokens) * 1000;
    }
  }
  
  /**
   * Get metrics for a specific job
   */
  getJobMetrics(jobId: string): JobKPIs | null {
    return this.jobMetrics.get(jobId) || null;
  }
  
  /**
   * Calculate aggregate KPIs across all jobs
   */
  calculateAggregateKPIs(): AggregateKPIs {
    const allMetrics = Array.from(this.jobMetrics.values());
    const totalJobs = allMetrics.length;
    
    if (totalJobs === 0) {
      return {
        totalJobs: 0,
        taskListCreationRate: 0,
        testExecutionRate: 0,
        prematureCompletionRate: 0,
        averageComplianceScore: 0,
        architectEscalationRate: 0,
        targets: {
          taskListCreation: 99,
          testExecution: 97,
          prematureCompletion: 1,
          compliance: 95,
        },
      };
    }
    
    const taskListsCreated = allMetrics.filter(m => m.taskListCreated).length;
    const testsExecuted = allMetrics.filter(m => m.testsExecuted).length;
    const prematureCompletions = allMetrics.reduce((sum, m) => sum + m.prematureCompletionAttempts, 0);
    const totalComplianceScore = allMetrics.reduce((sum, m) => sum + m.workflowComplianceScore, 0);
    const escalatedJobs = allMetrics.filter(m => m.violationCount >= 3).length;
    
    return {
      totalJobs,
      taskListCreationRate: (taskListsCreated / totalJobs) * 100,
      testExecutionRate: (testsExecuted / totalJobs) * 100,
      prematureCompletionRate: (prematureCompletions / totalJobs) * 100,
      averageComplianceScore: totalComplianceScore / totalJobs,
      architectEscalationRate: (escalatedJobs / totalJobs) * 100,
      targets: {
        taskListCreation: 99,
        testExecution: 97,
        prematureCompletion: 1,
        compliance: 95,
      },
    };
  }
  
  /**
   * Check if job meets all targets
   */
  meetsParityTargets(jobId: string): {
    passed: boolean;
    failures: string[];
  } {
    const metrics = this.jobMetrics.get(jobId);
    if (!metrics) {
      return { passed: false, failures: ['Job not found'] };
    }
    
    const failures: string[] = [];
    
    if (!metrics.taskListCreated) {
      failures.push('❌ Task list not created (Target: 100% jobs must create task list)');
    }
    
    if (!metrics.testsExecuted) {
      failures.push('❌ Tests not executed (Target: 100% jobs must run tests)');
    }
    
    if (metrics.prematureCompletionAttempts > 0) {
      failures.push(`❌ ${metrics.prematureCompletionAttempts} premature completion attempts (Target: 0)`);
    }
    
    if (metrics.workflowComplianceScore < 95) {
      failures.push(`❌ Compliance score ${metrics.workflowComplianceScore}% (Target: ≥95%)`);
    }
    
    return {
      passed: failures.length === 0,
      failures,
    };
  }
  
  /**
   * Generate KPI report
   */
  generateReport(jobId?: string): string {
    let report = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    report += '  REPLIT AGENT PARITY KPIs\n';
    report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    if (jobId) {
      // Single job report
      const metrics = this.jobMetrics.get(jobId);
      if (!metrics) {
        return 'Job not found';
      }
      
      report += `JOB: ${jobId}\n\n`;
      report += `✓ Task List Created: ${metrics.taskListCreated ? '✅ YES' : '❌ NO'}\n`;
      report += `✓ Tests Executed: ${metrics.testsExecuted ? '✅ YES' : '❌ NO'}\n`;
      report += `✓ Premature Completions: ${metrics.prematureCompletionAttempts === 0 ? '✅ NONE' : `❌ ${metrics.prematureCompletionAttempts}`}\n`;
      report += `✓ Compliance Score: ${metrics.workflowComplianceScore}% ${metrics.workflowComplianceScore >= 95 ? '✅' : '❌'}\n`;
      report += `✓ Violations: ${metrics.violationCount}\n`;
      report += `✓ Phases Completed: ${metrics.phasesCompleted.join(' → ')}\n`;
      report += `✓ Token Efficiency: ${metrics.tokenEfficiency.toFixed(2)} actions/1K tokens\n`;
      
      const parity = this.meetsParityTargets(jobId);
      report += `\nPARITY STATUS: ${parity.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      
      if (parity.failures.length > 0) {
        report += `\nFAILURES:\n`;
        parity.failures.forEach(f => report += `  ${f}\n`);
      }
    } else {
      // Aggregate report
      const aggregate = this.calculateAggregateKPIs();
      
      report += `AGGREGATE METRICS (${aggregate.totalJobs} jobs)\n\n`;
      
      const taskListIcon = aggregate.taskListCreationRate >= aggregate.targets.taskListCreation ? '✅' : '❌';
      const testIcon = aggregate.testExecutionRate >= aggregate.targets.testExecution ? '✅' : '❌';
      const prematureIcon = aggregate.prematureCompletionRate <= aggregate.targets.prematureCompletion ? '✅' : '❌';
      const complianceIcon = aggregate.averageComplianceScore >= aggregate.targets.compliance ? '✅' : '❌';
      
      report += `${taskListIcon} Task List Creation: ${aggregate.taskListCreationRate.toFixed(1)}% (Target: ≥${aggregate.targets.taskListCreation}%)\n`;
      report += `${testIcon} Test Execution: ${aggregate.testExecutionRate.toFixed(1)}% (Target: ≥${aggregate.targets.testExecution}%)\n`;
      report += `${prematureIcon} Premature Completion: ${aggregate.prematureCompletionRate.toFixed(1)}% (Target: ≤${aggregate.targets.prematureCompletion}%)\n`;
      report += `${complianceIcon} Avg Compliance Score: ${aggregate.averageComplianceScore.toFixed(1)}% (Target: ≥${aggregate.targets.compliance}%)\n`;
      report += `\nArchitect Escalation Rate: ${aggregate.architectEscalationRate.toFixed(1)}%\n`;
    }
    
    report += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    return report;
  }
}

// Global singleton instance
export const parityKPIs = new ParityKPIs();
