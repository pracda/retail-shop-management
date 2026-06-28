import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import {
  getCurrentShift,
  openShift,
  closeShift,
  type Shift,
} from '../../services/shiftService'
import { getSale, voidSale } from '../../services/salesService'
import api from '../../services/api'

// ─── Quick actions definition ──────────────────────────────────────────────

const quickActions = [
  {
    label: 'New Sale',
    description: 'Start a new transaction',
    key: 'new-sale',
    accent: true,
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707
             1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Hold / Resume',
    description: 'Manage held transactions',
    key: 'hold',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Refund',
    description: 'Void a past sale',
    key: 'refund',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
  },
  {
    label: 'Loyalty',
    description: 'Look up customer points',
    key: 'loyalty',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12
             7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    label: 'Clock Out',
    description: 'End your shift',
    key: 'clock-out',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  },
  {
    label: 'Cash Drawer',
    description: 'Open cash drawer',
    key: 'cash-drawer',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2
             2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
]

// ─── Refund modal ──────────────────────────────────────────────────────────

interface ShiftSaleSummary {
  totalElements: number
  content: Array<{
    id: number
    totalAmount: number
    paymentMethod: string
  }>
}

function RefundModal({ storeId, onClose }: { storeId: number; onClose: () => void }) {
  const [receiptInput, setReceiptInput] = useState('')
  const [foundSaleId, setFoundSaleId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [searchError, setSearchError] = useState('')
  const [voided, setVoided] = useState(false)

  // Load sale by ID (we use the receipt number search via /sales endpoint)
  const { data: sale, isLoading: saleLoading } = useQuery({
    queryKey: ['refund-sale', foundSaleId],
    queryFn: () => getSale(foundSaleId!),
    enabled: foundSaleId != null,
  })

  const voidMut = useMutation({
    mutationFn: () => voidSale(foundSaleId!, voidReason),
    onSuccess: () => setVoided(true),
  })

  async function handleSearch() {
    setSearchError('')
    setFoundSaleId(null)
    const trimmed = receiptInput.trim()
    if (!trimmed) return

    try {
      // Try parse as numeric ID first
      const asId = parseInt(trimmed, 10)
      if (!isNaN(asId)) {
        setFoundSaleId(asId)
        return
      }

      // Otherwise search by receipt number via /sales endpoint
      const { data } = await api.get('/sales', {
        params: { storeId, page: 0, size: 50 },
      })
      void (data.data as ShiftSaleSummary)
      // Not ideal, but backend doesn't support receipt search — look through recent sales
      setSearchError('Enter the Sale ID number (found on the receipt)')
    } catch {
      setSearchError('Failed to search. Try entering the Sale ID.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <h2 className="text-lg font-bold text-white">Process Refund</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {voided ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium mb-1">Sale Voided</p>
              <p className="text-surface-400 text-sm">The sale has been successfully refunded.</p>
              <button onClick={onClose} className="mt-4 text-primary-400 text-sm hover:text-primary-300">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-surface-300 mb-1">
                  Sale ID (shown on receipt)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={receiptInput}
                    onChange={(e) => setReceiptInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter sale ID…"
                    className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-surface-700 hover:bg-surface-600 text-white text-sm px-4 rounded-lg transition-colors"
                  >
                    Find
                  </button>
                </div>
                {searchError && <p className="text-yellow-400 text-xs mt-1">{searchError}</p>}
              </div>

              {/* Sale detail */}
              {saleLoading && <p className="text-surface-400 text-sm">Loading…</p>}

              {sale && !saleLoading && (
                <div className="bg-surface-900 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-surface-400">{sale.receiptNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      sale.status === 'VOIDED'
                        ? 'bg-red-900/40 text-red-300 border-red-700'
                        : 'bg-green-900/40 text-green-300 border-green-700'
                    }`}>
                      {sale.status}
                    </span>
                  </div>
                  <div className="text-sm text-surface-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Date</span>
                      <span>{new Date(sale.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cashier</span>
                      <span>{sale.cashierName}</span>
                    </div>
                    <div className="flex justify-between font-bold text-white text-base border-t border-surface-700 pt-2 mt-2">
                      <span>Total</span>
                      <span className="text-primary-400">Rs. {sale.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {sale.status === 'COMPLETED' && (
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-surface-300 mb-1">
                        Reason for Refund
                      </label>
                      <textarea
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        rows={2}
                        placeholder="Customer returned item, defective product…"
                        className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                                   text-white text-sm focus:outline-none focus:border-primary-500 resize-none"
                      />
                      {voidMut.isError && (
                        <p className="text-red-400 text-xs mt-1">Failed to process refund. Try again.</p>
                      )}
                      <button
                        onClick={() => voidMut.mutate()}
                        disabled={voidMut.isPending || !voidReason.trim()}
                        className="w-full mt-3 bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white
                                   text-sm font-semibold py-2.5 rounded-lg transition-colors"
                      >
                        {voidMut.isPending ? 'Processing…' : 'Confirm Refund'}
                      </button>
                    </div>
                  )}

                  {sale.status === 'VOIDED' && (
                    <p className="text-red-400 text-sm mt-3 text-center">
                      This sale has already been voided.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function PosDashboard() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const navigate = useNavigate()
  const [openingFloat, setOpeningFloat] = useState('0.00')
  const [closingCash, setClosingCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)

  const storeId = user?.storeId ?? 0

  // Fetch current open shift
  const { data: shift, isLoading } = useQuery({
    queryKey: ['current-shift', storeId],
    queryFn: () => getCurrentShift(storeId),
    enabled: !!storeId,
    staleTime: 30_000,
  })

  // Fetch shift sales summary when close modal is open
  const { data: shiftSales } = useQuery({
    queryKey: ['shift-sales-summary', shift?.id],
    queryFn: async () => {
      if (!shift?.id) return null
      const { data } = await api.get(`/sales/shift/${shift.id}`, {
        params: { page: 0, size: 200 },
      })
      return data.data as {
        content: Array<{ totalAmount: number; paymentMethod: string; status: string }>
        totalElements: number
      }
    },
    enabled: showCloseModal && !!shift?.id,
    staleTime: 10_000,
  })

  const shiftStats = shiftSales
    ? shiftSales.content
        .filter((s) => s.status === 'COMPLETED')
        .reduce(
          (acc, s) => {
            acc.total += s.totalAmount
            acc.count += 1
            acc.byMethod[s.paymentMethod] = (acc.byMethod[s.paymentMethod] ?? 0) + s.totalAmount
            return acc
          },
          { total: 0, count: 0, byMethod: {} as Record<string, number> }
        )
    : null

  const openMut = useMutation({
    mutationFn: () =>
      openShift({ storeId, openingFloat: parseFloat(openingFloat) || 0 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['current-shift'] }),
  })

  const closeMut = useMutation({
    mutationFn: (s: Shift) =>
      closeShift(s.id, {
        storeId,
        closingCash: parseFloat(closingCash) || 0,
        notes: closeNotes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-shift'] })
      setShowCloseModal(false)
      setClosingCash('')
      setCloseNotes('')
    },
  })

  const shiftOpen = shift?.status === 'OPEN'
  const shiftDuration = shift?.openedAt
    ? formatDuration(new Date(shift.openedAt))
    : '—'

  const expectedCash = shiftStats
    ? (shift?.openingFloat ?? 0) + (shiftStats.byMethod['CASH'] ?? 0)
    : null

  const closingCashNum = parseFloat(closingCash) || 0
  const discrepancy = expectedCash != null && closingCash ? closingCashNum - expectedCash : null

  function handleAction(key: string) {
    if (key === 'new-sale' && shiftOpen) {
      navigate('/pos/cart')
    } else if (key === 'clock-out' && shiftOpen && shift) {
      setShowCloseModal(true)
    } else if (key === 'refund' && shiftOpen) {
      setShowRefundModal(true)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-surface-400 text-sm">Loading shift status…</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* ── No shift — prompt to open ── */}
      {!shiftOpen && (
        <div className="mb-6 bg-yellow-900/30 border border-yellow-700/60 rounded-xl p-5 flex items-start gap-4">
          <div className="mt-0.5 text-yellow-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-yellow-300 text-sm">No open shift</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              You must open a shift before processing sales.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="Opening float"
              className="w-28 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={() => openMut.mutate()}
              disabled={openMut.isPending}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white
                         text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {openMut.isPending ? 'Opening…' : 'Open Shift'}
            </button>
          </div>
        </div>
      )}

      {/* Welcome banner */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Good{getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-surface-300 mt-1 text-sm">
          {shiftOpen
            ? `Shift open · ${shiftDuration} · Store #${storeId}`
            : `Store #${storeId} · Open a shift to start selling`}
        </p>
      </div>

      {/* Shift status bar */}
      <div className="flex gap-4 mb-8">
        <StatusCard
          label="Shift Status"
          value={shiftOpen ? 'Open' : 'Closed'}
          valueClass={shiftOpen ? 'text-primary-400' : 'text-red-400'}
        />
        <StatusCard label="Shift Duration" value={shiftDuration} />
        <StatusCard
          label="Opening Float"
          value={shift ? `Rs. ${shift.openingFloat.toFixed(2)}` : '—'}
        />
        <StatusCard label="Shift #" value={shift ? `#${shift.id}` : '—'} />
      </div>

      {/* Quick actions */}
      <h2 className="text-surface-300 text-xs font-semibold uppercase tracking-wider mb-3">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {quickActions.map((action) => {
          const needsShift = ['new-sale', 'hold', 'refund', 'cash-drawer'].includes(action.key)
          const disabled = needsShift && !shiftOpen

          return (
            <button
              key={action.key}
              onClick={() => handleAction(action.key)}
              disabled={disabled}
              className={`
                flex flex-col items-start gap-3 p-5 rounded-xl border text-left
                transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500
                disabled:opacity-40 disabled:cursor-not-allowed
                ${action.accent
                  ? 'bg-primary-600 hover:bg-primary-700 border-primary-500 text-white'
                  : 'bg-surface-800 hover:bg-surface-700 border-surface-700 text-white'
                }
              `}
            >
              <span className={action.accent ? 'text-white' : 'text-primary-400'}>
                {action.icon}
              </span>
              <div>
                <div className="font-semibold text-sm">{action.label}</div>
                <div className={`text-xs mt-0.5 ${action.accent ? 'text-primary-200' : 'text-surface-400'}`}>
                  {action.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Close shift modal ── */}
      {showCloseModal && shift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-white mb-1">Close Shift</h2>
            <p className="text-surface-400 text-sm mb-5">
              Opened {new Date(shift.openedAt).toLocaleTimeString()} · {shiftDuration} ago
            </p>

            {/* Shift summary */}
            {shiftStats && (
              <div className="bg-surface-900 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between text-surface-400">
                  <span>Transactions</span>
                  <span className="text-white">{shiftStats.count}</span>
                </div>
                <div className="flex justify-between text-surface-400">
                  <span>Total Revenue</span>
                  <span className="text-white">Rs. {shiftStats.total.toFixed(2)}</span>
                </div>
                {Object.entries(shiftStats.byMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-surface-500 text-xs pl-3">
                    <span>{method}</span>
                    <span>Rs. {amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-surface-400 border-t border-surface-700 pt-2">
                  <span>Opening Float</span>
                  <span className="text-white">Rs. {shift.openingFloat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-surface-300 font-medium">
                  <span>Expected Cash</span>
                  <span>Rs. {expectedCash?.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">
                  Closing Cash (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                             text-white focus:outline-none focus:border-primary-500"
                />
                {discrepancy != null && (
                  <p className={`text-xs mt-1 ${discrepancy < 0 ? 'text-red-400' : discrepancy > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {discrepancy === 0
                      ? 'Cash balanced'
                      : discrepancy > 0
                      ? `Over by Rs. ${discrepancy.toFixed(2)}`
                      : `Short by Rs. ${Math.abs(discrepancy).toFixed(2)}`
                    }
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={2}
                  placeholder="Any discrepancies or notes…"
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                             text-white text-sm focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>
            </div>

            {closeMut.isError && (
              <p className="text-red-400 text-xs mt-3">Failed to close shift. Please try again.</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                           font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => closeMut.mutate(shift)}
                disabled={closeMut.isPending || !closingCash}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm
                           font-semibold py-2.5 rounded-lg transition-colors"
              >
                {closeMut.isPending ? 'Closing…' : 'Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund modal ── */}
      {showRefundModal && (
        <RefundModal storeId={storeId} onClose={() => setShowRefundModal(false)} />
      )}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function StatusCard({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex-1 bg-surface-800 border border-surface-700 rounded-xl p-4">
      <div className="text-surface-400 text-xs mb-1">{label}</div>
      <div className={`font-bold text-lg ${valueClass}`}>{value}</div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return ' morning'
  if (h < 17) return ' afternoon'
  return ' evening'
}

function formatDuration(since: Date): string {
  const mins = Math.floor((Date.now() - since.getTime()) / 60_000)
  if (mins < 1) return '< 1m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
