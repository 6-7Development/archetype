# Agent Communication System - Usage Guide

**Created:** October 26, 2025  
**Status:** Production Ready ✅

This guide demonstrates how to use the cross-agent communication patterns for **SySop**, **LomuAI**, and **I AM (The Architect)**.

---

## Table of Contents

1. [Overview](#overview)
2. [Agent Capabilities](#agent-capabilities)
3. [Communication Patterns](#communication-patterns)
4. [Usage Examples](#usage-examples)
5. [Integration Guide](#integration-guide)

---

## Overview

The agent communication system provides standardized protocols for:

- **Status Broadcasting** - Real-time updates to clients
- **Approval Workflows** - Request architect approval for critical changes
- **Escalation Patterns** - Get help when stuck in deadlocks
- **Delegation Protocol** - Pass tasks to specialized sub-agents
- **Evidence Sharing** - Exchange code, logs, and diagnostics

---

## Agent Capabilities

### Discover What Each Agent Can Do

```typescript
import { discoverAgentCapabilities, getAgentCapabilities } from './agentCommunication';

// Get all agent capabilities
const allCapabilities = discoverAgentCapabilities();
console.log(allCapabilities);

// Get specific agent capabilities
const sysopCaps = getAgentCapabilities('sysop');
console.log('SySop can:', sysopCaps.capabilities);
console.log('SySop specializes in:', sysopCaps.expertiseAreas);
console.log('SySop restrictions:', sysopCaps.restrictions);
```

**Output:**
```
SySop can: [
  'Build user projects from scratch',
  'Write production-ready code',
  'Create full-stack applications',
  'Implement features and fix bugs',
  'Self-test and validate code',
  'Delegate to sub-agents',
  'Request architect consultation',
  'Deploy to production'
]

SySop specializes in: [
  'Full-stack development',
  'React/TypeScript',
  'Node.js/Express',
  'Database design',
  'API development',
  'UI/UX implementation'
]

SySop restrictions: [
  'Cannot modify platform files',
  'Cannot access admin features',
  'Works only on user projects'
]
```

---

## Communication Patterns

### 1. Status Broadcasting

**When to use:** Keep users informed about agent progress in real-time.

```typescript
import { broadcastAgentStatus } from './agentCommunication';
import type { WebSocketServer } from 'ws';

function exampleStatusBroadcast(wss: WebSocketServer) {
  // Agent starts working on a task
  broadcastAgentStatus(wss, 'sysop', {
    userId: 'user123',
    status: 'working',
    currentTask: 'Building authentication system',
    progress: 25,
    metadata: {
      filesCreated: 3,
      estimatedTimeRemaining: '5 minutes'
    }
  });

  // Agent makes progress
  broadcastAgentStatus(wss, 'sysop', {
    userId: 'user123',
    status: 'working',
    currentTask: 'Implementing login flow',
    progress: 60,
    metadata: {
      filesCreated: 7,
      estimatedTimeRemaining: '2 minutes'
    }
  });

  // Agent completes task
  broadcastAgentStatus(wss, 'sysop', {
    userId: 'user123',
    status: 'completed',
    currentTask: 'Authentication system complete',
    progress: 100,
    metadata: {
      filesCreated: 12,
      testsPassed: 15
    }
  });
}
```

**Client receives:**
```json
{
  "type": "agent_status",
  "agentType": "sysop",
  "status": "working",
  "currentTask": "Building authentication system",
  "progress": 25,
  "timestamp": "2025-10-26T03:30:00.000Z",
  "metadata": {
    "filesCreated": 3,
    "estimatedTimeRemaining": "5 minutes"
  }
}
```

---

### 2. Architect Approval Workflow

**When to use:** Before making critical architectural changes, security modifications, or breaking changes.

```typescript
import { requestArchitectApproval, processArchitectApproval } from './agentCommunication';

// LomuAI needs approval to refactor WebSocket system
function exampleArchitectApproval() {
  // Step 1: Request approval
  const approvalRequest = requestArchitectApproval({
    requestedBy: 'lomu-ai',
    userId: 'owner123',
    changeType: 'architecture',
    description: 'Refactor WebSocket system to support connection pooling',
    proposedChanges: [
      {
        filePath: 'server/routes/websocket.ts',
        operation: 'modify',
        currentContent: '// current implementation...',
        proposedContent: '// new pooled implementation...',
        reason: 'Improve scalability for 1000+ concurrent connections'
      },
      {
        filePath: 'server/connectionPool.ts',
        operation: 'create',
        proposedContent: '// connection pool manager...',
        reason: 'Centralized connection lifecycle management'
      }
    ],
    context: {
      problemStatement: 'Current WebSocket system struggles with >500 concurrent users',
      alternativesConsidered: [
        'Redis pub/sub (adds external dependency)',
        'Socket.io (different protocol)',
        'Native WebSocket with pooling (selected)'
      ],
      riskAssessment: 'Medium - requires client reconnection logic update',
      impactAnalysis: 'Breaking change for existing WebSocket clients'
    },
    evidence: {
      codeSnapshots: {
        'server/routes/websocket.ts': '// current code...'
      },
      logs: [
        'Memory usage: 850MB at 500 connections',
        'Connection timeout rate: 12%'
      ],
      diagnostics: {
        avgResponseTime: '450ms',
        peakConnections: 512,
        memoryPerConnection: '1.6MB'
      }
    },
    urgency: 'high'
  });

  console.log('Approval Request ID:', approvalRequest.requestId);
  console.log('Waiting for I AM to review...');

  // Step 2: I AM reviews and responds
  // (This would happen asynchronously in the actual system)
  const architectResponse = processArchitectApproval({
    requestId: approvalRequest.requestId,
    approved: true,
    architectId: 'architect-001',
    guidance: 'Approved with conditions. Implementation looks sound.',
    recommendations: [
      'Implement graceful connection migration during pool rebalancing',
      'Add circuit breaker pattern for overload protection',
      'Include detailed metrics dashboard for monitoring',
      'Write integration tests for 1000+ concurrent connections'
    ],
    conditions: [
      'Deploy behind feature flag for gradual rollout',
      'Implement automatic rollback on error rate >5%',
      'Monitor memory usage for 24h before full deployment'
    ],
    evidenceUsed: [
      'Reviewed server/routes/websocket.ts',
      'Analyzed memory profiling data',
      'Checked connection timeout patterns'
    ],
    filesInspected: [
      'server/routes/websocket.ts',
      'server/index.ts',
      'client/src/hooks/use-websocket-stream.ts'
    ]
  });

  if (architectResponse.approved) {
    console.log('✅ Approved! Proceeding with implementation.');
    console.log('Conditions to meet:', architectResponse.conditions);
  } else {
    console.log('❌ Not approved. Review guidance:', architectResponse.guidance);
  }

  return architectResponse;
}
```

---

### 3. Escalation Pattern

**When to use:** When stuck in a deadlock, repeated failures, or complex architectural decisions.

```typescript
import { escalateToArchitect, processEscalationResponse } from './agentCommunication';

// SySop is stuck after 3 failed attempts to fix a bug
function exampleEscalation() {
  const escalation = escalateToArchitect({
    escalatedBy: 'sysop',
    userId: 'user456',
    projectId: 'project-789',
    reason: 'deadlock',
    description: 'Memory leak in user session management - 3 fix attempts failed',
    context: {
      problemStatement: 'Memory grows continuously, sessions not properly cleaned up',
      attemptedSolutions: [
        'Added session.destroy() in logout handler',
        'Implemented session timeout with setInterval cleanup',
        'Used WeakMap for session storage'
      ],
      failureReasons: [
        'Memory still grows after logout (leak persists)',
        'setInterval cleanup runs but memory not freed',
        'WeakMap doesn\'t help - sessions still referenced elsewhere'
      ],
      currentState: {
        activeUsers: 50,
        memoryUsage: '650MB',
        sessionCount: 150,
        growthRate: '50MB/hour'
      }
    },
    evidence: {
      codeSnapshot: {
        'server/auth.ts': '// current session handling code...',
        'server/index.ts': '// session store configuration...'
      },
      errorLogs: [
        'Warning: Heap size approaching limit',
        'Session count growing beyond active users'
      ],
      stackTraces: [
        'at sessionStore.get (...)...'
      ],
      diagnostics: {
        heapUsed: 650000000,
        sessionStoreSize: 150,
        activeConnections: 50,
        memoryGrowthPerHour: 50000000
      }
    }
  });

  console.log('Escalated to Architect:', escalation.escalationId);

  // I AM analyzes and responds
  const response = processEscalationResponse({
    escalationId: escalation.escalationId,
    respondedBy: 'architect',
    success: true,
    guidance: 'Root cause identified: Session store not configured with TTL. ' +
              'PostgreSQL session store holds sessions indefinitely unless explicitly configured.',
    actionItems: [
      'Configure session store with TTL: { ttl: 86400 } (24 hours)',
      'Add pruneSessionInterval to automatically clean expired sessions',
      'Implement session regeneration on privilege escalation',
      'Add memory monitoring alerts'
    ],
    suggestedApproach: 
      'The connect-pg-simple store needs explicit TTL configuration. ' +
      'Update session middleware with proper expiration settings.',
    codeExamples: {
      'server/index.ts': `
// Fixed session configuration
const sessionStore = new PostgresSessionStore({
  pool: db,
  tableName: 'sessions',
  pruneSessionInterval: 60 * 15, // Clean expired sessions every 15 min
  ttl: 60 * 60 * 24 // 24 hour TTL
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));
      `
    },
    referenceDocs: [
      'https://github.com/voxpelli/node-connect-pg-simple#options',
      'https://expressjs.com/en/resources/middleware/session.html'
    ]
  });

  if (response.success) {
    console.log('✅ Solution found!');
    console.log('Guidance:', response.guidance);
    console.log('Action items:', response.actionItems);
    console.log('Code example provided:', Object.keys(response.codeExamples || {}));
  }

  return response;
}
```

---

### 4. Delegation Protocol

**When to use:** Delegating specialized tasks to sub-agents for parallel execution.

```typescript
import { delegateToSubAgent, processTaskHandoff } from './agentCommunication';

// LomuAI delegates database migration to specialist sub-agent
function exampleDelegation() {
  const delegation = delegateToSubAgent({
    delegatedBy: 'lomu-ai',
    subAgentType: 'specialist',
    userId: 'owner123',
    task: {
      title: 'Migrate user preferences schema',
      description: 'Update database schema and migrate existing user preference data',
      acceptanceCriteria: [
        'New columns added to users table: theme, language, notifications',
        'All existing JSON preferences migrated to new columns',
        'Zero data loss - 100% migration success rate',
        'Migration script is idempotent (safe to run multiple times)',
        'Rollback script available in case of issues'
      ],
      priority: 'high',
      estimatedEffort: '45 minutes'
    },
    context: {
      relevantFiles: [
        'shared/schema.ts',
        'server/storage.ts',
        'server/db.ts'
      ],
      dependencies: [
        'Drizzle ORM schema changes must be reviewed first',
        'Backup of production data completed',
        'Maintenance window scheduled'
      ],
      constraints: [
        'Cannot drop the preferences_json column (backward compatibility)',
        'Must maintain read access during migration',
        'Migration must complete within 30 minute window'
      ],
      backgroundInfo: 
        'Currently storing all user preferences in a single JSON column. ' +
        'Moving to dedicated columns for better indexing and querying.'
    },
    handoff: {
      currentProgress: 'Schema designed and reviewed by architect',
      nextSteps: [
        'Add new columns to schema.ts',
        'Create migration script with batch processing',
        'Test migration on staging data (1000 users)',
        'Execute migration on production',
        'Verify data integrity',
        'Update API to use new columns'
      ],
      warningsOrCaveats: [
        'Production database has 15,000+ users - migration will take time',
        'Some users may have invalid JSON that needs handling',
        'Monitor database CPU during migration'
      ]
    }
  });

  console.log('Task delegated:', delegation.delegationId);
  console.log('Sub-agent type:', delegation.subAgentType);
  console.log('Priority:', delegation.task.priority);

  // Sub-agent accepts the task
  const handoffResponse = processTaskHandoff({
    delegationId: delegation.delegationId,
    acceptedBy: 'sub-agent',
    accepted: true,
    estimatedCompletion: new Date(Date.now() + 45 * 60 * 1000).toISOString()
  });

  console.log('Task accepted:', handoffResponse.accepted);
  console.log('ETA:', handoffResponse.estimatedCompletion);

  return { delegation, handoffResponse };
}
```

---

### 5. Evidence Sharing

**When to use:** Sharing diagnostic data, code snapshots, test results, or performance metrics between agents.

```typescript
import { shareEvidencePackage } from './agentCommunication';

// SySop shares test results with Architect for performance review
function exampleEvidenceSharing() {
  const evidence = shareEvidencePackage({
    providedBy: 'sysop',
    receivedBy: 'architect',
    userId: 'user123',
    projectId: 'project-456',
    evidenceType: 'test_results',
    title: 'Payment flow integration tests - Performance concern',
    description: 
      'All tests passing but payment processing is slower than expected. ' +
      'Need architectural review for optimization.',
    data: {
      files: {
        'tests/payment.test.ts': `
describe('Payment Flow', () => {
  it('should create payment', async () => {
    const result = await createPayment({ amount: 100 });
    expect(result.status).toBe('pending');
  }); // ✓ 245ms

  it('should process payment', async () => {
    const result = await processPayment('pay_123');
    expect(result.status).toBe('completed');
  }); // ✓ 1850ms ⚠️ SLOW

  it('should handle refund', async () => {
    const result = await refundPayment('pay_123');
    expect(result.status).toBe('refunded');
  }); // ✓ 320ms
});
        `,
        'src/payment-service.ts': `
// Current implementation
export async function processPayment(paymentId: string) {
  // Multiple database queries
  const payment = await db.select().from(payments).where(...);
  const user = await db.select().from(users).where(...);
  const account = await db.select().from(accounts).where(...);
  
  // Stripe API call
  const charge = await stripe.charges.create({...});
  
  // Update database
  await db.update(payments).set({ status: 'completed' }).where(...);
  
  return payment;
}
        `
      },
      logs: [
        '🧪 Test suite: Payment Flow',
        '  ✓ Create payment (245ms)',
        '  ✓ Process payment (1850ms) ⚠️',
        '  ✓ Refund payment (320ms)',
        '',
        '📊 Summary: 3 tests, 3 passed, 0 failed',
        '⏱️  Average duration: 805ms',
        '⚠️  Slowest test: Process payment - 1850ms'
      ],
      metrics: {
        totalTests: 3,
        passed: 3,
        failed: 0,
        avgDuration: '805ms',
        slowestTest: 'Process payment - 1850ms',
        databaseQueries: 4,
        apiCalls: 1,
        p95ResponseTime: '1850ms',
        targetResponseTime: '500ms'
      }
    },
    metadata: {
      collectedAt: new Date().toISOString(),
      environment: 'development',
      tags: ['payment', 'integration-tests', 'performance-concern', 'needs-optimization']
    }
  });

  console.log('Evidence package created:', evidence.packageId);
  console.log('Type:', evidence.evidenceType);
  console.log('Files included:', Object.keys(evidence.data.files || {}));
  console.log('Log entries:', evidence.data.logs?.length);

  // Architect receives evidence and can now analyze for optimization opportunities
  return evidence;
}
```

---

## Integration Guide

### In Your Agent Routes

**Example: LomuAI Chat Integration**

```typescript
// server/routes/metaSysopChat.ts
import { 
  broadcastAgentStatus,
  escalateToArchitect,
  delegateToSubAgent 
} from '../agentCommunication';
import type { WebSocketServer } from 'ws';

export function setupMetaSysopChat(router: Router, wss: WebSocketServer) {
  router.post('/stream', async (req, res) => {
    const userId = req.authenticatedUserId;
    
    // Broadcast that LomuAI is starting work
    broadcastAgentStatus(wss, 'lomu-ai', {
      userId,
      status: 'thinking',
      currentTask: 'Analyzing platform issue',
      progress: 0
    });

    // If stuck, escalate to architect
    if (failedAttempts >= 3) {
      const escalation = escalateToArchitect({
        escalatedBy: 'lomu-ai',
        userId,
        reason: 'deadlock',
        description: 'Cannot resolve platform issue after 3 attempts',
        context: { /* ... */ },
        evidence: { /* ... */ }
      });

      console.log('Escalated to Architect:', escalation.escalationId);
    }

    // Delegate complex tasks to sub-agents
    const delegation = delegateToSubAgent({
      delegatedBy: 'lomu-ai',
      subAgentType: 'specialist',
      userId,
      task: {
        title: 'Refactor authentication middleware',
        description: 'Update auth to support OAuth providers',
        acceptanceCriteria: ['OAuth working', 'Tests passing'],
        priority: 'high'
      },
      context: { /* ... */ },
      handoff: { /* ... */ }
    });

    // Broadcast completion
    broadcastAgentStatus(wss, 'lomu-ai', {
      userId,
      status: 'completed',
      currentTask: 'Platform fix complete',
      progress: 100
    });
  });
}
```

### Accessing WebSocket Server

The WebSocket server instance (`wss`) is initialized in `server/routes.ts` and passed to route handlers.

```typescript
// server/routes.ts
import { setupWebSocket } from './routes/websocket';

export async function registerRoutes(app: Express) {
  const { httpServer, wss } = setupWebSocket(app);
  
  // Pass wss to route handlers that need to broadcast
  setupMetaSysopChat(router, wss);
  setupSysopChat(router, wss);
  
  return httpServer;
}
```

---

## Best Practices

### 1. Always Broadcast Status Updates

Users want to know what's happening. Broadcast frequently:

```typescript
// ❌ Bad: No status updates
async function buildProject() {
  // ... 5 minutes of work with no feedback ...
}

// ✅ Good: Regular status updates
async function buildProject(wss: WebSocketServer, userId: string) {
  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'working',
    currentTask: 'Setting up project structure',
    progress: 10
  });

  await setupStructure();

  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'working',
    currentTask: 'Creating components',
    progress: 40
  });

  await createComponents();

  broadcastAgentStatus(wss, 'sysop', {
    userId,
    status: 'completed',
    currentTask: 'Project build complete',
    progress: 100
  });
}
```

### 2. Escalate Early

Don't waste time on repeated failures. Escalate after 2-3 attempts:

```typescript
// ✅ Good: Escalate after 3 failed attempts
let attempts = 0;
while (attempts < 3) {
  try {
    await fixBug();
    break;
  } catch (error) {
    attempts++;
    if (attempts === 3) {
      // Escalate to architect
      const escalation = escalateToArchitect({
        escalatedBy: 'sysop',
        userId,
        reason: 'deadlock',
        description: `Failed to fix bug after ${attempts} attempts`,
        context: {
          problemStatement: error.message,
          attemptedSolutions: attemptHistory,
          failureReasons: errorHistory,
          currentState: currentCodeSnapshot
        },
        evidence: { /* ... */ }
      });
    }
  }
}
```

### 3. Provide Rich Evidence

When escalating or requesting approval, include comprehensive evidence:

```typescript
// ❌ Bad: Minimal evidence
escalateToArchitect({
  reason: 'deadlock',
  description: 'Something is broken',
  context: { problemStatement: 'Error occurred' },
  evidence: {}
});

// ✅ Good: Rich evidence
escalateToArchitect({
  reason: 'deadlock',
  description: 'Memory leak in session store after 3 fix attempts',
  context: {
    problemStatement: 'Detailed description of the issue...',
    attemptedSolutions: ['Solution 1', 'Solution 2', 'Solution 3'],
    failureReasons: ['Why 1 failed', 'Why 2 failed', 'Why 3 failed'],
    currentState: { memoryUsage, sessionCount, growthRate }
  },
  evidence: {
    codeSnapshot: { 'file.ts': '...' },
    errorLogs: ['log1', 'log2'],
    stackTraces: ['trace1'],
    diagnostics: { detailedMetrics }
  }
});
```

### 4. Use Delegation for Parallelization

Delegate independent tasks to sub-agents for faster completion:

```typescript
// ❌ Bad: Sequential execution
await updateDatabase();
await refactorAuth();
await optimizeQueries();
await updateTests();

// ✅ Good: Parallel execution via delegation
const tasks = [
  delegateToSubAgent({ task: 'Update database schema', ... }),
  delegateToSubAgent({ task: 'Refactor auth', ... }),
  delegateToSubAgent({ task: 'Optimize queries', ... }),
  delegateToSubAgent({ task: 'Update tests', ... })
];

// Sub-agents work in parallel
await Promise.all(tasks.map(t => waitForCompletion(t.delegationId)));
```

---

## Summary

The agent communication system provides a robust, type-safe way for SySop, LomuAI, and I AM to collaborate effectively:

- ✅ **Status Broadcasting** - Keep users informed in real-time
- ✅ **Approval Workflows** - Get architect sign-off on critical changes
- ✅ **Escalation Patterns** - Break out of deadlocks with expert help
- ✅ **Delegation Protocol** - Parallelize work with specialized sub-agents
- ✅ **Evidence Sharing** - Make informed decisions with comprehensive data

All functions are fully typed, documented, and ready for production use.

**Questions?** Check the inline TypeScript documentation in `server/agentCommunication.ts` for detailed parameter descriptions and more examples.
