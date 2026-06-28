import api from './api'

export interface Customer {
  id: number
  storeId: number
  name: string
  phone?: string
  email?: string
  address?: string
  loyaltyPoints: number
  totalSpent: number
  notes?: string
  isActive: boolean
  createdAt: string
}

export interface CustomerPage {
  content: Customer[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getCustomers(
  storeId: number,
  search?: string,
  page = 0,
  size = 20
): Promise<CustomerPage> {
  const { data } = await api.get('/customers', { params: { storeId, search, page, size } })
  return data.data
}

export async function getCustomer(id: number): Promise<Customer> {
  const { data } = await api.get(`/customers/${id}`)
  return data.data
}

export async function findCustomerByPhone(storeId: number, phone: string): Promise<Customer | null> {
  const { data } = await api.get('/customers/by-phone', { params: { storeId, phone } })
  return data.data ?? null
}

export async function createCustomer(payload: {
  storeId: number
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}): Promise<Customer> {
  const { data } = await api.post('/customers', payload)
  return data.data
}

export async function updateCustomer(id: number, payload: {
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}): Promise<Customer> {
  const { data } = await api.put(`/customers/${id}`, payload)
  return data.data
}
