import api from './api'
import type { ProductUnit } from './productService'

export type MovementType =
  | 'RECEIVE'
  | 'SALE'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'VOID'

export interface StockBalance {
  id?: number
  storeId: number
  productId: number
  productName: string
  productBarcode?: string
  categoryName?: string
  quantity: number
  lowStockThreshold: number
  isLowStock: boolean
  updatedAt?: string
}

export interface StockMovement {
  id: number
  storeId: number
  productId: number
  productName: string
  movementType: MovementType
  quantity: number
  quantityBefore: number
  quantityAfter: number
  referenceId?: number
  note?: string
  createdAt: string
  createdBy?: number
}

export interface StockPage<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getAllStock(storeId: number, page = 0): Promise<StockPage<StockBalance>> {
  const { data } = await api.get('/inventory/stock', { params: { storeId, page, size: 20 } })
  return data.data
}

export async function getLowStock(storeId: number): Promise<StockPage<StockBalance>> {
  const { data } = await api.get('/inventory/stock/low', { params: { storeId, size: 100 } })
  return data.data
}

export async function getStockByProduct(
  storeId: number,
  productId: number,
): Promise<StockBalance> {
  const { data } = await api.get(`/inventory/stock/product/${productId}`, {
    params: { storeId },
  })
  return data.data
}

export async function receiveStock(payload: {
  storeId: number
  productId: number
  quantity: number
  receivedUnit?: ProductUnit
  note?: string
}): Promise<StockBalance> {
  const { data } = await api.post('/inventory/receive', payload)
  return data.data
}

export async function adjustStock(payload: {
  storeId: number
  productId: number
  newQuantity: number
  note: string
}): Promise<StockBalance> {
  const { data } = await api.post('/inventory/adjust', payload)
  return data.data
}

export async function getMovements(
  storeId: number,
  productId?: number,
  page = 0,
): Promise<StockPage<StockMovement>> {
  const { data } = await api.get('/inventory/movements', {
    params: { storeId, productId, page, size: 20 },
  })
  return data.data
}
