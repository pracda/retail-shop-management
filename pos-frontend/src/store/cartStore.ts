import { create } from 'zustand'
import type { Product } from '../services/productService'

export interface CartItem {
  product: Product
  quantity: number
  unitPrice: number
  discountAmount: number
  lineTotal: number
}

interface CartState {
  items: CartItem[]
  saleDiscount: number
  addItem: (product: Product, qty?: number) => void
  addManualItem: (description: string, unitPrice: number, qty: number) => void
  updateQty: (productId: number, qty: number) => void
  removeItem: (productId: number) => void
  setItemDiscount: (productId: number, discount: number) => void
  setItemPrice: (productId: number, price: number) => void
  setSaleDiscount: (discount: number) => void
  clearCart: () => void
  restoreCart: (items: CartItem[], saleDiscount: number) => void
}

function computeLine(item: Omit<CartItem, 'lineTotal'>): CartItem {
  const lineTotal = item.unitPrice * item.quantity - item.discountAmount
  return { ...item, lineTotal: Math.max(0, lineTotal) }
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  saleDiscount: 0,

  addManualItem(description, unitPrice, qty) {
    // Manual items use a synthetic negative ID to avoid collisions with real products
    const syntheticId = -(Date.now())
    const syntheticProduct: Product = {
      id: syntheticId,
      storeId: 0,
      storeName: '',
      name: description || 'Custom Item',
      baseUnit: 'UNIT',
      unitsPerPack: 1,
      packsPerCarton: 1,
      loyaltyMultiplier: 1,
      costPrice: 0,
      sellingPrice: unitPrice,
      lowStockThreshold: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({
      items: [
        ...s.items,
        computeLine({
          product: syntheticProduct,
          quantity: qty,
          unitPrice,
          discountAmount: 0,
        }),
      ],
    }))
  },

  addItem(product, qty = 1) {
    const existing = get().items.find((i) => i.product.id === product.id)
    if (existing) {
      set((s) => ({
        items: s.items.map((i) =>
          i.product.id === product.id
            ? computeLine({ ...i, quantity: i.quantity + qty })
            : i
        ),
      }))
    } else {
      set((s) => ({
        items: [
          ...s.items,
          computeLine({
            product,
            quantity: qty,
            unitPrice: product.sellingPrice,
            discountAmount: 0,
          }),
        ],
      }))
    }
  },

  updateQty(productId, qty) {
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set((s) => ({
      items: s.items.map((i) =>
        i.product.id === productId ? computeLine({ ...i, quantity: qty }) : i
      ),
    }))
  },

  removeItem(productId) {
    set((s) => ({ items: s.items.filter((i) => i.product.id !== productId) }))
  },

  setItemDiscount(productId, discount) {
    set((s) => ({
      items: s.items.map((i) =>
        i.product.id === productId
          ? computeLine({ ...i, discountAmount: Math.max(0, discount) })
          : i
      ),
    }))
  },

  setItemPrice(productId, price) {
    set((s) => ({
      items: s.items.map((i) =>
        i.product.id === productId
          ? computeLine({ ...i, unitPrice: Math.max(0, price), discountAmount: 0 })
          : i
      ),
    }))
  },

  setSaleDiscount(discount) {
    set({ saleDiscount: Math.max(0, discount) })
  },

  clearCart() {
    set({ items: [], saleDiscount: 0 })
  },

  restoreCart(items, saleDiscount) {
    set({ items, saleDiscount })
  },
}))

// Selectors
export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.lineTotal, 0)
}

export function cartTotal(items: CartItem[], saleDiscount: number) {
  return Math.max(0, cartSubtotal(items) - saleDiscount)
}
