'use client'
import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingCart, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { getProduct } from '@/services/catalogService'
import { addToCart } from '@/services/cartService'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()
  const setItemCount = useCartStore((s) => s.setItemCount)
  const qc = useQueryClient()

  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['ec-product', id],
    queryFn: () => getProduct(Number(id)),
    retry: false,
  })

  const [addError, setAddError] = useState<string | null>(null)

  const addMut = useMutation({
    mutationFn: () => {
      // Increment existing quantity rather than resetting to the picker value
      const cached = qc.getQueryData<import('@/services/cartService').Cart>(['ec-cart'])
      const existing = cached?.items.find((i) => i.productId === Number(id))
      const newQty = (existing?.quantity ?? 0) + qty
      return addToCart(Number(id), newQty)
    },
    onSuccess: (cart) => {
      setItemCount(cart.itemCount)
      qc.invalidateQueries({ queryKey: ['ec-cart'] })
      setAdded(true)
      setAddError(null)
      setTimeout(() => setAdded(false), 2000)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to add to cart'
      setAddError(msg)
      setTimeout(() => setAddError(null), 3000)
    },
  })

  function handleAdd() {
    if (!isLoggedIn()) { router.push('/auth/login'); return }
    addMut.mutate()
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-32 bg-gray-800 rounded" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-800 rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-800 rounded w-3/4" />
            <div className="h-4 bg-gray-800 rounded w-1/2" />
            <div className="h-16 bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">Product not found.</p>
        <Link href="/products" className="text-primary-400 hover:text-primary-300 text-sm">
          ← Back to products
        </Link>
      </div>
    )
  }

  const outOfStock = !product.inStock || product.currentStock <= 0
  const maxQty = Math.min(product.currentStock, 20)

  return (
    <div>
      <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-gray-400
                                        hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to products
      </Link>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Image */}
        <div className="aspect-square bg-gray-800 rounded-xl flex items-center justify-center text-gray-600">
          <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {product.categoryName && (
            <span className="text-primary-400 text-sm font-medium mb-2">{product.categoryName}</span>
          )}
          <h1 className="text-2xl font-bold text-white mb-3">{product.name}</h1>

          <div className="text-3xl font-bold text-white mb-4">
            Rs. {product.sellingPrice.toFixed(2)}
          </div>

          {product.description && (
            <p className="text-gray-300 text-sm leading-relaxed mb-6">{product.description}</p>
          )}

          {/* Stock status */}
          {outOfStock ? (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-6">
              <AlertCircle className="w-4 h-4" /> Out of stock
            </div>
          ) : product.currentStock <= 5 ? (
            <div className="flex items-center gap-2 text-yellow-400 text-sm mb-6">
              <AlertCircle className="w-4 h-4" /> Only {product.currentStock} left in stock
            </div>
          ) : null}

          {addError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4 px-3 py-2
                            bg-red-900/20 border border-red-700/40 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" /> {addError}
            </div>
          )}

          {/* Qty + Add to Cart */}
          {!outOfStock && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 text-white bg-gray-800 hover:bg-gray-700 transition-colors text-lg font-medium"
                >−</button>
                <span className="w-12 text-center text-white font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  className="w-10 h-10 text-white bg-gray-800 hover:bg-gray-700 transition-colors text-lg font-medium"
                >+</button>
              </div>

              <button
                onClick={handleAdd}
                disabled={addMut.isPending || added}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                           font-medium transition-colors
                           bg-primary-600 hover:bg-primary-700 text-white
                           disabled:opacity-70"
              >
                {added ? (
                  <><CheckCircle className="w-4 h-4" /> Added!</>
                ) : addMut.isPending ? (
                  'Adding…'
                ) : (
                  <><ShoppingCart className="w-4 h-4" /> Add to Cart</>
                )}
              </button>
            </div>
          )}

          {product.barcode && (
            <p className="text-xs text-gray-500">Barcode: {product.barcode}</p>
          )}
        </div>
      </div>
    </div>
  )
}
