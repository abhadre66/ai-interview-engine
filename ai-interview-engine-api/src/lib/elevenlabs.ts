// Using Deepgram TTS (Aura) instead of ElevenLabs — same Deepgram API key, no extra cost

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const response = await fetch(
    'https://api.deepgram.com/v1/speak?model=aura-orion-en',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Deepgram TTS error ${response.status}: ${error}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
