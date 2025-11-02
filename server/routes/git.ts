import { Router } from "express";
import { platformGitService } from "../services/gitService";

const router = Router();

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

// Placeholder: Stage files (MVP - demo only)
router.post("/api/git/stage", async (req, res) => {
  try {
    const { files } = req.body;
    // In MVP, we just acknowledge the request
    console.log('[GIT-API] Stage files (demo):', files);
    res.json({ message: 'Files staged (demo mode)', files });
  } catch (error: any) {
    console.error('[GIT-API] Error staging files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Placeholder: Commit changes (MVP - demo only)
router.post("/api/git/commit", async (req, res) => {
  try {
    const { message, author } = req.body;
    // In MVP, we just acknowledge the commit
    console.log('[GIT-API] Commit (demo):', { message, author });
    res.json({ 
      message: 'Commit created (demo mode)', 
      hash: 'demo-' + Date.now(),
      commitMessage: message 
    });
  } catch (error: any) {
    console.error('[GIT-API] Error committing:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
