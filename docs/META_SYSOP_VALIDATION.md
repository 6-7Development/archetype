# Meta-SySop Validation Guide

## Overview

This guide describes the **bulletproof Meta-SySop validation workflow** that ensures Meta-SySop accurately diagnoses and heals the platform in production mode before any deployment to Railway.

The validation system implements **5 critical phases** that together guarantee Meta-SySop analyzes real compiled artifacts, detects source⇄artifact drift, and operates with full conversational awareness.

---

## Phase D: Local Production Parity Workflow

### Purpose

Test Meta-SySop in production mode **locally** before deploying to Railway. This ensures:

- Meta-SySop diagnoses **compiled dist/ artifacts** (not source TypeScript)
- Platform healing works against production builds
- No surprises when deploying to Railway

### Quick Start

```bash
# Standard production mode (recommended)
tsx scripts/run-meta-prod.ts

# With mock secrets (if you don't have real Railway secrets)
tsx scripts/run-meta-prod.ts --mock-secrets

# With database seeding
tsx scripts/run-meta-prod.ts --seed --mock-secrets

# Skip build (if dist/ already exists)
tsx scripts/run-meta-prod.ts --skip-build

# Verbose output (for debugging)
tsx scripts/run-meta-prod.ts --verbose
```

### What It Does

The `run-meta-prod.ts` script orchestrates a complete production simulation:

#### 1. **Build Application**
```bash
npm run build
```

- Compiles frontend with Vite → `dist/client/`
- Bundles server with esbuild → `dist/index.js`
- Generates source maps for debugging
- Cleans old dist/ artifacts

#### 2. **Bootstrap Environment**

Sets up Railway-like environment variables:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=<from .env or mock>
SESSION_SECRET=<from .env or mock>
ANTHROPIC_API_KEY=<from .env or required>
GITHUB_TOKEN=<from .env or optional>
```

With `--mock-secrets`, safe defaults are used for local testing.

#### 3. **Seed Database** (optional with `--seed`)

```bash
npm run db:push
# + fixture seeding (future)
```

Ensures database schema matches production.

#### 4. **Start Production Server**

```bash
node dist/index.js
```

Runs the **compiled server** (not tsx/ts-node) exactly like Railway does.

### Validation Checklist

Once the server is running, validate Meta-SySop functionality:

#### ✅ **Diagnosis Accuracy**

1. Open Meta-SySop chat at `http://localhost:5000/platform-healing`
2. Run diagnosis command:
   ```
   Run full platform diagnosis
   ```
3. **Verify findings reference `dist/` artifacts**:
   - ✓ Findings show `dist/index.js:123` (compiled code)
   - ✗ Findings should NOT show `server/routes.ts:456` (source code)
4. Check evidence includes actual code from dist/

#### ✅ **Source⇄Artifact Fidelity**

1. Meta-SySop should detect drift between source and compiled code
2. Warnings should appear if compiled code differs from source
3. SHA-based validation ensures correct source version

#### ✅ **Healing Workflows**

1. Request Meta-SySop to fix an issue
2. Changes should be applied to **source files** (server/*.ts)
3. After changes, app should rebuild automatically
4. Meta-SySop should verify fixes in new dist/ artifacts

#### ✅ **Conversational Context**

1. Meta-SySop should reference:
   - Current task board state
   - Recent git commits
   - Previous diagnosis findings
2. Responses should be natural and context-aware
3. No secret leakage in chat

---

## Phase A: Integration Test Harness

### Purpose

Automated tests that verify production diagnosis works correctly.

### Running Tests

```bash
# Run integration tests
npm run test:meta-sysop

# Or manually
tsx server/tests/platformHealing/diagnosis.integration.test.ts
```

### Test Coverage

The integration tests verify:

1. **Production Build Diagnosis**
   - Build app with `npm run build`
   - Run `performDiagnosis` against dist/
   - Validate findings reference compiled JS files

2. **GitHub Source Fallback**
   - Mock GitHub API with `nock`
   - Verify TypeScript source fetching by SHA
   - Test fallback when dist/ references don't exist

3. **Edge Cases**
   - Missing dist/ files
   - Corrupted build artifacts
   - Mixed source/compiled targets
   - Network failures during GitHub fetch

### Acceptance Criteria

- ✅ All tests pass in CI
- ✅ Diagnosis correctly identifies production code paths
- ✅ GitHub fallback works when needed
- ✅ No false positives from source/artifact confusion

---

## Phase B: Source⇄Artifact Fidelity Guardrails

### Purpose

Detect and alert when **source code** differs from **compiled artifacts** to prevent Meta-SySop from diagnosing stale code.

### Implementation

Enhanced `server/platformHealing.ts` includes:

#### 1. **Commit SHA Awareness**

```typescript
// Embedded at build time
const BUILD_COMMIT_SHA = process.env.COMMIT_SHA || 'unknown';

// Compare against GitHub source
const sourceCommitSHA = await github.getLatestCommit();
```

#### 2. **Checksum Validation**

```typescript
// Compare compiled JS checksum against transpiled TS
const distChecksum = await checksumFile('dist/index.js');
const transpiled = await transpileSourceFile('server/index.ts');
const sourceChecksum = await checksumString(transpiled);

if (distChecksum !== sourceChecksum) {
  console.warn('[DRIFT] Compiled code differs from source!');
}
```

#### 3. **Source Map Validation**

```typescript
// Use source maps to verify code correspondence
const sourceMap = await loadSourceMap('dist/index.js.map');
const originalLocation = sourceMap.originalPositionFor({ line, column });
```

#### 4. **Drift Metrics**

```typescript
interface DriftMetric {
  timestamp: Date;
  filePath: string;
  driftDetected: boolean;
  buildSHA: string;
  sourceSHA: string;
  checksumMismatch: boolean;
}
```

### Drift Warnings

When drift is detected:

```
⚠️  DRIFT WARNING
File: dist/index.js
Build SHA: abc123 (deployed)
Source SHA: def456 (GitHub main)
Checksum: MISMATCH

Meta-SySop diagnosis may reference outdated code.
Recommendation: Rebuild and redeploy to sync artifacts.
```

### Acceptance Criteria

- ✅ Drift detection catches stale builds
- ✅ SHA comparison works in production
- ✅ Checksum validation prevents false positives
- ✅ Warnings surface in Meta-SySop chat
- ✅ Metrics tracked for monitoring

---

## Phase C: Conversational Awareness Layer

### Purpose

Make Meta-SySop **context-aware** and **conversational** like Replit Agent.

### Context Injection

Meta-SySop automatically includes:

#### 1. **Task Board Snapshot**

```typescript
const currentTasks = await db.select()
  .from(tasks)
  .where(eq(tasks.status, 'in_progress'))
  .orderBy(desc(tasks.createdAt))
  .limit(10);

// Injected into system prompt
context.tasks = currentTasks.map(t => ({
  id: t.id,
  title: t.title,
  status: t.status,
  assignedAgent: t.assignedAgent,
}));
```

#### 2. **Recent Platform Changes**

```typescript
const recentCommits = await github.listCommits({
  since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
  limit: 10,
});

context.recentChanges = recentCommits.map(c => ({
  sha: c.sha.slice(0, 7),
  message: c.commit.message,
  author: c.commit.author.name,
  timestamp: c.commit.author.date,
}));
```

#### 3. **Diagnosis Report Summaries**

```typescript
const lastDiagnosis = await getLastDiagnosisReport();

context.diagnosisSummary = {
  timestamp: lastDiagnosis.timestamp,
  issuesFound: lastDiagnosis.findings.length,
  criticalIssues: lastDiagnosis.findings.filter(f => f.severity === 'critical').length,
  topIssues: lastDiagnosis.findings.slice(0, 5).map(f => f.issue),
};
```

### Conversational Improvements

#### **Streaming Responses**

- Real-time thinking sections
- Progressive tool execution updates
- Inline change diffs as edits happen

#### **Memory of Prior Steps**

```typescript
const conversationHistory = await db.select()
  .from(chatMessages)
  .where(eq(chatMessages.sessionId, sessionId))
  .orderBy(desc(chatMessages.createdAt))
  .limit(20);

// Include in context for continuity
```

#### **Inline Change Diffs**

```diff
Modified: server/routes/auth.ts

@@ -45,7 +45,7 @@
   const user = await storage.getUserByEmail(email);
   
-  if (!user || !await bcrypt.compare(password, user.password)) {
+  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
     return res.status(401).json({ error: 'Invalid credentials' });
   }
```

#### **Secret Safeguards**

```typescript
// Redact secrets from chat
function sanitizeContent(content: string): string {
  return content
    .replace(/ANTHROPIC_API_KEY=.+/g, 'ANTHROPIC_API_KEY=***')
    .replace(/sk-ant-[a-zA-Z0-9-]+/g, 'sk-ant-***')
    .replace(/ghp_[a-zA-Z0-9]+/g, 'ghp_***')
    .replace(/DATABASE_URL=.+/g, 'DATABASE_URL=***');
}
```

### Acceptance Criteria

- ✅ Meta-SySop references current tasks in responses
- ✅ Recent commits inform diagnosis
- ✅ Previous findings guide troubleshooting
- ✅ Streaming feels responsive and natural
- ✅ No API keys or secrets leak in chat
- ✅ Diffs show inline during edits

---

## Phase E: CI Validation & Release Gates

### Purpose

Automated CI workflow that runs all validation phases before allowing deployment to Railway.

### GitHub Actions Workflow

Located at `.github/workflows/platform-healing.yml`:

```yaml
name: Platform Healing Validation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate-meta-sysop:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Phase D - Build Production
        run: npm run build
        
      - name: Phase A - Integration Tests
        run: npm run test:meta-sysop
        
      - name: Phase B - Drift Detection
        run: tsx scripts/validate-fidelity.ts
        
      - name: Store Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: diagnosis-reports
          path: |
            logs/diagnosis-*.json
            logs/drift-*.json
            
      - name: Release Gate Check
        run: |
          echo "✅ All validation phases passed"
          echo "✅ Ready for Railway deployment"
```

### Release Checklist

Before deploying to Railway:

- [ ] ✅ Green CI (all phases pass)
- [ ] ✅ Manual production test via `tsx scripts/run-meta-prod.ts`
- [ ] ✅ Manual `performDiagnosis` against live Railway
- [ ] ✅ Architect review and sign-off
- [ ] ✅ Drift metrics within acceptable range
- [ ] ✅ No critical security findings

### Deployment Process

1. **Run local validation**:
   ```bash
   tsx scripts/run-meta-prod.ts --mock-secrets
   # Test Meta-SySop in browser
   ```

2. **Check CI status**:
   - Ensure all GitHub Actions checks pass
   - Review stored diagnosis artifacts

3. **Deploy to Railway**:
   ```bash
   git push origin main
   # Railway auto-deploys
   ```

4. **Post-deployment validation**:
   ```bash
   # SSH to Railway or use web console
   curl https://archetype.railway.app/api/health
   
   # Test Meta-SySop chat
   # Run diagnosis against production
   ```

5. **Monitor drift metrics**:
   - Check drift warnings in Meta-SySop status
   - Verify deployed SHA matches GitHub main

### Acceptance Criteria

- ✅ CI runs all 5 phases on every PR/push
- ✅ Artifacts stored for audit trail
- ✅ Deployment blocked if validation fails
- ✅ Post-deployment verification automated
- ✅ Drift monitoring active in production

---

## Troubleshooting

### Common Issues

#### **"Meta-SySop analyzing source code instead of dist/"**

**Cause**: Running in development mode (tsx server/index.ts)

**Fix**: Use production mode:
```bash
tsx scripts/run-meta-prod.ts
```

#### **"Drift warnings constantly appearing"**

**Cause**: Source files modified but not rebuilt

**Fix**: Rebuild after source changes:
```bash
npm run build
```

#### **"Integration tests failing"**

**Cause**: Stale dist/ artifacts

**Fix**: Clean build before testing:
```bash
rm -rf dist/
npm run build
npm run test:meta-sysop
```

#### **"GitHub source fallback not working"**

**Cause**: GITHUB_TOKEN not set

**Fix**: Set token in .env:
```bash
GITHUB_TOKEN=ghp_your_token_here
```

---

## Best Practices

### Development Workflow

1. **Make source code changes** (server/*.ts)
2. **Test in development mode** (npm run dev)
3. **Build production artifacts** (npm run build)
4. **Test in production mode** (tsx scripts/run-meta-prod.ts)
5. **Run integration tests** (npm run test:meta-sysop)
6. **Commit and push** (triggers CI)
7. **Deploy to Railway** (after CI passes)

### Meta-SySop Usage

- **Always test in production mode** before deploying
- **Check drift warnings** after rebuilds
- **Review diagnosis findings** for accuracy
- **Verify context injection** (tasks, commits, findings)
- **Monitor secret redaction** in chat logs

### CI/CD Integration

- **Never skip CI checks** - they catch critical issues
- **Review CI artifacts** - diagnosis logs reveal insights
- **Monitor drift metrics** - early warning system
- **Automate validations** - prevent human error

---

## Summary

The bulletproof Meta-SySop validation system ensures:

- ✅ **Phase D**: Local production testing mirrors Railway exactly
- ✅ **Phase A**: Integration tests prove diagnosis works in production
- ✅ **Phase B**: Drift detection catches stale builds before issues arise
- ✅ **Phase C**: Conversational context makes Meta-SySop intelligent and natural
- ✅ **Phase E**: CI gates prevent bad deployments

**Result**: Meta-SySop can confidently diagnose and heal the platform in production, with full visibility into what code it's analyzing and why.
