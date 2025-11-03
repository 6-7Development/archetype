/**
 * Web fetch tool for Lomu AI
 * Fetch full web pages and extract content
 */

export interface WebFetchResult {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  markdown?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Fetch full web page content
 * Downloads HTML and converts to readable format
 */
export async function webFetch(params: {
  url: string;
}): Promise<WebFetchResult> {
  const { url } = params;
  
  try {
    // Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch (urlError) {
      return {
        success: false,
        url,
        error: 'Invalid URL format',
      };
    }
    
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Lomu-AI-Bot/1.0',
      },
      redirect: 'follow',
    });
    
    if (!response.ok) {
      return {
        success: false,
        url,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    
    // Simple HTML to text conversion (remove tags, scripts, styles)
    let content = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content size (first 10000 chars)
    if (content.length > 10000) {
      content = content.substring(0, 10000) + '... (truncated)';
    }
    
    // Basic markdown conversion (extract headings and links)
    const markdown = convertToMarkdown(html);
    
    return {
      success: true,
      url,
      title,
      content,
      markdown,
      statusCode: response.status,
    };
  } catch (error: any) {
    console.error('[WEB-FETCH] Error:', error);
    return {
      success: false,
      url,
      error: error.message,
    };
  }
}

/**
 * Convert HTML to basic markdown
 */
function convertToMarkdown(html: string): string {
  let markdown = html;
  
  // Extract headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  
  // Extract links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Extract paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // Remove remaining tags
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Clean up whitespace
  markdown = markdown.replace(/\s+/g, ' ').trim();
  
  // Limit size
  if (markdown.length > 5000) {
    markdown = markdown.substring(0, 5000) + '... (truncated)';
  }
  
  return markdown;
}
