import api from './api'

export interface Promotion {
  id: number
  storeId: number
  name: string
  description?: string
  promoType: string
  discountValue: number
  minPurchase?: number
  maxDiscount?: number
  appliesTo: string
  targetId?: number
  buyQuantity?: number
  getQuantity?: number
  startsAt: string
  endsAt?: string
  isActive: boolean
  createdAt: string
}

export interface PromotionPage {
  content: Promotion[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getPromotions(storeId: number, page = 0, size = 20): Promise<PromotionPage> {
  const { data } = await api.get('/promotions', { params: { storeId, page, size } })
  return data.data
}

export async function getActivePromotions(storeId: number): Promise<Promotion[]> {
  const { data } = await api.get('/promotions/active', { params: { storeId } })
  return data.data
}

export async function createPromotion(payload: Omit<Promotion, 'id' | 'createdAt'>): Promise<Promotion> {
  const { data } = await api.post('/promotions', payload)
  return data.data
}

export async function updatePromotion(id: number, payload: Omit<Promotion, 'id' | 'createdAt'>): Promise<Promotion> {
  const { data } = await api.put(`/promotions/${id}`, payload)
  return data.data
}

export async function togglePromotion(id: number): Promise<Promotion> {
  const { data } = await api.patch(`/promotions/${id}/toggle`)
  return data.data
}
