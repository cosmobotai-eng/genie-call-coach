/**
 * Live Demo Dashboard — serves the coaching demo as a web page
 * Run: node demo/dashboard.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8766;
const UI_STATE_FILE = path.join(__dirname, 'ui-state.json');

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Genie Call Coach — Live Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0e17; color: #e2e8f0; font-family: 'SF Mono', 'Menlo', monospace; min-height: 100vh; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #0ea5e9; font-size: 1.8em; margin-bottom: 4px; }
    .header p { color: #64748b; font-size: 0.85em; }
    .meeting-bar { background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .meeting-title { font-size: 1.1em; color: #f1f5f9; }
    .meeting-time { color: #0ea5e9; font-size: 1.4em; font-weight: bold; }
    .phase-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; }
    .phase-live { background: #064e3b; color: #34d399; border: 1px solid #065f46; }
    .phase-connecting { background: #78350f; color: #fbbf24; border: 1px solid #92400e; }
    .phase-ended { background: #312e81; color: #a5b4fc; border: 1px solid #3730a3; }
    .score-section { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .score-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .score-label { font-size: 0.75em; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
    .score-value { font-size: 2.5em; font-weight: bold; color: #0ea5e9; }
    .score-bar-wrap { background: #1e293b; border-radius: 6px; height: 12px; overflow: hidden; margin-top: 8px; }
    .score-bar { height: 100%; background: linear-gradient(90deg, #0ea5e9, #38bdf8); transition: width 0.5s ease; border-radius: 6px; }
    .categories { display: grid; gap: 12px; }
    .cat-row { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 14px 18px; display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; }
    .cat-name { font-size: 0.9em; color: #94a3b8; }
    .cat-name.warn { color: #fbbf24; }
    .cat-name.good { color: #34d399; }
    .cat-bar { display: flex; gap: 4px; align-items: center; }
    .cat-bar-block { width: 24px; height: 24px; border-radius: 3px; background: #1e293b; }
    .cat-bar-block.filled { background: #0ea5e9; }
    .cat-bar-block.warn { background: #fbbf24; }
    .cat-bar-block.good { background: #34d399; }
    .nudge-box { background: #1e1b4b; border: 1px solid #4338ca; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
    .nudge-label { font-size: 0.7em; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .nudge-category { font-size: 0.75em; color: #818cf8; margin-bottom: 6px; }
    .nudge-question { font-size: 1.2em; color: #e0e7ff; font-style: italic; margin-bottom: 8px; }
    .nudge-rationale { font-size: 0.8em; color: #93c5fd; }
    .history { margin-top: 16px; }
    .history-title { font-size: 0.7em; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .history-item { font-size: 0.8em; color: #475569; padding: 4px 0; border-bottom: 1px solid #1e293b; }
    .history-item:last-child { border-bottom: none; }
    .transcript-preview { background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; font-size: 0.8em; color: #64748b; max-height: 120px; overflow: hidden; position: relative; }
    .transcript-preview::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 40px; background: linear-gradient(transparent, #111827); }
    .elapsed-label { font-size: 0.7em; color: #475569; margin-top: 4px; }
    .not-started { text-align: center; padding: 80px 20px; color: #475569; }
    .not-started p { font-size: 1.1em; margin-bottom: 8px; }
    .not-started code { background: #1e293b; padding: 2px 8px; border-radius: 4px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌀 Genie Call Coach — Live Demo</h1>
      <p>14-minute mock sales discovery call · Jordan Chen (TechFlow)</p>
    </div>

    <div id="app">
      <div class="not-started">
        <p>Start the demo to see live coaching</p>
        <code>node demo/run-demo.js --speed=10</code>
        <p style="margin-top:16px; font-size:0.85em">Then refresh this page</p>
      </div>
    </div>
  </div>

  <script>
    async function load() {
      try {
        const res = await fetch('/ui-state.json');
        if (!res.ok) throw new Error('no state yet');
        const state = await res.json();
        render(state);
      } catch(e) {
        // state file not ready yet
      }
      setTimeout(load, 2000);
    }

    function render(state) {
      const app = document.getElementById('app');
      const pct = state.analysis?.brief_readiness_pct || 0;
      const score = state.overallScore || 0;
      const maxScore = 7;
      const barPct = (score / maxScore) * 100;

      const phase = state.phase || 'unknown';
      const phaseLabel = phase === 'live' ? '● LIVE' : phase === 'connecting' ? '⏳ CONNECTING' : phase === 'ended' ? '✅ CALL ENDED' : phase.toUpperCase();
      const phaseClass = 'phase-badge phase-' + phase;

      const showNudge = state.showNudge && state.currentNudge;
      const nudgeHistory = state.nudgeHistory || [];

      let catsHtml = '';
      const cats = state.categories || {};
      const catOrder = ['current_reality','pain_points','decision_process','budget_authority','stakes','competition','next_steps'];
      const catNames = {
        current_reality: 'Current Reality',
        pain_points: 'Pain Points',
        decision_process: 'Decision Process',
        budget_authority: 'Budget & Authority',
        stakes: 'Stakes & Urgency',
        competition: 'Competitive Landscape',
        next_steps: 'Next Steps',
      };

      for (const key of catOrder) {
        const cat = cats[key] || { score: 0, evidence: '' };
        const catScore = cat.score || 0;
        const cls = catScore < 2 ? 'warn' : catScore === 3 ? 'good' : '';
        const blocks = [0,1,2].map(i => {
          const filled = i < catScore;
          const bClass = filled ? (catScore < 2 ? 'warn' : catScore === 3 ? 'good' : 'filled') : '';
          return '<div class="cat-bar-block ' + bClass + '"></div>';
        }).join('');
        catsHtml += '<div class="cat-row">' +
          '<div class="cat-name ' + cls + '">' + catNames[key] + '</div>' +
          '<div class="cat-bar">' + blocks + '</div>' +
        '</div>';
      }

      let nudgeHtml = '';
      if (showNudge) {
        const n = state.currentNudge;
        nudgeHtml = '<div class="nudge-box">' +
          '<div class="nudge-label">💬 Coaching Nudge</div>' +
          '<div class="nudge-category">[' + n.category.toUpperCase().replace('_', ' ') + ']</div>' +
          '<div class="nudge-question">"' + n.message + '"</div>' +
          '<div class="nudge-rationale">→ ' + n.rationale + '</div>' +
        '</div>';
      }

      let historyHtml = '';
      if (nudgeHistory.length > 0) {
        historyHtml = '<div class="history"><div class="history-title">Previous Nudges</div>';
        for (const n of nudgeHistory.slice(-3)) {
          historyHtml += '<div class="history-item">[' + n.category + '] "' + n.message.substring(0, 60) + '"</div>';
        }
        historyHtml += '</div>';
      }

      const transcriptSnippets = (state.transcript || []).slice(-3).map(e =>
        '<div style="margin-bottom:6px"><strong style="color:' + (e.isHost ? '#34d399' : '#0ea5e9') + '">' + e.speaker + ':</strong> <span style="color:#94a3b8">' + e.text.substring(0, 100) + '...</span></div>'
      ).join('');

      app.innerHTML = `
        <div class="meeting-bar">
          <div>
            <div class="meeting-title">${state.meetingTitle || 'Jordan Chen — TechFlow Discovery Call'}</div>
            <div class="elapsed-label">${Math.floor(state.elapsedMs/60000)}:${String(Math.floor((state.elapsedMs%60000)/1000)).padStart(2,'0')} / 14:00 elapsed</div>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <span class="${phaseClass}">${phaseLabel}</span>
            <div class="meeting-time">${pct}%</div>
          </div>
        </div>

        ${nudgeHtml}

        <div class="score-section">
          <div class="score-header">
            <div class="score-label">Brief Readiness</div>
            <div class="score-value">${pct}%</div>
          </div>
          <div class="score-bar-wrap"><div class="score-bar" style="width:${barPct}%"></div></div>
        </div>

        <div class="score-section">
          <div class="score-header">
            <div class="score-label">Discovery Coverage (${score}/${maxScore} categories)</div>
          </div>
          <div class="categories">${catsHtml}</div>
          ${historyHtml}
        </div>

        ${transcriptSnippets ? '<div class="transcript-preview">' + transcriptSnippets + '</div>' : ''}
      `;
    }

    load();
  </script>
</body>
</html>`;

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8766;
const UI_STATE_FILE = path.join(__dirname, 'ui-state.json');

const server = http.createServer((req, res) => {
  if (req.url === '/ui-state.json') {
    try {
      const data = fs.readFileSync(UI_STATE_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch(e) {
      res.writeHead(404);
      res.end('{}');
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
  }
});

server.listen(PORT, () => {
  console.log('🌐 Dashboard: http://localhost:' + PORT);
  console.log('   (Dashboard shows live demo output — open this URL in Chrome)');
});