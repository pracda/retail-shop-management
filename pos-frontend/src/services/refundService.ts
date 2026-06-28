import api from './api'

export interface RefundItem {
  id: number
  saleItemId: number
  productName: string
  quantity: number
  refundAmount: number
}

export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Refund {
  id: number
  saleId: number
  receiptNumber: string
  refundedByName: string
  reason?: string
  refundAmount: number
  refundMethod?: string
  status: RefundStatus
  approvedByName?: string
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
  items: RefundItem[]
}

export interface RefundPage {
  content: Refund[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function createRefund(payload: {
  saleId: number
  reason?: string
  refundMethod?: string
  items: { saleItemId: number; quantity: number }[]
}): Promise<Refund> {
  const { data } = await api.post('/refunds', payload)
  return data.data
}

export async function getPendingRefunds(storeId: number, page = 0, size = 20): Promise<RefundPage> {
  const { data } = await api.get('/refunds/pending', { params: { storeId, page, size } })
  return data.data
}

export async function approveRefund(id: number): Promise<Refund> {
  const { data } = await api.post(`/refunds/${id}/approve`)
  return data.data
}

export async function rejectRefund(id: number, reason: string): Promise<Refund> {
  const { data } = await api.post(`/refunds/${id}/reject`, { reason })
  return data.data
}

export async function getRefundsForSale(saleId: number): Promise<Refund[]> {
  const { data } = await api.get(`/refunds/sale/${saleId}`)
  return data.data
}
