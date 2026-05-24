const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `API error ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  // ── Recruiter ──────────────────────────────────────────────

  createInterview(data: {
    recruiter_id: string
    candidate_email: string
    job_title: string
  }) {
    return apiFetch<{ interview_id: string }>('/api/interview/create', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getInterview(interview_id: string, recruiter_id: string) {
    return apiFetch<{
      interview: {
        id: string
        candidate_email: string
        job_title: string
        status: string
        score: number | null
        score_breakdown: {
          dimensions: Record<string, { score: number; note: string }>
          strengths: string[]
          concerns: string[]
          recommendation: string
          summary: string
        } | null
        resume_text: string | null
        created_at: string
        completed_at: string | null
      }
      turns: {
        turn_number: number
        speaker: 'ai' | 'candidate'
        text: string
        timestamp: string
      }[]
    }>(`/api/recruiter/interview/${interview_id}?recruiter_id=${recruiter_id}`)
  },

  listInterviews(recruiter_id: string, page = 0) {
    return apiFetch<{
      interviews: {
        id: string
        candidate_email: string
        job_title: string
        status: string
        score: number | null
        created_at: string
        completed_at: string | null
      }[]
      total: number
      page: number
    }>(`/api/recruiter/interviews?recruiter_id=${recruiter_id}&page=${page}`)
  },

  // ── Interview room ─────────────────────────────────────────

  startInterview(interview_id: string) {
    return apiFetch<{ question: string; turn_number: number; resumed?: boolean }>(
      '/api/interview/start',
      { method: 'POST', body: JSON.stringify({ interview_id }) }
    )
  },

  respondToInterview(interview_id: string, candidate_answer: string) {
    return apiFetch<{
      question: string
      turn_number: number
      is_last_turn: boolean
    }>('/api/interview/respond', {
      method: 'POST',
      body: JSON.stringify({ interview_id, candidate_answer }),
    })
  },

  endInterview(interview_id: string) {
    return apiFetch<{ ok: boolean }>('/api/interview/end', {
      method: 'POST',
      body: JSON.stringify({ interview_id }),
    })
  },

  async parseResume(interview_id: string, file: File): Promise<{ summary: string }> {
    const formData = new FormData()
    formData.append('interview_id', interview_id)
    formData.append('resume', file)

    const res = await fetch(`${API_URL}/api/resume/parse`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `API error ${res.status}`)
    }

    return res.json()
  },

  async respondVoice(interview_id: string, audioBlob: Blob): Promise<{
    question_text: string
    audio_base64: string
    candidate_transcript: string
    turn_number: number
    is_last_turn: boolean
  }> {
    const formData = new FormData()
    formData.append('interview_id', interview_id)
    formData.append('audio', audioBlob, 'recording.webm')

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const res = await fetch(`${API_URL}/api/interview/respond-voice`, {
      method: 'POST',
      body: formData,
      // No Content-Type header — browser sets it automatically with boundary for multipart
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `API error ${res.status}`)
    }

    return res.json()
  },
}
