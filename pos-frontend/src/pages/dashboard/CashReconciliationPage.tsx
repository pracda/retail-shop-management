import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useActiveStoreId } from '../../hooks/useActiveStoreId'
import { getShiftHistory, getReconciliation, type Shift } from '../../services/shiftService'

function fmt(n?: number | null) {
  if (n == null) return '—'
  return `Rs. ${n.toFixed(2)}`
}

function VarianceBadge({ variance }: { variance?: number | null }) {
  if (variance == null) return <span className="text-surface-400 text-sm">Shift open</span>
  const abs = Math.abs(variance).toFixed(2)
  if (Math.abs(variance) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold
        bg-primary-600/20 border border-primary-600/30 text-primary-400">
        Balanced
      </span>
    )
  }
  if (variance > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold
        bg-yellow-600/20 border border-yellow-600/30 text-yellow-400">
        +Rs. {abs} overage
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold
      bg-red-600/20 border border-red-600/30 text-red-400">
      -Rs. {abs} shortage
    </span>
  )
}

function ReconciliationDetail({ shiftId }: { shiftId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reconciliation', shiftId],
    queryFn: () => getReconciliation(shiftId),
  })

  if (isLoading) return <div className="text-surface-400 text-sm py-4 text-center">Loading...</div>
  if (!data) return null

  const rows: { label: string; value: string; note?: string; bold?: boolean; highlight?: 'green' | 'red' | 'yellow' }[] = [
    { label: 'Opening float', value: fmt(data.openingFloat) },
    { label: 'Cash sales collected', value: fmt(data.cashSalesTotal), note: '(CASH payment method only)' },
    { label: 'Cash refunds paid out', value: `−${fmt(data.cashRefundsTotal)}` },
    { label: 'Expenses / petty cash', value: `−${fmt(data.expenseTotal)}` },
    {
      label: 'Expected cash in drawer',
      value: fmt(data.expectedCash),
      bold: true,
    },
    {
      label: 'Actual cash counted',
      value: fmt(data.closingCash),
      bold: true,
    },
    {
      label: 'Variance',
      value: data.variance == null ? '—' : (data.variance >= 0 ? `+${fmt(data.variance)}` : fmt(data.variance)),
      bold: true,
      highlight: data.variance == null ? undefined : Math.abs(data.variance) < 0.01 ? 'green' : data.variance > 0 ? 'yellow' : 'red',
    },
  ]

  return (
    <div className="mt-4 bg-surface-700/50 border border-surface-600 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-surface-600 flex items-center justify-between">
        <div className="text-sm text-surface-300">
          Cashier: <span className="text-white font-medium">{data.cashierName}</span>
          <span className="text-surface-500 mx-2">·</span>
          {new Date(data.openedAt).toLocaleString()}
          {data.closedAt && <> → {new Date(data.closedAt).toLocaleString()}</>}
        </div>
        <VarianceBadge variance={data.variance} />
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-surface-700">
          {rows.map(row => (
            <tr key={row.label} className={row.bold ? 'bg-surface-700/60' : ''}>
              <td className="px-5 py-3 text-surface-400">
                {row.label}
                {row.note && <span className="ml-1 text-surface-500 text-xs">{row.note}</span>}
              </td>
              <td className={`px-5 py-3 text-right font-mono ${
                row.bold ? 'font-semibold' : ''
              } ${
                row.highlight === 'green' ? 'text-primary-400' :
                row.highlight === 'red' ? 'text-red-400' :
                row.highlight === 'yellow' ? 'text-yellow-400' :
                'text-white'
              }`}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CashReconciliationPage() {
  const storeId = useActiveStoreId()
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['shift-history', storeId, page],
    queryFn: () => getShiftHistory(storeId, page, 15),
  })

  const shifts = data?.content ?? []

  function toggle(shift: Shift) {
    setExpandedId(prev => prev === shift.id ? null : shift.id)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Cash Reconciliation</h1>
        <p className="text-surface-400 text-sm mt-1">
          Compare expected vs actual cash for each shift — identify overages and shortages
        </p>
      </div>

      {isLoading ? (
        <div className="text-surface-400 py-8 text-center">Loading shifts...</div>
      ) : shifts.length === 0 ? (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-12 text-center">
          <p className="text-surface-400">No shifts found for this store</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-700/30 transition-colors text-left"
                onClick={() => toggle(shift)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">Shift #{shift.id}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        shift.status === 'OPEN'
                          ? 'bg-primary-600/20 border-primary-600/30 text-primary-400'
                          : 'bg-surface-700 border-surface-600 text-surface-400'
                      }`}>
                        {shift.status}
                      </span>
                    </div>
                    <div className="text-surface-400 text-xs mt-0.5">
                      {shift.cashierName} · {new Date(shift.openedAt).toLocaleDateString()}
                      {shift.closedAt && ` → ${new Date(shift.closedAt).toLocaleTimeString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div className="text-surface-400 text-xs">Opening float</div>
                    <div className="text-white font-medium">{fmt(shift.openingFloat)}</div>
                  </div>
                  {shift.closingCash != null && (
                    <div className="text-right text-sm">
                      <div className="text-surface-400 text-xs">Closing cash</div>
                      <div className="text-white font-medium">{fmt(shift.closingCash)}</div>
                    </div>
                  )}
                  <svg
                    className={`w-5 h-5 text-surface-400 transition-transform ${expandedId === shift.id ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedId === shift.id && (
                <div className="px-5 pb-5">
                  <ReconciliationDetail shiftId={shift.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-surface-400 text-sm">Page {(data?.page ?? 0) + 1} of {data?.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={data?.last}
              className="px-3 py-1.5 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
