import api from './api'

export type ProductUnit = 'UNIT' | 'PACK' | 'CARTON'

export interface Product {
  id: number
  storeId: number
  storeName: string
  categoryId?: number
  categoryName?: string
  name: string
  description?: string
  barcode?: string
  sku?: string
  baseUnit: ProductUnit
  unitsPerPack: number
  packsPerCarton: number
  loyaltyMultiplier: number
  costPrice: number
  sellingPrice: number
  lowStockThreshold: number
  isActive: boolean
  taxRate?: number
  isTaxable?: boolean
  parentProductId?: number
  variantName?: string
  variantCount?: number
  currentStock?: number
  createdAt: string
  updatedAt: string
}

export interface ProductPage {
  content: Product[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface ProductFilters {
  storeId: number
  categoryId?: number
  search?: string
  onlyParents?: boolean
  page?: number
  size?: number
}

export async function getProducts(filters: ProductFilters): Promise<ProductPage> {
  const { data } = await api.get('/products', { params: { size: 20, ...filters } })
  return data.data
}

export async function getProductByBarcode(storeId: number, barcode: string): Promise<Product> {
  const { data } = await api.get(`/products/barcode/${barcode}`, { params: { storeId } })
  return data.data
}

export async function getProduct(id: number): Promise<Product> {
  const { data } = await api.get(`/products/${id}`)
  return data.data
}

export async function getProductVariants(parentId: number): Promise<Product[]> {
  const { data } = await api.get(`/products/${parentId}/variants`)
  return data.data
}

export interface CreateProductPayload {
  storeId: number
  categoryId?: number | null
  name: string
  description?: string
  barcode?: string
  sku?: string
  baseUnit: ProductUnit
  unitsPerPack: number
  packsPerCarton: number
  loyaltyMultiplier?: number
  costPrice: number
  sellingPrice: number
  lowStockThreshold: number
  taxRate?: number
  isTaxable?: boolean
  parentProductId?: number
  variantName?: string
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const { data } = await api.post('/products', payload)
  return data.data
}

export async function updateProduct(
  id: number,
  payload: Omit<CreateProductPayload, 'storeId'>,
): Promise<Product> {
  const { data } = await api.put(`/products/${id}`, payload)
  return data.data
}

export async function setProductStatus(id: number, active: boolean): Promise<void> {
  await api.patch(`/products/${id}/${active ? 'activate' : 'deactivate'}`)
}
