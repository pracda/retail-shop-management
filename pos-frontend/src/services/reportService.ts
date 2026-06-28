import api from './api'

// ── Response types ─────────────────────────────────────────────────────────────

export interface SalesSummaryResponse {
  transactionCount: number
  voidedCount: number
  totalRevenue: number
  totalDiscounts: number
  avgTransactionValue: number
}

export interface ProfitLossResponse {
  revenue: number
  cogs: number
  grossProfit: number
  grossMarginPct: number
  totalDiscounts: number
}

export interface PaymentBreakdownItem {
  paymentMethod: string
  transactionCount: number
  totalAmount: number
  pctOfTotal: number
}

export interface TopProductRow {
  productId: number
  productName: string
  barcode?: string
  qtySold: number
  revenue: number
  cogs: number
  grossProfit: number
}

export interface DailyTrendRow {
  date: string
  transactionCount: number
  revenue: number
}

export interface CashierReportRow {
  cashierId: number
  cashierName: string
  transactionCount: number
  revenue: number
  avgTransactionValue: number
}

// ── Param helpers ──────────────────────────────────────────────────────────────

interface BaseParams {
  storeId: number
  from: string   // ISO-8601 instant
  to: string
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function getSalesSummary(p: BaseParams): Promise<SalesSummaryResponse> {
  const { data } = await api.get('/reports/sales-summary', { params: p })
  return data.data
}

export async function getProfitLoss(p: BaseParams): Promise<ProfitLossResponse> {
  const { data } = await api.get('/reports/profit-loss', { params: p })
  return data.data
}

export async function getPaymentBreakdown(p: BaseParams): Promise<PaymentBreakdownItem[]> {
  const { data } = await api.get('/reports/payment-breakdown', { params: p })
  return data.data
}

export async function getTopProducts(p: BaseParams & { limit?: number }): Promise<TopProductRow[]> {
  const { data } = await api.get('/reports/top-products', { params: p })
  return data.data
}

export async function getDailyTrend(p: BaseParams): Promise<DailyTrendRow[]> {
  const { data } = await api.get('/reports/daily-trend', { params: p })
  return data.data
}

export async function getCashierPerformance(p: BaseParams): Promise<CashierReportRow[]> {
  const { data } = await api.get('/reports/cashier-performance', { params: p })
  return data.data
}

// ── New report types ───────────────────────────────────────────────────────────

export type PaymentMethodFilter = 'ALL' | 'CASH' | 'CARD' | 'MOBILE' | 'MIXED'

export interface TransactionReportRow {
  saleId: number
  receiptNumber: string
  createdAt: string          // ISO-8601
  cashierName: string
  paymentMethod: string
  itemCount: number
  subtotal: number
  discountAmount: number
  totalAmount: number
  status: string             // COMPLETED | VOIDED
}

export interface HourlyTrendRow {
  hour: number               // 0–23
  txnCount: number
  revenue: number
}

export interface CategorySalesRow {
  categoryId: number | null
  categoryName: string
  qtySold: number
  revenue: number
  cogs: number
  grossProfit: number
}

// ── New API calls ──────────────────────────────────────────────────────────────

export async function getTransactions(
  p: BaseParams & { paymentMethod?: string; status?: string; page?: number; size?: number }
): Promise<TransactionReportRow[]> {
  const { data } = await api.get('/reports/transactions', { params: p })
  return data.data
}

export async function getHourlyTrend(p: BaseParams): Promise<HourlyTrendRow[]> {
  const { data } = await api.get('/reports/hourly-trend', { params: p })
  return data.data
}

export async function getCategorySales(p: BaseParams): Promise<CategorySalesRow[]> {
  const { data } = await api.get('/reports/category-sales', { params: p })
  return data.data
}
