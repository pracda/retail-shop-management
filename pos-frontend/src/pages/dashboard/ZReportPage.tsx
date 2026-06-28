import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import api from '../../services/api'
import { downloadCsv, openPrintWindow, buildHtmlTable } from '../../utils/reportExport'

interface ZReport {
  date: string
  storeId: number
  storeName: string
  totalSales: number
  saleCount: number
  totalRefunds: number
  refundCount: number
  totalVoids: number
  voidCount: number
  totalExpenses: number
  taxCollected: number
  paymentBreakdown: Record<string, number>
  expectedCashInDrawer: number
  shiftSummaries: {
    shiftId: number
    cashierName: string
    openingFloat: number
    totalSales: number
    saleCount: number
    expenses: number
    closingCash: number | null
  }[]
}

async function getZReport(storeId: number, date: string): Promise<ZReport> {
  const { data } = await api.get('/reports/z-report', { params: { storeId, date } })
  return data.data
}

export default function ZReportPage() {
  const user = useAuthStore(s => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [enabled, setEnabled] = useState(false)

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['z-report', storeId, date],
    queryFn: () => getZReport(storeId, date),
    enabled,
  })

  function handleFetch() {
    setEnabled(true)
  }

  function handlePrint() {
    window.print()
  }

  function handleExportCsv() {
    if (!report) return
    const rows: string[][] = [
      ['Field', 'Value'],
      ['Store', report.storeName],
      ['Date', report.date],
      ['Total Sales', report.totalSales.toFixed(2)],
      ['Sale Count', String(report.saleCount)],
      ['Total Refunds', report.totalRefunds.toFixed(2)],
      ['Refund Count', String(report.refundCount)],
      ['Voided Sales', report.totalVoids.toFixed(2)],
      ['Void Count', String(report.voidCount)],
      ['Total Expenses', report.totalExpenses.toFixed(2)],
      ['Tax Collected', report.taxCollected.toFixed(2)],
      ['Expected Cash in Drawer', report.expectedCashInDrawer.toFixed(2)],
      [],
      ['Payment Breakdown', ''],
      ...Object.entries(report.paymentBreakdown).map(([method, amount]) => [method, amount.toFixed(2)]),
    ]
    if (report.shiftSummaries.length > 0) {
      rows.push([], ['Shift Summaries', ''])
      rows.push(['Shift #', 'Cashier', 'Opening Float', 'Sales', 'Sale Count', 'Expenses', 'Closing Cash'])
      report.shiftSummaries.forEach(s => {
        rows.push([String(s.shiftId), s.cashierName, s.openingFloat.toFixed(2), s.totalSales.toFixed(2), String(s.saleCount), s.expenses.toFixed(2), s.closingCash != null ? s.closingCash.toFixed(2) : ''])
      })
    }
    downloadCsv(`z-report-${report.date}.csv`, rows)
  }

  function handlePrintPdf() {
    if (!report) return
    const summaryTable = buildHtmlTable(
      ['Metric', { label: 'Value', align: 'r' }],
      [
        ['Total Sales', `Rs. ${report.totalSales.toFixed(2)} (${report.saleCount} transactions)`],
        ['Total Refunds', `Rs. ${report.totalRefunds.toFixed(2)} (${report.refundCount})`],
        ['Voided Sales', `Rs. ${report.totalVoids.toFixed(2)} (${report.voidCount})`],
        ['Total Expenses', `Rs. ${report.totalExpenses.toFixed(2)}`],
        ['Tax Collected', `Rs. ${report.taxCollected.toFixed(2)}`],
        ['Expected Cash in Drawer', `Rs. ${report.expectedCashInDrawer.toFixed(2)}`],
      ],
    )
    const payTable = buildHtmlTable(
      ['Payment Method', { label: 'Amount', align: 'r' }],
      Object.entries(report.paymentBreakdown).map(([m, a]) => [m, `Rs. ${a.toFixed(2)}`]),
    )
    const shiftHtml = report.shiftSummaries.length > 0
      ? `<h2>Shift Summaries</h2>${buildHtmlTable(
          ['Shift #', 'Cashier', { label: 'Opening Float', align: 'r' }, { label: 'Sales', align: 'r' }, { label: 'Txns', align: 'c' }, { label: 'Expenses', align: 'r' }, { label: 'Closing Cash', align: 'r' }],
          report.shiftSummaries.map(s => [
            String(s.shiftId), s.cashierName,
            `Rs. ${s.openingFloat.toFixed(2)}`,
            `Rs. ${s.totalSales.toFixed(2)}`,
            String(s.saleCount),
            `Rs. ${s.expenses.toFixed(2)}`,
            s.closingCash != null ? `Rs. ${s.closingCash.toFixed(2)}` : '—',
          ]),
        )}`
      : ''
    const bodyHtml = `
      <h1>Z-Report — ${report.storeName}</h1>
      <p class="meta">${new Date(report.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <h2>Summary</h2>${summaryTable}
      <h2>Payment Breakdown</h2>${payTable}
      ${shiftHtml}
    `
    openPrintWindow(`Z-Report ${report.date}`, bodyHtml)
  }

  const fmt = (v: number) => `Rs. ${v.toFixed(2)}`

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Z-Report</h1>
          <p className="text-surface-400 text-sm mt-1">End-of-day sales summary</p>
        </div>
        {report && (
          <div className="flex items-center gap-2">
            <button onClick={handleExportCsv}
              className="flex items-center gap-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300
                         hover:text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors border border-surface-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button onClick={handlePrintPdf}
              className="flex items-center gap-1.5 bg-surface-700 hover:bg-surface-600 text-surface-300
                         hover:text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors border border-surface-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
            <button onClick={handlePrint}
              className="bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Print Page
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-6">
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setEnabled(false) }}
          className="px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm focus:outline-none focus:border-primary-500" />
        <button onClick={handleFetch}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Generate Report
        </button>
      </div>

      {isLoading && <div className="text-surface-400 py-8 text-center">Loading report...</div>}
      {isError && <div className="text-red-400 py-4 text-center">Failed to load report</div>}

      {report && (
        <div className="space-y-6 print:text-black print:bg-white">
          {/* Header */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
            <div className="text-center mb-4">
              <div className="text-xl font-bold text-white">{report.storeName}</div>
              <div className="text-surface-400 text-sm">Z-Report — {new Date(report.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">{fmt(report.totalSales)}</div>
                <div className="text-surface-400 text-xs mt-1">Total Sales ({report.saleCount} txns)</div>
              </div>
              <div className="bg-surface-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{fmt(report.totalRefunds)}</div>
                <div className="text-surface-400 text-xs mt-1">Refunds ({report.refundCount})</div>
              </div>
              <div className="bg-surface-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{fmt(report.totalExpenses)}</div>
                <div className="text-surface-400 text-xs mt-1">Expenses</div>
              </div>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Payment Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(report.paymentBreakdown).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="text-surface-300 text-sm">{method}</span>
                  <span className="text-white font-medium">{fmt(amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tax & Cash */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-surface-300 text-sm">Tax Collected</span><span className="text-white">{fmt(report.taxCollected)}</span></div>
              <div className="flex justify-between"><span className="text-surface-300 text-sm">Voided Sales</span><span className="text-red-400">{fmt(report.totalVoids)} ({report.voidCount})</span></div>
              <div className="flex justify-between pt-2 border-t border-surface-700">
                <span className="text-white font-semibold">Expected Cash in Drawer</span>
                <span className="text-primary-400 font-bold text-lg">{fmt(report.expectedCashInDrawer)}</span>
              </div>
            </div>
          </div>

          {/* Shift Summaries */}
          {report.shiftSummaries.length > 0 && (
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Shift Summaries</h3>
              <div className="space-y-3">
                {report.shiftSummaries.map(s => (
                  <div key={s.shiftId} className="bg-surface-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium text-sm">{s.cashierName}</span>
                      <span className="text-surface-400 text-xs">Shift #{s.shiftId}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-surface-400">Opening Float: </span><span className="text-white">{fmt(s.openingFloat)}</span></div>
                      <div><span className="text-surface-400">Sales: </span><span className="text-white">{fmt(s.totalSales)} ({s.saleCount})</span></div>
                      <div><span className="text-surface-400">Expenses: </span><span className="text-yellow-400">{fmt(s.expenses)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
