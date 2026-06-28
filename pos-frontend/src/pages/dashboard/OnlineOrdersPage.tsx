'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveStoreId } from '../../hooks/useActiveStoreId'
import {
  listOnlineOrders, getOnlineOrderSummary, getOnlineOrderDailyTrend,
  confirmOnlineOrder, fulfillOnlineOrder, cancelOnlineOrder,
  type AdminOrder, type OnlineOrderStatus,
} from '../../services/onlineOrderService'
import { downloadCsv, openPrintWindow, buildHtmlTable } from '../../utils/reportExport'

// ── Types / helpers ────────────────────────────────────────────────────────────

type FilterStatus = OnlineOrderStatus | 'ALL'
type Preset = 'today' | '7days' | '30days' | 'thisMonth' | 'custom'

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtC(n: number) { return `Rs. ${fmt(n)}` }

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetToRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } | { range: string } {
  if (preset === 'custom') {
    const fromD = new Date(customFrom + 'T00:00:00.000Z')
    const toD   = new Date(customTo   + 'T23:59:59.999Z')
    return { from: fromD.toISOString(), to: toD.toISOString() }
  }
  return { range: preset }
}

const STATUS_STYLES: Record<OnlineOrderStatus, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  FULFILLED: 'bg-green-500/20 text-green-400 border-green-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-white' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-surface-400 text-xs">{label}</span>
      <span className={`text-xl font-semibold ${color}`}>{value}</span>
      {sub && <span className="text-surface-500 text-xs">{sub}</span>}
    </div>
  )
}

function OrderDetailPanel({ order, storeId, onClose }: {
  order: AdminOrder; storeId: number; onClose: () => void
}) {
  const qc = useQueryClient()
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)

  const confirmMut = useMutation({
    mutationFn: () => confirmOnlineOrder(storeId, order.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['online-orders'] }); onClose() },
  })
  const fulfillMut = useMutation({
    mutationFn: () => fulfillOnlineOrder(storeId, order.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['online-orders'] }); onClose() },
  })
  const cancelMut = useMutation({
    mutationFn: () => cancelOnlineOrder(storeId, order.id, cancelReason || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['online-orders'] }); onClose() },
  })

  const busy = confirmMut.isPending || fulfillMut.isPending || cancelMut.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="h-full w-full max-w-lg bg-surface-800 border-l border-surface-700 overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">#{order.orderNumber}</h2>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border font-medium mt-1
                              ${STATUS_STYLES[order.status]}`}>
              {order.status}
            </span>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Customer */}
        <div className="bg-surface-900/60 rounded-xl p-4 space-y-1">
          <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider">Customer</p>
          <p className="text-white font-medium">{order.customerName}</p>
          <p className="text-surface-400 text-sm">{order.customerEmail}</p>
        </div>

        {/* Timeline */}
        <div className="bg-surface-900/60 rounded-xl p-4 space-y-2">
          <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider mb-3">Timeline</p>
          {[
            { label: 'Placed',    time: order.placedAt,    color: 'bg-surface-500' },
            { label: 'Confirmed', time: order.confirmedAt, color: 'bg-blue-500' },
            { label: 'Fulfilled', time: order.fulfilledAt, color: 'bg-green-500' },
            { label: 'Cancelled', time: order.cancelledAt, color: 'bg-red-500' },
          ].map(({ label, time, color }) =>
            time ? (
              <div key={label} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                <span className="text-surface-300 w-20">{label}</span>
                <span className="text-white">{new Date(time).toLocaleString()}</span>
              </div>
            ) : null
          )}
          {order.cancelReason && (
            <p className="text-red-400 text-xs ml-5 italic">"{order.cancelReason}"</p>
          )}
        </div>

        {/* Delivery / Note */}
        {(order.deliveryAddress || order.note) && (
          <div className="bg-surface-900/60 rounded-xl p-4 space-y-2">
            {order.deliveryAddress && (
              <div>
                <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider mb-1">Delivery Address</p>
                <p className="text-surface-300 text-sm">{order.deliveryAddress}</p>
              </div>
            )}
            {order.note && (
              <div>
                <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider mb-1">Note</p>
                <p className="text-surface-300 text-sm italic">"{order.note}"</p>
              </div>
            )}
          </div>
        )}

        {/* Items */}
        <div className="bg-surface-900/60 rounded-xl p-4">
          <p className="text-xs text-surface-400 font-semibold uppercase tracking-wider mb-3">Items</p>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-start gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate">{item.productName}</p>
                  <p className="text-surface-500 text-xs">
                    {fmtC(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <span className="text-white font-mono font-medium shrink-0">{fmtC(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-surface-700 mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-surface-300">
              <span>Subtotal</span><span className="font-mono">{fmtC(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-yellow-400">
                <span>Loyalty Discount ({order.loyaltyPointsUsed} pts)</span>
                <span className="font-mono">− {fmtC(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold">
              <span>Total</span><span className="font-mono">{fmtC(order.totalAmount)}</span>
            </div>
            {order.loyaltyPointsEarned > 0 && (
              <div className="text-xs text-primary-400">+{order.loyaltyPointsEarned} pts earned</div>
            )}
          </div>
        </div>

        {/* Actions */}
        {order.status !== 'CANCELLED' && order.status !== 'FULFILLED' && (
          <div className="space-y-2">
            {order.status === 'PENDING' && (
              <button
                onClick={() => confirmMut.mutate()}
                disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white
                           font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {confirmMut.isPending ? 'Confirming…' : 'Confirm Order'}
              </button>
            )}
            {order.status === 'CONFIRMED' && (
              <button
                onClick={() => fulfillMut.mutate()}
                disabled={busy}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white
                           font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {fulfillMut.isPending ? 'Marking fulfilled…' : 'Mark as Fulfilled'}
              </button>
            )}

            {!showCancelForm ? (
              <button
                onClick={() => setShowCancelForm(true)}
                disabled={busy}
                className="w-full bg-surface-700 hover:bg-red-900/40 hover:border-red-700 border
                           border-surface-600 text-surface-300 hover:text-red-400
                           font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Cancel Order
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (optional)"
                  rows={2}
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                             text-white text-sm placeholder-surface-500 focus:outline-none
                             focus:border-red-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCancelForm(false)}
                    className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                               font-medium py-2 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => cancelMut.mutate()}
                    disabled={busy}
                    className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white
                               text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    {cancelMut.isPending ? 'Cancelling…' : 'Confirm Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OnlineOrdersPage() {
  const storeId = useActiveStoreId()

  const [preset, setPreset] = useState<Preset>('30days')
  const [customFrom, setCustomFrom] = useState(toLocalDate(new Date()))
  const [customTo,   setCustomTo]   = useState(toLocalDate(new Date()))
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AdminOrder | null>(null)

  const rangeParams = useMemo(
    () => presetToRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  )

  const summaryQ = useQuery({
    queryKey: ['online-orders-summary', storeId, rangeParams],
    queryFn: () => getOnlineOrderSummary({ storeId, ...rangeParams }),
  })

  const trendQ = useQuery({
    queryKey: ['online-orders-trend', storeId, rangeParams],
    queryFn: () => getOnlineOrderDailyTrend({ storeId, ...rangeParams }),
  })

  const ordersQ = useQuery({
    queryKey: ['online-orders', storeId, rangeParams, statusFilter, page],
    queryFn: () => listOnlineOrders({
      storeId,
      ...rangeParams,
      status: statusFilter,
      page,
      size: 25,
    }),
  })

  const summary = summaryQ.data
  const orders  = ordersQ.data
  const trendRows = trendQ.data ?? []

  const STATUS_TABS: { id: FilterStatus; label: string; count?: number }[] = [
    { id: 'ALL',       label: 'All',       count: summary?.totalOrders },
    { id: 'PENDING',   label: 'Pending',   count: summary?.pendingCount },
    { id: 'CONFIRMED', label: 'Confirmed', count: summary?.confirmedCount },
    { id: 'FULFILLED', label: 'Fulfilled', count: summary?.fulfilledCount },
    { id: 'CANCELLED', label: 'Cancelled', count: summary?.cancelledCount },
  ]

  const PRESETS: { id: Preset; label: string }[] = [
    { id: 'today',     label: 'Today' },
    { id: '7days',     label: 'Last 7 days' },
    { id: '30days',    label: 'Last 30 days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'custom',    label: 'Custom' },
  ]

  const maxRevenue = Math.max(...trendRows.map((r) => r.revenue), 1)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Online Orders</h1>
        <p className="text-surface-400 text-sm mt-0.5">Manage and track ecommerce orders</p>
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPreset(p.id); setPage(0) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
              ${preset === p.id
                ? 'bg-primary-600 text-white'
                : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-500
                         text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600" />
            <span className="text-surface-400 text-sm">to</span>
            <input type="date" value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-500
                         text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600" />
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total Orders"   value={summary ? String(summary.totalOrders) : '—'} />
        <StatCard label="Revenue"        value={summary ? fmtC(summary.totalRevenue) : '—'} color="text-primary-400" />
        <StatCard label="Avg Order"      value={summary ? fmtC(summary.avgOrderValue) : '—'} />
        <StatCard label="Pending"        value={summary ? String(summary.pendingCount)   : '—'} color="text-yellow-400" />
        <StatCard label="Confirmed"      value={summary ? String(summary.confirmedCount) : '—'} color="text-blue-400" />
        <StatCard label="Fulfilled"      value={summary ? String(summary.fulfilledCount) : '—'} color="text-green-400" />
        <StatCard label="Cancelled"      value={summary ? String(summary.cancelledCount) : '—'} color="text-red-400" />
      </div>

      {/* Daily trend bar chart */}
      {trendRows.length > 0 && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
          <p className="text-surface-400 text-xs mb-3">Online order revenue per day</p>
          <div className="flex items-end gap-1 h-24">
            {trendRows.map((r) => (
              <div key={r.date} className="flex-1 flex flex-col items-center group relative">
                <div
                  className="w-full bg-primary-600/70 hover:bg-primary-500 rounded-t transition"
                  style={{ height: `${(r.revenue / maxRevenue) * 100}%`, minHeight: '2px' }}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center
                                bg-surface-900 border border-surface-600 rounded px-2 py-1 text-xs
                                text-white whitespace-nowrap z-10 pointer-events-none">
                  <span className="font-medium">{r.date}</span>
                  <span className="text-primary-400">{fmtC(r.revenue)}</span>
                  <span className="text-surface-400">{r.orderCount} orders</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-surface-500 text-xs">
            <span>{trendRows[0]?.date}</span>
            <span>{trendRows[trendRows.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="border-b border-surface-700">
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setStatusFilter(t.id); setPage(0) }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5
                ${statusFilter === t.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-surface-400 hover:text-surface-200'}`}
            >
              {t.label}
              {t.count != null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full
                  ${statusFilter === t.id ? 'bg-primary-900/50 text-primary-300' : 'bg-surface-700 text-surface-400'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Export toolbar */}
      {orders && orders.content.length > 0 && (
        <div className="flex items-center justify-end gap-2 -mt-4">
          <button
            onClick={() => {
              const header = ['Order #', 'Customer', 'Email', 'Date', 'Items', 'Subtotal', 'Discount', 'Total', 'Status', 'Delivery Address']
              const rows = orders.content.map(o => [
                o.orderNumber,
                o.customerName,
                o.customerEmail,
                new Date(o.placedAt).toLocaleString(),
                String(o.items.length),
                o.subtotal.toFixed(2),
                o.discountAmount.toFixed(2),
                o.totalAmount.toFixed(2),
                o.status,
                o.deliveryAddress ?? '',
              ])
              downloadCsv(`online-orders-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700
                       hover:bg-surface-600 text-surface-300 hover:text-white text-xs
                       font-medium transition-colors border border-surface-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => {
              const table = buildHtmlTable(
                ['Order #', 'Customer', 'Date', { label: 'Items', align: 'c' }, { label: 'Total', align: 'r' }, 'Status'],
                orders.content.map(o => [
                  `#${o.orderNumber}`,
                  `${o.customerName} (${o.customerEmail})`,
                  new Date(o.placedAt).toLocaleString(),
                  String(o.items.length),
                  `Rs. ${o.totalAmount.toFixed(2)}`,
                  o.status,
                ]),
                ['', `${orders.content.length} orders`, '', '', `Rs. ${orders.content.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)}`, ''],
              )
              openPrintWindow('Online Orders', `<h1>Online Orders</h1><p class="meta">Generated ${new Date().toLocaleString()} &nbsp;·&nbsp; Filter: ${statusFilter}</p>${table}`)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700
                       hover:bg-surface-600 text-surface-300 hover:text-white text-xs
                       font-medium transition-colors border border-surface-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF
          </button>
        </div>
      )}

      {/* Orders table */}
      {ordersQ.isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="h-14 bg-surface-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : ordersQ.isError ? (
        <div className="py-10 text-center">
          <p className="text-red-400 text-sm">Failed to load orders</p>
        </div>
      ) : !orders || orders.content.length === 0 ? (
        <div className="py-16 text-center text-surface-500 text-sm">
          No orders found for the selected period and filter.
        </div>
      ) : (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.content.map((order, i) => (
                <tr
                  key={order.id}
                  className={`border-b border-surface-700/50 hover:bg-surface-750 transition-colors cursor-pointer
                    ${i % 2 === 1 ? 'bg-surface-850/40' : ''}`}
                  onClick={() => setSelected(order)}
                >
                  <td className="px-4 py-3 text-white font-mono font-medium text-xs">
                    #{order.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm">{order.customerName}</p>
                    <p className="text-surface-500 text-xs">{order.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-surface-300 text-xs whitespace-nowrap">
                    {new Date(order.placedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center text-surface-300">
                    {order.items.length}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-mono font-medium">
                    {fmtC(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border font-medium
                                      ${STATUS_STYLES[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {order.status === 'PENDING' && (
                        <QuickActionButton
                          label="Confirm"
                          colorClass="text-blue-400 hover:text-blue-300"
                          onClick={() => setSelected(order)}
                        />
                      )}
                      {order.status === 'CONFIRMED' && (
                        <QuickActionButton
                          label="Fulfill"
                          colorClass="text-green-400 hover:text-green-300"
                          onClick={() => setSelected(order)}
                        />
                      )}
                      <button
                        onClick={() => setSelected(order)}
                        className="text-surface-400 hover:text-white text-xs px-2 py-1
                                   rounded bg-surface-700 hover:bg-surface-600 transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {orders.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
              <span className="text-surface-400 text-xs">
                {orders.totalElements} orders · page {orders.page + 1} of {orders.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-xs
                             disabled:opacity-40 hover:bg-surface-600 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={orders.last}
                  className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-xs
                             disabled:opacity-40 hover:bg-surface-600 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <OrderDetailPanel
          order={selected}
          storeId={storeId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function QuickActionButton({
  label, colorClass, onClick,
}: { label: string; colorClass: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded bg-surface-700 hover:bg-surface-600
                  transition-colors font-medium ${colorClass}`}
    >
      {label}
    </button>
  )
}
