import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import JsBarcode from 'jsbarcode'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'
import {
  getProducts, createProduct, updateProduct, setProductStatus,
  getProductVariants, type Product,
} from '../../services/productService'
import {
  getCategories, createCategory, type Category,
} from '../../services/categoryService'
import api from '../../services/api'

// ── Print Label Modal ─────────────────────────────────────────────────────────

function PrintLabelModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const barcodeRef = useRef<SVGSVGElement>(null)
  const [copies, setCopies] = useState(1)
  const hasBarcode = !!product.barcode

  useEffect(() => {
    if (hasBarcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, product.barcode!, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 11,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        })
      } catch {
        // Invalid barcode value — show text fallback
      }
    }
  }, [product.barcode, hasBarcode])

  function handlePrint() {
    const labelHtml = document.getElementById('label-print-area')?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=400,height=300')
    if (!win) return
    const allLabels = Array.from({ length: copies }, () => labelHtml).join('')
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label — ${product.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: white; }
            .label {
              width: 57mm; padding: 4mm;
              border: 1px solid #ccc;
              display: inline-block; vertical-align: top;
              page-break-inside: avoid;
            }
            .label-name { font-size: 13px; font-weight: bold; margin-bottom: 2px; word-break: break-word; }
            .label-sku  { font-size: 10px; color: #555; margin-bottom: 3px; }
            .label-price { font-size: 18px; font-weight: bold; margin-bottom: 3px; }
            .label-barcode { text-align: center; }
            .label-barcode svg { max-width: 100%; height: auto; }
            .no-barcode { font-size: 11px; color: #888; text-align: center; padding: 6px 0; }
            @media print {
              body { margin: 0; }
              .label { border: none; }
            }
          </style>
        </head>
        <body>${allLabels}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  return (
    <Modal open={true} title="Print Label" onClose={onClose} size="sm">
      <div className="space-y-4">
        {/* Preview */}
        <div className="bg-white rounded-xl p-4 border border-surface-600">
          <div id="label-print-area">
            <div className="label" style={{ width: '57mm', padding: '4mm', fontFamily: 'Arial, sans-serif' }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 2, wordBreak: 'break-word', color: '#000' }}>
                {product.name}
              </div>
              {product.sku && (
                <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>SKU: {product.sku}</div>
              )}
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 3, color: '#000' }}>
                Rs. {product.sellingPrice.toFixed(2)}
              </div>
              <div style={{ textAlign: 'center' }}>
                {hasBarcode ? (
                  <svg ref={barcodeRef} />
                ) : (
                  <div style={{ fontSize: 11, color: '#888', padding: '6px 0' }}>No barcode</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {!hasBarcode && (
          <p className="text-yellow-400 text-xs">
            This product has no barcode. Assign one in the product editor to print a scannable barcode.
          </p>
        )}

        {/* Copies */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-surface-300 shrink-0">Copies</label>
          <input
            type="number" min={1} max={100} value={copies}
            onChange={e => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="w-20 px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-600 text-white text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button onClick={handlePrint}
            className="flex-1 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
            Print {copies > 1 ? `${copies} Labels` : 'Label'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Required').max(150),
  categoryId: z.coerce.number().optional().nullable(),
  barcode: z.string().max(50).optional().or(z.literal('')),
  sku: z.string().max(50).optional().or(z.literal('')),
  baseUnit: z.enum(['UNIT', 'PACK', 'CARTON']),
  unitsPerPack: z.coerce.number().int().min(1, 'Min 1'),
  packsPerCarton: z.coerce.number().int().min(1, 'Min 1'),
  loyaltyMultiplier: z.coerce.number().int().min(0, 'Min 0'),
  costPrice: z.coerce.number().min(0, 'Cannot be negative'),
  sellingPrice: z.coerce.number().min(0.01, 'Must be > 0'),
  lowStockThreshold: z.coerce.number().int().min(0),
  isTaxable: z.boolean().optional(),
  taxRate: z.coerce.number().min(0).max(1).optional().nullable(),
  parentProductId: z.coerce.number().optional().nullable(),
  variantName: z.string().max(100).optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-400">{msg}</p>
}

function inputCls(error?: boolean) {
  return `w-full px-3 py-2 rounded-lg bg-surface-700 border text-white text-sm
    placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-600
    focus:border-transparent transition
    ${error ? 'border-red-500' : 'border-surface-500'}`
}

function labelCls() {
  return 'block text-sm font-medium text-surface-200 mb-1'
}

// ── Product form (used for both create and edit) ──────────────────────────────

function ProductForm({
  storeId,
  categories,
  allProducts,
  initial,
  onSuccess,
  onCancel,
}: {
  storeId: number
  categories: Category[]
  allProducts: Product[]
  initial?: Product
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!initial

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: initial
      ? {
          name: initial.name,
          categoryId: initial.categoryId ?? null,
          barcode: initial.barcode ?? '',
          sku: initial.sku ?? '',
          baseUnit: initial.baseUnit,
          unitsPerPack: initial.unitsPerPack,
          packsPerCarton: initial.packsPerCarton,
          loyaltyMultiplier: initial.loyaltyMultiplier ?? 1,
          costPrice: initial.costPrice,
          sellingPrice: initial.sellingPrice,
          lowStockThreshold: initial.lowStockThreshold,
          isTaxable: initial.isTaxable ?? false,
          taxRate: initial.taxRate ?? null,
          parentProductId: initial.parentProductId ?? null,
          variantName: initial.variantName ?? '',
        }
      : {
          baseUnit: 'UNIT',
          unitsPerPack: 1,
          packsPerCarton: 1,
          loyaltyMultiplier: 1,
          costPrice: 0,
          lowStockThreshold: 10,
          isTaxable: false,
        },
  })

  const isTaxable = watch('isTaxable')
  const watchedTaxRate = watch('taxRate')

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        categoryId: data.categoryId || null,
        barcode: data.barcode || undefined,
        sku: data.sku || undefined,
        taxRate: data.isTaxable ? (data.taxRate ?? undefined) : undefined,
        parentProductId: data.parentProductId || undefined,
        variantName: data.variantName || undefined,
      }
      return isEdit
        ? updateProduct(initial!.id, payload)
        : createProduct({ storeId, ...payload })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      onSuccess()
    },
  })

  const baseUnit = watch('baseUnit')
  const showPack = baseUnit === 'PACK' || baseUnit === 'CARTON'
  const showCarton = baseUnit === 'CARTON'

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      {/* Name */}
      <div>
        <label className={labelCls()}>Product name *</label>
        <input {...register('name')} placeholder="e.g. Coca Cola 330ml" className={inputCls(!!errors.name)} />
        <FieldError msg={errors.name?.message} />
      </div>

      {/* Category + Barcode side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls()}>Category</label>
          <select {...register('categoryId')} className={inputCls()}>
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls()}>Barcode</label>
          <input {...register('barcode')} placeholder="e.g. 5449000000996" className={inputCls(!!errors.barcode)} />
          <FieldError msg={errors.barcode?.message} />
        </div>
      </div>

      {/* SKU + Base unit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls()}>SKU</label>
          <input {...register('sku')} placeholder="e.g. COKE-330" className={inputCls()} />
        </div>
        <div>
          <label className={labelCls()}>Base unit</label>
          <select {...register('baseUnit')} className={inputCls()}>
            <option value="UNIT">UNIT (individual item)</option>
            <option value="PACK">PACK (group of units)</option>
            <option value="CARTON">CARTON (group of packs)</option>
          </select>
        </div>
      </div>

      {/* Multi-unit conversions — only shown when relevant */}
      {(showPack || showCarton) && (
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-surface-700/50 border border-surface-600">
          {showPack && (
            <div>
              <label className={labelCls()}>Units per pack</label>
              <input type="number" {...register('unitsPerPack')} className={inputCls(!!errors.unitsPerPack)} />
              <FieldError msg={errors.unitsPerPack?.message} />
            </div>
          )}
          {showCarton && (
            <div>
              <label className={labelCls()}>Packs per carton</label>
              <input type="number" {...register('packsPerCarton')} className={inputCls(!!errors.packsPerCarton)} />
              <FieldError msg={errors.packsPerCarton?.message} />
            </div>
          )}
        </div>
      )}

      {/* Prices + threshold */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls()}>Cost price *</label>
          <input type="number" step="0.01" {...register('costPrice')} className={inputCls(!!errors.costPrice)} />
          <FieldError msg={errors.costPrice?.message} />
        </div>
        <div>
          <label className={labelCls()}>Selling price *</label>
          <input type="number" step="0.01" {...register('sellingPrice')} className={inputCls(!!errors.sellingPrice)} />
          <FieldError msg={errors.sellingPrice?.message} />
        </div>
        <div>
          <label className={labelCls()}>Low stock alert</label>
          <input type="number" {...register('lowStockThreshold')} className={inputCls()} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-surface-700/50 border border-surface-600">
          <label className={labelCls()}>
            Loyalty multiplier
            <span className="ml-1 text-surface-500 font-normal">(0 = no points, 2 = double, etc.)</span>
          </label>
          <input type="number" min={0} max={10} {...register('loyaltyMultiplier')} className={inputCls(!!errors.loyaltyMultiplier)} />
          <FieldError msg={errors.loyaltyMultiplier?.message} />
        </div>
      </div>

      {/* Tax settings */}
      <div className="p-3 rounded-lg bg-surface-700/50 border border-surface-600 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isTaxable"
            {...register('isTaxable')}
            className="w-4 h-4 accent-primary-500"
          />
          <label htmlFor="isTaxable" className="text-sm font-medium text-surface-200">
            Taxable product
          </label>
        </div>
        {isTaxable && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls()} style={{ marginBottom: 0 }}>
                Product tax rate <span className="text-surface-400 text-xs font-normal">(decimal — leave blank to inherit store rate)</span>
              </label>
              {watchedTaxRate != null && !isNaN(Number(watchedTaxRate)) && Number(watchedTaxRate) > 0 && (
                <span className="text-xs font-semibold text-primary-400 ml-2 shrink-0">
                  = {(Number(watchedTaxRate) * 100).toFixed(2).replace(/\.?0+$/, '')}%
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.0001"
              min="0"
              max="1"
              placeholder="e.g. 0.13 for 13%"
              {...register('taxRate')}
              className={inputCls(!!errors.taxRate)}
            />
            <FieldError msg={errors.taxRate?.message} />
          </div>
        )}
      </div>

      {/* Variant */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls()}>Parent product <span className="text-surface-400 text-xs font-normal">(for variants)</span></label>
          <select {...register('parentProductId')} className={inputCls()}>
            <option value="">— None (standalone) —</option>
            {allProducts
              .filter((p) => !p.parentProductId && p.id !== initial?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelCls()}>Variant name <span className="text-surface-400 text-xs font-normal">(e.g. 500ml, Red)</span></label>
          <input
            {...register('variantName')}
            placeholder="e.g. 500ml"
            className={inputCls()}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-4 py-2">
          {(mutation.error as Error)?.message ?? 'Something went wrong'}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300
                     hover:bg-surface-700 text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white
                     font-medium text-sm disabled:opacity-50 transition-colors">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
        </button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const storeId = useAuthStore((s) => s.user?.storeId) ?? 1
  const qc = useQueryClient()

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [modalProduct, setModalProduct] = useState<Product | null | 'new'>(null)
  const [printLabelProduct, setPrintLabelProduct] = useState<Product | null>(null)
  const [searchNotFound, setSearchNotFound] = useState(false)
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set())
  const [variantCache, setVariantCache] = useState<Record<number, Product[]>>({})
  const [addVariantFor, setAddVariantFor] = useState<Product | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [showCatInput, setShowCatInput] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null)
  const [importLoading, setImportLoading] = useState(false)

  async function toggleVariants(parentId: number) {
    if (expandedParents.has(parentId)) {
      setExpandedParents((prev) => { const s = new Set(prev); s.delete(parentId); return s })
    } else {
      if (!variantCache[parentId]) {
        const variants = await getProductVariants(parentId)
        setVariantCache((prev) => ({ ...prev, [parentId]: variants }))
      }
      setExpandedParents((prev) => new Set(prev).add(parentId))
    }
  }

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => getCategories(storeId),
  })

  const { data: productPage, isLoading } = useQuery({
    queryKey: ['products', storeId, selectedCategoryId, search, page],
    queryFn: () => getProducts({ storeId, categoryId: selectedCategoryId, search: search || undefined, page }),
    placeholderData: (prev) => prev,
  })

  // Mutations
  const deactivateMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      setProductStatus(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const addCategoryMutation = useMutation({
    mutationFn: () => createCategory(storeId, newCatName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewCatName('')
      setShowCatInput(false)
    },
  })

  const products = productPage?.content ?? []
  const totalPages = productPage?.totalPages ?? 1
  const totalElements = productPage?.totalElements ?? 0

  // Called when scanner sends Enter — clear field if nothing found
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setSearch('')
      setSearchNotFound(false)
      setPage(0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (products.length === 0 && search.trim()) {
        setSearchNotFound(true)
        setSearch('')
        setPage(0)
        setTimeout(() => setSearchNotFound(false), 2000)
      }
    }
  }

  return (
    <div className="flex h-full">
      {/* Category sidebar */}
      <aside className="w-52 shrink-0 border-r border-surface-700 bg-surface-800 flex flex-col">
        <div className="px-4 py-4 border-b border-surface-700">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Categories</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <button
            onClick={() => { setSelectedCategoryId(undefined); setPage(0) }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors
              ${!selectedCategoryId
                ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                : 'text-surface-300 hover:bg-surface-700 hover:text-white border border-transparent'}`}
          >
            All products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategoryId(cat.id); setPage(0) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors
                ${selectedCategoryId === cat.id
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                  : 'text-surface-300 hover:bg-surface-700 hover:text-white border border-transparent'}`}
            >
              {cat.name}
            </button>
          ))}
        </nav>
        {/* Add category */}
        <div className="p-3 border-t border-surface-700">
          {showCatInput ? (
            <div className="space-y-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newCatName.trim() && addCategoryMutation.mutate()}
                placeholder="Category name"
                className="w-full px-2 py-1.5 text-xs rounded-md bg-surface-700 border border-surface-500
                           text-white placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => addCategoryMutation.mutate()}
                  disabled={!newCatName.trim() || addCategoryMutation.isPending}
                  className="flex-1 py-1 text-xs rounded-md bg-primary-600 hover:bg-primary-700 text-white
                             disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowCatInput(false); setNewCatName('') }}
                  className="flex-1 py-1 text-xs rounded-md bg-surface-700 hover:bg-surface-600
                             text-surface-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCatInput(true)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs
                         text-surface-400 hover:text-primary-400 hover:bg-surface-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add category
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-white font-semibold text-lg shrink-0">Products</h1>
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchNotFound(false); setPage(0) }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search name or barcode…"
                className={`w-full pl-9 py-2 bg-surface-700 border rounded-lg text-white text-sm
                           placeholder-surface-400 focus:outline-none focus:ring-2
                           focus:ring-primary-600 focus:border-transparent
                           ${search ? 'pr-8' : 'pr-3'}
                           ${searchNotFound ? 'border-red-500' : 'border-surface-600'}`}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setSearchNotFound(false); setPage(0) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400
                             hover:text-white transition-colors"
                  title="Clear (Esc)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {searchNotFound && (
                <p className="absolute top-full left-0 mt-1 text-xs text-red-400 whitespace-nowrap">
                  No product found for that barcode
                </p>
              )}
            </div>
            <span className="text-surface-400 text-sm shrink-0">{totalElements} items</span>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-600
                       text-surface-300 hover:bg-surface-700 text-sm transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={() => setModalProduct('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700
                       text-white text-sm font-medium transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add product
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-surface-400 text-sm">
              Loading…
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-surface-500">
              <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm">No products found</p>
              <p className="text-xs mt-1 text-surface-600">Add your first product using the button above</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-800 border-b border-surface-700 sticky top-0">
                <tr>
                  {['Product', 'Barcode / SKU', 'Category', 'Cost', 'Price', 'Tax', 'Unit', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {products.filter((p) => !p.parentProductId).map((p) => {
                  const hasVariants = (p.variantCount ?? 0) > 0
                  const isExpanded = expandedParents.has(p.id)
                  const variants = variantCache[p.id] ?? []

                  const productRow = (prod: Product, isVariant = false) => (
                    <tr
                      key={prod.id}
                      className={`transition-colors ${isVariant ? 'bg-surface-900/60 hover:bg-surface-800/60' : 'hover:bg-surface-800/50'}`}
                    >
                      <td className={`px-4 py-3 ${isVariant ? 'pl-10' : ''}`}>
                        {isVariant && (
                          <span className="inline-block w-3 h-px bg-surface-600 mr-2 align-middle" />
                        )}
                        <div className="text-white font-medium inline">
                          {prod.name}
                          {prod.variantName && (
                            <span className="ml-1.5 text-xs text-primary-400 font-normal bg-primary-900/30 px-1.5 py-0.5 rounded">
                              {prod.variantName}
                            </span>
                          )}
                          {!isVariant && hasVariants && (
                            <button
                              onClick={() => toggleVariants(p.id)}
                              className="ml-2 text-xs text-surface-400 hover:text-white bg-surface-700 hover:bg-surface-600 px-1.5 py-0.5 rounded transition-colors"
                              title={isExpanded ? 'Collapse variants' : 'Show variants'}
                            >
                              {isExpanded ? '▲' : '▼'} {p.variantCount} variant{p.variantCount !== 1 ? 's' : ''}
                            </button>
                          )}
                        </div>
                        {prod.description && !isVariant && (
                          <div className="text-surface-500 text-xs mt-0.5 truncate max-w-xs">{prod.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-300">
                        {prod.barcode && <div>{prod.barcode}</div>}
                        {prod.sku && <div className="text-xs text-surface-500">{prod.sku}</div>}
                        {!prod.barcode && !prod.sku && <span className="text-surface-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-surface-300">
                        {prod.categoryName ?? <span className="text-surface-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-surface-300">{prod.costPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-white font-medium">{prod.sellingPrice.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {prod.isTaxable ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800">
                            {prod.taxRate != null ? `${(prod.taxRate * 100).toFixed(0)}%` : 'Store rate'}
                          </span>
                        ) : (
                          <span className="text-surface-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-700 text-surface-300">
                          {prod.baseUnit}
                          {prod.baseUnit !== 'UNIT' && (
                            <span className="text-surface-500 ml-1">
                              {prod.baseUnit === 'PACK' ? `×${prod.unitsPerPack}` : `×${prod.packsPerCarton}pk`}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                          ${prod.isActive
                            ? 'bg-primary-600/20 text-primary-400'
                            : 'bg-surface-700 text-surface-500'}`}>
                          {prod.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setPrintLabelProduct(prod)}
                            className="text-surface-400 hover:text-yellow-400 transition-colors p-1"
                            title="Print Label"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2
                                   4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2
                                   2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </button>
                          {!isVariant && hasVariants && (
                            <button
                              onClick={() => setAddVariantFor(prod)}
                              className="text-surface-400 hover:text-green-400 transition-colors p-1"
                              title="Add variant"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => setModalProduct(prod)}
                            className="text-surface-400 hover:text-primary-400 transition-colors p-1"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0
                                   112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deactivateMutation.mutate({ id: prod.id, active: !prod.isActive })}
                            className={`transition-colors p-1 ${prod.isActive
                              ? 'text-surface-400 hover:text-red-400'
                              : 'text-surface-400 hover:text-primary-400'}`}
                            title={prod.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {prod.isActive ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0
                                     015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )

                  return (
                    <React.Fragment key={p.id}>
                      {productRow(p)}
                      {isExpanded && variants.map((v) => productRow(v, true))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-surface-700 flex items-center justify-between">
            <span className="text-surface-400 text-sm">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm
                           disabled:opacity-40 hover:bg-surface-600 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm
                           disabled:opacity-40 hover:bg-surface-600 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalProduct !== null}
        onClose={() => setModalProduct(null)}
        title={modalProduct === 'new' ? 'Add product' : `Edit — ${(modalProduct as Product)?.name}`}
        size="lg"
      >
        {modalProduct !== null && (
          <ProductForm
            storeId={storeId}
            categories={categories}
            allProducts={products}
            initial={modalProduct === 'new' ? undefined : (modalProduct as Product)}
            onSuccess={() => {
              const edited = modalProduct as Product
              // If editing a variant, refresh parent's variant cache
              if (edited?.parentProductId) {
                getProductVariants(edited.parentProductId).then((vs) =>
                  setVariantCache((prev) => ({ ...prev, [edited.parentProductId!]: vs }))
                )
              }
              setModalProduct(null)
            }}
            onCancel={() => setModalProduct(null)}
          />
        )}
      </Modal>

      {/* Add variant modal */}
      <Modal
        open={addVariantFor !== null}
        onClose={() => setAddVariantFor(null)}
        title={`Add variant — ${addVariantFor?.name ?? ''}`}
        size="lg"
      >
        {addVariantFor !== null && (
          <ProductForm
            storeId={storeId}
            categories={categories}
            allProducts={products}
            initial={{ parentProductId: addVariantFor.id } as unknown as Product}
            onSuccess={() => {
              // Invalidate and refresh variant cache for this parent
              setVariantCache((prev) => { const n = { ...prev }; delete n[addVariantFor.id]; return n })
              setExpandedParents((prev) => new Set(prev).add(addVariantFor.id))
              qc.invalidateQueries({ queryKey: ['products'] })
              // Eagerly reload variants
              getProductVariants(addVariantFor.id).then((vs) =>
                setVariantCache((prev) => ({ ...prev, [addVariantFor.id]: vs }))
              )
              setAddVariantFor(null)
            }}
            onCancel={() => setAddVariantFor(null)}
          />
        )}
      </Modal>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Import Products from CSV</h2>
              <button onClick={() => { setShowImportModal(false); setImportResult(null) }}
                className="text-surface-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!importResult ? (
              <div className="space-y-4">
                <div className="bg-surface-900 rounded-xl p-4 text-xs text-surface-400 space-y-1">
                  <p className="font-medium text-surface-200 mb-2">Expected CSV columns:</p>
                  <p><span className="text-white">name</span> (required)</p>
                  <p><span className="text-white">barcode</span> (optional)</p>
                  <p><span className="text-white">sku</span> (optional)</p>
                  <p><span className="text-white">sellingPrice</span> (required, numeric)</p>
                  <p><span className="text-white">costPrice</span> (optional, numeric)</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setImportLoading(true)
                    try {
                      const form = new FormData()
                      form.append('file', file)
                      const { data } = await api.post(`/products/import?storeId=${storeId}`, form, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      })
                      setImportResult(data.data)
                      qc.invalidateQueries({ queryKey: ['products'] })
                    } catch (err: unknown) {
                      const e = err as { response?: { data?: { message?: string } } }
                      setImportResult({ imported: 0, failed: -1, errors: [e?.response?.data?.message ?? 'Upload failed'] })
                    } finally {
                      setImportLoading(false)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }
                  }}
                />
                {importLoading ? (
                  <p className="text-surface-400 text-sm text-center py-4">Importing…</p>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => { setShowImportModal(false); setImportResult(null) }}
                      className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Choose File
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">{importResult.imported}</div>
                    <div className="text-xs text-surface-400 mt-1">Imported</div>
                  </div>
                  <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-400">{importResult.failed < 0 ? '!' : importResult.failed}</div>
                    <div className="text-xs text-surface-400 mt-1">Failed</div>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="bg-surface-900 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-red-400 text-xs">{e}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => { setShowImportModal(false); setImportResult(null) }}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {printLabelProduct && (
        <PrintLabelModal
          product={printLabelProduct}
          onClose={() => setPrintLabelProduct(null)}
        />
      )}
    </div>
  )
}
