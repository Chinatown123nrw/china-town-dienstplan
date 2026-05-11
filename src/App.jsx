import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const employees = [
  { name: '01-santiago-oconner', role: 'Geschaeftsfuehrer' },
  { name: '02-david-lox', role: 'Geschaeftsfuehrer' },
  { name: '03-amelie-bloom', role: 'Service' },
  { name: '04-miguel-monroe', role: 'Kueche' },
  { name: '05-raff-raichts', role: 'Bar' },
  { name: '06-bella-dark', role: 'Kasse' },
  { name: '07-jason-brocks', role: 'Lieferung' },
  { name: '08-jessy-hart-vorlauf', role: 'Service' },
  { name: '09-fabio-caruso', role: 'Kueche' },
  { name: '10-cardi-oconner', role: 'Bar' },
  { name: '11-gokay-sahin', role: 'Service' },
  { name: '12-aushilfe', role: 'Aushilfe' },
  { name: '13-chris-martens', role: 'Lieferung' },
  { name: '14-lilly-bennett', role: 'Kasse' },
  { name: '15-melik-hak', role: 'Service' },
]

const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const shiftTimes = [
  { label: 'Mittag', start_time: '11:00', end_time: '15:00', people: 3 },
  { label: 'Abend', start_time: '17:00', end_time: '22:00', people: 4 },
]
const blacklist = [['11-gokay-sahin', '15-melik-hak']]
const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none transition focus:border-yellow-400'

function formatTime(start, end) {
  return `${start?.slice(0, 5) ?? '--:--'} - ${end?.slice(0, 5) ?? '--:--'}`
}

function formatName(name) {
  return name.replace(/^\d+-/, '').replaceAll('-', ' ')
}

function isAdminUser(user) {
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role
  return role === 'admin' || adminEmails.includes(user?.email?.toLowerCase())
}

function employeeFromUser(user) {
  const metadataName =
    user?.user_metadata?.employee_name ?? user?.user_metadata?.employeeName ?? user?.app_metadata?.employee_name

  if (metadataName) {
    return employees.find((employee) => employee.name === metadataName)
  }

  const emailHandle = user?.email?.split('@')[0]?.toLowerCase()
  return employees.find((employee) => employee.name.includes(emailHandle))
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
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const isAdmin = useMemo(() => isAdminUser(sessionUser), [sessionUser])
  const activeEmployee = useMemo(() => employeeFromUser(sessionUser), [sessionUser])

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

  useEffect(() => {
    // The first load intentionally synchronizes React state with Supabase on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShifts()

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

    return () => {
      authListener.subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [loadShifts])

  async function login() {
    setSaving(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    setSaving(false)

    if (error) {
      setMessage('Login fehlgeschlagen.')
      return
    }

    const employee = employeeFromUser(data.user)
    const admin = isAdminUser(data.user)
    setSessionUser(data.user)
    setMessage(admin ? 'Admin Login erfolgreich.' : `Angemeldet als ${employee?.name ?? data.user.email}.`)
  }

  async function logout() {
    await supabase.auth.signOut()
    setSessionUser(null)
    setMessage('Abgemeldet.')
  }

  function requireAdmin() {
    if (isAdmin) {
      return true
    }

    setMessage('Diese Aktion ist nur fuer Admins erlaubt.')
    return false
  }

  async function generateSchedule() {
    if (!requireAdmin()) {
      return
    }

    setSaving(true)
    setMessage('')

    const rowsToInsert = []
    let cursor = 0

    days.forEach((day) => {
      shiftTimes.forEach((time) => {
        const picked = new Set()

        while (picked.size < time.people && picked.size < employees.length) {
          let employee = employees[cursor % employees.length]
          let guard = 0

          while (
            (picked.has(employee.name) ||
              hasConflict(rowsToInsert, { ...time, day, employee_name: employee.name, open: false })) &&
            guard < employees.length
          ) {
            cursor += 1
            guard += 1
            employee = employees[cursor % employees.length]
          }

          picked.add(employee.name)
          rowsToInsert.push({
            day,
            employee_name: employee.name,
            start_time: time.start_time,
            end_time: time.end_time,
            open: false,
          })
          cursor += 1
        }
      })
    })

    const { error: deleteError } = await supabase.from('shifts').delete().not('id', 'is', null)

    if (deleteError) {
      setMessage(`Alter Dienstplan konnte nicht ersetzt werden: ${deleteError.message}`)
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('shifts').insert(rowsToInsert)

    if (insertError) {
      setMessage(`Dienstplan konnte nicht gespeichert werden: ${insertError.message}`)
      setSaving(false)
      return
    }

    await loadShifts()
    setSaving(false)
    setMessage('Dienstplan wurde automatisch generiert.')
  }

  async function releaseShift(shiftId) {
    if (!requireAdmin()) {
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('shifts').update({ open: true, employee_name: null }).eq('id', shiftId)

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

    const candidate = { ...shift, employee_name: activeEmployee.name, open: false }
    if (rows.some((row) => !row.open && hasConflict([row], candidate))) {
      setMessage('Diese Uebernahme ist wegen der Konfliktregel nicht erlaubt.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('shifts')
      .update({ open: false, employee_name: activeEmployee.name })
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
                  <p className="mt-2 font-semibold">{isAdmin ? 'Admin' : 'Mitarbeiter'}</p>
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
                                  <p className="truncate text-sm font-semibold">{formatName(employee.employee_name)}</p>
                                  <p className="text-xs text-gray-500">{employee.employee_name}</p>
                                </div>
                                {isAdmin && (
                                  <button
                                    onClick={() => releaseShift(employee.id)}
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
