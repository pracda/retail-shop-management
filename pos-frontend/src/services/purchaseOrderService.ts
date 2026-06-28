import api from './api'

export type POStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

export interface POItem {
  id: number
  productId: number
  productName: string
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
}

export interface PurchaseOrder {
  id: number
  storeId: number
  supplierId: number
  supplierName: string
  poNumber: string
  status: POStatus
  notes?: string
  orderedAt?: string
  receivedAt?: string
  createdAt: string
  items: POItem[]
}

export interface PurchaseOrderPage {
  content: PurchaseOrder[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getPurchaseOrders(storeId: number, page = 0, size = 20): Promise<PurchaseOrderPage> {
  const { data } = await api.get('/purchase-orders', { params: { storeId, page, size } })
  return data.data
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
  const { data } = await api.get(`/purchase-orders/${id}`)
  return data.data
}

export async function createPurchaseOrder(payload: {
  storeId: number
  supplierId: number
  notes?: string
  items: { productId: number; quantityOrdered: number; unitCost: number }[]
}): Promise<PurchaseOrder> {
  const { data } = await api.post('/purchase-orders', payload)
  return data.data
}

export async function markOrdered(id: number): Promise<PurchaseOrder> {
  const { data } = await api.post(`/purchase-orders/${id}/order`)
  return data.data
}

export async function receiveItems(id: number, lines: { poItemId: number; quantityReceived: number }[]): Promise<PurchaseOrder> {
  const { data } = await api.post(`/purchase-orders/${id}/receive`, { lines })
  return data.data
}

export async function cancelPurchaseOrder(id: number): Promise<PurchaseOrder> {
  const { data } = await api.post(`/purchase-orders/${id}/cancel`)
  return data.data
}
