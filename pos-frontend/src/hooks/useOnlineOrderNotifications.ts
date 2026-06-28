import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPendingOrderCount } from '../services/onlineOrderService'

export function useOnlineOrderNotifications(
  storeId: number,
  onNewOrder?: () => void,
) {
  const { data: count = 0 } = useQuery({
    queryKey: ['online-orders-pending-count', storeId],
    queryFn: () => getPendingOrderCount(storeId),
    refetchInterval: 30_000,
    staleTime: 0,
    enabled: !!storeId,
  })

  const prevCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      onNewOrder?.()
    }
    prevCountRef.current = count
  }, [count, onNewOrder])

  return count
}
