import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/recruiter/interviews?recruiter_id=xxx&page=0
router.get('/interviews', async (req: Request, res: Response) => {
  const { recruiter_id, page = '0' } = req.query

  if (!recruiter_id) {
    res.status(400).json({ error: 'recruiter_id required' })
    return
  }

  const pageNum = parseInt(page as string, 10)
  const pageSize = 20

  const { data, error, count } = await supabase
    .from('interviews')
    .select('id, candidate_email, job_title, status, score, created_at, completed_at', { count: 'exact' })
    .eq('recruiter_id', recruiter_id)
    .order('created_at', { ascending: false })
    .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)

  if (error) {
    console.error('List interviews error:', error)
    res.status(500).json({ error: 'Failed to fetch interviews' })
    return
  }

  res.json({ interviews: data, total: count ?? 0, page: pageNum })
})

// GET /api/recruiter/interview/:id?recruiter_id=xxx
router.get('/interview/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { recruiter_id } = req.query

  if (!recruiter_id) {
    res.status(400).json({ error: 'recruiter_id required' })
    return
  }

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select('id, candidate_email, job_title, status, score, score_breakdown, resume_text, created_at, completed_at, recruiter_id')
    .eq('id', id)
    .single()

  if (interviewError || !interview) {
    res.status(404).json({ error: 'Interview not found' })
    return
  }

  if (interview.recruiter_id !== recruiter_id) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const { data: turns, error: turnsError } = await supabase
    .from('interview_turns')
    .select('turn_number, speaker, text, timestamp')
    .eq('interview_id', id)
    .order('turn_number', { ascending: true })

  if (turnsError) {
    console.error('Fetch turns error:', turnsError)
    res.status(500).json({ error: 'Failed to fetch transcript' })
    return
  }

  res.json({ interview, turns: turns ?? [] })
})

export default router
