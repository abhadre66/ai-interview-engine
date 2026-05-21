import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { getOpeningQuestion, getNextQuestion, type Turn } from '../lib/claude'

const router = Router()

const MAX_TURNS = 8

// POST /api/interview/create
router.post('/create', async (req: Request, res: Response) => {
  const { recruiter_id, candidate_email, job_title, job_description } = req.body

  if (!recruiter_id || !candidate_email || !job_title || !job_description) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  const { data, error } = await supabase
    .from('interviews')
    .insert({ recruiter_id, candidate_email, job_title, job_description, status: 'pending' })
    .select('id')
    .single()

  if (error) {
    console.error('Create interview error:', error)
    res.status(500).json({ error: 'Failed to create interview' })
    return
  }

  res.json({ interview_id: data.id })
})

// POST /api/interview/start
// Called once when candidate opens their link for the first time
router.post('/start', async (req: Request, res: Response) => {
  const { interview_id } = req.body

  if (!interview_id) {
    res.status(400).json({ error: 'interview_id required' })
    return
  }

  // Load interview
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select('id, job_title, job_description, status')
    .eq('id', interview_id)
    .single()

  if (interviewError || !interview) {
    res.status(404).json({ error: 'Interview not found' })
    return
  }

  // If already active, return the existing first question instead of re-seeding
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

  // Get Claude's opening question
  const { question, internalNote } = await getOpeningQuestion({
    jobTitle: interview.job_title,
    jobDescription: interview.job_description,
  })

  // Save AI's first turn to DB
  const { error: turnError } = await supabase
    .from('interview_turns')
    .insert({
      interview_id,
      turn_number: 1,
      speaker: 'ai',
      text: question,
      timestamp: new Date().toISOString(),
    })

  if (turnError) {
    console.error('Save turn error:', turnError)
    res.status(500).json({ error: 'Failed to save interview turn' })
    return
  }

  // Mark interview as active
  await supabase
    .from('interviews')
    .update({ status: 'active' })
    .eq('id', interview_id)

  res.json({ question, turn_number: 1, internal_note: internalNote })
})

// POST /api/interview/respond
// Called each time the candidate submits an answer
router.post('/respond', async (req: Request, res: Response) => {
  const { interview_id, candidate_answer } = req.body

  if (!interview_id || !candidate_answer?.trim()) {
    res.status(400).json({ error: 'interview_id and candidate_answer required' })
    return
  }

  // Load interview
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select('id, job_title, job_description, status')
    .eq('id', interview_id)
    .single()

  if (interviewError || !interview) {
    res.status(404).json({ error: 'Interview not found' })
    return
  }

  if (interview.status !== 'active') {
    res.status(400).json({ error: 'Interview is not active' })
    return
  }

  // Load all existing turns
  const { data: existingTurns, error: turnsError } = await supabase
    .from('interview_turns')
    .select('turn_number, speaker, text')
    .eq('interview_id', interview_id)
    .order('turn_number', { ascending: true })

  if (turnsError) {
    res.status(500).json({ error: 'Failed to load interview history' })
    return
  }

  const nextTurnNumber = (existingTurns?.length ?? 0) + 1

  // Save candidate's answer first
  await supabase.from('interview_turns').insert({
    interview_id,
    turn_number: nextTurnNumber,
    speaker: 'candidate',
    text: candidate_answer.trim(),
    timestamp: new Date().toISOString(),
  })

  // Build Claude message history from saved turns
  const history: Turn[] = (existingTurns ?? []).map(t => ({
    role: t.speaker === 'ai' ? 'assistant' : 'user',
    content: t.text,
  }))

  // Get Claude's next question
  const { question, internalNote, stageTransition } = await getNextQuestion({
    jobTitle: interview.job_title,
    jobDescription: interview.job_description,
    history,
    candidateAnswer: candidate_answer.trim(),
  })

  const aiTurnNumber = nextTurnNumber + 1
  const isLastTurn = aiTurnNumber >= MAX_TURNS * 2 // each exchange = 2 turns

  // Save AI's response
  await supabase.from('interview_turns').insert({
    interview_id,
    turn_number: aiTurnNumber,
    speaker: 'ai',
    text: question,
    timestamp: new Date().toISOString(),
  })

  res.json({
    question,
    turn_number: aiTurnNumber,
    is_last_turn: isLastTurn,
    internal_note: internalNote,
    stage_transition: stageTransition,
  })
})

// POST /api/interview/end
// Called when candidate clicks "End Interview"
router.post('/end', async (req: Request, res: Response) => {
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

  res.json({ ok: true })
})

// GET /api/interview/:id
router.get('/:id', async (req: Request, res: Response) => {
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
})

export default router
