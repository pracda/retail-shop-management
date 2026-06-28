import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { getSalesSummary } from '../../services/reportService'
import { getTransactions } from '../../services/reportService'
import { getActiveCashierCount } from '../../services/storeService'
import api from '../../services/api'

function todayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { from: start.toISOString(), to: end.toISOString() }
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: 'text-green-400',
  CARD: 'text-blue-400',
  MOBILE: 'text-purple-400',
  MIXED: 'text-yellow-400',
}

const quickLinks = [
  { label: 'Manage Users', to: '/dashboard/users', desc: 'Add, edit, assign roles' },
  { label: 'Products', to: '/dashboard/products', desc: 'Catalogue & pricing' },
  { label: 'Inventory', to: '/dashboard/inventory', desc: 'Stock levels & adjustments' },
  { label: 'Reports', to: '/dashboard/reports', desc: 'Sales, P&L, cashier performance' },
  { label: 'Sales History', to: '/dashboard/sales', desc: 'Browse past transactions' },
  { label: 'Settings', to: '/dashboard/settings', desc: 'Store configuration' },
]

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user)
  const storeId = user?.storeId ?? 1
  const today = new Date().toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const { from, to } = todayRange()

  const { data: summary } = useQuery({
    queryKey: ['dash-summary', storeId, from, to],
    queryFn: () => getSalesSummary({ storeId, from, to }),
    staleTime: 60_000,
  })

  const { data: lowStockPage } = useQuery({
    queryKey: ['dash-low-stock', storeId],
    queryFn: async () => {
      const { data } = await api.get('/inventory/stock/low', { params: { storeId, page: 0, size: 1 } })
      return data.data as { totalElements: number }
    },
    staleTime: 120_000,
  })

  const { data: activeCashiers } = useQuery({
    queryKey: ['dash-active-cashiers', storeId],
    queryFn: () => getActiveCashierCount(storeId),
    staleTime: 60_000,
  })

  const { data: recentTxns } = useQuery({
    queryKey: ['dash-recent-txns', storeId],
    queryFn: () => getTransactions({ storeId, from, to, page: 0, size: 8 }),
    staleTime: 60_000,
  })

  const fmt = (n?: number) => n == null ? '—' : `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtCount = (n?: number) => n == null ? '—' : n.toString()

  const lowStockCount = lowStockPage?.totalElements
  const lowStockColor = lowStockCount != null && lowStockCount > 0 ? 'text-yellow-400' : 'text-white'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-surface-400 text-sm mt-1">{today}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Today's Revenue */}
        <div className="rounded-xl border p-4 bg-primary-600/10 border-primary-600/20">
          <div className="mb-2 text-primary-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402
                   2.599 1M12 8V7m0 13v-1m0-4c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-white truncate">{fmt(summary?.totalRevenue)}</div>
          <div className="text-surface-300 text-sm font-medium mt-0.5">Today's Sales</div>
          <div className="text-surface-500 text-xs mt-0.5">
            {summary ? `${summary.transactionCount} transactions` : 'Loading…'}
          </div>
        </div>

        {/* Transactions */}
        <div className="rounded-xl border p-4 bg-blue-600/10 border-blue-600/20">
          <div className="mb-2 text-blue-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002
                   2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-white">{fmtCount(summary?.transactionCount)}</div>
          <div className="text-surface-300 text-sm font-medium mt-0.5">Transactions</div>
          <div className="text-surface-500 text-xs mt-0.5">
            {summary ? `${summary.voidedCount} voided` : 'Today'}
          </div>
        </div>

        {/* Low Stock */}
        <Link to="/dashboard/inventory" className="rounded-xl border p-4 bg-yellow-600/10 border-yellow-600/20 hover:bg-yellow-600/20 transition-colors">
          <div className="mb-2 text-yellow-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464
                   0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className={`text-2xl font-bold ${lowStockColor}`}>{fmtCount(lowStockCount)}</div>
          <div className="text-surface-300 text-sm font-medium mt-0.5">Low Stock Items</div>
          <div className="text-surface-500 text-xs mt-0.5">
            {lowStockCount != null && lowStockCount > 0 ? 'Click to review' : 'All stocked'}
          </div>
        </Link>

        {/* Active Cashiers */}
        <div className="rounded-xl border p-4 bg-purple-600/10 border-purple-600/20">
          <div className="mb-2 text-purple-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3
                   3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0
                   11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-white">{fmtCount(activeCashiers)}</div>
          <div className="text-surface-300 text-sm font-medium mt-0.5">Active Cashiers</div>
          <div className="text-surface-500 text-xs mt-0.5">On shift now</div>
        </div>
      </div>

      {/* Quick links */}
      <h2 className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Manage
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center justify-between p-4 rounded-xl bg-surface-800
                       border border-surface-700 hover:bg-surface-700 hover:border-surface-600
                       transition-colors group"
          >
            <div>
              <div className="text-white text-sm font-semibold">{link.label}</div>
              <div className="text-surface-400 text-xs mt-0.5">{link.desc}</div>
            </div>
            <svg
              className="w-4 h-4 text-surface-500 group-hover:text-primary-400 transition-colors shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl bg-surface-800 border border-surface-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h2 className="text-sm font-semibold text-white">Today's Transactions</h2>
          <Link to="/dashboard/sales" className="text-primary-400 text-xs hover:text-primary-300">
            View all →
          </Link>
        </div>

        {!recentTxns || recentTxns.length === 0 ? (
          <div className="px-5 py-8 text-center text-surface-500 text-sm">
            No sales recorded today
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-surface-500 text-xs uppercase tracking-wider border-b border-surface-700">
                <th className="text-left px-5 py-2 font-medium">Receipt</th>
                <th className="text-left px-5 py-2 font-medium">Cashier</th>
                <th className="text-left px-5 py-2 font-medium">Method</th>
                <th className="text-right px-5 py-2 font-medium">Total</th>
                <th className="text-right px-5 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTxns.map((txn) => (
                <tr key={txn.saleId} className="border-b border-surface-700/50 hover:bg-surface-700/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-surface-300">{txn.receiptNumber}</td>
                  <td className="px-5 py-3 text-surface-300">{txn.cashierName}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${PAYMENT_COLORS[txn.paymentMethod] ?? 'text-surface-400'}`}>
                      {txn.paymentMethod}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-white">
                    Rs. {txn.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-right text-surface-400 text-xs">
                    {new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
