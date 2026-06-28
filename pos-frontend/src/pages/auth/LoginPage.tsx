import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { loginWithEmail, loginWithPin } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'

interface PublicStore { id: number; name: string }
async function getPublicStores(): Promise<PublicStore[]> {
  const { data } = await api.get('/stores/public')
  return (data.data as PublicStore[]).map(s => ({ id: s.id, name: s.name }))
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type EmailFormData = z.infer<typeof emailSchema>

// ── Sub-components ────────────────────────────────────────────────────────────

function EmailLoginForm({ onSuccess }: { onSuccess: (role: string) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormData>({ resolver: zodResolver(emailSchema) })

  const mutation = useMutation({
    mutationFn: (data: EmailFormData) =>
      loginWithEmail(data.email, data.password),
    onSuccess: (res) => {
      setAuth(res.user, res.accessToken, res.refreshToken)
      onSuccess(res.user.role)
    },
  })

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-surface-100 mb-1.5">
          Email address
        </label>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="admin@store.com"
          className="w-full px-4 py-3 rounded-lg bg-surface-700 border border-surface-500
                     text-white placeholder-surface-300 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent
                     transition"
        />
        {errors.email && (
          <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-100 mb-1.5">
          Password
        </label>
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full px-4 py-3 rounded-lg bg-surface-700 border border-surface-500
                     text-white placeholder-surface-300 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent
                     transition"
        />
        {errors.password && (
          <p className="mt-1.5 text-xs text-red-400">
            {errors.password.message}
          </p>
        )}
      </div>

      {mutation.isError && (
        <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
          {(mutation.error as Error)?.message ?? 'Invalid email or password'}
        </div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                   text-white font-semibold text-sm tracking-wide
                   focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-800
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {mutation.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

// ── PIN Pad ───────────────────────────────────────────────────────────────────

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

function PinLoginForm({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const setAuth = useAuthStore((s) => s.setAuth)

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['public-stores'],
    queryFn: getPublicStores,
    staleTime: 300_000,
  })

  // Auto-select if only one store
  const effectiveStoreId = selectedStoreId ?? (stores.length === 1 ? stores[0].id : null)

  const mutation = useMutation({
    mutationFn: (p: string) => loginWithPin(effectiveStoreId!, p),
    onSuccess: (res) => {
      setAuth(res.user, res.accessToken, res.refreshToken)
      onSuccess(res.user.role)
    },
    onError: () => {
      setError('Incorrect PIN. Please try again.')
      setPin('')
    },
  })

  function handleKey(key: string) {
    setError('')
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1))
      return
    }
    if (key === '') return
    if (pin.length >= 6) return
    const next = pin + key
    setPin(next)
    if (next.length >= 4) {
      // Auto-submit at 4 digits; cashier can enter up to 6 and tap Submit
    }
  }

  function handleSubmit() {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits')
      return
    }
    mutation.mutate(pin)
  }

  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length)

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Store selector — shown when multiple stores exist */}
      {stores.length > 1 && (
        <div className="w-full">
          <label className="block text-xs font-medium text-surface-300 mb-1.5 text-center">
            Select Store
          </label>
          <select
            value={selectedStoreId ?? ''}
            onChange={e => setSelectedStoreId(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg bg-surface-700 border border-surface-500
                       text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            <option value="">— Choose your store —</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {storesLoading && (
        <p className="text-surface-400 text-xs">Loading stores…</p>
      )}

      {/* PIN display dots */}
      <div className="flex gap-3 mt-2">
        {dots.map((filled, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors
              ${filled
                ? 'bg-primary-500 border-primary-500'
                : 'bg-transparent border-surface-400'
              }`}
          />
        ))}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {PIN_KEYS.map((key, idx) => {
          const isEmpty = key === ''
          const isBackspace = key === '⌫'
          return (
            <button
              key={idx}
              onClick={() => handleKey(key)}
              disabled={isEmpty || mutation.isPending}
              aria-label={isBackspace ? 'Backspace' : isEmpty ? '' : key}
              className={`
                h-16 rounded-xl text-xl font-semibold transition-all select-none
                focus:outline-none focus:ring-2 focus:ring-primary-500
                active:scale-95
                ${isEmpty
                  ? 'invisible'
                  : isBackspace
                    ? 'bg-surface-600 hover:bg-surface-500 text-surface-100'
                    : 'bg-surface-600 hover:bg-surface-500 active:bg-surface-400 text-white'
                }
                disabled:opacity-50
              `}
            >
              {key}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={pin.length < 4 || mutation.isPending || !effectiveStoreId}
        className="w-full max-w-xs py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700
                   active:bg-primary-800 text-white font-semibold text-base
                   focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                   focus:ring-offset-surface-800
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        {mutation.isPending ? 'Verifying…' : 'Enter'}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'pin' | 'email'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pin')
  const navigate = useNavigate()

  function handleSuccess(role: string) {
    const destination = role === 'CASHIER' ? '/pos' : '/dashboard'
    navigate(destination, { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                          bg-primary-600 mb-4 shadow-lg">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184
                   1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            MartPOS
          </h1>
          <p className="text-surface-300 text-sm mt-1">
            {activeTab === 'pin' ? 'Enter your cashier PIN' : 'Sign in to your account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-800 rounded-2xl shadow-xl border border-surface-700 overflow-hidden">

          {/* Tab switcher */}
          <div className="flex border-b border-surface-700">
            <button
              onClick={() => setActiveTab('pin')}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                ${activeTab === 'pin'
                  ? 'text-primary-400 border-b-2 border-primary-500 bg-surface-800'
                  : 'text-surface-300 hover:text-surface-100 bg-surface-900'
                }`}
            >
              PIN Login
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                ${activeTab === 'email'
                  ? 'text-primary-400 border-b-2 border-primary-500 bg-surface-800'
                  : 'text-surface-300 hover:text-surface-100 bg-surface-900'
                }`}
            >
              Email Login
            </button>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'pin' ? (
              <PinLoginForm onSuccess={handleSuccess} />
            ) : (
              <EmailLoginForm onSuccess={handleSuccess} />
            )}
          </div>
        </div>

        <p className="text-center text-surface-400 text-xs mt-6">
          PIN login is for cashiers · Email login is for managers & admins
        </p>
      </div>
    </div>
  )
}
