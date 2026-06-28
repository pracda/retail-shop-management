import api from './api'

export interface Expense {
  id: number
  storeId: number
  shiftId: number
  recordedByName: string
  description: string
  amount: number
  category?: string
  createdAt: string
}

export async function recordExpense(payload: {
  storeId: number
  shiftId: number
  description: string
  amount: number
  category?: string
}): Promise<Expense> {
  const { data } = await api.post('/expenses', payload)
  return data.data
}

export async function getExpensesForShift(shiftId: number): Promise<Expense[]> {
  const { data } = await api.get(`/expenses/shift/${shiftId}`)
  return data.data
}
