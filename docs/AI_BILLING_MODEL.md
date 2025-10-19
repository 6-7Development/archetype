# Archetype - AI Billing Model V3.0
## Token-Based Billing - Transparent & Fair

### Overview
**Archetype** uses token-based pricing that aligns with actual AI costs, ensuring complete transparency and fairness.

## Branding
- **Platform**: Archetype
- **AI Agent**: SySop - AI Coding Agent with Architect consultation (powered by Claude Sonnet 4)
- **Consistent Naming**: Always "Archetype" in all UI, docs, and marketing materials

---

## Token-Based Pricing Model

### What are Tokens?
- **Tokens** are the units of AI computation
- Input tokens = your request/prompt
- Output tokens = AI's generated response
- Average project: ~10K input + 40K output = 50K total tokens

### Provider Costs (What We Pay):
- **Input**: $3 per 1M tokens
- **Output**: $15 per 1M tokens
- **Blended average**: ~$18 per 1M tokens
- **Per project cost**: ~$0.63

### Our Pricing (What Users Pay):
| Plan | Tokens/Month | Overage Rate | Markup |
|------|-------------|--------------|--------|
| Free | 50,000 | None (must upgrade) | Trial |
| Starter | 250,000 | $0.10/1K | 5× |
| Pro | 750,000 | $0.08/1K | 4× |
| Business | 2,000,000 | $0.06/1K | 3× |
| Enterprise | 6,000,000 | $0.05/1K | 2.5× |

---

## Plan Details

### FREE TIER (30-Day Trial)
- **Tokens**: 50,000 (~5-10 simple projects)
- **Trial Period**: 30 days from signup
- **Overages**: Not allowed - must upgrade
- **Hard Limits**:
  - Token limit reached → Account locked
  - Trial expired (30 days) → Account locked
  - Must upgrade to continue

### STARTER PLAN ($49/month)
- **Tokens**: 250,000/month (~25-50 projects)
- **Overages**: $0.10 per 1K tokens
- **Requirements**: Payment method required for overages
- **Projects**: Unlimited (within token limit)

### PRO PLAN ($129/month) ⭐
- **Tokens**: 750,000/month (~75-150 projects)
- **Overages**: $0.08 per 1K tokens
- **Requirements**: Payment method required for overages
- **Features**: Priority support, API access, version history

### BUSINESS PLAN ($299/month)
- **Tokens**: 2,000,000/month (~200-400 projects)
- **Overages**: $0.06 per 1K tokens
- **Team**: Up to 5 users included
- **Features**: White-label, custom domains, team collaboration

### ENTERPRISE PLAN ($899/month)
- **Tokens**: 6,000,000/month (~600-1200 projects)
- **Overages**: $0.05 per 1K tokens
- **Features**: Dedicated support, SLA, SSO, on-prem deployment

---

## SySop AI Agent Capabilities

### Core Features
- **12-Step Workflow**: Deep understanding → intelligent build → rigorous self-testing → iterative refinement
- **99.9% Quality Guarantee**: Enterprise-grade code with automatic error fixing
- **Multi-Domain Expertise**: Full Stack Web, Games, Marketplaces, AI/ML, Mobile, Edge/Serverless

### Autonomous Capabilities
SySop includes industry-leading autonomous features:

#### Self-Testing (MANDATORY):
- **Browser Testing**: Playwright-based UI/UX validation
- **API Testing**: Endpoint verification and validation
- **Console Monitoring**: Error detection in real-time
- **Screenshot Analysis**: Visual regression testing

#### Self-Correction Protocol:
1. Test after every code generation
2. If issues found → Fix immediately
3. Retest to verify fix
4. If 3+ failed attempts → Invoke Architect consultation

#### Architect Consultation System:
When stuck in bug loops, SySop can invoke **Architect** for expert guidance:
- Root cause analysis
- Alternative architectural approaches
- Security audit recommendations
- Performance optimization strategies

### Error Detection & Auto-Fix

SySop automatically detects and fixes:

#### Security Issues:
- SQL injection vulnerabilities
- XSS attacks
- CSRF vulnerabilities
- Hardcoded secrets
- Auth bypass risks
- Privilege escalation

#### Performance Problems:
- N+1 queries
- Missing database indexes
- Large bundle sizes
- Blocking operations
- Memory leaks

#### Accessibility Violations:
- Missing alt text
- Keyboard traps
- Poor color contrast
- Missing ARIA labels
- Focus management issues

#### Architecture Errors:
- Layer separation violations
- Circular dependencies
- Tight coupling
- Dependency flow issues

---

## Billing Modes

### 1. Build Mode (Command Console)
**Location**: Build tab > Command Console
**Purpose**: Project generation and modification
**Billing**: Token-based (counted after generation)

**Examples**:
- "Create a todo app" → ~50K tokens → Included in plan
- "Build booking system" → ~150K tokens → Included in plan
- "Create marketplace platform" → ~300K tokens → May trigger overage

### 2. Talk Mode (AI Chat)
**Location**: Build tab > AI Chat
**Purpose**: Conversational assistance, code review, Q&A
**Billing**: Token-based (counted per conversation)

**Examples**:
- "What is React?" → ~2K tokens → Minimal cost
- "How do I implement auth?" → ~5K tokens → Minimal cost
- "Review my code for security" → ~10K tokens → Included

---

## Usage Tracking (100% Coverage)

### Real-Time Token Tracking ✅
All AI operations tracked in real-time:
- Input tokens counted before generation
- Output tokens counted after generation
- Total cost calculated immediately
- Monthly running total updated

### Database Schema:
```typescript
usage_logs {
  userId: string
  projectId: string
  type: 'ai_generation' | 'ai_chat'
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: decimal(10,4)  // Exact cost in dollars
  createdAt: timestamp
}

monthly_usage {
  userId: string
  month: string  // YYYY-MM
  totalTokens: number
  totalAICost: decimal(10,2)
  storageCost: decimal(10,2)
  deploymentCost: decimal(10,2)
  infraCost: decimal(10,2)
  totalCost: decimal(10,2)
  planLimit: decimal(10,2)
  overage: decimal(10,2)
}
```

---

## Hard Limit Enforcement

### Free Tier Enforcement:
```
User makes AI request
  ↓
Check tokens used this month
  ↓
Over 50K tokens?
  ↓
YES → Block request
    → Show: "Free tier limit reached (50K/50K tokens)"
    → Require: Upgrade to Starter plan
```

### Paid Tier Enforcement:
```
User makes AI request
  ↓
Check tokens used this month
  ↓
Over plan limit?
  ↓
YES → Check payment method
    ↓
    Has card? → Allow & bill overage
    No card? → Block & require card
```

### Trial Expiration:
```
Free tier user
  ↓
Check signup date
  ↓
Over 30 days?
  ↓
YES → Block all AI requests
    → Show: "Free trial expired"
    → Require: Upgrade to paid plan
```

---

## Stripe Billing Integration

### Subscription Billing:
- **Base fee**: Charged monthly via Stripe
- **Auto-renewal**: Recurring subscription
- **Proration**: Upgrades/downgrades prorated

### Overage Billing (Metered):
- **Monthly calculation**: Tokens over plan limit
- **Rate applied**: Plan-specific overage rate
- **Invoicing**: Added to next month's invoice

**Example**:
- **Plan**: Pro ($129/month, 750K tokens)
- **Used**: 850K tokens
- **Overage**: 100K tokens
- **Calculation**: 100K × $0.08/1K = $8.00
- **Total Invoice**: $129 + $8 = $137

---

## Transparency Features

### Real-Time Cost Preview:
Before generating any code:
1. Analyze request complexity
2. Estimate token usage
3. Show cost estimate
4. User confirms or cancels

**Example**:
```
"Build a marketplace platform"
Estimated: ~300K tokens
Cost: Included in Pro plan (750K available)
[Confirm] [Cancel]
```

### Usage Dashboard:
Users can see at any time:
- Tokens used this month
- Tokens remaining
- Current overage amount
- Projected monthly cost
- Historical usage trends

### Alerts:
Automatic notifications at:
- **80% usage**: "You've used 600K of 750K tokens"
- **90% usage**: "You've used 675K of 750K tokens"
- **100% usage**: "Plan limit reached - overages will be billed"

---

## Cost Recovery Strategy

### Zero Loss Guarantee:
- ✅ Every token counted
- ✅ Every cost tracked
- ✅ Hard limits enforced
- ✅ Payment required for overages

### Monthly Reconciliation:
1. Calculate total tokens used
2. Apply plan limits
3. Calculate overages
4. Bill via Stripe metered billing
5. Generate invoice for user

---

## Competitive Positioning

### Why Token-Based?
- **Transparent**: Users know exactly what they pay for
- **Fair**: Aligned with actual costs
- **Predictable**: Clear tier limits
- **Flexible**: Overages available for power users

### Market Comparison:
| Provider | Model | Transparency | Markup |
|----------|-------|--------------|--------|
| **Archetype** | Token-based | ✅ 100% | 3-5× |
| Replit Agent | Token-based | ✅ High | ~5× |
| Cursor | Flat fee | ⚠️ Limited | N/A |
| Copilot | Flat fee | ⚠️ Limited | N/A |

---

## Implementation Status

### Completed ✅:
- [x] Token tracking infrastructure
- [x] Hard limit enforcement
- [x] Free trial expiration (30 days)
- [x] Payment method requirement
- [x] Overage rate calculation
- [x] Monthly usage aggregation

### Required for Launch:
- [ ] Stripe keys configuration
- [ ] Metered billing setup
- [ ] Webhook handlers
- [ ] End-to-end testing
- [ ] Usage dashboard UI
- [ ] Upgrade/payment dialogs

---

## Key Principles

### Business Model:
- **Sustainable margins**: 82-90% profit
- **Competitive pricing**: 3-5× markup
- **Fair to users**: Real projects possible
- **Transparent billing**: No surprises

### User Experience:
- **Clear limits**: Know what you get
- **Real-time feedback**: Always know usage
- **Upgrade path**: Easy tier changes
- **Overage option**: Power users pay more

### Technical Excellence:
- **100% tracking**: Every token counted
- **Hard enforcement**: Prevent losses
- **Auto-billing**: Stripe integration
- **Zero leakage**: Complete cost coverage
