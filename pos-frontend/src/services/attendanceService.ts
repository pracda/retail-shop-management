import api from './api'

export interface CashierSession {
  id: number
  storeId: number
  cashierId: number
  cashierName: string
  clockedInAt: string
  clockedOutAt: string | null
  notes: string | null
  active: boolean
}

export async function clockIn(storeId: number): Promise<CashierSession> {
  const { data } = await api.post('/attendance/clock-in', { storeId })
  return data.data
}

export async function clockOut(storeId: number, notes?: string): Promise<CashierSession> {
  const { data } = await api.post('/attendance/clock-out', notes ? { notes } : undefined, {
    params: { storeId },
  })
  return data.data
}

export async function getAttendanceStatus(
  storeId: number,
  cashierId: number
): Promise<CashierSession | null> {
  const { data } = await api.get('/attendance/status', { params: { storeId, cashierId } })
  return data.data ?? null
}

export interface AttendancePage {
  content: CashierSession[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function updateAttendanceSession(
  id: number,
  clockedInAt: string,
  clockedOutAt: string | null,
  notes: string
): Promise<CashierSession> {
  const { data } = await api.put(`/attendance/${id}`, { clockedInAt, clockedOutAt: clockedOutAt || null, notes })
  return data.data
}

export async function getAttendanceHistory(
  storeId: number,
  cashierId?: number,
  from?: string,
  to?: string,
  page = 0,
  size = 200
): Promise<AttendancePage> {
  const { data } = await api.get('/attendance', { params: { storeId, cashierId, from, to, page, size } })
  return data.data
}
