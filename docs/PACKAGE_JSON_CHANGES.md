# Required package.json Changes

Since `package.json` cannot be edited directly via automation, add these scripts manually:

## Scripts to Add

Open `package.json` and add the following scripts to the `"scripts"` section:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push",
    
    // ADD THESE NEW SCRIPTS:
    "meta:prod": "tsx scripts/run-meta-prod.ts",
    "meta:prod:seed": "tsx scripts/run-meta-prod.ts --seed --mock-secrets",
    "test:lomu-ai": "tsx server/tests/platformHealing/diagnosis.integration.test.ts"
  }
}
```

## Script Descriptions

### `meta:prod`
Runs LomuAI in local production mode for validation testing.

**Usage:**
```bash
npm run meta:prod
```

**Options (run directly with tsx):**
```bash
# With mock secrets
tsx scripts/run-meta-prod.ts --mock-secrets

# With database seeding
tsx scripts/run-meta-prod.ts --seed --mock-secrets

# Skip build (if dist/ already exists)
tsx scripts/run-meta-prod.ts --skip-build

# Verbose output
tsx scripts/run-meta-prod.ts --verbose
```

### `meta:prod:seed`
Runs LomuAI in production mode with database seeding and mock secrets enabled.

**Usage:**
```bash
npm run meta:prod:seed
```

### `test:lomu-ai`
Runs the Phase A integration tests for LomuAI diagnosis system.

**Usage:**
```bash
npm run test:lomu-ai
```

This will:
- Build the application in production mode
- Run diagnosis against compiled `dist/` artifacts
- Verify findings reference production code
- Test GitHub fallback with mocked API
- Validate edge cases

## Environment Variables

For production parity testing, ensure these environment variables are set in `.env`:

```bash
# Required for LomuAI
ANTHROPIC_API_KEY=sk-ant-your-key-here
# OR
OPENAI_API_KEY=sk-your-key-here

# Optional (will use development DB if not set)
DATABASE_URL=postgresql://user:pass@host/db

# Optional (GitHub integration)
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=6-7Development/archetype
GITHUB_BRANCH=main

# Optional (for mock secrets mode)
SESSION_SECRET=your-session-secret
STRIPE_SECRET_KEY=sk_test_your_key

# Build metadata (injected by CI or build script)
COMMIT_SHA=abc123
BUILD_TIMESTAMP=2025-10-29T00:00:00Z
```

## Verification

After adding the scripts, verify they work:

```bash
# Test meta:prod script
npm run meta:prod -- --help

# Test integration tests
npm run test:lomu-ai

# Test production build
npm run build
```

## Dependencies Already Installed

The following dependencies have been installed and are ready to use:

- `nock` - HTTP mocking for GitHub API tests
- `@types/nock` - TypeScript types for nock
- `@jridgewell/trace-mapping` - Source map parsing (already in package.json)

## Next Steps

1. Add the scripts to `package.json` as shown above
2. Run `npm run meta:prod` to test local production mode
3. Run `npm run test:lomu-ai` to validate integration tests
4. Review `docs/LOMU_AI_VALIDATION.md` for full validation procedures
