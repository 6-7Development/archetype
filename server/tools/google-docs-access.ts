/**
 * Google Docs Access Tool
 * Enables Hexad to read, search, and analyze Google Docs documents
 * Integrated with Replit's Google Docs connector for secure OAuth handling
 */

import type { docs_v1 } from 'googleapis';
import { google } from 'googleapis';

// ✅ Type Definitions
interface GoogleDocsResponse {
  documentId: string;
  title: string;
  content: string;
  lastModified: string;
  size: number;
}

interface DocumentSearchResult {
  documentId: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
}

/**
 * Initialize Google Docs API client
 * Uses environment variable GOOGLE_DOCS_ACCESS_TOKEN from Replit integration
 */
function initGoogleDocsClient(): docs_v1.Docs {
  const accessToken = process.env.GOOGLE_DOCS_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('GOOGLE_DOCS_ACCESS_TOKEN not configured. Set up the Google Docs integration in Replit.');
  }
  
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.docs({ version: 'v1', auth });
}

/**
 * Read a Google Doc and extract its content
 * @param documentId - Google Doc ID (from the URL)
 * @returns Document content and metadata
 */
export async function readGoogleDoc(documentId: string): Promise<GoogleDocsResponse> {
  try {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Invalid document ID provided');
    }
    
    const docsClient = initGoogleDocsClient();
    
    const doc = await docsClient.documents.get({
      documentId,
    });
    
    if (!doc.data) {
      throw new Error('Failed to retrieve document');
    }
    
    // Extract text from document body
    const content = extractTextFromDocument(doc.data);
    
    return {
      documentId,
      title: doc.data.title || 'Untitled',
      content,
      lastModified: doc.data.suggestedNameProperties?.suggestedName || 'Unknown',
      size: content.length,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[GOOGLE-DOCS] Error reading document:', errorMsg);
    throw new Error(`Failed to read Google Doc: ${errorMsg}`);
  }
}

/**
 * Search within a Google Doc for specific content
 * @param documentId - Google Doc ID
 * @param searchTerm - Term to search for
 * @returns Matching excerpts with context
 */
export async function searchGoogleDoc(
  documentId: string,
  searchTerm: string
): Promise<DocumentSearchResult[]> {
  try {
    const doc = await readGoogleDoc(documentId);
    const content = doc.content.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    const results: DocumentSearchResult[] = [];
    let startIndex = 0;
    
    // Find all occurrences
    while ((startIndex = content.indexOf(searchLower, startIndex)) !== -1) {
      const contextStart = Math.max(0, startIndex - 100);
      const contextEnd = Math.min(content.length, startIndex + searchTerm.length + 100);
      const excerpt = content.substring(contextStart, contextEnd);
      
      results.push({
        documentId,
        title: doc.title,
        excerpt: `...${excerpt}...`,
        relevanceScore: 1.0,
      });
      
      startIndex += searchTerm.length;
    }
    
    return results;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[GOOGLE-DOCS] Error searching document:', errorMsg);
    throw new Error(`Failed to search Google Doc: ${errorMsg}`);
  }
}

/**
 * List Google Docs in a specific folder (requires Drive API access)
 * @param folderId - Google Drive folder ID (optional)
 * @returns Array of document metadata
 */
export async function listGoogleDocs(folderId?: string): Promise<GoogleDocsResponse[]> {
  try {
    // ✅ This requires Google Drive API - can be added when full Drive integration is available
    // For now, return empty array with helpful message
    console.log('[GOOGLE-DOCS] Document listing requires Drive API integration');
    return [];
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[GOOGLE-DOCS] Error listing documents:', errorMsg);
    throw new Error(`Failed to list Google Docs: ${errorMsg}`);
  }
}

/**
 * Extract plain text from Google Docs API response
 * @param doc - Google Docs document object
 * @returns Extracted text content
 */
function extractTextFromDocument(doc: docs_v1.Schema$Document): string {
  if (!doc.body || !doc.body.content) {
    return '';
  }
  
  let text = '';
  
  for (const element of doc.body.content) {
    if (element.paragraph && element.paragraph.elements) {
      for (const elem of element.paragraph.elements) {
        if (elem.textRun && elem.textRun.content) {
          text += elem.textRun.content;
        }
      }
      text += '\n';
    }
    
    if (element.table) {
      // Simple table extraction
      text += '[TABLE]\n';
    }
  }
  
  return text.trim();
}

/**
 * Get document metadata without full content
 * Useful for checking if document exists and permissions
 */
export async function getGoogleDocMetadata(documentId: string) {
  try {
    const docsClient = initGoogleDocsClient();
    
    const doc = await docsClient.documents.get({
      documentId,
      fields: 'documentId,title,suggestedNameProperties,revisionId,suggestionsViewMode',
    });
    
    return {
      documentId: doc.data.documentId,
      title: doc.data.title,
      revisionId: doc.data.revisionId,
      accessible: true,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[GOOGLE-DOCS] Error getting metadata:', errorMsg);
    
    return {
      documentId,
      accessible: false,
      error: errorMsg,
    };
  }
}
