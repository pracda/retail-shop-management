import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useActiveStoreId } from '../../hooks/useActiveStoreId'
import {
  getSalesSummary, getProfitLoss, getPaymentBreakdown,
  getTopProducts, getDailyTrend, getCashierPerformance,
  getTransactions, getHourlyTrend, getCategorySales,
  type PaymentMethodFilter,
} from '../../services/reportService'
import { downloadCsv, openPrintWindow, buildHtmlTable } from '../../utils/reportExport'

// ── Date preset helpers ────────────────────────────────────────────────────────

type Preset = 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'custom'

function getPresetRange(preset: Preset): { from: Date; to: Date } {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case '7days': {
      const f = new Date(now); f.setDate(f.getDate() - 6)
      return { from: startOfDay(f), to: endOfDay(now) }
    }
    case '30days': {
      const f = new Date(now); f.setDate(f.getDate() - 29)
      return { from: startOfDay(f), to: endOfDay(now) }
    }
    case 'thisMonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(now),
      }
    default:
      return { from: startOfDay(now), to: endOfDay(now) }
  }
}

function toLocalDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function localDateToInstant(dateStr: string, end = false): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = end
    ? new Date(y, m - 1, day, 23, 59, 59, 999)
    : new Date(y, m - 1, day, 0, 0, 0, 0)
  return d.toISOString()
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtCurrency(n: number) {
  return `Rs. ${fmt(n)}`
}

function fmtPct(n: number) {
  return `${fmt(n)}%`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-surface-400 text-xs">{label}</span>
      <span className={`text-xl font-semibold ${color}`}>{value}</span>
      {sub && <span className="text-surface-500 text-xs">{sub}</span>}
    </div>
  )
}

type TabId = 'overview' | 'transactions' | 'payments' | 'hourly' | 'products' | 'categories' | 'trend' | 'cashiers'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',     label: 'Overview / P&L' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'payments',     label: 'Payment Types' },
  { id: 'hourly',       label: 'Peak Hours' },
  { id: 'products',     label: 'Top Products' },
  { id: 'categories',   label: 'By Category' },
  { id: 'trend',        label: 'Daily Trend' },
  { id: 'cashiers',     label: 'Cashier Performance' },
]

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE: 'Mobile',
  MIXED: 'Mixed',
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  useAuthStore((s) => s.user) // keep subscription for reactivity
  const storeId = useActiveStoreId()

  const [preset, setPreset] = useState<Preset>('today')
  const [customFrom, setCustomFrom] = useState(toLocalDateInput(new Date()))
  const [customTo, setCustomTo] = useState(toLocalDateInput(new Date()))
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [txnPaymentFilter, setTxnPaymentFilter] = useState<PaymentMethodFilter>('ALL')

  const { from: fromDate, to: toDate } = useMemo(() => {
    if (preset === 'custom') {
      return {
        from: new Date(localDateToInstant(customFrom, false)),
        to: new Date(localDateToInstant(customTo, true)),
      }
    }
    return getPresetRange(preset)
  }, [preset, customFrom, customTo])

  const params = useMemo(() => ({
    storeId,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  }), [storeId, fromDate, toDate])

  const enabled = true

  const summaryQ = useQuery({
    queryKey: ['report-summary', params],
    queryFn: () => getSalesSummary(params),
    enabled,
  })

  const pnlQ = useQuery({
    queryKey: ['report-pnl', params],
    queryFn: () => getProfitLoss(params),
    enabled,
  })

  const paymentsQ = useQuery({
    queryKey: ['report-payments', params],
    queryFn: () => getPaymentBreakdown(params),
    enabled,
  })

  const productsQ = useQuery({
    queryKey: ['report-products', params],
    queryFn: () => getTopProducts({ ...params, limit: 20 }),
    enabled,
  })

  const trendQ = useQuery({
    queryKey: ['report-trend', params],
    queryFn: () => getDailyTrend(params),
    enabled,
  })

  const cashiersQ = useQuery({
    queryKey: ['report-cashiers', params],
    queryFn: () => getCashierPerformance(params),
    enabled,
  })

  const txnsQ = useQuery({
    queryKey: ['report-transactions', params, txnPaymentFilter],
    queryFn: () => getTransactions({
      ...params,
      paymentMethod: txnPaymentFilter === 'ALL' ? undefined : txnPaymentFilter,
    }),
    enabled,
  })

  const hourlyQ = useQuery({
    queryKey: ['report-hourly', params],
    queryFn: () => getHourlyTrend(params),
    enabled,
  })

  const categoriesQ = useQuery({
    queryKey: ['report-categories', params],
    queryFn: () => getCategorySales(params),
    enabled,
  })

  const summary = summaryQ.data
  const pnl = pnlQ.data

  // ── Export helpers ───────────────────────────────────────────────────────────

  const fileDate = `${toLocalDateInput(fromDate)}-to-${toLocalDateInput(toDate)}`
  const dateLabel = `${fromDate.toLocaleDateString()} – ${toDate.toLocaleDateString()}`

  function getTabExport(): { filename: string; headers: Array<string | { label: string; align?: 'r' | 'c' }>; rows: string[][]; totals?: string[] } | null {
    switch (activeTab) {
      case 'overview': {
        const p = pnlQ.data
        if (!p) return null
        return {
          filename: `overview-pnl-${fileDate}.csv`,
          headers: ['Metric', { label: 'Amount (Rs.)', align: 'r' }],
          rows: [
            ['Revenue', p.revenue.toFixed(2)],
            ['COGS', p.cogs.toFixed(2)],
            ['Gross Profit', p.grossProfit.toFixed(2)],
            ['Gross Margin %', p.grossMarginPct.toFixed(2)],
            ['Total Discounts', p.totalDiscounts.toFixed(2)],
          ],
        }
      }
      case 'transactions': {
        const rows = txnsQ.data
        if (!rows?.length) return null
        return {
          filename: `transactions-${fileDate}.csv`,
          headers: ['Date/Time', 'Receipt', 'Cashier', { label: 'Items', align: 'c' }, 'Payment', { label: 'Subtotal', align: 'r' }, { label: 'Discount', align: 'r' }, { label: 'Total', align: 'r' }],
          rows: rows.map(r => [
            new Date(r.createdAt).toLocaleString(),
            r.receiptNumber,
            r.cashierName,
            String(r.itemCount),
            r.paymentMethod,
            r.subtotal.toFixed(2),
            r.discountAmount.toFixed(2),
            r.totalAmount.toFixed(2),
          ]),
          totals: [
            `${rows.length} transactions`, '', '', '', '',
            rows.reduce((s, r) => s + r.subtotal, 0).toFixed(2),
            rows.reduce((s, r) => s + r.discountAmount, 0).toFixed(2),
            rows.reduce((s, r) => s + r.totalAmount, 0).toFixed(2),
          ],
        }
      }
      case 'payments': {
        const rows = paymentsQ.data
        if (!rows?.length) return null
        return {
          filename: `payment-types-${fileDate}.csv`,
          headers: ['Payment Method', { label: 'Transactions', align: 'r' }, { label: 'Total Amount', align: 'r' }, { label: 'Share %', align: 'r' }],
          rows: rows.map(r => [
            PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod,
            String(r.transactionCount),
            r.totalAmount.toFixed(2),
            r.pctOfTotal.toFixed(2),
          ]),
        }
      }
      case 'hourly': {
        const rows = hourlyQ.data
        if (!rows?.length) return null
        return {
          filename: `peak-hours-${fileDate}.csv`,
          headers: ['Hour', { label: 'Transactions', align: 'r' }, { label: 'Revenue', align: 'r' }],
          rows: rows.map(r => [`${r.hour}:00`, String(r.txnCount), r.revenue.toFixed(2)]),
        }
      }
      case 'products': {
        const rows = productsQ.data
        if (!rows?.length) return null
        return {
          filename: `top-products-${fileDate}.csv`,
          headers: [{ label: '#', align: 'c' }, 'Product', 'Barcode', { label: 'Qty Sold', align: 'r' }, { label: 'Revenue', align: 'r' }, { label: 'COGS', align: 'r' }, { label: 'Gross Profit', align: 'r' }],
          rows: rows.map((r, i) => [String(i + 1), r.productName, r.barcode ?? '', String(r.qtySold), r.revenue.toFixed(2), r.cogs.toFixed(2), r.grossProfit.toFixed(2)]),
        }
      }
      case 'categories': {
        const rows = categoriesQ.data
        if (!rows?.length) return null
        const total = rows.reduce((s, r) => s + r.revenue, 0)
        return {
          filename: `by-category-${fileDate}.csv`,
          headers: [{ label: '#', align: 'c' }, 'Category', { label: 'Qty Sold', align: 'r' }, { label: 'Revenue', align: 'r' }, { label: 'COGS', align: 'r' }, { label: 'Gross Profit', align: 'r' }, { label: 'Share %', align: 'r' }],
          rows: rows.map((r, i) => [String(i + 1), r.categoryName, String(r.qtySold), r.revenue.toFixed(2), r.cogs.toFixed(2), r.grossProfit.toFixed(2), total > 0 ? ((r.revenue / total) * 100).toFixed(2) : '0']),
          totals: ['', 'Total', String(rows.reduce((s, r) => s + r.qtySold, 0)), rows.reduce((s, r) => s + r.revenue, 0).toFixed(2), rows.reduce((s, r) => s + r.cogs, 0).toFixed(2), rows.reduce((s, r) => s + r.grossProfit, 0).toFixed(2), '100.00'],
        }
      }
      case 'trend': {
        const rows = trendQ.data
        if (!rows?.length) return null
        return {
          filename: `daily-trend-${fileDate}.csv`,
          headers: ['Date', { label: 'Transactions', align: 'r' }, { label: 'Revenue', align: 'r' }],
          rows: rows.map(r => [r.date, String(r.transactionCount), r.revenue.toFixed(2)]),
          totals: ['Total', String(rows.reduce((s, r) => s + r.transactionCount, 0)), rows.reduce((s, r) => s + r.revenue, 0).toFixed(2)],
        }
      }
      case 'cashiers': {
        const rows = cashiersQ.data
        if (!rows?.length) return null
        return {
          filename: `cashier-performance-${fileDate}.csv`,
          headers: [{ label: '#', align: 'c' }, 'Cashier', { label: 'Transactions', align: 'r' }, { label: 'Revenue', align: 'r' }, { label: 'Avg Ticket', align: 'r' }],
          rows: rows.map((r, i) => [String(i + 1), r.cashierName, String(r.transactionCount), r.revenue.toFixed(2), r.avgTransactionValue.toFixed(2)]),
        }
      }
      default:
        return null
    }
  }

  function handleExportCsv() {
    const d = getTabExport()
    if (!d) return
    const headerRow = d.headers.map(h => typeof h === 'string' ? h : h.label)
    downloadCsv(d.filename, [headerRow, ...d.rows])
  }

  function handlePrint() {
    const d = getTabExport()
    if (!d) return
    const tabLabel = TABS.find(t => t.id === activeTab)?.label ?? activeTab
    const title = `Report — ${tabLabel}`
    const table = buildHtmlTable(d.headers, d.rows, d.totals)
    const bodyHtml = `<h1>${title}</h1><p class="meta">Period: ${dateLabel} &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}</p>${table}`
    openPrintWindow(title, bodyHtml)
  }

  const PRESETS: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'Last 7 days' },
    { id: '30days', label: 'Last 30 days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <p className="text-surface-400 text-sm mt-0.5">Store performance and analytics</p>
      </div>

      {/* Date range bar */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
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
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-500
                         text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
            <span className="text-surface-400 text-sm">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-500
                         text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>
        )}
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Revenue"
          value={summary ? fmtCurrency(summary.totalRevenue) : '—'}
          color="text-primary-400"
        />
        <StatCard
          label="Transactions"
          value={summary ? String(summary.transactionCount) : '—'}
          sub={summary ? `${summary.voidedCount} voided` : undefined}
        />
        <StatCard
          label="Avg. Ticket"
          value={summary ? fmtCurrency(summary.avgTransactionValue) : '—'}
        />
        <StatCard
          label="Gross Profit"
          value={pnl ? fmtCurrency(pnl.grossProfit) : '—'}
          color={pnl && pnl.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}
          sub={pnl ? fmtPct(pnl.grossMarginPct) + ' margin' : undefined}
        />
        <StatCard
          label="Discounts Given"
          value={summary ? fmtCurrency(summary.totalDiscounts) : '—'}
          color="text-yellow-400"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-700">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition
                ${activeTab === t.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-surface-400 hover:text-surface-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export toolbar */}
      <div className="flex items-center justify-end gap-2 -mt-4">
        <button
          onClick={handleExportCsv}
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
          onClick={handlePrint}
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

      {/* Query error banner */}
      {(summaryQ.isError || pnlQ.isError) && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
          <span className="font-medium">Report query failed: </span>
          {String((summaryQ.error || pnlQ.error as Error)?.message ?? 'Unknown error')}
        </div>
      )}

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab pnl={pnlQ.data} loading={pnlQ.isLoading} error={pnlQ.error as Error | null} />
        )}
        {activeTab === 'transactions' && (
          <TransactionsTab
            rows={txnsQ.data ?? []}
            loading={txnsQ.isLoading}
            error={txnsQ.error as Error | null}
            paymentFilter={txnPaymentFilter}
            onPaymentFilter={setTxnPaymentFilter}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsTab rows={paymentsQ.data ?? []} loading={paymentsQ.isLoading} error={paymentsQ.error as Error | null} />
        )}
        {activeTab === 'hourly' && (
          <HourlyTab rows={hourlyQ.data ?? []} loading={hourlyQ.isLoading} error={hourlyQ.error as Error | null} />
        )}
        {activeTab === 'products' && (
          <ProductsTab rows={productsQ.data ?? []} loading={productsQ.isLoading} error={productsQ.error as Error | null} />
        )}
        {activeTab === 'categories' && (
          <CategoriesTab rows={categoriesQ.data ?? []} loading={categoriesQ.isLoading} error={categoriesQ.error as Error | null} />
        )}
        {activeTab === 'trend' && (
          <TrendTab rows={trendQ.data ?? []} loading={trendQ.isLoading} error={trendQ.error as Error | null} />
        )}
        {activeTab === 'cashiers' && (
          <CashiersTab rows={cashiersQ.data ?? []} loading={cashiersQ.isLoading} error={cashiersQ.error as Error | null} />
        )}
      </div>
    </div>
  )
}

// ── Overview / P&L tab ─────────────────────────────────────────────────────────

function OverviewTab({
  pnl,
  loading,
  error,
}: {
  pnl: import('../../services/reportService').ProfitLossResponse | undefined
  loading: boolean
  error: Error | null
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState message={error.message} />
  if (!pnl) return <EmptyState message="No data for the selected period." />

  const rows = [
    { label: 'Revenue', value: fmtCurrency(pnl.revenue), color: 'text-white' },
    { label: 'Cost of Goods Sold (COGS)', value: `− ${fmtCurrency(pnl.cogs)}`, color: 'text-red-400' },
    { label: 'Gross Profit', value: fmtCurrency(pnl.grossProfit), color: pnl.grossProfit >= 0 ? 'text-green-400' : 'text-red-400', bold: true  },
    { label: 'Gross Margin', value: fmtPct(pnl.grossMarginPct), color: 'text-surface-300' },
    { label: 'Total Discounts Given', value: `− ${fmtCurrency(pnl.totalDiscounts)}`, color: 'text-yellow-400' },
  ]

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden max-w-lg">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`flex justify-between items-center px-5 py-3
            ${i < rows.length - 1 ? 'border-b border-surface-700' : ''}
            ${row.bold ? 'bg-surface-850' : ''}`}
        >
          <span className={`text-sm ${row.bold ? 'font-semibold text-white' : 'text-surface-300'}`}>
            {row.label}
          </span>
          <span className={`text-sm font-mono ${row.color} ${row.bold ? 'font-semibold' : ''}`}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Payment types tab ──────────────────────────────────────────────────────────

function PaymentsTab({
  rows,
  loading,
  error,
}: {
  rows: import('../../services/reportService').PaymentBreakdownItem[]
  loading: boolean
  error: Error | null
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState message={error.message} />
  if (rows.length === 0) return <EmptyState message="No completed sales in the selected period." />

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
            <th className="px-4 py-3 text-left">Payment Method</th>
            <th className="px-4 py-3 text-right">Transactions</th>
            <th className="px-4 py-3 text-right">Total Amount</th>
            <th className="px-4 py-3 text-right">Share</th>
            <th className="px-4 py-3 text-left">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.paymentMethod}
                className={`border-b border-surface-700/50 ${i % 2 === 1 ? 'bg-surface-850/60' : ''}`}>
              <td className="px-4 py-3 text-white font-medium">
                {PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod}
              </td>
              <td className="px-4 py-3 text-right text-surface-300">{r.transactionCount}</td>
              <td className="px-4 py-3 text-right text-white font-mono">{fmtCurrency(r.totalAmount)}</td>
              <td className="px-4 py-3 text-right text-surface-300">{fmtPct(r.pctOfTotal)}</td>
              <td className="px-4 py-3 w-40">
                <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${Math.min(r.pctOfTotal, 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Top products tab ───────────────────────────────────────────────────────────

function ProductsTab({
  rows,
  loading,
  error,
}: {
  rows: import('../../services/reportService').TopProductRow[]
  loading: boolean
  error: Error | null
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState message={error.message} />
  if (rows.length === 0) return <EmptyState message="No sales data for the selected period." />

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
            <th className="px-4 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-left">Product</th>
            <th className="px-4 py-3 text-left">Barcode</th>
            <th className="px-4 py-3 text-right">Qty Sold</th>
            <th className="px-4 py-3 text-right">Revenue</th>
            <th className="px-4 py-3 text-right">COGS</th>
            <th className="px-4 py-3 text-right">Gross Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.productId}
                className={`border-b border-surface-700/50 ${i % 2 === 1 ? 'bg-surface-850/60' : ''}`}>
              <td className="px-4 py-3 text-surface-500 text-xs">{i + 1}</td>
              <td className="px-4 py-3 text-white">{r.productName}</td>
              <td className="px-4 py-3 text-surface-400 font-mono text-xs">{r.barcode ?? '—'}</td>
              <td className="px-4 py-3 text-right text-surface-300">{fmt(r.qtySold, 0)}</td>
              <td className="px-4 py-3 text-right text-white font-mono">{fmtCurrency(r.revenue)}</td>
              <td className="px-4 py-3 text-right text-red-400 font-mono">{fmtCurrency(r.cogs)}</td>
              <td className={`px-4 py-3 text-right font-mono font-medium
                ${r.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtCurrency(r.grossProfit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Daily trend tab ────────────────────────────────────────────────────────────

function TrendTab({
  rows,
  loading,
  error,
}: {
  rows: import('../../services/reportService').DailyTrendRow[]
  loading: boolean
  error: Error | null
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState message={error.message} />
  if (rows.length === 0) return <EmptyState message="No daily data for the selected period." />

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1)

  return (
    <div className="space-y-3">
      {/* Bar chart */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <p className="text-surface-400 text-xs mb-3">Revenue per day</p>
        <div className="flex items-end gap-1 h-32">
          {rows.map((r) => (
            <div key={r.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full bg-primary-600/70 hover:bg-primary-500 rounded-t transition"
                style={{ height: `${(r.revenue / maxRevenue) * 100}%`, minHeight: '2px' }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center
                              bg-surface-900 border border-surface-600 rounded px-2 py-1 text-xs
                              text-white whitespace-nowrap z-10 pointer-events-none">
                <span className="font-medium">{r.date}</span>
                <span className="text-primary-400">{fmtCurrency(r.revenue)}</span>
                <span className="text-surface-400">{r.transactionCount} txns</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-surface-500 text-xs">
          <span>{rows[0]?.date}</span>
          <span>{rows[rows.length - 1]?.date}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Transactions</th>
              <th className="px-4 py-3 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.date}
                  className={`border-b border-surface-700/50 ${i % 2 === 1 ? 'bg-surface-850/60' : ''}`}>
                <td className="px-4 py-3 text-white">{r.date}</td>
                <td className="px-4 py-3 text-right text-surface-300">{r.transactionCount}</td>
                <td className="px-4 py-3 text-right text-white font-mono">{fmtCurrency(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-surface-600 bg-surface-850/50 font-semibold">
              <td className="px-4 py-3 text-surface-300">Total</td>
              <td className="px-4 py-3 text-right text-white">
                {rows.reduce((s, r) => s + r.transactionCount, 0)}
              </td>
              <td className="px-4 py-3 text-right text-primary-400 font-mono">
                {fmtCurrency(rows.reduce((s, r) => s + r.revenue, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Cashier performance tab ────────────────────────────────────────────────────

function CashiersTab({
  rows,
  loading,
  error,
}: {
  rows: import('../../services/reportService').CashierReportRow[]
  loading: boolean
  error: Error | null
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState message={error.message} />
  if (rows.length === 0) return <EmptyState message="No cashier data for the selected period." />

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
            <th className="px-4 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-left">Cashier</th>
            <th className="px-4 py-3 text-right">Transactions</th>
            <th className="px-4 py-3 text-right">Total Revenue</th>
            <th className="px-4 py-3 text-right">Avg. Ticket</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.cashierId}
                className={`border-b border-surface-700/50 ${i % 2 === 1 ? 'bg-surface-850/60' : ''}`}>
              <td className="px-4 py-3 text-surface-500 text-xs">{i + 1}</td>
              <td className="px-4 py-3 text-white font-medium">{r.cashierName}</td>
              <td className="px-4 py-3 text-right text-surface-300">{r.transactionCount}</td>
              <td className="px-4 py-3 text-right text-white font-mono">{fmtCurrency(r.revenue)}</td>
              <td className="px-4 py-3 text-right text-surface-300 font-mono">
                {fmtCurrency(r.avgTransactionValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Transactions tab ───────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: { value: PaymentMethodFilter; label: string }[] = [
  { value: 'ALL',    label: 'All Methods' },
  { value: 'CASH',   label: 'Cash' },
  { value: 'CARD',   label: 'Card' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'MIXED',  label: 'Mixed' },
]

function TransactionsTab({
  rows,
  loading,
  error,
  paymentFilter,
  onPaymentFilter,
}: {
  rows: import('../../services/reportService').TransactionReportRow[]
  loading: boolean
  error: Error | null
  paymentFilter: PaymentMethodFilter
  onPaymentFilter: (v: PaymentMethodFilter) => void
}) {
  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-surface-400 text-sm">Payment:</span>
        {PAYMENT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onPaymentFilter(opt.value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition
              ${paymentFilter === opt.value
                ? 'bg-primary-600 text-white'
                : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-surface-500 text-xs">
          {loading ? 'Loading…' : `${rows.length} transaction${rows.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {loading && <LoadingRows />}
      {!loading && error && <ErrorState message={error.message} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="No transactions found for the selected period and filter." />
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
                <th className="px-4 py-3 text-left">Date / Time</th>
                <th className="px-4 py-3 text-left">Receipt</th>
                <th className="px-4 py-3 text-left">Cashier</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.saleId}
                    className={`border-b border-surface-700/50 ${i % 2 === 1 ? 'bg-surface-850/60' : ''}`}>
                  <td className="px-4 py-2.5 text-surface-300 text-xs whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-white font-mono text-xs">{r.receiptNumber}</td>
                  <td className="px-4 py-2.5 text-surface-300">{r.cashierName}</td>
                  <td className="px-4 py-2.5 text-center text-surface-300">{r.itemCount}</td>
                  <td className="px-4 py-2.5">
                    <PaymentBadge method={r.paymentMethod} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-surface-300 font-mono">{fmtCurrency(r.subtotal)}</td>
                  <td className="px-4 py-2.5 text-right text-yellow-400 font-mono text-xs">
                    {r.discountAmount > 0 ? `− ${fmtCurrency(r.discountAmount)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-white font-mono font-medium">
                    {fmtCurrency(r.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-600 bg-surface-850/50 font-semibold text-sm">
                <td colSpan={5} className="px-4 py-3 text-surface-300">Total ({rows.length} transactions)</td>
                <td className="px-4 py-3 text-right text-surface-300 font-mono">
                  {fmtCurrency(rows.reduce((s, r) => s + r.subtotal, 0))}
                </td>
                <td className="px-4 py-3 text-right text-yellow-400 font-mono">
                  {fmtCurrency(rows.reduce((s, r) => s + r.discountAmount, 0))}
                </td>
                <td className="px-4 py-3 text-right text-primary-400 font-mono">
                  {fmtCurrency(rows.reduce((s, r) => s + r.totalAmount, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Peak hours tab ─────────────────────────────────────────────────────────────

function HourlyTab({
  rows,
  loading,
  error,
}: {
  rows: import('../../services/reportService').HourlyTrendRow[]
  loading: boolean
  error: Error | null
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState message={error.message} />
  if (rows.length === 0) return <EmptyState message="No hourly data for the selected period." />

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1)
  const maxCount   = Math.max(...rows.map((r) => r.txnCount), 1)

  // Build a full 24-hour array with zeros for missing hours
  const full = Array.from({ length: 24 }, (_, h) => {
    const found = rows.find((r) => r.hour === h)
    return found ?? { hour: h, txnCount: 0, revenue: 0 }
  })

  function hourLabel(h: number) {
    if (h === 0)  return '12am'
    if (h < 12)   return `${h}am`
    if (h === 12) return '12pm'
    return `${h - 12}pm`
  }

  return (
    <div className="space-y-4">
      {/* Revenue bar chart */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <p className="text-surface-400 text-xs mb-3">Revenue by hour of day</p>
        <div className="flex items-end gap-1 h-28">
          {full.map((r) => (
            <div key={r.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full bg-primary-600/70 hover:bg-primary-500 rounded-t transition"
                style={{ height: `${(r.revenue / maxRevenue) * 100}%`, minHeight: r.revenue > 0 ? '3px' : '0' }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center
                              bg-surface-900 border border-surface-600 rounded px-2 py-1 text-xs
                              text-white whitespace-nowrap z-10 pointer-events-none">
                <span className="font-medium">{hourLabel(r.hour)}</span>
                <span className="text-primary-400">{fmtCurrency(r.revenue)}</span>
                <span className="text-surface-400">{r.txnCount} txns</span>
              </div>
            </div>
          ))}
        </div>
        {/* Hour labels every 3 hours */}
        <div className="flex mt-1 text-surface-500 text-xs">
          {full.map((r) => (
            <div key={r.hour} className="flex-1 text-center">
              {r.hour % 3 === 0 ? hourLabel(r.hour) : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Table — only non-zero hours */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Hour</th>
              <th className="px-4 py-3 text-right">Transactions</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-left">Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.hour} className={`border-b border-surface-700/50 ${i % 2 === 1 ? 'bg-surface-850/60' : ''}`}>
                <td className="px-4 py-3 text-white font-medium">{hourLabel(r.hour)}</td>
                <td className="px-4 py-3 text-right text-surface-300">{r.txnCount}</td>
                <td className="px-4 py-3 text-right text-white font-mono">{fmtCurrency(r.revenue)}</td>
                <td className="px-4 py-3 w-40">
                  <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${(r.txnCount / maxCount) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── By category tab ────────────────────────────────────────────────────────────

function CategoriesTab({
  rows,
  loading,
  error,
}: {
  rows: import('../../services/reportService').CategorySalesRow[]
  loading: boolean
  error: Error | null
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState message={error.message} />
  if (rows.length === 0) return <EmptyState message="No category data for the selected period." />

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase">
            <th className="px-4 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-right">Qty Sold</th>
            <th className="px-4 py-3 text-right">Revenue</th>
            <th className="px-4 py-3 text-right">COGS</th>
            <th className="px-4 py-3 text-right">Gross Profit</th>
            <th className="px-4 py-3 text-right">Share</th>
            <th className="px-4 py-3 text-left">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const share = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0
            return (
              <tr key={r.categoryId ?? 'uncategorised'}
                  className={`border-b border-surface-700/50 ${i % 2 === 1 ? 'bg-surface-850/60' : ''}`}>
                <td className="px-4 py-3 text-surface-500 text-xs">{i + 1}</td>
                <td className="px-4 py-3 text-white font-medium">
                  {r.categoryName}
                  {!r.categoryId && (
                    <span className="ml-1 text-surface-500 text-xs">(none)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-surface-300">{fmt(r.qtySold, 0)}</td>
                <td className="px-4 py-3 text-right text-white font-mono">{fmtCurrency(r.revenue)}</td>
                <td className="px-4 py-3 text-right text-red-400 font-mono">{fmtCurrency(r.cogs)}</td>
                <td className={`px-4 py-3 text-right font-mono font-medium
                  ${r.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtCurrency(r.grossProfit)}
                </td>
                <td className="px-4 py-3 text-right text-surface-300">{fmtPct(share)}</td>
                <td className="px-4 py-3 w-32">
                  <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${Math.min(share, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-surface-600 bg-surface-850/50 font-semibold">
            <td colSpan={3} className="px-4 py-3 text-surface-300">Total</td>
            <td className="px-4 py-3 text-right text-primary-400 font-mono">
              {fmtCurrency(rows.reduce((s, r) => s + r.revenue, 0))}
            </td>
            <td className="px-4 py-3 text-right text-red-400 font-mono">
              {fmtCurrency(rows.reduce((s, r) => s + r.cogs, 0))}
            </td>
            <td className="px-4 py-3 text-right text-green-400 font-mono">
              {fmtCurrency(rows.reduce((s, r) => s + r.grossProfit, 0))}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Payment badge helper ────────────────────────────────────────────────────────

function PaymentBadge({ method }: { method: string }) {
  const styles: Record<string, string> = {
    CASH:   'bg-green-900/40 text-green-400 border-green-800',
    CARD:   'bg-blue-900/40 text-blue-400 border-blue-800',
    MOBILE: 'bg-purple-900/40 text-purple-400 border-purple-800',
    MIXED:  'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  }
  const labels: Record<string, string> = {
    CASH: 'Cash', CARD: 'Card', MOBILE: 'Mobile', MIXED: 'Mixed',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border
      ${styles[method] ?? 'bg-surface-700 text-surface-300 border-surface-600'}`}>
      {labels[method] ?? method}
    </span>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-surface-700 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-surface-500 text-sm">{message}</div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-red-400 text-sm font-medium">Failed to load report</p>
      <p className="text-surface-500 text-xs mt-1">{message}</p>
    </div>
  )
}
