# Render Production - Owner Setup Guide

## Problem
LomuAI requires a designated platform owner (user with `is_owner = true` in database) to function on Render production. Without this, Meta cannot update the platform.

## Solution: Browser Console Method

### Step 1: Deploy to Render
Push your latest code to GitHub. Render will auto-deploy.

### Step 2: Login on Render Production
1. Navigate to your Render production URL
2. Login with your admin account
3. You should be authenticated

### Step 3: Mark Yourself as Owner (via Browser Console)

Open browser DevTools (F12) and run this code:

```javascript
// Check current owner status
fetch('/api/owner-status')
  .then(r => r.json())
  .then(data => console.log('Current owner status:', data));

// Set yourself as owner (must be logged in as admin)
fetch('/api/setup-owner', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include' // Important! Sends session cookie
})
  .then(r => r.json())
  .then(data => {
    console.log('✅ Owner setup result:', data);
    if (data.success) {
      console.log('🎉 You are now the platform owner!');
      console.log('LomuAI can now update the platform on Render.');
    } else {
      console.error('❌ Error:', data.error);
    }
  })
  .catch(err => console.error('Request failed:', err));
```

### Step 4: Verify Owner Status

Run this to confirm:

```javascript
fetch('/api/owner-status')
  .then(r => r.json())
  .then(data => {
    console.log('Owner status:', data);
    if (data.hasOwner) {
      console.log('✅ Owner is set:', data.owner.email);
    } else {
      console.log('⚠️ No owner set yet');
    }
  });
```

## How It Works

The API endpoint `/api/setup-owner`:
- ✅ Checks if you're authenticated
- ✅ Verifies you're an admin
- ✅ Checks if owner already exists
- ✅ Marks you as owner in database (`is_owner = true`)
- ✅ Returns success confirmation

## Requirements

1. **Must be logged in** - The session cookie must be valid
2. **Must be admin** - Your account must have `role = 'admin'`
3. **First come, first served** - Once set, owner cannot be changed (security)

## Alternative: Environment Variable Method

If the API method doesn't work, you can also set:

```bash
OWNER_USER_ID=your-user-id-here
```

In your Render environment variables. Get your user ID from the browser console:

```javascript
fetch('/api/auth/check')
  .then(r => r.json())
  .then(data => console.log('Your user ID:', data.user?.id));
```

## Troubleshooting

### Error: "Authentication required"
- Make sure you're logged in on the Render production site
- The session cookie must be present

### Error: "Only admins can become platform owner"
- You need to promote your account to admin first
- Use the admin promotion flow in the app

### Error: "Platform owner already exists"
- Someone else is already the owner
- Contact them to manage platform updates
- Or use `OWNER_USER_ID` environment variable override

## Testing LomuAI After Setup

Once owner is set, test LomuAI:

```javascript
// Test LomuAI chat endpoint
fetch('/api/platform/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    message: 'Test message - verify you can see this',
    conversationId: null
  })
})
  .then(r => r.json())
  .then(data => console.log('LomuAI response:', data));
```

## Security Notes

- Owner status is permanent (cannot be changed via API once set)
- Only admins can become owner
- Owner has special privileges for LomuAI platform updates
- All updates are logged and audited
