/**
 * OUTPUT TRUNCATOR - GAP #4 FIX
 * Intelligently truncates tool outputs to prevent context overflow
 * Preserves most important info while maintaining truncation signal
 */

export class OutputTruncator {
  private static readonly DEFAULT_LIMIT = 5000; // chars per tool output
  private static readonly MIN_LIMIT = 500;
  private static readonly TRUNCATION_MARKER = '\n... (output truncated - too large for context window) ...';

  /**
   * Truncate tool result output
   * @param output - Tool output (string or object)
   * @param maxChars - Maximum characters to preserve
   * @returns { content, truncated, originalLength }
   */
  static truncate(output: any, maxChars: number = this.DEFAULT_LIMIT): {
    content: any;
    truncated: boolean;
    originalLength: number;
    savedChars: number;
  } {
    // Handle non-string outputs
    if (typeof output !== 'string') {
      const stringified = JSON.stringify(output);
      if (stringified.length <= maxChars) {
        return {
          content: output,
          truncated: false,
          originalLength: stringified.length,
          savedChars: 0,
        };
      }

      // Re-parse to object after truncation
      const truncated = this.truncateString(stringified, maxChars);
      try {
        return {
          content: JSON.parse(truncated),
          truncated: true,
          originalLength: stringified.length,
          savedChars: stringified.length - truncated.length,
        };
      } catch {
        return {
          content: truncated,
          truncated: true,
          originalLength: stringified.length,
          savedChars: stringified.length - truncated.length,
        };
      }
    }

    // Handle strings
    if (output.length <= maxChars) {
      return {
        content: output,
        truncated: false,
        originalLength: output.length,
        savedChars: 0,
      };
    }

    const truncated = this.truncateString(output, maxChars);
    return {
      content: truncated,
      truncated: true,
      originalLength: output.length,
      savedChars: output.length - truncated.length,
    };
  }

  /**
   * Smart string truncation preserving context
   * Tries to break at natural boundaries (line breaks, paragraphs)
   */
  private static truncateString(str: string, maxChars: number): string {
    if (str.length <= maxChars) {
      return str;
    }

    const limit = Math.max(this.MIN_LIMIT, maxChars);

    // Try to break at newline
    const lastNewline = str.lastIndexOf('\n', limit);
    if (lastNewline > limit * 0.7) {
      // At least 70% of target
      return str.substring(0, lastNewline) + this.TRUNCATION_MARKER;
    }

    // Try to break at space
    const lastSpace = str.lastIndexOf(' ', limit);
    if (lastSpace > limit * 0.7) {
      return str.substring(0, lastSpace) + this.TRUNCATION_MARKER;
    }

    // Hard break
    return str.substring(0, limit) + this.TRUNCATION_MARKER;
  }

  /**
   * Estimate tokens from character count (rough: ~4 chars per token)
   */
  static estimateTokens(content: any): number {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    return Math.ceil(str.length / 4);
  }

  /**
   * Get truncation recommendation based on available tokens
   */
  static getRecommendation(availableTokens: number): {
    maxChars: number;
    maxTokens: number;
    aggressive: boolean;
  } {
    const maxTokens = Math.max(100, Math.min(2000, availableTokens / 4));
    const maxChars = maxTokens * 4;
    const aggressive = availableTokens < 5000;

    return { maxChars, maxTokens, aggressive };
  }
}
