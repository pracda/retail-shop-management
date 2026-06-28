import { useEffect, useRef } from 'react'
import { useOfflineQueueStore } from '../store/offlineQueueStore'
import { createSale } from '../services/salesService'
import { useOnlineStatus } from './useOnlineStatus'

const MAX_ATTEMPTS = 3

/**
 * Runs in the background and drains the offline sale queue whenever
 * the network comes back online. Failed items are retried up to MAX_ATTEMPTS times.
 */
export function useOfflineSync() {
  const isOnline = useOnlineStatus()
  const { queue, remove, incrementAttempts } = useOfflineQueueStore()
  const syncingRef = useRef(false)

  useEffect(() => {
    if (!isOnline || queue.length === 0 || syncingRef.current) return

    async function drain() {
      syncingRef.current = true
      const pending = useOfflineQueueStore.getState().queue.filter((q) => q.attempts < MAX_ATTEMPTS)
      for (const item of pending) {
        try {
          await createSale(item.payload)
          remove(item.id)
        } catch {
          incrementAttempts(item.id)
          if (item.attempts + 1 >= MAX_ATTEMPTS) {
            console.warn(`[offline-sync] Sale ${item.id} failed ${MAX_ATTEMPTS} times — giving up`)
          }
        }
      }
      syncingRef.current = false
    }

    drain()
  }, [isOnline, queue.length]) // eslint-disable-line react-hooks/exhaustive-deps
}
