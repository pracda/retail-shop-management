import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import api from '../../services/api'

interface AuditLog {
  id: number
  storeId: number
  userId: number | null
  userName: string | null
  action: string
  entityType: string
  entityId: number | null
  details: string | null
  createdAt: string
}

interface AuditPage {
  content: AuditLog[]
  totalElements: number
  totalPages: number
}

async function getAuditLogs(storeId: number, entityType: string | null, page: number): Promise<AuditPage> {
  const params: Record<string, unknown> = { storeId, page, size: 50 }
  if (entityType) params.entityType = entityType
  const { data } = await api.get('/audit-logs', { params })
  return data.data
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-900/40 text-green-400 border-green-700',
  UPDATE: 'bg-blue-900/40 text-blue-400 border-blue-700',
  DELETE: 'bg-red-900/40 text-red-400 border-red-700',
  VOID:   'bg-red-900/40 text-red-400 border-red-700',
  IMPORT: 'bg-yellow-900/40 text-yellow-400 border-yellow-700',
}

const ENTITY_TYPES = ['', 'PRODUCT', 'SALE', 'CUSTOMER', 'PURCHASE_ORDER']

export default function AuditLogPage() {
  const user = useAuthStore(s => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)

  const [page, setPage] = useState(0)
  const [entityType, setEntityType] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', storeId, entityType, page],
    queryFn: () => getAuditLogs(storeId, entityType || null, page),
    staleTime: 30_000,
  })

  const logs = data?.content ?? []
  const totalPages = data?.totalPages ?? 1

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-surface-400 text-sm mt-1">Track all changes across your store</p>
        </div>
        <div className="flex gap-2">
          {ENTITY_TYPES.map((et) => (
            <button
              key={et || 'all'}
              onClick={() => { setEntityType(et); setPage(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${entityType === et
                  ? 'bg-primary-600 border-primary-500 text-white'
                  : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white'}`}
            >
              {et || 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-surface-400 text-center py-16">Loading...</div>
      )}
      {isError && (
        <div className="text-red-400 text-center py-8">Failed to load audit log</div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 text-surface-400 text-xs">
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-surface-500">No audit logs yet</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-700/40 transition-colors">
                      <td className="px-4 py-3 text-surface-400 text-xs whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-surface-300 text-xs">
                        {log.userName ?? <span className="text-surface-600 italic">System</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border
                          ${ACTION_COLORS[log.action] ?? 'bg-surface-700 text-surface-300 border-surface-600'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="text-surface-300">{log.entityType}</span>
                        {log.entityId && (
                          <span className="text-surface-600 ml-1">#{log.entityId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-xs truncate">
                        {log.details ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700
                           text-surface-300 disabled:opacity-40 hover:bg-surface-700 transition-colors">
                ← Prev
              </button>
              <span className="text-surface-400 text-sm">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700
                           text-surface-300 disabled:opacity-40 hover:bg-surface-700 transition-colors">
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
