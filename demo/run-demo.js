/**
 * Genie Call Coach — Phase 1 Demo Runner
 * 
 * Runs a full coaching demo using mock transcript data.
 * Simulates a 14-minute discovery call with real-time coaching updates.
 * 
 * Usage: node demo/run-demo.js [--mock-llm] [--speed=<1-10>]
 *   --mock-llm: Use pre-written coaching responses (no API key needed)
 *   --speed: Playback speed multiplier (default: 1, use 10 for fast demo)
 */

const { getTranscriptUpTo, getFullTranscript, CALL_SCRIPT } = require('./mock-transcript');
const fs = require('fs');
const path = require('path');

// Parse args
const mockLLM = process.argv.includes('--mock-llm');
const speedArg = process.argv.find(a => a.startsWith('--speed='));
const speed = speedArg ? parseInt(speedArg.split('=')[1]) : 1;

// Real elapsed time tracking
const DEMO_START_TIME = Date.now();
const ANALYSIS_INTERVAL_MS = 90000; // 90 seconds in real time
const TOTAL_CALL_MS = 14 * 60 * 1000; // 14 minutes

let currentAnalysis = null;
let nudgeHistory = [];
let analysisCount = 0;

// ============================================================================
// Scorecard Categories — generic sales discovery framework
// ============================================================================
const SCORECARD = {
  current_reality: { name: 'Current Reality', weight: 1.0, score: 0, evidence: [] },
  pain_points: { name: 'Pain Points', weight: 1.0, score: 0, evidence: [] },
  decision_process: { name: 'Decision Process', weight: 0.8, score: 0, evidence: [] },
  budget_authority: { name: 'Budget & Authority', weight: 0.8, score: 0, evidence: [] },
  stakes: { name: 'Stakes & Urgency', weight: 0.7, score: 0, evidence: [] },
  competition: { name: 'Competitive Landscape', weight: 0.6, score: 0, evidence: [] },
  next_steps: { name: 'Next Steps', weight: 1.0, score: 0, evidence: [] },
};

// ============================================================================
// Mock LLM Coaching Responses (used when --mock-llm)
// ============================================================================
const MOCK_RESPONSES = {
  1: {
    overall_score: 3,
    coverage: {
      current_reality: { score: 2, evidence: 'Discussed ops team of 6, 15 hrs/wk on manual data entry, Salesforce+Slack+ERP in three different places.' },
      pain_points: { score: 2, evidence: 'Board deck late, customer 2-week onboarding lag costing revenue, two salaries doing data entry.' },
      decision_process: { score: 1, evidence: 'Jordan is decision-maker but no detail on process or other stakeholders.' },
      budget_authority: { score: 1, evidence: 'Friction from CFO on ROI, no specific budget discussed.' },
      stakes: { score: 2, evidence: 'Clear urgency: Q2 POC target, CFO pressuring on data entry costs.' },
      competition: { score: 2, evidence: 'Looked at Zapier (outgrew it), Workato (too expensive). Build-it-yourself approach resonates.' },
      next_steps: { score: 0, evidence: 'None established yet.' },
    },
    nudge: {
      category: 'decision_process',
      message: '"Who else is involved in decisions like this at TechFlow?"',
      rationale: 'You have Jordan\'s perspective but no visibility into how other stakeholders view the problem.',
    },
    pyramid_layer: 2,
    brief_readiness_pct: 35,
  },
  2: {
    overall_score: 5,
    coverage: {
      current_reality: { score: 3, evidence: 'Ops team of 6, 2 dedicated to data entry, 15 hrs/wk backlog, 3 data sources with no single source of truth.' },
      pain_points: { score: 3, evidence: 'Revenue loss from onboarding lag, board deck delays, hiring to solve process problem.' },
      decision_process: { score: 2, evidence: 'Jordan is recommendation + budget authority, CFO needs ROI proof.' },
      budget_authority: { score: 2, evidence: 'CFO skeptical of tools that create more work. No specific budget yet but pressure exists.' },
      stakes: { score: 3, evidence: 'Q2 POC target, two salaries as operational cost, lost revenue from data gaps.' },
      competition: { score: 3, evidence: 'Zapier outgrown, Workato too expensive. No current vendor. "Build it yourself" framing resonates.' },
      next_steps: { score: 1, evidence: 'Thursday 2pm PT technical deep dive scheduled with ops leads.' },
    },
    nudge: {
      category: 'next_steps',
      message: '"What would the ops team\'s first week with us look like?"',
      rationale: 'Jordan\'s concern is implementation time. Concrete timeline details will help close the CFO ROI question.',
    },
    pyramid_layer: 3,
    brief_readiness_pct: 62,
  },
  3: {
    overall_score: 7,
    coverage: {
      current_reality: { score: 3, evidence: 'Ops team 6 people, 2 doing data entry, Salesforce+Slack+ERP, 3 data sources, "one source of truth" vision.' },
      pain_points: { score: 3, evidence: '$0 revenue lost from 2-week onboarding lag, board deck always late, hiring 2 people for repetitive work.' },
      decision_process: { score: 3, evidence: 'Jordan recommendation + budget authority, CFO needs ROI proof, ops leads involved in Thursday deep dive.' },
      budget_authority: { score: 3, evidence: 'CFO asking questions, hiring cost as baseline, Q2 pressure. Jordan has authority but needs ROI case.' },
      stakes: { score: 3, evidence: 'Q2 POC goal, CFO pressure, hiring costs, lost revenue. "Results in weeks not quarters" is the bar.' },
      competition: { score: 3, evidence: 'Zapier outgrown, Workato too expensive, DataSync referral, "build it yourself" resonates.' },
      next_steps: { score: 3, evidence: 'Thursday 2pm PT deep dive with ops leads. Jordan\'s hesitation: implementation speed.' },
    },
    nudge: null,
    pyramid_layer: 4,
    brief_readiness_pct: 88,
  },
};

// ============================================================================
// Mock LLM Analysis (no API key needed)
// ============================================================================
async function runMockAnalysis(transcriptEntries) {
  const elapsedMin = Math.floor((Date.now() - DEMO_START_TIME) / 60000);
  analysisCount++;
  
  // Pick the right mock response based on how much of the call we've seen
  const responseKey = Math.min(analysisCount, 3);
  const analysis = { ...MOCK_RESPONSES[responseKey] };
  
  return analysis;
}

// ============================================================================
// Real LLM Analysis (requires API key)
// ============================================================================
async function runRealAnalysis(transcriptEntries) {
  const transcript = transcriptEntries.map(e => `[${e.timestamp}] ${e.speaker}: ${e.text}`).join('\n');
  const prompt = `You are Genie, a sales call coaching assistant. Analyze this transcript segment and provide coaching feedback.

TRANSCRIPT:
${transcript}

Provide your analysis as a JSON object with:
{
  "overall_score": <0-7 based on discovery coverage>,
  "coverage": {
    "current_reality": {"score": <0-3>, "evidence": "<key evidence from transcript>"},
    "pain_points": {"score": <0-3>, "evidence": "<key evidence>"},
    "decision_process": {"score": <0-3>, "evidence": "<key evidence>"},
    "budget_authority": {"score": <0-3>, "evidence": "<key evidence>"},
    "stakes": {"score": <0-3>, "evidence": "<key evidence>"},
    "competition": {"score": <0-3>, "evidence": "<key evidence>"},
    "next_steps": {"score": <0-3>, "evidence": "<key evidence>"}
  },
  "nudge": {
    "category": "<weakest category>",
    "message": "<one specific question that would address this gap>",
    "rationale": "<why this question matters now>"
  },
  "pyramid_layer": <1-4>,
  "brief_readiness_pct": <0-100>
}`;

  try {
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
      const proc = spawn('claude', ['-p', '--model', 'sonnet'], { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) { reject(error); return; }
        resolve(stdout.trim());
      });
      proc.stdin.write(prompt);
      proc.stdin.end();
    }).then(JSON.parse);
  } catch (e) {
    console.warn('[Demo] LLM call failed, using mock:', e.message);
    return runMockAnalysis(transcriptEntries);
  }
}

// ============================================================================
// Analysis Runner
// ============================================================================
async function runAnalysis(transcriptEntries) {
  if (mockLLM) {
    return runMockAnalysis(transcriptEntries);
  }
  return runRealAnalysis(transcriptEntries);
}

// ============================================================================
// UI State
// ============================================================================
let uiState = {
  phase: 'connecting',
  meetingTitle: 'Jordan Chen — TechFlow Discovery Call',
  elapsedMs: 0,
  transcript: [],
  analysis: null,
  nudgeHistory: [],
  overallScore: 0,
  categories: SCORECARD,
  showNudge: false,
  currentNudge: null,
  finalReport: null,
};

function updateUI(state) {
  uiState = { ...uiState, ...state };
  // Write state to a file that the renderer can poll
  fs.writeFileSync(path.join(__dirname, 'ui-state.json'), JSON.stringify(uiState, null, 2));
}

function logToConsole(state) {
  const elapsedMin = Math.floor(state.elapsedMs / 60000);
  const elapsedSec = Math.floor((state.elapsedMs % 60000) / 1000);
  const time = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;
  
  console.clear();
  console.log('\n🟢 GENIE CALL COACH — LIVE DEMO');
  console.log('═'.repeat(60));
  console.log("  Meeting: " + state.meetingTitle);
  console.log("  Elapsed: " + time + " / 14:00");
  console.log('═'.repeat(60));
  
  if (state.phase === 'connecting') {
    console.log('\n  ⏳ Connecting to meeting...');
  } else if (state.phase === 'live') {
    const score = state.overallScore || 0;
    const pct = state.analysis?.brief_readiness_pct || 0;
    const bar = '█'.repeat(Math.floor(score / 7 * 20)) + '░'.repeat(20 - Math.floor(score / 7 * 20));
    console.log(`\n  📊 BRIEF READINESS: ${pct}%  [${bar}]`);
    console.log('\n  Category Coverage:');
    for (const [key, cat] of Object.entries(state.categories)) {
      const catScore = cat.score || 0;
      const catBar = '█'.repeat(catScore) + '░'.repeat(3 - catScore);
      const flag = catScore < 2 ? '⚠️ ' : catScore === 3 ? '✅' : '  ';
      const evidenceStr = String(cat.evidence || '');
      console.log("    " + flag + " " + cat.name.padEnd(22) + " " + catBar + " " + (evidenceStr ? "— " + evidenceStr.substring(0, 50) + "..." : ""));
    }
    
    if (state.showNudge && state.currentNudge) {
      console.log('\n  💬 COACHING NUDGE:');
      console.log(`     [${state.currentNudge.category.toUpperCase()}] "${state.currentNudge.message}"`);
      console.log(`     → ${state.currentNudge.rationale}`);
    }
    
    if (state.nudgeHistory && state.nudgeHistory.length > 0) {
      console.log('\n  📝 Previous nudges:');
      for (const n of state.nudgeHistory.slice(-2)) {
        console.log(`     • [${n.category}] "${n.message.substring(0, 60)}..."`);
      }
    }
  } else if (state.phase === 'ended') {
    console.log('\n  ✅ CALL ENDED — GENERATING FINAL REPORT...\n');
    if (state.finalReport) {
      console.log(state.finalReport.substring(0, 800));
    }
  }
}

// ============================================================================
// Main Demo Loop
// ============================================================================
async function runDemo() {
  console.log('\n🎙️  GENIE CALL COACH — PHASE 1 DEMO');
  console.log('   Mock discovery call: Alex (rep) × Jordan Chen, TechFlow');
  console.log(`   Mode: ${mockLLM ? 'MOCK LLM (no API key)' : 'REAL LLM (API key required)'}`);
  console.log(`   Speed: ${speed}x`);
  console.log('\n  Starting in 3 seconds...\n');
  await sleep(3000);

  // Phase 1: Connecting
  updateUI({ phase: 'connecting' });
  logToConsole(uiState);
  await sleep(2000 / speed);

  // Phase 2: Live call
  updateUI({ phase: 'live', meetingTitle: uiState.meetingTitle });
  
  const intervalMs = 3000; // Update transcript every 3 seconds
  let lastAnalysisMs = 0;
  
  while (Date.now() - DEMO_START_TIME < TOTAL_CALL_MS) {
    const elapsedMs = Date.now() - DEMO_START_TIME;
    
    // Get transcript entries up to current time
    const transcriptEntries = getTranscriptUpTo(elapsedMs);
    
    // Update UI with current state
    updateUI({
      elapsedMs,
      transcript: transcriptEntries,
    });
    logToConsole(uiState);
    
    // Run analysis every 90 seconds
    if (elapsedMs - lastAnalysisMs >= ANALYSIS_INTERVAL_MS) {
      lastAnalysisMs = elapsedMs;
      
      console.log(`\n  🔍 Running analysis at ${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}...`);
      
      try {
        const analysis = await runAnalysis(transcriptEntries);
        
        // Update category scores
        const newCategories = {};
        for (const [key, cat] of Object.entries(SCORECARD)) {
          const cov = analysis.coverage?.[key];
          newCategories[key] = {
            ...cat,
            score: cov?.score || 0,
            evidence: cov?.evidence || '',
          };
        }
        
        const showNudge = analysis.nudge && !nudgeHistory.some(n => n.category === analysis.nudge.category);
        
        if (analysis.nudge && showNudge) {
          nudgeHistory.push(analysis.nudge);
        }
        
        currentAnalysis = analysis;
        updateUI({
          analysis,
          overallScore: analysis.overall_score,
          categories: newCategories,
          showNudge,
          currentNudge: showNudge ? analysis.nudge : null,
          nudgeHistory: [...nudgeHistory],
        });
        logToConsole(uiState);
      } catch (e) {
        console.error('  ❌ Analysis error:', e.message);
      }
    }
    
    await sleep(intervalMs / speed);
  }

  // Phase 3: End call + final report
  const finalTranscript = getFullTranscript();
  updateUI({ phase: 'ended', elapsedMs: TOTAL_CALL_MS, transcript: finalTranscript });
  
  console.log('\n  📊 Generating final coaching report...\n');
  
  const finalReportPrompt = `You are Genie, a sales call coaching assistant. Generate a post-call coaching report.

Meeting: Jordan Chen, CFO at TechFlow (14-minute discovery call)
Context: TechFlow is a 40-person Series A software company struggling with ops data workflows. Jordan has authority to buy, CFO needs ROI. Competitors evaluated and rejected (Zapier, Workato). Thursday technical deep dive scheduled.

Provide a JSON coaching report:
{
  "executive_summary": "<3 sentence summary of call and readiness to move forward>",
  "key_findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
  "strongest_moments": ["<what Alex did well>"],
  "biggest_gaps": ["<what was missed or underdeveloped>"],
  "recommended_next_steps": ["<specific next step 1>", "<specific next step 2>"],
  "questions_to_address_before_next_call": ["<question 1>", "<question 2>"],
  "deal_health": "<strong|medium|weak> — <one sentence justification>",
  "compelling_event": "<the single most important reason this customer will buy>"
}`;

  let finalReport = 'Demo mode: no final report in mock mode.';
  
  if (!mockLLM) {
    try {
      const { spawn } = require('child_process');
      finalReport = await new Promise((resolve, reject) => {
        const proc = spawn('claude', ['-p', '--model', 'sonnet'], { timeout: 60000 }, (error, stdout, stderr) => {
          if (error) { reject(error); return; }
          resolve(stdout.trim());
        });
        proc.stdin.write(finalReportPrompt);
        proc.stdin.end();
      });
    } catch (e) {
      finalReport = `Final report (mock): Jordan Chen is a strong Qualified opportunity. Key gaps: competitor evaluation details, specific ROI numbers. Next step: confirm Thursday deep dive with ops leads. Deal health: Medium-Strong — clear pain, authority confirmed, timeline pressure established.`;
    }
  }
  
  updateUI({ finalReport, phase: 'ended' });
  logToConsole(uiState);
  
  // Save final state
  fs.writeFileSync(path.join(__dirname, 'final-state.json'), JSON.stringify(uiState, null, 2));
  console.log('\n\n✅ Demo complete. Final state saved to demo/final-state.json');
  process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runDemo().catch(e => {
  console.error('Demo failed:', e);
  process.exit(1);
});
