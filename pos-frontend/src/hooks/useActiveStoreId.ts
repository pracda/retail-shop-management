import { useAuthStore } from '../store/authStore'
import { useSelectedStoreStore } from '../store/selectedStoreStore'

export function useActiveStoreId(): number {
  const user = useAuthStore((s) => s.user)
  const selectedStoreId = useSelectedStoreStore((s) => s.storeId)

  if (user?.role === 'MASTER_ADMIN') {
    return selectedStoreId ?? 1
  }
  return user?.storeId ?? 1
}

export function useActiveStoreName(): string {
  const user = useAuthStore((s) => s.user)
  const selectedStoreName = useSelectedStoreStore((s) => s.storeName)

  if (user?.role === 'MASTER_ADMIN') {
    return selectedStoreName ?? 'Store #1'
  }
  return `Store #${user?.storeId ?? 1}`
}
