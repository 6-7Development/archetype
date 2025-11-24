/**
 * Gap #20: Cross-Agent Learning & Knowledge Sharing
 * Share discoveries, failed patterns, architectural insights across all agents
 */

export interface SharedKnowledge {
  successPatterns: string[];
  failedPatterns: string[];
  architecturalDecisions: string[];
  subagentInsights: string[];
  lastUpdated: number;
}

export interface LearningEvent {
  type: 'success' | 'failure' | 'architecture' | 'insight';
  agent: string; // Which agent discovered this
  content: string;
  timestamp: number;
  confidence: number; // 0-100
}

class CrossAgentLearningService {
  private knowledge: SharedKnowledge = {
    successPatterns: [],
    failedPatterns: [],
    architecturalDecisions: [],
    subagentInsights: [],
    lastUpdated: Date.now(),
  };

  private learningHistory: LearningEvent[] = [];

  /**
   * Record a learning event
   */
  recordEvent(event: LearningEvent) {
    this.learningHistory.push(event);

    switch (event.type) {
      case 'success':
        this.knowledge.successPatterns.push(event.content);
        break;
      case 'failure':
        this.knowledge.failedPatterns.push(event.content);
        break;
      case 'architecture':
        this.knowledge.architecturalDecisions.push(event.content);
        break;
      case 'insight':
        this.knowledge.subagentInsights.push(event.content);
        break;
    }

    this.knowledge.lastUpdated = Date.now();

    console.log(
      `[CROSS-AGENT-LEARNING] ${event.agent}: ${event.type.toUpperCase()} - ${event.content.substring(0, 60)}...`,
    );
  }

  /**
   * Query shared knowledge
   */
  getKnowledge(category?: keyof SharedKnowledge): any {
    if (category) {
      return this.knowledge[category];
    }
    return this.knowledge;
  }

  /**
   * Check if pattern is known to fail
   */
  isKnownFailure(pattern: string): boolean {
    return this.knowledge.failedPatterns.some((fp) => pattern.includes(fp));
  }

  /**
   * Get similar success patterns
   */
  getSimilarSuccessPatterns(query: string): string[] {
    return this.knowledge.successPatterns.filter((sp) => {
      const similarity = this._calculateSimilarity(query, sp);
      return similarity > 0.5;
    });
  }

  /**
   * Merge knowledge from multiple agents
   */
  mergeKnowledge(other: SharedKnowledge) {
    this.knowledge.successPatterns = [
      ...new Set([...this.knowledge.successPatterns, ...other.successPatterns]),
    ];
    this.knowledge.failedPatterns = [
      ...new Set([...this.knowledge.failedPatterns, ...other.failedPatterns]),
    ];
    this.knowledge.architecturalDecisions = [
      ...new Set([...this.knowledge.architecturalDecisions, ...other.architecturalDecisions]),
    ];
    this.knowledge.subagentInsights = [
      ...new Set([...this.knowledge.subagentInsights, ...other.subagentInsights]),
    ];
    this.knowledge.lastUpdated = Date.now();
  }

  private _calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(' '));
    const words2 = new Set(str2.toLowerCase().split(' '));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}

export const crossAgentLearning = new CrossAgentLearningService();
