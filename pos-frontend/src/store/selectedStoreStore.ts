import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SelectedStoreState {
  storeId: number | null
  storeName: string | null
  setStore: (id: number, name: string) => void
  clearStore: () => void
}

export const useSelectedStoreStore = create<SelectedStoreState>()(
  persist(
    (set) => ({
      storeId: null,
      storeName: null,
      setStore: (id, name) => set({ storeId: id, storeName: name }),
      clearStore: () => set({ storeId: null, storeName: null }),
    }),
    {
      name: 'pos_selected_store',
    },
  ),
)
