import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import Modal from '../../components/ui/Modal'
import {
  getSuppliers, createSupplier, updateSupplier, deactivateSupplier,
  type Supplier,
} from '../../services/supplierService'

function SupplierForm({
  storeId, initial, onSuccess, onCancel,
}: {
  storeId: number
  initial?: Supplier
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    contactName: initial?.contactName ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    notes: initial?.notes ?? '',
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => initial
      ? updateSupplier(initial.id, form)
      : createSupplier({ storeId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', storeId] })
      onSuccess()
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(e.response?.data?.error?.message ?? 'An error occurred')
    },
  })

  function inp(cls = '') {
    return `w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-white text-sm
      placeholder-surface-400 focus:outline-none focus:border-primary-500 ${cls}`
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-300 mb-1">Company Name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inp()} placeholder="Supplier Co." />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Contact Name</label>
          <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
            className={inp()} placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Phone</label>
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className={inp()} placeholder="+977 980..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className={inp()} placeholder="supplier@email.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-300 mb-1">Address</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className={inp()} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-surface-300 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className={inp('resize-none')} rows={2} />
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

export default function SuppliersPage() {
  const user = useAuthStore(s => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)
  const qc = useQueryClient()

  const [page, setPage] = useState(0)
  const [modalType, setModalType] = useState<null | 'create' | 'edit'>(null)
  const [selected, setSelected] = useState<Supplier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', storeId, page],
    queryFn: () => getSuppliers(storeId, page, 20),
  })

  const deactivateMut = useMutation({
    mutationFn: deactivateSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers', storeId] }),
  })

  const canEdit = ['MASTER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role ?? '')
  const canDelete = ['MASTER_ADMIN', 'ADMIN'].includes(user?.role ?? '')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="text-surface-400 text-sm mt-1">Manage your suppliers and vendors</p>
        </div>
        {canEdit && (
          <button onClick={() => { setSelected(null); setModalType('create') }}
            className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            + Add Supplier
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-surface-400 py-8 text-center">Loading...</div>
      ) : (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-850">
              <tr>
                {['Company', 'Contact', 'Phone', 'Email', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {(data?.content ?? []).map(s => (
                <tr key={s.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{s.name}</div>
                  </td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{s.contactName ?? '-'}</td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{s.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{s.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border
                      ${s.isActive ? 'bg-green-900/30 text-green-400 border-green-700/30' : 'bg-surface-700 text-surface-400 border-surface-600'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button onClick={() => { setSelected(s); setModalType('edit') }}
                          className="text-primary-400 hover:text-primary-300 text-xs font-medium">
                          Edit
                        </button>
                      )}
                      {canDelete && s.isActive && (
                        <button onClick={() => {
                          if (confirm(`Deactivate ${s.name}?`)) deactivateMut.mutate(s.id)
                        }}
                          className="text-red-400 hover:text-red-300 text-xs font-medium">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(data?.content ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                    No suppliers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
              <span className="text-surface-400 text-sm">
                Page {(data?.page ?? 0) + 1} of {data?.totalPages}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded bg-surface-700 text-white text-sm disabled:opacity-40">
                  Prev
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={data?.last}
                  className="px-3 py-1 rounded bg-surface-700 text-white text-sm disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalType && (
        <Modal
          open
          title={modalType === 'create' ? 'Add Supplier' : 'Edit Supplier'}
          onClose={() => setModalType(null)}
        >
          <SupplierForm
            storeId={storeId}
            initial={modalType === 'edit' ? selected ?? undefined : undefined}
            onSuccess={() => setModalType(null)}
            onCancel={() => setModalType(null)}
          />
        </Modal>
      )}
    </div>
  )
}
