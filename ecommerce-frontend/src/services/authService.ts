import api from '@/lib/api'

const STORE_ID = Number(process.env.NEXT_PUBLIC_STORE_ID ?? 1)

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  customer: {
    id: number
    email: string
    firstName: string
    lastName: string
    phone?: string
    address?: string
    loyaltyPoints: number
    storeId: number
  }
}

export async function register(payload: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
}): Promise<AuthResponse> {
  const { data } = await api.post('/ecommerce/auth/register', { ...payload, storeId: STORE_ID })
  return data.data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post('/ecommerce/auth/login', { email, password, storeId: STORE_ID })
  return data.data
}

export async function logout(): Promise<void> {
  await api.post('/ecommerce/auth/logout').catch(() => {})
}

export async function getProfile(): Promise<AuthResponse['customer']> {
  const { data } = await api.get('/ecommerce/auth/profile')
  return data.data
}

export async function updateProfile(payload: {
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
}): Promise<AuthResponse['customer']> {
  const { data } = await api.put('/ecommerce/auth/update-profile', payload)
  return data.data
}
