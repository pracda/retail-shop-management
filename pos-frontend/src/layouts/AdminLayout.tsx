import React, { useState, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useSelectedStoreStore } from '../store/selectedStoreStore'
import { useActiveStoreId } from '../hooks/useActiveStoreId'
import { useOnlineOrderNotifications } from '../hooks/useOnlineOrderNotifications'
import { logout } from '../services/authService'
import { changePassword } from '../services/userService'
import { getStores } from '../services/storeService'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles?: string[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6
             0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Users',
    to: '/dashboard/users',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Customers',
    to: '/dashboard/customers',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Products',
    to: '/dashboard/products',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Inventory',
    to: '/dashboard/inventory',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002
             2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'Suppliers',
    to: '/dashboard/suppliers',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Purchase Orders',
    to: '/dashboard/purchase-orders',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Promotions',
    to: '/dashboard/promotions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    label: 'Sales History',
    to: '/dashboard/sales',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002
             2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Online Orders',
    to: '/dashboard/online-orders',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Attendance',
    to: '/dashboard/attendance',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    to: '/dashboard/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0
             012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Z-Report',
    to: '/dashboard/z-report',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    label: 'Audit Log',
    to: '/dashboard/audit-log',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0
             002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    to: '/dashboard/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94
             3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724
             1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426
             1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724
             1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31
             2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Cash Reconciliation',
    to: '/dashboard/cash-reconciliation',
    roles: ['MASTER_ADMIN', 'ADMIN', 'MANAGER'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Refund Approvals',
    to: '/dashboard/refund-approvals',
    roles: ['MASTER_ADMIN', 'ADMIN', 'MANAGER'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
  },
  {
    label: 'Stores',
    to: '/dashboard/stores',
    roles: ['MASTER_ADMIN'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1
             4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
]

function ChangePasswordModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [success, setSuccess] = useState(false)

  const mut = useMutation({
    mutationFn: () => changePassword(userId, {
      currentPassword: current,
      newPassword: next,
      confirmPassword: confirm,
    }),
    onSuccess: () => setSuccess(true),
  })

  const mismatch = next && confirm && next !== confirm

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Change Password</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium">Password changed successfully</p>
            <button onClick={onClose} className="mt-4 text-primary-400 text-sm hover:text-primary-300">
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Current Password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">New Password</label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`w-full bg-surface-900 border rounded-lg px-3 py-2.5 text-white text-sm
                            focus:outline-none ${mismatch ? 'border-red-500' : 'border-surface-600 focus:border-primary-500'}`}
              />
              {mismatch && <p className="text-red-400 text-xs mt-1">Passwords do not match</p>}
            </div>

            {mut.isError && (
              <p className="text-red-400 text-xs">
                {(mut.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to change password'}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                           font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || !current || !next || !confirm || !!mismatch}
                className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white
                           text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {mut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StoreSelectorSection() {
  const user = useAuthStore((s) => s.user)
  const { storeId: selectedStoreId, storeName: selectedStoreName, setStore } = useSelectedStoreStore()
  const [open, setOpen] = useState(false)

  const { data: stores = [] } = useQuery({
    queryKey: ['all-stores'],
    queryFn: getStores,
    staleTime: 300_000,
    enabled: user?.role === 'MASTER_ADMIN',
  })

  if (user?.role !== 'MASTER_ADMIN') return null

  return (
    <div className="px-3 py-3 border-b border-surface-700">
      <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 px-1">
        Active Store
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                     bg-surface-900 border border-surface-700 hover:border-surface-500 text-sm
                     text-white transition-colors"
        >
          <span className="truncate">
            {selectedStoreName ?? (selectedStoreId ? `Store #${selectedStoreId}` : 'Select Store')}
          </span>
          <svg
            className={`w-4 h-4 text-surface-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700
                          rounded-lg shadow-xl z-20 overflow-hidden">
            {stores.length === 0 ? (
              <div className="px-3 py-2 text-surface-500 text-xs">No stores found</div>
            ) : (
              stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => {
                    setStore(store.id, store.name)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface-700
                    ${selectedStoreId === store.id ? 'text-primary-400 bg-primary-900/20' : 'text-white'}`}
                >
                  {store.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  const storeId = useActiveStoreId()
  const [showChangePw, setShowChangePw] = useState(false)
  const [newOrderToast, setNewOrderToast] = useState(false)

  const handleNewOrder = useCallback(() => {
    setNewOrderToast(true)
    setTimeout(() => setNewOrderToast(false), 5000)
  }, [])

  const pendingCount = useOnlineOrderNotifications(storeId, handleNewOrder)

  async function handleLogout() {
    await logout()
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* New online order toast */}
      {newOrderToast && (
        <div
          className="fixed top-4 right-4 z-[100] flex items-center gap-3 bg-primary-700 border border-primary-500
                     text-white px-4 py-3 rounded-xl shadow-2xl cursor-pointer animate-pulse"
          onClick={() => { navigate('/dashboard/online-orders'); setNewOrderToast(false) }}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5
                 a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-sm">New Online Order!</p>
            <p className="text-xs text-primary-200">Click to view orders</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setNewOrderToast(false) }}
            className="ml-2 text-primary-200 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-60 bg-surface-800 border-r border-surface-700 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-surface-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707
                     1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-white font-semibold text-sm leading-none">MartPOS</div>
              <div className="text-surface-400 text-xs mt-0.5">Back Office</div>
            </div>
          </div>
        </div>

        {/* Store selector (MASTER_ADMIN only) */}
        <StoreSelectorSection />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role ?? ''))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                    : 'text-surface-300 hover:bg-surface-700 hover:text-white border border-transparent'
                  }`
                }
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.to === '/dashboard/online-orders' && pendingCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold
                                   rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-surface-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-surface-400 text-xs truncate">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={() => setShowChangePw(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-surface-300
                       hover:bg-surface-700 hover:text-white text-sm transition-colors mb-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0
                   01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-surface-300
                       hover:bg-surface-700 hover:text-white text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Change password modal */}
      {showChangePw && user && (
        <ChangePasswordModal
          userId={user.id}
          onClose={() => setShowChangePw(false)}
        />
      )}
    </div>
  )
}
