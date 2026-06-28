import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useCartStore, cartSubtotal, cartTotal, type CartItem } from '../../store/cartStore'
import { useHeldCartsStore, type HeldCart } from '../../store/heldCartsStore'
import { useActiveStoreId } from '../../hooks/useActiveStoreId'
import { getCurrentShift, openShift, closeShift, type Shift } from '../../services/shiftService'
import { clockIn, clockOut, getAttendanceStatus } from '../../services/attendanceService'
import { createSale, getSale, voidSale, emailReceipt, type Sale, type PaymentMethod, type SalePaymentPayload } from '../../services/salesService'
import { getProductByBarcode, getProducts, getProductVariants, type Product } from '../../services/productService'
import { getCategories, type Category } from '../../services/categoryService'
import { getStore, type StoreInfo } from '../../services/storeService'
import { getCustomers, type Customer } from '../../services/customerService'
import { recordExpense, getExpensesForShift } from '../../services/expenseService'
import { getActivePromotions, type Promotion } from '../../services/promotionService'
import { createRefund } from '../../services/refundService'
import { verifyManagerPin } from '../../services/authService'
import { useOfflineQueueStore } from '../../store/offlineQueueStore'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useOnlineOrderNotifications } from '../../hooks/useOnlineOrderNotifications'
import OnlineOrdersPanel from './OnlineOrdersPanel'
import api from '../../services/api'

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(since: Date): string {
  const mins = Math.floor((Date.now() - since.getTime()) / 60_000)
  if (mins < 1) return '< 1m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Open Shift Modal ─────────────────────────────────────────────────────

function OpenShiftModal({
  storeId,
  onClose,
}: {
  storeId: number
  onClose: () => void
}) {
  const [openingFloat, setOpeningFloat] = useState('0.00')
  const qc = useQueryClient()

  const openMut = useMutation({
    mutationFn: () =>
      openShift({ storeId, openingFloat: parseFloat(openingFloat) || 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-shift', storeId] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Open Shift</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">
              Opening Float (Rs.)
            </label>
            <div className="flex items-center gap-2 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 focus-within:border-primary-500">
              <span className="text-surface-400 text-sm">Rs.</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="flex-1 bg-transparent text-white text-sm focus:outline-none"
              />
            </div>
          </div>

          {openMut.isError && (
            <p className="text-red-400 text-xs">Failed to open shift. Please try again.</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                         font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => openMut.mutate()}
              disabled={openMut.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white
                         text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {openMut.isPending ? 'Opening…' : 'Open Shift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Close Shift Modal ────────────────────────────────────────────────────

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1]

function CloseShiftModal({
  shift,
  storeId,
  onClose,
}: {
  shift: Shift
  storeId: number
  onClose: () => void
}) {
  const [denomCounts, setDenomCounts] = useState<Record<number, string>>(
    Object.fromEntries(DENOMINATIONS.map((d) => [d, ''])),
  )
  const [closeNotes, setCloseNotes] = useState('')
  const qc = useQueryClient()

  const closingCashNum = DENOMINATIONS.reduce(
    (sum, d) => sum + (parseInt(denomCounts[d]) || 0) * d,
    0,
  )

  const { data: shiftSales } = useQuery({
    queryKey: ['shift-sales-summary', shift.id],
    queryFn: async () => {
      const { data } = await api.get(`/sales/shift/${shift.id}`, { params: { page: 0, size: 200 } })
      return data.data as {
        content: Array<{ totalAmount: number; paymentMethod: string; status: string }>
        totalElements: number
      }
    },
    staleTime: 10_000,
  })

  const { data: shiftExpenses = [] } = useQuery({
    queryKey: ['shift-expenses', shift.id],
    queryFn: () => getExpensesForShift(shift.id),
    staleTime: 10_000,
  })

  const totalExpenses = shiftExpenses.reduce((sum, e) => sum + e.amount, 0)

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
          { total: 0, count: 0, byMethod: {} as Record<string, number> },
        )
    : null

  // Expected = opening float + cash sales − cash expenses paid out
  const expectedCash = shiftStats
    ? (shift.openingFloat ?? 0) + (shiftStats.byMethod['CASH'] ?? 0) - totalExpenses
    : null

  const anyDenomFilled = DENOMINATIONS.some((d) => parseInt(denomCounts[d]) > 0)
  const discrepancy = expectedCash != null && anyDenomFilled ? closingCashNum - expectedCash : null

  const closeMut = useMutation({
    mutationFn: () =>
      closeShift(shift.id, {
        storeId,
        closingCash: closingCashNum,
        notes: closeNotes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-shift', storeId] })
      onClose()
    },
  })

  const shiftDuration = formatDuration(new Date(shift.openedAt))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">Close Shift</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-surface-400 text-sm mb-5">
          Opened {new Date(shift.openedAt).toLocaleTimeString()} · {shiftDuration} ago
        </p>

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
                <span>Rs. {(amount as number).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-surface-400 border-t border-surface-700 pt-2">
              <span>Opening Float</span>
              <span className="text-white">Rs. {shift.openingFloat.toFixed(2)}</span>
            </div>
            {totalExpenses > 0 && (
              <div className="flex justify-between text-surface-500 text-xs pl-3">
                <span>Cash Expenses</span>
                <span className="text-red-400">− Rs. {totalExpenses.toFixed(2)}</span>
              </div>
            )}
            {expectedCash != null && (
              <div className="flex justify-between text-surface-300 font-medium">
                <span>Expected Cash</span>
                <span>Rs. {expectedCash.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-surface-300">Closing Cash — Denomination Count</label>
              {anyDenomFilled && (
                <span className="text-sm font-bold text-white">= Rs. {closingCashNum.toFixed(2)}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DENOMINATIONS.map((d) => (
                <div key={d} className="flex items-center gap-1 bg-surface-900 border border-surface-600 rounded-lg px-2 py-1.5">
                  <span className="text-surface-400 text-xs w-10 shrink-0">Rs.{d}</span>
                  <span className="text-surface-600 text-xs">×</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={denomCounts[d]}
                    onChange={(e) =>
                      setDenomCounts((prev) => ({ ...prev, [d]: e.target.value }))
                    }
                    placeholder="0"
                    className="flex-1 bg-transparent text-white text-xs text-right focus:outline-none w-0"
                  />
                </div>
              ))}
            </div>
            {discrepancy != null && (
              <p className={`text-xs mt-2 font-medium ${discrepancy < 0 ? 'text-red-400' : discrepancy > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {discrepancy === 0
                  ? 'Cash balanced'
                  : discrepancy > 0
                    ? `Over by Rs. ${discrepancy.toFixed(2)}`
                    : `Short by Rs. ${Math.abs(discrepancy).toFixed(2)}`}
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
            onClick={onClose}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                       font-medium py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => closeMut.mutate()}
            disabled={closeMut.isPending || !anyDenomFilled}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm
                       font-semibold py-2.5 rounded-lg transition-colors"
          >
            {closeMut.isPending ? 'Closing…' : 'Close Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Modal (with split payment) ──────────────────────────────────────

function PaymentModal({
  total,
  taxAmount,
  saleDiscount,
  items,
  storeId,
  shiftId,
  customerId,
  customer,
  isOnline,
  onSuccess,
  onCancel,
}: {
  total: number
  taxAmount: number
  saleDiscount: number
  items: CartItem[]
  storeId: number
  shiftId: number
  customerId?: number
  customer?: Customer | null
  isOnline: boolean
  onSuccess: (sale: Sale) => void
  onCancel: () => void
}) {
  const enqueue = useOfflineQueueStore((s) => s.enqueue)
  const [isSplit, setIsSplit] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [tendered, setTendered] = useState('')
  const [loyaltyPtsInput, setLoyaltyPtsInput] = useState('')
  // Split legs: up to 3 methods
  const [legs, setLegs] = useState<{ method: PaymentMethod; amount: string }[]>([
    { method: 'CASH', amount: '' },
    { method: 'CARD', amount: '' },
  ])

  const loyaltyPts = Math.min(
    parseInt(loyaltyPtsInput) || 0,
    customer?.loyaltyPoints ?? 0,
  )
  const loyaltyDiscount = loyaltyPts  // 1 pt = Rs. 1
  const effectiveTotal = Math.max(0, total - loyaltyDiscount)

  const tenderedNum = parseFloat(tendered) || 0
  const change = tenderedNum - effectiveTotal

  const splitTotal = legs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const splitRemaining = effectiveTotal - splitTotal

  const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'MOBILE', label: 'Mobile' },
  ]

  const QUICK_CASH = [
    Math.ceil(effectiveTotal),
    Math.ceil(effectiveTotal / 5) * 5,
    Math.ceil(effectiveTotal / 10) * 10,
    Math.ceil(effectiveTotal / 20) * 20,
  ]
    .filter((v, i, a) => a.indexOf(v) === i && v >= effectiveTotal)
    .slice(0, 4)

  const saleItems = items.map((i) => {
    const isManual = i.product.id <= 0
    return {
      productId: isManual ? null : i.product.id,
      quantity: i.quantity,
      discountAmount: i.discountAmount || undefined,
      manualDescription: isManual ? i.product.name : undefined,
      manualUnitPrice: isManual ? i.unitPrice : undefined,
    }
  })

  const saleMut = useMutation({
    mutationFn: async () => {
      const loyaltyPointsRedeemed = loyaltyPts > 0 ? loyaltyPts : undefined
      let payload
      if (isSplit) {
        const payments: SalePaymentPayload[] = legs
          .filter((l) => parseFloat(l.amount) > 0)
          .map((l) => ({ paymentMethod: l.method, amount: parseFloat(l.amount) }))
        payload = {
          storeId, shiftId, items: saleItems,
          paymentMethod: 'MIXED' as const,
          amountTendered: splitTotal,
          discountAmount: saleDiscount || undefined,
          customerId,
          payments,
          loyaltyPointsRedeemed,
        }
      } else {
        payload = {
          storeId, shiftId, items: saleItems,
          paymentMethod: method,
          amountTendered: method !== 'CASH' ? effectiveTotal : tenderedNum,
          discountAmount: saleDiscount || undefined,
          customerId,
          loyaltyPointsRedeemed,
        }
      }

      if (!isOnline) {
        // Queue the sale for later and return a synthetic offline receipt
        const queueId = enqueue(payload)
        const offlineSale: Sale = {
          id: -Date.now(),
          receiptNumber: `OFFLINE-${queueId.slice(-6).toUpperCase()}`,
          storeId,
          shiftId,
          cashierId: 0,
          cashierName: 'Offline',
          customerId: customerId ?? undefined,
          status: 'COMPLETED',
          paymentMethod: isSplit ? 'MIXED' : method,
          amountTendered: isSplit ? splitTotal : (method !== 'CASH' ? effectiveTotal : tenderedNum),
          changeDue: isSplit ? 0 : Math.max(0, tenderedNum - effectiveTotal),
          subtotal: total - taxAmount,
          discountAmount: saleDiscount,
          taxAmount,
          totalAmount: effectiveTotal,
          items: saleItems.map((si, idx) => ({
            id: idx,
            productId: si.productId ?? null,
            productName: items[idx]?.product.name ?? 'Item',
            variantName: undefined,
            barcode: undefined,
            manualDescription: si.manualDescription ?? undefined,
            isManual: si.productId == null,
            quantity: si.quantity,
            unitPrice: items[idx]?.unitPrice ?? 0,
            discountAmount: si.discountAmount ?? 0,
            lineTotal: (items[idx]?.unitPrice ?? 0) * si.quantity - (si.discountAmount ?? 0),
          })),
          loyaltyPointsRedeemed: loyaltyPointsRedeemed ?? undefined,
          pointsEarned: undefined,
          createdAt: new Date().toISOString(),
        }
        return offlineSale
      }

      return isSplit ? createSale(payload) : createSale(payload)
    },
    onSuccess,
  })

  const canCharge = isSplit
    ? splitTotal >= effectiveTotal && legs.some((l) => parseFloat(l.amount) > 0)
    : method !== 'CASH' || tenderedNum >= effectiveTotal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Payment</h2>
          {!isOnline && (
            <span className="flex items-center gap-1.5 bg-red-900/30 border border-red-700/50 rounded-lg px-2.5 py-1 text-xs text-red-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Offline — will sync later
            </span>
          )}
        </div>
        <div className="bg-surface-900 rounded-lg px-3 py-2.5 mb-3 space-y-1 text-sm">
          <div className="flex justify-between text-surface-400">
            <span>Subtotal</span>
            <span className="text-white">Rs. {(total - taxAmount).toFixed(2)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-surface-400">
              <span>Tax</span>
              <span className="text-white">Rs. {taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-surface-700 pt-1">
            <span className="text-surface-200">Total</span>
            <span className="text-primary-400 text-base">Rs. {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Loyalty redemption */}
        {customer && (customer.loyaltyPoints ?? 0) > 0 && (
          <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 mb-3">
            <div className="text-xs text-surface-400 mb-1.5">
              {customer.name} — <span className="text-yellow-400 font-medium">{customer.loyaltyPoints} pts available</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-surface-300 shrink-0">Redeem:</label>
              <input
                type="number"
                min="0"
                max={customer.loyaltyPoints}
                value={loyaltyPtsInput}
                onChange={(e) => setLoyaltyPtsInput(e.target.value)}
                placeholder="0"
                className="w-20 bg-surface-800 border border-surface-600 rounded px-2 py-1
                           text-white text-xs focus:outline-none focus:border-primary-500"
              />
              <span className="text-xs text-surface-400">pts</span>
              {loyaltyPts > 0 && (
                <span className="text-xs text-green-400 ml-auto">= Rs. {loyaltyPts.toFixed(2)} off</span>
              )}
            </div>
            {loyaltyPts > 0 && (
              <div className="mt-1.5 text-xs text-white">
                Effective total: <span className="font-bold text-primary-400">Rs. {effectiveTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}


        {/* Split toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setIsSplit(false)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
              ${!isSplit ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-700 border-surface-600 text-surface-300'}`}
          >
            Single
          </button>
          <button
            onClick={() => setIsSplit(true)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
              ${isSplit ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-700 border-surface-600 text-surface-300'}`}
          >
            Split
          </button>
        </div>

        {!isSplit ? (
          <>
            <div className="flex gap-2 mb-4">
              {PAYMENT_METHODS.map((m) => (
                <button key={m.value} onClick={() => setMethod(m.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${method === m.value
                      ? 'bg-primary-600 border-primary-500 text-white'
                      : 'bg-surface-700 border-surface-600 text-surface-300 hover:bg-surface-600'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {method === 'CASH' && (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-surface-300 mb-1">Amount Tendered</label>
                  <input type="number" min={effectiveTotal} step="0.01" value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={`${effectiveTotal.toFixed(2)}`} autoFocus
                    className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                               text-white text-lg font-mono focus:outline-none focus:border-primary-500"
                  />
                </div>
                {QUICK_CASH.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    {QUICK_CASH.map((v) => (
                      <button key={v} onClick={() => setTendered(v.toString())}
                        className="flex-1 text-xs py-1.5 rounded bg-surface-700 hover:bg-surface-600
                                   text-surface-300 border border-surface-600 transition-colors">
                        Rs.{v}
                      </button>
                    ))}
                  </div>
                )}
                {change >= 0 && tenderedNum > 0 && (
                  <div className="bg-primary-900/30 border border-primary-700/50 rounded-lg px-4 py-2 mb-4 flex justify-between text-sm">
                    <span className="text-primary-300">Change</span>
                    <span className="text-primary-400 font-bold">Rs. {change.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            {method !== 'CASH' && (
              <div className="mb-4 text-surface-400 text-sm">
                Amount will be charged: <span className="text-white">Rs. {total.toFixed(2)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3 mb-4">
            {legs.map((leg, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={leg.method}
                  onChange={(e) => setLegs((prev) => prev.map((l, j) => j === i ? { ...l, method: e.target.value as PaymentMethod } : l))}
                  className="bg-surface-700 border border-surface-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none"
                >
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">Rs.</span>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={leg.amount}
                    onChange={(e) => setLegs((prev) => prev.map((l, j) => j === i ? { ...l, amount: e.target.value } : l))}
                    className="w-full pl-10 pr-3 py-2 bg-surface-900 border border-surface-600 rounded-lg
                               text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
            ))}
            <div className={`flex justify-between text-sm px-1 ${splitRemaining < 0 ? 'text-green-400' : splitRemaining > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              <span>{splitRemaining > 0 ? 'Remaining' : splitRemaining < 0 ? 'Over by' : 'Balanced'}</span>
              <span>Rs. {Math.abs(splitRemaining).toFixed(2)}</span>
            </div>
          </div>
        )}

        {saleMut.isError && (
          <p className="text-red-400 text-xs mb-3">Failed to process sale. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-3 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={() => saleMut.mutate()}
            disabled={saleMut.isPending || !canCharge}
            className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40
                       disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
            {saleMut.isPending ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Receipt Modal ────────────────────────────────────────────────────────

const RECEIPT_PRINT_ID = 'pos-thermal-receipt'

function ReceiptDivider({ dashed = false }: { dashed?: boolean }) {
  return (
    <div
      style={{
        borderTop: dashed ? '1px dashed #555' : '1px solid #888',
        margin: '6px 0',
      }}
    />
  )
}

function ReceiptRow({
  label,
  value,
  bold = false,
  large = false,
  indent = false,
}: {
  label: string
  value: string
  bold?: boolean
  large?: boolean
  indent?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: bold ? 'bold' : 'normal',
        fontSize: large ? '14px' : '12px',
        paddingLeft: indent ? '12px' : 0,
        marginBottom: '2px',
      }}
    >
      <span>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function ThermalReceipt({ sale, store }: { sale: Sale; store: StoreInfo | undefined }) {
  const saleDate = new Date(sale.createdAt)
  const dateStr = saleDate.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const timeStr = saleDate.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <div
      id={RECEIPT_PRINT_ID}
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '12px',
        color: '#000',
        background: '#fff',
        width: '302px',           // 80 mm at 96 dpi
        padding: '12px 10px',
        boxSizing: 'border-box',
        lineHeight: '1.5',
      }}
    >
      {/* ── Store header ── */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>
          {store?.name ?? 'MartPOS'}
        </div>
        {store?.address && (
          <div style={{ fontSize: '11px', marginTop: '2px' }}>{store.address}</div>
        )}
        {store?.phone && (
          <div style={{ fontSize: '11px' }}>Tel: {store.phone}</div>
        )}
        {store?.email && (
          <div style={{ fontSize: '11px' }}>{store.email}</div>
        )}
      </div>

      <ReceiptDivider />

      {/* ── Invoice meta ── */}
      <div style={{ fontSize: '11px', marginBottom: '4px' }}>
        <ReceiptRow label="Receipt #" value={sale.receiptNumber} />
        <ReceiptRow label="Sale ID"   value={`#${sale.id}`} />
        <ReceiptRow label="Date"      value={dateStr} />
        <ReceiptRow label="Time"      value={timeStr} />
        <ReceiptRow label="Cashier"   value={sale.cashierName} />
        <ReceiptRow label="Payment"   value={sale.paymentMethod} />
      </div>

      <ReceiptDivider dashed />

      {/* ── Column header ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: '0 6px',
          fontSize: '11px',
          fontWeight: 'bold',
          borderBottom: '1px solid #555',
          paddingBottom: '3px',
          marginBottom: '3px',
        }}
      >
        <span>ITEM</span>
        <span style={{ textAlign: 'right' }}>QTY</span>
        <span style={{ textAlign: 'right', minWidth: '72px' }}>AMOUNT</span>
      </div>

      {/* ── Line items ── */}
      {sale.items.map((item) => (
        <div key={item.id} style={{ marginBottom: '5px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: '0 6px',
              fontSize: '12px',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.productName}{item.variantName ? ` · ${item.variantName}` : ''}
            </span>
            <span style={{ textAlign: 'right' }}>{item.quantity}</span>
            <span style={{ textAlign: 'right', minWidth: '72px' }}>
              Rs.{item.lineTotal.toFixed(2)}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#555', paddingLeft: '8px' }}>
            @ Rs.{item.unitPrice.toFixed(2)} each
            {item.discountAmount > 0 && (
              <span> | Disc: Rs.{item.discountAmount.toFixed(2)}</span>
            )}
          </div>
        </div>
      ))}

      <ReceiptDivider dashed />

      {/* ── Totals ── */}
      <div style={{ fontSize: '12px' }}>
        <ReceiptRow label="Subtotal" value={`Rs.${sale.subtotal.toFixed(2)}`} />
        {sale.discountAmount > 0 && (
          <ReceiptRow label="Discount" value={`- Rs.${sale.discountAmount.toFixed(2)}`} />
        )}
        {sale.taxAmount > 0 && (
          <ReceiptRow label="Tax" value={`Rs.${sale.taxAmount.toFixed(2)}`} />
        )}
      </div>

      <ReceiptDivider />

      <ReceiptRow
        label="TOTAL"
        value={`Rs.${sale.totalAmount.toFixed(2)}`}
        bold
        large
      />

      <ReceiptDivider />

      {/* ── Payment ── */}
      <div style={{ fontSize: '12px' }}>
        <ReceiptRow label={`Tendered (${sale.paymentMethod})`} value={`Rs.${sale.amountTendered.toFixed(2)}`} />
        {sale.changeDue > 0 && (
          <ReceiptRow label="Change Due" value={`Rs.${sale.changeDue.toFixed(2)}`} bold />
        )}
      </div>

      {/* ── Loyalty ── */}
      {((sale.loyaltyPointsRedeemed ?? 0) > 0 || (sale.pointsEarned ?? 0) > 0) && (
        <>
          <ReceiptDivider dashed />
          <div style={{ fontSize: '11px' }}>
            {(sale.loyaltyPointsRedeemed ?? 0) > 0 && (
              <ReceiptRow label="Points Redeemed" value={`-${sale.loyaltyPointsRedeemed} pts`} />
            )}
            {(sale.pointsEarned ?? 0) > 0 && (
              <ReceiptRow label="Points Earned" value={`+${sale.pointsEarned} pts`} bold />
            )}
          </div>
        </>
      )}

      <ReceiptDivider dashed />

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#444', marginTop: '6px' }}>
        <div>Thank you for your purchase!</div>
        <div style={{ marginTop: '2px' }}>Please retain this receipt for returns.</div>
        <div style={{ marginTop: '2px' }}>Goods once sold are not returnable</div>
        <div style={{ marginTop: '2px' }}>without receipt within 7 days.</div>
      </div>

      <ReceiptDivider dashed />

      <div style={{ textAlign: 'center', fontSize: '10px', color: '#888', marginTop: '4px' }}>
        Powered by MartPOS
      </div>
    </div>
  )
}

function ReceiptModal({ sale, storeId, onClose }: { sale: Sale; storeId: number; onClose: () => void }) {
  const { data: store } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(storeId),
    staleTime: 300_000,
  })

  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailAddr, setEmailAddr] = useState('')
  const emailMut = useMutation({
    mutationFn: () => emailReceipt(sale.id, emailAddr.trim()),
    onSuccess: () => { setShowEmailInput(false); setEmailAddr('') },
  })

  function handlePrint() {
    const el = document.getElementById(RECEIPT_PRINT_ID)
    if (!el) { window.print(); return }

    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) { window.print(); return }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt – ${sale.receiptNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; }
            @media print {
              @page { size: 80mm auto; margin: 0; }
              body { width: 80mm; }
            }
          </style>
        </head>
        <body>${el.outerHTML}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-900/40 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sale Complete</h2>
              <p className="text-surface-400 text-xs font-mono">{sale.receiptNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Receipt preview — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-surface-900">
          <div
            style={{
              background: '#fff',
              borderRadius: '4px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
              display: 'inline-block',
            }}
          >
            <ThermalReceipt sale={sale} store={store} />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-surface-700 shrink-0 space-y-2">
          {showEmailInput && (
            <div className="flex gap-2">
              <input
                type="email"
                value={emailAddr}
                onChange={(e) => setEmailAddr(e.target.value)}
                placeholder="customer@email.com"
                autoFocus
                className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                           text-white text-sm focus:outline-none focus:border-primary-500"
              />
              <button
                onClick={() => emailMut.mutate()}
                disabled={emailMut.isPending || !emailAddr.includes('@')}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm
                           font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {emailMut.isPending ? '…' : 'Send'}
              </button>
              <button onClick={() => setShowEmailInput(false)}
                className="text-surface-400 hover:text-white px-2 transition-colors text-sm">✕</button>
            </div>
          )}
          {emailMut.isError && <p className="text-red-400 text-xs">Failed to send email.</p>}
          {emailMut.isSuccess && <p className="text-green-400 text-xs">Receipt emailed successfully.</p>}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                         font-medium py-2.5 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => setShowEmailInput((v) => !v)}
              className="bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium
                         px-3 py-2.5 rounded-xl transition-colors"
              title="Email receipt"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold
                         py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0
                     002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Refund Modal (item-level partial refund + full void) ─────────────────────

function RefundModal({ storeId: _storeId, onClose }: { storeId: number; onClose: () => void }) {
  const currentUser = useAuthStore((s) => s.user)
  const isCashier = currentUser?.role === 'CASHIER'
  const [receiptInput, setReceiptInput] = useState('')
  const [foundSaleId, setFoundSaleId] = useState<number | null>(null)
  const [searchError, setSearchError] = useState('')
  const [done, setDone] = useState<'voided' | 'refunded' | null>(null)
  // item-level state: saleItemId → qty to refund
  const [refundQtys, setRefundQtys] = useState<Record<number, number>>({})
  const [refundReason, setRefundReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'MOBILE'>('CASH')
  const [mode, setMode] = useState<'partial' | 'void'>('partial')

  const { data: sale, isLoading: saleLoading, isError: saleNotFound } = useQuery({
    queryKey: ['refund-sale', foundSaleId],
    queryFn: () => getSale(foundSaleId!),
    enabled: foundSaleId != null,
    retry: false,
  })

  // When sale loads, initialise qty map to 0
  const prevSaleId = useRef<number | null>(null)
  useEffect(() => {
    if (sale && sale.id !== prevSaleId.current) {
      prevSaleId.current = sale.id
      const init: Record<number, number> = {}
      sale.items.forEach((it) => { init[it.id] = 0 })
      setRefundQtys(init)
    }
  }, [sale])

  const partialRefundMut = useMutation({
    mutationFn: () => createRefund({
      saleId: foundSaleId!,
      reason: refundReason || undefined,
      refundMethod,
      items: (sale?.items ?? [])
        .filter((it) => (refundQtys[it.id] ?? 0) > 0)
        .map((it) => ({ saleItemId: it.id, quantity: refundQtys[it.id] })),
    }),
    onSuccess: () => setDone('refunded'),
  })

  const voidMut = useMutation({
    mutationFn: () => voidSale(foundSaleId!, refundReason),
    onSuccess: () => setDone('voided'),
  })

  function handleSearch() {
    setSearchError('')
    setFoundSaleId(null)
    setDone(null)
    const trimmed = receiptInput.trim()
    if (!trimmed) return
    const asId = parseInt(trimmed, 10)
    if (!isNaN(asId)) setFoundSaleId(asId)
    else setSearchError('Enter the Sale ID number (found on the receipt)')
  }

  const partialTotal = sale
    ? sale.items.reduce((s, it) => s + (refundQtys[it.id] ?? 0) * it.unitPrice, 0)
    : 0
  const hasItems = Object.values(refundQtys).some((q) => q > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-surface-700 shrink-0">
          <h2 className="text-lg font-bold text-white">Process Refund</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {done ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium mb-1">
                {done === 'voided' ? 'Sale Voided' : (isCashier ? 'Refund Submitted' : 'Refund Processed')}
              </p>
              <p className="text-surface-400 text-sm">
                {done === 'voided'
                  ? 'The sale has been voided.'
                  : isCashier
                    ? 'Your refund request has been submitted for manager approval.'
                    : 'The refund has been approved and stock returned.'}
              </p>
              <button onClick={onClose} className="mt-4 text-primary-400 text-sm hover:text-primary-300">Close</button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-surface-300 mb-1">Sale ID (from receipt)</label>
                <div className="flex gap-2">
                  <input type="text" value={receiptInput}
                    onChange={(e) => setReceiptInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter sale ID…" autoFocus
                    className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                  <button onClick={handleSearch}
                    className="bg-surface-700 hover:bg-surface-600 text-white text-sm px-4 rounded-lg transition-colors">
                    Find
                  </button>
                </div>
                {searchError && <p className="text-yellow-400 text-xs mt-1">{searchError}</p>}
              </div>

              {saleLoading && <p className="text-surface-400 text-sm">Loading…</p>}

              {saleNotFound && !saleLoading && foundSaleId != null && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
                  No sale found with ID #{foundSaleId}. Check the receipt and try again.
                </p>
              )}

              {sale && !saleLoading && (
                <>
                  {/* Sale header */}
                  <div className="bg-surface-900 rounded-xl p-3 mb-4 flex items-center justify-between">
                    <span className="font-mono text-xs text-surface-400">{sale.receiptNumber}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">Rs. {sale.totalAmount.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                        ${sale.status === 'VOIDED' ? 'bg-red-900/40 text-red-300 border-red-700'
                          : 'bg-green-900/40 text-green-300 border-green-700'}`}>
                        {sale.status}
                      </span>
                    </div>
                  </div>

                  {sale.status === 'COMPLETED' && (
                    <>
                      {/* Mode tabs */}
                      <div className="flex gap-2 mb-4">
                        <button onClick={() => setMode('partial')}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
                            ${mode === 'partial' ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-700 border-surface-600 text-surface-300'}`}>
                          Partial Refund
                        </button>
                        <button onClick={() => setMode('void')}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
                            ${mode === 'void' ? 'bg-red-700 border-red-600 text-white' : 'bg-surface-700 border-surface-600 text-surface-300'}`}>
                          Full Void
                        </button>
                      </div>

                      {mode === 'partial' && (
                        <>
                          {/* Item list */}
                          <div className="space-y-2 mb-4">
                            {sale.items.map((it) => (
                              <div key={it.id} className="flex items-center gap-3 bg-surface-900 rounded-lg px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-white text-sm truncate">{it.productName}{it.variantName ? ` · ${it.variantName}` : ''}</div>
                                  <div className="text-surface-400 text-xs">
                                    {it.quantity} × Rs.{it.unitPrice.toFixed(2)} = Rs.{it.lineTotal.toFixed(2)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => setRefundQtys((p) => ({ ...p, [it.id]: Math.max(0, (p[it.id] ?? 0) - 1) }))}
                                    className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 text-white text-sm flex items-center justify-center">−</button>
                                  <span className="w-6 text-center text-sm font-mono text-white">{refundQtys[it.id] ?? 0}</span>
                                  <button onClick={() => setRefundQtys((p) => ({ ...p, [it.id]: Math.min(it.quantity, (p[it.id] ?? 0) + 1) }))}
                                    className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 text-white text-sm flex items-center justify-center">+</button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {hasItems && (
                            <div className="bg-primary-900/20 border border-primary-700/40 rounded-lg px-3 py-2 mb-4 flex justify-between text-sm">
                              <span className="text-primary-300">Refund amount</span>
                              <span className="text-primary-400 font-bold">Rs. {partialTotal.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="mb-3">
                            <label className="block text-xs font-medium text-surface-300 mb-1">Refund method</label>
                            <div className="flex gap-2">
                              {(['CASH', 'CARD', 'MOBILE'] as const).map((m) => (
                                <button key={m} onClick={() => setRefundMethod(m)}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
                                    ${refundMethod === m ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-700 border-surface-600 text-surface-300'}`}>
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="mb-4">
                        <label className="block text-xs font-medium text-surface-300 mb-1">
                          Reason {mode === 'void' ? '*' : '(optional)'}
                        </label>
                        <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                          rows={2} placeholder="Customer returned item, defective product…"
                          className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                                     text-white text-sm focus:outline-none focus:border-primary-500 resize-none"
                        />
                      </div>

                      {(partialRefundMut.isError || voidMut.isError) && (
                        <p className="text-red-400 text-xs mb-3">Failed to process refund. Try again.</p>
                      )}

                      {mode === 'partial' ? (
                        <button
                          onClick={() => partialRefundMut.mutate()}
                          disabled={partialRefundMut.isPending || !hasItems}
                          className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white
                                     text-sm font-semibold py-2.5 rounded-lg transition-colors">
                          {partialRefundMut.isPending ? 'Processing…' : `Refund Rs. ${partialTotal.toFixed(2)}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => voidMut.mutate()}
                          disabled={voidMut.isPending || !refundReason.trim()}
                          className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white
                                     text-sm font-semibold py-2.5 rounded-lg transition-colors">
                          {voidMut.isPending ? 'Processing…' : 'Void Entire Sale'}
                        </button>
                      )}
                    </>
                  )}

                  {sale.status === 'VOIDED' && (
                    <p className="text-red-400 text-sm text-center">This sale has already been voided.</p>
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

// ─── Manager Approval Modal ───────────────────────────────────────────────

function ManagerApprovalModal({
  storeId,
  reason,
  onApproved,
  onCancel,
}: {
  storeId: number
  reason: string
  onApproved: (approverName: string) => void
  onCancel: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleKey(k: string) {
    if (k === 'DEL') { setPin((p) => p.slice(0, -1)); setError(''); return }
    if (pin.length >= 6) return
    setPin((p) => p + k)
    setError('')
  }

  async function handleSubmit() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    setLoading(true)
    setError('')
    try {
      const result = await verifyManagerPin(storeId, pin)
      onApproved(result.approverName)
    } catch {
      setError('Invalid manager PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-xs p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0
                   01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-white">Manager Approval Required</h2>
          <p className="text-surface-400 text-xs mt-1">{reason}</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i < pin.length ? 'bg-primary-500' : 'bg-surface-600'
              }`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1','2','3','4','5','6','7','8','9','','0','DEL'].map((k) => (
            k === '' ? (
              <div key="empty" />
            ) : (
              <button
                key={k}
                onClick={() => handleKey(k)}
                className={`py-3 rounded-xl text-lg font-bold transition-colors
                  ${k === 'DEL'
                    ? 'bg-surface-700 hover:bg-surface-600 text-surface-300 text-sm'
                    : 'bg-surface-700 hover:bg-surface-600 active:bg-surface-500 text-white'
                  }`}
              >
                {k === 'DEL' ? '⌫' : k}
              </button>
            )
          ))}
        </div>

        {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                       font-medium py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || pin.length < 4}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white
                       text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {loading ? 'Verifying…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Custom Item Modal ────────────────────────────────────────────────────

function CustomItemModal({
  onAdd,
  onClose,
}: {
  onAdd: (description: string, price: number, qty: number) => void
  onClose: () => void
}) {
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [qty, setQty] = useState('1')
  const priceRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    priceRef.current?.focus()
  }, [])

  const priceNum = parseFloat(price) || 0
  const qtyNum  = parseInt(qty) || 1
  const lineTotal = priceNum * qtyNum

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (priceNum <= 0) return
    onAdd(description.trim() || 'Custom Item', priceNum, qtyNum)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Custom Item</h2>
          <button type="button" onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">
              Description <span className="text-surface-500">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Loose item, Service charge…"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">
              Unit Price (Rs.) <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 focus-within:border-primary-500">
              <span className="text-surface-400 text-sm">Rs.</span>
              <input
                ref={priceRef}
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-primary-500"
            />
          </div>

          {priceNum > 0 && (
            <div className="bg-surface-900 rounded-lg px-4 py-2.5 flex justify-between text-sm">
              <span className="text-surface-400">Line Total</span>
              <span className="text-primary-400 font-bold">Rs. {lineTotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                       font-medium py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={priceNum <= 0 || qtyNum <= 0}
            className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40
                       disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            Add to Cart
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Resume Modal ─────────────────────────────────────────────────────────

function ResumeModal({
  heldCarts,
  hasActiveItems,
  onResume,
  onDiscard,
  onClose,
}: {
  heldCarts: HeldCart[]
  hasActiveItems: boolean
  onResume: (cart: HeldCart) => void
  onDiscard: (id: string) => void
  onClose: () => void
}) {
  function formatHeldTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function cartItemCount(cart: HeldCart) {
    return cart.items.reduce((s, i) => s + i.quantity, 0)
  }

  function cartHeldTotal(cart: HeldCart) {
    const sub = cart.items.reduce((s, i) => s + i.lineTotal, 0)
    return Math.max(0, sub - cart.saleDiscount)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 shrink-0">
          <h2 className="text-lg font-bold text-white">Held Sales</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {heldCarts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-surface-500">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No held sales</p>
            </div>
          ) : (
            <div className="space-y-2">
              {heldCarts.map((cart) => (
                <div
                  key={cart.id}
                  className="bg-surface-900 rounded-xl p-4 flex items-center gap-4 border border-surface-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">
                      {cartItemCount(cart)} item{cartItemCount(cart) !== 1 ? 's' : ''}
                    </div>
                    <div className="text-surface-400 text-xs mt-0.5">
                      Held at {formatHeldTime(cart.heldAt)}
                    </div>
                    <div className="text-primary-400 text-sm font-bold mt-1">
                      Rs. {cartHeldTotal(cart).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onDiscard(cart.id)}
                      className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                      title="Discard"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onResume(cart)}
                      className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium
                                 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Resume
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasActiveItems && heldCarts.length > 0 && (
          <div className="px-5 pb-3 shrink-0">
            <p className="text-yellow-400 text-xs text-center">
              Resuming will replace your current cart items
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Price Check Modal ────────────────────────────────────────────────────

function PriceCheckModal({
  storeId,
  onClose,
}: {
  storeId: number
  onClose: () => void
}) {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [result, setResult] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState(false)
  const barcodeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  const barcodeMut = useMutation({
    mutationFn: (barcode: string) => getProductByBarcode(storeId, barcode),
    onSuccess: (p) => { setResult(p); setNotFound(false) },
    onError: () => { setResult(null); setNotFound(true) },
  })

  const { data: nameResults } = useQuery({
    queryKey: ['price-check-search', storeId, nameInput],
    queryFn: () => getProducts({ storeId, search: nameInput, size: 6 }),
    enabled: nameInput.length >= 2,
    staleTime: 30_000,
  })

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = barcodeInput.trim()
    if (code) {
      setNameInput('')
      setResult(null)
      setNotFound(false)
      barcodeMut.mutate(code)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 shrink-0">
          <h2 className="text-lg font-bold text-white">Price Check</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {/* Barcode */}
          <form onSubmit={handleBarcodeSubmit}>
            <label className="block text-xs font-medium text-surface-300 mb-1">Scan Barcode</label>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => { setBarcodeInput(e.target.value); setNotFound(false) }}
                placeholder="Scan or type barcode…"
                className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                           text-white text-sm focus:outline-none focus:border-primary-500"
              />
              <button
                type="submit"
                disabled={barcodeMut.isPending}
                className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white
                           text-sm px-3 rounded-lg transition-colors"
              >
                {barcodeMut.isPending ? '…' : 'Check'}
              </button>
            </div>
          </form>

          {/* Name search */}
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Search by Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setResult(null); setNotFound(false) }}
              placeholder="Type product name…"
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Not found */}
          {notFound && (
            <p className="text-red-400 text-sm text-center py-2">No product found for that barcode.</p>
          )}

          {/* Single result (from barcode) */}
          {result && (
            <div className="bg-surface-900 border border-surface-700 rounded-xl p-4 space-y-2">
              <div className="text-white font-semibold text-base leading-snug">{result.name}</div>
              {result.barcode && (
                <div className="text-xs text-surface-400 font-mono">{result.barcode}</div>
              )}
              <div className="text-primary-400 text-2xl font-bold">
                Rs. {result.sellingPrice.toFixed(2)}
              </div>
              <div className="flex items-center gap-4 text-sm pt-1 border-t border-surface-700">
                {result.categoryName && (
                  <div>
                    <span className="text-surface-400 text-xs">Category</span>
                    <div className="text-surface-200 text-sm">{result.categoryName}</div>
                  </div>
                )}
                {result.sku && (
                  <div>
                    <span className="text-surface-400 text-xs">SKU</span>
                    <div className="text-surface-300 text-sm font-mono">{result.sku}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Name search results */}
          {nameInput.length >= 2 && !result && (
            <div className="space-y-1">
              {(nameResults?.content ?? []).length === 0 ? (
                <p className="text-surface-500 text-sm text-center py-3">No products found</p>
              ) : (
                (nameResults?.content ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setResult(p); setNameInput('') }}
                    className="w-full flex items-center justify-between bg-surface-900 hover:bg-surface-800
                               border border-surface-700 rounded-lg px-3 py-2.5 transition-colors text-left"
                  >
                    <div>
                      <div className="text-white text-sm font-medium">{p.name}</div>
                      {p.categoryName && (
                        <div className="text-surface-400 text-xs mt-0.5">{p.categoryName}</div>
                      )}
                    </div>
                    <div className="text-primary-400 font-bold text-sm shrink-0 ml-3">
                      Rs. {p.sellingPrice.toFixed(2)}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Customer Lookup Modal ────────────────────────────────────────────────────

function CustomerModal({
  storeId,
  selected,
  onSelect,
  onClose,
}: {
  storeId: number
  selected: Customer | null
  onSelect: (c: Customer | null) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const { data: page } = useQuery({
    queryKey: ['pos-customers', storeId, search],
    queryFn: () => getCustomers(storeId, search || undefined, 0, 10),
    enabled: search.length >= 1 || true,
    staleTime: 30_000,
  })

  const customers = page?.content ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 shrink-0">
          <h2 className="text-lg font-bold text-white">Attach Customer</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 shrink-0">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…" autoFocus
            className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                       text-white text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {selected && (
            <button onClick={() => { onSelect(null); onClose() }}
              className="w-full text-left px-3 py-2 rounded-lg bg-red-900/20 border border-red-700/50
                         text-red-400 text-sm hover:bg-red-900/40 transition-colors mb-2">
              Remove customer
            </button>
          )}
          {customers.length === 0 && search && (
            <p className="text-surface-500 text-sm text-center py-4">No customers found</p>
          )}
          {customers.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c); onClose() }}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors
                ${selected?.id === c.id
                  ? 'bg-primary-600/20 border-primary-600/40 text-primary-300'
                  : 'bg-surface-900 border-surface-700 text-white hover:bg-surface-700'}`}>
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-surface-400 mt-0.5 flex items-center gap-3">
                {c.phone && <span>{c.phone}</span>}
                <span>{c.loyaltyPoints} pts</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Expense Modal ────────────────────────────────────────────────────────────

function ExpenseModal({
  storeId,
  shiftId,
  onClose,
}: {
  storeId: number
  shiftId: number
  onClose: () => void
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [done, setDone] = useState(false)

  const mut = useMutation({
    mutationFn: () => recordExpense({
      storeId, shiftId,
      description: description.trim(),
      amount: parseFloat(amount),
      category: category.trim() || undefined,
    }),
    onSuccess: () => setDone(true),
  })

  const canSubmit = description.trim().length > 0 && parseFloat(amount) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Record Expense</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="w-10 h-10 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Expense recorded</p>
            <button onClick={onClose} className="mt-3 text-primary-400 text-sm hover:text-primary-300">Close</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Description *</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Cleaning supplies, Snacks…" autoFocus
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Amount (Rs.) *</label>
              <div className="flex items-center gap-2 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 focus-within:border-primary-500">
                <span className="text-surface-400 text-sm">Rs.</span>
                <input type="number" min="0.01" step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Category <span className="text-surface-500">(optional)</span></label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Supplies, Utilities…"
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>

            {mut.isError && <p className="text-red-400 text-xs">Failed to record expense. Try again.</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || !canSubmit}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {mut.isPending ? 'Saving…' : 'Record'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Promotion helpers ────────────────────────────────────────────────────────

interface AppliedPromo { name: string; discount: number; detail: string }

function applyPromotions(
  items: import('../../store/cartStore').CartItem[],
  promotions: Promotion[],
): { total: number; applied: AppliedPromo[] } {
  const applied: AppliedPromo[] = []
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)

  for (const promo of promotions) {
    if (!promo.isActive) continue

    let d = 0
    let detail = ''

    if (promo.appliesTo === 'ORDER') {
      if (promo.minPurchase != null && subtotal < promo.minPurchase) continue
      if (promo.promoType === 'PERCENTAGE') {
        const raw = subtotal * (promo.discountValue / 100)
        d = promo.maxDiscount != null ? Math.min(raw, promo.maxDiscount) : raw
        detail = `${promo.discountValue}% off entire order`
      } else if (promo.promoType === 'FLAT') {
        d = Math.min(promo.discountValue, subtotal)
        detail = `Rs. ${promo.discountValue} off`
      } else if (promo.promoType === 'BOGO' && promo.buyQuantity != null && promo.getQuantity != null) {
        // ORDER-level BOGO: discount cheapest items (sort by unit price asc)
        const allItems = [...items].sort((a, b) => a.unitPrice - b.unitPrice)
        let freeLeft = 0
        for (const it of allItems) {
          const sets = Math.floor(it.quantity / (promo.buyQuantity + promo.getQuantity))
          freeLeft += sets * promo.getQuantity
        }
        const cheapest = allItems[0]
        if (cheapest && freeLeft > 0) {
          d = Math.min(freeLeft, cheapest.quantity) * cheapest.unitPrice
          detail = `${freeLeft} free item(s) — Buy ${promo.buyQuantity} Get ${promo.getQuantity}`
        }
      }

    } else if (promo.appliesTo === 'PRODUCT' && promo.targetId != null) {
      const item = items.find((i) => i.product.id === promo.targetId)
      if (!item) continue

      if (promo.promoType === 'BOGO' && promo.buyQuantity != null && promo.getQuantity != null) {
        const setSize = promo.buyQuantity + promo.getQuantity
        const sets = Math.floor(item.quantity / setSize)
        if (sets === 0) continue
        d = sets * promo.getQuantity * item.unitPrice
        detail = `${sets} × ${promo.getQuantity} free — ${item.product.name}`
      } else if (promo.promoType === 'FREE_ITEM' && promo.buyQuantity != null) {
        if (item.quantity < promo.buyQuantity) continue
        d = item.unitPrice
        detail = `1 free — ${item.product.name}`
      } else if (promo.promoType === 'PERCENTAGE') {
        // Optional minQuantity via buyQuantity field
        if (promo.buyQuantity != null && item.quantity < promo.buyQuantity) continue
        const raw = item.lineTotal * (promo.discountValue / 100)
        d = promo.maxDiscount != null ? Math.min(raw, promo.maxDiscount) : raw
        detail = `${promo.discountValue}% off ${item.product.name}`
      } else if (promo.promoType === 'FLAT') {
        if (promo.buyQuantity != null && item.quantity < promo.buyQuantity) continue
        d = Math.min(promo.discountValue, item.lineTotal)
        detail = `Rs. ${promo.discountValue} off ${item.product.name}`
      }

    } else if (promo.appliesTo === 'CATEGORY' && promo.targetId != null) {
      for (const item of items) {
        const prod = item.product as import('../../services/productService').Product
        if (prod.categoryId !== promo.targetId) continue
        if (promo.promoType === 'PERCENTAGE') {
          if (promo.buyQuantity != null && item.quantity < promo.buyQuantity) continue
          d += item.lineTotal * (promo.discountValue / 100)
        } else if (promo.promoType === 'FLAT') {
          if (promo.buyQuantity != null && item.quantity < promo.buyQuantity) continue
          d += Math.min(promo.discountValue, item.lineTotal)
        } else if (promo.promoType === 'BOGO' && promo.buyQuantity != null && promo.getQuantity != null) {
          const sets = Math.floor(item.quantity / (promo.buyQuantity + promo.getQuantity))
          if (sets > 0) d += sets * promo.getQuantity * item.unitPrice
        }
      }
      if (d <= 0) continue
      detail = `${promo.promoType === 'PERCENTAGE' ? `${promo.discountValue}%` : `Rs. ${promo.discountValue}`} off category`
    }

    if (d > 0) applied.push({ name: promo.name, discount: d, detail })
  }

  const total = Math.min(applied.reduce((s, a) => s + a.discount, 0), subtotal)
  return { total, applied }
}

/** Returns a hint string for an item when it is close to triggering a promotion. */
function getItemPromoHint(
  item: import('../../store/cartStore').CartItem,
  promotions: Promotion[],
): string | null {
  for (const promo of promotions) {
    if (!promo.isActive) continue
    if (promo.appliesTo !== 'PRODUCT' || promo.targetId !== item.product.id) continue

    if (promo.promoType === 'BOGO' && promo.buyQuantity != null && promo.getQuantity != null) {
      const setSize = promo.buyQuantity + promo.getQuantity
      const posInSet = item.quantity % setSize
      if (posInSet === 0) continue  // exact multiple — promo already applied or none yet
      const neededToBuy = promo.buyQuantity - posInSet
      if (neededToBuy > 0) {
        return `Add ${neededToBuy} more for Buy ${promo.buyQuantity} Get ${promo.getQuantity} Free`
      }
      // In the free zone of the set — promo active, show how many for the next set
      return `Add ${setSize - posInSet} more for another Buy ${promo.buyQuantity} Get ${promo.getQuantity} Free`
    } else if (promo.promoType === 'FREE_ITEM' && promo.buyQuantity != null) {
      if (item.quantity < promo.buyQuantity) {
        return `Add ${promo.buyQuantity - item.quantity} more for 1 free item`
      }
    } else if ((promo.promoType === 'PERCENTAGE' || promo.promoType === 'FLAT') && promo.buyQuantity != null) {
      if (item.quantity < promo.buyQuantity) {
        const label = promo.promoType === 'PERCENTAGE' ? `${promo.discountValue}% off` : `Rs. ${promo.discountValue} off`
        return `Add ${promo.buyQuantity - item.quantity} more for ${label}`
      }
    }
  }
  return null
}

// ─── Variant Picker Modal ─────────────────────────────────────────────────

function VariantPickerModal({
  parent,
  onSelect,
  onClose,
}: {
  parent: import('../../services/productService').Product
  onSelect: (variant: import('../../services/productService').Product) => void
  onClose: () => void
}) {
  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['variants', parent.id],
    queryFn: () => getProductVariants(parent.id),
    staleTime: 300_000,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <div>
            <h2 className="text-base font-bold text-white">Select variant</h2>
            <p className="text-surface-400 text-xs mt-0.5 truncate max-w-[220px]">{parent.name}</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="text-surface-400 text-sm text-center py-6">Loading variants…</div>
          ) : variants.length === 0 ? (
            <div className="text-surface-400 text-sm text-center py-6">No variants found</div>
          ) : (
            variants.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  bg-surface-700 hover:bg-primary-600/20 hover:border-primary-500
                  border border-surface-600 transition-all text-left"
              >
                <div>
                  <div className="text-white font-medium text-sm">{v.variantName ?? v.name}</div>
                  {v.barcode && (
                    <div className="text-surface-500 text-xs mt-0.5">{v.barcode}</div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-primary-400 font-bold text-sm">Rs. {v.sellingPrice.toFixed(2)}</div>
                  {v.currentStock != null && (
                    <div className={`text-xs mt-0.5 ${v.currentStock <= (v.lowStockThreshold ?? 0) ? 'text-red-400' : 'text-surface-400'}`}>
                      Stock: {v.currentStock}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Unit Picker Modal ────────────────────────────────────────────────────

function UnitPickerModal({
  product,
  onSelect,
  onClose,
}: {
  product: import('../../services/productService').Product
  onSelect: (qty: number) => void
  onClose: () => void
}) {
  const uPack = product.unitsPerPack ?? 1
  const pCarton = product.packsPerCarton ?? 1
  const unitsPerCarton = uPack * pCarton

  type UnitOption = { label: string; sub: string; qty: number }
  const options: UnitOption[] = [
    { label: '1 Unit', sub: `Rs. ${product.sellingPrice.toFixed(2)}`, qty: 1 },
  ]
  if (uPack > 1) {
    options.push({
      label: `1 Pack (${uPack} units)`,
      sub: `Rs. ${(product.sellingPrice * uPack).toFixed(2)}`,
      qty: uPack,
    })
  }
  if (pCarton > 1) {
    options.push({
      label: `1 Carton (${unitsPerCarton} units)`,
      sub: `Rs. ${(product.sellingPrice * unitsPerCarton).toFixed(2)}`,
      qty: unitsPerCarton,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <div>
            <h2 className="text-base font-bold text-white">Select unit</h2>
            <p className="text-surface-400 text-xs mt-0.5 truncate max-w-[220px]">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onSelect(opt.qty)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                bg-surface-700 hover:bg-primary-600/20 hover:border-primary-500
                border border-surface-600 transition-all text-left"
            >
              <span className="text-white font-medium text-sm">{opt.label}</span>
              <span className="text-primary-400 font-bold text-sm">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main PosScreen ───────────────────────────────────────────────────────

export default function PosScreen() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const storeId = useActiveStoreId()
  const cashierId = user?.id ?? 0

  const { items, saleDiscount, addItem, addManualItem, updateQty, removeItem, setItemPrice, setSaleDiscount, clearCart, restoreCart } =
    useCartStore()

  const { carts: heldCarts, holdCart, removeHeld } = useHeldCartsStore()

  // State
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false)
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [showPriceCheckModal, setShowPriceCheckModal] = useState(false)
  const [showCustomItemModal, setShowCustomItemModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showOnlineOrders, setShowOnlineOrders] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [holdFeedback, setHoldFeedback] = useState<string | null>(null)
  // Variant picker: shown when a product with variants is tapped
  const [variantPickerProduct, setVariantPickerProduct] = useState<import('../../services/productService').Product | null>(null)
  // Unit picker: shown when a multi-unit product is tapped/scanned
  const [unitPickerProduct, setUnitPickerProduct] = useState<import('../../services/productService').Product | null>(null)

  // Manager approval state
  const [managerApproval, setManagerApproval] = useState<{
    reason: string
    onApproved: (approverName: string) => void
  } | null>(null)
  const [pendingDiscount, setPendingDiscount] = useState<number | null>(null)

  const barcodeRef = useRef<HTMLInputElement>(null)
  const isOnline = useOnlineStatus()

  // Auto-focus barcode input on mount
  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

// Queries
  const { data: shift } = useQuery({
    queryKey: ['current-shift', storeId],
    queryFn: () => getCurrentShift(storeId),
    enabled: !!storeId,
    staleTime: 30_000,
  })

  const { data: activeSession } = useQuery({
    queryKey: ['attendance-status', storeId, cashierId],
    queryFn: () => getAttendanceStatus(storeId, cashierId),
    enabled: !!storeId && !!cashierId,
    staleTime: 30_000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => getCategories(storeId, true),
    staleTime: 300_000,
  })

  const { data: productsPage } = useQuery({
    queryKey: ['pos-products', storeId, selectedCategoryId, searchText],
    queryFn: () =>
      getProducts({
        storeId,
        categoryId: selectedCategoryId ?? undefined,
        search: searchText || undefined,
        onlyParents: true,
        size: 80,
      }),
    staleTime: 60_000,
  })

  const { data: activePromotions = [] } = useQuery({
    queryKey: ['active-promotions', storeId],
    queryFn: () => getActivePromotions(storeId),
    enabled: !!storeId,
    staleTime: 60_000,
  })

  const { data: storeInfo } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(storeId),
    enabled: !!storeId,
    staleTime: 300_000,
  })

  const pendingOnlineOrders = useOnlineOrderNotifications(storeId, () => {
    setShowOnlineOrders(true)
  })

  // Add a product — shows variant picker first (if variants exist), then unit picker
  function handleProductTap(product: import('../../services/productService').Product) {
    if ((product.variantCount ?? 0) > 0) {
      setVariantPickerProduct(product)
    } else {
      handleProductWithUnit(product)
    }
  }

  function handleProductWithUnit(product: import('../../services/productService').Product) {
    const hasMultiUnit = (product.unitsPerPack ?? 1) > 1 || (product.packsPerCarton ?? 1) > 1
    if (hasMultiUnit) {
      setUnitPickerProduct(product)
    } else {
      addItem(product)
    }
  }

  // Barcode lookup
  const barcodeMut = useMutation({
    mutationFn: (barcode: string) => getProductByBarcode(storeId, barcode),
    onSuccess: (product) => {
      handleProductTap(product)
      setBarcodeInput('')
      setBarcodeError(false)
      setTimeout(() => barcodeRef.current?.focus(), 50)
    },
    onError: () => {
      setBarcodeError(true)
      setBarcodeInput('')
      setTimeout(() => barcodeRef.current?.focus(), 50)
    },
  })

  // Clock In / Out mutations
  const qc = useQueryClient()

  const clockInMut = useMutation({
    mutationFn: () => clockIn(storeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-status'] }),
  })

  const clockOutMut = useMutation({
    mutationFn: () => clockOut(storeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-status'] }),
  })

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = barcodeInput.trim()
    if (code) {
      setBarcodeError(false)
      barcodeMut.mutate(code)
    }
  }

  function handleHold() {
    if (items.length === 0) return
    holdCart(items, saleDiscount)
    clearCart()
    setHoldFeedback('Sale held')
    setTimeout(() => setHoldFeedback(null), 2000)
  }

  const DISCOUNT_APPROVAL_THRESHOLD = 0.05  // 5%
  const PRICE_OVERRIDE_MAX = 100            // Rs 100 max override

  function handleDiscountChange(newDiscount: number) {
    // Admins/managers can discount freely
    if (isAdminUser || subtotal === 0) {
      setSaleDiscount(newDiscount)
      return
    }
    const pct = newDiscount / subtotal
    if (pct > DISCOUNT_APPROVAL_THRESHOLD) {
      setPendingDiscount(newDiscount)
      setManagerApproval({
        reason: `Discount of Rs. ${newDiscount.toFixed(2)} (${(pct * 100).toFixed(1)}%) exceeds 5% limit`,
        onApproved: () => {
          setSaleDiscount(newDiscount)
          setPendingDiscount(null)
          setManagerApproval(null)
        },
      })
    } else {
      setSaleDiscount(newDiscount)
    }
  }

  function handlePriceOverrideRequest(productId: number, newPrice: number) {
    const item = items.find((i) => i.product.id === productId)
    if (!item) return
    const overrideAmt = Math.abs(newPrice - item.product.sellingPrice)

    // Admins/managers can override freely within Rs 100
    if (overrideAmt > PRICE_OVERRIDE_MAX) {
      // Even admins can't exceed Rs 100 override — just silently cap
      setItemPrice(productId, item.product.sellingPrice + (newPrice > item.product.sellingPrice ? PRICE_OVERRIDE_MAX : -PRICE_OVERRIDE_MAX))
      return
    }
    if (isAdminUser) {
      setItemPrice(productId, newPrice)
      return
    }
    setManagerApproval({
      reason: `Price override: Rs. ${item.product.sellingPrice.toFixed(2)} → Rs. ${newPrice.toFixed(2)} for "${item.product.name}"`,
      onApproved: () => {
        setItemPrice(productId, newPrice)
        setManagerApproval(null)
      },
    })
  }

  function handleResume(cart: HeldCart) {
    removeHeld(cart.id)
    restoreCart(cart.items, cart.saleDiscount)
    setShowResumeModal(false)
  }

  const subtotal = cartSubtotal(items)
  const promoResult = applyPromotions(items, activePromotions)
  const promoDiscount = promoResult.total
  const effectiveDiscount = saleDiscount + promoDiscount
  const total = cartTotal(items, effectiveDiscount)
  const taxAmount = items.reduce((sum, item) => {
    if (!item.product.isTaxable) return sum
    const rate = item.product.taxRate ?? storeInfo?.taxRate ?? 0
    return sum + item.lineTotal * rate
  }, 0)
  const grandTotal = Math.max(0, total + taxAmount)
  const shiftOpen = shift?.status === 'OPEN'
  const isAdminUser = ['MASTER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role ?? '')

  const products = productsPage?.content ?? []

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'F1') {
        e.preventDefault()
        if (items.length > 0) clearCart()
      } else if (e.key === 'F2') {
        e.preventDefault()
        if (items.length > 0) handleHold()
      } else if (e.key === 'F3') {
        e.preventDefault()
        setShowResumeModal(true)
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (shiftOpen && items.length > 0) setShowPayModal(true)
      } else if (e.key === 'F9') {
        e.preventDefault()
        barcodeRef.current?.focus()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (showPayModal) setShowPayModal(false)
        else if (showResumeModal) setShowResumeModal(false)
        else if (showRefundModal) setShowRefundModal(false)
        else if (showPriceCheckModal) setShowPriceCheckModal(false)
        else if (showCustomItemModal) setShowCustomItemModal(false)
        else if (showCustomerModal) setShowCustomerModal(false)
        else if (showExpenseModal) setShowExpenseModal(false)
        else if (showCloseShiftModal) setShowCloseShiftModal(false)
        else if (showOpenShiftModal) setShowOpenShiftModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, shiftOpen, showPayModal, showResumeModal, showRefundModal, showPriceCheckModal, showCustomItemModal, showCustomerModal, showExpenseModal, showCloseShiftModal, showOpenShiftModal, clearCart, handleHold])

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">

      {/* ── Middle row: Left panel + Right panel ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══ LEFT PANEL ══ */}
        <div className="w-72 shrink-0 border-r border-surface-700 bg-surface-850 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
            <h2 className="font-semibold text-white text-sm">Current Sale</h2>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart items (scrollable) */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-surface-500 px-6 text-center">
                <svg
                  className="w-14 h-14 mb-3 opacity-30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707
                       1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-sm">Scan or tap a product to add it</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-800">
                {items.map((item) => (
                  <CartItemRow
                    key={item.product.id}
                    item={item}
                    promoHint={getItemPromoHint(item, activePromotions)}
                    onQtyChange={(qty) => updateQty(item.product.id, qty)}
                    onRemove={() => removeItem(item.product.id)}
                    onPriceOverrideRequest={handlePriceOverrideRequest}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer: totals + charge button */}
          <div className="border-t border-surface-700 p-4 space-y-2.5">
            {/* Customer badge */}
            <button
              onClick={() => setShowCustomerModal(true)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs border transition-colors
                ${selectedCustomer
                  ? 'bg-primary-900/30 border-primary-700/50 text-primary-300'
                  : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white'}`}
            >
              <span>{selectedCustomer ? `Customer: ${selectedCustomer.name}` : '+ Attach customer'}</span>
              {selectedCustomer && <span>{selectedCustomer.loyaltyPoints} pts</span>}
            </button>

            <div className="flex justify-between text-sm text-surface-300">
              <span>Subtotal</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-surface-300">
              <span>Discount Rs.</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={(pendingDiscount ?? saleDiscount) || ''}
                onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-24 bg-surface-800 border border-surface-600 rounded px-2 py-0.5
                           text-right text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            {promoResult.applied.map((a, i) => (
              <div key={i} className="flex items-start justify-between text-xs text-green-400 gap-1">
                <span className="truncate leading-tight">
                  <span className="text-green-500 mr-1">✓</span>{a.detail || a.name}
                </span>
                <span className="shrink-0 font-medium">- Rs. {a.discount.toFixed(2)}</span>
              </div>
            ))}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm text-surface-300">
                <span>Tax</span>
                <span>Rs. {taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-surface-700 pt-2 flex justify-between items-baseline">
              <span className="font-bold text-white">TOTAL</span>
              <span className="text-xl font-bold text-primary-400">Rs. {grandTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setShowPayModal(true)}
              disabled={items.length === 0 || !shiftOpen}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-40
                         disabled:cursor-not-allowed text-white font-bold text-base
                         py-3.5 rounded-xl transition-colors"
            >
              {!shiftOpen
                ? 'Open Shift First'
                : `CHARGE · Rs. ${grandTotal.toFixed(2)}`}
            </button>
            {!shiftOpen && (
              <p className="text-yellow-400 text-xs text-center">
                Open a shift to process sales
              </p>
            )}
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700 bg-surface-900">
            {/* Barcode input */}
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                              focus-within:border-primary-500 transition-colors">
                <svg
                  className="w-4 h-4 text-surface-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeError(false) }}
                  placeholder="Scan barcode or press Enter…"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-surface-500"
                />
              </div>
            </form>

            {/* Name search */}
            <div className="flex items-center gap-2 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                            focus-within:border-primary-500 transition-colors w-56">
              <svg
                className="w-4 h-4 text-surface-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by name…"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-surface-500"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText('')}
                  className="text-surface-500 hover:text-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {barcodeError && (
              <span className="text-red-400 text-xs shrink-0">Barcode not found</span>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-surface-700 scrollbar-hide shrink-0">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                ${
                  selectedCategoryId === null
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700 hover:text-white'
                }`}
            >
              All
            </button>
            {(categories as Category[]).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                  ${
                    selectedCategoryId === cat.id
                      ? 'bg-primary-600 border-primary-500 text-white'
                      : 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700 hover:text-white'
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {products.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-surface-500">
                <svg
                  className="w-12 h-12 mb-3 opacity-40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductTap(product)}
                  className="bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-primary-500
                             rounded-xl p-3 cursor-pointer transition-all active:scale-95 flex flex-col text-left"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-medium text-sm text-white line-clamp-2 leading-snug">
                      {product.name}
                    </span>
                    {(product.variantCount ?? 0) > 0 && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-600 text-surface-300 border border-surface-500">
                        {product.variantCount}v
                      </span>
                    )}
                  </div>
                  {product.barcode && (
                    <span className="text-xs text-surface-500 mt-1 truncate">{product.barcode}</span>
                  )}
                  <span className="font-bold text-primary-400 mt-auto pt-2 text-sm">
                    Rs. {product.sellingPrice.toFixed(2)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ══ KEYBOARD SHORTCUT LEGEND ══ */}
      <div className="bg-surface-900 border-t border-surface-700 px-4 py-1.5 flex gap-4 text-xs text-surface-500 shrink-0 overflow-x-auto scrollbar-hide">
        {[
          { key: 'F1', label: 'New Sale' },
          { key: 'F2', label: 'Hold' },
          { key: 'F3', label: 'Resume' },
          { key: 'F4', label: 'Pay' },
          { key: 'F9', label: 'Barcode' },
          { key: 'Esc', label: 'Close modal' },
        ].map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5 shrink-0">
            <kbd className="bg-surface-700 text-surface-300 px-1.5 py-0.5 rounded text-[10px] font-mono">{key}</kbd>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* ══ ACTION BAR ══ */}
      <div className="h-14 bg-surface-850 border-t border-surface-700 flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide shrink-0">

        {/* New Sale */}
        <button
          onClick={clearCart}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                     bg-surface-800 border-surface-600 text-white hover:bg-surface-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707
                 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          New Sale
        </button>

        {/* Custom Item */}
        <button
          onClick={() => setShowCustomItemModal(true)}
          disabled={!shiftOpen}
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            ${shiftOpen
              ? 'bg-surface-800 border-surface-600 text-white hover:bg-surface-700'
              : 'bg-surface-800 border-surface-700 text-surface-500 cursor-not-allowed'
            }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Custom Item
        </button>

        {/* Hold */}
        <button
          onClick={handleHold}
          disabled={items.length === 0}
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            ${items.length > 0
              ? 'bg-surface-800 border-surface-600 text-white hover:bg-surface-700'
              : 'bg-surface-800 border-surface-700 text-surface-500 cursor-not-allowed'
            }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Hold
        </button>

        {/* Resume */}
        <button
          onClick={() => setShowResumeModal(true)}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                     bg-surface-800 border-surface-600 text-white hover:bg-surface-700 transition-colors relative"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Resume
          {heldCarts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-600 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              {heldCarts.length}
            </span>
          )}
        </button>

        {/* Price Check */}
        <button
          onClick={() => setShowPriceCheckModal(true)}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                     bg-surface-800 border-surface-600 text-white hover:bg-surface-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Price Check
        </button>

        {/* Refund */}
        <button
          onClick={() => shiftOpen && setShowRefundModal(true)}
          disabled={!shiftOpen}
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            ${shiftOpen
              ? 'bg-surface-800 border-surface-600 text-white hover:bg-surface-700'
              : 'bg-surface-800 border-surface-700 text-surface-500 cursor-not-allowed'
            }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Refund
        </button>

        {/* Expense */}
        <button
          onClick={() => shiftOpen && setShowExpenseModal(true)}
          disabled={!shiftOpen}
          className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            ${shiftOpen
              ? 'bg-surface-800 border-surface-600 text-white hover:bg-surface-700'
              : 'bg-surface-800 border-surface-700 text-surface-500 cursor-not-allowed'
            }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Expense
        </button>

        {/* Online Orders */}
        <button
          onClick={() => setShowOnlineOrders(true)}
          className="shrink-0 relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                     bg-surface-800 border-surface-600 text-white hover:bg-surface-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5
                 a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Online Orders
          {pendingOnlineOrders > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold
                             rounded-full min-w-[1.1rem] h-4 flex items-center justify-center px-1 leading-none">
              {pendingOnlineOrders > 99 ? '99+' : pendingOnlineOrders}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-7 w-px bg-surface-700 shrink-0 mx-1" />

        {/* Clock In / Clock Out — tracks cashier's work hours */}
        {!activeSession ? (
          <button
            onClick={() => clockInMut.mutate()}
            disabled={clockInMut.isPending}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                       bg-green-900/30 border-green-700 text-green-400 hover:bg-green-900/50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {clockInMut.isPending ? 'Clocking In…' : 'Clock In'}
          </button>
        ) : (
          <button
            onClick={() => clockOutMut.mutate()}
            disabled={clockOutMut.isPending}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                       bg-yellow-900/30 border-yellow-700 text-yellow-400 hover:bg-yellow-900/50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {clockOutMut.isPending ? 'Clocking Out…' : `Clock Out · ${formatDuration(new Date(activeSession.clockedInAt))}`}
          </button>
        )}

        {/* Close Shift — manager/admin only */}
        {isAdminUser && shiftOpen && (
          <button
            onClick={() => setShowCloseShiftModal(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                       bg-red-900/30 border-red-700 text-red-400 hover:bg-red-900/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Close Shift
          </button>
        )}

        {/* Open Shift — manager/admin only, when no shift is open */}
        {isAdminUser && !shiftOpen && (
          <button
            onClick={() => setShowOpenShiftModal(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                       bg-blue-900/30 border-blue-700 text-blue-400 hover:bg-blue-900/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Open Shift
          </button>
        )}

        {/* Back-Office */}
        {isAdminUser && (
          <button
            onClick={() => navigate('/dashboard')}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border
                       bg-surface-800 border-surface-600 text-surface-300 hover:bg-surface-700 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6
                   0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back-Office
          </button>
        )}
      </div>

      {/* ══ Modals ══ */}
      {showOnlineOrders && (
        <OnlineOrdersPanel
          storeId={storeId}
          storeName={storeInfo?.name ?? 'Store'}
          pendingCount={pendingOnlineOrders}
          onClose={() => setShowOnlineOrders(false)}
        />
      )}

      {showOpenShiftModal && (
        <OpenShiftModal
          storeId={storeId}
          onClose={() => setShowOpenShiftModal(false)}
        />
      )}

      {showCloseShiftModal && shift && (
        <CloseShiftModal
          shift={shift}
          storeId={storeId}
          onClose={() => setShowCloseShiftModal(false)}
        />
      )}

      {showPayModal && shift && (
        <PaymentModal
          total={grandTotal}
          taxAmount={taxAmount}
          saleDiscount={effectiveDiscount}
          items={items}
          storeId={storeId}
          shiftId={shift.id}
          customerId={selectedCustomer?.id}
          customer={selectedCustomer}
          isOnline={isOnline}
          onSuccess={(sale) => {
            setCompletedSale(sale)
            clearCart()
            // Refresh customer points after loyalty activity
            if (sale.customerId) {
              qc.invalidateQueries({ queryKey: ['pos-customers', storeId] })
            }
            setSelectedCustomer(null)
            setShowPayModal(false)
          }}
          onCancel={() => setShowPayModal(false)}
        />
      )}

      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          storeId={storeId}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {showRefundModal && (
        <RefundModal storeId={storeId} onClose={() => setShowRefundModal(false)} />
      )}

      {showResumeModal && (
        <ResumeModal
          heldCarts={heldCarts}
          hasActiveItems={items.length > 0}
          onResume={handleResume}
          onDiscard={(id) => removeHeld(id)}
          onClose={() => setShowResumeModal(false)}
        />
      )}

      {showPriceCheckModal && (
        <PriceCheckModal storeId={storeId} onClose={() => setShowPriceCheckModal(false)} />
      )}

      {showCustomItemModal && (
        <CustomItemModal
          onAdd={(desc, price, qty) => addManualItem(desc, price, qty)}
          onClose={() => setShowCustomItemModal(false)}
        />
      )}

      {showCustomerModal && (
        <CustomerModal
          storeId={storeId}
          selected={selectedCustomer}
          onSelect={setSelectedCustomer}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {showExpenseModal && shift && (
        <ExpenseModal
          storeId={storeId}
          shiftId={shift.id}
          onClose={() => setShowExpenseModal(false)}
        />
      )}

      {/* Manager approval modal */}
      {managerApproval && (
        <ManagerApprovalModal
          storeId={storeId}
          reason={managerApproval.reason}
          onApproved={(approverName) => managerApproval.onApproved(approverName)}
          onCancel={() => {
            setManagerApproval(null)
            setPendingDiscount(null)
          }}
        />
      )}

      {/* Variant picker modal */}
      {variantPickerProduct && (
        <VariantPickerModal
          parent={variantPickerProduct}
          onSelect={(variant) => {
            setVariantPickerProduct(null)
            handleProductWithUnit(variant)
          }}
          onClose={() => setVariantPickerProduct(null)}
        />
      )}

      {/* Unit picker modal */}
      {unitPickerProduct && (
        <UnitPickerModal
          product={unitPickerProduct}
          onSelect={(qty) => {
            addItem(unitPickerProduct, qty)
            setUnitPickerProduct(null)
          }}
          onClose={() => setUnitPickerProduct(null)}
        />
      )}

      {/* Hold feedback toast */}
      {holdFeedback && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50
                        bg-surface-700 border border-surface-600 text-white text-sm font-medium
                        px-5 py-2.5 rounded-full shadow-xl animate-fade-in">
          {holdFeedback}
        </div>
      )}
    </div>
  )
}

// ─── Cart Item Row ─────────────────────────────────────────────────────────

function CartItemRow({
  item,
  promoHint,
  onQtyChange,
  onRemove,
  onPriceOverrideRequest,
}: {
  item: CartItem
  promoHint?: string | null
  onQtyChange: (qty: number) => void
  onRemove: () => void
  onPriceOverrideRequest: (productId: number, newPrice: number) => void
}) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const isOverridden = item.unitPrice !== item.product.sellingPrice && item.product.sellingPrice > 0

  function handlePriceEdit() {
    setPriceInput(item.unitPrice.toFixed(2))
    setEditingPrice(true)
  }

  function handlePriceConfirm() {
    const newPrice = parseFloat(priceInput)
    if (!newPrice || newPrice <= 0) { setEditingPrice(false); return }
    if (newPrice === item.unitPrice) { setEditingPrice(false); return }
    onPriceOverrideRequest(item.product.id, newPrice)
    setEditingPrice(false)
  }

  return (
    <div className="flex items-start gap-2 px-4 py-3 hover:bg-surface-800/50 group transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-white truncate">{item.product.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {editingPrice ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-surface-400">Rs.</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onBlur={handlePriceConfirm}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePriceConfirm(); if (e.key === 'Escape') setEditingPrice(false) }}
                autoFocus
                className="w-20 bg-surface-700 border border-primary-500 rounded px-1.5 py-0.5
                           text-white text-xs focus:outline-none"
              />
            </div>
          ) : (
            <button
              onClick={handlePriceEdit}
              className={`text-xs transition-colors ${
                isOverridden
                  ? 'text-yellow-400 hover:text-yellow-300'
                  : 'text-surface-400 hover:text-surface-300'
              }`}
              title={isOverridden ? `Original: Rs.${item.product.sellingPrice.toFixed(2)}` : 'Click to override price'}
            >
              Rs. {item.unitPrice.toFixed(2)} each
              {isOverridden && <span className="ml-1 text-yellow-500">*</span>}
            </button>
          )}
        </div>
        {promoHint && (
          <div className="text-xs text-amber-400 mt-0.5 leading-tight">{promoHint}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onQtyChange(item.quantity - 1)}
          className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 flex items-center justify-center
                     text-white text-sm font-bold transition-colors"
        >
          −
        </button>
        <span className="w-7 text-center text-sm font-mono text-white">{item.quantity}</span>
        <button
          onClick={() => onQtyChange(item.quantity + 1)}
          className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 flex items-center justify-center
                     text-white text-sm font-bold transition-colors"
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 w-20 justify-end">
        <span className="text-sm font-medium text-white">Rs.{item.lineTotal.toFixed(2)}</span>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
