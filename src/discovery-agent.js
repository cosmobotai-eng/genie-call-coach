/**
 * Discovery Coach -- Generic real-time discovery call analysis
 *
 * Uses a configurable knowledge graph as the coaching context.
 * Categories, blind spots, and suggested questions come from the
 * knowledge graph -- not hardcoded. Swap the graph to rebrand.
 *
 * Works with any LLM via configurable provider.
 */

const { spawn } = require('child_process');

// ============================================================================
// KNOWLEDGE GRAPH -- edit this to change what the coach looks for
// ============================================================================
// Default categories. These drive what the coach scores and what gaps it flags.
// Replace with your own graph, or load from a JSON/YAML config file.

const DEFAULT_CATEGORIES = {
  current_reality: {
    name: 'Current Reality',
    description: 'Where the company is today -- tools, processes, team size',
    key_questions: [
      'What tools or systems are you currently using?',
      'How large is your team?',
      'What is working well right now?',
    ],
  },
  pain_points: {
    name: 'Pain Points',
    description: 'What\'s broken, slow, or frustrating',
    key_questions: [
      'What takes the most time that shouldn\'t?',
      'Where do things break down most often?',
      'What have you already tried to fix this?',
    ],
  },
  decision_process: {
    name: 'Decision Process',
    description: 'How decisions get made and who makes them',
    key_questions: [
      'How do you evaluate and choose new solutions?',
      'Who else would need to be involved in a decision like this?',
      'What\'s your timeline for making a change?',
    ],
  },
  budget_authority: {
    name: 'Budget & Authority',
    description: 'What this costs and who controls the purse',
    key_questions: [
      'What kind of budget do you have for this kind of solution?',
      'Are you the right person to make this call?',
      'What happened with similar efforts in the past?',
    ],
  },
  stakes: {
    name: 'Stakes & Urgency',
    description: 'What\'s the cost of inaction',
    key_questions: [
      'How is this problem affecting the business right now?',
      'What\'s the cost of doing nothing?',
      'Are there time pressure or events driving this?',
    ],
  },
};

// ============================================================================
// SYSTEM PROMPT -- generic coaching framework, not product-specific
// ============================================================================

const SYSTEM_PROMPT = `You are a real-time discovery call coach. You listen to sales call transcripts and help the rep ask better questions.

Your job:
1. Score what's been covered in each category (0-3)
2. Identify the biggest gaps
3. Suggest ONE high-impact question to ask next
4. Estimate how ready the deal is

## Categories

For each category:
- 0 = Not mentioned at all
- 1 = Touched briefly / vague (they said something but no specifics)
- 2 = Covered with specifics (names, numbers, dates, concrete examples)
- 3 = Thoroughly covered -- you have what you need

Score HARD. Generic mentions don't count. "We use AI" = 0. "We have 200 people using Copilot, about 40% daily" = 2+.

## Gap Logic

If a category scores 0-1, that means the deal is thin there. Flag it clearly.
If multiple categories are thin, the deal is early stage or the rep isn't asking deep enough.

## Suggested Question

Pick ONE question from the category with the biggest gap. The question should:
- Be natural, not interrogative
- Follow up on something they actually said
- Open up a thin section

## Response Format

Respond with valid JSON only. No markdown, no explanation outside the JSON.

{
  "coverage": {
    "current_reality": { "score": 0, "evidence": "what was said", "gap": "what's missing" },
    "pain_points": { "score": 0, "evidence": "", "gap": "" },
    "decision_process": { "score": 0, "evidence": "", "gap": "" },
    "budget_authority": { "score": 0, "evidence": "", "gap": "" },
    "stakes": { "score": 0, "evidence": "", "gap": "" }
  },
  "overall_score": 0,
  "max_score": 15,
  "nudge": {
    "question": "The exact question the rep should ask",
    "category": "weakest category key",
    "urgency": "low|medium|high"
  },
  "deal_readiness_pct": 0
}`;

// ============================================================================
// LLM PROVIDER -- plug in Anthropic, OpenAI, etc.
// ============================================================================

/**
 * Call an LLM with a prompt. Configure model and credentials via env vars.
 *
 * Supported providers:
 * - ANTHROPIC: uses claude CLI (Claude Max subscription) -- model via ANTHROPIC_MODEL
 * - OPENAI: uses OpenAI API -- key via OPENAI_API_KEY, model via OPENAI_MODEL
 *
 * Default: ANTHROPIC
 */
function callLLM(prompt, options = {}) {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const model = options.model || (provider === 'openai' ? 'gpt-4o' : 'sonnet');

  return new Promise((resolve, reject) => {
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        reject(new Error('OPENAI_API_KEY not set'));
        return;
      }
      const http = require('http');
      const body = JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 2048 });
      const req = http.request({
        hostname: 'api.openai.com', path: '/v1/chat/completions',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content || '');
          } catch { reject(new Error(`OpenAI parse error: ${data.slice(0, 200)}`)); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    } else {
      // Default: Anthropic via claude CLI
      const args = ['-p', '--model', model];
      if (options.system) {
        args.push('--system', options.system);
      }
      const proc = spawn('claude', args, { timeout: 300000 });
      let stdout = '', stderr = '';
      proc.stdout.on('data', d => stdout += d);
      proc.stderr.on('data', d => stderr += d);
      proc.on('close', (code) => {
        if (code !== 0) { reject(new Error(`claude CLI failed (exit ${code}): ${stderr.slice(0, 500)}`)); return; }
        resolve(stdout.trim());
      });
      proc.on('error', reject);
      proc.stdin.write(prompt);
      proc.stdin.end();
    }
  });
}

// ============================================================================
// CORE ANALYSIS ENGINE
// ============================================================================

/**
 * Build the user prompt from a transcript and categories.
 */
function buildUserPrompt(transcript, categories, previousAnalysis = null) {
  const categoryDescriptions = Object.entries(categories).map(([key, cat]) =>
    `## ${cat.name} (${key})\n${cat.description}\nKey questions to cover: ${cat.key_questions.join('; ')}`
  ).join('\n\n');

  let userPrompt = `${SYSTEM_PROMPT}\n\n## Your Coaching Categories\n\n${categoryDescriptions}\n\n`;

  if (previousAnalysis) {
    userPrompt += `## Previous Analysis (what's already been covered)\n${JSON.stringify(previousAnalysis.coverage, null, 2)}\n\n`;
  }

  const transcriptText = transcript.map(entry =>
    `${entry.speaker || 'Speaker'}: ${entry.text}`
  ).join('\n');

  userPrompt += `## Transcript\n${transcriptText}`;

  return userPrompt;
}

/**
 * Parse JSON from LLM response -- handles markdown wrappers.
 */
function parseLLMResponse(response) {
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  const braceStart = jsonStr.indexOf('{');
  if (braceStart > 0) jsonStr = jsonStr.slice(braceStart);
  return JSON.parse(jsonStr);
}

/**
 * Analyze discovery call transcript coverage.
 *
 * @param {Array<{text: string, speaker?: string, timestamp?: string}>} transcript
 * @param {object|null} previousAnalysis -- prior analysis for continuity
 * @param {object} options -- { model, categories }
 * @returns {Promise<object>} structured coverage analysis
 */
async function analyzeDiscoveryCoverage(transcript, previousAnalysis = null, options = {}) {
  const categories = options.categories || DEFAULT_CATEGORIES;
  const model = options.model;

  const userPrompt = buildUserPrompt(transcript, categories, previousAnalysis);
  const response = await callLLM(userPrompt, { model, system: SYSTEM_PROMPT });

  try {
    const analysis = parseLLMResponse(response);

    if (!analysis.coverage) analysis.coverage = {};
    if (!analysis.overall_score && analysis.overall_score !== 0) {
      analysis.overall_score = Object.values(analysis.coverage)
        .reduce((sum, cat) => sum + (cat.score || 0), 0);
    }
    if (!analysis.max_score) analysis.max_score = Object.keys(categories).length * 3;
    if (!analysis.deal_readiness_pct && analysis.deal_readiness_pct !== 0) {
      analysis.deal_readiness_pct = Math.round((analysis.overall_score / analysis.max_score) * 100);
    }
    if (!analysis.nudge) {
      analysis.nudge = { question: '', category: '', urgency: 'low' };
    }

    return analysis;
  } catch (parseErr) {
    console.error('[Discovery] Failed to parse LLM response:', parseErr.message);
    return {
      coverage: Object.fromEntries(
        Object.keys(categories).map(k => [k, { score: 0, evidence: '', gap: 'Analysis failed' }])
      ),
      overall_score: 0,
      max_score: Object.keys(categories).length * 3,
      deal_readiness_pct: 0,
      nudge: { question: 'Unable to analyze transcript', category: '', urgency: 'low' },
    };
  }
}

/**
 * Decide whether to send a mid-call nudge.
 *
 * @param {object} current -- current analysis
 * @param {object|null} previous -- previous analysis
 * @param {number} elapsedMinutes -- minutes since recording started
 * @returns {boolean}
 */
function shouldNudge(current, previous, elapsedMinutes) {
  if (!current || !current.nudge || !current.nudge.question) return false;
  if (elapsedMinutes < 2) return false;

  // No previous -- nudge if any category is 0 and we're past 5 min
  if (!previous) {
    return Object.values(current.coverage).some(c => c.score === 0) && elapsedMinutes >= 5;
  }

  // Don't nudge same category twice in a row within 25 min
  const lastCat = previous.nudge?.category;
  if (lastCat && current.nudge.category === lastCat) {
    if (elapsedMinutes < 25) return false;
    const score = current.coverage[current.nudge.category]?.score || 0;
    if (score > 0) return false;
  }

  // After 25 min, nudge on any zero
  if (elapsedMinutes >= 25) {
    return Object.values(current.coverage).some(c => c.score === 0);
  }

  return current.nudge.category !== lastCat;
}

module.exports = {
  analyzeDiscoveryCoverage,
  shouldNudge,
  DEFAULT_CATEGORIES,
};
