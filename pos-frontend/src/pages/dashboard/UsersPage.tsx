import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'
import {
  getUsers, createUser, updateUser, setUserStatus, assignPin, changeRole,
  ROLES, ROLE_COLORS, type User,
} from '../../services/userService'

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName:  z.string().min(2).max(50),
  email:     z.string().email('Invalid email'),
  phone:     z.string().optional().or(z.literal('')),
  password:  z.string()
    .min(8, 'Min 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Needs upper, lower, number & symbol'),
  roleId:    z.coerce.number().min(1, 'Select a role'),
  storeId:   z.coerce.number().optional().nullable(),
  pin:       z.string().regex(/^\d{4,6}$/, 'Must be 4–6 digits').optional().or(z.literal('')),
})
type CreateForm = z.infer<typeof createSchema>

const editSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName:  z.string().min(2).max(50),
  email:     z.string().email('Invalid email'),
  phone:     z.string().optional().or(z.literal('')),
})
type EditForm = z.infer<typeof editSchema>

const pinSchema = z.object({
  pin: z.string().min(4, 'Min 4 digits').max(6, 'Max 6 digits').regex(/^\d+$/, 'Digits only'),
})
type PinForm = z.infer<typeof pinSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function inputCls(err?: boolean) {
  return `w-full px-3 py-2 rounded-lg bg-surface-700 border text-white text-sm
    placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-600
    focus:border-transparent transition ${err ? 'border-red-500' : 'border-surface-500'}`
}
function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-400">{msg}</p> : null
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border
      ${ROLE_COLORS[role] ?? 'bg-surface-700 text-surface-300 border-surface-600'}`}>
      {ROLES.find(r => r.name === role)?.label ?? role}
    </span>
  )
}

// ── Create User Form ──────────────────────────────────────────────────────────

function CreateUserForm({ storeId, onSuccess, onCancel }: {
  storeId: number; onSuccess: () => void; onCancel: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CreateForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createSchema) as any,
    defaultValues: { roleId: 4, storeId },
  })
  const mutation = useMutation({
    mutationFn: (d: CreateForm) => createUser({
      ...d,
      phone: d.phone || undefined,
      storeId: d.storeId ?? undefined,
      pin: d.pin || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onSuccess() },
  })
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">First name *</label>
          <input {...register('firstName')} className={inputCls(!!errors.firstName)} />
          <Err msg={errors.firstName?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Last name *</label>
          <input {...register('lastName')} className={inputCls(!!errors.lastName)} />
          <Err msg={errors.lastName?.message} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">Email *</label>
        <input type="email" {...register('email')} className={inputCls(!!errors.email)} />
        <Err msg={errors.email?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Phone</label>
          <input {...register('phone')} placeholder="+977..." className={inputCls()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Role *</label>
          <select {...register('roleId')} className={inputCls(!!errors.roleId)}>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <Err msg={errors.roleId?.message} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">Password *</label>
        <input type="password" {...register('password')} placeholder="Min 8 chars, upper+lower+number+symbol"
          className={inputCls(!!errors.password)} />
        <Err msg={errors.password?.message} />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">
          PIN <span className="text-surface-500 font-normal">(4–6 digits, optional — for POS terminal login)</span>
        </label>
        <input
          {...register('pin')}
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="e.g. 1234"
          className={`${inputCls(!!errors.pin)} font-mono tracking-widest`}
        />
        <Err msg={errors.pin?.message} />
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          {(mutation.error as Error)?.message ?? 'Failed to create user'}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300 hover:bg-surface-700 text-sm">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm disabled:opacity-50">
          {mutation.isPending ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </form>
  )
}

// ── Edit User Form ────────────────────────────────────────────────────────────

function EditUserForm({ user, onSuccess, onCancel }: {
  user: User; onSuccess: () => void; onCancel: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(editSchema) as any,
    defaultValues: { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? '' },
  })
  const mutation = useMutation({
    mutationFn: (d: EditForm) => updateUser(user.id, { ...d, phone: d.phone || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onSuccess() },
  })
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">First name *</label>
          <input {...register('firstName')} className={inputCls(!!errors.firstName)} />
          <Err msg={errors.firstName?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Last name *</label>
          <input {...register('lastName')} className={inputCls(!!errors.lastName)} />
          <Err msg={errors.lastName?.message} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Email *</label>
          <input type="email" {...register('email')} className={inputCls(!!errors.email)} />
          <Err msg={errors.email?.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1">Phone</label>
          <input {...register('phone')} className={inputCls()} />
        </div>
      </div>
      <div className="px-3 py-2 rounded-lg bg-surface-700/50 border border-surface-600">
        <p className="text-xs text-surface-400">Role: <span className="text-white font-medium">{user.role}</span>
          <span className="ml-2 text-surface-500">— use the shield icon to change role</span></p>
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          {(mutation.error as Error)?.message ?? 'Failed to update user'}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300 hover:bg-surface-700 text-sm">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}
          className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

// ── Assign PIN Form ───────────────────────────────────────────────────────────

function AssignPinForm({ user, onSuccess, onCancel }: {
  user: User; onSuccess: () => void; onCancel: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<PinForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(pinSchema) as any,
  })
  const mutation = useMutation({
    mutationFn: (d: PinForm) => assignPin(user.id, d.pin),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onSuccess() },
  })
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <p className="text-sm text-surface-400">
        Setting PIN for <span className="text-white font-medium">{user.firstName} {user.lastName}</span>.
        The cashier will use this PIN to log in at the POS terminal.
      </p>
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">PIN (4–6 digits) *</label>
        <input
          {...register('pin')}
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••"
          className={`${inputCls(!!errors.pin)} text-center text-2xl tracking-widest font-mono`}
        />
        <Err msg={errors.pin?.message} />
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          {(mutation.error as Error)?.message ?? 'Failed to set PIN'}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="text-sm text-primary-400 bg-primary-900/20 border border-primary-700 rounded-lg px-3 py-2">
          PIN set successfully
        </p>
      )}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300 hover:bg-surface-700 text-sm">
          Close
        </button>
        <button type="submit" disabled={mutation.isPending || mutation.isSuccess}
          className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm disabled:opacity-50">
          {mutation.isPending ? 'Setting…' : 'Set PIN'}
        </button>
      </div>
    </form>
  )
}

// ── Change Role Form ──────────────────────────────────────────────────────────

function ChangeRoleForm({ user, onSuccess, onCancel }: {
  user: User; onSuccess: () => void; onCancel: () => void
}) {
  const qc = useQueryClient()
  const [roleId, setRoleId] = useState(user.roleId)
  const mutation = useMutation({
    mutationFn: () => changeRole(user.id, roleId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onSuccess() },
  })
  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-400">
        Changing role for <span className="text-white font-medium">{user.firstName} {user.lastName}</span>.
        Current role: <span className="text-white font-medium">{user.role}</span>
      </p>
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1">New Role *</label>
        <select
          value={roleId}
          onChange={(e) => setRoleId(Number(e.target.value))}
          className={inputCls()}
        >
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
          {(mutation.error as Error)?.message ?? 'Failed to change role'}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300 hover:bg-surface-700 text-sm">
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || roleId === user.roleId}
          className="px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : 'Change Role'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | null
  | 'create'
  | { type: 'edit'; user: User }
  | { type: 'pin';  user: User }
  | { type: 'role'; user: User }

const ROLE_FILTER_OPTIONS = ['All', 'ADMIN', 'MANAGER', 'CASHIER'] as const

export default function UsersPage() {
  const storeId   = useAuthStore(s => s.user?.storeId) ?? 1
  const qc        = useQueryClient()
  const [page, setPage]         = useState(0)
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [modal, setModal]       = useState<ModalState>(null)

  const { data: usersPage, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers(page),
  })

  const toggleStatus = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setUserStatus(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = (usersPage?.content ?? []).filter(u =>
    roleFilter === 'All' || u.role === roleFilter,
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-white font-semibold text-lg">Users</h1>
          {/* Role filter tabs */}
          <div className="flex gap-1">
            {ROLE_FILTER_OPTIONS.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${roleFilter === r
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                    : 'text-surface-400 hover:text-white border border-transparent'}`}>
                {r === 'All' ? 'All' : ROLES.find(x => x.name === r)?.label ?? r}
              </button>
            ))}
          </div>
          <span className="text-surface-500 text-sm">{usersPage?.totalElements ?? 0} total</span>
        </div>
        <button onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700
                     text-white text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add user
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-surface-400 text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-surface-500">
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-800 border-b border-surface-700 sticky top-0">
              <tr>
                {['Name', 'Email', 'Phone', 'Role', 'Store', 'Last login', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-600 flex items-center justify-center
                                      text-xs font-bold text-white shrink-0">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <div className="text-white font-medium">{u.firstName} {u.lastName}</div>
                        <div className="text-surface-500 text-xs">ID #{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-surface-300">{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-surface-400">{u.phone ?? '—'}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-surface-400">{u.storeName ?? '—'}</td>
                  <td className="px-4 py-3 text-surface-500 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                      ${u.isActive
                        ? 'bg-primary-600/20 text-primary-400'
                        : 'bg-surface-700 text-surface-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Edit */}
                      <button onClick={() => setModal({ type: 'edit', user: u })}
                        title="Edit" className="p-1.5 rounded text-surface-400 hover:text-primary-400 hover:bg-surface-700 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* PIN */}
                      {(u.role === 'CASHIER' || u.role === 'MANAGER') && (
                        <button onClick={() => setModal({ type: 'pin', user: u })}
                          title="Set PIN" className="p-1.5 rounded text-surface-400 hover:text-yellow-400 hover:bg-surface-700 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </button>
                      )}
                      {/* Change Role */}
                      <button onClick={() => setModal({ type: 'role', user: u })}
                        title="Change role" className="p-1.5 rounded text-surface-400 hover:text-purple-400 hover:bg-surface-700 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                      {/* Activate / Deactivate */}
                      <button
                        onClick={() => toggleStatus.mutate({ id: u.id, active: !u.isActive })}
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded hover:bg-surface-700 transition-colors
                          ${u.isActive ? 'text-surface-400 hover:text-red-400' : 'text-surface-400 hover:text-primary-400'}`}>
                        {u.isActive ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(usersPage?.totalPages ?? 0) > 1 && (
        <div className="px-6 py-3 border-t border-surface-700 flex items-center justify-between">
          <span className="text-surface-400 text-sm">Page {page + 1} of {usersPage?.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm disabled:opacity-40 hover:bg-surface-600">Previous</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= (usersPage?.totalPages ?? 1) - 1}
              className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-sm disabled:opacity-40 hover:bg-surface-600">Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Add user">
        <CreateUserForm storeId={storeId} onSuccess={() => setModal(null)} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal !== null && typeof modal === 'object' && modal.type === 'edit'}
        onClose={() => setModal(null)} title="Edit user">
        {modal !== null && typeof modal === 'object' && modal.type === 'edit' && (
          <EditUserForm user={modal.user} onSuccess={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
      </Modal>
      <Modal open={modal !== null && typeof modal === 'object' && modal.type === 'pin'}
        onClose={() => setModal(null)} title="Assign PIN">
        {modal !== null && typeof modal === 'object' && modal.type === 'pin' && (
          <AssignPinForm user={modal.user} onSuccess={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
      </Modal>
      <Modal open={modal !== null && typeof modal === 'object' && modal.type === 'role'}
        onClose={() => setModal(null)} title="Change Role">
        {modal !== null && typeof modal === 'object' && modal.type === 'role' && (
          <ChangeRoleForm user={modal.user} onSuccess={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
      </Modal>
    </div>
  )
}
