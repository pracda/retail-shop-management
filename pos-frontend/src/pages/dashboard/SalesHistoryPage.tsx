import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import { getTransactions, type TransactionReportRow } from '../../services/reportService'
import { getSale, voidSale } from '../../services/salesService'
import { downloadCsv, openPrintWindow, buildHtmlTable } from '../../utils/reportExport'

// ── Date helpers ──────────────────────────────────────────────────────────────

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Convert YYYY-MM-DD → ISO instant at start/end of day (UTC midnight boundaries)
function toFromInstant(dateStr: string) {
  return `${dateStr}T00:00:00.000Z`
}
function toToInstant(dateStr: string) {
  return `${dateStr}T23:59:59.999Z`
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH:   'bg-green-900/40 text-green-300 border-green-700',
  CARD:   'bg-blue-900/40 text-blue-300 border-blue-700',
  MOBILE: 'bg-purple-900/40 text-purple-300 border-purple-700',
  MIXED:  'bg-yellow-900/40 text-yellow-300 border-yellow-700',
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function SaleDetailModal({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [voidReason, setVoidReason] = useState('')
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale-detail', saleId],
    queryFn: () => getSale(saleId),
  })

  const voidMut = useMutation({
    mutationFn: (reason: string) => voidSale(saleId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sale-detail', saleId] })
      qc.invalidateQueries({ queryKey: ['sales-history'] })
      setShowVoidConfirm(false)
      setVoidReason('')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-700 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Sale Detail</h2>
            {sale && <p className="text-surface-400 text-xs mt-0.5 font-mono">{sale.receiptNumber}</p>}
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && <div className="text-surface-400 text-sm text-center py-8">Loading…</div>}

          {sale && (
            <>
              {/* Status badge */}
              <div className="flex items-center gap-3 mb-5">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                  sale.status === 'COMPLETED'
                    ? 'bg-green-900/40 text-green-300 border-green-700'
                    : sale.status === 'VOIDED'
                    ? 'bg-red-900/40 text-red-300 border-red-700'
                    : 'bg-surface-700 text-surface-300 border-surface-600'
                }`}>
                  {sale.status}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${PAYMENT_COLORS[sale.paymentMethod] ?? 'bg-surface-700 text-surface-300 border-surface-600'}`}>
                  {sale.paymentMethod}
                </span>
                <span className="text-surface-400 text-xs">
                  {new Date(sale.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                <div className="bg-surface-900 rounded-xl p-3">
                  <div className="text-surface-500 text-xs mb-0.5">Cashier</div>
                  <div className="text-white font-medium">{sale.cashierName}</div>
                </div>
                <div className="bg-surface-900 rounded-xl p-3">
                  <div className="text-surface-500 text-xs mb-0.5">Items</div>
                  <div className="text-white font-medium">{sale.items.length}</div>
                </div>
              </div>

              {/* Items */}
              <div className="bg-surface-900 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-surface-500 text-xs uppercase border-b border-surface-700">
                      <th className="text-left px-4 py-2 font-medium">Product</th>
                      <th className="text-right px-4 py-2 font-medium">Qty</th>
                      <th className="text-right px-4 py-2 font-medium">Price</th>
                      <th className="text-right px-4 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.id} className="border-b border-surface-700/50">
                        <td className="px-4 py-2.5 text-surface-200">{item.productName}</td>
                        <td className="px-4 py-2.5 text-right text-surface-300">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-surface-300">Rs. {item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-white font-medium">Rs. {item.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 text-sm mb-5">
                <div className="flex justify-between text-surface-400">
                  <span>Subtotal</span><span>Rs. {sale.subtotal.toFixed(2)}</span>
                </div>
                {sale.discountAmount > 0 && (
                  <div className="flex justify-between text-surface-400">
                    <span>Discount</span><span>- Rs. {sale.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-surface-700 pt-2">
                  <span className="text-white">Total</span>
                  <span className="text-primary-400">Rs. {sale.totalAmount.toFixed(2)}</span>
                </div>
                {sale.changeDue > 0 && (
                  <div className="flex justify-between text-surface-400">
                    <span>Change Given</span><span>Rs. {sale.changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Void info */}
              {sale.status === 'VOIDED' && sale.voidReason && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-3 mb-4">
                  <div className="text-red-400 text-xs font-medium mb-0.5">Void Reason</div>
                  <div className="text-red-300 text-sm">{sale.voidReason}</div>
                  {sale.voidedAt && (
                    <div className="text-red-400/60 text-xs mt-1">{new Date(sale.voidedAt).toLocaleString()}</div>
                  )}
                </div>
              )}

              {/* Void action */}
              {sale.status === 'COMPLETED' && (
                <>
                  {!showVoidConfirm ? (
                    <button
                      onClick={() => setShowVoidConfirm(true)}
                      className="w-full border border-red-700/60 text-red-400 hover:bg-red-900/30
                                 text-sm font-medium py-2.5 rounded-xl transition-colors"
                    >
                      Void Sale / Refund
                    </button>
                  ) : (
                    <div className="border border-red-700/60 rounded-xl p-4">
                      <p className="text-red-300 text-sm font-medium mb-3">
                        This will void the entire sale. Enter a reason:
                      </p>
                      <textarea
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        rows={2}
                        placeholder="Reason for void / refund…"
                        className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                                   text-white text-sm focus:outline-none focus:border-red-500 resize-none mb-3"
                      />
                      {voidMut.isError && (
                        <p className="text-red-400 text-xs mb-2">Failed to void. Please try again.</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowVoidConfirm(false)}
                          className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm py-2 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => voidMut.mutate(voidReason)}
                          disabled={voidMut.isPending || !voidReason.trim()}
                          className="flex-1 bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white
                                     text-sm font-semibold py-2 rounded-lg transition-colors"
                        >
                          {voidMut.isPending ? 'Voiding…' : 'Confirm Void'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'VOIDED', label: 'Voided' },
]

const PAYMENT_FILTERS = [
  { value: '', label: 'All' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE', label: 'Mobile' },
]

function rowStyle(txn: TransactionReportRow): string {
  if (txn.status === 'VOIDED') return 'opacity-60 bg-red-900/10'
  return 'hover:bg-surface-700/40'
}

export default function SalesHistoryPage() {
  const user = useAuthStore((s) => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)

  const todayStr = toLocalDate(new Date())
  const [fromDate, setFromDate] = useState(firstOfMonth())
  const [toDate, setToDate] = useState(todayStr)
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [page, setPage] = useState(0)
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null)

  const from = toFromInstant(fromDate)
  const to   = toToInstant(toDate)

  const { data: txns, isLoading, isError } = useQuery({
    queryKey: ['sales-history', storeId, from, to, statusFilter, paymentFilter, page],
    queryFn: () => getTransactions({
      storeId, from, to,
      paymentMethod: paymentFilter || undefined,
      status: statusFilter || undefined,
      page,
      size: PAGE_SIZE,
    }),
    staleTime: 30_000,
  })

  const totals = txns
    ?.filter(t => t.status === 'COMPLETED')
    .reduce(
      (acc, t) => ({
        subtotal: acc.subtotal + t.subtotal,
        discount: acc.discount + t.discountAmount,
        total: acc.total + t.totalAmount,
      }),
      { subtotal: 0, discount: 0, total: 0 }
    )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Sales History</h1>
        <p className="text-surface-400 text-sm mt-1">Browse and manage past transactions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-400 font-medium">From</label>
          <input
            type="date" value={fromDate} max={toDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(0) }}
            className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                       text-white text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-400 font-medium">To</label>
          <input
            type="date" value={toDate} min={fromDate} max={todayStr}
            onChange={(e) => { setToDate(e.target.value); setPage(0) }}
            className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                       text-white text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-400 font-medium">Status</label>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(0) }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${statusFilter === f.value
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-surface-800 border-surface-600 text-surface-300 hover:bg-surface-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-400 font-medium">Payment</label>
          <div className="flex gap-1">
            {PAYMENT_FILTERS.map((f) => (
              <button key={f.value} onClick={() => { setPaymentFilter(f.value); setPage(0) }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${paymentFilter === f.value
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-surface-800 border-surface-600 text-surface-300 hover:bg-surface-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-end gap-2 pb-0.5">
          <span className="text-surface-400 text-sm">{txns ? `${txns.length} transactions` : ''}</span>
          {txns && txns.length > 0 && (
            <>
              <button
                onClick={() => {
                  const header = ['Receipt', 'Date/Time', 'Cashier', 'Payment', 'Status', 'Items', 'Subtotal', 'Discount', 'Total']
                  const rows = txns.map(t => [
                    t.receiptNumber,
                    new Date(t.createdAt).toLocaleString(),
                    t.cashierName,
                    t.paymentMethod,
                    t.status,
                    String(t.itemCount),
                    t.subtotal.toFixed(2),
                    t.discountAmount.toFixed(2),
                    t.totalAmount.toFixed(2),
                  ])
                  downloadCsv(`sales-${fromDate}-to-${toDate}.csv`, [header, ...rows])
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600
                           text-surface-300 hover:text-white text-sm font-medium transition-colors border border-surface-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => {
                  const completedTotals = txns.filter(t => t.status === 'COMPLETED')
                  const totalRev = completedTotals.reduce((s, t) => s + t.totalAmount, 0)
                  const totalDisc = completedTotals.reduce((s, t) => s + t.discountAmount, 0)
                  const table = buildHtmlTable(
                    ['Receipt', 'Date/Time', 'Cashier', 'Payment', 'Status', { label: 'Items', align: 'c' }, { label: 'Discount', align: 'r' }, { label: 'Total', align: 'r' }],
                    txns.map(t => [
                      t.receiptNumber,
                      new Date(t.createdAt).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                      t.cashierName,
                      t.paymentMethod,
                      t.status,
                      String(t.itemCount),
                      t.discountAmount > 0 ? `Rs. ${t.discountAmount.toFixed(2)}` : '—',
                      `Rs. ${t.totalAmount.toFixed(2)}`,
                    ]),
                    ['', '', '', '', `${completedTotals.length} completed`, '', totalDisc > 0 ? `Rs. ${totalDisc.toFixed(2)}` : '—', `Rs. ${totalRev.toFixed(2)}`],
                  )
                  const bodyHtml = `<h1>Sales History</h1><p class="meta">Period: ${fromDate} – ${toDate} &nbsp;·&nbsp; ${txns.length} transactions &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}</p>${table}`
                  openPrintWindow('Sales History', bodyHtml)
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600
                           text-surface-300 hover:text-white text-sm font-medium transition-colors border border-surface-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        {isLoading && <div className="text-center py-12 text-surface-400 text-sm">Loading…</div>}
        {isError && <div className="text-center py-12 text-red-400 text-sm">Failed to load sales. Please try again.</div>}

        {!isLoading && !isError && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-surface-500 text-xs uppercase tracking-wider border-b border-surface-700 bg-surface-850">
                  <th className="text-left px-5 py-3 font-medium">Receipt</th>
                  <th className="text-left px-5 py-3 font-medium">Date / Time</th>
                  <th className="text-left px-5 py-3 font-medium">Cashier</th>
                  <th className="text-left px-5 py-3 font-medium">Method</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Items</th>
                  <th className="text-right px-5 py-3 font-medium">Discount</th>
                  <th className="text-right px-5 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {txns?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-surface-500">
                      No transactions found for this period
                    </td>
                  </tr>
                ) : (
                  txns?.map((txn) => (
                    <tr
                      key={txn.saleId}
                      onClick={() => setSelectedSaleId(txn.saleId)}
                      className={`border-b border-surface-700/50 cursor-pointer transition-colors ${rowStyle(txn)}`}
                    >
                      <td className="px-5 py-3 font-mono text-xs text-surface-300">{txn.receiptNumber}</td>
                      <td className="px-5 py-3 text-surface-400 text-xs">
                        {new Date(txn.createdAt).toLocaleString([], {
                          month: 'short', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 text-surface-200">{txn.cashierName}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_COLORS[txn.paymentMethod] ?? 'bg-surface-700 text-surface-300 border-surface-600'}`}>
                          {txn.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {txn.status === 'VOIDED' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-red-900/40 text-red-300 border-red-700">
                            Voided
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-green-900/30 text-green-400 border-green-700/30">
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-surface-400">{txn.itemCount}</td>
                      <td className="px-5 py-3 text-right text-surface-400">
                        {txn.discountAmount > 0 ? `Rs. ${txn.discountAmount.toFixed(2)}` : '—'}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold ${txn.status === 'VOIDED' ? 'line-through text-surface-500' : 'text-white'}`}>
                        Rs. {txn.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Totals footer (completed only) */}
              {totals && txns && txns.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-surface-600 bg-surface-850 font-semibold text-white">
                    <td colSpan={6} className="px-5 py-3 text-surface-400 text-xs uppercase tracking-wider">
                      Completed Total
                    </td>
                    <td className="px-5 py-3 text-right text-surface-400">
                      {totals.discount > 0 ? `Rs. ${totals.discount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-primary-400">
                      Rs. {totals.total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>

            {/* Pagination */}
            {(txns?.length === PAGE_SIZE || page > 0) && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-surface-700">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-sm text-surface-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="text-surface-500 text-xs">Page {page + 1}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!txns || txns.length < PAGE_SIZE}
                  className="text-sm text-surface-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedSaleId != null && (
        <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      )}
    </div>
  )
}
