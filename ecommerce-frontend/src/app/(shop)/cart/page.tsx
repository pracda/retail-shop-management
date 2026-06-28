'use client'
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import { getCart, addToCart, removeFromCart } from '@/services/cartService'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'

export default function CartPage() {
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()
  const setItemCount = useCartStore((s) => s.setItemCount)
  const qc = useQueryClient()

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/auth/login')
  }, [isLoggedIn, router])

  const { data: cart, isLoading } = useQuery({
    queryKey: ['ec-cart'],
    queryFn: getCart,
    enabled: isLoggedIn(),
  })

  useEffect(() => {
    if (cart) setItemCount(cart.itemCount)
  }, [cart, setItemCount])

  const updateMut = useMutation({
    mutationFn: ({ productId, qty }: { productId: number; qty: number }) =>
      addToCart(productId, qty),
    onSuccess: (c) => { setItemCount(c.itemCount); qc.invalidateQueries({ queryKey: ['ec-cart'] }) },
  })

  const removeMut = useMutation({
    mutationFn: (productId: number) => removeFromCart(productId),
    onSuccess: (c) => { setItemCount(c.itemCount); qc.invalidateQueries({ queryKey: ['ec-cart'] }) },
  })

  if (!isLoggedIn()) return null

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (!cart || cart.items.filter((i) => i.quantity > 0).length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-700" />
        <h2 className="text-xl font-semibold text-white mb-2">Your cart is empty</h2>
        <p className="text-gray-400 text-sm mb-6">Add some products to get started.</p>
        <Link href="/products"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white
                     font-medium px-5 py-2.5 rounded-lg transition-colors">
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Your Cart</h1>

      <div className="space-y-3 mb-6">
        {cart.items.filter((item) => item.quantity > 0).map((item) => (
          <div key={item.productId}
            className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{item.productName}</p>
              <p className="text-gray-400 text-xs mt-0.5">Rs. {item.unitPrice.toFixed(2)} each</p>
            </div>

            {/* Qty controls */}
            <div className="flex items-center border border-gray-600 rounded-lg overflow-hidden shrink-0">
              <button
                onClick={() => item.quantity > 1
                  ? updateMut.mutate({ productId: item.productId, qty: item.quantity - 1 })
                  : removeMut.mutate(item.productId)
                }
                className="w-8 h-8 text-white bg-gray-700 hover:bg-gray-600 transition-colors"
              >−</button>
              <span className="w-8 text-center text-sm text-white font-medium">{item.quantity}</span>
              <button
                onClick={() => updateMut.mutate({ productId: item.productId, qty: item.quantity + 1 })}
                disabled={item.quantity >= item.currentStock}
                className="w-8 h-8 text-white bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-40"
              >+</button>
            </div>

            <div className="text-white font-semibold text-sm w-24 text-right shrink-0">
              Rs. {item.lineTotal.toFixed(2)}
            </div>

            <button
              onClick={() => removeMut.mutate(item.productId)}
              className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex justify-between text-white font-bold text-lg mb-4">
          <span>Subtotal</span>
          <span>Rs. {cart.subtotal.toFixed(2)}</span>
        </div>
        <button
          onClick={() => router.push('/checkout')}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                     text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Proceed to Checkout <ArrowRight className="w-4 h-4" />
        </button>
        <Link href="/products"
          className="block text-center text-gray-400 hover:text-white text-sm mt-3 transition-colors">
          Continue shopping
        </Link>
      </div>
    </div>
  )
}
