import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import PosLayout from './layouts/PosLayout'
import AdminLayout from './layouts/AdminLayout'
import PosScreen from './pages/pos/PosScreen'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import ProductsPage from './pages/dashboard/ProductsPage'
import InventoryPage from './pages/dashboard/InventoryPage'
import UsersPage from './pages/dashboard/UsersPage'
import ReportsPage from './pages/dashboard/ReportsPage'
import SalesHistoryPage from './pages/dashboard/SalesHistoryPage'
import SettingsPage from './pages/dashboard/SettingsPage'
import SuppliersPage from './pages/dashboard/SuppliersPage'
import PurchaseOrdersPage from './pages/dashboard/PurchaseOrdersPage'
import CustomersPage from './pages/dashboard/CustomersPage'
import AttendancePage from './pages/dashboard/AttendancePage'
import ZReportPage from './pages/dashboard/ZReportPage'
import PromotionsPage from './pages/dashboard/PromotionsPage'
import AuditLogPage from './pages/dashboard/AuditLogPage'
import StoresPage from './pages/dashboard/StoresPage'
import RefundApprovalsPage from './pages/dashboard/RefundApprovalsPage'
import CashReconciliationPage from './pages/dashboard/CashReconciliationPage'
import OnlineOrdersPage from './pages/dashboard/OnlineOrdersPage'

const ADMIN_ROLES = ['MASTER_ADMIN', 'ADMIN', 'MANAGER']
const ALL_ROLES = ['MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER']

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* POS — all roles */}
      <Route element={<ProtectedRoute allowedRoles={ALL_ROLES} />}>
        <Route element={<PosLayout />}>
          <Route path="/pos" element={<PosScreen />} />
        </Route>
      </Route>

      {/* Back office — admin / manager roles */}
      <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/dashboard/users" element={<UsersPage />} />
          <Route path="/dashboard/products" element={<ProductsPage />} />
          <Route path="/dashboard/inventory" element={<InventoryPage />} />
          <Route path="/dashboard/reports" element={<ReportsPage />} />
          <Route path="/dashboard/sales" element={<SalesHistoryPage />} />
          <Route path="/dashboard/settings" element={<SettingsPage />} />
          <Route path="/dashboard/suppliers" element={<SuppliersPage />} />
          <Route path="/dashboard/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/dashboard/customers" element={<CustomersPage />} />
          <Route path="/dashboard/attendance" element={<AttendancePage />} />
          <Route path="/dashboard/z-report" element={<ZReportPage />} />
          <Route path="/dashboard/promotions" element={<PromotionsPage />} />
          <Route path="/dashboard/audit-log" element={<AuditLogPage />} />
          <Route path="/dashboard/stores" element={<StoresPage />} />
          <Route path="/dashboard/refund-approvals" element={<RefundApprovalsPage />} />
          <Route path="/dashboard/cash-reconciliation" element={<CashReconciliationPage />} />
          <Route path="/dashboard/online-orders" element={<OnlineOrdersPage />} />
        </Route>
      </Route>

      {/* Default */}
      <Route element={<ProtectedRoute />}>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
