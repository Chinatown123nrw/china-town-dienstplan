import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const shiftTimes = [
  { label: 'Frueh-Abend', start_time: '17:00', end_time: '19:30', people: 4 },
  { label: 'Spaet-Abend', start_time: '19:30', end_time: '22:00', people: 4 },
]
const roleOptions = ['Gesch\u00e4ftsf\u00fchrer', 'Service', 'K\u00fcche', 'Bar', 'Kasse', 'Lieferung', 'Aushilfe']
const blacklist = [['11-gokay-sahin', '15-melik-hak']]

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none transition focus:border-yellow-400'
const compactInputClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none transition focus:border-yellow-400'
const roleBadgeClasses = {
  Gesch\u00e4ftsf\u00fchrer: 'bg-yellow-400/20 text-yellow-100 ring-yellow-300/30',
  Service: 'bg-sky-400/20 text-sky-100 ring-sky-300/30',
  K\u00fcche: 'bg-emerald-400/20 text-emerald-100 ring-emerald-300/30',
  Bar: 'bg-fuchsia-400/20 text-fuchsia-100 ring-fuchsia-300/30',
  Kasse: 'bg-orange-400/20 text-orange-100 ring-orange-300/30',
  Lieferung: 'bg-blue-400/20 text-blue-100 ring-blue-300/30',
  Aushilfe: 'bg-gray-400/20 text-gray-100 ring-gray-300/30',
}
const emptyEmployeeForm = {
  id: null,
  auth_user_id: '',
  name: '',
  slug: '',
  role: 'Service',
  is_admin: false,
  temp_password: '',
}
const loginAliases = {
  chinaadmin: 'admin@chinatown.de',
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

function employeeEmailFromName(name) {
  const handle = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

  return handle ? `${handle}@chinatown.de` : ''
}

function generateTempPassword() {
  return String(Math.floor(10000 + Math.random() * 90000))
}

function roleBadgeClass(role) {
  return roleBadgeClasses[role] ?? 'bg-white/10 text-gray-100 ring-white/10'
}

function coverageClass(count, target) {
  if (count === 0) {
    return 'bg-red-400'
  }

  if (count < target) {
    return 'bg-yellow-400'
  }

  return 'bg-green-400'
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
  const [newPassword, setNewPassword] = useState('')
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [employeeForm, setEmployeeForm] = useState(() => ({
    ...emptyEmployeeForm,
    temp_password: generateTempPassword(),
  }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const activeEmployee = useMemo(() => employeeFromUser(sessionUser, employees), [sessionUser, employees])
  const isAdmin = Boolean(activeEmployee?.is_admin)
  const employeesBySlug = useMemo(
    () => new Map(employees.map((employee) => [employee.slug, employee])),
    [employees],
  )
  const employeeFormEmail = useMemo(() => employeeEmailFromName(employeeForm.name), [employeeForm.name])

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

  const scheduleStats = useMemo(() => {
    const planned = rows.filter((row) => !row.open).length
    const open = rows.filter((row) => row.open).length
    const target = days.length * shiftTimes.reduce((sum, shift) => sum + shift.people, 0)
    const coverage = target === 0 ? 0 : Math.round((planned / target) * 100)

    return {
      planned,
      open,
      target,
      coverage,
    }
  }, [rows])

  const myShifts = useMemo(() => {
    if (!activeEmployee) {
      return []
    }

    return rows
      .filter((row) => !row.open && row.employee_name === activeEmployee.slug)
      .map((row) => ({ ...row, shift: formatTime(row.start_time, row.end_time) }))
      .sort(sortRows)
  }, [activeEmployee, rows])

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

    const loginName = email.trim().toLowerCase()
    const loginEmail = loginAliases[loginName] ?? loginName
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

    setSaving(false)

    if (error) {
      setMessage('Login fehlgeschlagen.')
      return
    }

    const employee = employeeFromUser(data.user, employees)
    setSessionUser(data.user)
    setPassword('')
    setMessage(
      employee
        ? `Angemeldet als ${employee.name}${employee.is_admin ? ' (Admin)' : ''}.`
        : 'Login erfolgreich. Dieses Konto ist noch keinem Mitarbeiter zugeordnet.',
    )
  }

  async function logout() {
    await supabase.auth.signOut()
    setSessionUser(null)
    setNewPassword('')
    setMessage('Abgemeldet.')
  }

  async function changePassword(event) {
    event.preventDefault()

    if (newPassword.length < 6) {
      setMessage('Das neue Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMessage(`Passwort konnte nicht geaendert werden: ${error.message}`)
    } else {
      setNewPassword('')
      setMessage('Passwort wurde geaendert.')
    }

    setSaving(false)
  }

  function resetEmployeeForm() {
    setEmployeeForm({
      ...emptyEmployeeForm,
      temp_password: generateTempPassword(),
    })
  }

  function editEmployee(employee) {
    setEmployeeForm({
      id: employee.id,
      auth_user_id: employee.auth_user_id ?? '',
      name: employee.name,
      slug: employee.slug,
      role: employee.role,
      is_admin: employee.is_admin,
      temp_password: generateTempPassword(),
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

    const basePayload = {
      name: employeeForm.name.trim(),
      slug: normalizeSlug(employeeForm.slug),
      role: employeeForm.role,
      is_admin: employeeForm.is_admin,
      active: true,
    }
    const payload = employeeForm.id ? basePayload : { ...basePayload, auth_user_id: null }

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
      const loginInfo = employeeForm.id
        ? ''
        : ` Login vorbereiten: ${employeeEmailFromName(payload.name)} / Erstpasswort ${employeeForm.temp_password}.`
      resetEmployeeForm()
      setMessage(`Mitarbeiter wurde gespeichert.${loginInfo}`)
    }

    setSaving(false)
  }

  async function deleteEmployee(employee) {
    if (!requireAdmin()) {
      return
    }

    const confirmed = window.confirm(
      `${employee.name} wirklich loeschen? Vorhandene Schichten werden automatisch als offen markiert.`,
    )

    if (!confirmed) {
      return
    }

    setSaving(true)
    setMessage('')

    const { error: shiftError } = await supabase
      .from('shifts')
      .update({ open: true, employee_name: null })
      .eq('employee_name', employee.slug)

    if (shiftError) {
      setMessage(`Schichten konnten nicht freigegeben werden: ${shiftError.message}`)
      setSaving(false)
      return
    }

    const { error } = await supabase.from('employees').delete().eq('id', employee.id)

    if (error) {
      setMessage(`Mitarbeiter konnte nicht geloescht werden: ${error.message}`)
    } else {
      await loadEmployees()
      await loadShifts()
      if (employeeForm.id === employee.id) {
        resetEmployeeForm()
      }
      setMessage('Mitarbeiter wurde geloescht. Seine Schichten sind jetzt offen.')
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

        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Geplant</p>
            <p className="mt-2 text-3xl font-bold text-yellow-300">{scheduleStats.planned}</p>
            <p className="mt-1 text-xs text-gray-400">von {scheduleStats.target} Soll-Schichten</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Offen</p>
            <p className="mt-2 text-3xl font-bold text-red-200">{scheduleStats.open}</p>
            <p className="mt-1 text-xs text-gray-400">freigegebene Schichten</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Besetzung</p>
            <p className="mt-2 text-3xl font-bold text-green-300">{scheduleStats.coverage}%</p>
            <div className="mt-3 h-2 rounded-full bg-black/40">
              <div
                className="h-2 rounded-full bg-green-400"
                style={{ width: `${Math.min(scheduleStats.coverage, 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Meine Woche</p>
            <p className="mt-2 text-3xl font-bold text-blue-200">{myShifts.length}</p>
            <p className="mt-1 text-xs text-gray-400">{activeEmployee ? 'eigene Schichten' : 'nach Login sichtbar'}</p>
          </div>
        </section>

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
              <div className="grid gap-3">
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
                <form onSubmit={changePassword} className="grid gap-3 rounded-2xl bg-black/30 p-4 md:grid-cols-[1fr_auto]">
                  <input
                    className={compactInputClass}
                    type="password"
                    placeholder="Neues Passwort"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={saving || !newPassword}
                    className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Passwort aendern
                  </button>
                </form>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className={inputClass}
                  type="text"
                  placeholder="Benutzername oder E-Mail"
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

        {activeEmployee && (
          <section className="mb-5 rounded-3xl border border-blue-400/20 bg-white/5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-blue-100">Meine Schichten</h2>
                <p className="text-sm text-gray-400">Schneller Blick auf deine aktuelle Woche.</p>
              </div>
              <span className="rounded-full bg-blue-400/15 px-3 py-1 text-sm font-semibold text-blue-100">
                {myShifts.length}
              </span>
            </div>
            {myShifts.length === 0 ? (
              <p className="rounded-2xl bg-black/30 p-4 text-sm text-gray-400">Du bist aktuell in keiner Schicht eingeplant.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {myShifts.map((shift) => (
                  <div key={shift.id} className="rounded-2xl bg-black/30 p-4">
                    <p className="font-semibold text-white">{shift.day}</p>
                    <p className="mt-1 text-sm text-blue-100">{shift.shift}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {calendarDays.map((day) => (
                <article key={day.day} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/10">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <h3 className="text-xl font-bold text-yellow-300">{day.day}</h3>
                    <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-gray-300">
                      {day.shifts.reduce((sum, shift) => sum + shift.employees.length, 0)} geplant
                    </span>
                  </div>
                  <div className="space-y-4">
                    {day.shifts.map((shift) => (
                      <div key={`${day.day}-${shift.label}`} className="rounded-2xl bg-black/35 p-3 ring-1 ring-white/5">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{shift.label}</p>
                            <p className="text-xs text-gray-400">{formatTime(shift.start_time, shift.end_time)}</p>
                          </div>
                          <div className="text-right">
                            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-gray-200">
                              {shift.employees.length}/{shift.people}
                            </span>
                            {shift.open.length > 0 && (
                              <p className="mt-2 text-xs font-semibold text-yellow-200">{shift.open.length} offen</p>
                            )}
                          </div>
                        </div>
                        <div className="mb-3 h-1.5 rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full ${coverageClass(shift.employees.length, shift.people)}`}
                            style={{ width: `${Math.min((shift.employees.length / shift.people) * 100, 100)}%` }}
                          />
                        </div>

                        <div className="space-y-2">
                          {shift.employees.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-sm text-gray-500">
                              Keine Mitarbeiter geplant.
                            </p>
                          ) : (
                            shift.employees.map((employee) => {
                              const employeeDetails = employeesBySlug.get(employee.employee_name)
                              const employeeRole = employeeDetails?.role ?? 'Nicht zugeordnet'

                              return (
                                <div
                                  key={employee.id}
                                  className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                      {employeeDetails?.name ?? formatName(employee.employee_name)}
                                    </p>
                                    <span
                                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${roleBadgeClass(employeeRole)}`}
                                    >
                                      {employeeRole}
                                    </span>
                                  </div>
                                  {(isAdmin || employee.employee_name === activeEmployee?.slug) && (
                                    <button
                                      onClick={() => releaseShift(employee)}
                                      disabled={saving}
                                      className="shrink-0 rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Frei
                                    </button>
                                  )}
                                </div>
                              )
                            })
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
                <p className="text-sm text-gray-400">Mitarbeiter, Rollen, Adminrechte und vorbereitete China-Town-Logins.</p>
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

            <form onSubmit={saveEmployee} className="mb-5 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
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

            <div className="mb-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Login E-Mail</p>
                <p className="mt-2 font-semibold text-yellow-100">{employeeFormEmail || 'Name eingeben'}</p>
              </div>
              <div className="rounded-2xl bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Erstpasswort</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-green-200">{employeeForm.temp_password}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmployeeForm((form) => ({ ...form, temp_password: generateTempPassword() }))}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
                  >
                    Neu
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Auth-User in Supabase mit dieser E-Mail und diesem Passwort anlegen, danach User-ID mit Mitarbeiter verbinden.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Slug</th>
                    <th className="px-3 py-2">Rolle</th>
                    <th className="px-3 py-2">Login</th>
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
                        <p className="text-gray-200">{employeeEmailFromName(employee.name)}</p>
                        <p className="text-xs">{employee.auth_user_id ? 'Verbunden' : 'Nicht verbunden'}</p>
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
                          <button
                            type="button"
                            onClick={() => deleteEmployee(employee)}
                            disabled={saving}
                            className="rounded-lg bg-red-600/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-600/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Loeschen
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
            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-sm font-semibold text-yellow-100">
              {openShifts.length} offen
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {openShifts.length === 0 ? (
              <p className="rounded-2xl bg-black/30 p-4 text-sm text-gray-400">Aktuell gibt es keine offenen Schichten.</p>
            ) : (
              openShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-yellow-400/15 bg-black/30 p-4"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">Jetzt offen</p>
                    <p className="mt-1 font-semibold">
                      {shift.day} - {shift.shift}
                    </p>
                    <p className="text-sm text-gray-400">{activeEmployee ? `Uebernahme als ${activeEmployee.name}` : 'Login erforderlich'}</p>
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
