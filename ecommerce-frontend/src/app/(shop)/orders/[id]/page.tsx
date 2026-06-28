'use client'
import { use, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, StickyNote, Star } from 'lucide-react'
import { getOrder, type OrderStatus } from '@/services/orderService'
import { useAuthStore } from '@/store/authStore'

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  FULFILLED: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:   'Pending — awaiting confirmation',
  CONFIRMED: 'Confirmed — being prepared',
  FULFILLED: 'Fulfilled — ready / delivered',
  CANCELLED: 'Cancelled',
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/auth/login')
  }, [isLoggedIn, router])

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['ec-order', id],
    queryFn: () => getOrder(Number(id)),
    enabled: isLoggedIn(),
    retry: false,
  })

  if (!isLoggedIn()) return null

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-40 bg-gray-800 rounded" />
        <div className="h-32 bg-gray-800 rounded-xl" />
        <div className="h-48 bg-gray-800 rounded-xl" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">Order not found.</p>
        <Link href="/orders" className="text-primary-400 hover:text-primary-300 text-sm">
          ← Back to orders
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-400
                                      hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Order #{order.orderNumber}</h1>
        <span className={`text-sm px-3 py-1 rounded-full border font-medium ${STATUS_STYLES[order.status]}`}>
          {order.status}
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-6">{STATUS_LABELS[order.status]}</p>

      {/* Timeline */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Timeline</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Placed</span>
            <span className="text-white">{new Date(order.placedAt).toLocaleString()}</span>
          </div>
          {order.confirmedAt && (
            <div className="flex justify-between">
              <span className="text-gray-400">Confirmed</span>
              <span className="text-white">{new Date(order.confirmedAt).toLocaleString()}</span>
            </div>
          )}
          {order.fulfilledAt && (
            <div className="flex justify-between">
              <span className="text-gray-400">Fulfilled</span>
              <span className="text-white">{new Date(order.fulfilledAt).toLocaleString()}</span>
            </div>
          )}
          {order.cancelledAt && (
            <div className="flex justify-between">
              <span className="text-gray-400">Cancelled</span>
              <span className="text-red-400">{new Date(order.cancelledAt).toLocaleString()}</span>
            </div>
          )}
          {order.cancelReason && (
            <div className="flex justify-between">
              <span className="text-gray-400">Reason</span>
              <span className="text-red-300 text-right max-w-xs">{order.cancelReason}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-300">{item.productName} × {item.quantity}</span>
              <span className="text-white">Rs. {item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-700 mt-3 pt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">Rs. {order.subtotal.toFixed(2)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-yellow-400">
              <span>Loyalty discount</span>
              <span>- Rs. {order.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span className="text-white">Total</span>
            <span className="text-white">Rs. {order.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      {(order.deliveryAddress || order.note || order.loyaltyPointsEarned > 0) && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          {order.deliveryAddress && (
            <div className="flex gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span className="text-gray-300">{order.deliveryAddress}</span>
            </div>
          )}
          {order.note && (
            <div className="flex gap-2 text-sm">
              <StickyNote className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span className="text-gray-300">{order.note}</span>
            </div>
          )}
          {order.loyaltyPointsEarned > 0 && (
            <div className="flex gap-2 text-sm text-yellow-400">
              <Star className="w-4 h-4 shrink-0 mt-0.5" />
              <span>+{order.loyaltyPointsEarned} loyalty points earned</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
