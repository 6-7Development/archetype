# Manual E2E Testing Guide - Post-Modularization Validation

## Overview
This guide provides step-by-step manual testing procedures to validate the LomuAI platform after the major backend/frontend modularization completed on Nov 22, 2025.

## Modularization Summary
- **Backend:** lomuChat.ts (5,020 → 1,063 lines), lomuSuperCore (1,268 → 5 modules)
- **Frontend:** universal-chat.tsx (2,293 → 1,790 lines, 5 extracted components)

---

## Test Suite 1: Authentication & Initial Load

### Test 1.1: Login Flow
**Objective:** Verify authentication works and user can access authenticated areas

**Steps:**
1. Navigate to `http://localhost:5000` or deployed URL
2. Click "Login" or "Sign In" button
3. Complete Replit OAuth flow
4. Verify redirect to authenticated dashboard/workspace

**Expected Results:**
- ✅ Login button visible on homepage
- ✅ OAuth completes successfully
- ✅ User redirected to `/lomu-ai` or main workspace
- ✅ User profile/email displayed in header
- ✅ No console errors during authentication

**Potential Gaps:**
- [ ] Authentication broken after frontend extraction
- [ ] Redirect loops or infinite loading
- [ ] Session persistence issues

---

## Test Suite 2: Chat Interface Components

### Test 2.1: ChatInput Component
**Objective:** Verify extracted ChatInput component renders and functions correctly

**Steps:**
1. Navigate to LomuAI chat page (`/lomu-ai`)
2. Locate chat input textarea
3. Type a test message
4. Click send button
5. Verify message appears in chat history

**Expected Results:**
- ✅ Chat textarea visible and focusable
- ✅ Send button enabled when text entered
- ✅ Keyboard shortcuts work (Enter to send)
- ✅ Input toolbar renders (image upload button)
- ✅ No TypeScript errors in console

**Potential Gaps:**
- [ ] ChatInput component missing props
- [ ] Send button not working
- [ ] Image upload toolbar missing
- [ ] Keyboard shortcuts broken

### Test 2.2: ChatMessages Component
**Objective:** Verify message rendering with all overlays and features

**Steps:**
1. Send a message to LomuAI: "Hello, can you help me?"
2. Wait for assistant response
3. Observe message rendering
4. Check for progress overlays, checkpoints, scratchpad

**Expected Results:**
- ✅ User message displays immediately
- ✅ Assistant message renders with avatar
- ✅ Enhanced message display shows progress blocks
- ✅ If checkpoints exist, they display with:
  - Complexity estimate
  - Cost estimate
  - Planned actions list
- ✅ If scratchpad exists, collapsible preview blocks render
- ✅ Message bubbles have proper styling
- ✅ Timestamps display correctly

**Potential Gaps:**
- [ ] Messages not rendering
- [ ] Missing progress overlays
- [ ] Checkpoint cards missing
- [ ] Scratchpad blocks missing
- [ ] Broken message styling

### Test 2.3: StatusBar Component
**Objective:** Verify status bar displays progress information

**Steps:**
1. Send a message that triggers tool execution
2. Observe status bar during processing
3. Check phase, message, and metrics display

**Expected Results:**
- ✅ Status bar visible during processing
- ✅ Current phase displayed (ASSESS, PLAN, EXECUTE, etc.)
- ✅ Phase message shows current activity
- ✅ Billing metrics display if enabled
- ✅ Progress updates in real-time

**Potential Gaps:**
- [ ] StatusBar not rendering
- [ ] Missing phase information
- [ ] No progress updates

### Test 2.4: ChatDialogs Component
**Objective:** Verify all 10 dialogs render and function correctly

**Dialogs to Test:**
1. **Secrets Request Dialog** - Trigger by using a tool that requires API keys
2. **Billing Approval Dialog** - Trigger by high-cost operation (if enabled)
3. **Complexity Error Dialog** - Trigger by complex task (if applicable)
4. **Deployment Modal** - Trigger by deployment action (if enabled)
5. **Testing Panel** - Trigger by test execution (if enabled)
6. **Artifacts Drawer** - Check if code artifacts display
7. **Cost Preview Dialog** - Check before expensive operations
8. **Scratchpad Drawer** - Expand scratchpad entries
9. **Checkpoint Details** - Click checkpoint card
10. **Session Settings** - Access via settings menu

**Expected Results:**
- ✅ All dialogs render without errors
- ✅ Proper TypeScript types exported
- ✅ Dialog props passed correctly
- ✅ Close/dismiss functions work
- ✅ Submit actions trigger correctly

**Potential Gaps:**
- [ ] Dialogs not rendering
- [ ] TypeScript export errors
- [ ] Props not forwarded correctly
- [ ] Runtime errors when dialogs open

---

## Test Suite 3: SSE Streaming (CRITICAL)

### Test 3.1: Word-by-Word Streaming
**Objective:** Verify SSE streaming works incrementally after lomuChat.ts modularization

**Steps:**
1. Send message: "Write a simple hello world function"
2. Observe assistant response streaming
3. Verify text appears word-by-word, not all at once

**Expected Results:**
- ✅ Response streams word-by-word (like ChatGPT)
- ✅ Streaming indicator visible during generation
- ✅ No buffering (text not appearing all at once)
- ✅ Thinking blocks display when present
- ✅ No SSE connection errors in console

**Potential Gaps:**
- [ ] Buffered streaming (text appears all at once)
- [ ] SSE connection failures
- [ ] Streaming indicator missing
- [ ] Thinking blocks not rendering

### Test 3.2: Tool Execution Streaming
**Objective:** Verify tool calls stream correctly

**Steps:**
1. Send message: "List the files in the current directory"
2. Observe tool execution (bash, ls)
3. Check tool call and result display

**Expected Results:**
- ✅ Tool call displays before execution
- ✅ Tool execution shown in progress
- ✅ Tool results render after completion
- ✅ Color-coded blocks (blue for tool calls, green for results)
- ✅ No errors during tool streaming

**Potential Gaps:**
- [ ] Tool calls not displaying
- [ ] Tool results missing
- [ ] Execution progress not shown
- [ ] Color coding broken

---

## Test Suite 4: WebSocket Functionality

### Test 4.1: Connection Status
**Objective:** Verify WebSocket connection and status indicator

**Steps:**
1. Check header for WebSocket status badge
2. Verify "Connected" or positive state
3. Monitor during file changes

**Expected Results:**
- ✅ WebSocket status visible in header
- ✅ Status shows "Connected"
- ✅ No connection errors in console
- ✅ Real-time updates work

**Potential Gaps:**
- [ ] WebSocket status missing
- [ ] Connection failures
- [ ] No real-time updates

### Test 4.2: File Change Broadcasts
**Objective:** Verify file changes broadcast via WebSocket

**Steps:**
1. Send message that modifies code
2. Check for file change indicators in chat
3. Verify current file status displays

**Expected Results:**
- ✅ File change indicators appear
- ✅ Current file shows: action, filename, language
- ✅ File summary shows: filesChanged, linesAdded, linesRemoved
- ✅ Real-time updates during execution

**Potential Gaps:**
- [ ] File change indicators missing
- [ ] WebSocket not broadcasting changes
- [ ] Summary statistics missing

---

## Test Suite 5: I AM Architect Consultation

### Test 5.1: Architect Mode Toggle
**Objective:** Verify I AM Architect mode works after lomuSuperCore modularization

**Steps:**
1. Locate architect toggle/button in chat interface
2. Enable architect mode
3. Send a consultation request
4. Verify Claude Sonnet 4 responds

**Expected Results:**
- ✅ Architect toggle visible and functional
- ✅ Mode indicator shows architect enabled
- ✅ Architect responses use Claude Sonnet 4
- ✅ Different prompt template applied (from architectPrompt.ts)
- ✅ Tool execution works for architect

**Potential Gaps:**
- [ ] Architect mode broken
- [ ] Wrong prompt template used
- [ ] Tool distribution incorrect (should have 23 tools)
- [ ] Claude Sonnet 4 not initialized

---

## Test Suite 6: Billing & Credits

### Test 6.1: Credit Balance Display
**Objective:** Verify credit balance shows in header

**Steps:**
1. Check header for credit balance display
2. Verify numeric value shown
3. Monitor during LomuAI operations

**Expected Results:**
- ✅ Credit balance visible in header
- ✅ Shows numeric value (e.g., "1,250 credits")
- ✅ Updates after operations
- ✅ No display errors

**Potential Gaps:**
- [ ] Credit balance missing
- [ ] Not updating after operations
- [ ] Display errors

### Test 6.2: Billing Approval Dialogs
**Objective:** Verify approval dialogs for high-cost operations

**Steps:**
1. Trigger high-cost operation (if enabled)
2. Check for approval dialog
3. Verify cost estimate displays
4. Test approve/cancel actions

**Expected Results:**
- ✅ Approval dialog appears for expensive ops
- ✅ Cost estimate shown clearly
- ✅ Approve button works
- ✅ Cancel button works
- ✅ No runtime errors

**Potential Gaps:**
- [ ] Approval dialogs not appearing
- [ ] Cost estimates missing
- [ ] Actions not working

---

## Test Suite 7: Session Persistence

### Test 7.1: Chat History Persistence
**Objective:** Verify chat history persists across page refreshes

**Steps:**
1. Send several messages
2. Refresh the page
3. Verify chat history restores

**Expected Results:**
- ✅ User remains authenticated
- ✅ Chat history fully restored
- ✅ Message order preserved
- ✅ All message features intact (checkpoints, scratchpad, etc.)

**Potential Gaps:**
- [ ] Chat history lost on refresh
- [ ] Authentication lost
- [ ] Messages missing features after reload

---

## Test Suite 8: Performance & Stability

### Test 8.1: Console Error Check
**Objective:** Verify zero runtime errors after modularization

**Steps:**
1. Open browser DevTools console
2. Perform all above test suites
3. Monitor for errors

**Expected Results:**
- ✅ Zero React errors
- ✅ Zero TypeScript runtime errors
- ✅ No "Cannot read property of undefined" errors
- ✅ No missing import/export errors
- ✅ No component rendering errors

**Potential Gaps:**
- [ ] React errors present
- [ ] TypeScript errors
- [ ] Component errors
- [ ] Import/export errors

### Test 8.2: UI Responsiveness
**Objective:** Verify smooth UI performance

**Steps:**
1. Scroll through long chat history
2. Open/close dialogs
3. Type in chat input
4. Monitor UI lag or freezing

**Expected Results:**
- ✅ Smooth scrolling
- ✅ No UI freezing
- ✅ Responsive inputs
- ✅ Fast dialog open/close
- ✅ No layout shifts

**Potential Gaps:**
- [ ] UI lag or stuttering
- [ ] Slow dialog rendering
- [ ] Input delay
- [ ] Layout shifts

---

## Critical Validation Checklist

After completing all test suites, verify:

### Backend Modularization (lomuChat.ts)
- [ ] SSE streaming works word-by-word
- [ ] Tool execution streams correctly
- [ ] Billing settlement happens once (no double-charging)
- [ ] Token management works
- [ ] Approval workflow functions
- [ ] Error cleanup executes

### Backend Modularization (lomuSuperCore)
- [ ] LomuAI prompt builds correctly (from promptBuilder.ts)
- [ ] I AM Architect prompt builds correctly (from architectPrompt.ts)
- [ ] Tool distribution correct (18 for LomuAI, 23 for Architect)
- [ ] Context sections render properly
- [ ] Tooling configuration works

### Frontend Modularization (universal-chat.tsx)
- [ ] useStreamEvents hook handles SSE correctly
- [ ] ChatMessages renders all features:
  - [ ] StatusStrip overlay
  - [ ] RunProgressTable (Kanban view)
  - [ ] AgentProgress fallback
  - [ ] Checkpoint cards
  - [ ] Scratchpad blocks
  - [ ] WebSocket status
  - [ ] Copy chat history button
- [ ] ChatInput handles:
  - [ ] Textarea input
  - [ ] Send button
  - [ ] Image upload toolbar
  - [ ] Upload previews
- [ ] StatusBar displays progress
- [ ] ChatDialogs exports all TypeScript types:
  - [ ] RequiredSecret
  - [ ] SecretsRequest
  - [ ] TestingSession
  - [ ] CostData
  - [ ] DeploymentData

### Integration Validation
- [ ] Zero LSP diagnostics
- [ ] Zero runtime errors in console
- [ ] Application running successfully
- [ ] All workflows functional
- [ ] No missing features after extraction

---

## Identified Workflow Gaps

**Document any gaps found during testing:**

### Gap 1: [Title]
- **Severity:** Critical / High / Medium / Low
- **Description:** 
- **Steps to Reproduce:**
- **Expected Behavior:**
- **Actual Behavior:**
- **Affected Component:**
- **Potential Fix:**

### Gap 2: [Title]
- **Severity:**
- **Description:**
...

---

## Testing Summary

**Date:** Nov 22, 2025  
**Tested By:** [Your Name]  
**Test Duration:** [Time]  
**Total Tests:** 20+  
**Tests Passed:** [Count]  
**Tests Failed:** [Count]  
**Critical Gaps:** [Count]  
**Overall Status:** ✅ PASS / ⚠️ NEEDS WORK / ❌ FAIL

**Conclusion:**
[Summary of findings and recommendations]

---

## Next Steps

1. Execute all test suites manually
2. Document all identified gaps
3. Prioritize fixes by severity
4. Create tickets for each gap
5. Implement fixes
6. Re-test to verify resolutions
