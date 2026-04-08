/**
 * Slack Nudge Delivery via Sgt. Signal
 *
 * Sends discovery gap notifications and final coverage reports as Slack DMs.
 * Categories aligned to Section's 7-section Transformation Brief format.
 */

const axios = require('axios');

const SLACK_BOT_TOKEN = process.env.SGT_SIGNAL_BOT_TOKEN;
const DEFAULT_SLACK_USER = process.env.SLACK_USER_DOUG || 'U0A8MCLDWKG';

// Brief section labels for display
const SECTION_LABELS = {
  current_reality: 'S1: Current Reality',
  market_context: 'S2: Market Context',
  their_plan: 'S3: Their Plan',
  blind_spots: 'S4: Blind Spots',
  implications: 'S5: Implications',
  recommended_path: 'S6: Recommended Path',
  seller_memo: 'Seller Memo',
};

async function sendSlackMessage(channel, message) {
  if (!SLACK_BOT_TOKEN) {
    console.warn('[Slack] SGT_SIGNAL_BOT_TOKEN not set, skipping message');
    return null;
  }

  const response = await axios.post('https://slack.com/api/chat.postMessage', {
    channel,
    ...message,
  }, {
    headers: {
      'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.data.ok) {
    throw new Error(`Slack API error: ${response.data.error}`);
  }
  return response.data;
}

function makeProgressBar(score, max) {
  const filled = Math.round((score / max) * 12);
  const empty = 12 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

function formatScore(score) {
  if (score === 0) return '\u26d4 0';
  if (score === 1) return '\u26a0\ufe0f 1';
  if (score === 2) return '\u2705 2';
  return '\u2705 3';
}

/**
 * Send a mid-call nudge when discovery gaps are detected.
 */
async function sendNudge(analysis, meetingTitle, elapsedMinutes) {
  const max = analysis.max_score || 21;

  const weakCategories = Object.entries(analysis.coverage)
    .filter(([_, v]) => v.score <= 1)
    .map(([k, v]) => {
      const label = SECTION_LABELS[k] || k.replace(/_/g, ' ');
      return v.gap ? `${label}: ${v.gap}` : label;
    });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Discovery Gap', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${meetingTitle}* -- ${elapsedMinutes}m in\nBrief readiness: ${makeProgressBar(analysis.overall_score, max)} ${analysis.overall_score}/${max}`,
      },
    },
  ];

  if (weakCategories.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Weak brief sections:*\n${weakCategories.slice(0, 4).map(c => `  - ${c}`).join('\n')}`,
      },
    });
  }

  if (analysis.nudge && analysis.nudge.question) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Ask this:*\n> ${analysis.nudge.question}`,
      },
    });
  }

  const blindSpots = analysis.blind_spots_detected || [];
  const contextParts = [`Pyramid: Layer ${analysis.pyramid_layer || '?'}`];
  if (blindSpots.length > 0) {
    contextParts.push(`Signals: ${blindSpots.slice(0, 3).join(', ')}`);
  }
  contextParts.push(`Readiness: ${analysis.brief_readiness_pct || 0}%`);

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: contextParts.join(' | ') }],
  });

  return sendSlackMessage(DEFAULT_SLACK_USER, {
    text: `Discovery gap: ${meetingTitle} (${analysis.brief_readiness_pct}% ready)`,
    blocks,
  });
}

/**
 * Send a comprehensive post-call coverage report.
 */
async function sendFinalReport(analysis, meetingTitle, durationMinutes) {
  const max = analysis.max_score || 21;

  const categoryLines = Object.entries(analysis.coverage).map(([key, val]) => {
    const label = SECTION_LABELS[key] || key.replace(/_/g, ' ');
    const evidence = val.evidence ? ` -- ${val.evidence.slice(0, 80)}` : '';
    return `${formatScore(val.score)} *${label}*${evidence}`;
  });

  const topGaps = Object.entries(analysis.coverage)
    .filter(([_, v]) => v.score <= 1)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 3)
    .map(([k, v]) => {
      const label = SECTION_LABELS[k] || k.replace(/_/g, ' ');
      return `- *${label}*: ${v.gap || 'not covered'}`;
    });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Discovery Coverage Report', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${meetingTitle}* -- ${durationMinutes}m call\n*Brief Readiness: ${analysis.brief_readiness_pct || 0}%*\nCoverage: ${makeProgressBar(analysis.overall_score, max)} ${analysis.overall_score}/${max}`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: categoryLines.join('\n'),
      },
    },
  ];

  const blindSpots = analysis.blind_spots_detected || [];
  if (blindSpots.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Blind spots detected:* ${blindSpots.join(', ')}`,
      },
    });
  }

  if (topGaps.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top gaps for follow-up:*\n${topGaps.join('\n')}`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `Pyramid: Layer ${analysis.pyramid_layer || '?'} | Brief generator should ${(analysis.brief_readiness_pct || 0) >= 60 ? 'produce solid output' : 'expect thin sections -- follow-up call recommended'}`,
    }],
  });

  return sendSlackMessage(DEFAULT_SLACK_USER, {
    text: `Discovery report: ${meetingTitle} -- ${analysis.brief_readiness_pct || 0}% brief readiness`,
    blocks,
  });
}

module.exports = {
  sendNudge,
  sendFinalReport,
  sendSlackMessage,
};
