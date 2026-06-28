import api from '@/lib/api'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED'

export interface OrderItem {
  id: number
  productId: number
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface Order {
  id: number
  orderNumber: string
  status: OrderStatus
  subtotal: number
  discountAmount: number
  totalAmount: number
  loyaltyPointsUsed: number
  loyaltyPointsEarned: number
  deliveryAddress?: string
  note?: string
  placedAt: string
  confirmedAt?: string
  fulfilledAt?: string
  cancelledAt?: string
  cancelReason?: string
  items: OrderItem[]
}

export interface PlaceOrderPayload {
  deliveryAddress?: string
  note?: string
  loyaltyPointsToRedeem?: number
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  // storeId comes from the JWT principal on the backend
  const { data } = await api.post('/ecommerce/orders', payload)
  return data.data
}

export async function getOrders(): Promise<Order[]> {
  const { data } = await api.get('/ecommerce/orders')
  return data.data.content
}

export async function getOrder(id: number): Promise<Order> {
  const { data } = await api.get(`/ecommerce/orders/${id}`)
  return data.data
}
