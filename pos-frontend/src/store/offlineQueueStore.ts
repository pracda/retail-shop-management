import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CreateSalePayload } from '../services/salesService'

export interface QueuedSale {
  id: string            // local UUID
  payload: CreateSalePayload
  queuedAt: string      // ISO timestamp
  attempts: number
}

interface OfflineQueueState {
  queue: QueuedSale[]
  enqueue: (payload: CreateSalePayload) => string
  remove: (id: string) => void
  incrementAttempts: (id: string) => void
  clear: () => void
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set) => ({
      queue: [],

      enqueue(payload) {
        const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        set((s) => ({
          queue: [...s.queue, { id, payload, queuedAt: new Date().toISOString(), attempts: 0 }],
        }))
        return id
      },

      remove(id) {
        set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }))
      },

      incrementAttempts(id) {
        set((s) => ({
          queue: s.queue.map((q) => q.id === id ? { ...q, attempts: q.attempts + 1 } : q),
        }))
      },

      clear() {
        set({ queue: [] })
      },
    }),
    { name: 'pos-offline-queue' },
  ),
)
