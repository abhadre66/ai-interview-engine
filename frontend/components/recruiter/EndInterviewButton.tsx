'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export function EndInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleEnd() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }

    setLoading(true)
    try {
      await api.endInterview(interviewId)
      router.refresh()
    } finally {
      setLoading(false)
      setConfirmed(false)
    }
  }

  return (
    <button
      onClick={handleEnd}
      disabled={loading}
      className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        confirmed
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-red-50 hover:bg-red-100 text-red-600'
      }`}
    >
      {loading ? 'Ending...' : confirmed ? 'Confirm end?' : 'End Interview'}
    </button>
  )
}
