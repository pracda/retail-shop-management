import api from './api'

export interface StoreInfo {
  id: number
  name: string
  address?: string
  phone?: string
  email?: string
  isActive: boolean
  taxRate?: number
}

export async function getStore(id: number): Promise<StoreInfo> {
  const { data } = await api.get(`/stores/${id}`)
  return data.data
}

export async function updateStore(id: number, payload: {
  name: string
  address?: string
  phone?: string
  email?: string
  taxRate?: number
}): Promise<StoreInfo> {
  const { data } = await api.put(`/stores/${id}`, payload)
  return data.data
}

export async function getActiveCashierCount(storeId: number): Promise<number> {
  const { data } = await api.get('/shifts/active-count', { params: { storeId } })
  return data.data
}

export async function getStores(): Promise<StoreInfo[]> {
  const { data } = await api.get('/stores')
  return data.data
}

export async function createStore(payload: {
  name: string
  address?: string
  phone?: string
  email?: string
  taxRate?: number
}): Promise<StoreInfo> {
  const { data } = await api.post('/stores', payload)
  return data.data
}

export async function deactivateStore(id: number): Promise<void> {
  await api.delete(`/stores/${id}`)
}
