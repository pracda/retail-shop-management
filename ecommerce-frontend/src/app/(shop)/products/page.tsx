'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { getProducts, getCategories, type CatalogProduct } from '@/services/catalogService'
import { addToCart, type Cart } from '@/services/cartService'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'

export default function ProductsPage() {
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()
  const setItemCount = useCartStore((s) => s.setItemCount)
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [page, setPage] = useState(0)
  const [addingId, setAddingId] = useState<number | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['ec-categories'],
    queryFn: getCategories,
    staleTime: 5 * 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ec-products', search, categoryId, page],
    queryFn: () => getProducts({ search: search || undefined, categoryId, page, size: 12 }),
    placeholderData: (prev) => prev,
  })

  const [addError, setAddError] = useState<string | null>(null)

  const addMut = useMutation({
    mutationFn: ({ productId, qty }: { productId: number; qty: number }) =>
      addToCart(productId, qty),
    onSuccess: (cart) => {
      setItemCount(cart.itemCount)
      qc.invalidateQueries({ queryKey: ['ec-cart'] })
      setAddError(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to add to cart'
      setAddError(msg)
      setTimeout(() => setAddError(null), 3000)
    },
  })

  async function handleAddToCart(product: CatalogProduct) {
    if (!isLoggedIn()) { router.push('/auth/login'); return }
    setAddingId(product.id)
    // Increment existing quantity rather than resetting to 1
    const cached = qc.getQueryData<Cart>(['ec-cart'])
    const existing = cached?.items.find((i) => i.productId === product.id)
    const newQty = (existing?.quantity ?? 0) + 1
    try {
      await addMut.mutateAsync({ productId: product.id, qty: newQty })
    } catch {
      // error handled in onError
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div>
      {addError && (
        <div className="mb-4 px-4 py-2.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
          {addError}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Products</h1>
        <p className="text-gray-400 text-sm">
          {data ? `${data.totalElements} products available` : 'Loading…'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5
                       text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-500 shrink-0" />
          <select
            value={categoryId ?? ''}
            onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white
                       focus:outline-none focus:border-primary-500"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-xl aspect-square animate-pulse" />
          ))}
        </div>
      ) : data && data.content.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.content.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onAddToCart={handleAddToCart}
                adding={addingId === p.id}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white
                           disabled:opacity-40 hover:border-gray-600 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page + 1} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.last}
                className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white
                           disabled:opacity-40 hover:border-gray-600 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-1">No products found</p>
          <p className="text-sm">Try a different search or category</p>
        </div>
      )}
    </div>
  )
}
