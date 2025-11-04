# EnforcementOrchestrator Test Plan

## Overview
Comprehensive test scenarios to verify the 6-layer enforcement system + I AM Architect guidance injection works correctly.

## Test Categories

### 1. Phase Gatekeeper Tests

#### Test 1.1: EXECUTE Phase - Enforce 5-Word Limit Before Tools
**Scenario**: LomuAI tries to explain before using tools in EXECUTE phase

**Expected Behavior**:
- PhaseGatekeeper detects violation
- Quality score drops
- I AM Architect provides guidance
- Guidance injected into conversation

**Test Steps**:
1. Create job with simple fix request
2. Mock LomuAI response with >5 words before tool use
3. Verify violation logged: `Phase validation failed`
4. Verify I AM called: `🚨 Violations detected - calling I AM Architect...`
5. Check conversation history for system message with guidance

#### Test 1.2: PLAN Phase - Missing Task List
**Scenario**: LomuAI skips task list creation in PLAN phase

**Expected Behavior**:
- PhaseGatekeeper blocks transition to EXECUTE
- Mandatory task list violation logged
- I AM Architect guidance injected

**Test Steps**:
1. Create job requiring multi-step work
2. Mock LomuAI attempting EXECUTE without PLAN
3. Verify transition blocked
4. Verify task list violation in logs

#### Test 1.3: TEST Phase - Skipped Testing
**Scenario**: LomuAI tries to skip testing and go straight to VERIFY

**Expected Behavior**:
- PhaseGatekeeper blocks TEST → VERIFY transition
- Mandatory testing violation logged
- I AM provides guidance to run tests

**Test Steps**:
1. Create job with code changes
2. Mock LomuAI skipping TEST phase
3. Verify transition blocked
4. Check for test execution requirement message

### 2. WorkflowValidator Tests

#### Test 2.1: Token Ceiling - ASSESS Phase (2K max)
**Scenario**: LomuAI exceeds 2,000 token ceiling in ASSESS phase

**Expected Behavior**:
- WorkflowValidator detects token ceiling exceeded
- Critical violation flagged
- I AM Architect guidance injected

**Test Steps**:
1. Mock LomuAI response with 2,500 tokens in ASSESS
2. Call `validateResponse()` with token counts
3. Verify `tokenCeilingExceeded === true`
4. Check violation list contains ceiling violation

#### Test 2.2: Premature Completion
**Scenario**: LomuAI tries to mark job complete without running tests

**Expected Behavior**:
- WorkflowValidator blocks completion
- Missing phase violations listed
- Quality score penalized

**Test Steps**:
1. Mock job completing without TEST phase
2. Call `validateWorkflowCompletion()`
3. Verify completion blocked
4. Check for missing phase errors

### 3. ResponseQualityGuard Tests

#### Test 3.1: Generic AI Disclaimers
**Scenario**: LomuAI uses phrases like "As an AI" or "I cannot"

**Expected Behavior**:
- ResponseQualityGuard detects meta-commentary
- Quality score reduced
- Violation logged

**Test Steps**:
1. Mock response: "As an AI, I'll help you fix this issue..."
2. Call `analyzeQuality()`
3. Verify quality score < 80
4. Check for meta-commentary detection

#### Test 3.2: Explaining vs Executing
**Scenario**: LomuAI talks about doing work instead of doing it

**Expected Behavior**:
- Low action-to-explanation ratio detected
- Quality score reduced significantly
- I AM Architect guidance requested

**Test Steps**:
1. Mock response with 200 words explanation, 0 tool calls
2. Call `analyzeQuality()`
3. Verify quality score < 50
4. Check for I AM Architect call

### 4. ReflectionHeartbeat Tests

#### Test 4.1: Periodic Self-Check After 5 Tools
**Scenario**: LomuAI calls 5 tools in EXECUTE phase

**Expected Behavior**:
- ReflectionHeartbeat triggers after 5th tool
- Reflection prompt generated
- Prompt injected into conversation

**Test Steps**:
1. Initialize orchestrator
2. Call `recordToolCall()` 5 times
3. Call `validateResponse()`
4. Verify `reflectionPrompt !== null`
5. Check conversation for reflection system message

#### Test 4.2: Reset After Reflection
**Scenario**: After reflection, tool counter resets

**Expected Behavior**:
- Counter resets to 0 after reflection
- Next reflection triggers at tool #5 again

**Test Steps**:
1. Trigger reflection (5 tools)
2. Verify counter reset
3. Call 5 more tools
4. Verify second reflection triggered

### 5. ParityKPIs Tests

#### Test 5.1: Task List Creation Rate
**Scenario**: Track task list creation across 100 jobs

**Expected Behavior**:
- ≥99% of jobs create task lists
- KPI metrics updated correctly

**Test Steps**:
1. Create 100 test jobs
2. Call `recordTaskListCreated()` for 99 jobs
3. Query KPI metrics
4. Verify creation rate ≥ 99%

#### Test 5.2: Test Execution Rate
**Scenario**: Track test execution across jobs

**Expected Behavior**:
- ≥97% of jobs run tests
- Compliance score reflects testing

**Test Steps**:
1. Create 100 jobs with code changes
2. Call `recordTestExecuted()` for 97 jobs
3. Verify test execution rate ≥ 97%

#### Test 5.3: Violation Tracking
**Scenario**: Record various violations and calculate compliance

**Expected Behavior**:
- Violations properly attributed to jobs
- Compliance score decreases with violations
- Overall compliance ≥ 95%

**Test Steps**:
1. Record 10 violations across jobs
2. Calculate overall compliance score
3. Verify score ≥ 95%

### 6. ArchitectGuidanceInjector Tests

#### Test 6.1: Low-Severity Guidance
**Scenario**: First-time minor violation

**Expected Behavior**:
- I AM Architect called with low severity
- <100 word guidance returned
- Guidance formatted for injection
- shouldRetry === false

**Test Steps**:
1. Mock minor violation (e.g., wordiness)
2. Call `requestGuidance()`
3. Verify severity === 'low'
4. Check guidance length < 100 words
5. Verify formatted correctly

#### Test 6.2: High-Severity Guidance
**Scenario**: Critical workflow violation

**Expected Behavior**:
- I AM Architect called with high severity
- Stronger guidance provided
- shouldRetry === true

**Test Steps**:
1. Mock critical violation (e.g., skipped tests)
2. Call `requestGuidance()`
3. Verify severity === 'high'
4. Check shouldRetry === true

#### Test 6.3: 3-Strike Escalation
**Scenario**: Same job violates 3 times

**Expected Behavior**:
- First 2 violations get guidance
- Third violation triggers escalation
- shouldEscalate === true

**Test Steps**:
1. Record 3 violations for same job
2. Call `requestGuidance()` 3rd time
3. Verify `shouldEscalate === true`
4. Check guidance history length === 3

#### Test 6.4: Graceful Fallback (No API Key)
**Scenario**: ANTHROPIC_API_KEY missing

**Expected Behavior**:
- ArchitectGuidanceInjector === null
- Enforcement continues without guidance
- No crashes, just warnings

**Test Steps**:
1. Unset ANTHROPIC_API_KEY
2. Import architectGuidanceInjector
3. Verify === null
4. Call validateResponse()
5. Verify violations still detected
6. Check warning logged

### 7. EnforcementOrchestrator Integration Tests

#### Test 7.1: Complete Validation Flow
**Scenario**: Full validation with all 6 layers

**Expected Behavior**:
- All layers execute in sequence
- Results aggregated correctly
- Guidance/reflection both injected if triggered

**Test Steps**:
1. Mock LomuAI response with multiple violations
2. Call `validateResponse()` with full context
3. Verify all layers logged activity
4. Check violations from all layers collected
5. Verify guidance injected
6. Verify reflection injected

#### Test 7.2: Phase Transition Flow
**Scenario**: Valid phase transition

**Expected Behavior**:
- `transitionToPhase()` succeeds
- WorkflowValidator state updates
- No violations logged

**Test Steps**:
1. Initialize in ASSESS phase
2. Call `transitionToPhase('plan')`
3. Verify `allowed === true`
4. Check `getCurrentPhase() === 'plan'`

#### Test 7.3: Blocked Phase Transition
**Scenario**: Invalid phase transition attempt

**Expected Behavior**:
- `transitionToPhase()` fails
- Reason provided
- Violation logged

**Test Steps**:
1. Initialize in ASSESS phase
2. Call `transitionToPhase('verify')` (skipping phases)
3. Verify `allowed === false`
4. Check reason message
5. Verify phase stays in ASSESS

### 8. lomuJobManager Integration Tests

#### Test 8.1: Real LomuAI Job - Happy Path
**Scenario**: LomuAI completes job correctly

**Expected Behavior**:
- No violations detected
- No I AM Architect calls
- Job completes successfully

**Test Steps**:
1. Create real LomuAI job
2. Monitor logs for enforcement activity
3. Verify no violations logged
4. Check job status === 'completed'

#### Test 8.2: Real LomuAI Job - Violation Recovery
**Scenario**: LomuAI violates, receives guidance, fixes behavior

**Expected Behavior**:
- Violation detected
- I AM Architect provides guidance
- LomuAI receives guidance in next iteration
- LomuAI corrects behavior
- Job completes successfully

**Test Steps**:
1. Create job that triggers violation
2. Monitor for `🚨 Violations detected`
3. Verify `✅ I AM Architect guidance injected`
4. Check conversation history for system message
5. Verify next LomuAI response addresses guidance
6. Confirm job completes

#### Test 8.3: Real LomuAI Job - 3-Strike Escalation
**Scenario**: LomuAI repeatedly violates despite guidance

**Expected Behavior**:
- 1st violation: Low-severity guidance
- 2nd violation: Medium-severity guidance
- 3rd violation: Escalation to I AM takeover
- Job escalated properly

**Test Steps**:
1. Create job designed to trigger repeat violations
2. Monitor guidance severity escalation
3. Verify 3rd violation logs escalation
4. Check `shouldEscalate === true`
5. Verify escalation logic triggered

## Performance Tests

### Test P.1: Response Time Impact
**Scenario**: Measure enforcement overhead

**Expected Behavior**:
- Validation adds <500ms per response
- I AM Architect call completes in <5s
- Overall job latency acceptable

**Test Steps**:
1. Benchmark job without enforcement
2. Enable enforcement and re-run
3. Measure time difference
4. Verify <500ms overhead for validation
5. Measure I AM call duration

### Test P.2: Memory Usage
**Scenario**: Monitor enforcement system memory

**Expected Behavior**:
- Minimal memory overhead
- No memory leaks over time

**Test Steps**:
1. Run 100 jobs with enforcement
2. Monitor memory usage
3. Verify no continuous growth
4. Check for proper cleanup

## Test Execution Plan

### Phase 1: Unit Tests (Layer Isolation)
- Test each layer independently
- Verify core functionality
- Validate error handling

### Phase 2: Integration Tests (Orchestrator)
- Test layer coordination
- Verify data flow between layers
- Test error propagation

### Phase 3: End-to-End Tests (lomuJobManager)
- Real LomuAI jobs
- Full workflow validation
- I AM Architect teamwork verification

### Phase 4: Performance & Load Tests
- Response time benchmarks
- Memory profiling
- Concurrent job handling

## Success Criteria

✅ All 6 enforcement layers functional
✅ I AM Architect guidance injection works
✅ Violations detected accurately
✅ Guidance/reflection properly injected
✅ Phase transitions validated correctly
✅ Token ceilings enforced
✅ Parity KPIs tracked accurately
✅ <500ms validation overhead
✅ No memory leaks
✅ Real LomuAI jobs complete with enforcement

## Test Automation

### Recommended Framework
- Jest for unit/integration tests
- Playwright for E2E workflow tests
- Artillery for load testing

### Test Data
- Mock LomuAI responses with known violations
- Pre-recorded Gemini API responses
- Test job fixtures for each scenario

### CI/CD Integration
- Run unit tests on every commit
- Run integration tests on PR
- Run E2E tests before deployment
- Performance tests on release candidate

## Conclusion
This comprehensive test plan ensures the 6-layer enforcement system + I AM Architect guidance injection works correctly, providing TRUE real-time teamwork between LomuAI and I AM Architect for 90%+ Replit Agent behavioral parity.
