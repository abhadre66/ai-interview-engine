import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (!code && !token_hash) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          )
        },
      },
    }
  )

  let data: { user: import('@supabase/supabase-js').User | null } | null = null
  let error: unknown = null

  if (token_hash && type) {
    const result = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'magiclink' | 'signup' | 'email',
    })
    data = result.data
    error = result.error
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code)
    data = result.data
    error = result.error
  }

  if (error || !data?.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Upsert user into our users table with recruiter role
  await supabase.from('users').upsert({
    id: data!.user!.id,
    email: data!.user!.email!,
    role: 'recruiter',
  }, { onConflict: 'id' })

  return NextResponse.redirect(`${origin}/recruiter/dashboard`)
}
