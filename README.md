# Genie Call Coach

**Genie Call Coach** coaches sales reps in real-time during actual sales discovery calls — powered by the company's own knowledge base. Built by Ben Better.

Think of it as a personal sales coach that sits in on every call, watches for gaps in your discovery, and nudges you with the exact question you should be asking right now.

Built on Mac. Runs in the background during your Zoom/Teams/Google Meet calls.

---

## What It Does

1. **Listens to your call** — captures desktop audio automatically (no bot joins the meeting)
2. **Transcribes in real-time** — every word, labeled by speaker
3. **Coaches every 90 seconds** — scores your discovery against 6 categories, shows you what you're missing
4. **Nudges you live** — "Ask about the decision process" right when you should ask it
5. **Generates a post-call brief** — what was covered, what was missed, what to do next

---

## Quick Start

### Run the Phase 1 Demo (no API keys needed)

```bash
git clone https://github.com/cosmobotai-eng/genie-call-coach.git
cd genie-call-coach
npm install

# Run the demo — simulates a 14-minute sales call with mock data
node demo/run-demo.js

# Fast demo (10x speed)
node demo/run-demo.js --speed=10

# Demo with real LLM (requires API keys)
node demo/run-demo.js --mock-llm
```

The demo runs a simulated discovery call between a sales rep and a prospect named Jordan Chen at TechFlow. You'll see the coaching scorecard update in real-time as the call progresses.

### Connect Real Accounts

```bash
cp .env.example .env
# Edit .env with your keys:
#   RECALLAI_API_KEY=...
#   DEEPGRAM_API_KEY=...
#   ANTHROPIC_API_KEY=...   # optional, uses Claude CLI by default

npm start
```

---

## Architecture

```
Salesperson's Mac
├── Genie App (Electron)
│   ├── Recall.ai Desktop SDK — captures call audio, no bot needed
│   ├── Deepgram — real-time transcription
│   ├── Transcript Buffer — accumulates last 90 seconds of transcript
│   ├── Coaching Engine — LLM analyzes against scorecard
│   └── Scoreboard UI — live coaching nudges and category scores
│
├── Business Brain (knowledge backend — per company)
│   ├── Company knowledge graph — products, competitors, FAQs, processes
│   └── Feeds context into coaching prompts
│
└── Post-Call Agent
    ├── Generates call summary and entity extraction
    └── Updates Business Brain with new learnings
```

### Who Provides What

| Component | Provider | Notes |
|---|---|---|
| Desktop audio capture | Recall.ai SDK | Installs on the rep's Mac |
| Transcription | Deepgram | Real-time streaming API |
| Coaching analysis | Claude (or any LLM) | Via API or CLI |
| Knowledge graph | Business Brain | Per-company, multi-tenant |
| CRM updates | Webhook | Salesforce, HubSpot, etc. |

---

## The Scorecard

Genie uses a **configurable discovery framework** — not a rigid script. Six core categories:

| Category | What It Measures |
|---|---|
| **Current Reality** | Does the rep understand where the company is today? |
| **Pain Points** | Is the rep uncovering the real problems, not just symptoms? |
| **Decision Process** | Does the rep know how decisions get made and who makes them? |
| **Budget & Authority** | Is the rep establishing budget and who controls it? |
| **Stakes & Urgency** | Does the rep understand the cost of inaction? |
| **Competitive Landscape** | Is the rep differentiating against alternatives? |

Companies can customize the categories, weights, and coaching prompts per team or per product. The scorecard is a config file — swap it to match your methodology.

---

## Pricing (for reference in conversations)

| Tier | Price | Includes |
|---|---|---|
| Starter | $39/seat/mo | 15 hrs recorded calls, coaching, summaries |
| Pro | $79/seat/mo | 40 hrs, knowledge base, templates |
| Enterprise | $149/seat/mo | Unlimited, priority support |

*API costs (Recall.ai + Deepgram) are approximately $40-60/seat/month for typical usage. Included in all tiers.*

---

## Development

### Project Structure

```
genie-call-coach/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge
│   ├── renderer.js          # UI logic
│   ├── discovery-agent.js   # Coaching engine + scorecard
│   ├── server.js            # Express: Recall token proxy, Brain API
│   └── sdk-logger.js        # SDK event logging
├── demo/
│   ├── mock-transcript.js   # Demo call data (Jordan Chen / TechFlow)
│   └── run-demo.js          # Demo runner
├── docs/
│   └── TECHNICAL_DESIGN.md # Full technical specification
├── .env.example
└── package.json
```

### Key Files to Know

- `src/discovery-agent.js` — coaching categories, prompt templates, scoring logic. **Edit this to customize the scorecard.**
- `src/server.js` — Express backend: Recall token proxy (API key never touches the app), Business Brain API
- `demo/run-demo.js` — runs the full coaching loop against mock data. No keys needed.
- `docs/TECHNICAL_DESIGN.md` — full architecture, data model, API spec

### Adding a New Scorecard Category

1. Open `src/discovery-agent.js`
2. Add an entry to `DEFAULT_CATEGORIES`
3. Add the scoring logic to `analyzeDiscoveryCoverage()`
4. The UI will automatically pick it up

---

## Status

**Phase 1** — Demo working. Full Electron app with mock transcript running end-to-end.

**Phase 2** — Recall SDK + Deepgram integration. API keys required.

**Phase 3** — Business Brain backend (PostgreSQL + pgvector knowledge graph).

**Phase 4** — Code signing, notarization, shipping.

---

## Company

A **Ben Better** company. Built for sales teams who want to get better at discovery without a manager in every call.
