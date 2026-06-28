'use client'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { MapPin, StickyNote, Star, CheckCircle } from 'lucide-react'
import { getCart } from '@/services/cartService'
import { placeOrder } from '@/services/orderService'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'

export default function CheckoutPage() {
  const router = useRouter()
  const { user, isLoggedIn } = useAuthStore()
  const setItemCount = useCartStore((s) => s.setItemCount)
  const qc = useQueryClient()

  const [address, setAddress] = useState(user?.address ?? '')
  const [note, setNote] = useState('')
  const [redeemPts, setRedeemPts] = useState(0)
  const [placed, setPlaced] = useState<{ orderNumber: string; total: number } | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/auth/login')
  }, [isLoggedIn, router])

  const { data: cart, isLoading } = useQuery({
    queryKey: ['ec-cart'],
    queryFn: getCart,
    enabled: isLoggedIn(),
  })

  const loyaltyAvailable = user?.loyaltyPoints ?? 0
  // 1 point = Rs 0.01 discount, max 50% of cart
  const maxRedeem = cart ? Math.min(loyaltyAvailable, Math.floor(cart.subtotal * 0.5 / 0.01)) : 0
  const loyaltyDiscount = redeemPts * 0.01
  const finalTotal = cart ? Math.max(0, cart.subtotal - loyaltyDiscount) : 0

  const orderMut = useMutation({
    mutationFn: () => placeOrder({
      deliveryAddress: address.trim() || undefined,
      note: note.trim() || undefined,
      loyaltyPointsToRedeem: redeemPts > 0 ? redeemPts : undefined,
    }), // storeId resolved from JWT on the backend
    onSuccess: (order) => {
      setItemCount(0)
      qc.invalidateQueries({ queryKey: ['ec-cart'] })
      setPlaced({ orderNumber: order.orderNumber, total: order.totalAmount })
    },
  })

  if (!isLoggedIn()) return null

  if (placed) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-primary-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Order Placed!</h1>
        <p className="text-gray-400 text-sm mb-1">Order #{placed.orderNumber}</p>
        <p className="text-white font-semibold text-lg mb-6">Rs. {placed.total.toFixed(2)}</p>
        <p className="text-gray-400 text-sm mb-8">
          We'll prepare your order shortly. Track it in your orders page.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/orders')}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg
                       font-medium transition-colors"
          >
            View Orders
          </button>
          <button
            onClick={() => router.push('/products')}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg
                       font-medium transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <div className="max-w-lg mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse"/>)}
    </div>
  }

  if (!cart || cart.items.length === 0) {
    router.replace('/cart')
    return null
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>

      {/* Order items summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Order Summary</h2>
        <div className="space-y-2">
          {cart.items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="text-gray-300">{item.productName} × {item.quantity}</span>
              <span className="text-white">Rs. {item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-700 mt-3 pt-3 flex justify-between font-semibold">
          <span className="text-gray-300">Subtotal</span>
          <span className="text-white">Rs. {cart.subtotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Delivery address */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
          <MapPin className="w-4 h-4" /> Delivery Address
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          placeholder="Enter delivery address (optional for pickup)"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                     placeholder-gray-500 focus:outline-none focus:border-primary-500 resize-none"
        />
      </div>

      {/* Note */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
          <StickyNote className="w-4 h-4" /> Order Note
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any special instructions?"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                     placeholder-gray-500 focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Loyalty */}
      {loyaltyAvailable > 0 && (
        <div className="bg-gray-800 border border-yellow-500/30 rounded-xl p-4 mb-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-yellow-400 mb-3">
            <Star className="w-4 h-4" /> Loyalty Points ({loyaltyAvailable} available)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={maxRedeem}
              value={redeemPts}
              onChange={(e) => setRedeemPts(Number(e.target.value))}
              className="flex-1 accent-yellow-400"
            />
            <span className="text-white font-medium text-sm w-28 text-right shrink-0">
              {redeemPts} pts = Rs. {loyaltyDiscount.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Total + Place order */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        {loyaltyDiscount > 0 && (
          <div className="flex justify-between text-sm text-yellow-400 mb-2">
            <span>Loyalty discount</span>
            <span>- Rs. {loyaltyDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg text-white mb-4">
          <span>Total</span>
          <span>Rs. {finalTotal.toFixed(2)}</span>
        </div>

        {orderMut.isError && (
          <p className="text-red-400 text-sm mb-3">Failed to place order. Please try again.</p>
        )}

        <button
          onClick={() => orderMut.mutate()}
          disabled={orderMut.isPending}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white
                     font-semibold py-3 rounded-lg transition-colors"
        >
          {orderMut.isPending ? 'Placing Order…' : 'Place Order'}
        </button>
      </div>
    </div>
  )
}
