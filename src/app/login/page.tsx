'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import {
  EMAIL_OTP_LENGTH,
  emailOtpErrorMessage,
  normalizeEmail,
  normalizeEmailOtp,
  requestEmailOtp,
  verifyEmailOtp,
} from '@/lib/auth/email-otp'
import { normalizeNextPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/client'

type Step = 'EMAIL' | 'CODE_SENT'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell>Loading sign-in…</LoginShell>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const invitedEmail = searchParams.get('invited') === 'true'
    ? searchParams.get('email')?.trim().toLowerCase() ?? ''
    : ''
  const [step, setStep] = useState<Step>('EMAIL')
  const [email, setEmail] = useState(invitedEmail)
  const [sentEmail, setSentEmail] = useState('')
  const [code, setCode] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)
  const [message, setMessage] = useState<string | null>(
    searchParams.get('error') === 'invalid-code'
      ? 'That confirmation link is invalid or has expired. Request a new sign-in code below.'
      : null,
  )
  const [pending, setPending] = useState<'request' | 'verify' | 'resend' | null>(null)

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending('request')
    setMessage(null)

    const normalizedEmail = normalizeEmail(email)
    const { error } = await requestEmailOtp(supabase, normalizedEmail)

    setPending(null)
    if (error) {
      setMessage(emailOtpErrorMessage(error, 'request'))
      return
    }

    setSentEmail(normalizedEmail)
    setCode('')
    setResendSeconds(30)
    setStep('CODE_SENT')
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedCode = normalizeEmailOtp(code)
    if (normalizedCode.length !== EMAIL_OTP_LENGTH) {
      setMessage(`Enter the ${EMAIL_OTP_LENGTH}-digit code from your email.`)
      return
    }

    setPending('verify')
    setMessage(null)
    const { error } = await verifyEmailOtp(supabase, sentEmail, normalizedCode)
    setPending(null)
    if (error) {
      setMessage(emailOtpErrorMessage(error, 'verify'))
      return
    }

    const nextPath = normalizeNextPath(searchParams.get('next'))
    router.replace(nextPath)
    router.refresh()
  }

  async function resendCode() {
    setPending('resend')
    setMessage(null)
    const { error } = await requestEmailOtp(supabase, sentEmail)
    setPending(null)
    if (error) {
      setMessage(emailOtpErrorMessage(error, 'request'))
      return
    }

    setCode('')
    setResendSeconds(30)
    setMessage('A new code is on its way.')
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
              No password needed. We&apos;ll email you a secure, one-time sign-in code.
            </p>
          </div>

          {invitedEmail && step === 'EMAIL' ? (
            <div className="mb-5 rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm text-slate-200">
              Your invitation is for <strong>{invitedEmail}</strong>. Use that address to connect your historical roster.
            </div>
          ) : null}

          {step === 'EMAIL' ? (
            <form className="space-y-5" onSubmit={requestCode}>
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
                disabled={pending !== null}
                type="submit"
              >
                {pending === 'request' ? 'Sending…' : 'Email me a code'}
              </button>
            </form>
          ) : (
            <div className="space-y-5 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
              <div>
                <h2 className="text-xl font-semibold">Enter your sign-in code</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">We sent a {EMAIL_OTP_LENGTH}-digit code to <strong>{sentEmail}</strong>.</p>
              </div>
              <form className="space-y-4" onSubmit={verifyCode}>
                <label className="block">
                  <span className="sr-only">Six-digit sign-in code</span>
                  <input
                    aria-label="Six-digit sign-in code"
                    autoComplete="one-time-code"
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.3em] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10"
                    inputMode="numeric"
                    maxLength={EMAIL_OTP_LENGTH}
                    minLength={EMAIL_OTP_LENGTH}
                    onChange={(event) => setCode(normalizeEmailOtp(event.target.value))}
                    pattern={`[0-9]{${EMAIL_OTP_LENGTH}}`}
                    placeholder="000000"
                    required
                    value={code}
                  />
                </label>
                <button
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={pending !== null || code.length !== EMAIL_OTP_LENGTH}
                  type="submit"
                >
                  {pending === 'verify' ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
                  disabled={pending !== null || resendSeconds > 0}
                  onClick={resendCode}
                  type="button"
                >
                  {pending === 'resend'
                    ? 'Sending…'
                    : resendSeconds > 0
                      ? `Resend in ${resendSeconds}s`
                      : 'Resend code'}
                </button>
                <button
                  className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white"
                  onClick={() => {
                    setStep('EMAIL')
                    setCode('')
                    setMessage(null)
                  }}
                  type="button"
                >
                  Change email
                </button>
              </div>
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
