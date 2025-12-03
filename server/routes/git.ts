import { Router } from "express";
import { platformGitService } from "../services/gitService";
import { isAuthenticated, isAdmin } from '../universalAuth.ts';

const router = Router();

// Apply authentication to all Git routes
router.use(isAuthenticated);

// Get commit history for platform repo
router.get("/api/git/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const commits = await platformGitService.getHistory(limit);
    res.json(commits);
  } catch (error: any) {
    console.error('[GIT-API] Error getting history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current git status
router.get("/api/git/status", async (req, res) => {
  try {
    const status = await platformGitService.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error('[GIT-API] Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get diff for uncommitted changes
router.get("/api/git/diff", async (req, res) => {
  try {
    const filePath = req.query.file as string | undefined;
    const diff = await platformGitService.getDiff(filePath);
    res.json({ diff });
  } catch (error: any) {
    console.error('[GIT-API] Error getting diff:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get diff between two commits
router.get("/api/git/diff/:commit1/:commit2", async (req, res) => {
  try {
    const { commit1, commit2 } = req.params;
    const filePath = req.query.file as string | undefined;
    const diff = await platformGitService.getDiffBetweenCommits(commit1, commit2, filePath);
    res.json({ diff });
  } catch (error: any) {
    console.error('[GIT-API] Error getting diff between commits:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of branches
router.get("/api/git/branches", async (req, res) => {
  try {
    const branches = await platformGitService.getBranches();
    const currentBranch = await platformGitService.getCurrentBranch();
    res.json({ branches, current: currentBranch });
  } catch (error: any) {
    console.error('[GIT-API] Error getting branches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get files changed in a specific commit
router.get("/api/git/commit/:hash/files", async (req, res) => {
  try {
    const { hash } = req.params;
    const files = await platformGitService.getCommitFiles(hash);
    res.json({ files });
  } catch (error: any) {
    console.error('[GIT-API] Error getting commit files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get diff for a specific file in a commit
router.get("/api/git/commit/:hash/file-diff", async (req, res) => {
  try {
    const { hash } = req.params;
    const filePath = req.query.file as string;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const diff = await platformGitService.getDiffBetweenCommits(`${hash}^`, hash, filePath);
    res.json({ diff });
  } catch (error: any) {
    console.error('[GIT-API] Error getting file diff for commit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stage files for commit (Admin only)
router.post("/api/git/stage", isAdmin, async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    await platformGitService.stageFiles(files);
    console.log('[GIT-API] Files staged:', files);
    res.json({ message: 'Files staged successfully', files });
  } catch (error: any) {
    console.error('[GIT-API] Error staging files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Commit staged changes (Admin only)
router.post("/api/git/commit", isAdmin, async (req, res) => {
  try {
    const { message, author } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Commit message is required' });
    }

    const authorInfo = author || { 
      name: 'Scout Agent', 
      email: 'scout@beehive.dev' 
    };

    const hash = await platformGitService.commit(message, authorInfo);
    console.log('[GIT-API] Commit created:', { hash, message });
    res.json({ 
      success: true,
      hash,
      message: 'Commit created successfully',
      commitMessage: message 
    });
  } catch (error: any) {
    console.error('[GIT-API] Error committing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new branch (Admin only)
router.post("/api/git/branch", isAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    // Validate branch name format
    const validBranchName = name.replace(/[^a-zA-Z0-9\-_\/]/g, '-');
    await platformGitService.createBranch(validBranchName);
    console.log('[GIT-API] Branch created:', validBranchName);
    res.json({ 
      success: true,
      branch: validBranchName,
      message: 'Branch created successfully' 
    });
  } catch (error: any) {
    console.error('[GIT-API] Error creating branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkout a branch (Admin only)
router.post("/api/git/checkout", isAdmin, async (req, res) => {
  try {
    const { branch } = req.body;
    
    if (!branch) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    await platformGitService.checkoutBranch(branch);
    console.log('[GIT-API] Checked out branch:', branch);
    res.json({ 
      success: true,
      branch,
      message: 'Checked out branch successfully' 
    });
  } catch (error: any) {
    console.error('[GIT-API] Error checking out branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stage all changes and commit (Admin only - convenience endpoint for Scout)
router.post("/api/git/stage-and-commit", isAdmin, async (req, res) => {
  try {
    const { message, author, files } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Commit message is required' });
    }

    // Get current status to know what to stage
    const status = await platformGitService.getStatus();
    const filesToStage = files || [
      ...status.modified,
      ...status.added,
      ...status.deleted,
      ...status.untracked
    ];

    if (filesToStage.length === 0) {
      return res.status(400).json({ error: 'No files to commit' });
    }

    // Stage files
    await platformGitService.stageFiles(filesToStage);

    // Commit
    const authorInfo = author || { 
      name: 'Scout Agent', 
      email: 'scout@beehive.dev' 
    };
    const hash = await platformGitService.commit(message, authorInfo);

    console.log('[GIT-API] Stage and commit completed:', { hash, files: filesToStage.length });
    res.json({ 
      success: true,
      hash,
      filesCommitted: filesToStage.length,
      files: filesToStage,
      message: 'Changes staged and committed successfully',
      commitMessage: message 
    });
  } catch (error: any) {
    console.error('[GIT-API] Error in stage-and-commit:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
