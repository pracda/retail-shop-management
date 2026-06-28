import api from '@/lib/api'

const STORE_ID = Number(process.env.NEXT_PUBLIC_STORE_ID ?? 1)

export interface CatalogProduct {
  id: number
  name: string
  description?: string
  sellingPrice: number
  categoryId?: number
  categoryName?: string
  barcode?: string
  sku?: string
  currentStock: number
  inStock: boolean
  variantCount: number
  parentProductId?: number
  variantName?: string
}

export interface Category {
  id: number
  name: string
  description?: string
}

export interface ProductPage {
  content: CatalogProduct[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function getProducts(params: {
  page?: number
  size?: number
  search?: string
  categoryId?: number
}): Promise<ProductPage> {
  const { data } = await api.get('/ecommerce/catalog/products', {
    params: { storeId: STORE_ID, ...params },
  })
  return data.data
}

export async function getProduct(id: number): Promise<CatalogProduct> {
  const { data } = await api.get(`/ecommerce/catalog/products/${id}`, {
    params: { storeId: STORE_ID },
  })
  return data.data
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get('/ecommerce/catalog/categories', {
    params: { storeId: STORE_ID },
  })
  return data.data
}
