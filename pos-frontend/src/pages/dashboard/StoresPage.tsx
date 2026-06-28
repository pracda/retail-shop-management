import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  getStores, createStore, updateStore, deactivateStore,
  type StoreInfo,
} from '../../services/storeService'

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtTax(v?: number) {
  if (v == null) return '—'
  const pct = v * 100
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`
}

// ── Form modal ───────────────────────────────────────────────────────────────

interface StoreFormValues {
  name: string
  address: string
  phone: string
  email: string
  taxRate: string
}

function StoreModal({
  store,
  onClose,
}: {
  store?: StoreInfo
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!store

  const { register, handleSubmit, formState: { errors }, watch } = useForm<StoreFormValues>({
    defaultValues: {
      name: store?.name ?? '',
      address: store?.address ?? '',
      phone: store?.phone ?? '',
      email: store?.email ?? '',
      taxRate: store?.taxRate != null ? String(store.taxRate) : '',
    },
  })

  const watchedTax = watch('taxRate')

  const createMut = useMutation({
    mutationFn: (vals: StoreFormValues) => createStore({
      name: vals.name,
      address: vals.address || undefined,
      phone: vals.phone || undefined,
      email: vals.email || undefined,
      taxRate: vals.taxRate ? parseFloat(vals.taxRate) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-stores'] })
      onClose()
    },
  })

  const updateMut = useMutation({
    mutationFn: (vals: StoreFormValues) => updateStore(store!.id, {
      name: vals.name,
      address: vals.address || undefined,
      phone: vals.phone || undefined,
      email: vals.email || undefined,
      taxRate: vals.taxRate ? parseFloat(vals.taxRate) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-stores'] })
      onClose()
    },
  })

  const mut = isEdit ? updateMut : createMut
  const taxPct = watchedTax && !isNaN(parseFloat(watchedTax)) && parseFloat(watchedTax) > 0
    ? (parseFloat(watchedTax) * 100).toFixed(2).replace(/\.?0+$/, '') + '%'
    : null

  function onSubmit(vals: StoreFormValues) {
    mut.mutate(vals)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Store' : 'New Store'}</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">
              Store Name <span className="text-red-400">*</span>
            </label>
            <input
              {...register('name', { required: 'Name is required', maxLength: 100 })}
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-primary-500"
              placeholder="e.g. Main Branch"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Address</label>
            <input
              {...register('address')}
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-primary-500"
              placeholder="Street, City"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Phone</label>
              <input
                {...register('phone')}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500"
                placeholder="98XXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Email</label>
              <input
                {...register('email')}
                type="email"
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500"
                placeholder="store@example.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-surface-300">Tax Rate</label>
              {taxPct && (
                <span className="text-xs font-semibold text-primary-400">= {taxPct}</span>
              )}
            </div>
            <input
              {...register('taxRate', {
                validate: (v) => {
                  if (!v) return true
                  const n = parseFloat(v)
                  if (isNaN(n)) return 'Must be a number'
                  if (n < 0 || n > 1) return 'Must be between 0.0 and 1.0'
                  return true
                },
              })}
              className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                         text-white text-sm focus:outline-none focus:border-primary-500"
              placeholder="e.g. 0.13 for 13%"
            />
            {errors.taxRate && <p className="text-red-400 text-xs mt-1">{errors.taxRate.message}</p>}
            <p className="text-xs text-surface-500 mt-1">
              Enter as a decimal fraction — e.g. <strong>0.13</strong> = 13% VAT
            </p>
          </div>

          {mut.isError && (
            <p className="text-red-400 text-xs">
              {(mut.error as { response?: { data?: { error?: { message?: string } } } })
                ?.response?.data?.error?.message ?? 'Something went wrong'}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                         font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white
                         text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {mut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Deactivate confirm ───────────────────────────────────────────────────────

function DeactivateConfirm({ store, onClose }: { store: StoreInfo; onClose: () => void }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: () => deactivateStore(store.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-stores'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white mb-1">Deactivate Store?</h2>
            <p className="text-sm text-surface-300">
              <strong className="text-white">{store.name}</strong> will be marked inactive and hidden from
              the store selector. This action can be reversed by contacting a developer.
            </p>
          </div>
        </div>

        {mut.isError && (
          <p className="text-red-400 text-xs mb-3">
            {(mut.error as { response?: { data?: { error?: { message?: string } } } })
              ?.response?.data?.error?.message ?? 'Failed to deactivate store'}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm
                       font-medium py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white
                       text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {mut.isPending ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function StoresPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [editStore, setEditStore] = useState<StoreInfo | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<StoreInfo | null>(null)

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['all-stores'],
    queryFn: getStores,
    staleTime: 60_000,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stores</h1>
          <p className="text-surface-400 text-sm mt-0.5">Manage all store locations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white
                     text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Store
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-surface-400 text-sm">
            Loading stores…
          </div>
        ) : stores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="w-10 h-10 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1
                   4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-surface-400 text-sm">No stores yet. Create your first store.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left px-5 py-3 text-surface-400 font-medium">Name</th>
                <th className="text-left px-5 py-3 text-surface-400 font-medium">Address</th>
                <th className="text-left px-5 py-3 text-surface-400 font-medium">Phone</th>
                <th className="text-left px-5 py-3 text-surface-400 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-surface-400 font-medium">Tax Rate</th>
                <th className="text-left px-5 py-3 text-surface-400 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {stores.map((s) => (
                <tr key={s.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-white">{s.name}</td>
                  <td className="px-5 py-3.5 text-surface-300 max-w-[180px] truncate">{s.address || '—'}</td>
                  <td className="px-5 py-3.5 text-surface-300">{s.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-surface-300 max-w-[160px] truncate">{s.email || '—'}</td>
                  <td className="px-5 py-3.5 text-surface-300">{fmtTax(s.taxRate)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      ${s.isActive
                        ? 'bg-green-900/30 text-green-400 border border-green-800/50'
                        : 'bg-surface-700 text-surface-400 border border-surface-600'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditStore(s)}
                        className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-600
                                   rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2
                               2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {s.isActive && (
                        <button
                          onClick={() => setDeactivateTarget(s)}
                          className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-red-900/20
                                     rounded-lg transition-colors"
                          title="Deactivate"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreate && <StoreModal onClose={() => setShowCreate(false)} />}
      {editStore && <StoreModal store={editStore} onClose={() => setEditStore(null)} />}
      {deactivateTarget && (
        <DeactivateConfirm store={deactivateTarget} onClose={() => setDeactivateTarget(null)} />
      )}
    </div>
  )
}
