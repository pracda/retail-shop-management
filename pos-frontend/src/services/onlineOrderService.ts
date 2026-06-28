import api from './api'

export type OnlineOrderStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED'

export interface AdminOrderItem {
  productId: number
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface AdminOrder {
  id: number
  orderNumber: string
  status: OnlineOrderStatus
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
  customerName: string
  customerEmail: string
  items: AdminOrderItem[]
}

export interface AdminOrderPage {
  content: AdminOrder[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface OnlineOrderSummary {
  totalOrders: number
  pendingCount: number
  confirmedCount: number
  fulfilledCount: number
  cancelledCount: number
  totalRevenue: number
  avgOrderValue: number
}

export interface OnlineOrderDailyRow {
  date: string
  orderCount: number
  revenue: number
}

type RangePreset = 'today' | '7days' | '30days' | 'thisMonth'

interface ListParams {
  storeId: number
  status?: OnlineOrderStatus | 'ALL'
  range?: RangePreset
  from?: string
  to?: string
  page?: number
  size?: number
}

export async function listOnlineOrders(params: ListParams): Promise<AdminOrderPage> {
  const { status, ...rest } = params
  const { data } = await api.get('/ecommerce/admin/orders', {
    params: { ...rest, status: status === 'ALL' ? undefined : status },
  })
  return data.data
}

export async function getOnlineOrderSummary(params: {
  storeId: number
  range?: RangePreset
  from?: string
  to?: string
}): Promise<OnlineOrderSummary> {
  const { data } = await api.get('/ecommerce/admin/orders/summary', { params })
  return data.data
}

export async function getOnlineOrderDailyTrend(params: {
  storeId: number
  range?: RangePreset
  from?: string
  to?: string
}): Promise<OnlineOrderDailyRow[]> {
  const { data } = await api.get('/ecommerce/admin/orders/daily-trend', { params })
  return data.data
}

export async function getOnlineOrder(storeId: number, orderId: number): Promise<AdminOrder> {
  const { data } = await api.get(`/ecommerce/admin/orders/${orderId}`, { params: { storeId } })
  return data.data
}

export async function confirmOnlineOrder(storeId: number, orderId: number): Promise<AdminOrder> {
  const { data } = await api.post(`/ecommerce/admin/orders/${orderId}/confirm`, null, { params: { storeId } })
  return data.data
}

export async function fulfillOnlineOrder(storeId: number, orderId: number): Promise<AdminOrder> {
  const { data } = await api.post(`/ecommerce/admin/orders/${orderId}/fulfill`, null, { params: { storeId } })
  return data.data
}

export async function cancelOnlineOrder(storeId: number, orderId: number, reason?: string): Promise<AdminOrder> {
  const { data } = await api.post(`/ecommerce/admin/orders/${orderId}/cancel`, { reason }, { params: { storeId } })
  return data.data
}

export async function getPendingOrderCount(storeId: number): Promise<number> {
  const { data } = await api.get('/ecommerce/admin/orders/pending-count', { params: { storeId } })
  return data.data.pendingCount
}
