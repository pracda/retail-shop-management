import api from './api'

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE' | 'MIXED'
export type SaleStatus = 'COMPLETED' | 'VOIDED' | 'HELD' | 'REFUNDED'

export interface SaleItemPayload {
  productId?: number | null          // null for manual items
  quantity: number
  discountAmount?: number
  manualDescription?: string         // required when productId is null
  manualUnitPrice?: number           // required when productId is null
}

export interface SalePaymentPayload {
  paymentMethod: PaymentMethod
  amount: number
}

export interface CreateSalePayload {
  storeId: number
  shiftId: number
  items: SaleItemPayload[]
  paymentMethod: PaymentMethod
  amountTendered: number
  discountAmount?: number
  notes?: string
  customerId?: number
  payments?: SalePaymentPayload[]
  loyaltyPointsRedeemed?: number
}

export async function emailReceipt(saleId: number, email: string): Promise<void> {
  await api.post(`/sales/${saleId}/email-receipt`, { email })
}

export interface SaleItemResponse {
  id: number
  productId: number | null
  productName: string
  variantName?: string
  barcode?: string
  manualDescription?: string
  isManual: boolean
  quantity: number
  unitPrice: number
  discountAmount: number
  lineTotal: number
}

export interface SalePaymentResponse {
  paymentMethod: PaymentMethod
  amount: number
}

export interface Sale {
  id: number
  storeId: number
  shiftId: number
  cashierId: number
  cashierName: string
  receiptNumber: string
  status: SaleStatus
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  amountTendered: number
  changeDue: number
  paymentMethod: PaymentMethod
  notes?: string
  loyaltyPointsRedeemed?: number
  pointsEarned?: number
  customerId?: number
  customerName?: string
  voidedById?: number
  voidReason?: string
  voidedAt?: string
  items: SaleItemResponse[]
  payments?: SalePaymentResponse[]
  createdAt: string
}

export async function createSale(payload: CreateSalePayload): Promise<Sale> {
  const { data } = await api.post('/sales', payload)
  return data.data
}

export async function getSale(id: number): Promise<Sale> {
  const { data } = await api.get(`/sales/${id}`)
  return data.data
}

export interface SalePage {
  content: Sale[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getSales(params: {
  storeId: number
  status?: string
  from?: string
  to?: string
  page?: number
  size?: number
}): Promise<SalePage> {
  const { data } = await api.get('/sales', { params })
  return data.data
}


export async function voidSale(id: number, reason: string): Promise<Sale> {
  const { data } = await api.post(`/sales/${id}/void`, { reason })
  return data.data
}
