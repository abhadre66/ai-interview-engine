'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { VoiceRecorder } from '@/components/interview/VoiceRecorder'
import { AudioPlayer } from '@/components/interview/AudioPlayer'

interface Turn {
  speaker: 'ai' | 'candidate'
  text: string
}

type PageState = 'pre-interview' | 'loading' | 'active' | 'thinking' | 'playing' | 'ended' | 'error'
type UploadState = 'idle' | 'uploading' | 'done' | 'error'
type Mode = 'voice' | 'text'

export default function InterviewPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [pageState, setPageState] = useState<PageState>('pre-interview')
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadError, setUploadError] = useState('')
  const [mode, setMode] = useState<Mode>('voice')
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [transcript, setTranscript] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [isLastTurn, setIsLastTurn] = useState(false)
  const isLastTurnRef = useRef(false)
  const [audioBase64, setAudioBase64] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // Start interview — triggered when user clicks "Start Interview" on pre-interview screen
  useEffect(() => {
    if (pageState !== 'loading') return
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
  }, [pageState, sessionId])

  // ── Pre-interview ──────────────────────────────────────────

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadState('uploading')
    setUploadError('')

    try {
      await api.parseResume(sessionId, file)
      setUploadState('done')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadState('error')
    }
  }

  function handleStartInterview() {
    setPageState('loading')
  }

  // ── Voice flow ─────────────────────────────────────────────

  async function handleAudioReady(blob: Blob) {
    setPageState('thinking')

    try {
      const data = await api.respondVoice(sessionId, blob)

      // Add candidate transcript + AI question to transcript
      setTranscript(prev => [
        ...prev,
        { speaker: 'candidate', text: data.candidate_transcript },
        { speaker: 'ai', text: data.question_text },
      ])

      setCurrentQuestion(data.question_text)
      isLastTurnRef.current = data.is_last_turn
      setIsLastTurn(data.is_last_turn)
      setAudioBase64(data.audio_base64)
      setPageState('playing')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg === 'no_speech_detected') {
        // Don't count as a turn — just re-enable mic
        setPageState('active')
      } else {
        setErrorMsg(msg)
        setPageState('error')
      }
    }
  }

  function handleAudioComplete() {
    setAudioBase64(null)
    if (isLastTurnRef.current) {
      handleEnd()
    } else {
      setPageState('active')
    }
  }

  // ── Text flow ──────────────────────────────────────────────

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || pageState !== 'active') return

    const candidateAnswer = answer.trim()
    setAnswer('')
    setPageState('thinking')
    setTranscript(prev => [...prev, { speaker: 'candidate', text: candidateAnswer }])

    try {
      const data = await api.respondToInterview(sessionId, candidateAnswer)
      setTranscript(prev => [...prev, { speaker: 'ai', text: data.question }])
      setCurrentQuestion(data.question)
      setIsLastTurn(data.is_last_turn)
      setPageState('active')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }

  // ── End interview ──────────────────────────────────────────

  async function handleEnd() {
    setPageState('thinking')
    try {
      await api.endInterview(sessionId)
    } finally {
      setPageState('ended')
    }
  }

  // ── Pre-interview ──────────────────────────────────────────

  if (pageState === 'pre-interview') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Before we begin</h1>
            <p className="text-sm text-gray-500">
              Upload your resume so Alex can tailor questions to your background.
            </p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resume <span className="text-gray-400 font-normal">(optional)</span>
            </label>

            {uploadState === 'done' ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Resume uploaded — Alex will reference your background
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                uploadState === 'uploading'
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
              }`}>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleResumeUpload}
                  disabled={uploadState === 'uploading'}
                />
                {uploadState === 'uploading' ? (
                  <>
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-sm text-indigo-600">Parsing resume...</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm text-gray-500">Click to upload PDF</p>
                    <p className="text-xs text-gray-400 mt-1">Max 5MB</p>
                  </>
                )}
              </label>
            )}

            {uploadState === 'error' && (
              <p className="text-xs text-red-500 mt-2">{uploadError}</p>
            )}
          </div>

          <button
            onClick={handleStartInterview}
            disabled={uploadState === 'uploading'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-3 rounded-xl text-sm transition-colors"
          >
            Start Interview
          </button>

          {uploadState !== 'done' && (
            <p className="text-center text-xs text-gray-400 mt-3">
              You can skip resume upload and start directly
            </p>
          )}
        </div>
      </div>
    )
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 w-full max-w-lg text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Complete</h2>
          <p className="text-gray-500 text-sm mb-8">
            Thank you for your time. The recruiter will review your responses and be in touch soon.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Your transcript</p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {transcript.map((turn, i) => (
                <p key={i} className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold">{turn.speaker === 'ai' ? 'Alex' : 'You'}:</span>{' '}
                  {turn.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Active interview ───────────────────────────────────────

  const isDisabled = pageState === 'thinking' || pageState === 'playing'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">AI Interview</h1>
          <p className="text-xs text-gray-400">with Alex</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMode('voice')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                mode === 'voice' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🎙 Voice
            </button>
            <button
              onClick={() => setMode('text')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                mode === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ⌨️ Text
            </button>
          </div>

          <button
            onClick={handleEnd}
            disabled={isDisabled}
            className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-40"
          >
            End
          </button>
        </div>
      </header>

      <div className="flex flex-col flex-1 max-w-2xl mx-auto w-full px-4 py-6 gap-5 overflow-hidden">

        {/* Current question */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              A
            </div>
            <span className="text-sm font-medium text-gray-700">Alex</span>
            {pageState === 'thinking' && (
              <span className="text-xs text-indigo-400 animate-pulse">is thinking...</span>
            )}
          </div>
          <p className="text-gray-900 leading-relaxed">{currentQuestion}</p>
        </div>

        {/* Audio player — visible only while Alex is speaking */}
        <AudioPlayer
          audioBase64={audioBase64}
          onComplete={handleAudioComplete}
        />

        {/* Input area */}
        <div className="shrink-0">
          {mode === 'voice' ? (
            <div className="flex flex-col items-center py-4">
              <VoiceRecorder
                onAudioReady={handleAudioReady}
                disabled={isDisabled}
              />
            </div>
          ) : (
            <form onSubmit={handleTextSubmit} className="space-y-3">
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                disabled={isDisabled}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleTextSubmit(e)
                }}
                placeholder="Type your answer... (Cmd+Enter to submit)"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="submit"
                disabled={!answer.trim() || isDisabled}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                {pageState === 'thinking' ? 'Waiting for Alex...' : 'Submit Answer'}
              </button>
            </form>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col min-h-0 flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3 shrink-0">
              Transcript
            </p>
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {transcript.map((turn, i) => (
                <div key={i} className={`flex gap-2 ${turn.speaker === 'candidate' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    turn.speaker === 'ai'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
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
