import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useSelectedStoreStore } from '../../store/selectedStoreStore'
import {
  getAttendanceHistory,
  updateAttendanceSession,
  type CashierSession,
} from '../../services/attendanceService'
import { getUsers } from '../../services/userService'
import { downloadCsv, openPrintWindow, buildHtmlTable } from '../../utils/reportExport'

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function sevenDaysAgoStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function durationMs(session: CashierSession): number {
  if (!session.clockedOutAt) return 0
  return new Date(session.clockedOutAt).getTime() - new Date(session.clockedInAt).getTime()
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function localDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** Convert a UTC ISO string to the local datetime-local input format (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Convert a datetime-local string back to a UTC ISO string */
function fromDatetimeLocal(local: string): string {
  return new Date(local).toISOString()
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditSessionModal({
  session,
  onClose,
}: {
  session: CashierSession
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [clockIn, setClockIn] = useState(toDatetimeLocal(session.clockedInAt))
  const [clockOut, setClockOut] = useState(session.clockedOutAt ? toDatetimeLocal(session.clockedOutAt) : '')
  const [notes, setNotes] = useState(session.notes ?? '')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => {
      if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
        throw new Error('Clock-out must be after clock-in')
      }
      return updateAttendanceSession(
        session.id,
        fromDatetimeLocal(clockIn),
        clockOut ? fromDatetimeLocal(clockOut) : null,
        notes,
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
      onClose()
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      setError(e.response?.data?.error?.message ?? e.message ?? 'Failed to update session')
    },
  })

  function inp(cls = '') {
    return `w-full px-3 py-2 rounded-lg bg-surface-700 border border-surface-600 text-white text-sm
      focus:outline-none focus:border-primary-500 ${cls}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Session</h2>
            <p className="text-surface-400 text-xs mt-0.5">{session.cashierName}</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-3 text-yellow-300 text-xs">
            Use this to correct forgotten clock-ins or clock-outs. All edits are logged.
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Clock In *</label>
            <input
              type="datetime-local"
              value={clockIn}
              onChange={e => setClockIn(e.target.value)}
              className={inp()}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">
              Clock Out
              <span className="text-surface-500 font-normal ml-1">(leave blank if still active)</span>
            </label>
            <input
              type="datetime-local"
              value={clockOut}
              min={clockIn}
              onChange={e => setClockOut(e.target.value)}
              className={inp()}
            />
            {clockOut && (
              <button
                type="button"
                onClick={() => setClockOut('')}
                className="text-xs text-surface-500 hover:text-red-400 mt-1 transition-colors"
              >
                Clear (mark as still active)
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional reason for correction…"
              className={`${inp()} resize-none`}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !clockIn}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {mut.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const user = useAuthStore(s => s.user)
  const { storeId: selectedStore } = useSelectedStoreStore()
  const storeId = user?.role === 'MASTER_ADMIN' ? (selectedStore ?? user.storeId ?? 1) : (user?.storeId ?? 1)

  const canEdit = user?.role === 'MASTER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const [cashierId, setCashierId] = useState<string>('')
  const [fromDate, setFromDate] = useState(sevenDaysAgoStr())
  const [toDate, setToDate] = useState(todayStr())
  const [editingSession, setEditingSession] = useState<CashierSession | null>(null)

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => getUsers(0, 100),
    staleTime: 300_000,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance', storeId, cashierId, fromDate, toDate],
    queryFn: () => getAttendanceHistory(storeId, cashierId ? Number(cashierId) : undefined, fromDate, toDate),
    staleTime: 30_000,
  })

  const sessions = data?.content ?? []

  // group by local calendar date, sorted newest-first
  const grouped = useMemo(() => {
    const map = new Map<string, CashierSession[]>()
    for (const s of sessions) {
      const key = localDateKey(s.clockedInAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [sessions])

  const totalDays = grouped.length
  const totalSessions = sessions.length
  const totalHoursMs = sessions.reduce((sum, s) => sum + durationMs(s), 0)

  // per-cashier totals when a specific employee is selected
  const selectedCashierName = useMemo(() => {
    if (!cashierId) return null
    const u = (users?.content ?? []).find(u => String(u.id) === cashierId)
    return u ? `${u.firstName} ${u.lastName}` : null
  }, [cashierId, users])

  // group totals per cashier for the "All Employees" view summary
  const perCashierMs = useMemo(() => {
    const map = new Map<string, { name: string; ms: number; sessions: number }>()
    for (const s of sessions) {
      const key = String(s.cashierId)
      if (!map.has(key)) map.set(key, { name: s.cashierName, ms: 0, sessions: 0 })
      const entry = map.get(key)!
      entry.ms += durationMs(s)
      entry.sessions += 1
    }
    return Array.from(map.values()).sort((a, b) => b.ms - a.ms)
  }, [sessions])

  function handleExportCsv() {
    if (!sessions.length) return
    const headers = ['Date', 'Employee', 'Clock In', 'Clock Out', 'Duration (min)', 'Notes', 'Status']
    const rows = sessions.map(s => [
      localDateKey(s.clockedInAt),
      s.cashierName,
      formatTime(s.clockedInAt),
      s.clockedOutAt ? formatTime(s.clockedOutAt) : '',
      s.clockedOutAt ? String(Math.round(durationMs(s) / 60000)) : '',
      s.notes ?? '',
      s.clockedOutAt ? 'Clocked Out' : 'Active',
    ])
    downloadCsv(`attendance-${fromDate}-to-${toDate}.csv`, [headers, ...rows])
  }

  function handlePrint() {
    if (!sessions.length) return
    const employeeLabel = selectedCashierName ?? 'All Employees'
    const title = `Attendance Report — ${employeeLabel}`
    const table = buildHtmlTable(
      ['Date', 'Employee', 'Clock In', 'Clock Out', { label: 'Duration', align: 'r' }, 'Notes', 'Status'],
      sessions.map(s => [
        localDateKey(s.clockedInAt),
        s.cashierName,
        formatTime(s.clockedInAt),
        s.clockedOutAt ? formatTime(s.clockedOutAt) : '—',
        s.clockedOutAt ? formatDuration(durationMs(s)) : 'Active',
        s.notes ?? '—',
        s.clockedOutAt ? 'Clocked Out' : 'Active',
      ]),
      ['', '', '', 'Total', formatDuration(totalHoursMs), '', `${totalSessions} sessions`],
    )
    const bodyHtml = `<h1>${title}</h1><p class="meta">Period: ${fromDate} – ${toDate} &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}</p>${table}`
    openPrintWindow(title, bodyHtml)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance</h1>
          <p className="text-surface-400 text-sm mt-1">Day-by-day clock-in / clock-out records</p>
        </div>
        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600
                         text-surface-300 hover:text-white text-sm font-medium transition-colors border border-surface-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600
                         text-surface-300 hover:text-white text-sm font-medium transition-colors border border-surface-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-400 font-medium">Employee</label>
          <select
            value={cashierId}
            onChange={e => setCashierId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm
                       focus:outline-none focus:border-primary-500 min-w-[180px]"
          >
            <option value="">All Employees</option>
            {(users?.content ?? []).map(u => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-400 font-medium">From</label>
          <input type="date" value={fromDate} max={toDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm
                       focus:outline-none focus:border-primary-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-400 font-medium">To</label>
          <input type="date" value={toDate} min={fromDate} max={todayStr()}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-white text-sm
                       focus:outline-none focus:border-primary-500"
          />
        </div>

        <div className="flex gap-2 ml-auto self-end">
          {[
            { label: 'Today', from: todayStr(), to: todayStr() },
            { label: 'Last 7 days', from: sevenDaysAgoStr(), to: todayStr() },
            {
              label: 'This month',
              from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
              to: todayStr(),
            },
          ].map(r => (
            <button key={r.label} onClick={() => { setFromDate(r.from); setToDate(r.to) }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors
                ${fromDate === r.from && toDate === r.to
                  ? 'bg-primary-600 border-primary-500 text-white'
                  : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      {!isLoading && !isError && sessions.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{totalDays}</div>
              <div className="text-xs text-surface-400 mt-1">Days with records</div>
            </div>
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{totalSessions}</div>
              <div className="text-xs text-surface-400 mt-1">Total sessions</div>
            </div>
            <div className="bg-surface-800 border border-primary-600/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-primary-400">{formatDuration(totalHoursMs)}</div>
              <div className="text-xs text-surface-400 mt-1">
                {selectedCashierName ? `Hours worked — ${selectedCashierName}` : 'Total hours worked'}
              </div>
            </div>
          </div>

          {/* Per-cashier breakdown when showing all employees */}
          {!cashierId && perCashierMs.length > 1 && (
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                Hours by Employee
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {perCashierMs.map(e => (
                  <div key={e.name} className="flex items-center justify-between text-sm">
                    <span className="text-surface-300 truncate">{e.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-surface-500 text-xs">{e.sessions} session{e.sessions !== 1 ? 's' : ''}</span>
                      <span className="text-white font-medium w-16 text-right">{formatDuration(e.ms)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Body */}
      {isLoading && <div className="text-surface-400 py-16 text-center">Loading...</div>}
      {isError && <div className="text-red-400 py-8 text-center">Failed to load attendance records</div>}

      {!isLoading && !isError && grouped.length === 0 && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl py-16 text-center text-surface-500">
          No attendance records for the selected period
        </div>
      )}

      {!isLoading && !isError && grouped.map(([dateKey, daySessions]) => {
        const dayTotalMs = daySessions.reduce((sum, s) => sum + durationMs(s), 0)
        const activeCount = daySessions.filter(s => !s.clockedOutAt).length

        return (
          <div key={dateKey} className="mb-4">
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-850 border border-surface-700
                            rounded-t-xl border-b-0">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold text-sm">{formatDayHeader(dateKey)}</span>
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 bg-green-900/40 border border-green-700/50 text-green-400
                                   text-xs rounded-full font-medium">
                    {activeCount} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-surface-400">
                <span>{daySessions.length} session{daySessions.length !== 1 ? 's' : ''}</span>
                <span className="text-surface-300 font-medium">{formatDuration(dayTotalMs)} total</span>
              </div>
            </div>

            {/* Sessions table */}
            <div className="bg-surface-800 border border-surface-700 rounded-b-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700 text-surface-400 text-xs">
                    <th className="text-left px-4 py-2.5 font-medium">Employee</th>
                    <th className="text-left px-4 py-2.5 font-medium">Clock In</th>
                    <th className="text-left px-4 py-2.5 font-medium">Clock Out</th>
                    <th className="text-left px-4 py-2.5 font-medium">Duration</th>
                    <th className="text-left px-4 py-2.5 font-medium">Notes</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    {canEdit && <th className="text-left px-4 py-2.5 font-medium"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {daySessions.map(s => (
                    <tr key={s.id} className="hover:bg-surface-700/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{s.cashierName}</td>
                      <td className="px-4 py-3 text-surface-300">{formatTime(s.clockedInAt)}</td>
                      <td className="px-4 py-3 text-surface-300">
                        {s.clockedOutAt ? formatTime(s.clockedOutAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-300 font-medium">
                        {s.clockedOutAt
                          ? formatDuration(durationMs(s))
                          : <span className="text-green-400">Active</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-surface-400 max-w-xs truncate">
                        {s.notes ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border
                          ${!s.clockedOutAt
                            ? 'bg-green-900/30 text-green-400 border-green-700/30'
                            : 'bg-surface-700 text-surface-400 border-surface-600'}`}>
                          {!s.clockedOutAt ? 'Active' : 'Clocked Out'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditingSession(s)}
                            className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Edit modal */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  )
}
