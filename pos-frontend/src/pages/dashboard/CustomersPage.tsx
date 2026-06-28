import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import Modal from '../../components/ui/Modal'
import {
  getCustomers, getCustomer, createCustomer, updateCustomer,
  type Customer,
} from '../../services/customerService'

function CustomerForm({
  storeId, initial, onSuccess, onCancel,
}: {
  storeId: number
  initial?: Customer
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    notes: initial?.notes ?? '',
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => initial
      ? updateCustomer(initial.id, form)
      : createCustomer({ storeId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', storeId] })
      onSuccess()
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(e.response?.data?.error?.message ?? 'An error occurred')
    },
  })

  function inp() {
    return `w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-white text-sm
      placeholder-surface-400 focus:outline-none focus:border-primary-500`
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-300 mb-1">Name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inp()} placeholder="Customer name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Phone</label>
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className={inp()} placeholder="+977 980..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className={inp()} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-300 mb-1">Address</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className={inp()} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-300 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className={`${inp()} resize-none`} rows={2} />
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={mut.isPending}
          className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
          {mut.isPending ? 'Saving...' : (initial ? 'Update' : 'Create')}
        </button>
      </div>
    </form>
  )
}

function CustomerDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id),
  })

  if (isLoading) return <div className="text-surface-400 py-8 text-center">Loading...</div>
  if (!customer) return <div className="text-surface-400">Not found</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-700 rounded-lg p-4">
          <div className="text-xs text-surface-400 mb-1">Loyalty Points</div>
          <div className="text-2xl font-bold text-primary-400">{customer.loyaltyPoints}</div>
        </div>
        <div className="bg-surface-700 rounded-lg p-4">
          <div className="text-xs text-surface-400 mb-1">Total Spent</div>
          <div className="text-2xl font-bold text-white">Rs. {customer.totalSpent.toFixed(2)}</div>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {customer.phone && <div className="flex gap-2"><span className="text-surface-400">Phone:</span><span className="text-white">{customer.phone}</span></div>}
        {customer.email && <div className="flex gap-2"><span className="text-surface-400">Email:</span><span className="text-white">{customer.email}</span></div>}
        {customer.address && <div className="flex gap-2"><span className="text-surface-400">Address:</span><span className="text-white">{customer.address}</span></div>}
        {customer.notes && <div className="flex gap-2"><span className="text-surface-400">Notes:</span><span className="text-white">{customer.notes}</span></div>}
        <div className="flex gap-2"><span className="text-surface-400">Member since:</span><span className="text-white">{new Date(customer.createdAt).toLocaleDateString()}</span></div>
      </div>
      <button onClick={onClose}
        className="w-full bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
        Close
      </button>
    </div>
  )
}

export default function CustomersPage() {
  const user = useAuthStore(s => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)
  useQueryClient()

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modalType, setModalType] = useState<null | 'create' | 'edit' | 'detail'>(null)
  const [selected, setSelected] = useState<Customer | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', storeId, debouncedSearch, page],
    queryFn: () => getCustomers(storeId, debouncedSearch || undefined, page, 20),
  })

  function handleSearch(val: string) {
    setSearch(val)
    clearTimeout((window as { _cst?: ReturnType<typeof setTimeout> })._cst)
    ;(window as { _cst?: ReturnType<typeof setTimeout> })._cst = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(0)
    }, 400)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-surface-400 text-sm mt-1">Manage customers and loyalty points</p>
        </div>
        <button onClick={() => { setSelected(null); setModalType('create') }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full max-w-sm px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm
            placeholder-surface-400 focus:outline-none focus:border-primary-500"
        />
      </div>

      {isLoading ? (
        <div className="text-surface-400 py-8 text-center">Loading...</div>
      ) : (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-850">
              <tr>
                {['Name', 'Phone', 'Email', 'Loyalty Points', 'Total Spent', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {(data?.content ?? []).map(c => (
                <tr key={c.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{c.name}</div>
                  </td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{c.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{c.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-primary-400 font-semibold text-sm">{c.loyaltyPoints}</span>
                  </td>
                  <td className="px-4 py-3 text-surface-300 text-sm">Rs. {c.totalSpent.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelected(c); setModalType('detail') }}
                        className="text-surface-400 hover:text-white text-xs font-medium">
                        View
                      </button>
                      <button onClick={() => { setSelected(c); setModalType('edit') }}
                        className="text-primary-400 hover:text-primary-300 text-xs font-medium">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(data?.content ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
              <span className="text-surface-400 text-sm">Page {(data?.page ?? 0) + 1} of {data?.totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={data?.last}
                  className="px-3 py-1 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {(modalType === 'create' || modalType === 'edit') && (
        <Modal open title={modalType === 'create' ? 'Add Customer' : 'Edit Customer'} onClose={() => setModalType(null)}>
          <CustomerForm
            storeId={storeId}
            initial={modalType === 'edit' ? selected ?? undefined : undefined}
            onSuccess={() => setModalType(null)}
            onCancel={() => setModalType(null)}
          />
        </Modal>
      )}

      {modalType === 'detail' && selected && (
        <Modal open title={selected.name} onClose={() => setModalType(null)}>
          <CustomerDetail id={selected.id} onClose={() => setModalType(null)} />
        </Modal>
      )}
    </div>
  )
}
