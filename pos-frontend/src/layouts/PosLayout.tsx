import { Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { logout } from '../services/authService'
import { useActiveStoreId, useActiveStoreName } from '../hooks/useActiveStoreId'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useOfflineQueueStore } from '../store/offlineQueueStore'

export default function PosLayout() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date())
  const activeStoreId = useActiveStoreId()
  const activeStoreName = useActiveStoreName()
  const isOnline = useOnlineStatus()
  const pendingCount = useOfflineQueueStore((s) => s.queue.length)
  useOfflineSync()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  async function handleLogout() {
    await logout()
    clearAuth()
    navigate('/login', { replace: true })
  }

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="h-screen bg-surface-900 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="bg-surface-800 border-b border-surface-700 px-6 py-3 flex items-center justify-between">
        {/* Left — brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707
                   1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm">MartPOS</span>
          <span className="text-surface-400 text-xs">|</span>
          <span className="text-surface-300 text-sm">Store #{activeStoreId} — {activeStoreName}</span>
        </div>

        {/* Center — clock */}
        <div className="text-center">
          <div className="text-white font-mono text-lg font-bold leading-none">{timeStr}</div>
          <div className="text-surface-400 text-xs mt-0.5">{dateStr}</div>
        </div>

        {/* Right — offline badge + cashier + logout */}
        <div className="flex items-center gap-4">
          {!isOnline && (
            <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-700/60 rounded-lg px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-300 text-xs font-medium">Offline</span>
            </div>
          )}
          {isOnline && pendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-900/40 border border-yellow-700/60 rounded-lg px-2.5 py-1">
              <svg className="w-3.5 h-3.5 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
              </svg>
              <span className="text-yellow-300 text-xs font-medium">Syncing {pendingCount} sale{pendingCount !== 1 ? 's' : ''}…</span>
            </div>
          )}
          <div className="text-right">
            <div className="text-white text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-primary-400 text-xs">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-600
                       text-surface-200 text-sm transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
