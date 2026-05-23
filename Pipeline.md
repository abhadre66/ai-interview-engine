# AI Interview Engine — MVP Pipeline & Execution Plan

> **Role:** Senior Startup CTO + AI Architect + MVP Strategist
> **Target:** Working, impressive demo in 10 days. Solo founder. Ship fast.

---

## Quick Stack Summary

**Frontend** → Next.js 14 (App Router) — deployed on Vercel (free)
**Backend** → Express on Railway (free month)
**Database** → Supabase (Postgres)
**Auth** → Supabase Auth (magic link)
**Storage** → Supabase Storage (resumes + audio)
**Frontend Hosting** → Vercel (free forever)
**Backend Hosting** → Railway (free month, then $5/mo)
**LLM** → Claude Sonnet 4.6 (interview questions + scoring) + Claude Haiku 4.5 (resume extraction)
**Speech-to-Text** → Deepgram Nova-2
**Text-to-Speech** → ElevenLabs (demo) → OpenAI TTS (at scale)
**Resume Parsing** → pdf-parse (extract raw text) + Claude Haiku (structure it)
**Styling** → Tailwind CSS + shadcn/ui
**Monitoring** → Sentry + Vercel logs + Railway logs
**Analytics** → PostHog
**API Keys** → Anthropic + Deepgram + ElevenLabs + Supabase URL + Supabase Anon Key + Supabase Service Role Key

---

## Table of Contents

1. [MVP System Architecture](#1-mvp-system-architecture)
2. [Tool Stack + Alternatives](#2-tool-stack--alternatives)
3. [Phase-Wise MVP Roadmap](#3-phase-wise-mvp-roadmap)
4. [AI Interview Engine Design](#4-ai-interview-engine-design)
5. [Voice Architecture](#5-voice-architecture)
6. [Solo Founder Strategy](#6-solo-founder-strategy)
7. [Final Recommendation](#7-final-recommendation)

---

## 1. MVP System Architecture

### The Golden Rule for MVP

> **Build a monolith. Ship a demo. Refactor later.**

A microservices architecture for an MVP adds 3–4 weeks of overhead with zero user-facing benefit. You will split services after you have paying customers. Not before.

---

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CANDIDATE BROWSER                        │
│   React App (Next.js) — hosted on Vercel                        │
│   ├── Interview Room (mic capture → audio blob)                 │
│   ├── Text fallback (textarea for MVP voice issues)             │
│   └── Resume upload (PDF → Railway API)                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
              ┌────────────────┴─────────────────┐
              │                                  │
              ▼                                  ▼
┌─────────────────────────┐        ┌─────────────────────────────┐
│   VERCEL (Frontend)     │        │   RAILWAY (Backend)         │
│   Next.js pages only    │        │   Express server            │
│                         │        │                             │
│   /login                │        │   /api/interview/start      │
│   /interview/[id]       │        │   /api/interview/respond    │
│   /recruiter/dashboard  │        │   /api/interview/end        │
│                         │        │   /api/resume/parse         │
│                         │        │   /api/recruiter/results    │
└─────────────────────────┘        └──────────┬──────────────────┘
                                              │
                    ┌─────────────────────────┼──────────────────┐
                    ▼                         ▼                  ▼
             ┌───────────┐           ┌─────────────┐   ┌──────────────┐
             │  Supabase │           │  Claude API │   │  Deepgram +  │
             │  Postgres │           │  Sonnet +   │   │  ElevenLabs  │
             │  + Auth   │           │  Haiku      │   │  STT / TTS   │
             │  + Storage│           └─────────────┘   └──────────────┘
             └───────────┘
```

---

### Frontend Architecture

**Framework:** Next.js 14 (App Router) — deployed on Vercel (free)

The frontend is purely UI. No API logic lives here. All backend calls go to the Railway Express server.

**Key pages:**
```
/                         → landing page (or redirect to /login)
/login                    → Supabase Auth UI
/interview/[sessionId]    → live interview room
/recruiter/dashboard      → results overview
/recruiter/[sessionId]    → detailed interview transcript + score
```

**Important:** Because frontend (Vercel) and backend (Railway) are on different domains, you need to configure CORS on the Express server to allow requests from your Vercel URL.

---

### Backend Architecture

**Approach:** Express server on Railway (no timeout, persistent process)

Because Railway runs a persistent server (not serverless), there is no timeout. The entire voice pipeline — Deepgram STT + Claude + ElevenLabs TTS — runs as a single API call without any risk of being killed mid-way.

---

#### What "Express on Railway" Actually Means

You create a separate Node.js project with Express. Railway runs it as a persistent server 24/7. Your Next.js frontend calls it like any external API.

```
Railway server URL:  https://your-app.railway.app

POST /api/interview/start      → create session, return first question
POST /api/interview/respond    → audio in → transcript → Claude → audio out (single call)
POST /api/interview/end        → finalize transcript, trigger scoring
POST /api/resume/parse         → PDF → structured JSON
GET  /api/recruiter/results    → fetch scored transcripts
```

**How it works when a candidate speaks:**
```
1. Candidate's browser records audio
2. Browser sends audio to → https://your-app.railway.app/api/interview/respond
3. Express receives it — no timeout, runs as long as needed
4. Calls Deepgram STT → gets transcript (~1–2s)
5. Calls Claude with full history → gets next question (~2–3s)
6. Calls ElevenLabs → gets audio (~1–2s)
7. Saves turn to Supabase DB
8. Returns { question_text, audio_base64 } (~5–7s total)
9. Browser plays the audio
```

**The key difference from Vercel serverless:** Railway's server is always running. It does not wake up and shut down per request. This means no cold starts, no timeout limits, and WebSocket support when you need it later.

**Why not streaming yet:** Simpler to implement, sufficient for demo. Add streaming in Week 3 if needed.

---

### Database Setup

**Single database: Supabase (Postgres)**

```sql
-- 4 tables. That's it for MVP.

users (id, email, role: 'recruiter'|'candidate', created_at)

interviews (
  id, recruiter_id, candidate_email, job_title,
  resume_text, status: 'pending'|'active'|'completed',
  score, score_breakdown jsonb, created_at, completed_at
)

interview_turns (
  id, interview_id, turn_number,
  speaker: 'ai'|'candidate',
  text, audio_url, timestamp
)

resume_cache (
  id, file_hash, parsed_json, created_at
  -- avoids re-parsing same PDF
)
```

---

### Voice Pipeline (MVP-simple)

```
Browser mic → MediaRecorder API → audio/webm blob
→ Send to /api/interview/respond every [silence detection OR 5s]
→ Deepgram REST API (not streaming) → text
→ Claude API → next question text
→ ElevenLabs REST API → mp3 audio
→ Return to browser → play via <audio> tag
```

**Latency estimate:** ~3–5 seconds per turn (acceptable for demo)
**No WebRTC needed at MVP stage** — browser MediaRecorder is sufficient

---

### LLM Orchestration

No LangChain. No LlamaIndex. No vector DB. Direct Claude API calls.

```
Interview context = system_prompt + resume_summary + conversation_history
Each turn appends to history (kept in DB, sent with every request)
Token budget: ~4,000 tokens per request (well within Claude's context window)
```

---

### Resume Parsing Flow

```
PDF upload → Supabase Storage
→ /api/resume/parse
→ pdf-parse npm package → raw text
→ Claude: "Extract: name, skills, experience, education as JSON"
→ Store in resume_cache + attach to interview session
→ Interview system prompt gets: "Candidate has X years in Y, worked at Z..."
```

---

### Monolith vs Microservices Decision

| | Monolith (Next.js) | Microservices |
|---|---|---|
| Setup time | 1 day | 1–2 weeks |
| Deployment | `vercel deploy` | Docker, K8s, service mesh |
| Debugging | Simple logs | Distributed tracing |
| Solo dev | Perfect | Painful |
| Scale ceiling | ~10k users/month | Unlimited |
| **MVP choice** | **YES** | NO |

**Verdict:** Monolith until $10k MRR. Then extract the voice pipeline as a separate service if costs demand it.

---

## 2. Tool Stack + Alternatives

### Frontend Framework

| Option | Notes |
|---|---|
| **Best MVP: Next.js 14** | App router, API routes, Vercel deploy — one tool does everything |
| Cheapest: Vite + React | Need separate backend; more setup |
| Easier: v0.dev scaffolding | Generate UI with AI, paste into Next.js |
| Production: Same Next.js | Add edge runtime later |

**Tradeoff:** Next.js is slightly heavier than raw Vite but eliminates a separate backend service entirely.

---

### Backend Framework

| Option | Notes |
|---|---|
| **Best MVP: Next.js API Routes** | Zero extra infra, ships with frontend |
| Cheapest: Express.js | More boilerplate, separate deploy |
| Easier: Same Next.js | |
| Production: Separate FastAPI or Hono | When you need Python ML libs or edge performance |

**Overkill for MVP:** Django, Ruby on Rails, NestJS, separate FastAPI service.

---

### Database

| Option | Notes |
|---|---|
| **Best MVP: Supabase** | Postgres + Auth + Storage + Realtime in one. Free tier generous. |
| Cheapest: PlanetScale free | MySQL only, no storage, more limited |
| Easier: Supabase | Comes with dashboard, instant API |
| Production: Same Supabase or RDS | Supabase scales to millions of rows |

**Tradeoff:** Supabase free tier has 500MB storage and 2GB bandwidth — plenty for MVP.

---

### Authentication

| Option | Notes |
|---|---|
| **Best MVP: Supabase Auth** | Already included with Supabase, magic link + OAuth built in |
| Cheapest: Same (free) | |
| Easier: Same | Pre-built UI components |
| Production: Same or Auth0 | |

**Never custom-build auth for MVP.** This is the #1 mistake.

---

### Hosting

| Layer | Platform | Cost | Notes |
|---|---|---|---|
| **Frontend** | Vercel free | $0 forever | Next.js UI, instant deploy |
| **Backend** | Railway | Free for now (1 month trial) → $5/mo | Express server, no timeout, persistent |
| Production backend | Railway Hobby | $5/mo | Same platform, just paid tier |

**Why this split works:** Vercel is the best place for a Next.js frontend — one command deploy, global CDN, free. Railway is the best place for the Express backend — no serverless timeout, always running, supports WebSockets. The two talk to each other over HTTPS.

**CORS note:** Since frontend and backend are on different domains, add the `cors` npm package to your Express server and whitelist your Vercel URL on day 1.

---

### STT (Speech-to-Text)

| Option | Cost | Notes |
|---|---|---|
| **Best MVP: Deepgram Nova-2** | $0.0043/min | Best accuracy, fast, simple REST API |
| Cheapest: OpenAI Whisper API | $0.006/min | Slightly more expensive, good accuracy |
| Easier: Web Speech API | Free | Browser-native, no cost — ONLY for Chrome, unreliable, not for demo |
| Production: Deepgram streaming | Same | Upgrade to WebSocket streaming for low latency |

**Recommendation:** Use Deepgram REST for MVP. Takes 2 hours to integrate.

---

### TTS (Text-to-Speech)

| Option | Cost | Notes |
|---|---|---|
| **Best MVP: ElevenLabs** | $0.30/1k chars | Most natural voice, instant "wow factor" |
| Cheapest: OpenAI TTS | $0.015/1k chars | 20x cheaper, still good quality |
| Easier: Web Speech API | Free | Browser SpeechSynthesis — robotic, kills demo |
| Production: ElevenLabs or Cartesia | | Cartesia is fastest (sub-200ms) |

**Recommendation:** Use ElevenLabs for demo (voice quality = wow factor). Switch to OpenAI TTS for cost savings at scale.

---

### LLM Provider

| Option | Cost per 1M tokens | Notes |
|---|---|---|
| **Best MVP: Claude Sonnet 4.6** | $3 in / $15 out | Best instruction following, nuanced conversations |
| Cheapest: Claude Haiku 4.5 | $0.80 in / $4 out | 4x cheaper, still excellent for interview Q&A |
| Easier: Same | | |
| Production: Claude Opus 4.7 | $15 in / $75 out | For scoring complex technical interviews |

**Cost estimate for MVP:** 50 interviews × 20 turns × ~2k tokens = ~2M tokens = ~$6–30 total. Negligible.

**Never use GPT-4 when Claude is available** — Claude follows complex system prompts better for conversational flows.

---

### Resume Parsing

| Option | Cost | Notes |
|---|---|---|
| **Best MVP: pdf-parse + Claude** | ~$0.001/resume | Parse text with npm, extract structure with LLM |
| Cheapest: Same | | |
| Easier: Affinda or Eden AI | $0.10/resume | API-only, no code, but adds vendor dependency |
| Production: Same approach | | Add pdfjs-dist for better PDF support |

**Never use:** Textract (overkill), custom ML parsers (weeks of work).

---

### Video/WebRTC

| Option | Notes |
|---|---|
| **Best MVP: SKIP VIDEO** | Audio-only is faster to build and sufficient for interview demo |
| If needed: Daily.co | $0.004/min, pre-built React components, 30-min integration |
| Cheapest: 100ms.live | Free tier available |
| Production: LiveKit | Self-hostable, open source |

**Decision:** Don't add video for MVP unless a recruiter explicitly requests it. Voice + transcript is the core value prop.

---

### File Storage

| Option | Cost | Notes |
|---|---|---|
| **Best MVP: Supabase Storage** | Already included | Upload PDFs, store audio clips |
| Cheapest: Same | | |
| Production: Cloudflare R2 | $0.015/GB | Zero egress fees, much cheaper at scale |

---

### Analytics

| Option | Notes |
|---|---|
| **Best MVP: PostHog** | Free up to 1M events, self-serve, no setup |
| Skip entirely | Valid for first 10 users |
| Production: Mixpanel | Better funnels |

**For MVP:** Add PostHog with 3 events: `interview_started`, `interview_completed`, `recruiter_viewed_results`. That's it.

---

### Monitoring

| Option | Notes |
|---|---|
| **Best MVP: Vercel logs + Sentry free** | Sentry catches crashes, Vercel shows API latency |
| Skip entirely | Also valid for first week |
| Production: Datadog or Grafana Cloud | |

---

### What's OVERKILL for MVP

- Redis / caching layer (Postgres is fast enough)
- Message queues (BullMQ, SQS) — just await the API calls
- Docker / Kubernetes — Vercel handles it
- Elasticsearch — Postgres full-text search is fine
- Separate vector DB (Pinecone, Weaviate) — Claude's context window holds the whole interview
- GraphQL — REST is simpler
- gRPC — same
- Feature flags — just hardcode for MVP
- A/B testing infrastructure
- Custom ML models for scoring

---

## 3. Phase-Wise MVP Roadmap

### Phase 1: Foundation (Days 1–2)

**Goal:** Auth works, recruiter can create an interview session, candidate gets a link.

**Deliverables:** Recruiter can log in, create a session, get a shareable URL.

**Database tables:** `users`, `interviews`

**Folder structure (two separate projects):**
```
── ai-interview-engine/          ← Next.js frontend (deploy to Vercel)
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── recruiter/
│   │   │   ├── dashboard/page.tsx
│   │   │   └── create/page.tsx
│   │   └── interview/
│   │       └── [sessionId]/page.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           ← browser client
│   │   │   └── server.ts           ← server client
│   │   ├── api.ts                  ← helper to call Railway backend
│   │   └── types.ts
│   ├── components/
│   │   └── ui/                     ← shadcn components
│   └── .env.local                  ← NEXT_PUBLIC_API_URL=https://your-app.railway.app

── ai-interview-engine-api/      ← Express backend (deploy to Railway)
│   ├── src/
│   │   ├── index.ts               ← Express app entry point
│   │   └── routes/
│   │       ├── interview.ts       ← /api/interview/* routes
│   │       └── recruiter.ts       ← /api/recruiter/* routes
│   ├── package.json
│   └── .env                       ← all API keys live here (Anthropic, Deepgram, etc.)
```

**Libraries (frontend):** `@supabase/supabase-js`, `@supabase/ssr`, `shadcn/ui`, `zod`

**Libraries (backend):** `express`, `cors`, `@anthropic-ai/sdk`, `pdf-parse`, `dotenv`

**Estimated time:** 12–16 hours

**Common mistakes:**
- Mixing Supabase browser and server clients (use `@supabase/ssr` correctly)
- Not setting up Row Level Security on Supabase tables from day 1

**Don't build yet:** Interview UI, voice, scoring, email notifications.

#### Phase 1 Checklist

- [x] `npx create-next-app@latest ai-interview-engine` scaffolded
- [x] `ai-interview-engine-api/` Express backend created
- [x] Tailwind CSS installed on frontend
- [x] `express`, `cors`, `dotenv-cli`, `@supabase/supabase-js` installed on backend
- [x] CORS configured on Express — frontend URL whitelisted
- [x] Single root `.env` file — both Next.js and Express read from it via `dotenv -e ../.env`
- [x] Supabase project created, all env vars configured
- [x] `users` table created with RLS enabled
- [x] `interviews` table created with RLS enabled
- [x] `interview_turns` table created with RLS enabled
- [x] `resume_cache` table created with RLS enabled
- [x] Supabase Auth configured — magic link working
- [x] Auth callback route `/auth/callback` exchanges code for session, upserts user with `role='recruiter'`
- [x] Middleware protects `/recruiter/*` routes — redirects unauthenticated to `/login`
- [x] Login page renders and sends magic link
- [x] Recruiter can log in and land on dashboard
- [x] "Create Interview" form (job title, candidate email, job description)
- [x] Form calls Express backend `POST /api/interview/create`, creates row in `interviews` table
- [x] Shareable `/interview/[uuid]` URL generated and shown to recruiter
- [x] Recruiter dashboard lists all created interviews with status badges and scores
- [x] `lib/api.ts` — typed client helper for all backend calls
- [ ] Vercel deployment confirmed live (pending)
- [ ] Railway deployment confirmed live (pending)

**Future (post-Phase 3):**
- [ ] Separate candidate portal `/candidate/dashboard` — shows interviews by `candidate_email = user.email`
- [ ] Auto-send magic link to candidate email when interview is created

---

### Phase 2: AI Interview Flow (Days 3–4)

**Goal:** Text-based interview works end-to-end. Candidate opens their link, types answers, AI asks intelligent follow-ups, transcript is saved, interview can be ended.

**Deliverables:** Full text interview loop works. AI asks contextually relevant questions. Recruiter can see the saved transcript.

**Where the code lives:** All AI logic goes in the Express backend (`ai-interview-engine-api/`). The Next.js interview room page calls it.

---

#### Step-by-Step Build Order

**Step 1 — Install Anthropic SDK on backend**
```bash
cd ai-interview-engine-api && npm install @anthropic-ai/sdk
```

**Step 2 — Write the system prompt (`src/lib/prompts.ts`)**
- Interviewer persona "Alex", professional, asks one question at a time
- Accepts: `jobTitle`, `jobDescription`, `resumeSummary`, `stage`
- Returns JSON: `{ question, internal_note, stage_transition }`

**Step 3 — Write the Claude interview chain (`src/lib/claude.ts`)**
- Takes: `systemPrompt`, `history` (past turns), `candidateAnswer`
- Calls `claude-sonnet-4-6` with full message history
- Parses JSON response, returns `{ question, internalNote }`
- Caps history at last 10 turns before sending (token control)

**Step 4 — `POST /api/interview/start` on Express**
- Receives: `{ interview_id }`
- Loads interview row from Supabase (job title, job description)
- Builds system prompt
- Calls Claude with empty history + "Hello, I'm ready" seed message
- Saves AI's first question to `interview_turns` table
- Updates `interviews.status` → `'active'`
- Returns: `{ question, turn_number }`

**Step 5 — `POST /api/interview/respond` on Express**
- Receives: `{ interview_id, candidate_answer }`
- Loads full turn history from `interview_turns` for this session
- Builds Claude message array from turns (caps at last 10)
- Calls Claude → gets next question
- Saves candidate turn + AI turn to `interview_turns`
- Returns: `{ question, turn_number, is_last_turn }`

**Step 6 — `POST /api/interview/end` on Express**
- Receives: `{ interview_id }`
- Updates `interviews.status` → `'completed'`, sets `completed_at`
- Returns: `{ ok: true }`

**Step 7 — Build the Interview Room page (`/interview/[sessionId]/page.tsx`)**
- On load: call `/api/interview/start` → display first question
- Text input + submit → call `/api/interview/respond` → show next question
- Transcript panel shows all turns so far
- "End Interview" button → call `/api/interview/end` → show completion screen
- Loading state between each turn ("Alex is thinking...")

**Step 8 — Test end-to-end**
- Create interview as recruiter → copy link → open in new tab (incognito)
- Complete a 3-turn text interview
- Verify all turns saved in Supabase `interview_turns` table
- Verify `interviews.status` = `'completed'`

---

**Folder structure after Phase 2:**
```
ai-interview-engine-api/src/
├── lib/
│   ├── supabase.ts
│   ├── prompts.ts          ← NEW: system prompt builder
│   └── claude.ts           ← NEW: interview chain
├── routes/
│   ├── interview.ts        ← UPDATED: add start, respond, end
│   └── recruiter.ts
└── index.ts

frontend/app/
└── interview/
    └── [sessionId]/
        └── page.tsx        ← UPDATED: full interview UI
```

**APIs used:** Anthropic (`claude-sonnet-4-6`)

**Estimated time:** 6–8 hours

**Don't build yet:** Voice, resume parsing, scoring.

---

#### Phase 2 Checklist

- [x] `@anthropic-ai/sdk` installed on backend
- [x] `src/lib/prompts.ts` — system prompt builder written
- [x] `src/lib/claude.ts` — interview chain written (history + Claude call + JSON parse)
- [x] `POST /api/interview/start` — loads interview, seeds Claude, saves first AI turn, returns question
- [x] `POST /api/interview/respond` — loads history, calls Claude, saves both turns, returns next question
- [x] `POST /api/interview/end` — marks interview completed
- [x] History capped at last 10 turns before each Claude call
- [x] Interview room page calls `/start` on load, shows first question
- [x] Text input + submit calls `/respond`, shows AI follow-up
- [x] Transcript display updates after each turn
- [x] "Alex is thinking..." loading state between turns
- [x] "End Interview" button calls `/end`, shows completion screen
- [x] Full text interview tested end-to-end (create → candidate completes → turns in DB)

---

### Phase 3: Voice Integration (Days 5–6)

**Goal:** Candidate can speak instead of type. AI responds with voice. This is the demo moment.

**Deliverables:** Full voice interview loop works.

**Folder structure additions:**
```
── ai-interview-engine-api/src/routes/
│   └── interview.ts        ← add POST /api/interview/respond (single call: STT + LLM + TTS)
│
── ai-interview-engine-api/src/lib/
│   ├── deepgram.ts         ← transcribeAudio()
│   └── elevenlabs.ts       ← synthesizeSpeech()
│
── ai-interview-engine/components/interview/
│   ├── VoiceRecorder.tsx   ← mic capture, sends audio to Railway
│   ├── AudioPlayer.tsx     ← plays AI audio response
│   └── TranscriptDisplay.tsx
```

**APIs used:** Deepgram Nova-2 (STT), Deepgram Aura (TTS), Anthropic Claude Sonnet 4.6

**Note:** ElevenLabs dropped free API access — switched to Deepgram Aura TTS (`aura-orion-en`). Same Deepgram key, no extra cost.

**Libraries:** multer (already installed) — handles multipart audio upload

**Estimated time:** 20–24 hours (this is the hardest phase)

**Lessons learned:**
- ElevenLabs free tier no longer supports API access — use Deepgram TTS instead
- Use `eleven_turbo_v2_5` model if you do upgrade to ElevenLabs paid
- MediaRecorder codec auto-detection needed — Chrome uses `audio/webm;codecs=opus`, Safari uses `audio/mp4`
- VoiceRecorder state reset must use `useEffect`, not render-time `setState`
- Global Express error handler required — Express 4 drops connections silently on async errors
- Stale closure bug in `handleAudioComplete` — fixed with `isLastTurnRef`

**Don't build yet:** Real-time streaming, video.

#### Phase 3 Checklist

- [x] `src/lib/deepgram.ts` — `transcribeAudio(buffer, mimeType)` written
- [x] `src/lib/elevenlabs.ts` — `synthesizeSpeech(text)` written (using Deepgram Aura TTS)
- [x] `POST /api/interview/respond-voice` — full pipeline: audio in → Deepgram STT → Claude → Deepgram TTS → audio out
- [x] All async route handlers wrapped with `asyncHandler` — errors reach global handler
- [x] Global Express error handler added to `index.ts`
- [x] Backend logs each pipeline step (`[voice] transcribing...`, `[voice] calling Claude...` etc.)
- [x] `VoiceRecorder.tsx` — mic capture, MIME type auto-detection, 2.5s silence detection
- [x] `AudioPlayer.tsx` — base64 → Blob → Object URL → auto-play, memory cleanup
- [x] Voice/text mode toggle in interview room header
- [x] `no_speech_detected` handled gracefully — mic re-enables, no turn wasted
- [x] Stale closure fix — `isLastTurnRef` used in `handleAudioComplete`
- [x] VoiceRecorder state reset fixed — `useEffect` instead of render-time setState
- [x] Full voice loop tested: speak → Deepgram → Claude → Deepgram TTS → audio plays
- [ ] Tested on Safari (requires HTTPS — test on Vercel deploy)
- [ ] Tested on mobile Chrome

---

### Phase 4: Resume-Aware Interviews (Day 7)

**Goal:** Candidate uploads a resume before the interview. Claude Haiku extracts a plain-English summary. That summary is injected into the system prompt so Alex asks targeted follow-up questions based on the candidate's actual background.

**Deliverables:** Pre-interview upload screen → resume parsed → Alex greets → asks "tell me about yourself" → uses resume to ask sharp project and skill follow-ups.

**Folder structure additions:**
```
ai-interview-engine-api/src/
├── lib/
│   └── resumeParser.ts         ← NEW: pdf extraction + Haiku summarization + cache logic
└── routes/
    └── resume.ts               ← NEW: POST /api/resume/parse

frontend/
├── app/interview/[sessionId]/page.tsx   ← UPDATED: pre-interview screen added
└── lib/api.ts                           ← UPDATED: parseResume() added
```

**APIs used:** Claude Haiku 4.5 (resume extraction), Supabase (resume_cache + interviews.resume_text)

**Libraries:** `pdf-parse` v2, `@types/pdf-parse`

**Actual time taken:** ~4 hours

**Decisions made:**
- Job description field removed entirely from create interview form — job title + resume is sufficient context for Alex
- Resume upload is optional — interview works without it, Alex just does a standard warm-up
- Summary stored as plain English prose in `interviews.resume_text`, not JSON — slots directly into system prompt
- PDF not stored in Supabase Storage — only the extracted text summary is kept (simpler, cheaper)
- Resume cache keyed by MD5 hash in `resume_cache.file_hash` column (not `id` — that's a UUID)

**Lessons learned:**
- `pdf-parse` v2 is a complete rewrite — class-based API now: `new PDFParse({ data: buffer })` then `.getText()`. The old `pdfParse(buffer)` call signature no longer works.
- `resume_cache.id` is a UUID — writing an MD5 hash to it fails silently with no error surfaced to the route. Always check the actual column types before upserting.
- Claude Haiku summary should be plain English prose, not JSON — it gets injected directly into the system prompt as the "Candidate Background" section.
- First question being generic ("tell me about yourself") is correct and intentional — Alex uses the resume starting from turn 2 onward, not turn 1.
- Without explicit "Hard Rules" in the system prompt, Claude gravitates toward asking about employers and job titles repeatedly — must explicitly ban "what did you do at [Company]" after the first mention and force turns 3–5 onto projects.

**Interview flow (finalized):**
```
Turn 1:   Alex greets + "Tell me about yourself" (always)
Turn 2:   Cross-references answer with resume — asks about a specific company, project, or skill
Turn 3:   Asks about a specific PROJECT — what it does, stack, their contribution
Turn 4:   Digs into a technical challenge on that project
Turn 5:   Pivots to a DIFFERENT project or side project / technical skill
Turns 6–7: Behavioral — STAR format
Turn 8:   Closing — candidate asks a question, Alex wraps up
```

**Hard rules enforced in prompt:**
- Turns 3–5 must be about projects and technical skills, NOT employers or job titles
- "What did you do at [Company]" banned after the first mention
- After a project question, Alex must go deeper on that project OR ask about a different one — never pivot back to experience

#### Phase 4 Checklist

- [x] `pdf-parse` v2 and `@types/pdf-parse` installed on backend
- [x] `src/lib/resumeParser.ts` — `extractTextFromPdf()` (PDFParse class), `summarizeResume()` (Haiku), `getOrCreateResumeSummary()` with MD5 cache
- [x] Resume cache hit/miss using `resume_cache.file_hash` column
- [x] `src/routes/resume.ts` — `POST /api/resume/parse` with 5MB multer limit
- [x] Resume route mounted in `index.ts` at `/api/resume`
- [x] `interview.ts` — `loadInterviewAndTurns` selects `resume_text`
- [x] `interview.ts` — `/start`, `/respond`, `/respond-voice` all pass `resumeSummary` to Claude
- [x] `api.parseResume()` added to `frontend/lib/api.ts`
- [x] Pre-interview screen added (`'pre-interview'` page state) — PDF drop zone, upload/done/error states
- [x] "Start Interview" works with or without resume upload
- [x] Job description field removed from create interview form (frontend + backend + types)
- [x] System prompt updated — interview flow explicitly covers projects in turns 3–5
- [x] Hard rules added to prompt — blocks experience-loop, forces project questions
- [x] Graceful error shown for scanned/unreadable PDFs (empty text → throws user-facing error)
- [x] Tested on a real resume — Alex references a specific project within turn 3 (verified)
- [x] resume_cache verified saving correctly after fix (file_hash column)

---

### Phase 5: Recruiter Dashboard (Day 8)

**Goal:** Recruiter sees all interviews, can review transcripts.

**Deliverables:** Recruiter can see exactly what happened in each interview.

**Folder structure additions:**
```
app/recruiter/
├── dashboard/page.tsx         ← interview list
└── interview/[id]/page.tsx    ← transcript viewer
app/api/recruiter/
├── interviews/route.ts
└── interview/[id]/route.ts
```

**Estimated time:** 8 hours

**Common mistakes:**
- Not paginating the interview list from day 1 — use Supabase `.range()` immediately

#### Phase 5 Checklist

- [ ] Interview list shows all interviews with status badges
- [ ] Each row shows candidate name, job title, date, status
- [ ] Clicking a row opens the transcript viewer
- [ ] Transcript shows all turns in order, speaker labelled
- [ ] AI-generated 3-bullet summary shown at top of transcript
- [ ] Basic score visible on dashboard (even if just "8/10")
- [ ] Pagination on interview list
- [ ] Empty state shown for new recruiter accounts

---

### Phase 6: AI Scoring (Day 9)

**Goal:** Each completed interview gets an automated score with rationale.

**Deliverables:** Recruiter sees a score card + rationale for each candidate.

**Folder structure additions:**
```
lib/claude/
└── scorer.ts          ← separate scoring prompt
app/api/interview/
└── score/route.ts     ← called after end/route.ts
```

**Estimated time:** 6–8 hours

**Important:** Run scoring asynchronously — don't block the "interview ended" response. Use a fire-and-forget pattern or Vercel background function.

#### Phase 6 Checklist

- [ ] Scoring prompt written (dimensions: communication, technical depth, problem solving, cultural fit)
- [ ] `POST /api/interview/score` route created
- [ ] Scoring triggered automatically when interview ends
- [ ] Scoring runs async — does not block end-interview response
- [ ] Overall score (1–10) saved to `interviews` table
- [ ] Score breakdown JSON saved to `score_breakdown` column
- [ ] Recommendation (advance / hold / reject) saved
- [ ] One-paragraph summary saved
- [ ] Score card displayed on recruiter dashboard
- [ ] Full score breakdown visible on transcript detail page

---

### Phase 7: Deploy + Polish (Day 10)

**Goal:** Live on a real URL. Demo-ready.

**Deliverables:** Share a URL. Someone can do a full interview from their phone.

**Estimated time:** 8 hours

#### Phase 7 Checklist

- [ ] All env vars set in Vercel dashboard
- [ ] Production build passes with no errors
- [ ] Loading states on every async action
- [ ] Error boundaries — no raw error dumps to the user
- [ ] User-friendly error messages for mic denied, PDF upload failed, API timeout
- [ ] Demo interview pre-loaded with a hardcoded job description
- [ ] Mobile responsive interview room
- [ ] Custom domain connected (optional)
- [ ] Full end-to-end test: create interview → candidate completes voice interview → recruiter views transcript + score
- [ ] 60-second screen recording captured for sharing

---

## 4. AI Interview Engine Design

### System Prompt Architecture

The system prompt has four layers. Each layer is built fresh for every session but content is loaded from DB.

```
LAYER 1: Interviewer Persona
LAYER 2: Job Context
LAYER 3: Resume Context
LAYER 4: Interview Instructions
```

### Full System Prompt Template

```typescript
// lib/claude/prompts.ts

export function buildSystemPrompt(params: {
  jobTitle: string
  jobDescription: string
  resumeSummary: string
  interviewStage: 'intro' | 'technical' | 'behavioral' | 'closing'
}): string {
  return `You are Alex, a professional technical interviewer at a top tech company.

## Job Context
Role: ${params.jobTitle}
${params.jobDescription}

## Candidate Background
${params.resumeSummary}

## Your Interview Style
- Ask ONE question at a time. Never ask multiple questions in one turn.
- Listen carefully to answers. Your follow-up must directly reference what the candidate just said.
- Mix question types: technical depth, past experience (STAR format), hypotheticals.
- If an answer is vague, probe deeper with "Can you walk me through a specific example?"
- If an answer is strong, acknowledge briefly and go deeper.
- Do not reveal the scoring criteria.
- Stay in character. You are a human interviewer, not an AI.
- Keep questions concise (1–3 sentences max).
- Current stage: ${params.interviewStage}

## Response Format
Respond ONLY with valid JSON:
{
  "question": "Your next interview question here",
  "internal_note": "Brief note on why you asked this (not shown to candidate)",
  "stage_transition": null | "technical" | "behavioral" | "closing"
}

Do not include any text outside the JSON.`
}
```

---

### Interview Chain — Core Logic

```typescript
// lib/claude/interview-chain.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

export async function getNextQuestion(params: {
  systemPrompt: string
  history: Turn[]
  candidateAnswer: string
}): Promise<{ question: string; internalNote: string }> {
  
  const messages: Turn[] = [
    ...params.history,
    { role: 'user', content: params.candidateAnswer }
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: params.systemPrompt,
    messages,
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  
  try {
    const parsed = JSON.parse(raw)
    return {
      question: parsed.question,
      internalNote: parsed.internal_note ?? ''
    }
  } catch {
    // Graceful fallback if Claude doesn't return valid JSON
    return { question: raw, internalNote: '' }
  }
}
```

---

### Conversation State

```typescript
// Stored in DB, reconstructed per request

interface InterviewSession {
  id: string
  systemPrompt: string          // built once at session start
  turns: {
    turnNumber: number
    speaker: 'ai' | 'candidate'
    text: string
    timestamp: string
  }[]
  currentStage: 'intro' | 'technical' | 'behavioral' | 'closing'
  totalTurns: number
  maxTurns: number              // default: 12 (6 exchanges)
}

// On each API call, reconstruct Claude message array:
function toClaudeMessages(turns: InterviewSession['turns']): Turn[] {
  return turns.map(t => ({
    role: t.speaker === 'ai' ? 'assistant' : 'user',
    content: t.text
  }))
}
```

---

### Resume Summary Extraction

```typescript
// lib/resume/parser.ts
import pdfParse from 'pdf-parse'

export async function extractResumeText(pdfBuffer: Buffer): Promise<string> {
  const data = await pdfParse(pdfBuffer)
  return data.text
}

export async function summarizeResume(
  rawText: string,
  client: Anthropic
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', // cheaper model for extraction
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Extract key information from this resume. Return ONLY a JSON object:
{
  "name": "...",
  "current_title": "...",
  "years_experience": 0,
  "companies": ["..."],
  "top_skills": ["..."],
  "education": "...",
  "notable_projects": ["..."]
}

Resume:
${rawText.slice(0, 3000)}`
    }]
  })
  
  return response.content[0].type === 'text' ? response.content[0].text : '{}'
}

// Convert to interviewer-friendly text:
export function resumeToContext(parsed: Record<string, unknown>): string {
  return `Candidate: ${parsed.name}
Current role: ${parsed.current_title} with ${parsed.years_experience} years experience
Past companies: ${(parsed.companies as string[]).join(', ')}
Key skills: ${(parsed.top_skills as string[]).join(', ')}
Education: ${parsed.education}
Notable work: ${(parsed.notable_projects as string[]).join('; ')}`
}
```

---

### Scoring Prompt

```typescript
// lib/claude/scorer.ts

export const SCORING_PROMPT = `You are evaluating a job interview transcript.

Score the candidate on a scale of 1–10 for each dimension. Be calibrated and honest.
Return ONLY valid JSON — no markdown, no extra text.

{
  "overall_score": 7,
  "dimensions": {
    "communication": { "score": 8, "note": "Clear and structured answers" },
    "technical_depth": { "score": 6, "note": "Solid fundamentals, gaps in distributed systems" },
    "problem_solving": { "score": 7, "note": "Good approach, could be more systematic" },
    "cultural_fit": { "score": 8, "note": "Collaborative, growth-oriented" }
  },
  "strengths": ["Strong communication", "Good real-world examples"],
  "concerns": ["Limited experience with scale"],
  "recommendation": "advance" | "reject" | "hold",
  "summary": "One paragraph summary for the recruiter."
}`
```

---

## 5. Voice Architecture

### Simplest Working Architecture (MVP)

Single API call to Railway — no timeout, no splitting needed.

```
┌──────────────────────────────────────────────────────────┐
│ BROWSER (Vercel)                                          │
│                                                           │
│  1. getUserMedia() → microphone stream                    │
│  2. MediaRecorder → collect audio chunks                  │
│  3. On silence (2s) → stop recording                      │
│  4. POST audioBlob → Railway /api/interview/respond       │
│  5. Receive { question_text, audio_base64 }               │
│  6. new Audio(base64url).play()                           │
└──────────────────────────┬───────────────────────────────┘
                           │ POST multipart/form-data
┌──────────────────────────▼───────────────────────────────┐
│ /api/interview/respond  (Railway — Express)               │
│                                                           │
│  1. Parse audio from FormData                             │
│  2. Deepgram.transcribe(audio) → text       (~1–2s)      │
│  3. Load session history from Supabase                    │
│  4. Claude.messages() → next question JSON  (~2–3s)      │
│  5. Save turn to Supabase DB                              │
│  6. ElevenLabs.synthesize(question) → mp3   (~1–2s)      │
│  7. Return { question_text, audio: base64 }               │
└───────────────────────────────────────────────────────────┘
```

**Total latency:** ~5–7 seconds. No timeout risk — Railway has no limit.

---

### VoiceRecorder Component

```typescript
// components/interview/VoiceRecorder.tsx
'use client'
import { useRef, useState, useCallback } from 'react'

export function VoiceRecorder({
  onAudioReady
}: {
  onAudioReady: (blob: Blob) => void
}) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    
    recorder.ondataavailable = (e) => {
      chunksRef.current.push(e.data)
      // Reset 2s silence timer on each data chunk
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => stopRecording(), 2000)
    }
    
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      chunksRef.current = []
      onAudioReady(blob)
      stream.getTracks().forEach(t => t.stop())
    }

    recorder.start(500) // emit data every 500ms
    mediaRecorderRef.current = recorder
    setIsRecording(true)
  }, [onAudioReady])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      className={`rounded-full p-4 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}
    >
      {isRecording ? 'Listening...' : 'Start Speaking'}
    </button>
  )
}
```

---

### Deepgram STT Integration

```typescript
// lib/deepgram/transcribe.ts

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: audioBuffer,
    }
  )

  const data = await response.json()
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
}
```

---

### ElevenLabs TTS Integration

```typescript
// lib/elevenlabs/synthesize.ts

const VOICE_ID = 'pNInz6obpgDQGcFmaJgB' // "Adam" — professional male voice

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      }),
    }
  )

  return Buffer.from(await response.arrayBuffer())
}
```

---

### Is WebRTC Needed for MVP?

**No.** WebRTC is needed when:
- Two humans need to talk to each other (peer-to-peer)
- You need sub-500ms latency
- You're streaming audio in real-time

For MVP, MediaRecorder + REST is sufficient:
- Collect 2–3 seconds of audio
- Send as a blob
- Get a response
- Play it back

**WebRTC complexity adds:** ICE servers, STUN/TURN setup, signaling server, peer connection management — that's 2–3 days of extra work for marginal UX improvement.

**Add WebRTC streaming in V2** if users complain about 4-second latency. Most won't.

---

## 6. Solo Founder Strategy

### AI Coding Tools — Priority Order

| Tool | Use For | Cost |
|---|---|---|
| **Claude Code (this tool)** | Architecture, complex logic, debugging, code review | $20/mo |
| **Cursor** | Fast code generation, refactoring, autocomplete | $20/mo |
| **v0.dev** | Generate React component UI from description | $20/mo |
| **Lovable** | Full-page scaffold from a prompt | $25/mo |

**Recommended workflow:**
1. Use **v0.dev** to generate all UI components first (interview room, dashboard, forms)
2. Paste generated code into your Next.js project via **Cursor**
3. Use **Claude Code** for backend logic, API integrations, debugging, and architecture decisions
4. Use **Lovable** only if you're stuck on a full page layout from scratch

**Best daily workflow for a solo founder:**

```
Morning (2h): Build session planning — list exactly what you're building today
Code (4–5h): Implement with Cursor + Claude Code assistance
Test (1h): Test the feature yourself, find 3 bugs
Fix (1h): Fix the bugs found
Deploy (30min): Push to Vercel, verify on prod URL
Evening (30min): Note what's blocked for tomorrow
```

---

### What to NEVER Custom-Build in MVP

- Authentication system
- Email delivery (use Resend or Sendgrid)
- PDF rendering
- Rate limiting (use Vercel's built-in)
- Payment processing (use Stripe if needed)
- Any ML model training
- Admin dashboard (use Supabase Studio as your admin)

---

### What Fake/Demo Implementations Are Acceptable

| Feature | MVP Shortcut | Real version when |
|---|---|---|
| Email invites | Copy-paste URL | Week 3 |
| Real-time transcript | Show after turn completes | Month 2 |
| Video recording | Audio only | Month 2 |
| Custom AI personas | One hardcoded "Alex" | Month 2 |
| ATS integration | Manual CSV export | When enterprise asks |
| Multi-language | English only | When international user signs up |
| Analytics dashboard | Use Supabase Studio | Month 3 |

---

### What Users Care About Most in Demos

1. **Voice quality** — If the AI sounds robotic, the demo dies. Use ElevenLabs.
2. **Follow-up intelligence** — AI must reference what the candidate just said. If it ignores the answer, the demo dies.
3. **Speed** — If the AI takes 10+ seconds to respond, users lose interest. Keep it under 5 seconds.
4. **Resume awareness** — "I see you worked at Google" — instant credibility.
5. **Recruiter dashboard** — Simple list + transcript. Recruiters just want to not watch video recordings.

---

### The "Wow Factor" Checklist

- [ ] AI speaks with a natural voice (not robotic)
- [ ] AI says candidate's name within first 2 turns
- [ ] AI references a specific item from the resume
- [ ] AI asks a sharp follow-up that directly addresses a vague answer
- [ ] Recruiter sees a clean score + summary immediately after demo interview ends
- [ ] Page loads fast (< 2 seconds)
- [ ] Works on mobile (candidate interviews from phone)

---

### What to Outsource After MVP

- UI/UX design polish → hire a freelancer on Contra ($500–2k)
- Marketing site → use Framer or Webflow
- Customer support → Intercom free tier
- Legal (ToS, Privacy Policy) → Termly or Clerky

---

## 7. Final Recommendation

### Recommended MVP Stack (Final)

```
Frontend:         Next.js 14 (App Router) — Vercel (free)
Backend:          Express — Railway (free month → $5/mo)
Styling:          Tailwind CSS + shadcn/ui
Auth:             Supabase Auth (magic link)
Database:         Supabase Postgres
Storage:          Supabase Storage (resume PDFs, audio)
LLM:              Claude Sonnet 4.6 (questions + scoring) + Claude Haiku 4.5 (resume)
STT:              Deepgram Nova-2 REST API
TTS:              ElevenLabs REST API (demo) → OpenAI TTS (scale)
Resume Parsing:   pdf-parse + Claude Haiku
Monitoring:       Sentry free + Vercel logs + Railway logs
Analytics:        PostHog free
Payments:         Stripe (add only when first customer asks)
```

**Monthly cost at MVP scale (0–100 users):**
```
Vercel frontend:   $0
Railway backend:   $0 (free month) → $5/mo after
Supabase:          $0
Claude API:        ~$10/mo (50 interviews × 20 turns)
Deepgram:          ~$2/mo  (50 interviews × 10 min)
ElevenLabs:        $5/mo   (30k chars)
---
Now:               ~$17/mo (Railway free)
Later:             ~$22/mo (Railway paid)
```

---

### Fastest Build Strategy

1. **Never block on perfect.** Hardcode. Mock. Ship. Iterate.
2. **Build the voice loop on Day 1 of voice work** — everything else is just data in/out.
3. **Ship to Vercel on Day 1** — always develop against production URL, not localhost.
4. **Do one demo per day from Day 3 onwards** — be your own harshest critic.
5. **Don't refactor until a user asks you to** — premature cleanup kills momentum.

---

### Cheapest Working Architecture

Replace ElevenLabs with OpenAI TTS at scale:
```
STT: Deepgram Nova-2   → $0.0043/min
TTS: OpenAI TTS-1      → $0.015/1k chars (20x cheaper than ElevenLabs)
LLM: Claude Haiku      → $0.80/1M in tokens
---
Cost per interview (10min):  ~$0.10
```

Use ElevenLabs for demos. Switch to OpenAI TTS when you hit 500+ interviews/month.

---

### Simplest Scalable Setup

The monolith scales further than you think:
- Vercel handles 10k concurrent users out of the box
- Supabase scales to 500GB+ on paid plan
- Connection pooling: add `pgbouncer` on Supabase when you hit 100 concurrent DB connections
- Add a Redis cache (Upstash free tier) only when API route latency spikes above 2s

**You won't need microservices until $50k MRR.** Ignore anyone who tells you otherwise.

---

### Biggest Mistakes to Avoid

1. **Skipping Supabase RLS** — Add row-level security on Day 1 or you'll have a security breach.
2. **Building video before voice works** — Voice is harder. Video adds nothing to the core demo.
3. **Using WebRTC before validating the concept** — 3 days of complexity for 1.5 seconds of latency improvement.
4. **Premature AI fine-tuning** — Prompt engineering beats fine-tuning for MVP. Period.
5. **Building multi-tenant admin before you have tenants** — Your first 10 customers are managed manually.
6. **Streaming before REST works** — Streaming Claude/Deepgram/ElevenLabs adds complexity. Get it working first, then stream.
7. **Worrying about token costs before usage** — At 50 interviews, your LLM bill is less than your coffee bill.

---

### Path from MVP → Production

```
MVP (Day 10)
  ↓
V1.0 — First paying customer
  Add: Stripe payments, email notifications, better error handling
  ↓
V1.5 — 10 customers
  Add: Streaming voice (WebSocket), custom interview templates, CSV export
  ↓
V2.0 — 50 customers
  Add: Video recording (Daily.co), ATS integrations, team accounts
  ↓
V3.0 — $10k MRR
  Extract: Voice pipeline → separate service (cost optimization)
  Add: Multi-language, custom AI personas, enterprise SSO
  ↓
Scale — $50k MRR
  Migrate: Microservices where justified by cost or team size
  Add: Self-hosted LLM option for enterprise, SOC2 compliance
```

**The rule:** Every architectural upgrade should be justified by a real user complaint or a real cost problem. Not by theory.

---

*Generated: 2026-05-19 | Stack versions current as of generation date. Check npm/API docs for latest SDKs before building.*
