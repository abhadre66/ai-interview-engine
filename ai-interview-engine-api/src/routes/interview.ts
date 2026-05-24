import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabase'
import { getOpeningQuestion, getNextQuestion, type Turn } from '../lib/claude'
import { transcribeAudio } from '../lib/deepgram'
import { synthesizeSpeech } from '../lib/elevenlabs'
import { scoreInterview } from '../lib/scorer'
import { sendInterviewInvite } from '../lib/email'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

const MAX_TURNS = 8

// Wraps async route handlers so errors propagate to Express error handler
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next)

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function loadInterviewAndTurns(interview_id: string) {
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select('id, job_title, job_description, resume_text, status')
    .eq('id', interview_id)
    .single()

  if (interviewError || !interview) return { interview: null, turns: [] }

  const { data: turns } = await supabase
    .from('interview_turns')
    .select('turn_number, speaker, text')
    .eq('interview_id', interview_id)
    .order('turn_number', { ascending: true })

  return { interview, turns: turns ?? [] }
}

async function saveTurn(
  interview_id: string,
  turn_number: number,
  speaker: 'ai' | 'candidate',
  text: string
) {
  return supabase.from('interview_turns').insert({
    interview_id,
    turn_number,
    speaker,
    text,
    timestamp: new Date().toISOString(),
  })
}

// ── POST /api/interview/create ─────────────────────────────────────────────────

router.post('/create', asyncHandler(async (req, res) => {
  const { recruiter_id, candidate_email, job_title } = req.body

  if (!recruiter_id || !candidate_email || !job_title) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  const { data, error } = await supabase
    .from('interviews')
    .insert({ recruiter_id, candidate_email, job_title, status: 'pending' })
    .select('id')
    .single()

  if (error) {
    console.error('Create interview error:', error)
    res.status(500).json({ error: 'Failed to create interview' })
    return
  }

  res.json({ interview_id: data.id })

  // Send invite email in background — don't block recruiter getting their link
  sendInterviewInvite({
    candidateEmail: candidate_email,
    jobTitle: job_title,
    interviewId: data.id,
  }).catch(err => console.error('[email] failed to send invite:', err.message))
}))

// ── POST /api/interview/start ──────────────────────────────────────────────────

router.post('/start', asyncHandler(async (req, res) => {
  const { interview_id } = req.body

  if (!interview_id) {
    res.status(400).json({ error: 'interview_id required' })
    return
  }

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select('id, job_title, job_description, resume_text, status')
    .eq('id', interview_id)
    .single()

  if (interviewError || !interview) {
    res.status(404).json({ error: 'Interview not found' })
    return
  }

  if (interview.status === 'active') {
    const { data: firstTurn } = await supabase
      .from('interview_turns')
      .select('text, turn_number')
      .eq('interview_id', interview_id)
      .eq('speaker', 'ai')
      .order('turn_number', { ascending: true })
      .limit(1)
      .single()

    if (firstTurn) {
      res.json({ question: firstTurn.text, turn_number: firstTurn.turn_number, resumed: true })
      return
    }
  }

  if (interview.status === 'completed') {
    res.status(400).json({ error: 'This interview has already been completed' })
    return
  }

  const { question, internalNote } = await getOpeningQuestion({
    jobTitle: interview.job_title,
    resumeSummary: interview.resume_text ?? undefined,
  })

  const { error: turnError } = await saveTurn(interview_id, 1, 'ai', question)

  if (turnError) {
    console.error('Save turn error:', turnError)
    res.status(500).json({ error: 'Failed to save interview turn' })
    return
  }

  await supabase.from('interviews').update({ status: 'active' }).eq('id', interview_id)

  res.json({ question, turn_number: 1, internal_note: internalNote })
}))

// ── POST /api/interview/respond (text) ────────────────────────────────────────

router.post('/respond', asyncHandler(async (req, res) => {
  const { interview_id, candidate_answer } = req.body

  if (!interview_id || !candidate_answer?.trim()) {
    res.status(400).json({ error: 'interview_id and candidate_answer required' })
    return
  }

  const { interview, turns } = await loadInterviewAndTurns(interview_id)

  if (!interview) {
    res.status(404).json({ error: 'Interview not found' })
    return
  }

  if (interview.status !== 'active') {
    res.status(400).json({ error: 'Interview is not active' })
    return
  }

  const nextTurnNumber = turns.length + 1
  await saveTurn(interview_id, nextTurnNumber, 'candidate', candidate_answer.trim())

  const history: Turn[] = turns.map(t => ({
    role: t.speaker === 'ai' ? 'assistant' : 'user',
    content: t.text,
  }))

  const { question, internalNote, stageTransition } = await getNextQuestion({
    jobTitle: interview.job_title,
    resumeSummary: interview.resume_text ?? undefined,
    history,
    candidateAnswer: candidate_answer.trim(),
  })

  const aiTurnNumber = nextTurnNumber + 1
  const isLastTurn = aiTurnNumber >= MAX_TURNS * 2

  await saveTurn(interview_id, aiTurnNumber, 'ai', question)

  res.json({
    question,
    turn_number: aiTurnNumber,
    is_last_turn: isLastTurn,
    internal_note: internalNote,
    stage_transition: stageTransition,
  })
}))

// ── POST /api/interview/respond-voice ─────────────────────────────────────────

router.post('/respond-voice', upload.single('audio'), asyncHandler(async (req, res) => {
  const { interview_id } = req.body
  const audioFile = req.file

  if (!interview_id || !audioFile) {
    res.status(400).json({ error: 'interview_id and audio file required' })
    return
  }

  const { interview, turns } = await loadInterviewAndTurns(interview_id)

  if (!interview) {
    res.status(404).json({ error: 'Interview not found' })
    return
  }

  if (interview.status !== 'active') {
    res.status(400).json({ error: 'Interview is not active' })
    return
  }

  console.log(`[voice] transcribing ${audioFile.size} bytes (${audioFile.mimetype})`)
  const candidateText = await transcribeAudio(audioFile.buffer, audioFile.mimetype)

  if (!candidateText) {
    res.status(422).json({ error: 'no_speech_detected' })
    return
  }

  console.log(`[voice] transcript: "${candidateText}"`)

  const nextTurnNumber = turns.length + 1
  await saveTurn(interview_id, nextTurnNumber, 'candidate', candidateText)

  const history: Turn[] = turns.map(t => ({
    role: t.speaker === 'ai' ? 'assistant' : 'user',
    content: t.text,
  }))

  console.log('[voice] calling Claude...')
  const { question, internalNote, stageTransition } = await getNextQuestion({
    jobTitle: interview.job_title,
    resumeSummary: interview.resume_text ?? undefined,
    history,
    candidateAnswer: candidateText,
  })

  const aiTurnNumber = nextTurnNumber + 1
  const isLastTurn = aiTurnNumber >= MAX_TURNS * 2

  await saveTurn(interview_id, aiTurnNumber, 'ai', question)

  console.log('[voice] synthesizing speech...')
  const audioBuffer = await synthesizeSpeech(question)
  const audioBase64 = audioBuffer.toString('base64')

  console.log('[voice] done — sending response')

  res.json({
    question_text: question,
    audio_base64: audioBase64,
    candidate_transcript: candidateText,
    turn_number: aiTurnNumber,
    is_last_turn: isLastTurn,
    internal_note: internalNote,
    stage_transition: stageTransition,
  })
}))

// ── POST /api/interview/end ────────────────────────────────────────────────────

router.post('/end', asyncHandler(async (req, res) => {
  const { interview_id } = req.body

  if (!interview_id) {
    res.status(400).json({ error: 'interview_id required' })
    return
  }

  const { error } = await supabase
    .from('interviews')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', interview_id)

  if (error) {
    console.error('End interview error:', error)
    res.status(500).json({ error: 'Failed to end interview' })
    return
  }

  // Respond immediately — candidate sees "Interview Complete" without waiting for scoring
  res.json({ ok: true })

  // Score in background — fire-and-forget, never blocks the response
  scoreInterview(interview_id).catch(err =>
    console.error('[scoring] unhandled error:', err.message)
  )
}))

// ── GET /api/interview/:id ─────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const { data, error } = await supabase
    .from('interviews')
    .select('*, interview_turns(*)')
    .eq('id', id)
    .single()

  if (error) {
    res.status(404).json({ error: 'Interview not found' })
    return
  }

  res.json(data)
}))

export default router
