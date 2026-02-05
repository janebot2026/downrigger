const fs = require('fs-extra');
const path = require('path');
const Mustache = require('mustache');

/**
 * Conversation Memory - Trading-Only Preference Capture
 * 
 * Captures user messages as preference candidates, requires explicit
 * confirmation before pinning to knowledge/pinned/CONSTITUTION.md
 * 
 * Prevents "LLM drift" - bot doesn't silently change behavior from chat.
 */

// Patterns that might indicate a preference
const PREFERENCE_PATTERNS = [
  // Risk tolerance statements
  /(?:i want|prefer|like|don't want|hate)\s+(?:to |)\s*(?:keep|maintain|have)\s+(?:risk|drawdown|loss)\s+(?:under|below|at)\s+(\d+)%?/i,
  /(?:i'm|i am)\s+(?:comfortable with|okay with|fine with)\s+(\d+)%?\s+(?:risk|drawdown)/i,
  /(?:don't|never)\s+(?:risk|trade|use)\s+(?:more than|over)\s+(\d+)%?/i,
  
  // Strategy preferences
  /(?:prefer|like|want)\s+(?:to |)(?:trade|use)\s+(trend|breakout|mean reversion)/i,
 / (?:don't|never)\s+(?:like|want|trade)\s+(memes|shitcoins|low cap)/i,
  
  // Time/schedule preferences  
  /(?:don't|never)\s+(?:trade|hold)\s+(?:overnight|weekend|after)/i,
  /(?:only|prefer)\s+(?:to |)trade\s+(?:during|in)\s+(?:us|european|asian)\s+hours?/i,
  
  // Notification preferences
  /(?:tell me|let me know|notify me|alert me)\s+(?:when|if)\s+(.+)/i,
  /(?:don't|never)\s+(?:bug|spam|notify)\s+me\s+(?:about|with)\s+(.+)/i,
  
  // Position preferences
  /(?:prefer|like)\s+(?:to |)hold\s+(?:only |)(\d+)\s+(?:positions?|trades?)/i,
  /(?:don't|never)\s+(?:want|hold)\s+(?:more than|over)\s+(\d+)\s+(?:positions?|trades?)/i
];

// Extract potential preference from message
function extractPreferenceCandidate(message, context = {}) {
  for (const pattern of PREFERENCE_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        id: `pref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        detected_at: new Date().toISOString(),
        source_message: message,
        detected_pattern: pattern.toString(),
        extracted_value: match[1] || match[0],
        category: inferCategory(pattern, message),
        confidence: calculateConfidence(message, match),
        requires_confirmation: true,
        suggested_constitution_entry: generateConstitutionSuggestion(message, match),
        context: {
          conversation_id: context.conversationId || null,
          timestamp: context.timestamp || new Date().toISOString(),
          user: context.user || 'unknown'
        }
      };
    }
  }
  return null;
}

// Infer category from pattern and message
function inferCategory(pattern, message) {
  const lowerMsg = message.toLowerCase();
  if (/risk|drawdown|loss/.test(lowerMsg)) return 'risk_tolerance';
  if (/trend|breakout|mean reversion|strategy/.test(lowerMsg)) return 'strategy_preference';
  if (/overnight|weekend|hours|time/.test(lowerMsg)) return 'schedule_preference';
  if (/notify|alert|tell me|let me know/.test(lowerMsg)) return 'notification_preference';
  if (/position|hold|trade count/.test(lowerMsg)) return 'position_preference';
  return 'general_preference';
}

// Calculate confidence score (0-1)
function calculateConfidence(message, match) {
  let score = 0.5;
  
  // Strong preference words increase confidence
  if (/\b(prefer|always|never|only)\b/i.test(message)) score += 0.2;
  
  // Explicit numbers increase confidence
  if (/\d+%?/.test(match[0])) score += 0.15;
  
  // Direct statements increase confidence
  if (/\b(i want|i need|i prefer)\b/i.test(message)) score += 0.1;
  
  // Uncertainty decreases confidence
  if (/\b(maybe|sometimes|might|could)\b/i.test(message)) score -= 0.2;
  
  return Math.min(1, Math.max(0, score));
}

// Generate suggested constitution entry
function generateConstitutionSuggestion(message, match) {
  // Simple templating - in production this might use LLM
  const lowerMsg = message.toLowerCase();
  
  if (/risk|drawdown/.test(lowerMsg)) {
    return `Risk Tolerance: ${match[1] || 'specified'}% max drawdown`;
  }
  if (/trend|breakout|mean reversion/.test(lowerMsg)) {
    return `Preferred Strategy: ${match[1]} trading`;
  }
  if (/overnight|weekend/.test(lowerMsg)) {
    return 'Schedule: No overnight/weekend positions';
  }
  if (/notify|alert/.test(lowerMsg)) {
    return `Notifications: ${match[1] || 'as requested'}`;
  }
  
  return `Preference: ${message.slice(0, 100)}...`;
}

// Load candidates from file
async function loadCandidates(targetDir) {
  const candidatesPath = path.join(targetDir, 'knowledge', 'candidates', 'preferences.json');
  
  if (!await fs.pathExists(candidatesPath)) {
    return { candidates: [], confirmed: [], rejected: [] };
  }
  
  try {
    return await fs.readJson(candidatesPath);
  } catch {
    return { candidates: [], confirmed: [], rejected: [] };
  }
}

// Save candidates to file
async function saveCandidates(targetDir, data) {
  const candidatesPath = path.join(targetDir, 'knowledge', 'candidates', 'preferences.json');
  await fs.ensureDir(path.dirname(candidatesPath));
  await fs.writeJson(candidatesPath, data, { spaces: 2 });
}

// Capture a potential preference from chat
async function capturePreference(targetDir, message, context = {}) {
  const candidate = extractPreferenceCandidate(message, context);
  
  if (!candidate) {
    return null; // No preference detected
  }
  
  // Skip if confidence too low
  if (candidate.confidence < 0.5) {
    return null;
  }
  
  const data = await loadCandidates(targetDir);
  
  // Check for duplicates (similar message within 24h)
  const isDuplicate = data.candidates.some(c => 
    c.source_message === message || 
    (new Date() - new Date(c.detected_at)) < 24 * 60 * 60 * 1000
  );
  
  if (isDuplicate) {
    return null;
  }
  
  data.candidates.push(candidate);
  await saveCandidates(targetDir, data);
  
  return candidate;
}

// Confirm a candidate - move to constitution
async function confirmPreference(targetDir, candidateId) {
  const data = await loadCandidates(targetDir);
  const index = data.candidates.findIndex(c => c.id === candidateId);
  
  if (index === -1) {
    throw new Error(`Candidate ${candidateId} not found`);
  }
  
  const candidate = data.candidates[index];
  
  // Move to confirmed
  candidate.confirmed_at = new Date().toISOString();
  data.confirmed.push(candidate);
  data.candidates.splice(index, 1);
  
  await saveCandidates(targetDir, data);
  
  // Add to constitution
  await addToConstitution(targetDir, candidate);
  
  return candidate;
}

// Reject a candidate
async function rejectPreference(targetDir, candidateId, reason = '') {
  const data = await loadCandidates(targetDir);
  const index = data.candidates.findIndex(c => c.id === candidateId);
  
  if (index === -1) {
    throw new Error(`Candidate ${candidateId} not found`);
  }
  
  const candidate = data.candidates[index];
  candidate.rejected_at = new Date().toISOString();
  candidate.reject_reason = reason;
  
  data.rejected.push(candidate);
  data.candidates.splice(index, 1);
  
  await saveCandidates(targetDir, data);
  
  return candidate;
}

// Add confirmed preference to constitution
async function addToConstitution(targetDir, candidate) {
  const constitutionPath = path.join(targetDir, 'knowledge', 'pinned', 'CONSTITUTION.md');
  
  if (!await fs.pathExists(constitutionPath)) {
    return;
  }
  
  let content = await fs.readFile(constitutionPath, 'utf8');
  
  // Add to User Preferences section (create if doesn't exist)
  const entry = `\n- **${candidate.category}**: ${candidate.suggested_constitution_entry} (confirmed: ${candidate.confirmed_at})`;
  
  if (content.includes('## User Preferences')) {
    content = content.replace(
      /## User Preferences\n/,
      `## User Preferences\n${entry}\n`
    );
  } else {
    content += `\n\n## User Preferences\n${entry}\n`;
  }
  
  await fs.writeFile(constitutionPath, content);
}

// Get pending candidates for review
async function getPendingCandidates(targetDir) {
  const data = await loadCandidates(targetDir);
  return data.candidates;
}

// Get formatted summary for chat
async function getCandidatesSummary(targetDir) {
  const data = await loadCandidates(targetDir);
  
  if (data.candidates.length === 0) {
    return 'No pending preference candidates.';
  }
  
  const summary = data.candidates.map(c => 
    `- "${c.source_message.slice(0, 60)}..." → ${c.suggested_constitution_entry} [${c.confidence > 0.7 ? 'high' : 'medium'} confidence]`
  ).join('\n');
  
  return `I noticed ${data.candidates.length} potential preference${data.candidates.length > 1 ? 's' : ''} in our conversation:\n${summary}\n\nShould I add any of these to your CONSTITUTION? (Reply with the number or "none")`;
}

module.exports = {
  extractPreferenceCandidate,
  capturePreference,
  confirmPreference,
  rejectPreference,
  getPendingCandidates,
  getCandidatesSummary,
  loadCandidates,
  PREFERENCE_PATTERNS
};
