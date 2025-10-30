# Multi-Project Architecture for Meta-SySop

**Version:** 1.0  
**Date:** October 30, 2025  
**Status:** Design Phase - Not Yet Implemented

---

## Executive Summary

This document defines the architecture for enabling Meta-SySop to safely maintain multiple user Replit projects within Archetype. The design ensures complete project isolation, secure GitHub integration, and a seamless user experience for importing and managing external codebases.

**Key Goals:**
- Allow users to import Replit projects (ZIP or GitHub) into Archetype
- Enable Meta-SySop to maintain multiple projects per user with full isolation
- Provide safe workspace switching without cross-contamination
- Integrate with GitHub for version control and auto-deployment
- Support Railway/Vercel deployment pipelines

---

## 1. Database Schema

### 1.1 Workspaces Table

**Purpose:** Registry of external Replit projects imported by users.

```typescript
// shared/schema.ts

export const workspaces = pgTable('workspaces', {
  // Identity
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(), // Owner of this workspace
  
  // Project Metadata
  name: varchar('name').notNull(), // "My Todo App"
  description: text('description'), // Optional project description
  type: varchar('type').default('web'), // 'web' | 'api' | 'fullstack' | 'game' | 'other'
  framework: varchar('framework'), // 'react' | 'next' | 'express' | 'vue' | etc.
  
  // GitHub Integration
  githubRepo: varchar('github_repo'), // "username/repo-name"
  githubBranch: varchar('github_branch').default('main'),
  githubToken: varchar('github_token'), // Encrypted OAuth token
  lastSyncedCommit: varchar('last_synced_commit'), // SHA of last sync
  
  // File System
  rootPath: varchar('root_path').notNull(), // "/workspaces/{workspace-id}"
  fileCount: integer('file_count').default(0),
  totalSize: bigint('total_size').default(0), // Bytes
  
  // Deployment
  deploymentProvider: varchar('deployment_provider'), // 'railway' | 'vercel' | 'render' | null
  deploymentUrl: varchar('deployment_url'), // Live URL if deployed
  deploymentConfig: jsonb('deployment_config'), // Provider-specific settings
  
  // Status
  isActive: boolean('is_active').default(false), // Currently selected workspace
  status: varchar('status').default('imported'), // 'importing' | 'imported' | 'analyzing' | 'ready' | 'error'
  healthScore: integer('health_score').default(100), // 0-100 platform health
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at'), // Track usage
}, (table) => [
  index('idx_workspaces_user_id').on(table.userId),
  index('idx_workspaces_status').on(table.status),
  index('idx_workspaces_active').on(table.isActive),
]);

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  userId: true, // Server-injected from auth session
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;
```

### 1.2 Workspace Files Table

**Purpose:** Track files within imported workspaces (separate from Archetype-native projects).

```typescript
export const workspaceFiles = pgTable('workspace_files', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar('workspace_id').notNull(), // References workspaces.id
  
  // File Metadata
  filename: text('filename').notNull(),
  path: text('path').notNull(), // Relative path from workspace root
  fullPath: text('full_path').notNull(), // Absolute path on filesystem
  content: text('content'), // Optional - may be lazy-loaded
  size: integer('size').default(0), // Bytes
  
  // File Type
  language: varchar('language'), // 'javascript' | 'typescript' | 'python' | etc.
  mimeType: varchar('mime_type'),
  
  // Metadata
  isGenerated: boolean('is_generated').default(false), // Created by Meta-SySop
  lastModifiedBy: varchar('last_modified_by'), // 'user' | 'meta-sysop' | 'import'
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_workspace_files_workspace_id').on(table.workspaceId),
  index('idx_workspace_files_path').on(table.path),
]);

export const insertWorkspaceFileSchema = createInsertSchema(workspaceFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkspaceFile = z.infer<typeof insertWorkspaceFileSchema>;
export type WorkspaceFile = typeof workspaceFiles.$inferSelect;
```

### 1.3 Workspace Activity Log

**Purpose:** Audit trail for all Meta-SySop operations on workspaces.

```typescript
export const workspaceActivity = pgTable('workspace_activity', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar('workspace_id').notNull(),
  userId: varchar('user_id').notNull(),
  
  // Activity Details
  type: varchar('type').notNull(), // 'import' | 'file_modified' | 'deploy' | 'commit' | 'analyze'
  action: text('action').notNull(), // Human-readable description
  actor: varchar('actor').default('user'), // 'user' | 'meta-sysop' | 'system'
  
  // Metadata
  metadata: jsonb('metadata'), // Type-specific data
  success: boolean('success').default(true),
  error: text('error'), // Error message if failed
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_workspace_activity_workspace_id').on(table.workspaceId),
  index('idx_workspace_activity_user_id').on(table.userId),
  index('idx_workspace_activity_type').on(table.type),
]);
```

### 1.4 Schema Migration Notes

**Relationship to Existing Tables:**
- `projects` table remains for Archetype-native projects created in the builder
- `workspaces` table is for external Replit projects imported by users
- `files` table links to `projects`; `workspace_files` links to `workspaces`
- `commands` and `chatMessages` can reference either `projectId` or `workspaceId`

**Migration Strategy:**
1. Add new tables without modifying existing schema
2. Add nullable `workspaceId` column to `commands`, `chatMessages`, `sysopTasks`
3. Update Meta-SySop logic to check workspace context
4. Maintain backward compatibility with existing projects

---

## 2. Project Isolation Architecture

### 2.1 File System Isolation

**Directory Structure:**

```
/home/runner/workspace/          # Archetype platform (current behavior)
├── server/
├── client/
├── shared/
└── ...

/workspaces/                     # NEW: Isolated workspace root
├── {workspace-id-1}/            # User A's Todo App
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── ...
├── {workspace-id-2}/            # User A's Portfolio Site
│   ├── index.html
│   ├── styles/
│   └── ...
└── {workspace-id-3}/            # User B's E-commerce App
    ├── server.js
    ├── views/
    └── ...
```

**Isolation Rules:**
1. **One Active Workspace Per User Session**
   - User can only interact with one workspace at a time
   - `isActive: true` flag ensures single active workspace per user
   - Switching workspaces requires explicit user action

2. **File System Boundaries**
   - Meta-SySop file operations restricted to `/workspaces/{active-workspace-id}/`
   - Read/write operations validate workspace ownership via `userId`
   - No cross-workspace file access (enforced at API level)

3. **Process Isolation** (Future Enhancement)
   - Each workspace could run in isolated container/VM
   - Separate Node.js process per workspace for preview
   - Memory/CPU limits per workspace

### 2.2 Meta-SySop Context Switching

**Workspace Context Manager:**

```typescript
// server/services/workspace-context.ts

class WorkspaceContextManager {
  private activeWorkspaces: Map<string, string> = new Map(); // userId → workspaceId
  
  async setActiveWorkspace(userId: string, workspaceId: string): Promise<void> {
    // Validate ownership
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId)
      )
    });
    
    if (!workspace) throw new Error('Workspace not found or unauthorized');
    
    // Deactivate all other workspaces for this user
    await db.update(workspaces)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(workspaces.userId, userId));
    
    // Activate selected workspace
    await db.update(workspaces)
      .set({ isActive: true, lastAccessedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
    
    this.activeWorkspaces.set(userId, workspaceId);
  }
  
  getActiveWorkspace(userId: string): string | null {
    return this.activeWorkspaces.get(userId) || null;
  }
  
  getWorkspacePath(workspaceId: string): string {
    return path.join(process.cwd(), 'workspaces', workspaceId);
  }
}
```

**Meta-SySop Tool Modifications:**

All Meta-SySop file operations must check workspace context:

```typescript
// Before: Operates on platform files
async function readFile(filePath: string) {
  const fullPath = path.join(process.cwd(), filePath);
  // ...
}

// After: Operates on workspace files
async function readFile(filePath: string, userId: string) {
  const workspaceId = workspaceContext.getActiveWorkspace(userId);
  
  if (workspaceId) {
    // User is in workspace mode - read from workspace
    const workspacePath = workspaceContext.getWorkspacePath(workspaceId);
    const fullPath = path.join(workspacePath, filePath);
    // ... validate path is within workspace boundary
  } else {
    // User is in platform mode - read from Archetype codebase
    const fullPath = path.join(process.cwd(), filePath);
    // ... existing platform healing logic
  }
}
```

### 2.3 Security Model

**Access Control Matrix:**

| Operation | Platform Mode | Workspace Mode |
|-----------|--------------|----------------|
| Read platform files | Owner only | No access |
| Write platform files | Owner only | No access |
| Commit to Archetype repo | Owner only | No access |
| Read workspace files | No access | Workspace owner only |
| Write workspace files | No access | Workspace owner only |
| Commit to workspace repo | No access | Workspace owner only |
| Switch between modes | Owner can do both | Regular users workspace-only |

**Validation Rules:**
1. Every file operation validates workspace ownership: `workspace.userId === session.userId`
2. File paths sanitized to prevent directory traversal: `../../etc/passwd` blocked
3. Rate limiting: Max 100 file operations per minute per workspace
4. Audit logging: All workspace modifications logged to `workspace_activity`

---

## 3. GitHub Integration

### 3.1 Import from GitHub

**User Flow:**
1. User clicks "Import Replit Project"
2. Provides GitHub repository URL: `https://github.com/username/my-replit-project`
3. Optionally provides Personal Access Token (or uses OAuth)
4. System clones repository to `/workspaces/{new-workspace-id}/`
5. Analyzes project structure (package.json, framework detection)
6. Creates workspace record in database
7. Displays workspace dashboard

**Implementation:**

```typescript
// server/routes/workspace.ts

router.post('/api/workspaces/import-github', async (req, res) => {
  const { githubUrl, githubToken, name } = req.body;
  const userId = req.user!.id;
  
  // Parse GitHub URL
  const repoInfo = parseGitHubUrl(githubUrl); // { owner, repo, branch }
  
  // Create workspace record
  const workspace = await db.insert(workspaces).values({
    userId,
    name: name || repoInfo.repo,
    githubRepo: `${repoInfo.owner}/${repoInfo.repo}`,
    githubBranch: repoInfo.branch || 'main',
    githubToken: githubToken ? encrypt(githubToken) : null,
    rootPath: `/workspaces/${workspaceId}`,
    status: 'importing',
  }).returning();
  
  // Clone repository (async job)
  await cloneRepository({
    url: githubUrl,
    token: githubToken,
    destinationPath: `/workspaces/${workspace.id}`,
    workspaceId: workspace.id,
  });
  
  res.json({ workspace });
});
```

### 3.2 Import from ZIP Upload

**User Flow:**
1. User uploads Replit project ZIP file
2. System validates ZIP contents (max 100MB, safe file types)
3. Extracts to `/workspaces/{new-workspace-id}/`
4. Scans for package.json, requirements.txt, etc.
5. Creates workspace record
6. Optional: Prompts user to connect to GitHub for version control

**Validation Checks:**
- File size limit: 100MB max
- Blocked file types: `.exe`, `.dll`, `.so` (executables)
- Max file count: 10,000 files
- Malware scanning: ClamAV or similar (future enhancement)

### 3.3 Auto-Commit Workflow

**Meta-SySop Commit Strategy:**

When Meta-SySop modifies workspace files:

```typescript
// server/services/workspace-git.ts

async function commitWorkspaceChanges(
  workspaceId: string,
  files: Array<{ path: string; operation: 'create' | 'modify' | 'delete' }>,
  commitMessage: string
) {
  const workspace = await getWorkspace(workspaceId);
  const workspacePath = `/workspaces/${workspaceId}`;
  
  // Stage files
  for (const file of files) {
    if (file.operation === 'delete') {
      await git.rm(path.join(workspacePath, file.path));
    } else {
      await git.add(path.join(workspacePath, file.path));
    }
  }
  
  // Commit with Meta-SySop signature
  await git.commit({
    message: commitMessage,
    author: {
      name: 'Meta-SySop',
      email: 'meta-sysop@archetype.dev',
    },
  });
  
  // Push to GitHub (if configured)
  if (workspace.githubRepo && workspace.githubToken) {
    await git.push({
      remote: 'origin',
      branch: workspace.githubBranch,
      token: decrypt(workspace.githubToken),
    });
  }
  
  // Log activity
  await logWorkspaceActivity({
    workspaceId,
    type: 'commit',
    action: `Meta-SySop committed ${files.length} file(s): ${commitMessage}`,
    actor: 'meta-sysop',
  });
}
```

### 3.4 Deployment Integration

**Railway/Vercel Auto-Deploy:**

```typescript
// server/services/workspace-deploy.ts

async function deployWorkspace(workspaceId: string) {
  const workspace = await getWorkspace(workspaceId);
  
  if (workspace.deploymentProvider === 'railway') {
    // Trigger Railway deployment via API
    const deploymentUrl = await railwayDeploy({
      projectId: workspace.deploymentConfig.projectId,
      repoUrl: `https://github.com/${workspace.githubRepo}`,
      branch: workspace.githubBranch,
    });
    
    await db.update(workspaces)
      .set({ deploymentUrl, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  }
  
  if (workspace.deploymentProvider === 'vercel') {
    // Trigger Vercel deployment via API
    const deploymentUrl = await vercelDeploy({
      projectName: workspace.name,
      gitUrl: `https://github.com/${workspace.githubRepo}`,
      branch: workspace.githubBranch,
    });
    
    await db.update(workspaces)
      .set({ deploymentUrl, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  }
}
```

**Deployment Triggers:**
- Manual: User clicks "Deploy" button
- Automatic: After Meta-SySop commits to `main` branch (configurable)
- Webhook: GitHub push event triggers deployment

---

## 4. Safe Upload Flow

### 4.1 ZIP Upload Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: User Uploads ZIP                                        │
│ - Multer file upload to /tmp/uploads/{upload-id}.zip            │
│ - Max size: 100MB                                               │
│ - Accepted types: .zip                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Validation & Scanning                                   │
│ - Check ZIP integrity (not corrupted)                           │
│ - Scan for malicious files (executable detection)               │
│ - Count files (max 10,000)                                      │
│ - Calculate total size (max 100MB uncompressed)                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Create Workspace Record                                 │
│ - Insert into workspaces table                                  │
│ - status: 'importing'                                           │
│ - Generate workspace ID                                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Extract to Isolated Directory                           │
│ - Create /workspaces/{workspace-id}/                            │
│ - Extract ZIP contents to workspace directory                   │
│ - Preserve file permissions (safe defaults only)                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Meta-SySop Analysis (Optional)                          │
│ - Detect framework: React, Next.js, Express, etc.               │
│ - Identify package manager: npm, yarn, pnpm                     │
│ - Check for config files: package.json, .env.example            │
│ - Generate initial health report                                │
│ - Update workspace.status: 'ready'                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: User Confirmation                                       │
│ - Display workspace dashboard                                   │
│ - Show detected framework, file count, size                     │
│ - Prompt: "Connect to GitHub?" (optional)                       │
│ - Prompt: "Run Meta-SySop health check?" (optional)             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Error Handling

**Validation Failures:**

| Error Type | User Message | Recovery |
|------------|-------------|----------|
| File too large | "ZIP must be under 100MB" | Reduce project size or use GitHub import |
| Too many files | "Project has 15,000 files (limit: 10,000)" | Use GitHub import for large projects |
| Corrupted ZIP | "Unable to extract ZIP file" | Re-upload or try different compression tool |
| Malicious content | "Security scan detected unsafe files" | Remove executables and retry |
| Duplicate name | "Workspace 'My App' already exists" | Choose different name or delete old workspace |

**Cleanup on Failure:**
- Delete partial workspace directory: `rm -rf /workspaces/{workspace-id}`
- Delete database record: `DELETE FROM workspaces WHERE id = ?`
- Clean up temp upload: `rm /tmp/uploads/{upload-id}.zip`

---

## 5. UI/UX Design

### 5.1 Workspace Selector (Header)

**Location:** Top navigation bar, next to project selector

**Design:**

```
┌─────────────────────────────────────────────────────────────┐
│ Archetype Logo  [Platform ▼] [My Todo App ▼]  User Menu    │
│                  (Mode)       (Workspace)                    │
└─────────────────────────────────────────────────────────────┘
```

**Dropdown Menu:**

```
┌─────────────────────────────────────────────────────┐
│ 📁 My Todo App (Active)                         ✓   │
│ 📁 Portfolio Website                                │
│ 📁 E-commerce Store                                 │
├─────────────────────────────────────────────────────┤
│ + Import Replit Project                             │
│ ⚙️  Manage Workspaces                               │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Clicking workspace name switches active workspace
- Green checkmark indicates current selection
- "Import Replit Project" opens import dialog
- "Manage Workspaces" navigates to `/workspaces` dashboard

### 5.2 Import Dialog

**Modal Design:**

```
┌───────────────────────────────────────────────────────────┐
│ Import Replit Project                               ✕    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ Choose import method:                                     │
│                                                           │
│ ┌─────────────────────┐  ┌─────────────────────┐        │
│ │  📁 Upload ZIP      │  │  🔗 Clone from      │        │
│ │                     │  │     GitHub          │        │
│ │  Drag & drop or     │  │                     │        │
│ │  click to browse    │  │  Connect repository │        │
│ └─────────────────────┘  └─────────────────────┘        │
│                                                           │
│ ┌─ Project Details ────────────────────────────────┐    │
│ │ Name: [My Replit Project          ]              │    │
│ │ Description: [Optional...          ]              │    │
│ └──────────────────────────────────────────────────┘    │
│                                                           │
│              [Cancel]  [Import Project]                  │
└───────────────────────────────────────────────────────────┘
```

**GitHub Clone Flow:**

```
┌───────────────────────────────────────────────────────────┐
│ Clone from GitHub                                   ✕    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ Repository URL:                                           │
│ [https://github.com/username/my-project              ]   │
│                                                           │
│ Branch (optional):                                        │
│ [main                                                ]   │
│                                                           │
│ Authentication:                                           │
│ ○ Public repository (no token needed)                    │
│ ● Private repository                                     │
│   Personal Access Token: [ghp_••••••••••••••••••    ]   │
│   [How to create a token?]                               │
│                                                           │
│              [Cancel]  [Clone Repository]                │
└───────────────────────────────────────────────────────────┘
```

### 5.3 Multi-Workspace Dashboard

**Route:** `/workspaces`

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ My Workspaces                            [+ Import Project] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 📁 My Todo App                            ✓ Active   │   │
│ │ React • 42 files • 2.3 MB                            │   │
│ │ Last modified: 2 hours ago by Meta-SySop             │   │
│ │ [Open] [Settings] [Deploy]                           │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 📁 Portfolio Website                                 │   │
│ │ Next.js • 87 files • 5.1 MB                          │   │
│ │ Last modified: 1 day ago by You                      │   │
│ │ [Open] [Settings] [Deploy]                           │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 📁 E-commerce Store                                  │   │
│ │ Express.js • 134 files • 12.8 MB                     │   │
│ │ GitHub: connected • Railway: deployed                │   │
│ │ Last modified: 3 days ago by Meta-SySop              │   │
│ │ [Open] [Settings] [Deploy]                           │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Card Features:**
- **Status Indicator:** Green checkmark for active workspace
- **Metadata:** Framework, file count, total size
- **Activity:** Last modification timestamp and actor (user/Meta-SySop)
- **Integrations:** GitHub connection status, deployment status
- **Actions:**
  - "Open" → Switch to this workspace and navigate to builder
  - "Settings" → Configure GitHub, deployment, permissions
  - "Deploy" → Trigger deployment to Railway/Vercel

### 5.4 Workspace Settings Panel

**Route:** `/workspaces/{id}/settings`

**Tabs:**

1. **General**
   - Name, description
   - Framework detection (read-only)
   - Delete workspace (with confirmation)

2. **GitHub Integration**
   - Repository URL (read-only if imported from GitHub)
   - Branch selection
   - Personal Access Token update
   - Sync status (last commit, last sync time)
   - [Sync Now] button

3. **Deployment**
   - Provider selection: Railway, Vercel, None
   - Configuration (API keys, project ID)
   - Auto-deploy on commit (toggle)
   - Deployment history

4. **Meta-SySop**
   - Autonomy level for this workspace
   - Auto-commit toggle
   - Auto-deploy toggle
   - Activity log (recent actions by Meta-SySop)

---

## 6. Implementation Plan

### Phase 1: Database Foundation (Week 1)
**Goal:** Establish workspace registry and file tracking

- [ ] Create `workspaces` table schema
- [ ] Create `workspace_files` table schema
- [ ] Create `workspace_activity` table schema
- [ ] Add nullable `workspaceId` to `commands`, `chatMessages`, `sysopTasks`
- [ ] Run database migration: `npm run db:push`
- [ ] Write seed script for test workspaces

### Phase 2: File System Setup (Week 1-2)
**Goal:** Implement isolated workspace directories

- [ ] Create `/workspaces/` root directory
- [ ] Implement `WorkspaceContextManager` service
- [ ] Add workspace path validation middleware
- [ ] Implement file operation wrappers (read, write, delete)
- [ ] Add directory traversal protection
- [ ] Write unit tests for path validation

### Phase 3: Import Functionality (Week 2-3)
**Goal:** Enable ZIP upload and GitHub cloning

- [ ] Implement ZIP upload endpoint (`POST /api/workspaces/import-zip`)
- [ ] Add file validation (size, count, type checking)
- [ ] Implement ZIP extraction to workspace directory
- [ ] Implement GitHub cloning endpoint (`POST /api/workspaces/import-github`)
- [ ] Add OAuth integration for GitHub (optional)
- [ ] Add framework detection (package.json, requirements.txt parsing)
- [ ] Write integration tests for import flow

### Phase 4: GitHub Integration (Week 3-4)
**Goal:** Enable version control for workspaces

- [ ] Implement `WorkspaceGitService` for commits
- [ ] Add git push functionality with token encryption
- [ ] Create commit endpoint (`POST /api/workspaces/{id}/commit`)
- [ ] Implement sync endpoint (`POST /api/workspaces/{id}/sync`)
- [ ] Add webhook handler for GitHub push events
- [ ] Test auto-commit workflow with Meta-SySop

### Phase 5: Deployment Integration (Week 4-5)
**Goal:** Connect workspaces to Railway/Vercel

- [ ] Implement Railway deployment API client
- [ ] Implement Vercel deployment API client
- [ ] Create deployment endpoint (`POST /api/workspaces/{id}/deploy`)
- [ ] Add deployment status polling
- [ ] Implement auto-deploy on commit (configurable)
- [ ] Add deployment logs viewer

### Phase 6: UI Components (Week 5-6)
**Goal:** Build user-facing workspace management

- [ ] Create workspace selector dropdown (header component)
- [ ] Build import dialog (modal component)
- [ ] Implement multi-workspace dashboard page (`/workspaces`)
- [ ] Create workspace settings panel (`/workspaces/{id}/settings`)
- [ ] Add workspace activity log component
- [ ] Implement workspace switching with loading states
- [ ] Add mobile-responsive layouts

### Phase 7: Meta-SySop Integration (Week 6-7)
**Goal:** Enable Meta-SySop to work on workspaces

- [ ] Update Meta-SySop file tools to check workspace context
- [ ] Add workspace mode toggle in Meta-SySop chat
- [ ] Implement workspace-aware commit functionality
- [ ] Add workspace health diagnostics
- [ ] Create workspace-specific prompt enhancements
- [ ] Test Meta-SySop maintaining multiple workspaces
- [ ] Add safety checks (no cross-workspace access)

### Phase 8: Security & Testing (Week 7-8)
**Goal:** Ensure production-ready security

- [ ] Implement rate limiting per workspace
- [ ] Add comprehensive audit logging
- [ ] Test file path validation edge cases
- [ ] Test concurrent workspace access
- [ ] Security audit: penetration testing for directory traversal
- [ ] Load testing: 100+ workspaces per user
- [ ] Write end-to-end tests for full workflow

### Phase 9: Documentation & Launch (Week 8)
**Goal:** Prepare for production release

- [ ] Write user documentation (how to import projects)
- [ ] Create video tutorial for workspace management
- [ ] Update replit.md with workspace architecture
- [ ] Add workspace limits to pricing tiers
- [ ] Prepare marketing materials
- [ ] Soft launch to beta users
- [ ] Monitor usage and gather feedback

---

## 7. Security Considerations

### 7.1 Authentication & Authorization

**Workspace Ownership:**
- Every workspace MUST have a `userId` owner
- Only workspace owner can:
  - View workspace files
  - Modify workspace files
  - Delete workspace
  - Configure GitHub/deployment settings
  - Trigger Meta-SySop actions on workspace

**Validation Flow:**

```typescript
async function validateWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requiredPermission: 'read' | 'write' | 'delete'
): Promise<boolean> {
  const workspace = await db.query.workspaces.findFirst({
    where: and(
      eq(workspaces.id, workspaceId),
      eq(workspaces.userId, userId)
    )
  });
  
  if (!workspace) {
    throw new Error('Workspace not found or unauthorized');
  }
  
  // Future: Add team collaboration with role-based permissions
  // if (workspace.teamId) { ... check team member role ... }
  
  return true;
}
```

### 7.2 File System Security

**Path Traversal Prevention:**

```typescript
function validateWorkspacePath(workspaceId: string, requestedPath: string): string {
  const workspaceRoot = path.join(process.cwd(), 'workspaces', workspaceId);
  const fullPath = path.join(workspaceRoot, requestedPath);
  
  // Prevent directory traversal: ../../etc/passwd
  const normalizedPath = path.normalize(fullPath);
  if (!normalizedPath.startsWith(workspaceRoot)) {
    throw new Error('Invalid file path: directory traversal detected');
  }
  
  // Prevent symlink attacks
  const realPath = fs.realpathSync(normalizedPath);
  if (!realPath.startsWith(workspaceRoot)) {
    throw new Error('Invalid file path: symlink outside workspace');
  }
  
  return normalizedPath;
}
```

**Blocked File Operations:**
- Writing to `node_modules/` (install via package.json only)
- Creating files with dangerous extensions: `.exe`, `.dll`, `.so`, `.sh` (unless explicitly allowed)
- Modifying git internals: `.git/config`, `.git/hooks/`

### 7.3 Rate Limiting

**Per-Workspace Limits:**

| Operation | Free Tier | Pro Tier | Enterprise |
|-----------|-----------|----------|------------|
| File reads/min | 100 | 500 | Unlimited |
| File writes/min | 50 | 200 | Unlimited |
| Commits/hour | 10 | 50 | Unlimited |
| Deployments/day | 5 | 20 | Unlimited |
| Active workspaces | 3 | 10 | 50 |

**Enforcement:**

```typescript
const rateLimiter = new RateLimiter({
  keyGenerator: (req) => `workspace:${req.params.workspaceId}:${req.user.id}`,
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    const plan = req.user.subscription.plan;
    if (plan === 'pro') return 200;
    if (plan === 'enterprise') return 999999;
    return 50; // free tier
  },
});

router.post('/api/workspaces/:id/files', rateLimiter, async (req, res) => {
  // File write operation
});
```

### 7.4 Audit Logging

**All workspace operations logged:**

```typescript
async function logWorkspaceActivity(activity: {
  workspaceId: string;
  userId: string;
  type: 'import' | 'file_modified' | 'commit' | 'deploy' | 'delete';
  action: string;
  actor: 'user' | 'meta-sysop' | 'system';
  metadata?: any;
  success: boolean;
  error?: string;
}) {
  await db.insert(workspaceActivity).values({
    ...activity,
    createdAt: new Date(),
  });
  
  // Also log to external audit system (Datadog, Loggly, etc.)
  auditLogger.info('workspace_activity', activity);
}
```

**Retention Policy:**
- Activity logs retained for 90 days (free tier)
- Activity logs retained for 1 year (pro tier)
- Activity logs retained indefinitely (enterprise tier)

---

## 8. Migration from Single-Project to Multi-Workspace

### 8.1 Backward Compatibility

**Existing Behavior:**
- Current users have projects in `projects` table
- Files stored in `files` table
- Meta-SySop operates on platform files only

**New Behavior:**
- `projects` table remains for Archetype-native projects
- New `workspaces` table for imported Replit projects
- Meta-SySop can operate in two modes:
  1. **Platform Mode:** Modify Archetype platform (existing behavior)
  2. **Workspace Mode:** Modify active workspace (new behavior)

### 8.2 Data Migration

**No migration needed** - workspaces are additive:

1. Existing `projects` continue to work as before
2. New `workspaces` table is independent
3. Users can create both native projects and imported workspaces
4. Meta-SySop detects context from active workspace selection

### 8.3 Feature Flags

**Gradual Rollout:**

```typescript
// Feature flag system
const WORKSPACE_FEATURE_ENABLED = process.env.ENABLE_WORKSPACES === 'true';

// UI conditionally shows "Import Project" button
{WORKSPACE_FEATURE_ENABLED && (
  <Button onClick={openImportDialog}>Import Replit Project</Button>
)}

// API routes conditionally enabled
if (WORKSPACE_FEATURE_ENABLED) {
  router.post('/api/workspaces/import-zip', handleZipImport);
  router.post('/api/workspaces/import-github', handleGitHubClone);
}
```

**Rollout Plan:**
1. Week 1-7: Development with feature flag disabled in production
2. Week 8: Enable for internal testing (owner accounts only)
3. Week 9: Beta release to select Pro users
4. Week 10: Full release to all users

---

## 9. Future Enhancements

### 9.1 Team Collaboration

**Shared Workspaces:**
- Multiple users can access same workspace
- Role-based permissions: Owner, Editor, Viewer
- Real-time collaboration (OT/CRDT for concurrent editing)
- Comment threads on specific files

### 9.2 Workspace Templates

**One-Click Deployment:**
- User exports workspace as template
- Template marketplace for common setups
- "Deploy my Replit project to Railway" templates
- Pre-configured GitHub Actions for CI/CD

### 9.3 Advanced Meta-SySop Features

**Cross-Workspace Learning:**
- Meta-SySop learns common patterns across user's workspaces
- Suggests refactoring based on best practices from other projects
- Detects duplicated code across workspaces

**Workspace Health Monitoring:**
- Continuous dependency scanning (npm audit)
- Security vulnerability alerts
- Performance profiling (bundle size, load time)
- Automated optimization suggestions

### 9.4 Multi-Language Support

**Beyond JavaScript:**
- Python workspaces (Flask, Django, FastAPI)
- Ruby workspaces (Rails, Sinatra)
- Go workspaces
- Rust workspaces

### 9.5 Containerization

**Docker Integration:**
- Generate Dockerfile for each workspace
- One-click container deployment
- Local Docker Compose for development
- Kubernetes manifests for production

---

## 10. Success Metrics

### 10.1 Launch Goals (Month 1)

- [ ] 100+ workspaces imported by users
- [ ] 80% successful import rate (ZIP + GitHub combined)
- [ ] 50+ Meta-SySop commits to workspaces
- [ ] 20+ successful deployments to Railway/Vercel
- [ ] Zero security incidents (directory traversal, unauthorized access)

### 10.2 Growth Goals (Quarter 1)

- [ ] 1,000+ total workspaces
- [ ] 500+ active workspaces (accessed in last 30 days)
- [ ] 90% user satisfaction (post-import survey)
- [ ] 30% of Pro users using workspace feature
- [ ] Average 3 workspaces per active user

### 10.3 Key Performance Indicators

**Reliability:**
- Import success rate > 95%
- Zero data loss incidents
- Uptime > 99.9%

**Performance:**
- ZIP extraction < 5 seconds for average project (2MB)
- GitHub clone < 10 seconds for average repo
- Workspace switching < 500ms

**Security:**
- Zero unauthorized access incidents
- 100% of file operations logged
- All GitHub tokens encrypted at rest

---

## Conclusion

This multi-project architecture enables Archetype users to safely import and maintain their Replit projects using Meta-SySop, while maintaining complete isolation and security. The phased implementation plan ensures robust testing and gradual rollout.

**Next Steps:**
1. Review this document with engineering team
2. Finalize database schema (Phase 1)
3. Create detailed implementation tickets
4. Begin development of Phase 1 (Week 1)

**Questions or Concerns:**
- Reach out to technical lead before implementation
- All file system operations MUST be reviewed for security
- Test workspace isolation thoroughly before production deployment

---

**Document Status:** ✅ Design Complete - Ready for Review  
**Last Updated:** October 30, 2025  
**Next Review:** Before Phase 1 implementation
