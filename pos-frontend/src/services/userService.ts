import api from './api'

export interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  roleId: number
  storeId?: number
  storeName?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

export interface UserPage {
  content: User[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getUsers(page = 0, size = 20): Promise<UserPage> {
  const { data } = await api.get('/users', { params: { page, size, sortBy: 'createdAt', direction: 'desc' } })
  return data.data
}

export async function createUser(payload: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
  roleId: number
  storeId?: number
  pin?: string
}): Promise<User> {
  const { data } = await api.post('/users', payload)
  return data.data
}

export async function updateUser(id: number, payload: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  storeId?: number
}): Promise<User> {
  const { data } = await api.put(`/users/${id}`, payload)
  return data.data
}

export async function setUserStatus(id: number, active: boolean): Promise<void> {
  await api.patch(`/users/${id}/${active ? 'activate' : 'deactivate'}`)
}

export async function assignPin(id: number, pin: string): Promise<void> {
  await api.patch(`/users/${id}/pin`, { pin })
}

export async function changeRole(id: number, roleId: number): Promise<User> {
  const { data } = await api.patch(`/users/${id}/role`, { roleId })
  return data.data
}

export async function changePassword(id: number, payload: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<void> {
  await api.patch(`/users/${id}/password`, payload)
}

// Roles are fixed — no need for an API call
export const ROLES = [
  { id: 1, name: 'MASTER_ADMIN', label: 'Master Admin' },
  { id: 2, name: 'ADMIN',        label: 'Admin' },
  { id: 3, name: 'MANAGER',      label: 'Manager' },
  { id: 4, name: 'CASHIER',      label: 'Cashier' },
]

export const ROLE_COLORS: Record<string, string> = {
  MASTER_ADMIN: 'bg-purple-900/40 text-purple-300 border-purple-700',
  ADMIN:        'bg-blue-900/40   text-blue-300   border-blue-700',
  MANAGER:      'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  CASHIER:      'bg-primary-900/40 text-primary-300 border-primary-700',
}
