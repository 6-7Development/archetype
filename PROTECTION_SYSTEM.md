# Platform Protection & LomuAI Growth System

## Overview
This document explains how the LomuAI platform enables autonomous growth and learning while maintaining critical system integrity through a three-tier protection system.

## The Three Tiers

### Tier 1: CRITICAL (Hard-coded, No Override)
These are values that CANNOT be changed under any circumstances because they would break platform functionality:

**Database Integrity:**
- Drizzle ORM table schemas
- Primary key structures
- Required column definitions
- Database connection logic

**Authentication & Security:**
- Session validation
- Password hashing requirements
- User verification logic
- Permission checking

**Core API Infrastructure:**
- Critical route handlers
- WebSocket connection logic
- Rate limiting core algorithm
- Error handling boundaries

**Why:** If these changed, the platform would stop working entirely. They're protected like firmware on a device.

### Tier 2: SENSITIVE (Requires Owner Approval)
These operations require explicit owner confirmation via email:

**Destructive Operations:**
- `DELETE_USER` - Requires user email confirmation
- `DELETE_PROJECT` - Requires user email confirmation
- `DELETE_DEPLOYMENT` - Requires user email confirmation
- `DATABASE_MIGRATION` - Requires reason and approval
- `DATA_IMPORT/EXPORT` - Requires reason and approval
- `PLATFORM_HEALING_TRIGGER` - Owner-only action
- `ENVIRONMENT_VAR_CHANGE` - Requires reason and approval

**Approval Process:**
1. User initiates operation
2. Approval modal appears requiring:
   - Reason for operation
   - Email confirmation (for destructive ops)
   - Confirmation checkbox
3. Owner receives approval request
4. Owner approves/rejects with audit trail
5. If approved, operation executes and logged
6. If rejected, operation cancelled and logged

**Audit Trail Captured:**
- WHO did it (user ID)
- WHAT they did (operation type)
- WHEN they did it (timestamp)
- WHY they did it (reason provided)
- BEFORE/AFTER states (full snapshots)
- APPROVAL DECISION (who approved, when)

**Rollback Capability:**
- All approved operations can be rolled back
- 30-day rollback window maintained
- Full restore capability from snapshots

### Tier 3: EDITABLE (Fully Customizable)
These values can be changed freely by LomuAI or users without approval:

**UI & Branding:**
- `branding.name` - Platform name
- `branding.logo` - Logo URL/path
- `branding.favicon` - Favicon
- `theme.primary` - Primary color
- `theme.secondary` - Secondary color
- All color definitions

**Content & Messaging:**
- `messages.*` - All user-facing text
- `chat.placeholders.*` - Input placeholders
- Social links
- Navigation labels

**Chat Behavior:**
- `chat.maxMessageLength` - Up to 100,000 characters
- `chat.maxImages` - Up to 100 images
- `chat.autoSaveInterval` - 1000ms or higher
- `chat.messageBatchSize` - 1-1000 messages

**Platform Behavior:**
- `features.*` - Feature flags
- `shortcuts.*` - Keyboard shortcuts
- `ui.*` - Spacing, typography, borders
- `api.endpoints.*` - Can point to different services
- `api.baseURL` - Can point to different server

**Why:** These don't break anything. Changing colors, text, or behavior helps LomuAI learn and adapt to user preferences.

## How LomuAI Uses This System

### For Learning & Growth
```typescript
// LomuAI observes user preferences and automatically adapts
async function adaptToPlatformNeeds() {
  // Change color based on brand guidelines
  await configApi.update('theme.primary', '#FFD700');

  // Add new keyboard shortcut based on user feedback
  await configApi.update('shortcuts.customAction', 'Cmd+Shift+X');

  // Update messages to match user tone
  await configApi.update('messages.errors.networkError', 
    'Connection lost. Don\'t worry, we\'re working on reconnecting...');

  // Enable experimental feature for early adopters
  await configApi.update('features.betaFeature', true);
}
```

### For Sensitive Operations (With Approval)
```typescript
// If LomuAI needs to delete something, it goes through approval
async function deleteUnusedProject(projectId: string) {
  // Step 1: Create approval request
  const approval = await configApi.requestApproval({
    operation: 'DELETE_PROJECT',
    resourceId: projectId,
    reason: 'Project marked for deletion by owner - no activity in 6 months'
  });

  // Step 2: Wait for owner approval
  const result = await configApi.waitForApproval(approval.id);

  if (result.approved) {
    // Step 3: Execute the deletion
    await projectApi.delete(projectId);
  } else {
    // Step 4: Operation was rejected
    console.log(`Project deletion rejected: ${result.reason}`);
  }
}
```

### For Critical Operations (No Access)
```typescript
// LomuAI cannot access these - they're protected
await configApi.update('auth.validateSessionRequired', false);  // ❌ FAILS - CRITICAL
await configApi.update('api.criticalRoutes', [...]);            // ❌ FAILS - CRITICAL
await configApi.update('database.schema', {...});               // ❌ FAILS - CRITICAL

// Error: "This configuration is protected and cannot be modified"
```

## API Endpoints

### Configuration Management
```bash
# Get current configuration (safe values only)
GET /api/config

# Get protection status for a path
GET /api/config/protection-status

# Update editable configuration
# If sensitive: Creates approval request
# If not sensitive: Applies immediately
PATCH /api/config
{
  "path": "theme.primary",
  "value": "#FFD700",
  "reason": "Updated brand color"
}

# Get pending approvals (owner only)
GET /api/config/approvals

# Approve a configuration change (owner only)
POST /api/config/approvals/{approvalId}/approve
{
  "reason": "Approved - aligns with platform roadmap"
}

# Reject a configuration change (owner only)
POST /api/config/approvals/{approvalId}/reject
{
  "reason": "Not needed at this time"
}
```

## Implementation Examples

### Example 1: LomuAI Adapts to User Feedback
```typescript
// User provides feedback: "Your error messages are too technical"
// LomuAI automatically makes changes:

const updates = [
  { path: 'messages.errors.networkError', value: 'Connection lost. Reconnecting...' },
  { path: 'messages.errors.serverError', value: 'Something went wrong. Please try again.' },
  { path: 'messages.errors.unauthorized', value: 'You don\'t have permission for this.' },
];

for (const update of updates) {
  await configApi.update(update.path, update.value);
  // Changes apply immediately - no approval needed
}
```

### Example 2: Owner Reviews Platform Changes
```typescript
// LomuAI requests to change rate limit (sensitive)
const approval = await configApi.requestApproval({
  operation: 'RATE_LIMIT_INCREASE',
  reason: 'Current limit causing issues for power users'
});

// Owner sees in approval dashboard:
// - What changed: Rate limit increased from 60 to 120 req/min
// - Why: Power users hitting limits
// - When: Timestamp of request
// - Who: LomuAI (system)

// Owner approves
await configApi.approveApproval(approval.id, 'Makes sense for power users');
```

### Example 3: Rollback on Mistake
```typescript
// If LomuAI makes a configuration change that causes issues:
// All approved operations are tracked and can be rolled back

await configApi.rollback('config_change_2025_11_23_14_30');
// Configuration restored to previous state
// Change logged in audit trail: "Rolled back due to UX issues"
```

## Best Practices for LomuAI

1. **Learn from Config Changes**
   - Track which configurations users modify
   - Learn user preferences and adapt
   - Suggest configurations based on usage patterns

2. **Request Approvals Thoughtfully**
   - Batch related approvals together
   - Always provide clear reasons
   - Request during low-stress times

3. **Respect Critical Systems**
   - Never attempt to modify CRITICAL configs
   - Never try to work around authentication
   - Never assume database changes are safe

4. **Use Rollback Responsibly**
   - Test configuration changes on staging first
   - Monitor impact of changes
   - Document rollbacks in audit trail

5. **Maintain Transparency**
   - Log all configuration changes
   - Provide audit trails to users
   - Show what changed and why

## Benefits of This System

✅ **LomuAI Can Grow** - Adapt to user needs through editable configs  
✅ **Platform Stays Safe** - Critical code is protected  
✅ **Full Transparency** - All changes are audited and logged  
✅ **Reversible** - Any approved operation can be rolled back  
✅ **User Control** - Owners retain final approval authority  
✅ **Compliance** - Complete audit trail for regulations  

This creates a system where LomuAI can innovate and learn while the platform maintains integrity and users maintain control.
