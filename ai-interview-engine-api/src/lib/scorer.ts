import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MIN_TURNS_TO_SCORE = 3

export async function scoreInterview(interviewId: string): Promise<void> {
  console.log(`[scoring] starting for interview ${interviewId}`)

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select('id, job_title, resume_text')
    .eq('id', interviewId)
    .single()

  if (interviewError || !interview) {
    console.error('[scoring] interview not found:', interviewError?.message)
    return
  }

  const { data: turns, error: turnsError } = await supabase
    .from('interview_turns')
    .select('speaker, text')
    .eq('interview_id', interviewId)
    .order('turn_number', { ascending: true })

  if (turnsError || !turns) {
    console.error('[scoring] failed to load turns:', turnsError?.message)
    return
  }

  if (turns.length < MIN_TURNS_TO_SCORE) {
    console.log(`[scoring] only ${turns.length} turns — not enough signal, skipping`)
    return
  }

  const transcript = turns
    .map(t => `${t.speaker === 'ai' ? 'Alex' : 'Candidate'}: ${t.text}`)
    .join('\n')

  const prompt = `You are evaluating a completed job interview for the role of ${interview.job_title}.
${interview.resume_text ? `\nCandidate background:\n${interview.resume_text}\n` : ''}
Interview transcript:
${transcript}

Score the candidate 1–10 on each dimension. Be honest and calibrated — not every candidate scores a 7. Base scores purely on what was said in the transcript.

Return ONLY valid JSON, no markdown, no extra text:

{
  "overall_score": 7,
  "dimensions": {
    "communication":   { "score": 8, "note": "One sentence observation" },
    "technical_depth": { "score": 6, "note": "One sentence observation" },
    "problem_solving": { "score": 7, "note": "One sentence observation" },
    "cultural_fit":    { "score": 7, "note": "One sentence observation" }
  },
  "strengths": ["2-3 specific strengths from the transcript"],
  "concerns":  ["2-3 specific concerns or gaps"],
  "recommendation": "advance",
  "summary": "2-3 sentence paragraph summarising the candidate for the recruiter."
}

recommendation must be exactly one of: "advance", "hold", "reject"`

  console.log('[scoring] calling Claude...')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  let parsed: {
    overall_score: number
    dimensions: Record<string, { score: number; note: string }>
    strengths: string[]
    concerns: string[]
    recommendation: string
    summary: string
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[scoring] failed to parse Claude response:', raw.slice(0, 200))
    return
  }

  const overallScore = Math.round(parsed.overall_score)

  const { error: saveError } = await supabase
    .from('interviews')
    .update({
      score: overallScore,
      score_breakdown: {
        dimensions: parsed.dimensions,
        strengths: parsed.strengths,
        concerns: parsed.concerns,
        recommendation: parsed.recommendation,
        summary: parsed.summary,
      },
    })
    .eq('id', interviewId)

  if (saveError) {
    console.error('[scoring] failed to save score:', saveError.message)
    return
  }

  console.log(`[scoring] done — score: ${overallScore}/10, recommendation: ${parsed.recommendation}`)
}
