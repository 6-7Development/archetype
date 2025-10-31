/**
 * Agent Communication Integration Examples
 * 
 * This file demonstrates how to integrate the agent communication system
 * into existing route handlers (SySop, LomuAI, Architect).
 * 
 * DO NOT import this file in production - these are reference examples only.
 */

import type { WebSocketServer } from 'ws';
import type { Request, Response } from 'express';
import {
  broadcastAgentStatus,
  requestArchitectApproval,
  escalateToArchitect,
  delegateToSubAgent,
  shareEvidencePackage,
  getAgentCapabilities,
} from './agentCommunication';

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 1: SySop Chat Integration
// ═══════════════════════════════════════════════════════════════════

/**
 * Example: How to add status broadcasting to SySop chat stream
 */
export async function exampleSySopChatIntegration(
  wss: WebSocketServer,
  userId: string,
  projectId: string,
  userMessage: string
) {
  // 1. Broadcast that SySop is starting work
  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'thinking',
    currentTask: 'Analyzing request',
    progress: 0,
    metadata: {
      projectId,
      requestLength: userMessage.length
    }
  });

  // 2. SySop starts working
  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'working',
    currentTask: 'Building React components',
    progress: 30,
    metadata: {
      filesCreated: 3,
      estimatedTimeRemaining: '2 minutes'
    }
  });

  // 3. If SySop encounters a complex problem, escalate to Architect
  let failedAttempts = 0;
  const maxAttempts = 3;

  while (failedAttempts < maxAttempts) {
    try {
      // Attempt to fix the bug
      await attemptBugFix();
      break; // Success!
    } catch (error: any) {
      failedAttempts++;
      
      if (failedAttempts === maxAttempts) {
        // Escalate to Architect after 3 failed attempts
        const escalation = escalateToArchitect({
          escalatedBy: 'sysop',
          userId,
          projectId,
          reason: 'deadlock',
          description: `Failed to fix authentication bug after ${maxAttempts} attempts`,
          context: {
            problemStatement: 'JWT token validation fails intermittently',
            attemptedSolutions: [
              'Updated JWT secret rotation',
              'Added token expiration handling',
              'Implemented refresh token flow'
            ],
            failureReasons: [
              'Secret rotation broke existing sessions',
              'Expiration check has race condition',
              'Refresh flow conflicts with existing middleware'
            ],
            currentState: {
              activeUsers: 50,
              failureRate: '15%',
              affectedRoutes: ['/api/protected', '/api/user/profile']
            }
          },
          evidence: {
            codeSnapshot: {
              'server/auth.ts': '// current auth code...',
              'server/middleware/jwt.ts': '// jwt middleware...'
            },
            errorLogs: [
              'JWT verification failed: invalid signature',
              'Token expired but refresh not triggered'
            ],
            stackTraces: [
              'at jwt.verify (node_modules/jsonwebtoken/verify.js:123)',
              'at authMiddleware (server/middleware/jwt.ts:45)'
            ],
            diagnostics: {
              averageTokenAge: '45 minutes',
              failureCount: 150,
              successCount: 850
            }
          }
        });

        console.log(`[SYSOP] Escalated to Architect: ${escalation.escalationId}`);
        
        // Broadcast escalation status
        broadcastAgentStatus(wss, 'sysop', {
          userId,
          status: 'waiting_approval',
          currentTask: 'Waiting for Architect guidance',
          progress: 50,
          metadata: {
            escalationId: escalation.escalationId,
            reason: 'Multiple fix attempts failed'
          }
        });

        // I AM (The Architect) would analyze and respond here
        // Then SySop would implement the recommended solution
      }
    }
  }

  // 4. Complete the task
  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'completed',
    currentTask: 'Project build complete',
    progress: 100,
    metadata: {
      filesCreated: 12,
      testsPassed: 15,
      buildTime: '3 minutes'
    }
  });
}

// Placeholder function
async function attemptBugFix(): Promise<void> {
  // Implementation would go here
  throw new Error('Not implemented - this is an example');
}

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 2: LomuAI Platform Healing Integration
// ═══════════════════════════════════════════════════════════════════

/**
 * Example: How LomuAI uses delegation and approval workflows
 */
export async function exampleMetaSySopIntegration(
  wss: WebSocketServer,
  userId: string,
  healingRequest: string
) {
  // 1. Broadcast that LomuAI is analyzing the platform
  broadcastAgentStatus(wss, 'lomu-ai', {
    userId,
    status: 'thinking',
    currentTask: 'Diagnosing platform issue',
    progress: 0
  });

  // 2. Request Architect approval for critical platform changes
  const approvalRequest = requestArchitectApproval({
    requestedBy: 'lomu-ai',
    userId,
    changeType: 'architecture',
    description: 'Refactor session store to use connection pooling',
    proposedChanges: [
      {
        filePath: 'server/index.ts',
        operation: 'modify',
        currentContent: '// current session config...',
        proposedContent: '// new pooled session config...',
        reason: 'Improve scalability and reduce memory usage'
      },
      {
        filePath: 'server/sessionPool.ts',
        operation: 'create',
        proposedContent: '// session pool manager...',
        reason: 'Centralized session lifecycle management'
      }
    ],
    context: {
      problemStatement: 'Session store memory usage grows unbounded with user count',
      alternativesConsidered: [
        'Redis session store (requires external dependency)',
        'In-memory LRU cache (loses sessions on restart)',
        'PostgreSQL with connection pooling (selected)'
      ],
      riskAssessment: 'Medium - requires careful migration of existing sessions',
      impactAnalysis: 'All active sessions will need to be migrated to new store'
    },
    evidence: {
      codeSnapshots: {
        'server/index.ts': '// current code...'
      },
      logs: [
        'Memory usage: 1.2GB at 1000 concurrent users',
        'Session count: 1500 (some orphaned)'
      ],
      diagnostics: {
        memoryPerSession: '800KB',
        orphanedSessions: 500,
        activeSessions: 1000
      }
    },
    urgency: 'high'
  });

  console.log(`[LOMUAI] Approval requested: ${approvalRequest.requestId}`);

  // Broadcast waiting for approval
  broadcastAgentStatus(wss, 'lomu-ai', {
    userId,
    status: 'waiting_approval',
    currentTask: 'Waiting for Architect approval',
    progress: 25,
    metadata: {
      approvalRequestId: approvalRequest.requestId,
      changeType: 'architecture'
    }
  });

  // 3. Delegate database migration to specialist sub-agent
  const delegation = delegateToSubAgent({
    delegatedBy: 'lomu-ai',
    subAgentType: 'specialist',
    userId,
    task: {
      title: 'Migrate sessions to new store',
      description: 'Migrate all active sessions from old store to new pooled store',
      acceptanceCriteria: [
        'All active sessions migrated successfully',
        'Zero session data loss',
        'Migration completes in <5 minutes',
        'Rollback plan tested and ready'
      ],
      priority: 'high',
      estimatedEffort: '30 minutes'
    },
    context: {
      relevantFiles: [
        'server/index.ts',
        'server/sessionPool.ts',
        'shared/schema.ts'
      ],
      dependencies: [
        'New session pool must be initialized first',
        'Database backup completed',
        'Maintenance window active'
      ],
      constraints: [
        'Cannot exceed 5 minute downtime',
        'Must maintain session data integrity',
        'Rollback must be instant if issues occur'
      ],
      backgroundInfo: 'Currently using connect-pg-simple without pooling'
    },
    handoff: {
      currentProgress: 'New session pool code written and tested',
      nextSteps: [
        'Initialize new pool',
        'Start migration script',
        'Monitor for errors',
        'Switch over to new store',
        'Verify session integrity'
      ],
      warningsOrCaveats: [
        '1000+ active sessions to migrate',
        'Some sessions may be corrupted',
        'Monitor database CPU during migration'
      ]
    }
  });

  console.log(`[LOMUAI] Delegated task: ${delegation.delegationId}`);

  // Broadcast delegation status
  broadcastAgentStatus(wss, 'lomu-ai', {
    userId,
    status: 'delegating',
    currentTask: 'Sub-agent handling session migration',
    progress: 50,
    metadata: {
      delegationId: delegation.delegationId,
      subAgentType: 'specialist'
    }
  });

  // 4. Complete platform healing
  broadcastAgentStatus(wss, 'lomu-ai', {
    userId,
    status: 'completed',
    currentTask: 'Platform healing complete',
    progress: 100,
    metadata: {
      changesMade: 3,
      testsRun: 25,
      deploymentReady: true
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 3: Architect Review Integration
// ═══════════════════════════════════════════════════════════════════

/**
 * Example: How I AM (The Architect) uses evidence sharing
 */
export async function exampleArchitectReview(
  wss: WebSocketServer,
  userId: string,
  codeToReview: Record<string, string>
) {
  // 1. Broadcast that Architect is reviewing
  broadcastAgentStatus(wss, 'architect', {
    userId,
    status: 'working',
    currentTask: 'Reviewing code architecture',
    progress: 0
  });

  // 2. Perform code analysis
  const analysisResults = await performCodeAnalysis(codeToReview);

  // 3. Share evidence with requesting agent (SySop or LomuAI)
  const evidence = shareEvidencePackage({
    providedBy: 'architect',
    receivedBy: 'sysop', // or 'lomu-ai'
    userId,
    evidenceType: 'code',
    title: 'Architectural review findings',
    description: 'Security vulnerabilities and performance concerns identified',
    data: {
      files: {
        'review-report.md': `
# Architectural Review Report

## Security Issues Found
1. SQL Injection vulnerability in user input handling
2. Missing authentication on admin endpoints
3. Weak session token generation

## Performance Concerns
1. N+1 query problem in user dashboard
2. Missing database indexes on frequently queried columns
3. Inefficient JSON serialization in API responses

## Recommended Fixes
- Use parameterized queries or ORM
- Add authentication middleware to all /admin/* routes
- Use crypto.randomBytes for session tokens
- Implement data loader pattern for related records
- Add indexes on user_id, created_at columns
- Use streaming JSON for large responses
        `
      },
      metrics: {
        securityIssues: 3,
        performanceIssues: 3,
        codeQualityScore: 72,
        testCoverage: '65%',
        filesReviewed: 15
      }
    },
    metadata: {
      collectedAt: new Date().toISOString(),
      environment: 'development',
      tags: ['security', 'performance', 'code-review', 'needs-fixes']
    }
  });

  console.log(`[ARCHITECT] Evidence shared: ${evidence.packageId}`);

  // 4. Broadcast completion
  broadcastAgentStatus(wss, 'architect', {
    userId,
    status: 'completed',
    currentTask: 'Architectural review complete',
    progress: 100,
    metadata: {
      evidencePackageId: evidence.packageId,
      issuesFound: 6,
      recommendationsProvided: 6
    }
  });

  return evidence;
}

// Placeholder function
async function performCodeAnalysis(code: Record<string, string>): Promise<any> {
  // Implementation would go here
  return { issues: [], recommendations: [] };
}

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 4: Agent Capability Discovery
// ═══════════════════════════════════════════════════════════════════

/**
 * Example: How agents can discover each other's capabilities
 */
export function exampleCapabilityDiscovery() {
  console.log('\n=== AGENT CAPABILITY DISCOVERY ===\n');

  // Get SySop capabilities
  const sysopCaps = getAgentCapabilities('sysop');
  console.log('🤖 SySop (The Coder)');
  console.log('  Capabilities:', sysopCaps.capabilities.slice(0, 3).join(', '), '...');
  console.log('  Expertise:', sysopCaps.expertiseAreas.slice(0, 3).join(', '));
  console.log('  Restrictions:', sysopCaps.restrictions[0]);

  // Get LomuAI capabilities
  const metaCaps = getAgentCapabilities('lomu-ai');
  console.log('\n🔧 LomuAI (Platform Healer)');
  console.log('  Capabilities:', metaCaps.capabilities.slice(0, 3).join(', '), '...');
  console.log('  Expertise:', metaCaps.expertiseAreas.slice(0, 3).join(', '));
  console.log('  Restrictions:', metaCaps.restrictions[0]);

  // Get Architect capabilities
  const architectCaps = getAgentCapabilities('architect');
  console.log('\n🏛️ I AM (The Architect)');
  console.log('  Capabilities:', architectCaps.capabilities.slice(0, 3).join(', '), '...');
  console.log('  Expertise:', architectCaps.expertiseAreas.slice(0, 3).join(', '));
  console.log('  Restrictions:', architectCaps.restrictions[0]);

  console.log('\n');
}

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 5: Complete Workflow
// ═══════════════════════════════════════════════════════════════════

/**
 * Example: Complete workflow showing all communication patterns
 */
export async function exampleCompleteWorkflow(
  wss: WebSocketServer,
  userId: string,
  projectId: string
) {
  console.log('\n=== COMPLETE AGENT COMMUNICATION WORKFLOW ===\n');

  // 1. SySop starts work
  console.log('1️⃣ SySop starts working on user project...');
  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'working',
    currentTask: 'Building e-commerce platform',
    progress: 10
  });

  // 2. SySop encounters a complex architectural decision
  console.log('2️⃣ SySop needs architectural guidance...');
  const approvalRequest = requestArchitectApproval({
    requestedBy: 'sysop',
    userId,
    projectId,
    changeType: 'architecture',
    description: 'Should we use microservices or monolith architecture?',
    proposedChanges: [
      {
        filePath: 'server/services/payment.ts',
        operation: 'create',
        proposedContent: '// payment microservice...',
        reason: 'Separate payment logic for security and scalability'
      }
    ],
    context: {
      problemStatement: 'Project requires payment processing, inventory, and user management',
      alternativesConsidered: [
        'Monolith (simpler)',
        'Microservices (scalable)',
        'Hybrid (selected modules only)'
      ],
      riskAssessment: 'Low - project is greenfield',
      impactAnalysis: 'Will affect deployment strategy and infrastructure'
    },
    urgency: 'medium'
  });

  // 3. Architect reviews and approves
  console.log('3️⃣ Architect reviews the proposal...');
  broadcastAgentStatus(wss, 'architect', {
    userId,
    status: 'working',
    currentTask: 'Reviewing architecture proposal',
    progress: 50
  });

  // 4. SySop delegates payment integration to sub-agent
  console.log('4️⃣ SySop delegates payment integration...');
  const delegation = delegateToSubAgent({
    delegatedBy: 'sysop',
    subAgentType: 'specialist',
    userId,
    projectId,
    task: {
      title: 'Integrate Stripe payment processing',
      description: 'Set up Stripe integration with webhook handling',
      acceptanceCriteria: [
        'Stripe SDK configured',
        'Payment endpoints created',
        'Webhook handling implemented',
        'Tests passing'
      ],
      priority: 'high'
    },
    context: {
      relevantFiles: ['server/routes/payment.ts'],
      dependencies: ['Stripe API key configured'],
      constraints: ['Must handle failed payments gracefully']
    },
    handoff: {
      nextSteps: [
        'Install Stripe SDK',
        'Create payment routes',
        'Implement webhook handler',
        'Add error handling'
      ]
    }
  });

  // 5. Complete workflow
  console.log('5️⃣ All agents complete their work...');
  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'completed',
    currentTask: 'E-commerce platform complete',
    progress: 100
  });

  console.log('\n✅ Workflow complete!\n');
}

// ═══════════════════════════════════════════════════════════════════
// USAGE IN ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Example: How to integrate into an Express route handler
 */
export function exampleRouteIntegration() {
  // This would be in server/routes/chat.ts or similar

  /*
  import { broadcastAgentStatus } from '../agentCommunication';
  import type { WebSocketServer } from 'ws';

  export function setupChatRoutes(router: Router, wss: WebSocketServer) {
    router.post('/api/chat/stream', async (req: any, res) => {
      const userId = req.authenticatedUserId;
      const projectId = req.body.projectId;
      const message = req.body.message;

      // Broadcast that agent is starting work
      broadcastAgentStatus(wss, 'sysop', {
        userId,
        status: 'thinking',
        currentTask: 'Analyzing request',
        progress: 0
      });

      // ... rest of chat stream logic ...

      // Broadcast completion
      broadcastAgentStatus(wss, 'sysop', {
        userId,
        status: 'completed',
        currentTask: 'Response generated',
        progress: 100
      });
    });
  }
  */
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS (for testing only)
// ═══════════════════════════════════════════════════════════════════

// These examples are for reference only
// DO NOT import in production code
