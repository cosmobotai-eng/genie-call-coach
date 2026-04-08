# Section Discovery Agent

## What This Is

Electron desktop app that invisibly monitors sales discovery calls in real-time. Scores transcript coverage against the 7 sections of Section AI's Transformation Brief, shows a live scoreboard during the call, and sends a post-call coverage report via Slack.

Built on Recall.ai's Desktop SDK (forked from Muesli sample app). No bot joins the call -- the SDK captures audio locally from the meeting window.

## Architecture

```
Meeting starts (Zoom/Teams/Meet)
  -> Recall Desktop SDK detects meeting window
  -> SDK captures audio, streams to Deepgram for transcription
  -> Real-time transcript events flow to main process
  -> Every 90s: transcript sent to Claude (via CLI) for analysis
  -> Scoreboard UI updates in Electron app (7 brief sections, color-coded)
  -> Call ends: final coverage report sent via Slack DM
```

## Files

| File | Purpose |
|---|---|
| `src/main.js` | Electron main process: SDK events, analysis loop, IPC |
| `src/discovery-agent.js` | Core: 7-category checklist prompt, Claude CLI, JSON scoring |
| `src/slack-notifier.js` | Sgt. Signal Slack DMs (final report only) |
| `src/server.js` | Express on :13373, creates Recall upload tokens |
| `src/preload.js` | IPC bridge for renderer |
| `src/renderer.js` | UI: scoreboard updates from discovery-update events |
| `src/index.html` | Discovery scoreboard panel HTML |
| `src/index.css` | Scoreboard styles (bottom of file) |
| `demo-discovery.js` | Offline demo: runs analysis at 10/20/30 min marks on saved transcript |
| `patches/` | SDK patches (auto-applied via postinstall) |

## SDK Patches

The `@recallai/desktop-sdk` native binary is spawned with a stripped environment by default. On macOS, this prevents it from accessing system libraries needed for audio capture. The patch in `patches/` adds `...process.env` to the spawn call. Applied automatically via `patch-package` on `npm install`.

## Critical Setup Notes

### macOS Permissions (THIS WILL BITE YOU)
The app runs via Terminal (or iTerm/Warp). On macOS 15+, the **Terminal app itself** needs Screen Recording permission, not just Electron. Without this, the SDK silently fails to record -- no error, just no events.

**System Settings > Privacy & Security > Screen Recording > Terminal (toggle ON)**

The app also calls `requestPermission('screen_capture')` and `requestPermission('system_audio')` on init.

### Deepgram
Transcription provider configured in Recall's web dashboard, not in code:
1. Sign up at deepgram.com
2. Create API key with **Admin role** (not Default)
3. Paste key + Project ID at https://us-west-2.recall.ai/dashboard/transcription

### Claude CLI
Analysis uses `claude -p` (Claude Max subscription). No API key needed. Requires `claude` CLI installed on the machine. For production/distribution, swap to `@anthropic-ai/sdk` with an API key.

## Discovery Checklist

The 7 scoring categories map to the 7 sections of Section's Transformation Brief (designed by Scott). Each category includes specific questions from Section's Discovery Questions Reference (analyzed from 4 real calls):

1. **Current Reality** (Brief S1) -- company facts, AI tools, daily usage %, governance, Head of AI
2. **Market Context** (Brief S2) -- competitor benchmarks, industry AI data
3. **Their Plan** (Brief S3) -- what they'd do without Section
4. **Blind Spots** (Brief S4) -- frozen middle, measurement approach, pilot history
5. **Implications** (Brief S5) -- cost of inaction, timeline pressure, personal stakes
6. **Recommended Path** (Brief S6) -- budget structure, bandwidth, past vendor failures
7. **Seller Memo** -- decision process, other AI initiatives, knowledge worker count

## Integration with Brief Generator

This agent is the front half of the pipeline. Scott's 5-pass brief generator (in Google Drive: `1FWeJBbd7d4oIO-gmUydHQAFWjjfruBC2`) is the back half. Our coverage report tells you whether the transcript has enough signal for the generator to produce 8+/10 on all 7 evaluation dimensions.

## Commands

```bash
npm start              # Run in dev mode (requires Terminal Screen Recording permission)
npm run demo           # Run offline demo against saved transcript
npm run make           # Build signed DMG (requires Apple Developer cert)
```

## Conventions

- LLM calls: `claude -p --model sonnet` via CLI subprocess
- Slack: Sgt. Signal bot (`SGT_SIGNAL_BOT_TOKEN`), `chat.postMessage` with Block Kit
- No API keys for Claude -- uses Max subscription via CLI
- Analysis interval: 90 seconds (first check at 90s after recording starts)
