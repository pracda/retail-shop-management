import api from './api'

export interface Supplier {
  id: number
  storeId: number
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  isActive: boolean
  createdAt: string
}

export interface SupplierPage {
  content: Supplier[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getSuppliers(storeId: number, page = 0, size = 20): Promise<SupplierPage> {
  const { data } = await api.get('/suppliers', { params: { storeId, page, size } })
  return data.data
}

export async function createSupplier(payload: {
  storeId: number
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}): Promise<Supplier> {
  const { data } = await api.post('/suppliers', payload)
  return data.data
}

export async function updateSupplier(id: number, payload: {
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}): Promise<Supplier> {
  const { data } = await api.put(`/suppliers/${id}`, payload)
  return data.data
}

export async function deactivateSupplier(id: number): Promise<void> {
  await api.delete(`/suppliers/${id}`)
}
