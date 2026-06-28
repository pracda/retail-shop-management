import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import Modal from '../../components/ui/Modal'
import { getSuppliers } from '../../services/supplierService'
import { getProducts } from '../../services/productService'
import {
  getPurchaseOrders, createPurchaseOrder,
  markOrdered, receiveItems, cancelPurchaseOrder,
  type PurchaseOrder, type POStatus,
} from '../../services/purchaseOrderService'

const STATUS_COLORS: Record<POStatus, string> = {
  DRAFT: 'bg-surface-700 text-surface-300 border-surface-600',
  ORDERED: 'bg-blue-900/30 text-blue-400 border-blue-700/30',
  PARTIALLY_RECEIVED: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30',
  RECEIVED: 'bg-green-900/30 text-green-400 border-green-700/30',
  CANCELLED: 'bg-red-900/30 text-red-400 border-red-700/30',
}

function CreatePOForm({ storeId, onSuccess, onCancel }: { storeId: number; onSuccess: () => void; onCancel: () => void }) {
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<{ productId: string; quantityOrdered: string; unitCost: string }[]>([
    { productId: '', quantityOrdered: '', unitCost: '' }
  ])
  const [error, setError] = useState('')

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list', storeId],
    queryFn: () => getSuppliers(storeId, 0, 100),
  })
  const { data: products } = useQuery({
    queryKey: ['products-list', storeId],
    queryFn: () => getProducts({ storeId, page: 0, size: 200 }),
  })

  const mut = useMutation({
    mutationFn: () => createPurchaseOrder({
      storeId,
      supplierId: Number(supplierId),
      notes,
      items: lines.filter(l => l.productId).map(l => ({
        productId: Number(l.productId),
        quantityOrdered: Number(l.quantityOrdered),
        unitCost: Number(l.unitCost),
      })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders', storeId] }); onSuccess() },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(e.response?.data?.error?.message ?? 'Error creating order')
    },
  })

  function inp() {
    return 'px-2 py-1.5 rounded bg-surface-700 border border-surface-600 text-white text-sm focus:outline-none focus:border-primary-500 w-full'
  }

  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate() }} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1">Supplier *</label>
        <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inp()}>
          <option value="">Select supplier</option>
          {suppliers?.content.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-surface-300 mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inp()} resize-none`} rows={2} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-surface-300">Line Items</label>
          <button type="button" onClick={() => setLines(l => [...l, { productId: '', quantityOrdered: '', unitCost: '' }])}
            className="text-xs text-primary-400 hover:text-primary-300">+ Add Line</button>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <select value={line.productId} onChange={e => setLines(l => l.map((x, j) => j === i ? { ...x, productId: e.target.value } : x))}
                  className={inp()}>
                  <option value="">Product</option>
                  {products?.content.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <input type="number" min="0.001" step="0.001" value={line.quantityOrdered}
                  onChange={e => setLines(l => l.map((x, j) => j === i ? { ...x, quantityOrdered: e.target.value } : x))}
                  className={inp()} placeholder="Qty" />
              </div>
              <div className="col-span-3">
                <input type="number" min="0" step="0.01" value={line.unitCost}
                  onChange={e => setLines(l => l.map((x, j) => j === i ? { ...x, unitCost: e.target.value } : x))}
                  className={inp()} placeholder="Cost" />
              </div>
              <div className="col-span-1 flex justify-center">
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines(l => l.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-300 text-sm">x</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">Cancel</button>
        <button type="submit" disabled={mut.isPending}
          className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
          {mut.isPending ? 'Creating...' : 'Create Order'}
        </button>
      </div>
    </form>
  )
}

function ReceiveModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const qc = useQueryClient()
  const [quantities, setQuantities] = useState<Record<number, string>>(
    Object.fromEntries(po.items.map(i => [i.id, '']))
  )
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => receiveItems(po.id, po.items
      .filter(i => quantities[i.id] && Number(quantities[i.id]) > 0)
      .map(i => ({ poItemId: i.id, quantityReceived: Number(quantities[i.id]) }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); onClose() },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      setError(e.response?.data?.error?.message ?? 'Error receiving items')
    },
  })

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {po.items.map(item => (
          <div key={item.id} className="bg-surface-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">{item.productName}</span>
              <span className="text-surface-400 text-xs">
                {item.quantityReceived}/{item.quantityOrdered} received
              </span>
            </div>
            <input
              type="number" min="0" step="0.001"
              placeholder="Qty receiving now"
              value={quantities[item.id]}
              onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))}
              className="w-full px-2 py-1.5 rounded bg-surface-600 border border-surface-500 text-white text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">Cancel</button>
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
          {mut.isPending ? 'Saving...' : 'Confirm Receipt'}
        </button>
      </div>
    </div>
  )
}

export default function PurchaseOrdersPage() {
  const user = useAuthStore(s => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)
  const qc = useQueryClient()

  const [page, setPage] = useState(0)
  const [modalType, setModalType] = useState<null | 'create' | 'receive' | 'detail'>(null)
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', storeId, page],
    queryFn: () => getPurchaseOrders(storeId, page, 20),
  })

  const orderMut = useMutation({
    mutationFn: markOrdered,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', storeId] }),
  })
  const cancelMut = useMutation({
    mutationFn: cancelPurchaseOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', storeId] }),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
          <p className="text-surface-400 text-sm mt-1">Manage stock replenishment orders</p>
        </div>
        <button onClick={() => setModalType('create')}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + New Order
        </button>
      </div>

      {isLoading ? (
        <div className="text-surface-400 py-8 text-center">Loading...</div>
      ) : (
        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-850">
              <tr>
                {['PO Number', 'Supplier', 'Status', 'Items', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {(data?.content ?? []).map(po => (
                <tr key={po.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="px-4 py-3 text-white font-mono text-sm">{po.poNumber}</td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{po.supplierName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[po.status]}`}>
                      {po.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{po.items.length} items</td>
                  <td className="px-4 py-3 text-surface-300 text-sm">{new Date(po.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {po.status === 'DRAFT' && (
                        <button onClick={() => orderMut.mutate(po.id)}
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium">Mark Ordered</button>
                      )}
                      {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <button onClick={() => { setSelected(po); setModalType('receive') }}
                          className="text-green-400 hover:text-green-300 text-xs font-medium">Receive</button>
                      )}
                      {(po.status === 'DRAFT' || po.status === 'ORDERED') && (
                        <button onClick={() => { if (confirm('Cancel this order?')) cancelMut.mutate(po.id) }}
                          className="text-red-400 hover:text-red-300 text-xs font-medium">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(data?.content ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">No purchase orders found</td></tr>
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

      {modalType === 'create' && (
        <Modal open title="New Purchase Order" onClose={() => setModalType(null)}>
          <CreatePOForm storeId={storeId} onSuccess={() => setModalType(null)} onCancel={() => setModalType(null)} />
        </Modal>
      )}

      {modalType === 'receive' && selected && (
        <Modal open title={`Receive Items — ${selected.poNumber}`} onClose={() => setModalType(null)}>
          <ReceiveModal po={selected} onClose={() => setModalType(null)} />
        </Modal>
      )}
    </div>
  )
}
