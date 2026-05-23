import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabase'
import { getOrCreateResumeSummary } from '../lib/resumeParser'

const router = Router()

// 5MB limit — pdf-parse buffers the whole file in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next)

// ── POST /api/resume/parse ─────────────────────────────────────────────────────

router.post('/parse', upload.single('resume'), asyncHandler(async (req, res) => {
  const { interview_id } = req.body
  const file = req.file

  if (!interview_id) {
    res.status(400).json({ error: 'interview_id required' })
    return
  }

  if (!file) {
    res.status(400).json({ error: 'resume file required' })
    return
  }

  console.log(`[resume] parsing ${file.size} bytes for interview ${interview_id}`)

  const summary = await getOrCreateResumeSummary(file.buffer)

  const { error } = await supabase
    .from('interviews')
    .update({ resume_text: summary })
    .eq('id', interview_id)

  if (error) {
    console.error('[resume] failed to save summary to interview:', error)
    res.status(500).json({ error: 'Failed to attach resume to interview' })
    return
  }

  console.log('[resume] summary saved to interview')
  res.json({ summary })
}))

export default router
