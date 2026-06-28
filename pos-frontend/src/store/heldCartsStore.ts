import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from './cartStore'

export interface HeldCart {
  id: string
  heldAt: string   // ISO timestamp
  items: CartItem[]
  saleDiscount: number
}

interface HeldCartsState {
  carts: HeldCart[]
  holdCart: (items: CartItem[], saleDiscount: number) => string
  removeHeld: (id: string) => HeldCart | undefined
  clearAll: () => void
}

export const useHeldCartsStore = create<HeldCartsState>()(
  persist(
    (set, get) => ({
      carts: [],

      holdCart: (items, saleDiscount) => {
        const id = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const held: HeldCart = { id, heldAt: new Date().toISOString(), items, saleDiscount }
        set((s) => ({ carts: [...s.carts, held] }))
        return id
      },

      removeHeld: (id) => {
        const found = get().carts.find((c) => c.id === id)
        set((s) => ({ carts: s.carts.filter((c) => c.id !== id) }))
        return found
      },

      clearAll: () => set({ carts: [] }),
    }),
    { name: 'pos_held_carts' },
  ),
)
