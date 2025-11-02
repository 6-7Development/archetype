import type { Artifact } from "@/components/chat-artifact";

/**
 * Extract code blocks from markdown and convert them to artifacts
 * Detects triple-backtick code fences and extracts language + content
 */
export function extractArtifactsFromMarkdown(markdown: string): {
  cleanedMarkdown: string;
  artifacts: Artifact[];
} {
  const artifacts: Artifact[] = [];
  const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let match;
  let artifactIndex = 0;

  // Extract all code blocks
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const language = match[1] || 'text';
    const content = match[2].trim();
    
    // Skip empty code blocks
    if (!content) continue;

    // Count lines for metadata
    const lineCount = content.split('\n').length;

    artifacts.push({
      id: `artifact-${Date.now()}-${artifactIndex++}`,
      type: 'code',
      content: content,
      language: language,
      metadata: {
        lineCount,
      },
    });
  }

  // Remove code blocks from markdown (they'll be rendered as artifacts)
  const cleanedMarkdown = markdown.replace(codeBlockRegex, '').trim();

  return {
    cleanedMarkdown,
    artifacts,
  };
}

/**
 * Create a mock artifact for testing
 */
export function createMockArtifact(
  language: string,
  content: string,
  title?: string
): Artifact {
  return {
    id: `mock-${Date.now()}`,
    type: 'code',
    title,
    content,
    language,
    metadata: {
      lineCount: content.split('\n').length,
    },
  };
}

/**
 * Parse message content and extract artifacts
 * This can be called when receiving a message from the backend
 */
export function parseMessageContent(content: string): {
  textContent: string;
  artifacts: Artifact[];
} {
  const { cleanedMarkdown, artifacts } = extractArtifactsFromMarkdown(content);
  
  return {
    textContent: cleanedMarkdown || content, // Fallback to original if no artifacts
    artifacts,
  };
}
