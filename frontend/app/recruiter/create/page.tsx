'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { api } from '@/lib/api'

export default function CreateInterviewPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    candidate_email: '',
    job_title: '',
    job_description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    try {
      const { interview_id } = await api.createInterview({
        recruiter_id: user.id,
        ...form,
      })
      setCreatedId(interview_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create interview')
    } finally {
      setLoading(false)
    }
  }

  if (createdId) {
    const interviewUrl = `${window.location.origin}/interview/${createdId}`

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 w-full max-w-lg text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview created!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Share this link with your candidate:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 break-all font-mono mb-4">
            {interviewUrl}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(interviewUrl)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mb-3"
          >
            Copy link
          </button>
          <Link
            href="/recruiter/dashboard"
            className="block text-sm text-gray-500 hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <Link href="/recruiter/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Dashboard
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Interview</h1>
        <p className="text-gray-500 text-sm mb-8">Fill in the details — we'll generate a shareable link for your candidate.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Candidate email
            </label>
            <input
              type="email"
              required
              value={form.candidate_email}
              onChange={(e) => update('candidate_email', e.target.value)}
              placeholder="candidate@email.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job title
            </label>
            <input
              type="text"
              required
              value={form.job_title}
              onChange={(e) => update('job_title', e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job description
            </label>
            <textarea
              required
              rows={6}
              value={form.job_description}
              onChange={(e) => update('job_description', e.target.value)}
              placeholder="Paste the job description here. The AI will use this to ask relevant interview questions."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Creating...' : 'Create interview'}
          </button>
        </form>
      </main>
    </div>
  )
}
