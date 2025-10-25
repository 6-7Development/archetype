-- ===================================================================
-- PRODUCTION DATABASE OWNER SETUP
-- ===================================================================
-- This script marks the platform owner in the production database
-- Run this on Render's PostgreSQL database to enable Meta-SySop access
-- ===================================================================

-- Step 1: Check current owner status
SELECT 
  id, 
  email, 
  role, 
  is_owner,
  created_at
FROM users 
WHERE role = 'admin' OR is_owner = true
ORDER BY created_at ASC;

-- Step 2: Mark the primary owner (root@getdc360.com)
-- IMPORTANT: This email should match your actual production account!
UPDATE users 
SET is_owner = true 
WHERE email = 'root@getdc360.com'
RETURNING id, email, role, is_owner;

-- Step 3: Verify the update
SELECT 
  id, 
  email, 
  role, 
  is_owner,
  'Owner account configured!' as status
FROM users 
WHERE is_owner = true;

-- ===================================================================
-- ALTERNATIVE: If you want to use a different email
-- ===================================================================
-- Uncomment and modify the email below:
-- UPDATE users 
-- SET is_owner = true 
-- WHERE email = 'your-actual-email@example.com'
-- RETURNING id, email, role, is_owner;

-- ===================================================================
-- NOTES:
-- ===================================================================
-- 1. Only ONE user should be marked as is_owner = true
-- 2. This user will have access to Platform Healing (Meta-SySop)
-- 3. After running this, Meta-SySop will work on production!
-- 4. Make sure the email matches an actual user in your production DB
-- ===================================================================
