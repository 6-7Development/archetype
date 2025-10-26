import { promises as fs } from 'fs';
import path from 'path';

/**
 * Shared Knowledge Management System for AI Agents
 * Simple JSON file-based storage for cross-agent learning and memory
 */

// Resolve path correctly whether running from root or server directory
const isServerDir = process.cwd().endsWith('server');
const KNOWLEDGE_BASE_DIR = isServerDir 
  ? path.join(process.cwd(), 'knowledge-base')
  : path.join(process.cwd(), 'server', 'knowledge-base');
const GENERAL_KNOWLEDGE_FILE = path.join(KNOWLEDGE_BASE_DIR, 'general-knowledge.json');
const CODE_SNIPPETS_FILE = path.join(KNOWLEDGE_BASE_DIR, 'code-snippets.json');

interface KnowledgeEntry {
  id: string;
  category: string;
  topic: string;
  content: string;
  tags: string[];
  timestamp: string;
  source: string;
  confidence: number;
}

interface CodeSnippet {
  id: string;
  language: string;
  description: string;
  code: string;
  tags: string[];
  timestamp: string;
  usageCount: number;
}

// Ensure knowledge base directory and files exist
async function ensureKnowledgeBase(): Promise<void> {
  try {
    await fs.mkdir(KNOWLEDGE_BASE_DIR, { recursive: true });
    
    // Initialize general knowledge file if it doesn't exist
    try {
      await fs.access(GENERAL_KNOWLEDGE_FILE);
    } catch {
      await fs.writeFile(GENERAL_KNOWLEDGE_FILE, JSON.stringify([], null, 2));
    }
    
    // Initialize code snippets file if it doesn't exist
    try {
      await fs.access(CODE_SNIPPETS_FILE);
    } catch {
      await fs.writeFile(CODE_SNIPPETS_FILE, JSON.stringify([], null, 2));
    }
  } catch (error: any) {
    console.error('Failed to ensure knowledge base:', error);
    throw new Error(`Knowledge base initialization failed: ${error.message}`);
  }
}

/**
 * Store knowledge for future recall by any AI agent
 */
export async function knowledge_store(params: {
  category: string;
  topic: string;
  content: string;
  tags?: string[];
  source?: string;
  confidence?: number;
}): Promise<string> {
  try {
    await ensureKnowledgeBase();
    
    const entry: KnowledgeEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: params.category,
      topic: params.topic,
      content: params.content,
      tags: params.tags || [],
      timestamp: new Date().toISOString(),
      source: params.source || 'sysop',
      confidence: params.confidence || 0.8,
    };
    
    const data = await fs.readFile(GENERAL_KNOWLEDGE_FILE, 'utf-8');
    const knowledge: KnowledgeEntry[] = JSON.parse(data);
    knowledge.push(entry);
    
    await fs.writeFile(GENERAL_KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));
    
    return `Knowledge stored successfully: ${entry.id} (${params.category}/${params.topic})`;
  } catch (error: any) {
    throw new Error(`Failed to store knowledge: ${error.message}`);
  }
}

/**
 * Search the knowledge base for relevant information
 */
export async function knowledge_search(params: {
  query: string;
  category?: string;
  tags?: string[];
  limit?: number;
}): Promise<KnowledgeEntry[]> {
  try {
    await ensureKnowledgeBase();
    
    const data = await fs.readFile(GENERAL_KNOWLEDGE_FILE, 'utf-8');
    const knowledge: KnowledgeEntry[] = JSON.parse(data);
    
    const query = params.query.toLowerCase();
    const limit = params.limit || 10;
    
    // Filter and score results
    const scored = knowledge.map(entry => {
      let score = 0;
      
      // Category match
      if (params.category && entry.category === params.category) {
        score += 10;
      }
      
      // Tag match
      if (params.tags) {
        const matchingTags = entry.tags.filter(tag => 
          params.tags!.some(t => t.toLowerCase() === tag.toLowerCase())
        );
        score += matchingTags.length * 5;
      }
      
      // Content search
      const contentLower = entry.content.toLowerCase();
      const topicLower = entry.topic.toLowerCase();
      
      if (topicLower.includes(query)) score += 15;
      if (contentLower.includes(query)) score += 10;
      
      // Word-by-word partial match
      const queryWords = query.split(/\s+/);
      queryWords.forEach(word => {
        if (word.length > 3) {
          if (topicLower.includes(word)) score += 3;
          if (contentLower.includes(word)) score += 2;
        }
      });
      
      // Confidence boost
      score *= entry.confidence;
      
      return { entry, score };
    });
    
    // Filter out zero-score results and sort by score
    const filtered = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.entry);
    
    return filtered;
  } catch (error: any) {
    throw new Error(`Failed to search knowledge: ${error.message}`);
  }
}

/**
 * Recall specific knowledge by category or topic
 */
export async function knowledge_recall(params: {
  category?: string;
  topic?: string;
  id?: string;
  limit?: number;
}): Promise<KnowledgeEntry[]> {
  try {
    await ensureKnowledgeBase();
    
    const data = await fs.readFile(GENERAL_KNOWLEDGE_FILE, 'utf-8');
    const knowledge: KnowledgeEntry[] = JSON.parse(data);
    
    let filtered = knowledge;
    
    // Filter by ID first (exact match)
    if (params.id) {
      filtered = filtered.filter(entry => entry.id === params.id);
      return filtered;
    }
    
    // Filter by category
    if (params.category) {
      filtered = filtered.filter(entry => 
        entry.category.toLowerCase() === params.category!.toLowerCase()
      );
    }
    
    // Filter by topic
    if (params.topic) {
      const topicLower = params.topic.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.topic.toLowerCase().includes(topicLower)
      );
    }
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Apply limit
    const limit = params.limit || 20;
    return filtered.slice(0, limit);
  } catch (error: any) {
    throw new Error(`Failed to recall knowledge: ${error.message}`);
  }
}

/**
 * Search and store code snippets with intelligent indexing
 */
export async function code_search(params: {
  query?: string;
  language?: string;
  tags?: string[];
  store?: {
    language: string;
    description: string;
    code: string;
    tags?: string[];
  };
  limit?: number;
}): Promise<CodeSnippet[] | string> {
  try {
    await ensureKnowledgeBase();
    
    // Store mode
    if (params.store) {
      const snippet: CodeSnippet = {
        id: `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        language: params.store.language,
        description: params.store.description,
        code: params.store.code,
        tags: params.store.tags || [],
        timestamp: new Date().toISOString(),
        usageCount: 0,
      };
      
      const data = await fs.readFile(CODE_SNIPPETS_FILE, 'utf-8');
      const snippets: CodeSnippet[] = JSON.parse(data);
      snippets.push(snippet);
      
      await fs.writeFile(CODE_SNIPPETS_FILE, JSON.stringify(snippets, null, 2));
      
      return `Code snippet stored: ${snippet.id} (${params.store.language})`;
    }
    
    // Search mode
    const data = await fs.readFile(CODE_SNIPPETS_FILE, 'utf-8');
    const snippets: CodeSnippet[] = JSON.parse(data);
    
    let filtered = snippets;
    
    // Filter by language
    if (params.language) {
      filtered = filtered.filter(snippet => 
        snippet.language.toLowerCase() === params.language!.toLowerCase()
      );
    }
    
    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      filtered = filtered.filter(snippet => 
        params.tags!.some(tag => 
          snippet.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        )
      );
    }
    
    // Search by query
    if (params.query) {
      const query = params.query.toLowerCase();
      filtered = filtered.filter(snippet => {
        const descLower = snippet.description.toLowerCase();
        const codeLower = snippet.code.toLowerCase();
        return descLower.includes(query) || codeLower.includes(query);
      });
    }
    
    // Sort by usage count and timestamp
    filtered.sort((a, b) => {
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // Apply limit
    const limit = params.limit || 10;
    return filtered.slice(0, limit);
  } catch (error: any) {
    throw new Error(`Failed to search code: ${error.message}`);
  }
}
