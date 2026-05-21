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

export default router
