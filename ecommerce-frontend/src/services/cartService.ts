import api from '@/lib/api'

export interface CartItem {
  productId: number
  productName: string
  unitPrice: number      // backend field name
  quantity: number
  lineTotal: number
  currentStock: number   // backend field name
  inStock: boolean
}

export interface Cart {
  items: CartItem[]
  subtotal: number
  itemCount: number
}

export async function getCart(): Promise<Cart> {
  const { data } = await api.get('/ecommerce/cart')
  return data.data
}

export async function addToCart(productId: number, quantity: number): Promise<Cart> {
  // Backend uses PUT /ecommerce/cart/items; storeId comes from the JWT principal
  const { data } = await api.put('/ecommerce/cart/items', { productId, quantity })
  return data.data
}

export async function removeFromCart(productId: number): Promise<Cart> {
  const { data } = await api.delete(`/ecommerce/cart/items/${productId}`)
  return data.data
}

export async function clearCart(): Promise<void> {
  await api.delete('/ecommerce/cart')
}
