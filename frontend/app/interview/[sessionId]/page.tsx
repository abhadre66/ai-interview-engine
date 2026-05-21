'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

interface Turn {
  speaker: 'ai' | 'candidate'
  text: string
}

type PageState = 'loading' | 'active' | 'thinking' | 'ended' | 'error'

export default function InterviewPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [transcript, setTranscript] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [isLastTurn, setIsLastTurn] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript to bottom on new turns
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // Start interview on mount
  useEffect(() => {
    async function start() {
      try {
        const { question } = await api.startInterview(sessionId)
        setCurrentQuestion(question)
        setTranscript([{ speaker: 'ai', text: question }])
        setPageState('active')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to start interview')
        setPageState('error')
      }
    }
    start()
  }, [sessionId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || pageState !== 'active') return

    const candidateAnswer = answer.trim()
    setAnswer('')
    setPageState('thinking')

    // Optimistically add candidate turn to transcript
    setTranscript(prev => [...prev, { speaker: 'candidate', text: candidateAnswer }])

    try {
      const { question, is_last_turn } = await api.respondToInterview(sessionId, candidateAnswer)

      setTranscript(prev => [...prev, { speaker: 'ai', text: question }])
      setCurrentQuestion(question)
      setIsLastTurn(is_last_turn)
      setPageState('active')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }

  async function handleEnd() {
    setPageState('thinking')
    try {
      await api.endInterview(sessionId)
      setPageState('ended')
    } catch {
      setPageState('ended') // end regardless
    }
  }

  // ── Loading ────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Connecting to Alex...</p>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-red-200 p-10 max-w-md text-center">
          <p className="text-red-600 font-medium mb-2">Something went wrong</p>
          <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Ended ──────────────────────────────────────────────────
  if (pageState === 'ended') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Complete</h2>
          <p className="text-gray-500 text-sm">
            Thank you for your time. The recruiter will review your responses and be in touch soon.
          </p>
          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-left">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Your transcript</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transcript.map((turn, i) => (
                <p key={i} className="text-xs text-gray-600">
                  <span className="font-medium">{turn.speaker === 'ai' ? 'Alex' : 'You'}:</span>{' '}
                  {turn.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Active / Thinking ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">AI Interview</h1>
          <p className="text-xs text-gray-400">with Alex</p>
        </div>
        <button
          onClick={handleEnd}
          disabled={pageState === 'thinking'}
          className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-40"
        >
          End Interview
        </button>
      </header>

      <div className="flex flex-col flex-1 max-w-2xl mx-auto w-full px-4 py-6 gap-6">

        {/* Current question card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
            <span className="text-sm font-medium text-gray-700">Alex</span>
            {pageState === 'thinking' && (
              <span className="text-xs text-gray-400 animate-pulse ml-1">is thinking...</span>
            )}
          </div>
          <p className="text-gray-900 leading-relaxed">
            {pageState === 'thinking' ? currentQuestion : currentQuestion}
          </p>
        </div>

        {/* Answer input */}
        <form onSubmit={handleSubmit} className="shrink-0 space-y-3">
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            disabled={pageState === 'thinking'}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
            }}
            placeholder="Type your answer here... (Cmd+Enter to submit)"
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!answer.trim() || pageState === 'thinking'}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              {pageState === 'thinking' ? 'Waiting for Alex...' : 'Submit Answer'}
            </button>
            {isLastTurn && (
              <button
                type="button"
                onClick={handleEnd}
                className="bg-gray-900 hover:bg-gray-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
              >
                Finish
              </button>
            )}
          </div>
        </form>

        {/* Transcript */}
        {transcript.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex-1 overflow-hidden flex flex-col">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Transcript</p>
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {transcript.map((turn, i) => (
                <div key={i} className={`flex gap-2 ${turn.speaker === 'candidate' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    turn.speaker === 'ai' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {turn.speaker === 'ai' ? 'A' : 'Y'}
                  </div>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    turn.speaker === 'ai'
                      ? 'bg-gray-50 text-gray-800'
                      : 'bg-indigo-50 text-indigo-900'
                  }`}>
                    {turn.text}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
