'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioPlayerProps {
  audioBase64: string | null
  onComplete: () => void
}

export function AudioPlayer({ audioBase64, onComplete }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const objectUrlRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!audioBase64) return

    // Clean up previous object URL to avoid memory leaks
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    // Convert base64 → Blob → Object URL
    const binary = atob(audioBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: 'audio/mp3' })
    const url = URL.createObjectURL(blob)
    objectUrlRef.current = url

    const audio = new Audio(url)
    audioRef.current = audio

    audio.onplay = () => setIsPlaying(true)

    audio.onended = () => {
      setIsPlaying(false)
      URL.revokeObjectURL(url)
      objectUrlRef.current = null
      onComplete()
    }

    audio.onerror = () => {
      setIsPlaying(false)
      URL.revokeObjectURL(url)
      objectUrlRef.current = null
      onComplete() // unblock the mic even if audio fails
    }

    audio.play().catch(() => {
      // Autoplay blocked — call onComplete so the mic re-enables
      setIsPlaying(false)
      onComplete()
    })

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [audioBase64]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      audioRef.current?.pause()
    }
  }, [])

  if (!isPlaying) return null

  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4">
      {/* Animated sound bars */}
      <div className="flex items-end gap-0.5 h-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="w-1 bg-indigo-500 rounded-full animate-pulse"
            style={{
              height: `${30 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.6 + (i % 2) * 0.2}s`,
            }}
          />
        ))}
      </div>

      <div>
        <p className="text-sm font-medium text-indigo-700">Alex is speaking...</p>
        <p className="text-xs text-indigo-400">Listen carefully</p>
      </div>
    </div>
  )
}
