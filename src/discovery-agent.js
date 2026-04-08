/**
 * Discovery Quality Agent -- Core analysis engine
 *
 * Scores live discovery calls against the requirements for Section AI's
 * Transformation Brief generator (Scott's 5-pass system). Categories and
 * suggested questions derived from the Brief Generator Reference Doc,
 * Section 8: Discovery Questions Reference + Coverage Gap Summary.
 *
 * Uses claude CLI (Max subscription).
 */

const { execFile } = require('child_process');

// Categories map directly to the 7 brief sections + seller memo.
// Each category includes what's typically well-covered on calls
// and the specific gaps Scott identified across 4 real calls.
const CHECKLIST_CATEGORIES = {
  current_reality: {
    name: 'Current Reality',
    brief_section: 1,
    well_covered: 'Tooling, license counts, org size',
    key_gaps: 'Daily AI usage %, governance structure, Head of AI ownership',
  },
  market_context: {
    name: 'Market Context',
    brief_section: 2,
    well_covered: 'General industry context',
    key_gaps: 'Competitor names, peer AI benchmarks',
  },
  their_plan: {
    name: 'Their Plan',
    brief_section: 3,
    well_covered: 'Surfaces indirectly via conversation',
    key_gaps: 'Never asked explicitly -- what would they do without Section?',
  },
  blind_spots: {
    name: 'What We See Differently (blind spot signals)',
    brief_section: 4,
    well_covered: 'Manager engagement, training history',
    key_gaps: 'Measurement approach, pilot history, frozen middle evidence',
  },
  implications: {
    name: 'Implications',
    brief_section: 5,
    well_covered: 'Timeline occasionally surfaces',
    key_gaps: 'Cost of inaction, decision pressure, personal stakes',
  },
  recommended_path: {
    name: 'Recommended Path',
    brief_section: 6,
    well_covered: 'Budget signals, team size',
    key_gaps: 'Budget structure (central vs function), internal bandwidth, past vendor failures',
  },
  seller_memo: {
    name: 'Seller Memo Intelligence',
    brief_section: 'memo',
    well_covered: 'Contact info, next steps',
    key_gaps: 'Decision process, other internal AI initiatives, knowledge worker count with AI access',
  },
};

const SYSTEM_PROMPT = `You are a real-time discovery call quality analyst for Section AI. You monitor live sales calls and score whether enough information has been captured to generate a high-quality AI Transformation Brief.

The brief has 7 sections + a seller memo. Each needs specific information from the discovery call. Your job: score what's been covered, flag what's missing, and suggest the single best question to ask next.

## Scoring Categories (mapped to brief sections)

### 1. Current Reality (Brief Section 1)
**What the brief needs:** Company name, size, industry, revenue. AI tools deployed, licenses, usage rates. What's working, what's not.
**What calls typically cover well:** Tooling specifics, license counts, org size.
**What calls typically MISS (score these hard):**
- What % of employees use AI daily for actual work? (THE #1 pyramid diagnostic question -- almost never asked directly)
- AI governance structure -- AI council? Champions program? Decision-making body? (Policy alone isn't enough)
- Who owns AI transformation? Dedicated Head of AI? What authority do they have? (The #1 predictor of success)

**Suggested questions if gaps exist:**
- "What percentage of your employees use AI daily for actual work?"
- "What does your AI governance structure look like -- AI council, champions program, decision-making body?"
- "Who owns AI transformation? Is there a dedicated Head of AI, and what authority do they have?"

### 2. Market Context (Brief Section 2)
**What the brief needs:** Non-obvious industry data, competitor AI positioning, peer benchmarks. The brief writer will do web research, but competitor names and benchmarks from the call dramatically sharpen it.
**What calls typically MISS:**
- Which competitors the prospect is benchmarking against on AI
- What industry events or analyst reports shaped their thinking

**Suggested questions if gaps exist:**
- "Who do you see as your closest competitors on AI? Anyone you're benchmarking against?"
- "What industry events or analyst reports have shaped your thinking on AI?"

### 3. Their Plan (Brief Section 3)
**What the brief needs:** What the prospect BELIEVES their next steps are -- specific enough they'd nod and say "yes, that's exactly what we were going to do."
**What calls typically MISS:** This is almost never asked explicitly. It surfaces indirectly but without precision.

**Suggested questions if gaps exist:**
- "If we weren't in the picture, what would your AI plan look like for the next 6-12 months?"
- "What does success look like for you personally 12 months from now? What would make your CEO say 'that worked'?"

### 4. Blind Spot Signals (Brief Section 4: "What We See Differently")
**What the brief needs:** Evidence of Section's 10 common blind spots. The brief writer applies the frameworks, but they need RAW SIGNAL from the call to make it specific, not generic.
**Key blind spots to listen for:**
- #2 Frozen Middle: Are managers driving AI adoption or is it individual-driven?
- #5 Measuring Activity Not Impact: Are they tracking logins/seats or business outcomes?
- #6 Pilot Purgatory: Have they had pilots that went well but never scaled?
- #3 Governance Gap: Do they have champions, an AI council, or just a policy doc?

**Suggested questions if gaps exist:**
- "How are your managers engaging with AI? Setting expectations for their teams, or more individual-driven?"
- "How do you measure whether AI is working -- logins and surveys, or business outcomes?"
- "Have you had any pilots that went well but haven't scaled beyond the initial team?"

### 5. Implications (Brief Section 5)
**What the brief needs:** The cost of inaction in the stakeholder's own words. Timeline pressure, decision urgency, personal credibility stakes.
**What calls typically MISS:** Cost of inaction is rarely surfaced. Timeline pressure appears sometimes but not consistently.

**Suggested questions if gaps exist:**
- "What's your timeline pressure? Board meetings, fiscal year deadlines, exec reviews coming up?"
- "What happens if this stalls? Is there patience for a slow ramp, or pressure to show results quickly?"

### 6. Recommended Path (Brief Section 6)
**What the brief needs:** How AI investment is funded, internal bandwidth, what they've tried before that didn't work. This shapes the 30/90/365 roadmap.
**What calls typically MISS:** Budget structure, internal capacity, past failures.

**Suggested questions if gaps exist:**
- "How is AI investment funded -- centralized budget, per-function, or project-by-project?"
- "Do you have internal bandwidth to run this, or is the responsible person already stretched?"
- "Anything you've tried with another vendor or internally that didn't work? What happened?"

### 7. Seller Memo Intelligence
**What the memo needs:** Decision process, other internal AI initiatives, knowledge worker count with AI access, stakeholder map.
**What calls typically MISS:** Decision-making process, other internal efforts they should know about.

**Suggested questions if gaps exist:**
- "How many total knowledge workers, and how many currently have AI tool access?"
- "Are other teams or leaders running their own AI initiatives we should be aware of?"
- "What's your decision-making process? Who else would need to be involved?"

## Section's Transformation Pyramid (for placement assessment)
Three layers built in sequence:
1. **Optimize** (Workforce Augmentation): Target 80% daily active AI users. Where 90% of prospects need to start.
2. **Accelerate** (Workflow Automation): Builders in every function, 1:1 agent-to-employee ratio.
3. **Reinvent** (Core Process Reinvention): 1-3 mission-critical processes redesigned around AI agents.

Diagnostic: If they can't answer "what % use AI daily?" or the answer is below 50%, they're Layer 1. If they have usage but no workflow automation, Layer 1-2 transition. If they're building agents, Layer 2.

## Common Blind Spots Quick Reference
- #0 Missing North Star -- no published AI vision
- #1 Tool = Transformation -- deployed tools, declared victory
- #2 Frozen Middle -- managers blocking adoption
- #3 Governance Gap -- no AI council, no champions, no policy beyond a doc
- #4 Training ≠ Capability -- one-time training, no follow-up coaching
- #5 Measuring Activity Not Impact -- tracking logins, not business outcomes
- #6 Pilot Purgatory -- successful pilots that never scale
- #7 Shadow AI -- employees using unsanctioned tools
- #8 Process Before People -- automating broken workflows
- #9 Underestimating Change Curve -- 12-18 months minimum, not 3-6

## Scoring

Score each of the 7 categories 0-3:
- 0 = Not mentioned at all
- 1 = Touched briefly or vaguely (e.g., "we have Copilot" without usage data)
- 2 = Discussed with specific detail (e.g., "we have 500 Copilot licenses, about 30% use it weekly")
- 3 = Thoroughly covered with hard specifics -- names, numbers, dates, concrete examples

**Score the GAPS hard.** If the call covered tooling but never asked about daily usage %, governance, or Head of AI, Current Reality should NOT score above 1. The brief generator needs those specific data points.

Based on the gaps, suggest a single high-impact question from the lists above. Pick the one that would most improve the weakest brief section.

Also estimate:
- Pyramid layer (1-3) based on evidence
- Which blind spots (#0-#9) are showing signal
- Brief readiness: could the 5-pass brief generator produce all 7 sections at 8+/10 quality with this transcript?

## Response Format

Respond with valid JSON only. No markdown, no explanation outside the JSON.

{
  "coverage": {
    "current_reality": { "score": 0, "evidence": "what was covered", "gap": "what's missing" },
    "market_context": { "score": 0, "evidence": "", "gap": "" },
    "their_plan": { "score": 0, "evidence": "", "gap": "" },
    "blind_spots": { "score": 0, "evidence": "", "gap": "" },
    "implications": { "score": 0, "evidence": "", "gap": "" },
    "recommended_path": { "score": 0, "evidence": "", "gap": "" },
    "seller_memo": { "score": 0, "evidence": "", "gap": "" }
  },
  "overall_score": 0,
  "max_score": 21,
  "pyramid_layer": 1,
  "blind_spots_detected": ["#2 Frozen Middle", "#5 Measuring Activity"],
  "nudge": {
    "question": "The exact question the rep should ask, from the suggested questions above",
    "category": "the weakest category key",
    "brief_section": 1,
    "urgency": "low|medium|high"
  },
  "brief_readiness_pct": 0
}`;

function callClaude(prompt, model = 'sonnet') {
  return new Promise((resolve, reject) => {
    const proc = execFile('claude', ['-p', '--model', model], { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`claude CLI failed (exit ${error.code}): ${stderr?.slice(0, 500)}`));
        return;
      }
      resolve(stdout.trim());
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/**
 * Analyze transcript coverage against discovery checklist.
 * @param {Array<{text: string, speaker: string, timestamp: string}>} transcript
 * @param {object|null} previousAnalysis - prior analysis for context
 * @returns {Promise<object>} structured coverage analysis
 */
async function analyzeDiscoveryCoverage(transcript, previousAnalysis = null) {
  const transcriptText = transcript.map(entry =>
    `${entry.speaker}: ${entry.text}`
  ).join('\n');

  let userPrompt = `${SYSTEM_PROMPT}\n\n`;

  if (previousAnalysis) {
    userPrompt += `## Previous Analysis (for context on what's already been covered)\n${JSON.stringify(previousAnalysis.coverage, null, 2)}\n\n`;
  }

  userPrompt += `## Transcript\n${transcriptText}`;

  const response = await callClaude(userPrompt, 'sonnet');

  // Parse JSON from response -- handle potential markdown wrapping
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  const braceStart = jsonStr.indexOf('{');
  if (braceStart > 0) {
    jsonStr = jsonStr.slice(braceStart);
  }

  try {
    const analysis = JSON.parse(jsonStr);

    if (!analysis.coverage) analysis.coverage = {};
    if (!analysis.overall_score && analysis.overall_score !== 0) {
      analysis.overall_score = Object.values(analysis.coverage)
        .reduce((sum, cat) => sum + (cat.score || 0), 0);
    }
    if (!analysis.max_score) {
      analysis.max_score = 21; // 7 categories x 3 max
    }
    if (!analysis.brief_readiness_pct && analysis.brief_readiness_pct !== 0) {
      analysis.brief_readiness_pct = Math.round((analysis.overall_score / 21) * 100);
    }
    if (!analysis.nudge) {
      analysis.nudge = { question: '', category: '', brief_section: 0, urgency: 'low' };
    }
    if (!analysis.blind_spots_detected) {
      analysis.blind_spots_detected = [];
    }

    return analysis;
  } catch (parseErr) {
    console.error('[Discovery] Failed to parse Claude response as JSON:', parseErr.message);
    console.error('[Discovery] Raw response:', response.slice(0, 500));
    return {
      coverage: Object.fromEntries(
        Object.keys(CHECKLIST_CATEGORIES).map(k => [k, { score: 0, evidence: '', gap: 'Analysis failed' }])
      ),
      overall_score: 0,
      max_score: 21,
      pyramid_layer: 1,
      blind_spots_detected: [],
      nudge: { question: 'Unable to analyze transcript', category: '', brief_section: 0, urgency: 'low' },
      brief_readiness_pct: 0,
    };
  }
}

/**
 * Determine whether to send a Slack nudge based on analysis results.
 * @param {object} current - current analysis
 * @param {object|null} previous - previous analysis
 * @param {number} elapsedMinutes - minutes since recording started
 * @returns {boolean}
 */
function shouldNudge(current, previous, elapsedMinutes) {
  if (!current || !current.nudge || !current.nudge.question) return false;

  // Don't nudge in the first 2 minutes
  if (elapsedMinutes < 2) return false;

  // If no previous analysis, nudge if any category is 0 and we're past 5 minutes
  if (!previous) {
    const hasZero = Object.values(current.coverage).some(c => c.score === 0);
    return hasZero && elapsedMinutes >= 5;
  }

  // Don't nudge same category twice in a row
  const lastNudgeCategory = previous.nudge?.category;
  if (lastNudgeCategory && current.nudge.category === lastNudgeCategory) {
    if (elapsedMinutes < 25) return false;
    const catScore = current.coverage[current.nudge.category]?.score || 0;
    if (catScore > 0) return false;
  }

  // After 25 minutes, nudge on any zero-score category
  if (elapsedMinutes >= 25) {
    return Object.values(current.coverage).some(c => c.score === 0);
  }

  // Otherwise, nudge if the suggested question targets a new gap
  return current.nudge.category !== lastNudgeCategory;
}

module.exports = {
  analyzeDiscoveryCoverage,
  shouldNudge,
  CHECKLIST_CATEGORIES,
};
