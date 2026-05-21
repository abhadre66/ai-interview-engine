import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, type InterviewStage } from './prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_HISTORY_TURNS = 10

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

export interface NextQuestion {
  question: string
  internalNote: string
  stageTransition: InterviewStage | null
}

// Caps history to last N turns to control token usage
function trimHistory(history: Turn[]): Turn[] {
  if (history.length <= MAX_HISTORY_TURNS) return history
  const trimmed = history.slice(-MAX_HISTORY_TURNS)
  // Claude requires messages to start with 'user' role
  const firstUserIdx = trimmed.findIndex(t => t.role === 'user')
  return firstUserIdx > 0 ? trimmed.slice(firstUserIdx) : trimmed
}

export async function getNextQuestion(params: {
  jobTitle: string
  jobDescription: string
  resumeSummary?: string
  stage?: InterviewStage
  history: Turn[]
  candidateAnswer: string
}): Promise<NextQuestion> {
  const { jobTitle, jobDescription, resumeSummary, stage, history, candidateAnswer } = params

  const systemPrompt = buildSystemPrompt({ jobTitle, jobDescription, resumeSummary, stage })

  const messages: Turn[] = trimHistory([
    ...history,
    { role: 'user', content: candidateAnswer },
  ])

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages,
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  return parseClaudeResponse(raw)
}

// Seed message to kick off the interview without a real candidate answer
export async function getOpeningQuestion(params: {
  jobTitle: string
  jobDescription: string
  resumeSummary?: string
}): Promise<NextQuestion> {
  const { jobTitle, jobDescription, resumeSummary } = params

  const systemPrompt = buildSystemPrompt({ jobTitle, jobDescription, resumeSummary, stage: 'intro' })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      { role: 'user', content: 'Hello, I am ready to begin the interview.' },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  return parseClaudeResponse(raw)
}

function parseClaudeResponse(raw: string): NextQuestion {
  try {
    // Strip markdown code fences if Claude wraps JSON in them
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      question: parsed.question ?? raw,
      internalNote: parsed.internal_note ?? '',
      stageTransition: parsed.stage_transition ?? null,
    }
  } catch {
    // Graceful fallback — return raw text as the question
    return { question: raw, internalNote: '', stageTransition: null }
  }
}
