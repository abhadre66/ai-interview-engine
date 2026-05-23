export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Deepgram error ${response.status}: ${error}`)
  }

  const data = await response.json() as {
    results?: {
      channels?: {
        alternatives?: {
          transcript?: string
        }[]
      }[]
    }
  }

  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

  return transcript.trim()
}
