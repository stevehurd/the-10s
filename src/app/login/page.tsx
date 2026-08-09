'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { buildEmailAuthCallbackUrl, normalizeNextPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/client'

type Step = 'EMAIL' | 'LINK_SENT'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell>Loading sign-in…</LoginShell>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const invitedEmail = searchParams.get('invited') === 'true'
    ? searchParams.get('email')?.trim().toLowerCase() ?? ''
    : ''
  const [step, setStep] = useState<Step>('EMAIL')
  const [email, setEmail] = useState(invitedEmail)
  const [message, setMessage] = useState<string | null>(
    searchParams.get('error') === 'invalid-code'
      ? 'That sign-in link is invalid or has expired. Request a new one.'
      : null,
  )
  const [pending, setPending] = useState(false)

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)

    const nextPath = normalizeNextPath(searchParams.get('next'))

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: buildEmailAuthCallbackUrl(window.location.origin, nextPath),
      },
    })

    setPending(false)
    if (error) {
      setMessage(error.message)
      return
    }

    setStep('LINK_SENT')
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto flex min-h-[75vh] max-w-md items-center">
        <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-orange-300">
              The 10&apos;s
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Sign in to your pool</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              No password needed. We&apos;ll email you a secure, one-time sign-in link.
            </p>
          </div>

          {invitedEmail && step === 'EMAIL' ? (
            <div className="mb-5 rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm text-slate-200">
              Your invitation is for <strong>{invitedEmail}</strong>. Use that address to connect your historical roster.
            </div>
          ) : null}

          {step === 'EMAIL' ? (
            <form className="space-y-5" onSubmit={requestLink}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Email address</span>
                <input
                  autoComplete="email"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                {pending ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          ) : (
            <div className="space-y-5 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
              <div>
                <h2 className="text-xl font-semibold">Check your email</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Open the secure sign-in link sent to <strong>{email.trim()}</strong>. It will return you here and sign you in.</p>
              </div>
              <button
                className="w-full px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
                onClick={() => {
                  setStep('EMAIL')
                  setMessage(null)
                }}
                type="button"
              >
                Use a different email
              </button>
            </div>
          )}

          {message ? (
            <p aria-live="polite" className="mt-5 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto flex min-h-[75vh] max-w-md items-center">
        <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-7 text-slate-400 shadow-2xl shadow-black/30 backdrop-blur">
          {children}
        </section>
      </div>
    </main>
  )
}
