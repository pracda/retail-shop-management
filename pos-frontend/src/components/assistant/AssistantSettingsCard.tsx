import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useActiveStoreId, useActiveStoreName } from '../../hooks/useActiveStoreId'
import { getAssistantConfig, updateAssistantKey } from '../../services/assistantService'

/**
 * Per-store AI assistant key management. Each store can hold its own Secure LLM Gateway key;
 * when empty, the store falls back to the server default. MASTER_ADMIN configures whichever
 * store is selected; an ADMIN configures their own store.
 */
export default function AssistantSettingsCard() {
  const user = useAuthStore((s) => s.user)
  const storeId = useActiveStoreId()
  const storeName = useActiveStoreName()
  const qc = useQueryClient()
  const canEdit = ['MASTER_ADMIN', 'ADMIN'].includes(user?.role ?? '')

  const [keyInput, setKeyInput] = useState('')
  const [saved, setSaved] = useState('')

  const { data: config, isLoading } = useQuery({
    queryKey: ['assistant-config', storeId],
    queryFn: () => getAssistantConfig(storeId),
    staleTime: 30_000,
  })

  const saveMut = useMutation({
    mutationFn: (key: string) => updateAssistantKey(storeId, key),
    onSuccess: (_res, key) => {
      qc.invalidateQueries({ queryKey: ['assistant-config', storeId] })
      setKeyInput('')
      setSaved(key ? 'Key saved for this store.' : 'Key cleared — using the server default.')
      setTimeout(() => setSaved(''), 3500)
    },
  })

  function statusLine() {
    if (!config) return null
    if (!config.gatewayConfigured) {
      return <span className="text-yellow-400">The AI assistant isn't enabled on this server.</span>
    }
    if (config.storeKeyConfigured) {
      return (
        <span className="text-green-400">
          Using this store's own key: <span className="font-mono">{config.keyPreview}</span>
        </span>
      )
    }
    if (config.usingServerDefault) {
      return <span className="text-surface-300">Using the server default key (no store-specific key set).</span>
    }
    return <span className="text-yellow-400">No key configured — the assistant is unavailable for this store.</span>
  }

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 mt-6">
      <div className="flex items-center gap-2.5 mb-1">
        <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
        </svg>
        <h2 className="text-sm font-semibold text-white">AI Assistant</h2>
      </div>
      <p className="text-surface-400 text-xs mb-4">
        Gateway API key for <span className="text-surface-200 font-medium">{storeName}</span>. Each store
        can use its own key; leave empty to use the server default.
      </p>

      {isLoading ? (
        <div className="text-surface-400 text-sm py-2">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5">
            {statusLine()}
          </div>

          {canEdit ? (
            <>
              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">
                  {config?.storeKeyConfigured ? 'Replace key' : 'Set key'}
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="gw_live_…"
                  autoComplete="off"
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                             text-white text-sm font-mono focus:outline-none focus:border-primary-500"
                />
                <p className="text-surface-500 text-xs mt-1">
                  Paste the store's gateway API key. It's stored securely and never shown in full again.
                </p>
              </div>

              {saveMut.isError && (
                <p className="text-red-400 text-xs">
                  {(saveMut.error as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Failed to save. Please try again.'}
                </p>
              )}
              {saved && <p className="text-green-400 text-xs">{saved}</p>}

              <div className="flex justify-between items-center pt-1">
                {config?.storeKeyConfigured ? (
                  <button
                    onClick={() => saveMut.mutate('')}
                    disabled={saveMut.isPending}
                    className="text-surface-400 hover:text-red-400 text-xs disabled:opacity-50 transition-colors"
                  >
                    Clear key (use server default)
                  </button>
                ) : <span />}
                <button
                  onClick={() => saveMut.mutate(keyInput.trim())}
                  disabled={saveMut.isPending || !keyInput.trim()}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white
                             text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {saveMut.isPending ? 'Saving…' : 'Save Key'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-surface-500 text-xs">Only Master Admin and Admin can manage the assistant key.</p>
          )}
        </div>
      )}
    </div>
  )
}
