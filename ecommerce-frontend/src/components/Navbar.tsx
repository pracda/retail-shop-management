'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { logout } from '@/services/authService'
import { ShoppingCart, User, LogOut, Package, LogIn } from 'lucide-react'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout: clearAuth, isLoggedIn } = useAuthStore()
  const itemCount = useCartStore((s) => s.itemCount)

  async function handleLogout() {
    await logout()
    clearAuth()
    router.push('/auth/login')
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors hover:text-primary-400 ${
        pathname.startsWith(href) ? 'text-primary-400' : 'text-gray-300'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-6">
        {/* Brand */}
        <Link href="/products" className="font-bold text-xl text-white tracking-tight flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-400" />
          MartShop
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-6">
          {navLink('/products', 'Products')}
          {isLoggedIn() && navLink('/orders', 'My Orders')}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Cart */}
          <Link
            href="/cart"
            className="relative p-2 text-gray-300 hover:text-white transition-colors"
            aria-label="Cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold
                               bg-primary-500 text-white rounded-full flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>

          {isLoggedIn() ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-400">
                <User className="w-4 h-4" />
                <span>{user?.firstName}</span>
                {(user?.loyaltyPoints ?? 0) > 0 && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                                   px-1.5 py-0.5 rounded-full">
                    {user!.loyaltyPoints} pts
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-300
                         hover:text-white transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
