# Security Requirements for Production Deployment

## ⚠️ CRITICAL: Authentication System Required Before Production

The current implementation uses **hardcoded "demo-user"** throughout for MVP development. This **MUST** be replaced with a proper authentication system before any production deployment.

## Current Security Limitations

### 1. No User Authentication
- All API endpoints use hardcoded `userId = "demo-user"`
- No login/logout functionality
- No session management
- No JWT or token-based authentication

### 2. Impact on Billing & Usage Tracking
While the billing and usage tracking infrastructure is **technically sound**, it relies on trusted userId values. Without authentication:

- ❌ All users share the same usage limits
- ❌ Billing cannot be attributed to individual customers
- ❌ Subscription enforcement is ineffective
- ❌ Enterprise unlimited plans cannot be properly isolated

### 3. Security Vulnerabilities
Without authentication, the platform is vulnerable to:

- **Impersonation attacks**: Users could manipulate userId to access others' accounts
- **Billing fraud**: Users could select enterprise IDs to bypass limits
- **Credit theft**: Users could drain other users' AI credits
- **Data exposure**: All projects and files are currently accessible to anyone

## Required Authentication Implementation

Before production deployment, implement:

### 1. User Authentication System
```typescript
// Options:
// A. Session-based (Express + Passport.js)
// B. JWT tokens (jsonwebtoken)
// C. OAuth2 (Google, GitHub)
// D. Replit Auth integration
```

### 2. Middleware for Protected Routes
```typescript
// Example middleware to extract userId from session
function requireAuth(req, res, next) {
  const userId = req.session?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.userId = userId; // Attach to request
  next();
}

// Apply to all AI endpoints
app.post("/api/commands", requireAuth, async (req, res) => {
  const userId = req.userId; // From trusted session, not client
  // ... rest of endpoint
});
```

### 3. Update All Endpoints
Replace all instances of:
```typescript
const userId = "demo-user"; // INSECURE
```

With:
```typescript
const userId = req.userId; // From authenticated session
```

### 4. Database User Management
The `users` table exists with username/password fields. Implement:

- Password hashing (bcrypt)
- Login endpoint with credential validation
- Session creation/destruction
- Password reset flow

## Current Usage Tracking Implementation Status

✅ **Implemented & Production-Ready:**
- Token usage tracking (Anthropic API)
- Cost calculation ($3/1M input, $15/1M output)
- Monthly usage aggregation
- Subscription tier limits (Free/Starter/Pro/Enterprise)
- Plan limit and overage calculation
- Enterprise unlimited plan support
- Usage logs and monthly summaries

❌ **Blocked by Authentication:**
- Per-user isolation
- Individual billing
- Subscription enforcement
- Credit attribution

## Deployment Checklist

**DO NOT DEPLOY TO PRODUCTION UNTIL:**

- [ ] User authentication system implemented
- [ ] All endpoints use authenticated userId from session/JWT
- [ ] Password hashing implemented (bcrypt/argon2)
- [ ] Login/logout endpoints created
- [ ] Session management configured
- [ ] HTTPS/SSL enabled for secure sessions
- [ ] Rate limiting implemented
- [ ] CSRF protection added
- [ ] Security audit completed
- [ ] Penetration testing performed

## Recommended Next Steps

### Immediate (Phase 1)
1. Implement Replit Auth or Passport.js authentication
2. Add session middleware to Express
3. Create login/register endpoints
4. Update all API routes to use `req.session.userId`

### Short-term (Phase 2)
5. Add password reset functionality
6. Implement email verification
7. Add 2FA for enterprise accounts
8. Create admin panel for user management

### Long-term (Phase 3)
9. OAuth integration (Google, GitHub)
10. API keys for programmatic access
11. Role-based access control (RBAC)
12. Audit logging for security events

## Development vs Production

### Development (Current)
```typescript
const userId = "demo-user"; // OK for local testing
```

### Production (Required)
```typescript
const userId = req.session?.userId;
if (!userId) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

## Contact

For questions about authentication implementation, consult:
- Replit Auth documentation
- Express.js session management guides
- OWASP authentication best practices

---

**Last Updated:** October 11, 2025  
**Status:** ⚠️ Authentication Required Before Production
