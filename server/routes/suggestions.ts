/**
 * AI Suggestions API
 * 
 * Endpoints for "Suggest Next Steps" feature
 * Analyzes current project and recommends actions
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { glob } from '../tools/file-operations';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

interface SuggestionCategory {
  id: string;
  label: string;
  icon: string;
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  { id: 'feature', label: 'New Feature', icon: 'Sparkles' },
  { id: 'bugfix', label: 'Bug Fix', icon: 'Bug' },
  { id: 'refactor', label: 'Refactor', icon: 'RefreshCw' },
  { id: 'test', label: 'Testing', icon: 'TestTube' },
  { id: 'documentation', label: 'Documentation', icon: 'FileText' },
  { id: 'performance', label: 'Performance', icon: 'Zap' },
];

interface Suggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: number;
  relatedFiles?: string[];
  reasoning?: string;
  codeSnippet?: string;
  confidence: number;
}

/**
 * POST /api/ai/suggest-next
 * Analyze project and suggest next steps
 */
router.post('/suggest-next', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { projectId, focusArea, recentContext } = req.body;

    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'AI service not configured',
      });
    }

    // Gather project context
    const workingDir = process.cwd();
    
    // Get file list
    const filePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.css', '**/*.json'];
    const allFiles: string[] = [];
    
    for (const pattern of filePatterns) {
      try {
        const files = await glob(workingDir, pattern);
        allFiles.push(...files.slice(0, 20)); // Limit per pattern
      } catch (e) {
        // Ignore glob errors
      }
    }

    // Read key files for context
    const keyFiles = [
      'package.json',
      'README.md',
      'client/src/App.tsx',
      'server/index.ts',
      'shared/schema.ts',
    ];

    let projectContext = '';
    for (const file of keyFiles) {
      try {
        const content = await fs.readFile(path.join(workingDir, file), 'utf-8');
        projectContext += `\n--- ${file} ---\n${content.substring(0, 2000)}\n`;
      } catch (e) {
        // File doesn't exist, skip
      }
    }

    // Build prompt
    const prompt = `You are a senior software architect analyzing a project to suggest actionable next steps.

PROJECT FILES:
${allFiles.slice(0, 50).join('\n')}

PROJECT CONTEXT:
${projectContext}

${focusArea ? `FOCUS AREA: ${focusArea}` : ''}
${recentContext ? `RECENT ACTIVITY: ${recentContext}` : ''}

Analyze this project and suggest 3-5 concrete, actionable next steps. For each suggestion:
1. Categorize as: feature, bugfix, refactor, test, documentation, or performance
2. Provide a clear, specific title (max 80 chars)
3. Write a detailed description of what to do (2-4 sentences)
4. List any related files that should be modified
5. Explain your reasoning
6. Rate priority 1-10 (1 = highest priority)
7. Rate confidence 0-100

Return ONLY a valid JSON array with this structure:
[
  {
    "category": "feature",
    "title": "Add user profile page",
    "description": "Create a profile page where users can view and edit their account settings, update their avatar, and manage notification preferences.",
    "priority": 3,
    "relatedFiles": ["client/src/pages/profile.tsx", "server/routes/user.ts"],
    "reasoning": "The app has authentication but no way for users to manage their profile settings.",
    "confidence": 85
  }
]

Focus on high-impact, actionable suggestions. Be specific about file paths and implementation details.`;

    // Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
      }
    });

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse suggestions
    let suggestions: Suggestion[] = [];
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.map((s: any, i: number) => ({
          id: `suggestion-${Date.now()}-${i}`,
          category: s.category || 'feature',
          title: s.title || 'Untitled Suggestion',
          description: s.description || '',
          priority: s.priority || 5,
          relatedFiles: s.relatedFiles || [],
          reasoning: s.reasoning || '',
          codeSnippet: s.codeSnippet,
          confidence: s.confidence || 70,
        }));
      }
    } catch (parseError) {
      console.error('[SUGGESTIONS-API] Failed to parse AI response:', parseError);
      // Return empty suggestions rather than error
    }

    res.json({
      success: true,
      suggestions,
      categories: SUGGESTION_CATEGORIES,
      generatedAt: new Date().toISOString(),
      model: 'gemini-2.5-flash',
    });

  } catch (error: any) {
    console.error('[SUGGESTIONS-API] Error generating suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate suggestions',
    });
  }
});

/**
 * GET /api/ai/suggestions/categories
 * Get available suggestion categories
 */
router.get('/suggestions/categories', (req: Request, res: Response) => {
  res.json({
    success: true,
    categories: SUGGESTION_CATEGORIES,
  });
});

/**
 * POST /api/ai/suggestions/:id/accept
 * Mark a suggestion as accepted
 */
router.post('/suggestions/:id/accept', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    
    // In a full implementation, this would update the database
    // For now, just acknowledge the acceptance
    res.json({
      success: true,
      message: `Suggestion ${id} accepted`,
      acceptedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[SUGGESTIONS-API] Error accepting suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to accept suggestion',
    });
  }
});

/**
 * POST /api/ai/suggestions/:id/reject
 * Mark a suggestion as rejected
 */
router.post('/suggestions/:id/reject', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    const { reason } = req.body;
    
    res.json({
      success: true,
      message: `Suggestion ${id} rejected`,
      reason,
      rejectedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[SUGGESTIONS-API] Error rejecting suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject suggestion',
    });
  }
});

export default router;
