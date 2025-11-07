/**
 * Parse message content to extract clean text
 * Handles both string content and Anthropic's content block arrays
 * Filters out tool_use and tool_result blocks to show only user-facing text
 */

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | any;
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | string;

/**
 * Parse message content and extract only displayable text
 * Removes all tool execution details and internal system messages
 */
export function parseMessageContent(content: string | ContentBlock[]): string {
  // If it's already a string, check if it's JSON-encoded content blocks
  if (typeof content === 'string') {
    // Try to parse as JSON array (Anthropic format)
    if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return extractTextFromBlocks(parsed);
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }
    // Regular string message
    return content;
  }

  // If it's an array of content blocks
  if (Array.isArray(content)) {
    return extractTextFromBlocks(content);
  }

  // Unknown format, convert to string
  return String(content);
}

/**
 * Extract text from content block array
 * Filters to only "text" type blocks
 */
function extractTextFromBlocks(blocks: ContentBlock[]): string {
  const textBlocks: string[] = [];

  for (const block of blocks) {
    if (typeof block === 'string') {
      textBlocks.push(block);
    } else if (typeof block === 'object' && block !== null) {
      if (block.type === 'text' && 'text' in block) {
        textBlocks.push(block.text);
      }
      // Silently skip tool_use and tool_result blocks
    }
  }

  return textBlocks.join('\n\n').trim();
}

/**
 * Clean up AI responses by removing system artifacts
 * This is applied AFTER parseMessageContent to catch any leaking system messages
 */
export function cleanAIResponse(content: string): string {
  if (!content) return content;

  let cleaned = content;

  // Remove any remaining tool JSON that slipped through
  cleaned = cleaned.replace(/\[\{"type":"tool_(use|result)"[^\]]*\}\]/g, '');
  cleaned = cleaned.replace(/\{"type":"tool_(use|result)"[^\}]*\}/g, '');

  // Remove verbose workflow instructions
  cleaned = cleaned.replace(/Step \d+:.*?(?=\n|$)/gi, '');
  cleaned = cleaned.replace(/Example \(.*?\):/gi, '');

  // Remove task ID explanations
  cleaned = cleaned.replace(/→ Returns:.*?\}/gi, '');
  cleaned = cleaned.replace(/←.*?(?=\n|$)/g, '');

  // Remove internal commentary markers
  cleaned = cleaned.replace(/❌ WRONG:.*?(?=\n|$)/gi, '');
  cleaned = cleaned.replace(/✅ CORRECT:.*?(?=\n|$)/gi, '');

  // Remove "REMEMBER:" blocks
  cleaned = cleaned.replace(/REMEMBER:.*?(?=\n\n|$)/gi, '');

  // Remove task status symbols (they're in the task list UI)
  cleaned = cleaned.replace(/○|⏳|✓/g, '');

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/\s+$/gm, '');

  return cleaned.trim();
}
