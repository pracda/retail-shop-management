import api from './api'

export type ShiftStatus = 'OPEN' | 'CLOSED'

export interface Shift {
  id: number
  storeId: number
  storeName: string
  cashierId: number
  cashierName: string
  openedById: number
  openedByName: string
  closedById?: number
  closedByName?: string
  status: ShiftStatus
  openingFloat: number
  closingCash?: number
  notes?: string
  openedAt: string
  closedAt?: string
  createdAt: string
}

export interface ShiftPage {
  content: Shift[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function openShift(payload: {
  storeId: number
  openingFloat?: number
}): Promise<Shift> {
  const { data } = await api.post('/shifts/open', payload)
  return data.data
}

export async function closeShift(
  shiftId: number,
  payload: { storeId: number; closingCash: number; notes?: string }
): Promise<Shift> {
  const { data } = await api.post(`/shifts/${shiftId}/close`, payload)
  return data.data
}

export async function getCurrentShift(storeId: number): Promise<Shift | null> {
  const { data } = await api.get('/shifts/current', { params: { storeId } })
  return data.data ?? null
}

export async function getShiftHistory(storeId: number, page = 0, size = 20): Promise<ShiftPage> {
  const { data } = await api.get('/shifts', { params: { storeId, page, size } })
  return data.data
}

export interface CashReconciliation {
  shiftId: number
  cashierName: string
  openedAt: string
  closedAt?: string
  status: ShiftStatus
  openingFloat: number
  cashSalesTotal: number
  cashRefundsTotal: number
  expenseTotal: number
  expectedCash: number
  closingCash?: number
  variance?: number
}

export async function getReconciliation(shiftId: number): Promise<CashReconciliation> {
  const { data } = await api.get(`/shifts/${shiftId}/reconciliation`)
  return data.data
}
