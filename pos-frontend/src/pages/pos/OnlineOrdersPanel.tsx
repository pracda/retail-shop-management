import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listOnlineOrders, confirmOnlineOrder, fulfillOnlineOrder, cancelOnlineOrder,
  type AdminOrder, type OnlineOrderStatus,
} from '../../services/onlineOrderService'

// ── Print packing slip ─────────────────────────────────────────────────────────

function printPackingSlip(order: AdminOrder, storeName: string) {
  const date = new Date(order.placedAt).toLocaleString()
  const items = order.items.map((i) =>
    `<tr>
       <td style="padding:2px 4px">${i.productName}</td>
       <td style="padding:2px 4px;text-align:center">x${i.quantity}</td>
       <td style="padding:2px 4px;text-align:right">Rs.${i.lineTotal.toFixed(2)}</td>
     </tr>`
  ).join('')

  const html = `<!DOCTYPE html><html><head>
    <title>Packing Slip #${order.orderNumber}</title>
    <style>
      body{font-family:monospace;font-size:12px;width:72mm;margin:0 auto;padding:8px}
      h2{text-align:center;margin:4px 0;font-size:14px}
      .center{text-align:center}
      .sep{border:none;border-top:1px dashed #000;margin:6px 0}
      table{width:100%;border-collapse:collapse}
      .totals td{padding:2px 4px}
      .totals td:last-child{text-align:right}
      .bold{font-weight:bold}
      @media print{@page{margin:4mm}}
    </style>
  </head><body>
    <h2>${storeName}</h2>
    <p class="center" style="margin:2px 0">PACKING SLIP</p>
    <hr class="sep">
    <p style="margin:3px 0"><b>Order:</b> #${order.orderNumber}</p>
    <p style="margin:3px 0"><b>Date:</b> ${date}</p>
    <p style="margin:3px 0"><b>Customer:</b> ${order.customerName}</p>
    ${order.deliveryAddress ? `<p style="margin:3px 0"><b>Deliver to:</b><br>${order.deliveryAddress.replace(/\n/g, '<br>')}</p>` : ''}
    ${order.note ? `<p style="margin:3px 0"><b>Note:</b> ${order.note}</p>` : ''}
    <hr class="sep">
    <table>
      <thead>
        <tr>
          <th style="text-align:left;padding:2px 4px">Item</th>
          <th style="text-align:center;padding:2px 4px">Qty</th>
          <th style="text-align:right;padding:2px 4px">Amount</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
    <hr class="sep">
    <table class="totals">
      ${order.discountAmount > 0
        ? `<tr><td>Subtotal</td><td>Rs.${order.subtotal.toFixed(2)}</td></tr>
           <tr><td>Loyalty Discount</td><td>-Rs.${order.discountAmount.toFixed(2)}</td></tr>`
        : ''}
      <tr class="bold"><td>TOTAL</td><td>Rs.${order.totalAmount.toFixed(2)}</td></tr>
    </table>
    <hr class="sep">
    <p class="center" style="margin:3px 0;font-size:11px">Thank you!</p>
  </body></html>`

  const w = window.open('', '_blank', 'width=380,height=600,toolbar=0,menubar=0')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.addEventListener('load', () => { w.print(); w.close() })
  }
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<OnlineOrderStatus, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  FULFILLED: 'bg-green-500/20 text-green-400 border-green-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

// ── Order card ─────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  storeId,
  storeName,
  onDone,
}: {
  order: AdminOrder
  storeId: number
  storeName: string
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['online-orders'] })
    qc.invalidateQueries({ queryKey: ['online-orders-pending-count'] })
    onDone()
  }

  const confirmMut  = useMutation({ mutationFn: () => confirmOnlineOrder(storeId, order.id),  onSuccess: invalidate })
  const fulfillMut  = useMutation({ mutationFn: () => fulfillOnlineOrder(storeId, order.id),  onSuccess: invalidate })
  const cancelMut   = useMutation({ mutationFn: () => cancelOnlineOrder(storeId, order.id, cancelReason || undefined), onSuccess: invalidate })

  const busy = confirmMut.isPending || fulfillMut.isPending || cancelMut.isPending

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-750 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm font-mono">#{order.orderNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[order.status]}`}>
              {order.status}
            </span>
            {order.deliveryAddress && (
              <span className="text-xs text-primary-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Delivery
              </span>
            )}
          </div>
          <p className="text-surface-400 text-xs mt-0.5 truncate">{order.customerName} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white font-bold text-sm">Rs.{order.totalAmount.toFixed(2)}</p>
          <p className="text-surface-500 text-xs">{new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <svg
          className={`w-4 h-4 text-surface-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-surface-700 px-4 pb-4 space-y-3">
          {/* Items list */}
          <div className="space-y-1.5 pt-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-start text-sm gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-white">{item.productName}</span>
                  <span className="text-surface-500 ml-2 text-xs">x{item.quantity}</span>
                </div>
                <span className="text-surface-300 font-mono text-xs shrink-0">Rs.{item.lineTotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold text-white pt-1 border-t border-surface-700">
              <span>Total</span>
              <span className="font-mono">Rs.{order.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Delivery address / note */}
          {order.deliveryAddress && (
            <div className="bg-surface-900/60 rounded-lg px-3 py-2 text-xs text-surface-300">
              <span className="font-semibold text-surface-400 uppercase tracking-wide">Deliver to: </span>
              {order.deliveryAddress}
            </div>
          )}
          {order.note && (
            <div className="bg-surface-900/60 rounded-lg px-3 py-2 text-xs text-surface-300 italic">
              <span className="font-semibold not-italic text-surface-400">Note: </span>{order.note}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Confirm */}
            {order.status === 'PENDING' && (
              <button
                onClick={() => confirmMut.mutate()}
                disabled={busy}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white
                           text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
              >
                {confirmMut.isPending ? 'Confirming…' : 'Confirm Order'}
              </button>
            )}

            {/* Print + Fulfill */}
            {(order.status === 'CONFIRMED' || order.status === 'PENDING') && (
              <button
                onClick={() => printPackingSlip(order, storeName)}
                className="flex items-center gap-1.5 bg-surface-700 hover:bg-surface-600 text-white
                           text-xs font-medium py-2 px-3 rounded-lg transition-colors border border-surface-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Slip
              </button>
            )}
            {order.status === 'CONFIRMED' && (
              <button
                onClick={() => fulfillMut.mutate()}
                disabled={busy}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white
                           text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
              >
                {fulfillMut.isPending ? 'Marking…' : 'Mark Fulfilled'}
              </button>
            )}

            {/* Cancel */}
            {(order.status === 'PENDING' || order.status === 'CONFIRMED') && !showCancel && (
              <button
                onClick={() => setShowCancel(true)}
                disabled={busy}
                className="bg-surface-700 hover:bg-red-900/40 border border-surface-600 hover:border-red-700
                           text-surface-400 hover:text-red-400 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Cancel reason form */}
          {showCancel && (
            <div className="space-y-2">
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Cancellation reason (optional)"
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                           text-white text-xs placeholder-surface-500 focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 bg-surface-700 text-white text-xs font-medium py-2 rounded-lg"
                >Back</button>
                <button
                  onClick={() => cancelMut.mutate()}
                  disabled={busy}
                  className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white
                             text-xs font-semibold py-2 rounded-lg transition-colors"
                >
                  {cancelMut.isPending ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

type Tab = 'PENDING' | 'CONFIRMED' | 'ALL'

export default function OnlineOrdersPanel({
  storeId,
  storeName,
  pendingCount,
  onClose,
}: {
  storeId: number
  storeName: string
  pendingCount: number
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>(pendingCount > 0 ? 'PENDING' : 'ALL')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['online-orders', storeId, { range: '7days' }, tab === 'ALL' ? undefined : tab, 0],
    queryFn: () => listOnlineOrders({
      storeId,
      range: '7days',
      status: tab === 'ALL' ? undefined : tab,
      page: 0,
      size: 50,
    }),
    staleTime: 0,
  })

  const orders = data?.content ?? []

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'PENDING',   label: 'Pending',  count: pendingCount },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'ALL',       label: 'All (7d)' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-surface-900 border-l border-surface-700 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Online Orders</h2>
            <p className="text-surface-400 text-xs mt-0.5">Last 7 days</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-700 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition flex items-center justify-center gap-1.5
                ${tab === t.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-surface-400 hover:text-surface-200'}`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full min-w-[1.1rem] h-4.5 flex items-center justify-center px-1 leading-none py-0.5">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-16 bg-surface-800 rounded-xl animate-pulse" />)}
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-red-400 text-sm">Failed to load orders</div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5
                     a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-surface-500 text-sm">No {tab === 'ALL' ? '' : tab.toLowerCase() + ' '}orders</p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                storeId={storeId}
                storeName={storeName}
                onDone={() => {}}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
