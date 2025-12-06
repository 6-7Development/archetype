-- Production Database: Clear Stuck Meta-SySop Tasks
-- Run this in Render PostgreSQL console

-- 1. View current stuck tasks
SELECT id, title, status, created_at 
FROM platform_tasks 
WHERE status != 'completed'
ORDER BY created_at DESC;

-- 2. Delete all stuck/incomplete tasks (safe - Meta-SySop will create new ones)
DELETE FROM platform_task_lists WHERE status = 'active';

-- 3. Verify cleanup
SELECT COUNT(*) as remaining_tasks FROM platform_tasks;
SELECT COUNT(*) as remaining_lists FROM platform_task_lists;

-- Expected result: 0 remaining tasks and 0 remaining lists
-- Meta-SySop will create fresh task lists on next session
