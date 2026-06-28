import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'
import { getProducts, getProductByBarcode, type Product } from '../../services/productService'
import {
  getAllStock, getLowStock, receiveStock, adjustStock,
  getMovements, type StockBalance, type StockMovement,
} from '../../services/inventoryService'
import api from '../../services/api'
import { downloadCsv, openPrintWindow, buildHtmlTable } from '../../utils/reportExport'

// ── Schemas ───────────────────────────────────────────────────────────────────

const receiveSchema = z.object({
  productId: z.coerce.number().min(1, 'Select a product'),
  quantity: z.coerce.number().min(0.001, 'Must be > 0'),
  receivedUnit: z.enum(['UNIT', 'PACK', 'CARTON']),
  note: z.string().optional(),
})
type ReceiveForm = z.infer<typeof receiveSchema>

const adjustSchema = z.object({
  productId: z.coerce.number().min(1, 'Select a product'),
  newQuantity: z.coerce.number().min(0, 'Cannot be negative'),
  note: z.string().min(1, 'Reason is required'),
})
type AdjustForm = z.infer<typeof adjustSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function inputCls(error?: boolean) {
  return `w-full px-3 py-2 rounded-lg bg-surface-700 border text-white text-sm
    placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-600
    focus:border-transparent transition
    ${error ? 'border-red-500' : 'border-surface-500'}`
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-400">{msg}</p>
}

function StockBadge({ balance }: { balance: StockBalance }) {
  if (balance.quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                       bg-red-900/40 text-red-400 border border-red-800">
        Out of stock
      </span>
    )
  }
  if (balance.isLowStock) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                       bg-yellow-900/40 text-yellow-400 border border-yellow-800">
        Low stock
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                     bg-primary-900/40 text-primary-400 border border-primary-800">
      OK
    </span>
  )
}

const MOVEMENT_LABELS: Record<string, string> = {
  RECEIVE: 'Receive',
  SALE: 'Sale',
  ADJUSTMENT: 'Adjustment',
  RETURN: 'Return',
  VOID: 'Void',
}

const MOVEMENT_COLORS: Record<string, string> = {
  RECEIVE: 'text-primary-400',
  SALE: 'text-blue-400',
  ADJUSTMENT: 'text-yellow-400',
  RETURN: 'text-purple-400',
  VOID: 'text-surface-400',
}

// ── Receive Stock form ────────────────────────────────────────────────────────

function ReceiveStockForm({
  storeId,
  products,
  onSuccess,
  onCancel,
}: {
  storeId: number
  products: Product[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ReceiveForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(receiveSchema) as any,
    defaultValues: { receivedUnit: 'UNIT', quantity: 1 },
  })

  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)

  const selectedId = Number(watch('productId'))
  const selectedProduct = products.find((p) => p.id === selectedId)

  // Barcode scan → auto-select product in dropdown
  const barcodeLookup = useMutation({
    mutationFn: (barcode: string) => getProductByBarcode(storeId, barcode),
    onSuccess: (product) => {
      setValue('productId', product.id as any)
      setBarcodeInput('')
      setBarcodeError('')
      setTimeout(() => barcodeRef.current?.focus(), 50)
    },
    onError: () => {
      setBarcodeError('Barcode not found')
      setBarcodeInput('')
      setTimeout(() => barcodeRef.current?.focus(), 50)
    },
  })

  function handleBarcodeScan(e: React.FormEvent) {
    e.preventDefault()
    const code = barcodeInput.trim()
    if (code) {
      setBarcodeError('')
      barcodeLookup.mutate(code)
    }
  }

  const mutation = useMutation({
    mutationFn: (data: ReceiveForm) =>
      receiveStock({ storeId, ...data, note: data.note || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      onSuccess()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      {/* Barcode scan field */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">
          Scan barcode
          <span className="ml-2 text-xs text-surface-400 font-normal">or select product below</span>
        </label>
        <form onSubmit={handleBarcodeScan} className="flex gap-2">
          <input
            ref={barcodeRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeError('') }}
            placeholder="Scan or type barcode…"
            autoFocus
            className={`flex-1 px-3 py-2 rounded-lg bg-surface-700 border text-white text-sm
              placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-600
              focus:border-transparent transition
              ${barcodeError ? 'border-red-500' : 'border-surface-500'}`}
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-surface-600 hover:bg-surface-500 text-surface-200
                       text-sm transition-colors border border-surface-500"
          >
            Find
          </button>
        </form>
        {barcodeError && <p className="mt-1 text-xs text-red-400">{barcodeError}</p>}
        {selectedProduct && (
          <p className="mt-1 text-xs text-primary-400">
            Selected: {selectedProduct.name}
            {selectedProduct.barcode ? ` · ${selectedProduct.barcode}` : ''}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">Product *</label>
        <select {...register('productId')} className={inputCls(!!errors.productId)}>
          <option value="">— Select a product —</option>
          {products.filter((p) => p.isActive).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.barcode ? ` (${p.barcode})` : ''}
            </option>
          ))}
        </select>
        <FieldError msg={errors.productId?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Quantity *</label>
          <input type="number" step="0.001" {...register('quantity')} className={inputCls(!!errors.quantity)} />
          <FieldError msg={errors.quantity?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Received as</label>
          <select {...register('receivedUnit')} className={inputCls()}>
            <option value="UNIT">UNIT</option>
            <option value="PACK">PACK</option>
            <option value="CARTON">CARTON</option>
          </select>
        </div>
      </div>

      {/* Conversion hint */}
      {selectedProduct && watch('quantity') > 0 && (
        <div className="text-xs text-surface-400 bg-surface-700/50 rounded-lg px-3 py-2">
          {(() => {
            const qty = Number(watch('quantity'))
            const unit = watch('receivedUnit')
            let base = qty
            if (unit === 'PACK') base = qty * selectedProduct.unitsPerPack
            if (unit === 'CARTON') base = qty * selectedProduct.packsPerCarton * selectedProduct.unitsPerPack
            return `→ ${base.toLocaleString()} base unit${base !== 1 ? 's' : ''} will be added to stock`
          })()}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">Note</label>
        <input {...register('note')} placeholder="e.g. Supplier delivery #1042" className={inputCls()} />
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          {(mutation.error as Error)?.message ?? 'Failed to receive stock'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300
                     hover:bg-surface-700 text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white
                     font-medium text-sm disabled:opacity-50 transition-colors">
          {mutation.isPending ? 'Saving…' : 'Receive stock'}
        </button>
      </div>
    </form>
  )
}

// ── Adjust Stock form ─────────────────────────────────────────────────────────

function AdjustStockForm({
  storeId,
  products,
  initial,
  onSuccess,
  onCancel,
}: {
  storeId: number
  products: Product[]
  initial?: StockBalance
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<AdjustForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(adjustSchema) as any,
    defaultValues: {
      productId: initial?.productId,
      newQuantity: initial?.quantity,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: AdjustForm) => adjustStock({ storeId, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      onSuccess()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">Product *</label>
        <select {...register('productId')} className={inputCls(!!errors.productId)} disabled={!!initial}>
          <option value="">— Select a product —</option>
          {products.filter((p) => p.isActive).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <FieldError msg={errors.productId?.message} />
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">New quantity (base units) *</label>
        <input type="number" step="0.001" {...register('newQuantity')} className={inputCls(!!errors.newQuantity)} />
        {initial && (
          <p className="mt-1 text-xs text-surface-400">Current: {initial.quantity} units</p>
        )}
        <FieldError msg={errors.newQuantity?.message} />
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">Reason *</label>
        <input {...register('note')} placeholder="e.g. Physical count correction" className={inputCls(!!errors.note)} />
        <FieldError msg={errors.note?.message} />
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          {(mutation.error as Error)?.message ?? 'Failed to adjust stock'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300
                     hover:bg-surface-700 text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="px-5 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white
                     font-medium text-sm disabled:opacity-50 transition-colors">
          {mutation.isPending ? 'Saving…' : 'Save adjustment'}
        </button>
      </div>
    </form>
  )
}

// ── Barcode label printing (bwip-js CODE128) ─────────────────────────────────

async function printBarcodeLabel(s: StockBalance, sellingPrice?: number) {
  const win = window.open('', '_blank', 'width=320,height=250')
  if (!win) return

  const priceStr = sellingPrice != null ? `Rs. ${sellingPrice.toFixed(2)}` : ''

  // Generate CODE128 barcode SVG using bwip-js if barcode present
  let barcodeSvg = ''
  if (s.productBarcode) {
    try {
      const bwipjs = await import('bwip-js/browser')
      const canvas = document.createElement('canvas')
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: s.productBarcode,
        scale: 2,
        height: 12,
        includetext: true,
        textxalign: 'center',
      })
      barcodeSvg = `<img src="${canvas.toDataURL()}" style="max-width:100%;margin-top:4px;" />`
    } catch {
      barcodeSvg = `<div style="font-size:11px;letter-spacing:2px;font-family:monospace;margin-top:4px;">
        ||||| ${s.productBarcode} |||||</div>`
    }
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Label – ${s.productName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            background: #fff;
            color: #000;
            width: 62mm;
            padding: 4mm;
          }
          .name  { font-size: 13px; font-weight: bold; margin-bottom: 2px; word-break: break-word; }
          .price { font-size: 20px; font-weight: bold; margin: 4px 0; }
          @media print {
            @page { size: 62mm 45mm; margin: 0; }
            body  { width: 62mm; }
          }
        </style>
      </head>
      <body>
        <div class="name">${s.productName}</div>
        ${priceStr ? `<div class="price">${priceStr}</div>` : ''}
        ${barcodeSvg}
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveModal = null | 'receive' | { type: 'adjust'; balance: StockBalance }
type Tab = 'stock' | 'movements'

export default function InventoryPage() {
  const storeId = useAuthStore((s) => s.user?.storeId) ?? 1
  const [tab, setTab] = useState<Tab>('stock')
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [stockPage, setStockPage] = useState(0)
  const [movPage, setMovPage] = useState(0)
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [showReorderModal, setShowReorderModal] = useState(false)
  const qcMain = useQueryClient()

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['stock', storeId, showLowOnly, stockPage],
    queryFn: () => showLowOnly ? getLowStock(storeId) : getAllStock(storeId, stockPage),
  })

  const { data: movData, isLoading: movLoading } = useQuery({
    queryKey: ['movements', storeId, movPage],
    queryFn: () => getMovements(storeId, undefined, movPage),
    enabled: tab === 'movements',
  })

  const { data: productsPage } = useQuery({
    queryKey: ['products', storeId],
    queryFn: () => getProducts({ storeId, size: 200 }),
  })
  const products = productsPage?.content ?? []

  const stock = stockData?.content ?? []
  const stockTotalPages = stockData?.totalPages ?? 1
  const lowStockCount = stock.filter((s) => s.isLowStock).length

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-xl">Inventory</h1>
          <p className="text-surface-400 text-sm mt-0.5">
            {stockData?.totalElements ?? 0} products tracked · {lowStockCount} low stock
          </p>
        </div>
        <div className="flex gap-2">
          {stock.length > 0 && (
            <>
              <button
                onClick={() => {
                  const header = ['Product', 'Barcode', 'Category', 'Quantity', 'Low Stock Threshold', 'Status']
                  const rows = stock.map(s => [
                    s.productName,
                    s.productBarcode ?? '',
                    s.categoryName ?? '',
                    String(s.quantity),
                    String(s.lowStockThreshold),
                    s.quantity === 0 ? 'Out of stock' : s.isLowStock ? 'Low stock' : 'OK',
                  ])
                  downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-600
                           text-surface-300 hover:bg-surface-700 hover:text-white text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => {
                  const today = new Date().toLocaleDateString()
                  const table = buildHtmlTable(
                    ['Product', 'Barcode', 'Category', { label: 'Quantity', align: 'r' }, { label: 'Threshold', align: 'r' }, 'Status'],
                    stock.map(s => [
                      s.productName,
                      s.productBarcode ?? '—',
                      s.categoryName ?? '—',
                      String(s.quantity),
                      String(s.lowStockThreshold),
                      s.quantity === 0 ? 'Out of stock' : s.isLowStock ? 'Low stock' : 'OK',
                    ]),
                  )
                  const bodyHtml = `<h1>Inventory Report${showLowOnly ? ' — Low Stock' : ''}</h1><p class="meta">As of ${today} &nbsp;·&nbsp; ${stock.length} products &nbsp;·&nbsp; ${stock.filter(s => s.isLowStock).length} low stock</p>${table}`
                  openPrintWindow('Inventory Report', bodyHtml)
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-600
                           text-surface-300 hover:bg-surface-700 hover:text-white text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / PDF
              </button>
            </>
          )}
          <button
            onClick={() => setActiveModal({ type: 'adjust', balance: undefined as any })}
            className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300
                       hover:bg-surface-700 text-sm transition-colors"
          >
            Adjust stock
          </button>
          <button
            onClick={() => setShowReorderModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-yellow-700
                       bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Auto Reorder
          </button>
          <button
            onClick={() => setActiveModal('receive')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600
                       hover:bg-primary-700 text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Receive stock
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700 gap-6">
        {(['stock', 'movements'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t
                ? 'text-primary-400 border-primary-500'
                : 'text-surface-400 border-transparent hover:text-surface-200'}`}
          >
            {t === 'stock' ? 'Stock levels' : 'Movement log'}
          </button>
        ))}
      </div>

      {/* Stock levels tab */}
      {tab === 'stock' && (
        <>
          {/* Filter */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLowOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${!showLowOnly ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                               : 'text-surface-400 hover:text-white border border-transparent'}`}
            >
              All products
            </button>
            <button
              onClick={() => setShowLowOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${showLowOnly ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                              : 'text-surface-400 hover:text-white border border-transparent'}`}
            >
              Low stock only
            </button>
          </div>

          {/* Table */}
          <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
            {stockLoading ? (
              <div className="flex items-center justify-center h-32 text-surface-400 text-sm">Loading…</div>
            ) : stock.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-surface-500 text-sm">
                {showLowOnly ? 'No low stock items 🎉' : 'No stock data yet — receive some stock first'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-surface-700">
                  <tr>
                    {['Product', 'Category', 'Qty (units)', 'Threshold', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold
                                             text-surface-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {stock.map((s) => (
                    <tr key={`${s.storeId}-${s.productId}`}
                        className={`transition-colors
                          ${s.quantity === 0 ? 'bg-red-900/10 hover:bg-red-900/20'
                            : s.isLowStock ? 'bg-yellow-900/10 hover:bg-yellow-900/20'
                            : 'hover:bg-surface-700/30'}`}>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{s.productName}</div>
                        {s.productBarcode && (
                          <div className="text-surface-500 text-xs">{s.productBarcode}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-400">
                        {s.categoryName ?? <span className="text-surface-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-semibold
                          ${s.quantity === 0 ? 'text-red-400'
                            : s.isLowStock ? 'text-yellow-400'
                            : 'text-white'}`}>
                          {Number(s.quantity).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-400">{s.lowStockThreshold}</td>
                      <td className="px-4 py-3"><StockBadge balance={s} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => {
                              const prod = products.find((p) => p.id === s.productId)
                              printBarcodeLabel(s, prod?.sellingPrice)
                            }}
                            className="text-xs text-surface-400 hover:text-yellow-400 transition-colors
                                       px-2 py-1 rounded hover:bg-surface-700"
                            title="Print label"
                          >
                            Label
                          </button>
                          <button
                            onClick={() => setActiveModal({ type: 'adjust', balance: s })}
                            className="text-xs text-surface-400 hover:text-primary-400 transition-colors
                                       px-2 py-1 rounded hover:bg-surface-700"
                          >
                            Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!showLowOnly && stockTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-surface-400 text-sm">Page {stockPage + 1} of {stockTotalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setStockPage((p) => p - 1)} disabled={stockPage === 0}
                  className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm
                             disabled:opacity-40 hover:bg-surface-600 transition-colors">Previous</button>
                <button onClick={() => setStockPage((p) => p + 1)} disabled={stockPage >= stockTotalPages - 1}
                  className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm
                             disabled:opacity-40 hover:bg-surface-600 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Movements tab */}
      {tab === 'movements' && (
        <>
          {(movData?.content ?? []).length > 0 && (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  const movs = movData?.content ?? []
                  const header = ['Type', 'Product', 'Qty Change', 'Before', 'After', 'Note', 'Date']
                  const rows = movs.map((m: StockMovement) => [
                    MOVEMENT_LABELS[m.movementType] ?? m.movementType,
                    m.productName,
                    Number(m.quantity) >= 0 ? `+${Number(m.quantity).toFixed(3)}` : Number(m.quantity).toFixed(3),
                    Number(m.quantityBefore).toFixed(1),
                    Number(m.quantityAfter).toFixed(1),
                    m.note ?? '',
                    new Date(m.createdAt).toLocaleString(),
                  ])
                  downloadCsv(`movements-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-600
                           text-surface-300 hover:bg-surface-700 hover:text-white text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => {
                  const movs = movData?.content ?? []
                  const table = buildHtmlTable(
                    ['Type', 'Product', { label: 'Qty Change', align: 'r' }, 'Before → After', 'Note', 'Date'],
                    movs.map((m: StockMovement) => [
                      MOVEMENT_LABELS[m.movementType] ?? m.movementType,
                      m.productName,
                      Number(m.quantity) >= 0 ? `+${Number(m.quantity).toFixed(3)}` : Number(m.quantity).toFixed(3),
                      `${Number(m.quantityBefore).toFixed(1)} → ${Number(m.quantityAfter).toFixed(1)}`,
                      m.note ?? '—',
                      new Date(m.createdAt).toLocaleString(),
                    ]),
                  )
                  openPrintWindow('Inventory Movements', `<h1>Inventory Movement Log</h1><p class="meta">Generated ${new Date().toLocaleString()} &nbsp;·&nbsp; ${movs.length} entries</p>${table}`)
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-600
                           text-surface-300 hover:bg-surface-700 hover:text-white text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / PDF
              </button>
            </div>
          )}
          <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
          {movLoading ? (
            <div className="flex items-center justify-center h-32 text-surface-400 text-sm">Loading…</div>
          ) : (movData?.content ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-32 text-surface-500 text-sm">
              No movements recorded yet
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-surface-700">
                  <tr>
                    {['Type', 'Product', 'Qty change', 'Before → After', 'Note', 'When'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold
                                             text-surface-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {(movData?.content ?? []).map((m: StockMovement) => (
                    <tr key={m.id} className="hover:bg-surface-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`font-medium ${MOVEMENT_COLORS[m.movementType] ?? 'text-surface-300'}`}>
                          {MOVEMENT_LABELS[m.movementType] ?? m.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">{m.productName}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-semibold
                          ${Number(m.quantity) >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                          {Number(m.quantity) >= 0 ? '+' : ''}{Number(m.quantity).toFixed(3)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-400 font-mono text-xs">
                        {Number(m.quantityBefore).toFixed(1)} → {Number(m.quantityAfter).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-surface-400 max-w-xs truncate">
                        {m.note ?? <span className="text-surface-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(movData?.totalPages ?? 1) > 1 && (
                <div className="px-4 py-3 border-t border-surface-700 flex justify-between items-center">
                  <span className="text-surface-400 text-sm">Page {movPage + 1}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setMovPage((p) => p - 1)} disabled={movPage === 0}
                      className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm
                                 disabled:opacity-40 hover:bg-surface-600 transition-colors">Previous</button>
                    <button onClick={() => setMovPage((p) => p + 1)}
                      disabled={movPage >= (movData?.totalPages ?? 1) - 1}
                      className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm
                                 disabled:opacity-40 hover:bg-surface-600 transition-colors">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </>
      )}

      {/* Receive stock modal */}
      <Modal
        open={activeModal === 'receive'}
        onClose={() => setActiveModal(null)}
        title="Receive stock"
      >
        <ReceiveStockForm
          storeId={storeId}
          products={products}
          onSuccess={() => setActiveModal(null)}
          onCancel={() => setActiveModal(null)}
        />
      </Modal>

      {/* Adjust stock modal */}
      <Modal
        open={activeModal !== null && activeModal !== 'receive'}
        onClose={() => setActiveModal(null)}
        title="Adjust stock"
      >
        {activeModal !== null && activeModal !== 'receive' && (
          <AdjustStockForm
            storeId={storeId}
            products={products}
            initial={activeModal.balance}
            onSuccess={() => setActiveModal(null)}
            onCancel={() => setActiveModal(null)}
          />
        )}
      </Modal>

      {/* Auto-reorder modal */}
      {showReorderModal && (
        <AutoReorderModal
          storeId={storeId}
          onClose={() => setShowReorderModal(false)}
          onSuccess={() => {
            setShowReorderModal(false)
            qcMain.invalidateQueries({ queryKey: ['stock'] })
          }}
        />
      )}
    </div>
  )
}

// ── Auto-reorder modal ────────────────────────────────────────────────────────

function AutoReorderModal({
  storeId,
  onClose,
  onSuccess,
}: {
  storeId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState<string | null>(null)

  const { data: suppliersPage } = useQuery({
    queryKey: ['suppliers', storeId],
    queryFn: async () => {
      const { data } = await api.get('/suppliers', { params: { storeId, size: 100 } })
      return data.data as { content: Array<{ id: number; name: string }> }
    },
    staleTime: 60_000,
  })
  const suppliers = suppliersPage?.content ?? []

  const mut = useMutation({
    mutationFn: () =>
      api.post('/purchase-orders/from-low-stock', {
        storeId,
        supplierId: parseInt(supplierId),
        notes: notes.trim() || undefined,
      }).then((r) => r.data.data as { poNumber: string }),
    onSuccess: (po) => setDone(po.poNumber),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Auto Reorder</h2>
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
            <p className="text-white font-medium mb-1">Purchase Order Created</p>
            <p className="text-surface-400 text-sm font-mono">{done}</p>
            <p className="text-surface-500 text-xs mt-2">Go to Purchase Orders to review and place the order.</p>
            <button onClick={onSuccess} className="mt-4 text-primary-400 text-sm hover:text-primary-300">Close</button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-surface-400 text-sm">
              Creates a draft Purchase Order for all products currently below their low-stock threshold.
            </p>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Supplier *</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500">
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Notes (optional)</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Urgent restock"
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            {mut.isError && (
              <p className="text-red-400 text-xs">
                {(mut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create order'}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || !supplierId}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                {mut.isPending ? 'Creating…' : 'Create PO'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
