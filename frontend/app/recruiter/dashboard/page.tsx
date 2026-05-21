import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let interviews: Awaited<ReturnType<typeof api.listInterviews>>['interviews'] = []
  let total = 0

  try {
    const result = await api.listInterviews(user.id)
    interviews = result.interviews
    total = result.total
  } catch {
    // Backend may not be running yet in dev; show empty state
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">AI Interview Engine</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Interviews</h2>
            <p className="text-sm text-gray-500 mt-1">{total} total</p>
          </div>
          <Link
            href="/recruiter/create"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            + New Interview
          </Link>
        </div>

        {interviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <p className="text-gray-400 text-sm mb-4">No interviews yet</p>
            <Link
              href="/recruiter/create"
              className="text-indigo-600 hover:underline text-sm font-medium"
            >
              Create your first interview →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-4 font-medium text-gray-500">Candidate</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Role</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Score</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Created</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((interview) => (
                  <tr key={interview.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900">{interview.candidate_email}</td>
                    <td className="px-6 py-4 text-gray-700">{interview.job_title}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[interview.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {interview.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {interview.score != null ? `${interview.score}/10` : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(interview.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/recruiter/interview/${interview.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
