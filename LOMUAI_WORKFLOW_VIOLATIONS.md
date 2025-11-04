# LomuAI Workflow Violations & Issues

## Current Problems

### 1. **Rambling Instead of Executing**
**Issue**: LomuAI talks too much instead of taking action
- Provides lengthy explanations before using tools
- Re-explains what it's about to do multiple times
- Wastes tokens on unnecessary commentary

**Expected Behavior**: 
- Brief acknowledgment of task (1-2 sentences max)
- Immediate tool execution
- Let the tool results speak for themselves

### 2. **Not Following Proper Workflow**
**Issue**: LomuAI skips critical workflow steps

**Proper Agent Workflow** (as defined in replit.md):
```
Assess → Plan (task list) → Execute → Test → Verify → Confirm → Commit (when user approves)
```

**Violations Observed**:
- ❌ Skips planning phase (no task list created)
- ❌ Executes without assessment
- ❌ No testing phase
- ❌ No verification before claiming completion
- ❌ Commits without user approval

### 3. **Token Waste**
**Issue**: Inefficient use of AI tokens

**Problems**:
- Verbose explanations consume input/output tokens unnecessarily
- Re-reading the same context multiple times
- Not using cached system prompts effectively
- Explaining every single tool call

**Impact**:
- Higher costs for users ($0.10/$0.40 per 1M tokens on Gemini)
- Slower response times due to larger payloads
- Context window fills up faster with redundant text

### 4. **Auto-Loading Chat Interference**
**Hypothesis**: The auto-loading chat mechanism may be breaking LomuAI's workflow

**Investigation Needed**:
- Check if chat auto-load interferes with task execution
- Verify if streaming state conflicts with tool execution
- Test if WebSocket events disrupt the agent's flow

## Required Improvements

### System Prompt Modifications

1. **Add Strict Workflow Enforcement**
```
MANDATORY WORKFLOW:
1. Assess - Read relevant files, understand context (silent)
2. Plan - Create task list with write_task_list tool (required for multi-step tasks)
3. Execute - Use tools, write code (minimal commentary)
4. Test - Use run_test tool or manual verification
5. Verify - Check compilation, run workflow, confirm success
6. Confirm - Brief summary of what was done
7. Commit - ONLY when user explicitly approves

VIOLATIONS = FAILURE
```

2. **Enforce Tool-First Communication**
```
COMMUNICATION RULES:
- Default to tool execution over explanation
- One sentence max before tool calls
- Let tool results provide the details
- Only explain if tool execution fails
- No pre-emptive explanations of what tools will do
```

3. **Token Efficiency Guidelines**
```
TOKEN OPTIMIZATION:
- Read files once, cache in memory
- Use grep/search_codebase instead of reading entire files
- Batch related tool calls in parallel
- System prompt should be cached (already implemented)
- Avoid repeating information already visible in tool results
```

### Code Changes Needed

1. **Disable Auto-Loading Chat** (if interfering)
   - Remove auto-load on workspace mount
   - Load chat only when user explicitly opens it
   - Test if this resolves workflow interruptions

2. **Add Workflow State Machine**
   - Track current workflow phase
   - Enforce sequential progression
   - Reject out-of-order actions
   - Log violations for analytics

3. **Response Quality Metrics Enhancement**
   - Add "workflow compliance" metric
   - Detect rambling (high word count, low tool usage)
   - Flag missing task lists
   - Track test execution rate

## Implementation Priority

1. **HIGH**: Fix system prompt to enforce workflow
2. **HIGH**: Add token efficiency guidelines
3. **MEDIUM**: Investigate auto-loading chat interference
4. **MEDIUM**: Add workflow state machine
5. **LOW**: Enhanced quality metrics (already partially implemented)

## Testing Checklist

After implementing fixes:
- [ ] LomuAI creates task list for multi-step tasks
- [ ] LomuAI executes tools immediately without rambling
- [ ] LomuAI tests changes before claiming completion
- [ ] LomuAI verifies TypeScript compilation
- [ ] LomuAI provides brief confirmation (not lengthy explanation)
- [ ] Token usage decreases by >30%
- [ ] Response time improves
- [ ] User satisfaction increases

## References

- **Proper Workflow Definition**: `replit.md` line 64
- **I AM Architect Role**: Enforces workflow when LomuAI violates it
- **AgentFailureDetector**: Already monitors response quality (score < 40/100)
- **System Prompt**: `server/services/lomuJobManager.ts` - needs updates

## Notes

- LomuAI uses Gemini 2.5 Flash (cheap but needs stricter guidance)
- I AM Architect uses Claude Sonnet 4 (expensive but superior reasoning)
- Both agents have identical tools (56 total)
- Goal: Make LomuAI autonomous and efficient like Replit Agent
