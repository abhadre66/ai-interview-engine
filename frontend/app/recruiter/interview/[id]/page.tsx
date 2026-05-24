import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active:  'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
}

const RECOMMENDATION_STYLES: Record<string, string> = {
  advance: 'bg-green-100 text-green-800',
  hold:    'bg-yellow-100 text-yellow-800',
  reject:  'bg-red-100 text-red-800',
}

const DIMENSIONS = ['communication', 'technical_depth', 'problem_solving', 'cultural_fit']
const DIMENSION_LABELS: Record<string, string> = {
  communication:   'Communication',
  technical_depth: 'Technical Depth',
  problem_solving: 'Problem Solving',
  cultural_fit:    'Cultural Fit',
}

export default async function InterviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let data: Awaited<ReturnType<typeof api.getInterview>> | null = null

  try {
    data = await api.getInterview(id, user.id)
  } catch {
    redirect('/recruiter/dashboard')
  }

  const { interview, turns } = data!
  const breakdown = interview.score_breakdown

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/recruiter/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
            ← Dashboard
          </Link>
          <div className="w-px h-4 bg-gray-200" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{interview.candidate_email}</p>
            <p className="text-xs text-gray-400">{interview.job_title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[interview.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {interview.status}
          </span>
          {interview.score != null && (
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              {interview.score}/10
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Score card */}
        {breakdown ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Overall Score</p>
                <p className="text-4xl font-bold text-gray-900">{interview.score}<span className="text-lg text-gray-400 font-normal">/10</span></p>
              </div>
              {breakdown.recommendation && (
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold capitalize ${RECOMMENDATION_STYLES[breakdown.recommendation] ?? 'bg-gray-100 text-gray-700'}`}>
                  {breakdown.recommendation}
                </span>
              )}
            </div>

            {/* Dimension bars */}
            <div className="space-y-3 mb-5">
              {DIMENSIONS.map(key => {
                const dim = breakdown.dimensions?.[key]
                if (!dim) return null
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{DIMENSION_LABELS[key]}</span>
                      <span className="text-gray-400">{dim.score}/10</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${dim.score * 10}%` }}
                      />
                    </div>
                    {dim.note && <p className="text-xs text-gray-400 mt-0.5">{dim.note}</p>}
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            {breakdown.summary && (
              <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                {breakdown.summary}
              </p>
            )}

            {/* Strengths + Concerns */}
            {(breakdown.strengths?.length > 0 || breakdown.concerns?.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mt-4 border-t border-gray-100 pt-4">
                {breakdown.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Strengths</p>
                    <ul className="space-y-1">
                      {breakdown.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-green-500 mt-0.5">+</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {breakdown.concerns?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Concerns</p>
                    <ul className="space-y-1">
                      {breakdown.concerns.map((c, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-red-400 mt-0.5">−</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400">
              {interview.status === 'completed'
                ? 'Score is being generated...'
                : 'Score will appear here once the interview is complete.'}
            </p>
          </div>
        )}

        {/* Transcript */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-5">Transcript</p>

          {turns.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Interview hasn't started yet.</p>
          ) : (
            <div className="space-y-4">
              {turns.map((turn) => (
                <div
                  key={turn.turn_number}
                  className={`flex gap-3 ${turn.speaker === 'candidate' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    turn.speaker === 'ai'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {turn.speaker === 'ai' ? 'A' : 'Y'}
                  </div>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    turn.speaker === 'ai'
                      ? 'bg-gray-50 text-gray-800'
                      : 'bg-indigo-50 text-indigo-900'
                  }`}>
                    {turn.text}
                    <p className="text-xs text-gray-300 mt-1">
                      {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
