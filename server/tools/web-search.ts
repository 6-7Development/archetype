import { TavilyClient } from 'tavily';

interface WebSearchParams {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: string;
}

interface WebSearchResult {
  query: string;
  results: SearchResult[];
  answer?: string;
}

/**
 * Execute web search using Tavily API
 * Allows SySop to fetch real-time documentation, examples, and knowledge
 */
export async function executeWebSearch(params: WebSearchParams): Promise<WebSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured. Web search is disabled.');
  }
  
  try {
    const client = new TavilyClient({ apiKey });
    
    const response = await client.search({
      query: params.query,
      max_results: params.maxResults || 5,
      include_domains: params.includeDomains,
      exclude_domains: params.excludeDomains,
      search_depth: 'advanced',
      include_answer: true,
    });
    
    return {
      query: params.query,
      results: response.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
      })),
      answer: response.answer,
    };
  } catch (error) {
    console.error('Web search error:', error);
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for documentation on a specific topic
 */
export async function searchDocumentation(topic: string, framework?: string): Promise<WebSearchResult> {
  const query = framework 
    ? `${framework} ${topic} documentation official guide`
    : `${topic} documentation official guide`;
  
  return executeWebSearch({
    query,
    maxResults: 3,
    includeDomains: [
      'docs.react.dev',
      'docs.npmjs.com',
      'developer.mozilla.org',
      'nodejs.org',
      'expressjs.com',
      'github.com',
    ],
  });
}

/**
 * Search for code examples
 */
export async function searchCodeExamples(query: string): Promise<WebSearchResult> {
  return executeWebSearch({
    query: `${query} code example tutorial`,
    maxResults: 5,
    includeDomains: [
      'github.com',
      'stackoverflow.com',
      'dev.to',
      'medium.com',
    ],
  });
}
