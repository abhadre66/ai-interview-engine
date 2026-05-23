# AI Interview Engine

> An AI-powered interview platform that conducts real voice interviews, asks intelligent follow-up questions based on the candidate's resume, and gives recruiters instant transcripts and scores — without a human interviewer in the room.

---

## What It Does

A recruiter creates an interview in 30 seconds — just a job title and candidate email. The candidate gets a link, uploads their resume, and talks to Alex — an AI interviewer that listens, follows up on what they actually said, and drills into their specific projects and skills. When it's done, the recruiter gets a full transcript and an AI-generated score card.

No scheduling. No bias from tired interviewers. No waiting a week for feedback.

---

## Demo Flow

```
Recruiter logs in
  → fills in job title + candidate email
  → gets a shareable link

Candidate opens the link
  → uploads their resume (optional)
  → Alex greets and asks "tell me about yourself"
  → Alex cross-references their answer with the resume
  → asks targeted follow-ups about specific projects and skills
  → speaks their answers (or types)
  → interview ends in ~10 minutes

Recruiter sees
  → full transcript
  → score out of 10
  → hire / hold / reject recommendation
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) |
| Backend | Express.js |
| Database + Auth | Supabase (Postgres + Magic Link) |
| AI Interviewer | Claude Sonnet 4.6 |
| Resume Parsing | Claude Haiku 4.5 |
| Speech-to-Text | Deepgram Nova-2 |
| Text-to-Speech | Deepgram Aura (`aura-orion-en`) |
| PDF Extraction | pdf-parse v2 |
| Styling | Tailwind CSS |
| Frontend Deploy | Vercel |
| Backend Deploy | Railway |

---

## Project Structure

```
ai-interview-engine/
├── frontend/                          # Next.js app (Vercel)
│   ├── app/
│   │   ├── login/                     # Magic link auth
│   │   ├── recruiter/
│   │   │   ├── dashboard/             # Interview list
│   │   │   └── create/                # Create new interview (title + email)
│   │   └── interview/[sessionId]/     # Candidate interview room
│   ├── components/
│   │   └── interview/
│   │       ├── VoiceRecorder.tsx      # Mic capture + silence detection
│   │       └── AudioPlayer.tsx        # Base64 audio → auto-play
│   ├── lib/
│   │   ├── api.ts                     # Typed backend client
│   │   └── supabase/                  # Supabase browser + server clients
│   └── middleware.ts                  # Route protection
│
├── ai-interview-engine-api/           # Express backend (Railway)
│   └── src/
│       ├── lib/
│       │   ├── claude.ts              # Interview chain (Claude API)
│       │   ├── prompts.ts             # System prompt builder
│       │   ├── deepgram.ts            # STT + TTS via Deepgram
│       │   ├── elevenlabs.ts          # TTS (Deepgram Aura under the hood)
│       │   ├── resumeParser.ts        # PDF extraction + Haiku summarization
│       │   └── supabase.ts            # Supabase service role client
│       └── routes/
│           ├── interview.ts           # /start /respond /respond-voice /end
│           ├── resume.ts              # /parse — PDF → summary → DB
│           └── recruiter.ts          # /interviews list
│
├── .env                               # Single env file for both projects
└── Pipeline.md                        # Full architecture + build roadmap
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key
- A [Deepgram](https://deepgram.com) API key

### 1. Clone the repo

```bash
git clone https://github.com/abhadre66/ai-interview-engine.git
cd ai-interview-engine
```

### 2. Set up environment variables

Create a single `.env` file at the root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key

# Deepgram (STT + TTS)
DEEPGRAM_API_KEY=your_deepgram_key

# Backend
PORT=3001
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Install dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd ../ai-interview-engine-api && npm install
```

### 4. Set up Supabase

Run these in your Supabase SQL editor:

```sql
create table users (
  id uuid primary key references auth.users,
  email text not null,
  role text not null default 'recruiter',
  created_at timestamptz default now()
);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid references users(id),
  candidate_email text not null,
  job_title text not null,
  resume_text text,
  status text default 'pending',
  score int,
  score_breakdown jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table interview_turns (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references interviews(id),
  turn_number int not null,
  speaker text not null,
  text text not null,
  audio_url text,
  timestamp timestamptz default now()
);

create table resume_cache (
  id uuid primary key default gen_random_uuid(),
  file_hash text unique not null,
  parsed_json text not null,
  created_at timestamptz default now()
);
```

Enable Row Level Security on all tables. Go to **Supabase → Authentication → URL Configuration** and add:
```
http://localhost:3000/auth/callback
```

### 5. Run locally

```bash
# Terminal 1 — Backend
cd ai-interview-engine-api && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open `http://localhost:3000`

---

## How the Interview Works

### Voice pipeline (per turn)
```
Candidate speaks → MediaRecorder captures audio blob
  → POST /api/interview/respond-voice
  → Deepgram Nova-2 STT (~1s)
  → Claude Sonnet 4.6 generates next question (~2s)
  → Deepgram Aura TTS → mp3 audio (~1s)
  → Browser plays response
Total latency: ~4–5 seconds
```

### Resume pipeline (once per session)
```
Candidate uploads PDF
  → MD5 hash checked against resume_cache table
  → Cache miss: pdf-parse v2 extracts text → Claude Haiku summarizes (~300 tokens)
  → Summary saved to interviews.resume_text + resume_cache
  → All Claude calls receive resume summary in system prompt
```

### Interview flow (8 turns)
```
Turn 1:   Alex greets + "Tell me about yourself"
Turn 2:   Cross-references answer with resume — asks about a specific detail
Turn 3:   Asks about a specific project (stack, contribution, outcome)
Turn 4:   Digs into a technical challenge on that project
Turn 5:   Pivots to a different project or side project
Turns 6–7: Behavioral questions (STAR format)
Turn 8:   Closing — candidate asks a question, Alex wraps up
```

---

## Build Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Auth + Recruiter Dashboard | ✅ Done |
| 2 | AI Text Interview (Claude) | ✅ Done |
| 3 | Voice Interview (Deepgram STT + TTS) | ✅ Done |
| 4 | Resume-Aware Questions | ✅ Done |
| 5 | Recruiter Transcript View | ⏳ Upcoming |
| 6 | AI Scoring | ⏳ Upcoming |
| 7 | Deploy + Polish | ⏳ Upcoming |

---

## Cost to Run

| Service | Cost at MVP scale (50 interviews/mo) |
|---|---|
| Vercel | $0 |
| Railway | $0 → $5/mo |
| Supabase | $0 |
| Claude API | ~$10/mo |
| Deepgram (STT + TTS) | ~$3/mo |
| **Total** | **~$13/mo** |

---

## License

MIT
