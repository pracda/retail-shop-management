'use client'
import Link from 'next/link'
import { ShoppingCart, AlertCircle } from 'lucide-react'
import type { CatalogProduct } from '@/services/catalogService'

interface Props {
  product: CatalogProduct
  onAddToCart?: (product: CatalogProduct) => void
  adding?: boolean
}

export default function ProductCard({ product, onAddToCart, adding }: Props) {
  const outOfStock = !product.inStock || product.currentStock <= 0
  const lowStock = product.inStock && product.currentStock > 0 && product.currentStock <= 5

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden
                    flex flex-col hover:border-gray-600 transition-colors group">
      {/* Image placeholder */}
      <div className="aspect-square bg-gray-700/50 flex items-center justify-center text-gray-600">
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
      </div>

      <div className="p-4 flex flex-col flex-1">
        {product.categoryName && (
          <span className="text-xs text-primary-400 font-medium mb-1">{product.categoryName}</span>
        )}
        <Link href={`/products/${product.id}`} className="group-hover:text-primary-400 transition-colors">
          <h3 className="font-semibold text-white text-sm leading-snug mb-2 line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {product.description && (
          <p className="text-xs text-gray-400 mb-3 line-clamp-2">{product.description}</p>
        )}

        <div className="mt-auto">
          <div className="flex items-end justify-between gap-2 mb-3">
            <span className="text-lg font-bold text-white">Rs. {product.sellingPrice.toFixed(2)}</span>
            {lowStock && (
              <span className="flex items-center gap-1 text-xs text-yellow-400">
                <AlertCircle className="w-3 h-3" />
                Only {product.currentStock} left
              </span>
            )}
          </div>

          <button
            onClick={() => onAddToCart?.(product)}
            disabled={outOfStock || adding}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm
                       font-medium transition-colors
                       bg-primary-600 hover:bg-primary-700 text-white
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-4 h-4" />
            {outOfStock ? 'Out of Stock' : adding ? 'Adding…' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
