/**
 * Shared Chat Configuration
 * Used by both regular LomuAI chat and Platform Healing chat
 * 
 * Platform Healing should only differ in TOOLS (platform file access),
 * everything else (iterations, workflow, logic) should be shared.
 */

export type UserIntent = 'build' | 'fix' | 'diagnostic' | 'casual';

/**
 * Classify user intent from message content
 * Used to determine appropriate iteration limits and behavior
 */
export function classifyUserIntent(message: string): UserIntent {
  const lowerMessage = message.toLowerCase();
  
  // 🎯 MULTI-PASS SCORING SYSTEM (more robust than first-match-wins)
  const scores = {
    build: 0,
    fix: 0,
    diagnostic: 0,
    casual: 0
  };

  // BUILD intent signals (creating new things)
  const buildPatterns = [
    /\b(build|create|make|add|implement|develop|setup|initialize|scaffold|generate)\b/i,
    /\b(new feature|new page|new component|new endpoint|new route|new model)\b/i,
    /\bcan you (build|create|make|add|setup)\b/i,
    /\bi (want|need) (a|an|to create|to build|to add)\b/i,
  ];
  buildPatterns.forEach(pattern => {
    if (pattern.test(lowerMessage)) scores.build += 1;
  });

  // FIX intent signals (fixing existing things)
  const fixPatterns = [
    /\b(fix|repair|resolve|debug|solve|correct|patch|update|improve|refactor|optimize)\b/i,
    /\b(broken|not working|doesn't work|issue|problem|error|bug|crash|fail)\b/i,
    /\b(why (is|does|doesn't|isn't)|what's wrong|what happened)\b/i,
    /\bcan you (fix|repair|help|solve)\b/i,
  ];
  fixPatterns.forEach(pattern => {
    if (pattern.test(lowerMessage)) scores.fix += 1;
  });

  // DIAGNOSTIC intent signals (understanding/analyzing)
  const diagnosticPatterns = [
    /\b(check|analyze|investigate|examine|review|audit|inspect|diagnose|explain|show me|tell me about)\b/i,
    /\b(what is|what does|how does|why does|where is|can you show)\b/i,
    /\b(status|health|performance|metrics|logs|errors)\b/i,
  ];
  diagnosticPatterns.forEach(pattern => {
    if (pattern.test(lowerMessage)) scores.diagnostic += 1;
  });

  // CASUAL intent signals (greetings, questions, small talk)
  const casualPatterns = [
    /^(hi|hey|hello|thanks|thank you|ok|okay|yes|no|sure|cool|great|nice|good|lol|haha)/i,
    /\b(how are you|what's up|good job|well done|appreciate it)\b/i,
  ];
  casualPatterns.forEach(pattern => {
    if (pattern.test(lowerMessage)) scores.casual += 2; // Higher weight to prevent false positives
  });

  // Determine highest scoring intent
  let intent: UserIntent = 'fix'; // Default to 'fix' (safest for Platform Healing)
  let maxScore = scores.fix;

  if (scores.build > maxScore) {
    intent = 'build';
    maxScore = scores.build;
  }
  if (scores.diagnostic > maxScore) {
    intent = 'diagnostic';
    maxScore = scores.diagnostic;
  }
  if (scores.casual > maxScore) {
    intent = 'casual';
    maxScore = scores.casual;
  }

  // If message is very short and has no matches, likely casual
  if (maxScore === 0 && message.length < 20) {
    intent = 'casual';
  }

  console.log(`[INTENT-SCORE] Message: "${message.substring(0, 80)}..." | Scores:`, scores, `| Intent: ${intent}`);
  
  return intent;
}

/**
 * Get maximum iterations allowed based on user intent
 * 🎯 REPLIT AGENT PARITY: Match Replit Agent's 30+ iteration capability
 */
export function getMaxIterationsForIntent(intent: UserIntent): number {
  switch (intent) {
    case 'build':
      return 35; // Full feature development with testing and refinement
    case 'fix':
      return 30; // Thorough debugging, fixes, and verification
    case 'diagnostic':
      return 30; // Deep investigation and comprehensive analysis
    case 'casual':
      return 15; // Allow demos and explorations to complete properly (increased from 5)
    default:
      return 30; // Safe default - favor completing work over conserving tokens
  }
}
