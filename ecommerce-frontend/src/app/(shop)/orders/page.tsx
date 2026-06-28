'use client'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, ChevronRight } from 'lucide-react'
import { getOrders, type OrderStatus } from '@/services/orderService'
import { useAuthStore } from '@/store/authStore'

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  FULFILLED: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function OrdersPage() {
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/auth/login')
  }, [isLoggedIn, router])

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['ec-orders'],
    queryFn: getOrders,
    enabled: isLoggedIn(),
  })

  if (!isLoggedIn()) return null

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse"/>)}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <Package className="w-16 h-16 mx-auto mb-4 text-gray-700" />
        <h2 className="text-xl font-semibold text-white mb-2">No orders yet</h2>
        <p className="text-gray-400 text-sm mb-6">Your order history will appear here.</p>
        <Link href="/products"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white
                     font-medium px-5 py-2.5 rounded-lg transition-colors">
          Start Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">My Orders</h1>

      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="block bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl p-4
                       transition-colors group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-sm">#{order.orderNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[order.status]}`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·{' '}
                  {new Date(order.placedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white font-bold">Rs. {order.totalAmount.toFixed(2)}</div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 ml-auto mt-1 transition-colors" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
