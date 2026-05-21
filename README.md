# AI Interview Engine

> An AI-powered interview platform that conducts real voice interviews, asks intelligent follow-up questions, and gives recruiters instant transcripts and scores — without a human interviewer in the room.

---

## What It Does

A recruiter creates an interview in 30 seconds. The candidate gets a link. They talk to Alex — an AI interviewer that listens, follows up on what they actually said, and adapts questions based on their resume. When it's done, the recruiter gets a full transcript and an AI-generated score card.

No scheduling. No bias from tired interviewers. No waiting a week for feedback.

---

## Demo Flow

```
Recruiter logs in
  → fills in job title + description
  → gets a shareable link

Candidate opens the link
  → speaks their answers (or types)
  → Alex asks intelligent follow-ups in real time
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
| AI Interviewer | Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| Resume Parsing | Claude Haiku 4.5 |
| Speech-to-Text | Deepgram Nova-2 |
| Text-to-Speech | ElevenLabs |
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
│   │   │   └── create/                # Create new interview
│   │   └── interview/[sessionId]/     # Candidate interview room
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
│       │   └── supabase.ts            # Supabase service role client
│       └── routes/
│           ├── interview.ts           # /start /respond /end /create
│           └── recruiter.ts           # /interviews list
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
- A [Deepgram](https://deepgram.com) API key *(Phase 3)*
- An [ElevenLabs](https://elevenlabs.io) API key *(Phase 3)*

### 1. Clone the repo

```bash
git clone https://github.com/your-username/ai-interview-engine.git
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

# Deepgram
DEEPGRAM_API_KEY=your_deepgram_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key

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

Run these tables in your Supabase SQL editor:

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
  job_description text not null,
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
  parsed_json jsonb not null,
  created_at timestamptz default now()
);
```

Also go to **Supabase → Authentication → URL Configuration** and add:
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

## Build Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Auth + Recruiter Dashboard | ✅ Done |
| 2 | AI Text Interview (Claude) | ✅ Done |
| 3 | Voice Interview (Deepgram + ElevenLabs) | 🔨 In Progress |
| 4 | Resume-Aware Questions | ⏳ Upcoming |
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
| Deepgram | ~$2/mo |
| ElevenLabs | ~$5/mo |
| **Total** | **~$17/mo** |

---

## License

MIT
