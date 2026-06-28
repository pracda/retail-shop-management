'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomerUser {
  id: number
  email: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  loyaltyPoints: number
  storeId: number
}

interface AuthState {
  user: CustomerUser | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: CustomerUser, accessToken: string, refreshToken: string) => void
  updateUser: (user: CustomerUser) => void
  logout: () => void
  isLoggedIn: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('ec_access_token', accessToken)
        localStorage.setItem('ec_refresh_token', refreshToken)
        set({ user, accessToken, refreshToken })
      },
      updateUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('ec_access_token')
        localStorage.removeItem('ec_refresh_token')
        set({ user: null, accessToken: null, refreshToken: null })
      },
      isLoggedIn: () => !!get().user && !!get().accessToken,
    }),
    { name: 'ec-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
)
