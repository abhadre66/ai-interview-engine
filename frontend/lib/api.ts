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
    job_description: string
  }) {
    return apiFetch<{ interview_id: string }>('/api/interview/create', {
      method: 'POST',
      body: JSON.stringify(data),
    })
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
}
