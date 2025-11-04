/**
 * Message Filter Utility
 * 
 * Filters out tool_use and tool_result blocks from chat message content
 * to prevent raw JSON tool calls from being displayed to users.
 * 
 * This is necessary because Gemini API requires structured content blocks
 * (including tool calls), but users should only see human-readable text.
 */

/**
 * Filter message content to extract only text blocks
 * @param content - Can be a string or an array of content blocks
 * @returns Filtered content with only text (no tool calls/results)
 */
export function filterToolCallsFromContent(content: any): any {
  // If content is a simple string, return as-is
  if (typeof content === 'string') {
    return content;
  }

  // If content is an array of content blocks (structured format)
  if (Array.isArray(content)) {
    const textBlocks = content.filter(block => {
      // Keep only text blocks, filter out tool_use and tool_result
      return block.type === 'text';
    });

    // If we have text blocks, extract just the text
    if (textBlocks.length > 0) {
      // If only one text block, return as string
      if (textBlocks.length === 1) {
        return textBlocks[0].text || textBlocks[0].content || '';
      }
      
      // Multiple text blocks: combine them
      return textBlocks
        .map(block => block.text || block.content || '')
        .filter(text => text.trim().length > 0)
        .join('\n\n');
    }

    // If no text blocks found, return empty string
    return '';
  }

  // If content is an object (single block), check if it's text
  if (typeof content === 'object' && content !== null) {
    if (content.type === 'text') {
      return content.text || content.content || '';
    }
    // Non-text block, return empty string
    return '';
  }

  // Fallback: return empty string
  return '';
}

/**
 * Filter a chat message object to remove tool calls from content
 * @param message - Chat message object with content field
 * @returns Message with filtered content
 */
export function filterToolCallsFromMessage(message: any): any {
  if (!message) return message;

  return {
    ...message,
    content: filterToolCallsFromContent(message.content),
  };
}

/**
 * Filter an array of chat messages to remove tool calls
 * @param messages - Array of chat messages
 * @returns Array of messages with filtered content
 */
export function filterToolCallsFromMessages(messages: any[]): any[] {
  if (!Array.isArray(messages)) return [];

  return messages.map(filterToolCallsFromMessage);
}
