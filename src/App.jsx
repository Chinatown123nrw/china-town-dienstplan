import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const shiftTimes = [
  { label: 'Mittag', start_time: '11:00', end_time: '15:00', people: 3 },
  { label: 'Abend 1', start_time: '17:00', end_time: '20:00', people: 4 },
  { label: 'Abend 2', start_time: '20:00', end_time: '22:30', people: 4 },
]
const roleOptions = ['Gesch\u00e4ftsf\u00fchrer', 'Service', 'K\u00fcche', 'Bar', 'Kasse', 'Lieferung', 'Aushilfe']
const blacklist = [['11-gokay-sahin', '15-melik-hak']]

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none transition focus:border-yellow-400'
const compactInputClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none transition focus:border-yellow-400'
const emptyEmployeeForm = {
  id: null,
  auth_user_id: '',
  name: '',
  slug: '',
  role: 'Service',
  is_admin: false,
}

function formatTime(start, end) {
  return `${start?.slice(0, 5) ?? '--:--'} - ${end?.slice(0, 5) ?? '--:--'}`
}

function formatName(name) {
  return name.replace(/^\d+-/, '').replaceAll('-', ' ')
}

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(' ', '-')
    .replace(/[^a-z0-9-]/g, '')
}

function employeeFromUser(user, employees) {
  if (!user) {
    return null
  }

  return employees.find((employee) => employee.auth_user_id === user.id) ?? null
}

function sameShift(a, b) {
  return a.day === b.day && a.start_time === b.start_time && a.end_time === b.end_time
}

function hasConflict(rows, candidate) {
  return blacklist.some((pair) => {
    if (!pair.includes(candidate.employee_name)) {
      return false
    }

    return rows.some(
      (row) => sameShift(row, candidate) && pair.includes(row.employee_name) && row.employee_name !== candidate.employee_name,
    )
  })
}

function sortRows(a, b) {
  return (
    days.indexOf(a.day) - days.indexOf(b.day) ||
    a.start_time.localeCompare(b.start_time) ||
    (a.employee_name ?? '').localeCompare(b.employee_name ?? '')
  )
}

export default function ChinaTownDienstplan() {
  const [sessionUser, setSessionUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const activeEmployee = useMemo(() => employeeFromUser(sessionUser, employees), [sessionUser, employees])
  const isAdmin = Boolean(activeEmployee?.is_admin)
  const employeesBySlug = useMemo(
    () => new Map(employees.map((employee) => [employee.slug, employee])),
    [employees],
  )

  const openShifts = useMemo(
    () =>
      rows
        .filter((row) => row.open)
        .map((row) => ({
          ...row,
          shift: formatTime(row.start_time, row.end_time),
        })),
    [rows],
  )

  const calendarDays = useMemo(
    () =>
      days.map((day) => ({
        day,
        shifts: shiftTimes.map((time) => ({
          ...time,
          employees: rows.filter(
            (row) => !row.open && row.day === day && row.start_time === time.start_time && row.end_time === time.end_time,
          ),
          open: rows.filter(
            (row) => row.open && row.day === day && row.start_time === time.start_time && row.end_time === time.end_time,
          ),
        })),
      })),
    [rows],
  )

  const loadShifts = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('shifts')
      .select('id, day, start_time, end_time, employee_name, open')
      .order('start_time')

    if (error) {
      setMessage(`Schichten konnten nicht geladen werden: ${error.message}`)
      setRows([])
      setLoading(false)
      return
    }

    setRows((data ?? []).sort(sortRows))
    setLoading(false)
  }, [])

  const loadEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, auth_user_id, name, slug, role, is_admin, active')
      .eq('active', true)
      .order('slug')

    if (error) {
      setMessage(`Mitarbeiter konnten nicht geladen werden: ${error.message}`)
      setEmployees([])
      return
    }

    setEmployees(data ?? [])
  }, [])

  useEffect(() => {
    // The first load intentionally synchronizes React state with Supabase on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShifts()
    loadEmployees()

    supabase.auth.getUser().then(({ data }) => {
      setSessionUser(data.user ?? null)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null)
    })

    const channel = supabase
      .channel('public:shifts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        loadShifts()
      })
      .subscribe()

    const employeesChannel = supabase
      .channel('public:employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        loadEmployees()
      })
      .subscribe()

    return () => {
      authListener.subscription.unsubscribe()
      supabase.removeChannel(channel)
      supabase.removeChannel(employeesChannel)
    }
  }, [loadEmployees, loadShifts])

  async function login() {
    setSaving(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    setSaving(false)

    if (error) {
      setMessage('Login fehlgeschlagen.')
      return
    }

    const employee = employeeFromUser(data.user, employees)
    setSessionUser(data.user)
    setMessage(
      employee
        ? `Angemeldet als ${employee.name}${employee.is_admin ? ' (Admin)' : ''}.`
        : 'Login erfolgreich. Dieses Konto ist noch keinem Mitarbeiter zugeordnet.',
    )
  }

  async function logout() {
    await supabase.auth.signOut()
    setSessionUser(null)
    setMessage('Abgemeldet.')
  }

  function resetEmployeeForm() {
    setEmployeeForm(emptyEmployeeForm)
  }

  function editEmployee(employee) {
    setEmployeeForm({
      id: employee.id,
      auth_user_id: employee.auth_user_id ?? '',
      name: employee.name,
      slug: employee.slug,
      role: employee.role,
      is_admin: employee.is_admin,
    })
  }

  function requireAdmin() {
    if (isAdmin) {
      return true
    }

    setMessage('Diese Aktion ist nur fuer Admins erlaubt.')
    return false
  }

  async function saveEmployee(event) {
    event.preventDefault()

    if (!requireAdmin()) {
      return
    }

    const payload = {
      auth_user_id: employeeForm.auth_user_id.trim() || null,
      name: employeeForm.name.trim(),
      slug: normalizeSlug(employeeForm.slug),
      role: employeeForm.role,
      is_admin: employeeForm.is_admin,
      active: true,
    }

    if (!payload.name || !payload.slug || !payload.role) {
      setMessage('Name, Slug und Rolle sind Pflichtfelder.')
      return
    }

    setSaving(true)
    setMessage('')

    const query = employeeForm.id
      ? supabase.from('employees').update(payload).eq('id', employeeForm.id)
      : supabase.from('employees').insert(payload)

    const { error } = await query

    if (error) {
      setMessage(`Mitarbeiter konnte nicht gespeichert werden: ${error.message}`)
    } else {
      await loadEmployees()
      resetEmployeeForm()
      setMessage('Mitarbeiter wurde gespeichert.')
    }

    setSaving(false)
  }

  async function deactivateEmployee(employee) {
    if (!requireAdmin()) {
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('employees').update({ active: false }).eq('id', employee.id)

    if (error) {
      setMessage(`Mitarbeiter konnte nicht deaktiviert werden: ${error.message}`)
    } else {
      await loadEmployees()
      if (employeeForm.id === employee.id) {
        resetEmployeeForm()
      }
      setMessage('Mitarbeiter wurde deaktiviert.')
    }

    setSaving(false)
  }

  async function generateSchedule() {
    if (!requireAdmin()) {
      return
    }

    setSaving(true)
    setMessage('')

    if (employees.length === 0) {
      setMessage('Keine aktiven Mitarbeiter gefunden.')
      setSaving(false)
      return
    }

    const rowsToInsert = []
    let cursor = 0

    days.forEach((day) => {
      shiftTimes.forEach((time) => {
        const picked = new Set()

        while (picked.size < time.people && picked.size < employees.length) {
          let employee = employees[cursor % employees.length]
          let guard = 0

          while (
            (picked.has(employee.slug) ||
              hasConflict(rowsToInsert, { ...time, day, employee_name: employee.slug, open: false })) &&
            guard < employees.length
          ) {
            cursor += 1
            guard += 1
            employee = employees[cursor % employees.length]
          }

          picked.add(employee.slug)
          rowsToInsert.push({
            day,
            employee_name: employee.slug,
            start_time: time.start_time,
            end_time: time.end_time,
            open: false,
          })
          cursor += 1
        }
      })
    })

    const { error } = await supabase.rpc('replace_schedule', { new_shifts: rowsToInsert })

    if (error) {
      setMessage(`Dienstplan konnte nicht gespeichert werden: ${error.message}`)
      setSaving(false)
      return
    }

    await loadShifts()
    setSaving(false)
    setMessage('Dienstplan wurde automatisch generiert.')
  }

  async function releaseShift(shift) {
    const canRelease = isAdmin || shift.employee_name === activeEmployee?.slug

    if (!canRelease) {
      setMessage('Du kannst nur eigene Schichten freigeben.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('shifts').update({ open: true, employee_name: null }).eq('id', shift.id)

    if (error) {
      setMessage(`Schicht konnte nicht freigegeben werden: ${error.message}`)
    } else {
      await loadShifts()
      setMessage('Schicht wurde freigegeben.')
    }

    setSaving(false)
  }

  async function takeShift(shift) {
    if (!activeEmployee) {
      setMessage('Bitte mit einem Mitarbeiterkonto anmelden.')
      return
    }

    const candidate = { ...shift, employee_name: activeEmployee.slug, open: false }
    if (rows.some((row) => !row.open && hasConflict([row], candidate))) {
      setMessage('Diese Uebernahme ist wegen der Konfliktregel nicht erlaubt.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('shifts')
      .update({ open: false, employee_name: activeEmployee.slug })
      .eq('id', shift.id)
      .eq('open', true)

    if (error) {
      setMessage(`Schicht konnte nicht uebernommen werden: ${error.message}`)
    } else {
      await loadShifts()
      setMessage('Schicht wurde uebernommen.')
    }

    setSaving(false)
  }

  return (
    <main className="min-h-screen bg-[#130909] text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
        <header className="print-section mb-5 rounded-3xl border border-white/10 bg-gradient-to-br from-red-950 via-red-900 to-black p-5 shadow-2xl sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">Dienstplanung</p>
              <h1 className="text-4xl font-bold text-yellow-400 sm:text-5xl">China Town</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-300 sm:text-base">
                Wochenkalender mit Rollenrechten, Live-Updates, offenen Schichten und druckbarem Export.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
              <button
                onClick={loadShifts}
                disabled={loading || saving}
                className="rounded-2xl border border-yellow-400/40 px-4 py-3 font-bold text-yellow-300 transition hover:bg-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Aktualisieren
              </button>
              <button
                onClick={generateSchedule}
                disabled={!isAdmin || saving}
                className="rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Plan generieren
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-2xl bg-blue-500 px-4 py-3 font-bold text-white transition hover:bg-blue-400"
              >
                PDF Export
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div className="mb-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-5 py-4 text-sm text-yellow-100">
            {message}
          </div>
        )}

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-yellow-400">Benutzerkonto</h2>
              {sessionUser && (
                <button onClick={logout} className="text-sm font-semibold text-red-200 hover:text-red-100">
                  Abmelden
                </button>
              )}
            </div>

            {sessionUser ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Status</p>
                  <p className="mt-2 font-semibold text-green-300">Angemeldet</p>
                </div>
                <div className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Rolle</p>
                  <p className="mt-2 font-semibold">{isAdmin ? 'Admin' : (activeEmployee?.role ?? 'Nicht zugeordnet')}</p>
                </div>
                <div className="rounded-2xl bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Konto</p>
                  <p className="mt-2 truncate font-semibold">{activeEmployee?.name ?? sessionUser.email}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className={inputClass}
                  type="email"
                  placeholder="E-Mail"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <input
                  className={inputClass}
                  type="password"
                  placeholder="Passwort"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  onClick={login}
                  disabled={saving || !email || !password}
                  className="rounded-2xl bg-green-500 px-7 py-4 font-bold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Einloggen
                </button>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-bold text-yellow-400">Regeln</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl bg-black/30 p-4">
                <p className="font-semibold text-red-300">Konflikt</p>
                <p className="mt-1 text-sm text-gray-300">Gokay und Melik werden nie in dieselbe Schicht geplant.</p>
              </div>
              <div className="rounded-2xl bg-black/30 p-4">
                <p className="font-semibold text-yellow-300">Adminschutz</p>
                <p className="mt-1 text-sm text-gray-300">Plan bearbeiten, freigeben und generieren ist Admins vorbehalten.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="print-section">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-yellow-400">Wochenplan</h2>
              <p className="mt-1 text-sm text-gray-400">Live synchronisiert ueber Supabase Realtime.</p>
            </div>
            <p className="rounded-full bg-white/10 px-4 py-2 text-sm text-gray-200">
              {rows.filter((row) => !row.open).length} geplant / {openShifts.length} offen
            </p>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-gray-300">Lade Dienstplan...</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
              {calendarDays.map((day) => (
                <article key={day.day} className="min-h-[260px] rounded-3xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 text-xl font-bold text-yellow-300">{day.day}</h3>
                  <div className="space-y-3">
                    {day.shifts.map((shift) => (
                      <div key={`${day.day}-${shift.label}`} className="rounded-2xl bg-black/35 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{shift.label}</p>
                            <p className="text-xs text-gray-400">{formatTime(shift.start_time, shift.end_time)}</p>
                          </div>
                          {shift.open.length > 0 && (
                            <span className="rounded-full bg-yellow-400/20 px-2 py-1 text-xs text-yellow-200">
                              {shift.open.length} offen
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {shift.employees.length === 0 ? (
                            <p className="text-sm text-gray-500">Keine Mitarbeiter geplant.</p>
                          ) : (
                            shift.employees.map((employee) => (
                              <div
                                key={employee.id}
                                className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {employeesBySlug.get(employee.employee_name)?.name ?? formatName(employee.employee_name)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {employeesBySlug.get(employee.employee_name)?.role ?? employee.employee_name}
                                  </p>
                                </div>
                                {(isAdmin || employee.employee_name === activeEmployee?.slug) && (
                                  <button
                                    onClick={() => releaseShift(employee)}
                                    disabled={saving}
                                    className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Frei
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="no-print mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-yellow-400">Mitarbeiterverwaltung</h2>
                <p className="text-sm text-gray-400">Mitarbeiter, Rollen, Adminrechte und Auth-User-Zuordnung.</p>
              </div>
              {employeeForm.id && (
                <button
                  onClick={resetEmployeeForm}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
                >
                  Neu
                </button>
              )}
            </div>

            <form onSubmit={saveEmployee} className="mb-5 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
              <input
                className={compactInputClass}
                placeholder="Name"
                value={employeeForm.name}
                onChange={(event) =>
                  setEmployeeForm((form) => ({
                    ...form,
                    name: event.target.value,
                    slug: form.id || form.slug ? form.slug : normalizeSlug(event.target.value),
                  }))
                }
              />
              <input
                className={compactInputClass}
                placeholder="Slug"
                value={employeeForm.slug}
                onChange={(event) => setEmployeeForm((form) => ({ ...form, slug: event.target.value }))}
              />
              <select
                className={compactInputClass}
                value={employeeForm.role}
                onChange={(event) => setEmployeeForm((form) => ({ ...form, role: event.target.value }))}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role} className="bg-[#130909]">
                    {role}
                  </option>
                ))}
              </select>
              <input
                className={compactInputClass}
                placeholder="Auth User ID"
                value={employeeForm.auth_user_id}
                onChange={(event) => setEmployeeForm((form) => ({ ...form, auth_user_id: event.target.value }))}
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={employeeForm.is_admin}
                    onChange={(event) => setEmployeeForm((form) => ({ ...form, is_admin: event.target.checked }))}
                  />
                  Admin
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Speichern
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Slug</th>
                    <th className="px-3 py-2">Rolle</th>
                    <th className="px-3 py-2">Auth User</th>
                    <th className="px-3 py-2">Rechte</th>
                    <th className="px-3 py-2 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="bg-black/30">
                      <td className="rounded-l-xl px-3 py-3 font-semibold">{employee.name}</td>
                      <td className="px-3 py-3 text-gray-300">{employee.slug}</td>
                      <td className="px-3 py-3 text-gray-300">{employee.role}</td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-gray-400">
                        {employee.auth_user_id ?? 'Nicht verbunden'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            employee.is_admin
                              ? 'rounded-full bg-yellow-400/20 px-2 py-1 text-xs text-yellow-200'
                              : 'rounded-full bg-white/10 px-2 py-1 text-xs text-gray-300'
                          }
                        >
                          {employee.is_admin ? 'Admin' : 'Mitarbeiter'}
                        </span>
                      </td>
                      <td className="rounded-r-xl px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editEmployee(employee)}
                            className="rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/35"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateEmployee(employee)}
                            disabled={saving}
                            className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/35 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Deaktivieren
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-yellow-400/20 bg-white/5 p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-yellow-400">Offene Schichten</h2>
              <p className="text-sm text-gray-400">Mitarbeiter uebernehmen automatisch mit ihrem eigenen Konto.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {openShifts.length === 0 ? (
              <p className="rounded-2xl bg-black/30 p-4 text-sm text-gray-400">Aktuell gibt es keine offenen Schichten.</p>
            ) : (
              openShifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between gap-4 rounded-2xl bg-black/30 p-4">
                  <div>
                    <p className="font-semibold">
                      {shift.day} - {shift.shift}
                    </p>
                    <p className="text-sm text-gray-400">Freigegeben</p>
                  </div>
                  <button
                    onClick={() => takeShift(shift)}
                    disabled={saving || !activeEmployee}
                    className="rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Uebernehmen
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
