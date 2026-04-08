# Genie Call Coach

Real-time AI coaching during sales discovery calls.

**What it does:**
- Joins calls via desktop capture (Recall.ai SDK)
- Transcribes in real-time (Deepgram streaming)
- Every 90 seconds: analyzes transcript against a configurable discovery framework
- Shows live coaching scores in an Electron scoreboard UI
- Sends post-call summary to your delivery channel

**Architecture:**
```
Call → Recall.ai SDK → Deepgram STT → Transcript
                                        ↓
                              LLM Analysis (configurable)
                                        ↓
                              Electron Scoreboard UI
                                        ↓
                              Delivery (in-app, webhook, etc.)
```

**Setup:**
```bash
npm install
cp .env.example .env
# Fill in RECALLAI_API_KEY, DEEPGRAM_API_KEY, LLM_PROVIDER, LLM_API_KEY
npm start
```

**Configure the coaching framework:**
Edit `src/discovery-agent.js` -- swap the categories and system prompt to match your discovery methodology. The coaching categories are just a config object, not hardcoded logic.

**LLM options:**
- Default: Anthropic Claude (claude CLI, Max subscription) via `claude -p`
- Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` to use GPT-4o
- Set `ANTHROPIC_MODEL` to pick a different Claude model

**Delivery:**
Post-call reports go to console by default. Replace the `sendFinalReport` call in `main.js` with your webhook, email, Slack, CRM update, etc.

**Stack:**
- Electron (desktop capture via Recall.ai Desktop SDK)
- Deepgram streaming STT
- Claude CLI / OpenAI API
- Node.js

**Rename from "Muesli":**
- `index.html` `<title>` -- change app name
- `src/assets/avatar.svg` -- your icon
- App name in `package.json`
