import { useState, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useCartStore, cartSubtotal, cartTotal, type CartItem } from '../../store/cartStore'
import { getProductByBarcode, getProducts } from '../../services/productService'
import { getCurrentShift } from '../../services/shiftService'
import { createSale, type PaymentMethod } from '../../services/salesService'
import type { Sale } from '../../services/salesService'

// ─── Main CartScreen ───────────────────────────────────────────────────────

export default function CartScreen() {
  const user = useAuthStore((s) => s.user)
  const { items, saleDiscount, addItem, updateQty, removeItem, setSaleDiscount, clearCart } =
    useCartStore()

  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  const storeId = user?.storeId ?? 0

  // Current open shift
  const { data: shift } = useQuery({
    queryKey: ['current-shift', storeId],
    queryFn: () => getCurrentShift(storeId),
    enabled: !!storeId,
    staleTime: 30_000,
  })

  // Product search
  const { data: searchResults } = useQuery({
    queryKey: ['product-search', storeId, searchInput],
    queryFn: () => getProducts({ storeId, search: searchInput, size: 10 }),
    enabled: showSearch && searchInput.length >= 2,
    staleTime: 10_000,
  })

  // Barcode lookup
  const barcodeMut = useMutation({
    mutationFn: (barcode: string) => getProductByBarcode(storeId, barcode),
    onSuccess: (product) => {
      addItem(product)
      setBarcodeInput('')
      // Re-focus so the next scan is captured immediately
      setTimeout(() => barcodeRef.current?.focus(), 50)
    },
    onError: () => {
      setBarcodeInput('')
      setTimeout(() => barcodeRef.current?.focus(), 50)
    },
  })

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = barcodeInput.trim()
    if (code) barcodeMut.mutate(code)
  }

  const subtotal = cartSubtotal(items)
  const total = cartTotal(items, saleDiscount)

  return (
    <div className="flex h-full bg-surface-900 text-white">

      {/* ── Left: product lookup ── */}
      <div className="flex flex-col w-72 border-r border-surface-700 bg-surface-850">
        <div className="p-4 border-b border-surface-700">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">
            Add Product
          </h2>

          {/* Barcode scanner */}
          <form onSubmit={handleBarcodeSubmit}>
            <div className="relative">
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode…"
                autoFocus
                className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                           text-white text-sm pr-10 focus:outline-none focus:border-primary-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {barcodeMut.isError && (
            <p className="text-red-400 text-xs mt-1">Product not found</p>
          )}

          {/* Text search toggle */}
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="mt-2 text-primary-400 text-xs hover:text-primary-300 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search by name
          </button>
        </div>

        {/* Search results */}
        {showSearch && (
          <div className="p-4 border-b border-surface-700">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Product name…"
              className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:border-primary-500"
            />
            {searchResults && searchResults.content.length > 0 && (
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {searchResults.content.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => { addItem(p); setSearchInput(''); setShowSearch(false) }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700
                                 text-sm transition-colors"
                    >
                      <div className="font-medium text-white truncate">{p.name}</div>
                      <div className="text-surface-400 text-xs">Rs. {p.sellingPrice.toFixed(2)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchResults && searchResults.content.length === 0 && searchInput.length >= 2 && (
              <p className="text-surface-500 text-xs mt-2">No products found</p>
            )}
          </div>
        )}

        {/* Shift info */}
        <div className="p-4 mt-auto border-t border-surface-700">
          {shift ? (
            <div className="text-xs text-surface-400">
              <div>Shift #{shift.id} · Open</div>
              <div>{new Date(shift.openedAt).toLocaleTimeString()}</div>
            </div>
          ) : (
            <div className="text-xs text-yellow-400">No open shift</div>
          )}
        </div>
      </div>

      {/* ── Center: cart items ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-surface-700 flex items-center justify-between">
          <h1 className="font-bold text-lg">Current Sale</h1>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" />
              </svg>
              Clear
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-surface-500">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707
                     1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm">Scan a barcode or search to add items</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2
                            text-xs text-surface-500 uppercase tracking-wider border-b border-surface-800">
              <span>Product</span>
              <span className="text-right w-20">Price</span>
              <span className="text-right w-24">Qty</span>
              <span className="text-right w-20">Total</span>
            </div>
            {items.map((item) => (
              <CartRow
                key={item.product.id}
                item={item}
                onQtyChange={(qty) => updateQty(item.product.id, qty)}
                onRemove={() => removeItem(item.product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right: totals + payment ── */}
      <div className="w-72 flex flex-col border-l border-surface-700 bg-surface-850">
        <div className="p-4 border-b border-surface-700">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-4">
            Order Summary
          </h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-400">Subtotal</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-surface-400">Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-surface-400">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={saleDiscount || ''}
                  onChange={(e) => setSaleDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-20 bg-surface-800 border border-surface-600 rounded px-2 py-0.5
                             text-right text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
            <div className="border-t border-surface-700 pt-2 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary-400">Rs. {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 mt-auto">
          <button
            onClick={() => setShowPayModal(true)}
            disabled={items.length === 0 || !shift}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-40
                       disabled:cursor-not-allowed text-white font-bold text-base
                       py-4 rounded-xl transition-colors"
          >
            {!shift ? 'No Open Shift' : 'Charge · Rs. ' + total.toFixed(2)}
          </button>
          {!shift && (
            <p className="text-yellow-400 text-xs text-center mt-2">
              Open a shift to process sales
            </p>
          )}
        </div>
      </div>

      {/* ── Payment modal ── */}
      {showPayModal && shift && (
        <PaymentModal
          total={total}
          saleDiscount={saleDiscount}
          items={items}
          storeId={storeId}
          shiftId={shift.id}
          onSuccess={(sale) => {
            setCompletedSale(sale)
            clearCart()
            setShowPayModal(false)
          }}
          onCancel={() => setShowPayModal(false)}
        />
      )}

      {/* ── Receipt modal ── */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  )
}

// ─── CartRow ───────────────────────────────────────────────────────────────

function CartRow({
  item,
  onQtyChange,
  onRemove,
}: {
  item: CartItem
  onQtyChange: (qty: number) => void
  onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-3 border-b border-surface-800
                    items-center hover:bg-surface-800/50 group">
      <div className="min-w-0">
        <div className="font-medium text-sm truncate">{item.product.name}</div>
        {item.product.barcode && (
          <div className="text-xs text-surface-500">{item.product.barcode}</div>
        )}
      </div>

      <div className="text-right w-20 text-sm text-surface-300">
        Rs.{item.unitPrice.toFixed(2)}
      </div>

      <div className="flex items-center gap-1 w-24 justify-end">
        <button
          onClick={() => onQtyChange(item.quantity - 1)}
          className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 flex items-center justify-center
                     text-white text-sm font-bold transition-colors"
        >−</button>
        <span className="w-8 text-center text-sm font-mono">{item.quantity}</span>
        <button
          onClick={() => onQtyChange(item.quantity + 1)}
          className="w-6 h-6 rounded bg-surface-700 hover:bg-surface-600 flex items-center justify-center
                     text-white text-sm font-bold transition-colors"
        >+</button>
      </div>

      <div className="flex items-center gap-2 w-20 justify-end">
        <span className="text-sm font-medium">Rs.{item.lineTotal.toFixed(2)}</span>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── PaymentModal ──────────────────────────────────────────────────────────

function PaymentModal({
  total,
  saleDiscount,
  items,
  storeId,
  shiftId,
  onSuccess,
  onCancel,
}: {
  total: number
  saleDiscount: number
  items: CartItem[]
  storeId: number
  shiftId: number
  onSuccess: (sale: Sale) => void
  onCancel: () => void
}) {
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [tendered, setTendered] = useState('')

  const tenderedNum = parseFloat(tendered) || 0
  const change = tenderedNum - total

  const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'MOBILE', label: 'Mobile' },
  ]

  const QUICK_CASH = [
    Math.ceil(total),
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 20) * 20,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4)

  const saleMut = useMutation({
    mutationFn: () =>
      createSale({
        storeId,
        shiftId,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          discountAmount: i.discountAmount || undefined,
        })),
        paymentMethod: method,
        amountTendered: tenderedNum,
        discountAmount: saleDiscount || undefined,
      }),
    onSuccess,
  })

  const canCharge = method !== 'CASH' || tenderedNum >= total

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl
                      w-full max-w-sm mx-4 p-6">
        <h2 className="text-xl font-bold text-white mb-1">Payment</h2>
        <p className="text-surface-400 text-sm mb-6">
          Total: <span className="text-white font-bold text-lg">Rs. {total.toFixed(2)}</span>
        </p>

        {/* Payment method */}
        <div className="flex gap-2 mb-5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                ${method === m.value
                  ? 'bg-primary-600 border-primary-500 text-white'
                  : 'bg-surface-700 border-surface-600 text-surface-300 hover:bg-surface-600'
                }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Cash tendered */}
        {method === 'CASH' && (
          <>
            <div className="mb-3">
              <label className="block text-xs font-medium text-surface-300 mb-1">
                Amount Tendered
              </label>
              <input
                type="number"
                min={total}
                step="0.01"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder={`${total.toFixed(2)}`}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-lg font-mono focus:outline-none focus:border-primary-500"
                autoFocus
              />
            </div>

            {/* Quick cash buttons */}
            {QUICK_CASH.length > 0 && (
              <div className="flex gap-2 mb-4">
                {QUICK_CASH.map((v) => (
                  <button
                    key={v}
                    onClick={() => setTendered(v.toString())}
                    className="flex-1 text-xs py-1.5 rounded bg-surface-700 hover:bg-surface-600
                               text-surface-300 border border-surface-600 transition-colors"
                  >
                    Rs.{v}
                  </button>
                ))}
              </div>
            )}

            {change >= 0 && tenderedNum > 0 && (
              <div className="bg-primary-900/30 border border-primary-700/50 rounded-lg
                              px-4 py-2 mb-4 flex justify-between text-sm">
                <span className="text-primary-300">Change</span>
                <span className="text-primary-400 font-bold">Rs. {change.toFixed(2)}</span>
              </div>
            )}
          </>
        )}

        {/* For card/mobile, set tendered = total */}
        {method !== 'CASH' && !tendered && (
          <div className="mb-4 text-surface-400 text-sm">
            Amount will be charged: <span className="text-white">Rs. {total.toFixed(2)}</span>
          </div>
        )}

        {saleMut.isError && (
          <p className="text-red-400 text-xs mb-3">Failed to process sale. Please try again.</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                       font-medium py-3 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (method !== 'CASH') setTendered(total.toFixed(2))
              saleMut.mutate()
            }}
            disabled={saleMut.isPending || (method === 'CASH' && !canCharge)}
            className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40
                       disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            {saleMut.isPending ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ReceiptModal ──────────────────────────────────────────────────────────

function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  function handlePrint() {
    window.print()
    // Don't close — let the user see the receipt is still there after print
  }

  return (
    <>
      {/* Print styles — only visible when printing */}
      <style>{`
        @media print {
          body > *:not(.print-receipt) { display: none !important; }
          .print-receipt {
            display: block !important;
            position: fixed;
            inset: 0;
            background: white;
            color: black;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 16px;
            z-index: 9999;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
          {/* Success header */}
          <div className="text-center mb-4 no-print">
            <div className="w-12 h-12 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Sale Complete</h2>
          </div>

          {/* Receipt content */}
          <div className="print-receipt bg-surface-900 rounded-xl p-4 text-sm mb-4">
            {/* Store header */}
            <div className="text-center mb-3 border-b border-surface-700 pb-3">
              <div className="font-bold text-white text-base">MartPOS</div>
              <div className="text-surface-400 text-xs mt-0.5">
                {new Date(sale.createdAt).toLocaleString()}
              </div>
              <div className="text-surface-500 text-xs font-mono mt-0.5">{sale.receiptNumber}</div>
            </div>

            {/* Items */}
            <div className="space-y-1.5 mb-3">
              {sale.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span className="text-surface-300 truncate flex-1">
                    {item.productName}
                  </span>
                  <span className="text-surface-400 shrink-0">
                    {item.quantity} × Rs.{item.unitPrice.toFixed(2)}
                  </span>
                  <span className="text-white shrink-0 w-20 text-right">
                    Rs. {item.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-surface-700 pt-2 space-y-1">
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-surface-400 text-xs">
                  <span>Discount</span>
                  <span>- Rs. {sale.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span className="text-white">TOTAL</span>
                <span className="text-primary-400">Rs. {sale.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-surface-400 text-xs">
                <span>Tendered ({sale.paymentMethod})</span>
                <span>Rs. {sale.amountTendered.toFixed(2)}</span>
              </div>
              {sale.changeDue > 0 && (
                <div className="flex justify-between text-primary-300 text-xs">
                  <span>Change</span>
                  <span>Rs. {sale.changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-surface-500 text-xs mt-3 pt-3 border-t border-surface-700">
              Cashier: {sale.cashierName}
              <br />Thank you for shopping with us!
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 no-print">
            <button
              onClick={onClose}
              className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                         font-medium py-3 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold
                         py-3 rounded-xl transition-colors"
            >
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
