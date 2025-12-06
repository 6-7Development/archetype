# Platform Configuration System Overview

## What is it?
A centralized system for managing all customizable platform values (colors, API endpoints, messages, limits) in one place instead of scattered throughout component code.

## Why?
- **Maintainability**: Change the platform's brand color by editing one config file, not hunting through 50 components
- **Scalability**: Add new features/settings without modifying dozens of files
- **Type Safety**: TypeScript prevents typos and provides autocomplete
- **DX**: New developers instantly see what's customizable
- **Modularity**: Smaller, cleaner component code focused on UI logic

## Directory Structure
```
client/src/
├── config/
│   ├── index.ts              # Barrel export for clean imports
│   ├── app.config.ts         # Main config (branding, colors, API, limits, messages)
│   └── constants.ts          # Global constants (routes, UI, validation, timing)
├── lib/
│   ├── api-utils.ts          # Centralized API endpoints & fetch utilities
│   └── classNameHelper.ts    # Reusable Tailwind className builder
├── hooks/
│   └── useAppConfig.ts       # React hook for safe config access
└── components/
    └── providers/
        └── ConfigProvider.tsx # Context provider (wrap App.tsx with this)
```

## Core Files Overview

### 1. app.config.ts (Main Configuration)
**Purpose**: Centralize ALL customizable platform values

**Sections**:
- `branding` - Name, logo, favicon
- `theme` - All colors (primary, secondary, accent, destructive, success, warning, muted)
- `api` - Base URL and all endpoint paths
- `chat` - Message length, auto-save, placeholders, batch sizes
- `ui` - Button variants, spacing scales, font sizes, border radius
- `features` - Feature flags (markdown, code highlighting, image upload, etc.)
- `shortcuts` - Keyboard shortcuts
- `limits` - Quotas and rate limits
- `defaults` - User preference defaults (theme, language, notifications)
- `messages` - Error, success, confirmation copy
- `telemetry` - Analytics configuration
- `social` - External links (GitHub, Twitter, docs, support)
- `environment` - Development/production detection

**Usage**:
```typescript
import { APP_CONFIG } from '@/config/app.config';

// Access any value
APP_CONFIG.branding.name          // 'LomuAI'
APP_CONFIG.theme.primary          // '#FFD700'
APP_CONFIG.chat.maxMessageLength  // 10000
APP_CONFIG.api.baseURL            // 'http://localhost:5000'
```

### 2. constants.ts (Global Constants)
**Purpose**: Organized constants for routes, UI patterns, validation, timing

**Exports**:
- `ROUTES` - All app routes (/dashboard, /incidents, /lomu, etc.)
- `API_ROUTES` - All backend endpoints (/api/chat, /api/projects, etc.)
- `UI_CONSTANTS` - Tailwind patterns (avatar sizes, icon sizes, spacing, transitions)
- `MESSAGES` - Common strings (Loading, Error, Success, etc.)
- `TIME_CONSTANTS` - ms values (debounce, throttle, auto-save, polling)
- `VALIDATION` - Min/max lengths, file sizes, allowed types
- `STATUS` - State enum values (idle, loading, success, error)
- `COLORS` - Hex color values
- `ARIA_LABELS` - Accessibility labels

**Usage**:
```typescript
import { ROUTES, UI_CONSTANTS, TIME_CONSTANTS, VALIDATION } from '@/config/constants';

<Link to={ROUTES.DASHBOARD} />
className={UI_CONSTANTS.AVATAR_SM}
setTimeout(() => {}, TIME_CONSTANTS.AUTO_SAVE_MS)
if (name.length < VALIDATION.MIN_PROJECT_NAME_LENGTH) { }
```

### 3. classNameHelper.ts (Tailwind Builder)
**Purpose**: Centralize reusable Tailwind class combinations

**Provides**:
- `classes.button.*` - Button variants
- `classes.card` - Card styling
- `classes.text.*` - Text hierarchy
- `classes.layout.*` - Layout patterns
- `classes.spacing.*` - Common spacing
- `classes.alert.*` - Alert variants
- `classes.messageBubble.*` - Chat message styles
- `classes.input` - Input field styling
- `classes.divider` - Divider lines
- Helper functions: `combineClasses()`, `conditionalClass()`

**Usage**:
```typescript
import { classes, combineClasses, conditionalClass } from '@/lib/classNameHelper';

<Button className={classes.button.primary}>Send</Button>
<div className={combineClasses(classes.spacing.p4, classes.text.body)}>
<div className={conditionalClass(isLoading, classes.loading)}>
```

### 4. api-utils.ts (Centralized APIs)
**Purpose**: No more hard-coded API endpoints scattered throughout code

**Provides**:
- `API_ENDPOINTS` - All endpoints (built from app.config)
- `buildApiUrl()` - Construct full URLs
- `fetchApi<T>()` - Generic fetch wrapper
- `postApi<T>()` - POST request helper
- `streamApi()` - Streaming response helper
- `getQueryKey()` - React Query key builder

**Usage**:
```typescript
import { API_ENDPOINTS, buildApiUrl, postApi, getQueryKey } from '@/lib/api-utils';

// Build endpoint URL
const url = buildApiUrl(API_ENDPOINTS.CHAT_MESSAGE);

// Use in React Query
useQuery({
  queryKey: getQueryKey(API_ENDPOINTS.PLATFORM_HEALTH),
  queryFn: () => fetchApi(API_ENDPOINTS.PLATFORM_HEALTH),
});

// Make POST requests
const result = await postApi(API_ENDPOINTS.HEALING_START, { targetType: 'platform' });
```

### 5. useAppConfig.ts (React Hook)
**Purpose**: Type-safe access to config in components

**Provides**:
- `.config` - Full config object
- `.getValue()` - Get nested value by path
- `.getApiUrl()` - Build full API URL
- `.getThemeColor()` - Get theme color
- `.isFeatureEnabled()` - Check feature flag
- `.getBrandName()` - Get brand name
- `.getSocialLink()` - Get social link

**Usage**:
```typescript
import { useAppConfig } from '@/hooks/useAppConfig';

function MyComponent() {
  const { config, isFeatureEnabled, getThemeColor } = useAppConfig();
  
  return (
    <>
      <h1>{config.branding.name}</h1>
      {isFeatureEnabled('markdown') && <MarkdownRenderer />}
      <div style={{ color: getThemeColor('primary') }} />
    </>
  );
}
```

### 6. ConfigProvider.tsx (Context Provider)
**Purpose**: Make config available throughout the app

**Usage** (already added to App.tsx):
```typescript
<ConfigProvider>
  <YourApp />
</ConfigProvider>
```

Then access in any component via:
```typescript
const config = useConfig(); // From ConfigProvider context
```

## Refactoring Strategy

### Three Refactoring Approaches (pick one per component)

**Option 1: Heavy Config Users** (components with lots of styling/strings)
```typescript
import { useAppConfig } from '@/hooks/useAppConfig';
import { classes } from '@/lib/classNameHelper';

// Use hook + classes throughout component
```

**Option 2: Light API Users** (components that mainly make API calls)
```typescript
import { API_ENDPOINTS, getQueryKey } from '@/lib/api-utils';
import { ROUTES } from '@/config/constants';

// Use API_ENDPOINTS and ROUTES
```

**Option 3: Hybrid** (use both approaches)
```typescript
import { useAppConfig } from '@/hooks/useAppConfig';
import { API_ENDPOINTS, getQueryKey } from '@/lib/api-utils';
import { classes } from '@/lib/classNameHelper';
import { ROUTES, MESSAGES } from '@/config/constants';

// Mix as needed
```

## Migration Path

1. **Phase 1 (Complete)**: System foundation created
2. **Phase 2 (Current)**: Key components refactored (PlatformHealthIndicator)
3. **Phase 3 (Incremental)**: Other components refactored using REFACTORING_GUIDE.md
4. **Phase 4 (Enforcement)**: Code review checks prevent hard-coded values

## Customization Examples

### Change Brand Color
```typescript
// Before: Change 50+ components
// After: One line in app.config.ts
theme: {
  primary: '#FFD700', // Change this to any hex color
}
```

### Add New API Endpoint
```typescript
// In app.config.ts
api: {
  endpoints: {
    myNewEndpoint: '/api/my-endpoint',
    // ...
  }
}

// In any component
import { API_ENDPOINTS } from '@/lib/api-utils';
fetch(buildApiUrl(API_ENDPOINTS.myNewEndpoint));
```

### Change Platform Limits
```typescript
// In app.config.ts
limits: {
  maxProjects: 100,      // Change this
  maxTeamMembers: 50,    // Change this
  // ...
}
```

### Add Feature Flag
```typescript
// In app.config.ts
features: {
  newFeature: true,  // Add this
}

// In component
if (useAppConfig().isFeatureEnabled('newFeature')) {
  <NewFeature />
}
```

## Best Practices

✅ **DO**:
- Use config values instead of hard-coding
- Import from one place (`API_ENDPOINTS`, `classes`, `ROUTES`)
- Use `getQueryKey()` for React Query keys
- Use `useAppConfig()` hook in components
- Document why config is used with comments

❌ **DON'T**:
- Hard-code colors like `#FFD700` - use `APP_CONFIG.theme.primary`
- Hard-code routes like `/dashboard` - use `ROUTES.DASHBOARD`
- Hard-code API paths like `/api/chat` - use `API_ENDPOINTS.CHAT`
- Hard-code UI classes - use `classes` builder
- Hard-code strings like `"Loading..."` - use `MESSAGES` or config

## Troubleshooting

**Issue**: Component not re-rendering when config changes
**Solution**: Use `useAppConfig()` hook instead of direct import

**Issue**: Can't find an API endpoint
**Solution**: Check `API_ENDPOINTS` in `api-utils.ts` or add to `app.config.ts`

**Issue**: Missing Tailwind class pattern
**Solution**: Add to `classes` object in `classNameHelper.ts`

**Issue**: New configuration not working
**Solution**: Make sure ConfigProvider is in App.tsx and you're importing from correct file

## Files to Reference
- See `REFACTORING_GUIDE.md` for step-by-step component refactoring examples
- See `client/src/config/app.config.ts` for all customizable values
- See `client/src/components/platform-health-indicator.tsx` for refactored component example
