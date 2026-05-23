'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type RecorderState = 'idle' | 'recording' | 'sending'

interface VoiceRecorderProps {
  onAudioReady: (blob: Blob, mimeType: string) => void
  disabled?: boolean
}

// Pick the best supported MIME type for this browser
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export function VoiceRecorder({ onAudioReady, disabled = false }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopRecording = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (state !== 'idle' || disabled) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }

        // Reset silence timer on every chunk that has data
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(() => {
          stopRecording()
        }, 2500)
      }

      recorder.onstop = () => {
        // Stop all mic tracks
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null

        const finalMimeType = mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: finalMimeType })
        chunksRef.current = []

        setState('sending')
        onAudioReady(blob, finalMimeType)
      }

      recorder.start(500) // emit a chunk every 500ms
      setState('recording')
    } catch (err) {
      console.error('Mic access error:', err)
      setState('idle')
      alert('Microphone access was denied. Please allow mic access and try again.')
    }
  }, [state, disabled, onAudioReady, stopRecording])

  // Reset to idle when parent re-enables after receiving the response
  useEffect(() => {
    if (!disabled && state === 'sending') {
      setState('idle')
    }
  }, [disabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={state === 'recording' ? stopRecording : startRecording}
        disabled={disabled || state === 'sending'}
        className={`
          relative w-20 h-20 rounded-full flex items-center justify-center
          transition-all duration-200 shadow-lg
          ${state === 'recording'
            ? 'bg-red-500 hover:bg-red-600 scale-110'
            : state === 'sending'
            ? 'bg-gray-300 cursor-not-allowed'
            : disabled
            ? 'bg-gray-200 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
          }
        `}
      >
        {/* Pulse ring while recording */}
        {state === 'recording' && (
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
        )}

        {/* Icon */}
        {state === 'sending' ? (
          <svg className="w-7 h-7 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm-1 18.93A8.001 8.001 0 014 12H2a10 10 0 009 9.93V24h2v-2.07A10 10 0 0022 12h-2a8 8 0 01-7 7.93V20h-2v-.07z" />
          </svg>
        )}
      </button>

      <p className="text-sm font-medium text-gray-500">
        {state === 'recording' && <span className="text-red-500">Listening... (stop speaking to send)</span>}
        {state === 'sending' && <span className="text-gray-400">Sending...</span>}
        {state === 'idle' && !disabled && <span>Tap to speak</span>}
        {state === 'idle' && disabled && <span className="text-gray-300">Please wait...</span>}
      </p>
    </div>
  )
}
