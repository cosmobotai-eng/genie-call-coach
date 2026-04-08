/**
 * Discovery Agent Demo
 *
 * Simulates a live call by running the analysis engine against a real
 * Bobby transcript at 10/20/30 minute marks + final report.
 * Sends real Slack nudges to Doug's DMs.
 */

const { analyzeDiscoveryCoverage, shouldNudge } = require('./src/discovery-agent');
const { sendNudge, sendFinalReport } = require('./src/slack-notifier');
const transcript = require('./test-transcript.json');

require('dotenv').config();

// Parse timestamp "00:10:23" to seconds
function parseTimestamp(ts) {
  if (!ts) return 0;
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// Get transcript entries up to a given minute mark
function getTranscriptUpTo(minutes) {
  const cutoffSeconds = minutes * 60;
  return transcript.filter(t => parseTimestamp(t.timestamp) <= cutoffSeconds);
}

async function runDemo() {
  const meetingTitle = 'Andrea M. Lipo and Bobby Isaacson | Section AI';
  const checkpoints = [10, 20, 30];
  let previousAnalysis = null;

  console.log(`\n=== Discovery Agent Demo ===`);
  console.log(`Transcript: ${transcript.length} entries, 30 minutes`);
  console.log(`Checkpoints: ${checkpoints.join(', ')} minutes + final report\n`);

  for (const minutes of checkpoints) {
    const slice = getTranscriptUpTo(minutes);
    console.log(`--- ${minutes} minute mark (${slice.length} entries) ---`);

    const analysis = await analyzeDiscoveryCoverage(slice, previousAnalysis);

    console.log(`Coverage: ${analysis.overall_score}/21 (${analysis.brief_readiness_pct}%)`);
    console.log(`Pyramid: Layer ${analysis.pyramid_layer}`);
    console.log(`Blind spots: ${(analysis.blind_spots_detected || []).join(', ') || 'none yet'}`);
    console.log(`Nudge [${analysis.nudge?.category}]: ${analysis.nudge?.question}\n`);

    // Send Slack nudge
    const doNudge = shouldNudge(analysis, previousAnalysis, minutes);
    if (doNudge) {
      console.log(`>> Sending Slack nudge...`);
      try {
        await sendNudge(analysis, meetingTitle, minutes);
        console.log(`>> Nudge sent!\n`);
      } catch (e) {
        console.error(`>> Slack error: ${e.message}\n`);
      }
    } else {
      console.log(`>> No nudge needed (coverage sufficient or repeat category)\n`);
    }

    previousAnalysis = analysis;
  }

  // Final report
  console.log(`--- Final Report (full transcript, ${transcript.length} entries) ---`);
  const finalAnalysis = await analyzeDiscoveryCoverage(transcript, null);

  console.log(`Final coverage: ${finalAnalysis.overall_score}/21 (${finalAnalysis.brief_readiness_pct}%)`);
  console.log(`Pyramid: Layer ${finalAnalysis.pyramid_layer}`);
  console.log(`Blind spots: ${(finalAnalysis.blind_spots_detected || []).join(', ') || 'none'}`);

  Object.entries(finalAnalysis.coverage).forEach(([key, val]) => {
    console.log(`  ${key}: ${val.score}/3 - ${val.evidence?.slice(0, 80) || 'none'}`);
  });

  console.log(`\n>> Sending final report to Slack...`);
  try {
    await sendFinalReport(finalAnalysis, meetingTitle, 30);
    console.log(`>> Final report sent!`);
  } catch (e) {
    console.error(`>> Slack error: ${e.message}`);
  }

  console.log(`\n=== Demo Complete ===`);
}

runDemo().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
