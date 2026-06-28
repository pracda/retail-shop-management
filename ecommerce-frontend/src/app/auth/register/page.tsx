'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Eye, EyeOff } from 'lucide-react'
import { register } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '', address: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        address: form.address || undefined,
      })
      setAuth(res.customer, res.accessToken, res.refreshToken)
      router.push('/products')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message
      setError(msg ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            <Package className="w-6 h-6 text-primary-400" />
            MartShop
          </div>
          <p className="text-gray-400 text-sm mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">First Name</label>
              <input type="text" value={form.firstName} onChange={set('firstName')} required
                placeholder="John"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                           text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Last Name</label>
              <input type="text" value={form.lastName} onChange={set('lastName')} required
                placeholder="Doe"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                           text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={set('email')} required
              placeholder="you@example.com"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                         text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')}
                required placeholder="Min 8 chars, upper, lower, number, symbol"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 pr-10 text-white
                           text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500" />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Phone <span className="text-gray-500">(optional)</span></label>
            <input type="tel" value={form.phone} onChange={set('phone')}
              placeholder="+977-98XXXXXXXX"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                         text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Address <span className="text-gray-500">(optional)</span></label>
            <input type="text" value={form.address} onChange={set('address')}
              placeholder="Kathmandu, Nepal"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white
                         text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500" />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white
                       font-semibold py-2.5 rounded-lg transition-colors">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary-400 hover:text-primary-300 font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
