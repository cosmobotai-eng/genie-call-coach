# Genie Call Coach — Developer Guide

## What This Is

Genie Call Coach is a Mac desktop app that coaches sales reps in real-time during discovery calls. It captures call audio via the Recall.ai Desktop SDK, transcribes via Deepgram, and runs the transcript through an LLM every 90 seconds to score discovery coverage and generate live coaching nudges.

## Key Context

- **This is a Ben Better company product** — Ben Better is Cap's holding/operating company (Greg Crisci is the partner)
- **Phase 1 demo is live** — `node demo/run-demo.js` runs the full loop with mock data, no API keys needed
- **API keys go in `.env`** — never hardcode them. Keys needed: `RECALLAI_API_KEY`, `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`
- **The Recall API key never touches the Electron app** — it lives in the Express backend (`server.js`), which issues upload tokens to the app

## Architecture Quick Reference

```
Your Mac
├── Electron App (main.js)
│   ├── Recall.ai SDK → captures audio
│   ├── Transcript Buffer (90-second sliding window)
│   └── IPC → renderer
│
└── Express Server (server.js) :13373
    ├── POST /recording/sdk-upload → issues upload token (API key lives here)
    ├── GET /brain → semantic search against company's knowledge graph
    └── CRUD /scorecard, /calls, /users
```

## Key Files

| File | Purpose |
|---|---|
| `src/main.js` | Electron main process. SDK events → analysis loop → IPC to renderer |
| `src/discovery-agent.js` | **The coaching brain.** Categories, scoring, prompt construction |
| `src/server.js` | Express backend. Recall token proxy + Brain API |
| `demo/run-demo.js` | Phase 1 demo runner. Start here to understand the loop |

## How the Coaching Loop Works

1. Call starts → `meeting-detected` event from Recall SDK
2. Audio streams → Recall cloud → Deepgram → `transcript.data` events
3. Main process accumulates transcript entries into a buffer
4. Every 90 seconds: buffer → `analyzeDiscoveryCoverage()` → scores + nudge
5. Renderer receives IPC `discovery-update` → updates scoreboard UI
6. Call ends: full transcript → `generateFinalReport()` → save + deliver

## Adding a New Scorecard Category

The scorecard is just a config object in `discovery-agent.js`:

```js
const DEFAULT_CATEGORIES = {
  my_new_category: {
    name: 'My Category',
    description: 'What this measures',
    weight: 1.0,  // higher = more important
    key_questions: ['Question 1?', 'Question 2?'],
  },
};
```

Then add the scoring logic in `analyzeDiscoveryCoverage()`. The UI picks up new categories automatically.

## Running the Demo

```bash
# No API keys needed
node demo/run-demo.js

# Fast (10x speed)
node demo/run-demo.js --speed=10

# With real LLM (requires .env with keys)
node demo/run-demo.js --mock-llm=false
```

## Environment Variables

```bash
RECALLAI_API_KEY=...       # Recall.ai API key (server.js only)
DEEPGRAM_API_KEY=...       # Deepgram API key (Recall dashboard config)
ANTHROPIC_API_KEY=...      # Optional: direct API calls
LLM_PROVIDER=claude        # 'claude' (CLI) or 'openai'
ANTHROPIC_MODEL=sonnet     # Model for CLI invocations
PORT=13373                  # Express server port
```

## Working with the Recall SDK

The SDK runs in the main process. Key events:

- `meeting-detected` — user started a call
- `recording-started` — recording has begun
- `realtime-event: transcript.data` — a finalized transcript segment
- `realtime-event: transcript.partial_data` — interim results (every few words)
- `recording-ended` — call finished

The SDK requires macOS permissions: Screen Recording, Accessibility, Microphone.

## The Knowledge Graph (Business Brain)

Each company has a knowledge graph that feeds context into the coaching prompt. The graph is stored in PostgreSQL with `pgvector` for semantic search.

Minimum viable structure:
- `brain_nodes` — entities (products, competitors, FAQs, processes)
- `brain_edges` — relationships between entities
- `companies` — tenant isolation

RLS (Row Level Security) enforces tenant isolation at the database level.

## First Time Setup

```bash
npm install
cp .env.example .env
# Add your API keys to .env
npm start
```

The app will request macOS permissions on first run (Screen Recording, Accessibility, Microphone).

## Questions

- **Why Electron?** We need native macOS audio capture. Recall SDK is a Node module. Web app can't do this.
- **Why Express backend for Recall?** The Recall API key lives server-side. The Electron app gets short-lived upload tokens — it never sees the raw key.
- **Can this run without Recall?** In demo mode, yes (`demo/run-demo.js`). For real calls, Recall SDK is required for desktop audio capture.
- **Can I use GPT-4o instead of Claude?** Yes. Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` in `.env`.
