import api from './api'

export interface AuthUser {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  storeId: number
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<{ data: AuthResponse }>('/auth/login', {
    email,
    password,
  })
  return data.data
}

export async function loginWithPin(
  storeId: number,
  pin: string,
): Promise<AuthResponse> {
  const { data } = await api.post<{ data: AuthResponse }>('/auth/pin-login', {
    storeId,
    pin,
  })
  return data.data
}

export interface ManagerApprovalResult {
  approved: boolean
  approverName: string
}

export async function verifyManagerPin(
  storeId: number,
  pin: string,
): Promise<ManagerApprovalResult> {
  const { data } = await api.post<{ data: ManagerApprovalResult }>('/auth/verify-manager-pin', {
    storeId,
    pin,
  })
  return data.data
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }
}
