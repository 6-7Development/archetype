# Configuration System Refactoring Guide

## Overview
The platform now uses a centralized configuration system that eliminates all hard-coded values. This guide shows how to refactor components to use the new system.

## Key Files
- **client/src/config/app.config.ts** - Main configuration with branding, colors, API endpoints, chat settings, limits, messages
- **client/src/config/constants.ts** - Global constants (routes, API routes, UI constants, messages, timing)
- **client/src/lib/api-utils.ts** - Centralized API utilities (endpoints, URL building, fetch helpers)
- **client/src/lib/classNameHelper.ts** - Reusable Tailwind className builder
- **client/src/hooks/useAppConfig.ts** - React hook for safe config access
- **client/src/components/providers/ConfigProvider.tsx** - Context provider for app config

## Refactoring Pattern

### Before (Hard-coded values scattered)
```typescript
// BAD: Hard-coded endpoint
const { data } = useQuery({
  queryKey: ['/api/platform-health'],
  queryFn: async () => {
    const response = await fetch('/api/platform-health');
    return response.json();
  },
});

// BAD: Hard-coded styling
<Button className="bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
  Send
</Button>

// BAD: Hard-coded strings
toast({ title: "Healing started!", description: "LomuAI is analyzing..." });
```

### After (Using centralized config)
```typescript
// GOOD: Using API_ENDPOINTS from config
import { API_ENDPOINTS, getQueryKey } from '@/lib/api-utils';

const { data } = useQuery({
  queryKey: getQueryKey(API_ENDPOINTS.PLATFORM_HEALTH),
  queryFn: async () => {
    const response = await fetch(buildApiUrl(API_ENDPOINTS.PLATFORM_HEALTH));
    return response.json();
  },
});

// GOOD: Using class builder or useAppConfig
import { classes } from '@/lib/classNameHelper';
<Button className={classes.button.primary}>
  Send
</Button>

// GOOD: Using config messages
import { APP_CONFIG } from '@/config/app.config';
toast({ 
  title: "Healing started!", 
  description: APP_CONFIG.messages.success.saved 
});
```

## Step-by-Step Refactoring

### 1. Replace API Endpoints
**Old:**
```typescript
fetch('/api/platform-health')
queryKey: ['/api/platform-health']
```

**New:**
```typescript
import { API_ENDPOINTS, getQueryKey, buildApiUrl } from '@/lib/api-utils';

fetch(buildApiUrl(API_ENDPOINTS.PLATFORM_HEALTH))
queryKey: getQueryKey(API_ENDPOINTS.PLATFORM_HEALTH)
```

### 2. Replace Hard-coded Routes
**Old:**
```typescript
setLocation('/platform-healing')
<Link href="/incidents">View Incidents</Link>
```

**New:**
```typescript
import { ROUTES } from '@/config/constants';

setLocation(ROUTES.PLATFORM_HEALING)
<Link href={ROUTES.INCIDENTS}>View Incidents</Link>
```

### 3. Replace Hard-coded Styling
**Old:**
```typescript
className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
className="space-y-3 divide-y"
```

**New:**
```typescript
import { classes } from '@/lib/classNameHelper';

className={classes.spacing.p3 + ' ' + classes.button.primary}
className={classes.spacing.SPACING_MD}
```

### 4. Replace Hard-coded Messages & Copy
**Old:**
```typescript
toast({ title: "Success", description: "Changes saved!" });
placeholder: "Message LomuAI..."
```

**New:**
```typescript
import { APP_CONFIG, MESSAGES } from '@/config';

toast({ title: MESSAGES.SUCCESS, description: APP_CONFIG.messages.success.saved });
placeholder: APP_CONFIG.chat.placeholders.input
```

### 5. Replace Hard-coded Colors
**Old:**
```typescript
style={{ backgroundColor: '#FFD700' }}
className="text-green-600"
```

**New:**
```typescript
import { APP_CONFIG } from '@/config/app.config';

style={{ backgroundColor: APP_CONFIG.theme.primary }}
style={{ color: APP_CONFIG.theme.success }}
```

### 6. Replace Time Constants
**Old:**
```typescript
refetchInterval: 30000
setTimeout(() => {}, 2000)
```

**New:**
```typescript
import { TIME_CONSTANTS } from '@/config/constants';

refetchInterval: TIME_CONSTANTS.POLLING_INTERVAL_MS
setTimeout(() => {}, TIME_CONSTANTS.AUTO_SAVE_MS)
```

## Using the Configuration

### Access Config in Components
```typescript
import { useAppConfig } from '@/hooks/useAppConfig';

export function MyComponent() {
  const { 
    config,           // Full config object
    getValue,         // Get nested config value
    getApiUrl,        // Get full API URL
    isFeatureEnabled, // Check if feature is on
    getBrandName,     // Get brand name
  } = useAppConfig();

  return (
    <div>
      <h1>{config.branding.name}</h1>
      <Button disabled={!isFeatureEnabled('markdown')}>
        Format
      </Button>
    </div>
  );
}
```

### Add New Configuration
1. Open `client/src/config/app.config.ts`
2. Add to appropriate section (branding, theme, api, chat, ui, features, etc.)
3. Use throughout app via `APP_CONFIG` or `useAppConfig()`

## Benefits of This System

✅ **No Hard-Coded Values** - All customizable values in one place  
✅ **Easy Customization** - Change colors, logos, API endpoints by editing config  
✅ **Maintainability** - New developers instantly see what's customizable  
✅ **Type Safety** - TypeScript provides autocomplete and type checking  
✅ **Scalability** - Easy to add new features and configurations  
✅ **Performance** - Config is loaded once at app startup  

## Example Component Refactoring

### Before
```typescript
function ChatInput() {
  const [message, setMessage] = useState('');
  
  const sendMessage = async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    
    if (response.ok) {
      toast({ title: 'Success', description: 'Message sent!' });
      setMessage('');
    }
  };

  return (
    <div className="space-y-2 p-4">
      <textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message LomuAI..."
        maxLength={10000}
        className="w-full p-2 rounded-lg border"
      />
      <button 
        onClick={sendMessage}
        className="px-4 py-2 bg-primary rounded-md hover:bg-primary/90"
      >
        Send
      </button>
    </div>
  );
}
```

### After
```typescript
import { API_ENDPOINTS, postApi, getQueryKey } from '@/lib/api-utils';
import { APP_CONFIG } from '@/config/app.config';
import { classes } from '@/lib/classNameHelper';
import { VALIDATION, TIME_CONSTANTS } from '@/config/constants';

function ChatInput() {
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  
  const sendMessage = async () => {
    const response = await postApi(API_ENDPOINTS.CHAT_MESSAGE, { message });
    
    if (response.ok) {
      toast({ 
        title: 'Success', 
        description: APP_CONFIG.messages.success.saved 
      });
      setMessage('');
    }
  };

  return (
    <div className={classes.spacing.SPACING_SM + ' ' + classes.spacing.p3}>
      <textarea 
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={APP_CONFIG.chat.placeholders.input}
        maxLength={VALIDATION.MAX_MESSAGE_LENGTH}
        className={classes.textarea}
      />
      <button 
        onClick={sendMessage}
        className={classes.button.primary}
      >
        {APP_CONFIG.chat.placeholders.input.split(' ')[0]}
      </button>
    </div>
  );
}
```

## Next Steps

1. **Review existing components** - Identify components with hard-coded values
2. **Prioritize high-impact changes** - Start with frequently-used components
3. **Test thoroughly** - Ensure functionality remains unchanged after refactoring
4. **Document patterns** - Add comments explaining why config is used
5. **Enforce in code reviews** - Prevent new hard-coded values from being added

## Quick Reference

| What | Where | How |
|------|-------|-----|
| Brand, Colors, API Endpoints | `app.config.ts` | Import `APP_CONFIG` |
| Routes, UI Constants, Messages | `constants.ts` | Import `ROUTES`, `UI_CONSTANTS`, etc. |
| API Endpoints & URL Building | `api-utils.ts` | Import `API_ENDPOINTS`, `buildApiUrl()` |
| Tailwind Classes | `classNameHelper.ts` | Import `classes` object |
| Config in Components | `useAppConfig.ts` hook | Use hook for reactive config |
| Context Provider | `ConfigProvider.tsx` | Already in App.tsx |
