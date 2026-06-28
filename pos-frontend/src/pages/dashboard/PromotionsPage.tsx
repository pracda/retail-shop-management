import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import Modal from '../../components/ui/Modal'
import {
  getPromotions, createPromotion, updatePromotion, togglePromotion,
  type Promotion,
} from '../../services/promotionService'
import { getProducts, getProduct, type Product } from '../../services/productService'
import { getCategories } from '../../services/categoryService'

const PROMO_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage %' },
  { value: 'FLAT',       label: 'Flat Amount' },
  { value: 'BOGO',       label: 'Buy X Get Y Free' },
  { value: 'FREE_ITEM',  label: 'Free Item (Buy N Get 1 Free)' },
]

const APPLIES_TO = [
  { value: 'ORDER',    label: 'Entire Order' },
  { value: 'PRODUCT',  label: 'Specific Product' },
  { value: 'CATEGORY', label: 'Category' },
]

function promoStatusLabel(p: Promotion): { label: string; cls: string } {
  const now = Date.now()
  if (!p.isActive) return { label: 'Inactive', cls: 'bg-surface-700 text-surface-400 border-surface-600' }
  if (p.endsAt && new Date(p.endsAt).getTime() < now)
    return { label: 'Expired', cls: 'bg-orange-900/30 text-orange-400 border-orange-700/40' }
  if (new Date(p.startsAt).getTime() > now)
    return { label: 'Scheduled', cls: 'bg-blue-900/30 text-blue-400 border-blue-700/40' }
  return { label: 'Active', cls: 'bg-green-900/30 text-green-400 border-green-700/30' }
}

// ─── Product Search Picker ────────────────────────────────────────────────────

function ProductPicker({
  storeId,
  value,       // currently selected product
  onChange,
}: {
  storeId: number
  value: Product | null
  onChange: (p: Product | null) => void
}) {
  const [search, setSearch] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data } = useQuery({
    queryKey: ['products-picker', storeId, search],
    queryFn: () => getProducts({ storeId, search: search || undefined, size: 30 }),
    enabled: open,
    staleTime: 30_000,
  })

  const products = data?.content ?? []

  function select(p: Product) {
    onChange(p)
    setSearch(p.name)
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setSearch('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600
                      focus-within:border-primary-500 transition-colors">
        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={e => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }}
          placeholder="Search product by name..."
          className="flex-1 bg-transparent text-white text-sm placeholder-surface-400 focus:outline-none"
        />
        {value && (
          <button type="button" onClick={clear} className="text-surface-400 hover:text-white shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {value && (
        <p className="text-xs text-primary-400 mt-1">
          Selected: <span className="font-medium">{value.name}</span>
          {value.sellingPrice != null && <span className="text-surface-400 ml-1">(Rs. {value.sellingPrice.toFixed(2)})</span>}
        </p>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-800 border border-surface-600 rounded-xl shadow-2xl overflow-hidden">
          {products.length === 0 ? (
            <div className="px-4 py-3 text-surface-400 text-sm">
              {search ? 'No products found' : 'Start typing to search...'}
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-surface-700">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(p) }}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-700 text-left transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{p.name}</p>
                    {p.categoryName && <p className="text-surface-400 text-xs">{p.categoryName}</p>}
                  </div>
                  <span className="text-surface-300 text-sm shrink-0 ml-2">Rs. {p.sellingPrice.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Promotion Form ────────────────────────────────────────────────────────────

function PromotionForm({
  storeId, initial, onSuccess, onCancel,
}: {
  storeId: number
  initial?: Promotion
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const now = new Date().toISOString().slice(0, 16)

  const [form, setForm] = useState({
    name:          initial?.name ?? '',
    description:   initial?.description ?? '',
    promoType:     initial?.promoType ?? 'PERCENTAGE',
    discountValue: String(initial?.discountValue ?? ''),
    minPurchase:   String(initial?.minPurchase ?? ''),
    maxDiscount:   String(initial?.maxDiscount ?? ''),
    appliesTo:     initial?.appliesTo ?? 'ORDER',
    buyQuantity:   String(initial?.buyQuantity ?? ''),
    getQuantity:   String(initial?.getQuantity ?? ''),
    startsAt:      initial?.startsAt ? new Date(initial.startsAt).toISOString().slice(0, 16) : now,
    endsAt:        initial?.endsAt ? new Date(initial.endsAt).toISOString().slice(0, 16) : '',
    isActive:      initial?.isActive ?? true,
  })

  // Selected product/category for target
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initial?.appliesTo === 'CATEGORY' && initial.targetId ? String(initial.targetId) : ''
  )
  const [error, setError] = useState('')

  // Pre-load the product when editing a PRODUCT-scoped promotion
  const { data: initialProduct } = useQuery({
    queryKey: ['product', initial?.targetId],
    queryFn: () => getProduct(initial!.targetId!),
    enabled: !!initial?.targetId && initial.appliesTo === 'PRODUCT',
    staleTime: 300_000,
  })
  useEffect(() => {
    if (initialProduct && !selectedProduct) setSelectedProduct(initialProduct)
  }, [initialProduct])

  const isBogo     = form.promoType === 'BOGO'
  const isFreeItem = form.promoType === 'FREE_ITEM'
  const isBogoLike = isBogo || isFreeItem
  const needsProduct  = form.appliesTo === 'PRODUCT'
  const needsCategory = form.appliesTo === 'CATEGORY'

  // Fetch categories for the category selector
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => getCategories(storeId, true),
    staleTime: 300_000,
    enabled: needsCategory,
  })

  const mut = useMutation({
    mutationFn: () => {
      // discountValue is 0 for BOGO/FREE_ITEM since the discount is computed from unit price
      const discountValue = isBogoLike ? 0 : Number(form.discountValue)

      const targetId = needsProduct
        ? (selectedProduct?.id ?? undefined)
        : needsCategory
        ? (selectedCategoryId ? Number(selectedCategoryId) : undefined)
        : undefined

      const payload = {
        storeId,
        name:          form.name,
        description:   form.description || undefined,
        promoType:     form.promoType,
        discountValue,
        minPurchase:   form.minPurchase ? Number(form.minPurchase) : undefined,
        maxDiscount:   form.maxDiscount ? Number(form.maxDiscount) : undefined,
        appliesTo:     form.appliesTo,
        targetId,
        buyQuantity:   isBogoLike && form.buyQuantity ? Number(form.buyQuantity) : undefined,
        getQuantity:   isBogo && form.getQuantity ? Number(form.getQuantity) : undefined,
        startsAt:      new Date(form.startsAt).toISOString(),
        endsAt:        form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        isActive:      form.isActive,
      } as Omit<Promotion, 'id' | 'createdAt'>

      return initial ? updatePromotion(initial.id, payload) : createPromotion(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions', storeId] })
      qc.invalidateQueries({ queryKey: ['active-promotions', storeId] })
      onSuccess()
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(e.response?.data?.error?.message ?? 'Error saving promotion')
    },
  })

  function validate(): boolean {
    if (!form.name.trim()) { setError('Name is required'); return false }
    if (!isBogoLike && !form.discountValue) { setError('Discount value is required'); return false }
    if (!form.startsAt) { setError('Start date is required'); return false }
    if (isBogoLike && !form.buyQuantity) { setError('Buy quantity is required'); return false }
    if (isBogo && !form.getQuantity) { setError('Get free quantity is required'); return false }
    if (needsProduct && !selectedProduct) { setError('Please select a product'); return false }
    if (needsCategory && !selectedCategoryId) { setError('Please select a category'); return false }
    setError('')
    return true
  }

  function inp(cls = '') {
    return `w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-white text-sm
      placeholder-surface-400 focus:outline-none focus:border-primary-500 ${cls}`
  }

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  // Preview text
  function previewText(): string {
    if (isBogo && form.buyQuantity && form.getQuantity) {
      const target = selectedProduct ? ` on ${selectedProduct.name}` : ''
      return `Buy ${form.buyQuantity}, get ${form.getQuantity} free${target} — applied per set of ${Number(form.buyQuantity) + Number(form.getQuantity)} items`
    }
    if (isFreeItem && form.buyQuantity) {
      const target = selectedProduct ? ` on ${selectedProduct.name}` : ''
      return `Buy ${form.buyQuantity}${target} → 1 free item`
    }
    if (form.promoType === 'PERCENTAGE' && form.discountValue) {
      const targetStr = selectedProduct
        ? ` on ${selectedProduct.name}${form.buyQuantity ? ` (min qty ${form.buyQuantity})` : ''}`
        : form.minPurchase ? ` on orders over Rs. ${form.minPurchase}` : ''
      return `${form.discountValue}% off${targetStr}`
    }
    if (form.promoType === 'FLAT' && form.discountValue) {
      const targetStr = selectedProduct
        ? ` on ${selectedProduct.name}${form.buyQuantity ? ` (min qty ${form.buyQuantity})` : ''}`
        : ''
      return `Rs. ${form.discountValue} flat discount${targetStr}`
    }
    return ''
  }

  const preview = previewText()

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (validate()) mut.mutate() }}
      className="space-y-4"
    >
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1">Promotion Name *</label>
        <input value={form.name} onChange={set('name')} className={inp()}
          placeholder="e.g. Buy 2 Get 1 Free – Coke" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1">Description</label>
        <textarea value={form.description} onChange={set('description')}
          className={`${inp()} resize-none`} rows={2}
          placeholder="Optional internal note" />
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1">Promotion Type *</label>
        <select
          value={form.promoType}
          onChange={e => {
            const newType = e.target.value
            const newIsBogoLike = newType === 'BOGO' || newType === 'FREE_ITEM'
            setForm(f => ({
              ...f,
              promoType: newType,
              // BOGO/FREE_ITEM can't apply to an entire order — switch to PRODUCT
              appliesTo: newIsBogoLike && f.appliesTo === 'ORDER' ? 'PRODUCT' : f.appliesTo,
            }))
          }}
          className={inp()}
        >
          {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Discount value — hidden for BOGO / FREE_ITEM */}
      {!isBogoLike && (
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">
            {form.promoType === 'PERCENTAGE' ? 'Discount % *' : 'Discount Amount (Rs.) *'}
          </label>
          <input type="number" min="0.01" step="0.01" value={form.discountValue}
            onChange={set('discountValue')} className={inp()}
            placeholder={form.promoType === 'PERCENTAGE' ? 'e.g. 10 for 10%' : 'e.g. 50'} />
        </div>
      )}

      {/* Applies To */}
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1">Applies To</label>
        <select
          value={form.appliesTo}
          onChange={e => {
            setForm(f => ({ ...f, appliesTo: e.target.value }))
            setSelectedProduct(null)
            setSelectedCategoryId('')
          }}
          className={inp()}
        >
          {APPLIES_TO
            .filter(a => !(isBogoLike && a.value === 'ORDER'))
            .map(a => <option key={a.value} value={a.value}>{a.label}</option>)
          }
        </select>
        {isBogoLike && (
          <p className="text-xs text-surface-500 mt-1">
            BOGO and Free Item promotions must target a specific product or category
          </p>
        )}
      </div>

      {/* Product picker */}
      {needsProduct && (
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Product *</label>
          <ProductPicker storeId={storeId} value={selectedProduct} onChange={setSelectedProduct} />
        </div>
      )}

      {/* Category picker */}
      {needsCategory && (
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Category *</label>
          <select value={selectedCategoryId}
            onChange={e => setSelectedCategoryId(e.target.value)} className={inp()}>
            <option value="">— Select category —</option>
            {categories.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* BOGO / FREE_ITEM quantities */}
      {isBogoLike && (
        <div className="p-3 bg-surface-900 rounded-xl border border-surface-600 space-y-3">
          <p className="text-xs text-surface-400">
            {isBogo
              ? 'e.g. Buy Qty=2, Get Free=1 → customer buys 3 items, pays for 2'
              : 'Customer gets 1 free item after buying the required quantity'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Buy Quantity *</label>
              <input type="number" min="1" step="1" value={form.buyQuantity}
                onChange={set('buyQuantity')} className={inp()} placeholder="e.g. 2" />
            </div>
            {isBogo && (
              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">Get Free Quantity *</label>
                <input type="number" min="1" step="1" value={form.getQuantity}
                  onChange={set('getQuantity')} className={inp()} placeholder="e.g. 1" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Min qty trigger (PERCENTAGE/FLAT on PRODUCT) */}
      {!isBogoLike && needsProduct && (
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">
            Min Quantity to Trigger
            <span className="text-surface-500 font-normal ml-1">(optional — leave blank to always apply)</span>
          </label>
          <input type="number" min="1" step="1" value={form.buyQuantity}
            onChange={set('buyQuantity')} className={inp()} placeholder="e.g. 3" />
        </div>
      )}

      {/* Min purchase + Max discount (for ORDER-level promos) */}
      {!needsProduct && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Min Order Amount</label>
            <input type="number" min="0" step="0.01" value={form.minPurchase}
              onChange={set('minPurchase')} className={inp()} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Max Discount Cap</label>
            <input type="number" min="0" step="0.01" value={form.maxDiscount}
              onChange={set('maxDiscount')} className={inp()} placeholder="Optional" />
          </div>
        </div>
      )}

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Starts At *</label>
          <input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} className={inp()} />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Ends At</label>
          <input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} className={inp()} />
        </div>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="bg-primary-900/20 border border-primary-700/40 rounded-xl px-4 py-3 text-xs text-primary-300">
          <span className="font-semibold">Preview: </span>{preview}
          {form.maxDiscount ? ` (max Rs. ${form.maxDiscount})` : ''}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={mut.isPending}
          className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
          {mut.isPending ? 'Saving...' : (initial ? 'Update Promotion' : 'Create Promotion')}
        </button>
      </div>
    </form>
  )
}

// ─── Promotions Page ───────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const user = useAuthStore(s => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)
  const qc = useQueryClient()

  const [page, setPage] = useState(0)
  const [modalType, setModalType] = useState<null | 'create' | 'edit'>(null)
  const [selected, setSelected] = useState<Promotion | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', storeId, page],
    queryFn: () => getPromotions(storeId, page, 20),
  })

  const toggleMut = useMutation({
    mutationFn: togglePromotion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions', storeId] })
      qc.invalidateQueries({ queryKey: ['active-promotions', storeId] })
    },
  })

  function promoTypeLabel(type: string): string {
    return PROMO_TYPES.find(t => t.value === type)?.label ?? type
  }

  function discountLabel(p: Promotion): string {
    if (p.promoType === 'BOGO')      return `Buy ${p.buyQuantity ?? '?'} Get ${p.getQuantity ?? '?'} Free`
    if (p.promoType === 'FREE_ITEM') return `Buy ${p.buyQuantity ?? '?'} Get 1 Free`
    if (p.promoType === 'PERCENTAGE') return `${p.discountValue}% off`
    return `Rs. ${p.discountValue} off`
  }

  function appliesToLabel(p: Promotion): string {
    if (p.appliesTo === 'ORDER') return 'Entire Order'
    if (p.appliesTo === 'CATEGORY') return `Category #${p.targetId}`
    if (p.appliesTo === 'PRODUCT') return `Product #${p.targetId}`
    return p.appliesTo
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Promotions</h1>
          <p className="text-surface-400 text-sm mt-1">
            Create discounts, BOGO deals, and free items — auto-applied at checkout
          </p>
        </div>
        <button
          onClick={() => { setSelected(null); setModalType('create') }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Promotion
        </button>
      </div>

      {/* Quick-start hint */}
      <div className="mb-5 bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3 text-xs text-blue-300">
        <span className="font-semibold">How it works:</span> Select type, optionally target a specific product or category,
        set quantities for BOGO deals — promotions auto-apply when items are scanned at the POS.
      </div>

      {isLoading ? (
        <div className="text-surface-400 py-8 text-center">Loading...</div>
      ) : (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-850">
              <tr>
                {['Name', 'Type', 'Discount', 'Applies To', 'Period', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {(data?.content ?? []).map(p => {
                const { label: statusLabel, cls: statusCls } = promoStatusLabel(p)
                return (
                  <tr key={p.id} className="hover:bg-surface-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium text-sm">{p.name}</div>
                      {p.description && (
                        <div className="text-surface-400 text-xs mt-0.5 truncate max-w-48">{p.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-surface-300 text-sm">{promoTypeLabel(p.promoType)}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{discountLabel(p)}</td>
                    <td className="px-4 py-3 text-surface-400 text-xs">{appliesToLabel(p)}</td>
                    <td className="px-4 py-3 text-surface-400 text-xs">
                      <div>{new Date(p.startsAt).toLocaleDateString()}</div>
                      {p.endsAt && <div>→ {new Date(p.endsAt).toLocaleDateString()}</div>}
                      {!p.endsAt && <div className="text-surface-600">No end date</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(p); setModalType('edit') }}
                          className="text-primary-400 hover:text-primary-300 text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleMut.mutate(p.id)}
                          className={`text-xs font-medium ${p.isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                        >
                          {p.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(data?.content ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                    No promotions yet — click "+ New Promotion" to create one
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
              <span className="text-surface-400 text-sm">Page {(data?.page ?? 0) + 1} of {data?.totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={data?.last}
                  className="px-3 py-1 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalType && (
        <Modal
          open={true}
          title={modalType === 'create' ? 'New Promotion' : 'Edit Promotion'}
          onClose={() => setModalType(null)}
        >
          <PromotionForm
            storeId={storeId}
            initial={modalType === 'edit' ? selected ?? undefined : undefined}
            onSuccess={() => setModalType(null)}
            onCancel={() => setModalType(null)}
          />
        </Modal>
      )}
    </div>
  )
}
