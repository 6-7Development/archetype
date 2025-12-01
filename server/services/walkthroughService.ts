/**
 * Walkthrough/Tutorial Service
 * 
 * Provides interactive guided tours and tutorials for:
 * - New user onboarding
 * - Feature discovery
 * - Complex IDE functionality
 * - AI sync implementation learning
 */

import { storage } from '../storage';

export interface WalkthroughStep {
  id: string;
  title: string;
  content: string;
  target?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'focus' | 'type' | 'wait';
  actionTarget?: string;
  highlightArea?: { x: number; y: number; width: number; height: number };
  requiredAction?: boolean;
  tips?: string[];
  codeExample?: string;
}

export interface Walkthrough {
  id: string;
  title: string;
  description: string;
  category: 'onboarding' | 'feature' | 'advanced' | 'ai-sync';
  estimatedMinutes: number;
  steps: WalkthroughStep[];
  prerequisites?: string[];
  badge?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface UserWalkthroughProgress {
  walkthroughId: string;
  userId: string;
  currentStepIndex: number;
  completedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
  status: 'in_progress' | 'completed' | 'skipped';
}

class WalkthroughService {
  private walkthroughs: Map<string, Walkthrough> = new Map();
  private userProgress: Map<string, Map<string, UserWalkthroughProgress>> = new Map();

  constructor() {
    this.initializeWalkthroughs();
    console.log('[WALKTHROUGH] Tutorial service initialized');
  }

  private initializeWalkthroughs(): void {
    const walkthroughs: Walkthrough[] = [
      {
        id: 'welcome-tour',
        title: 'Welcome to BeeHive',
        description: 'Learn the basics of the BeeHive IDE and meet Scout, your AI coding assistant',
        category: 'onboarding',
        estimatedMinutes: 5,
        difficulty: 'beginner',
        badge: 'First Steps',
        steps: [
          {
            id: 'welcome-1',
            title: 'Welcome to BeeHive!',
            content: 'BeeHive is an AI-powered coding platform designed to help you build web applications faster. Scout, our intelligent AI agent, will assist you throughout your development journey.',
            placement: 'center',
            tips: ['BeeHive uses Google Gemini AI for intelligent code assistance', 'All your work is automatically saved'],
          },
          {
            id: 'welcome-2',
            title: 'Meet Scout - Your AI Assistant',
            content: 'Scout is always ready to help! You can ask Scout to write code, fix bugs, explain concepts, or help with any development task.',
            target: '[data-testid="chat-input"]',
            placement: 'top',
            tips: ['Just type your request naturally', 'Scout understands context from your project'],
          },
          {
            id: 'welcome-3',
            title: 'File Explorer',
            content: 'Browse and manage your project files here. Click on a file to open it in the editor.',
            target: '[data-testid="file-explorer"]',
            placement: 'right',
            action: 'click',
          },
          {
            id: 'welcome-4',
            title: 'Code Editor',
            content: 'Write and edit code in the Monaco editor with full syntax highlighting, IntelliSense, and AI-powered completions.',
            target: '[data-testid="code-editor"]',
            placement: 'left',
          },
          {
            id: 'welcome-5',
            title: 'Live Preview',
            content: 'See your changes in real-time! The preview updates automatically as you edit your code.',
            target: '[data-testid="preview-panel"]',
            placement: 'left',
          },
          {
            id: 'welcome-6',
            title: 'Theme Toggle',
            content: 'Switch between light and dark mode for comfortable coding any time of day.',
            target: '[data-testid="button-theme-toggle"]',
            placement: 'bottom',
            action: 'click',
          },
        ],
      },
      {
        id: 'ai-chat-basics',
        title: 'Chatting with Scout',
        description: 'Learn how to effectively communicate with Scout to get the best results',
        category: 'feature',
        estimatedMinutes: 8,
        difficulty: 'beginner',
        badge: 'AI Whisperer',
        prerequisites: ['welcome-tour'],
        steps: [
          {
            id: 'chat-1',
            title: 'Starting a Conversation',
            content: 'Type your message in the chat input. Be specific about what you want to accomplish.',
            target: '[data-testid="chat-input"]',
            placement: 'top',
            codeExample: 'Create a React component for a todo list with add and delete functionality',
          },
          {
            id: 'chat-2',
            title: 'Understanding Scout\'s Process',
            content: 'Scout shows its thinking process as it works. Watch the progress indicators to see what Scout is doing.',
            target: '[data-testid="bee-status-thinking"]',
            placement: 'left',
            tips: ['Scout analyzes your request', 'Plans the implementation', 'Writes and tests code'],
          },
          {
            id: 'chat-3',
            title: 'Reviewing Changes',
            content: 'When Scout makes changes, review them in the diff view. You can accept, reject, or request modifications.',
            placement: 'center',
          },
          {
            id: 'chat-4',
            title: 'Iterating on Results',
            content: 'Not quite right? Tell Scout what to change. Context from previous messages is retained.',
            target: '[data-testid="chat-input"]',
            placement: 'top',
            codeExample: 'Add a completion checkbox to each todo item',
          },
          {
            id: 'chat-5',
            title: 'Using Code References',
            content: 'Reference specific files or functions in your messages. Scout understands your project structure.',
            target: '[data-testid="chat-input"]',
            placement: 'top',
            codeExample: 'Update the TodoItem component in src/components/TodoItem.tsx to include a priority badge',
          },
        ],
      },
      {
        id: 'smart-completions',
        title: 'Smart Code Completions',
        description: 'Master AI-powered code suggestions for faster development',
        category: 'feature',
        estimatedMinutes: 5,
        difficulty: 'intermediate',
        badge: 'Speed Coder',
        steps: [
          {
            id: 'completion-1',
            title: 'Triggering Completions',
            content: 'As you type, Scout suggests relevant code completions based on context.',
            target: '[data-testid="code-editor"]',
            placement: 'left',
            tips: ['Press Tab or Enter to accept', 'Press Escape to dismiss', 'Use arrow keys to navigate suggestions'],
          },
          {
            id: 'completion-2',
            title: 'Context-Aware Suggestions',
            content: 'Completions are tailored to your current file, imports, and coding patterns.',
            placement: 'center',
          },
          {
            id: 'completion-3',
            title: 'Snippet Completions',
            content: 'Type snippet prefixes to insert common code patterns with placeholders.',
            target: '[data-testid="code-editor"]',
            placement: 'left',
            codeExample: 'Type "for" and press Tab to insert a for loop template',
          },
        ],
      },
      {
        id: 'project-health',
        title: 'Project Health Dashboard',
        description: 'Monitor and improve your code quality with health metrics',
        category: 'advanced',
        estimatedMinutes: 7,
        difficulty: 'intermediate',
        badge: 'Quality Guardian',
        steps: [
          {
            id: 'health-1',
            title: 'Opening the Dashboard',
            content: 'Access the Project Health Dashboard from the sidebar to see your project\'s quality metrics.',
            target: '[data-testid="nav-health-dashboard"]',
            placement: 'right',
          },
          {
            id: 'health-2',
            title: 'Understanding Your Score',
            content: 'Your overall health score is calculated from code complexity, test coverage, and structure metrics.',
            placement: 'center',
          },
          {
            id: 'health-3',
            title: 'Reviewing Issues',
            content: 'Each issue is categorized by severity. Focus on critical issues first.',
            placement: 'center',
            tips: ['Critical issues affect reliability', 'Warnings suggest improvements', 'Info items are optional enhancements'],
          },
          {
            id: 'health-4',
            title: 'Acting on Suggestions',
            content: 'Ask Scout to help implement the suggested improvements.',
            target: '[data-testid="chat-input"]',
            placement: 'top',
            codeExample: 'Help me reduce the complexity in src/utils/validation.ts',
          },
        ],
      },
      {
        id: 'ai-sync-tutorial',
        title: 'AI Sync Deep Dive',
        description: 'Understand how Scout connects to your project and leverages AI capabilities',
        category: 'ai-sync',
        estimatedMinutes: 12,
        difficulty: 'advanced',
        badge: 'AI Architect',
        prerequisites: ['ai-chat-basics'],
        steps: [
          {
            id: 'sync-1',
            title: 'How AI Sync Works',
            content: 'Scout maintains a live connection with your project, understanding file structure, dependencies, and code relationships.',
            placement: 'center',
          },
          {
            id: 'sync-2',
            title: 'Project Context',
            content: 'When you make a request, Scout analyzes relevant context including: current file, imports, recent changes, and related files.',
            placement: 'center',
            tips: ['Larger context = better suggestions', 'Scout optimizes token usage for efficiency', 'Context is cached for faster responses'],
          },
          {
            id: 'sync-3',
            title: 'Tool Execution',
            content: 'Scout has access to 18+ tools for reading files, writing code, searching the codebase, and more.',
            placement: 'center',
          },
          {
            id: 'sync-4',
            title: 'Understanding Streaming',
            content: 'Scout\'s responses stream in real-time. Watch the progress indicators to see which phase Scout is in.',
            target: '[data-testid="bee-status-working"]',
            placement: 'left',
          },
          {
            id: 'sync-5',
            title: 'Handling Errors',
            content: 'If Scout encounters an error, it automatically retries with adjusted parameters. You can also provide clarification.',
            placement: 'center',
            tips: ['Check console for detailed logs', 'Rephrase if Scout misunderstands', 'Break complex tasks into steps'],
          },
          {
            id: 'sync-6',
            title: 'SWARM Mode',
            content: 'For complex tasks, Scout can spawn parallel sub-agents to work on different aspects simultaneously.',
            placement: 'center',
          },
          {
            id: 'sync-7',
            title: 'Best Practices',
            content: 'Get the most from AI sync by: being specific, providing context, reviewing changes, and iterating on results.',
            placement: 'center',
            tips: [
              'Describe what you want, not how to do it',
              'Reference specific files when relevant',
              'Review AI suggestions before accepting',
              'Use conversation history for context',
            ],
          },
        ],
      },
    ];

    for (const walkthrough of walkthroughs) {
      this.walkthroughs.set(walkthrough.id, walkthrough);
    }
  }

  getWalkthroughs(category?: string): Walkthrough[] {
    const all = Array.from(this.walkthroughs.values());
    if (category) {
      return all.filter(w => w.category === category);
    }
    return all;
  }

  getWalkthrough(id: string): Walkthrough | undefined {
    return this.walkthroughs.get(id);
  }

  async startWalkthrough(userId: string, walkthroughId: string): Promise<UserWalkthroughProgress | null> {
    const walkthrough = this.walkthroughs.get(walkthroughId);
    if (!walkthrough) {
      return null;
    }

    const progress: UserWalkthroughProgress = {
      walkthroughId,
      userId,
      currentStepIndex: 0,
      completedSteps: [],
      startedAt: new Date(),
      status: 'in_progress',
    };

    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, new Map());
    }
    this.userProgress.get(userId)!.set(walkthroughId, progress);

    console.log(`[WALKTHROUGH] User ${userId} started: ${walkthroughId}`);
    return progress;
  }

  async completeStep(userId: string, walkthroughId: string, stepId: string): Promise<UserWalkthroughProgress | null> {
    const userWalkthroughs = this.userProgress.get(userId);
    if (!userWalkthroughs) return null;

    const progress = userWalkthroughs.get(walkthroughId);
    if (!progress) return null;

    const walkthrough = this.walkthroughs.get(walkthroughId);
    if (!walkthrough) return null;

    if (!progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
    }

    const stepIndex = walkthrough.steps.findIndex(s => s.id === stepId);
    if (stepIndex >= 0 && stepIndex >= progress.currentStepIndex) {
      progress.currentStepIndex = Math.min(stepIndex + 1, walkthrough.steps.length);
    }

    if (progress.completedSteps.length === walkthrough.steps.length) {
      progress.status = 'completed';
      progress.completedAt = new Date();
      console.log(`[WALKTHROUGH] User ${userId} completed: ${walkthroughId}`);
    }

    return progress;
  }

  async skipWalkthrough(userId: string, walkthroughId: string): Promise<void> {
    const userWalkthroughs = this.userProgress.get(userId);
    if (!userWalkthroughs) return;

    const progress = userWalkthroughs.get(walkthroughId);
    if (progress) {
      progress.status = 'skipped';
      console.log(`[WALKTHROUGH] User ${userId} skipped: ${walkthroughId}`);
    }
  }

  getProgress(userId: string, walkthroughId: string): UserWalkthroughProgress | undefined {
    return this.userProgress.get(userId)?.get(walkthroughId);
  }

  getAllProgress(userId: string): UserWalkthroughProgress[] {
    const userWalkthroughs = this.userProgress.get(userId);
    if (!userWalkthroughs) return [];
    return Array.from(userWalkthroughs.values());
  }

  getRecommendedWalkthrough(userId: string): Walkthrough | null {
    const completedIds = this.getAllProgress(userId)
      .filter(p => p.status === 'completed')
      .map(p => p.walkthroughId);

    const inProgressIds = this.getAllProgress(userId)
      .filter(p => p.status === 'in_progress')
      .map(p => p.walkthroughId);

    if (inProgressIds.length > 0) {
      return this.walkthroughs.get(inProgressIds[0]) || null;
    }

    for (const [id, walkthrough] of this.walkthroughs) {
      if (completedIds.includes(id)) continue;
      
      const hasAllPrereqs = (walkthrough.prerequisites || [])
        .every(prereq => completedIds.includes(prereq));
      
      if (hasAllPrereqs) {
        return walkthrough;
      }
    }

    return null;
  }
}

export const walkthroughService = new WalkthroughService();
