import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { getStore, updateStore } from '../../services/storeService'
import AssistantSettingsCard from '../../components/assistant/AssistantSettingsCard'

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const storeId = user?.storeId ?? 1
  const qc = useQueryClient()

  const { data: store, isLoading } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(storeId),
    staleTime: 60_000,
  })

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (store) {
      setName(store.name ?? '')
      setAddress(store.address ?? '')
      setPhone(store.phone ?? '')
      setEmail(store.email ?? '')
      setTaxRate(store.taxRate != null ? String(store.taxRate) : '0')
    }
  }, [store])

  const updateMut = useMutation({
    mutationFn: () => updateStore(storeId, { name, address, phone, email, taxRate: Number(taxRate) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', storeId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const canSave = ['MASTER_ADMIN', 'ADMIN'].includes(user?.role ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (canSave) updateMut.mutate()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-surface-400 text-sm mt-1">Store configuration</p>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-5">Store Information</h2>

        {isLoading ? (
          <div className="text-surface-400 text-sm py-4">Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Store Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canSave}
                required
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500
                           disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canSave}
                rows={2}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500 resize-none
                           disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canSave}
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                             text-white text-sm focus:outline-none focus:border-primary-500
                             disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canSave}
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                             text-white text-sm focus:outline-none focus:border-primary-500
                             disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-surface-300">Tax Rate</label>
                {taxRate && !isNaN(parseFloat(taxRate)) && parseFloat(taxRate) > 0 && (
                  <span className="text-xs font-semibold text-primary-400">
                    = {(parseFloat(taxRate) * 100).toFixed(2).replace(/\.?0+$/, '')}%
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                disabled={!canSave}
                placeholder="e.g. 0.13"
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-primary-500
                           disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-surface-500 text-xs mt-1">
                Enter as a decimal fraction — e.g. <strong className="text-surface-400">0.13</strong> = 13% VAT (not 13). Default for all taxable products.
              </p>
            </div>

            {!canSave && (
              <p className="text-surface-500 text-xs">
                Only Master Admin and Admin can edit store settings.
              </p>
            )}

            {updateMut.isError && (
              <p className="text-red-400 text-xs">Failed to save. Please try again.</p>
            )}

            {saved && (
              <p className="text-green-400 text-xs">Settings saved successfully.</p>
            )}

            {canSave && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updateMut.isPending}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white
                             text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {updateMut.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      <AssistantSettingsCard />
    </div>
  )
}
