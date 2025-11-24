# LomuAI Test Project 🧪

This is a mini sandbox project inside the Lomu IDE sandbox to test and verify LomuAI's ability to:

- ✅ Read and edit files
- ✅ See changes in the live preview
- ✅ Detect TypeScript errors and problems
- ✅ Execute terminal commands
- ✅ Commit changes with git
- ✅ View diffs of changes

## Current Issues

### 🔴 Bug #1: TypeScript Error in App.tsx
The `removeTodo` function uses an undefined variable `index`. LomuAI should:
1. Identify the error in the Problems tab
2. Fix it by using the correct variable from the function parameter
3. Make the delete button work properly

## How to Test LomuAI

1. Open the IDE tab in Lomu chat
2. Double-click `src/App.tsx` to view the code
3. Check the Problems tab - you'll see the TypeScript error
4. Ask LomuAI: **"Fix the TypeScript error in the test project"**
5. Watch it:
   - Identify the problem
   - Edit the file
   - Make the fix
   - See the preview update
   - Show the changes via git diff

## Success Criteria

Once LomuAI fixes the bug:
- ✅ Problems tab shows 0 errors
- ✅ Preview shows working todo app
- ✅ Delete button removes todos correctly
- ✅ Git shows the changes in the Git tab
