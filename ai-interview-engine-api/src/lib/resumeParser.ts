import crypto from 'crypto'
import { PDFParse } from 'pdf-parse'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text.trim()
}

export async function summarizeResume(rawText: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `You are extracting key facts from a resume for an interviewer to reference.
Write 3–5 sentences in plain English describing this candidate. Include: their name, current or most recent role, years of experience, past notable employers, top technical skills, and education. Be concise and factual.

Resume:
${rawText.slice(0, 4000)}`,
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}

// Returns a cached summary if this exact PDF was parsed before, otherwise parses and caches it.
export async function getOrCreateResumeSummary(buffer: Buffer): Promise<string> {
  const hash = hashBuffer(buffer)

  const { data: cached } = await supabase
    .from('resume_cache')
    .select('parsed_json')
    .eq('file_hash', hash)
    .single()

  if (cached?.parsed_json) {
    console.log('[resume] cache hit')
    return cached.parsed_json as string
  }

  console.log('[resume] cache miss — parsing PDF and calling Haiku')
  const rawText = await extractTextFromPdf(buffer)

  if (!rawText) {
    throw new Error('Could not extract text from PDF. Please upload a text-based PDF, not a scanned image.')
  }

  const summary = await summarizeResume(rawText)

  await supabase.from('resume_cache').insert({
    file_hash: hash,
    parsed_json: summary,
    created_at: new Date().toISOString(),
  })

  return summary
}
