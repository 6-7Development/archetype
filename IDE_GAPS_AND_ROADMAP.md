# LomuAI IDE - Complete Gap Analysis & Roadmap

## DISCOVERY: Components Already Built But NOT Integrated

The codebase has MANY components already created but not wired into `universal-chat.tsx`:

### ✅ Already Built (Not Used)
- `monaco-editor.tsx` - Full code editor
- `terminal.tsx` - Terminal with command execution
- `live-preview.tsx` - Live app preview iframe
- `diff-viewer.tsx` - Side-by-side code diffs
- `database-viewer.tsx` - Database schema/data viewer
- `logs-viewer.tsx` - Log file viewer
- `git-panel.tsx` - Git operations UI
- `problems-panel.tsx` - Error/warning list
- `search-panel.tsx` - Code search/find-replace
- `debugger-panel.tsx` - Debugging interface
- `package-manager.tsx` - npm/yarn UI
- `split-editor.tsx` - Split pane editor
- `task-board.tsx` - Task management UI
- `task-timeline.tsx` - Task progress timeline
- `workspace-layout.tsx` - Layout manager
- `deployment-status.tsx` - Deploy tracking
- `environment-editor.tsx` - Env var editor
- `command-palette.tsx` - Command search

## 🔴 CRITICAL GAPS (Must Integrate)

### 1. TAB NAVIGATION BAR - **BLOCKER**
**Status**: ❌ Not integrated
**Issue**: Can't switch between Editor/Preview/Terminal/Files/Database/Logs/Tests/Packages
**Solution**: Create tabs component with:
- Editor (monaco-editor)
- Preview (live-preview) 
- Files (file-browser) ✅ EXISTS
- Terminal (terminal) ✅ EXISTS
- Database (database-viewer) ✅ EXISTS
- Logs (logs-viewer) ✅ EXISTS
- Git (git-panel) ✅ EXISTS
- Search (search-panel) ✅ EXISTS
- Tests (test-runner - missing)
- Packages (package-manager) ✅ EXISTS

**Effort**: 1 turn
**Impact**: Unlocks full IDE workflow

### 2. CODE EDITOR IN CHAT - **HIGH PRIORITY**
**Status**: ❌ Not integrated
**Components**: 
- `monaco-editor.tsx` ✅ EXISTS
- Need to wire to file selection in FileBrowser
**Issue**: Click file → shows content in editor tab
**Effort**: 1 turn
**Impact**: Core IDE functionality

### 3. LIVE PREVIEW - **HIGH PRIORITY**
**Status**: ❌ Not integrated
**Component**: `live-preview.tsx` ✅ EXISTS
**Issue**: No way to see app running at localhost:5000
**Effort**: 1 turn
**Impact**: Real-time feedback on changes

### 4. TERMINAL WITH INPUT - **HIGH PRIORITY**
**Status**: ❌ Input disabled
**Component**: `terminal.tsx` ✅ EXISTS (but read-only in chat)
**Issue**: Can't type commands, run npm install, etc
**Effort**: 1 turn  
**Impact**: Can execute builds, installs, tests

### 5. INLINE CODE DIFFS - **HIGH PRIORITY**
**Status**: ❌ Not integrated
**Component**: `diff-viewer.tsx` ✅ EXISTS
**Issue**: Can't see before/after of Lomu's changes
**Effort**: 1 turn
**Impact**: Verify code quality

## 🟡 IMPORTANT GAPS (Should Integrate)

### 6. ERROR PARSING & CLICKTHROUGH
**Status**: ❌ Not integrated
**Components**: 
- `problems-panel.tsx` ✅ EXISTS
- Need error parser to link errors to source
**Issue**: Build errors show as plain text
**Effort**: 1 turn
**Impact**: Better debugging experience

### 7. DATABASE SCHEMA VIEWER
**Status**: ❌ Not integrated
**Component**: `database-viewer.tsx` ✅ EXISTS
**Issue**: Can't inspect database
**Effort**: 1 turn (if DB connection works)
**Impact**: Data inspection

### 8. WORKFLOW PHASE INDICATOR
**Status**: ⚠️ Partial (shows thinking blocks)
**Issue**: No visual timeline of Lomu's phases (ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT)
**Solution**: Use `task-timeline.tsx` ✅ EXISTS
**Effort**: 1 turn
**Impact**: Show progress

### 9. GIT OPERATIONS UI
**Status**: ❌ Not integrated
**Component**: `git-panel.tsx` ✅ EXISTS
**Issue**: Git status only shows branch, not full git UI
**Effort**: 1 turn
**Impact**: Commit/push/branch management

### 10. PROBLEMS/WARNINGS PANEL
**Status**: ❌ Not integrated
**Component**: `problems-panel.tsx` ✅ EXISTS
**Issue**: No aggregated error list
**Effort**: 1 turn
**Impact**: Error visibility

## 🟢 NICE-TO-HAVE GAPS

### 11. COMMAND PALETTE
**Status**: ❌ Not integrated
**Component**: `command-palette.tsx` ✅ EXISTS
**Issue**: No keyboard shortcut command search
**Effort**: 1 turn

### 12. DEBUGGER PANEL
**Status**: ❌ Not integrated
**Component**: `debugger-panel.tsx` ✅ EXISTS
**Effort**: 2 turns

### 13. TEST RUNNER
**Status**: ❌ Missing component
**Issue**: No tests tab
**Effort**: 1-2 turns to build

## QUICK WIN: What Can Be Done in 1 Turn

✅ **Integrate Terminal Input** - Enable typing in console
✅ **Add Tab Navigation** - Switch between views
✅ **Wire Monaco Editor** - Show/edit files
✅ **Show Live Preview** - iframe of localhost:5000
✅ **Add Diff Viewer** - Side-by-side code comparison

## RECOMMENDED PRIORITY ORDER

1. **Tab Navigation** (1 turn) - Unlocks all tabs
2. **Terminal Input** (1 turn) - Run commands
3. **Monaco Editor** (1 turn) - Edit files
4. **Live Preview** (1 turn) - See app changes
5. **Diff Viewer** (1 turn) - Verify changes
6. **Problems Panel** (1 turn) - Error list
7. **Git Panel** (1 turn) - Git operations
8. **Database Viewer** (1 turn) - Data inspection
9. **Task Timeline** (1 turn) - Progress tracking
10. **Search Panel** (1 turn) - Code search

**Total Effort for Full IDE**: ~10 turns (but many are parallelizable)

## ARCHITECTURE FOR TAB INTEGRATION

Current: `universal-chat.tsx` shows:
- Status bar
- File browser (left sidebar)
- Chat messages + input (center)
- Context rail (right panel)

**Needed**: Add tabs on top of center panel:
```
┌─────────────────────────────────────────────────────┐
│ [Editor] [Preview] [Terminal] [Files] [Database] ... │ ← New tab bar
├─────────────────────────────────────────────────────┤
│                                                       │
│  Selected tab content:                                │
│  - Editor tab: monaco-editor component               │
│  - Preview tab: live-preview iframe                  │
│  - Terminal tab: terminal with input                 │
│  - Database tab: database-viewer                     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## FILES TO MODIFY

1. `client/src/components/universal-chat.tsx` - Add tab state, rendering
2. `client/src/components/file-browser.tsx` - Emit file selection events
3. `client/src/components/terminal.tsx` - Enable input (might already work)
4. `server/routes/project-files.ts` - Add file content endpoint (new)
5. `client/src/components/ide-tabs.tsx` - New component for tab bar

## GAPS IN BACKEND SUPPORT

- ❌ `/api/file/:path` endpoint to get file contents
- ❌ `/api/file/:path` endpoint to save file contents
- ❌ `/api/git/status` to get detailed git info
- ❌ `/api/git/commits` to get commit history
- ❌ `/api/database/schema` to get schema
- ❌ `/api/build/output` to stream build logs
- ❌ `/api/terminal/execute` to run commands (might exist)

## INTEGRATION STRATEGY

**Phase 1 (2 turns)**: Tab bar + Terminal input
**Phase 2 (2 turns)**: Monaco editor + File reading
**Phase 3 (2 turns)**: Live preview + Diffs  
**Phase 4 (2 turns)**: Git + Database + Problems
**Phase 5 (2 turns)**: Search + Debugging

---

## Summary

**Good News**: Most UI components are already built!
**Bad News**: They're not connected to the chat interface
**Solution**: Wire them into `universal-chat.tsx` with a tab system

This is achievable in 8-10 focused turns. Start with the tab bar and terminal input for immediate impact.
