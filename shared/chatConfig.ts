export type UserIntent = 'build' | 'fix' | 'diagnostic' | 'casual';

export function classifyUserIntent(message: string): UserIntent {
  const lowerMessage = message.toLowerCase();
  
  let scores = { build: 0, fix: 0, diagnostic: 0, casual: 0 };
  
  const buildPatterns = [
    /\b(build|creat|add|implement|mak|develop|writ)/g,
    /\b(set up|setup|install|integrat|deploy|publish)/g,
    /\b(plan|design|architect|outline|draft|prepar|document)/g,
    /\b(migrat|refactor|restructur|reorganiz)/g,
    /\b(new feature|new module|new component|new page)/g,
  ];
  buildPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.build += matches.length * (idx < 3 ? 3 : idx === 3 ? 2 : 4);
    }
  });
  
  const fixPatterns = [
    /\b(fix|repair|resolve|solve|debug|correct|patch)\b/g,
    /\b(update|modify|change|improve|optimize|enhance)\b/g,
    /\b(broken|bug|error|issue|problem|crash|fail)\b/g,
    /\b(not working|doesn\'t work|won\'t run|failing)\b/g,
  ];
  fixPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.fix += matches.length * (idx === 1 ? 2 : idx === 3 ? 4 : 3);
    }
  });
  
  const diagnosticPatterns = [
    /\b(diagnos|investigat|analyz|examine|inspect)\b/g,
    /\b(check|review|scan|search|find|look)\b/g,
    /\b(what.*wrong|why.*not|how.*work|what.*happen)\b/g,
    /\b(status|health|metrics|logs|telemetry)\b/g,
  ];
  diagnosticPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.diagnostic += matches.length * (idx === 1 ? 1 : 3);
    }
  });
  
  const casualPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure)$/,
    /\b(hi|hello|hey|thanks|cool|nice|great|awesome)\b/g,
  ];
  casualPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.casual += matches.length * (idx === 0 ? 5 : 2);
    }
  });
  
  if (lowerMessage.length < 30 && scores.casual > 0) {
    scores.casual += 3;
  }
  if (lowerMessage.length < 50 && Object.values(scores).every(s => s === 0)) {
    scores.casual += 2;
  }
  
  const maxScore = Math.max(...Object.values(scores));
  let intent: UserIntent;
  
  if (maxScore === 0) {
    intent = 'build';
  } else {
    const priorityOrder: UserIntent[] = ['build', 'fix', 'diagnostic', 'casual'];
    intent = priorityOrder.find(key => scores[key] === maxScore) || 'build';
  }
  
  console.log(`[INTENT-SCORE] Message: "${message.substring(0, 80)}..." | Scores:`, scores, `| Intent: ${intent}`);
  
  return intent;
}

export function getMaxIterationsForIntent(intent: UserIntent): number {
  return 30;
}
