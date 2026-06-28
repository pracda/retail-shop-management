import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveStoreId } from '../../hooks/useActiveStoreId'
import Modal from '../../components/ui/Modal'
import {
  getPendingRefunds, approveRefund, rejectRefund,
  type Refund,
} from '../../services/refundService'

function RejectModal({
  refund, onClose,
}: { refund: Refund; onClose: () => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const mut = useMutation({
    mutationFn: () => rejectRefund(refund.id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['refunds-pending'] }); onClose() },
    onError: () => setErr('Failed to reject. Please try again.'),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-300">
        Rejecting refund <span className="text-white font-medium">#{refund.id}</span> for receipt{' '}
        <span className="text-white font-medium">{refund.receiptNumber}</span> — Rs. {refund.refundAmount.toFixed(2)}
      </p>
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1">Rejection reason *</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Explain why this refund is being rejected..."
          className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-white text-sm
            placeholder-surface-400 focus:outline-none focus:border-primary-500 resize-none"
        />
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          Cancel
        </button>
        <button
          onClick={() => { if (!reason.trim()) { setErr('Reason is required'); return }; mut.mutate() }}
          disabled={mut.isPending}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
          {mut.isPending ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
    </div>
  )
}

export default function RefundApprovalsPage() {
  const storeId = useActiveStoreId()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [rejectTarget, setRejectTarget] = useState<Refund | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['refunds-pending', storeId, page],
    queryFn: () => getPendingRefunds(storeId, page, 20),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => approveRefund(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds-pending'] }),
  })

  const refunds = data?.content ?? []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Refund Approvals</h1>
          <p className="text-surface-400 text-sm mt-1">Review and approve pending refund requests from cashiers</p>
        </div>
        <div className="bg-yellow-600/20 border border-yellow-600/30 text-yellow-400 text-sm font-medium px-4 py-2 rounded-lg">
          {data?.totalElements ?? 0} pending
        </div>
      </div>

      {isLoading ? (
        <div className="text-surface-400 py-8 text-center">Loading...</div>
      ) : refunds.length === 0 ? (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-white font-medium">No pending refunds</p>
          <p className="text-surface-400 text-sm mt-1">All refund requests have been processed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {refunds.map(r => (
            <div key={r.id} className="bg-surface-800 border border-surface-700 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-semibold">Receipt {r.receiptNumber}</span>
                    <span className="text-yellow-400 text-xs font-medium bg-yellow-600/20 border border-yellow-600/30 px-2 py-0.5 rounded-full">
                      PENDING
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
                    <div className="flex gap-2">
                      <span className="text-surface-400">Requested by:</span>
                      <span className="text-white">{r.refundedByName}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-surface-400">Amount:</span>
                      <span className="text-white font-semibold">Rs. {r.refundAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-surface-400">Method:</span>
                      <span className="text-white">{r.refundMethod ?? 'CASH'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-surface-400">Submitted:</span>
                      <span className="text-white">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {r.reason && (
                    <div className="bg-surface-700 rounded-lg px-3 py-2 text-sm text-surface-300 mb-3">
                      <span className="text-surface-400 text-xs">Reason: </span>{r.reason}
                    </div>
                  )}
                  {r.items.length > 0 && (
                    <div className="border border-surface-700 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-surface-750">
                          <tr>
                            {['Item', 'Qty', 'Amount'].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-surface-400 font-semibold uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                          {r.items.map(item => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 text-surface-200">{item.productName}</td>
                              <td className="px-3 py-2 text-surface-300">{item.quantity}</td>
                              <td className="px-3 py-2 text-surface-300">Rs. {item.refundAmount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => approveMut.mutate(r.id)}
                    disabled={approveMut.isPending}
                    className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40
                      text-white text-sm font-semibold rounded-lg transition-colors">
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectTarget(r)}
                    className="px-5 py-2 bg-surface-700 hover:bg-red-600/20 border border-surface-600
                      hover:border-red-600/40 text-surface-300 hover:text-red-400 text-sm font-medium
                      rounded-lg transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-surface-400 text-sm">Page {(data?.page ?? 0) + 1} of {data?.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={data?.last}
              className="px-3 py-1.5 rounded bg-surface-700 text-white text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {rejectTarget && (
        <Modal open title="Reject Refund" onClose={() => setRejectTarget(null)}>
          <RejectModal refund={rejectTarget} onClose={() => setRejectTarget(null)} />
        </Modal>
      )}
    </div>
  )
}
