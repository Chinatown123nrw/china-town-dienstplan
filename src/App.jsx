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
const blacklist = [['11-gokay-sahin', '15-melik-hak']]
const shiftTimes = [
  { start_time: '11:00', end_time: '15:00' },
  { start_time: '17:00', end_time: '22:00' },
]

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400'

function isBlacklisted(dayEmployees, employeeName) {
  return blacklist.some((pair) => pair.includes(employeeName) && pair.some((name) => dayEmployees.includes(name)))
}

function formatTime(start, end) {
  return `${start?.slice(0, 5) ?? '--:--'} - ${end?.slice(0, 5) ?? '--:--'}`
}

function sortByDay(a, b) {
  return days.indexOf(a.day) - days.indexOf(b.day)
}

export default function ChinaTownDienstplan() {
  const [weeklyShifts, setWeeklyShifts] = useState([])
  const [openShifts, setOpenShifts] = useState([])
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminUser, setAdminUser] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0].name)
  const [activeEmployee, setActiveEmployee] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const currentEmployee = useMemo(
    () => employees.find((employee) => employee.name === activeEmployee),
    [activeEmployee],
  )

  const loadShifts = useCallback(async () => {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('shifts')
      .select('id, day, start_time, end_time, employee_name, open')
      .order('day')
      .order('start_time')

    if (error) {
      setMessage(`Schichten konnten nicht geladen werden: ${error.message}`)
      setWeeklyShifts([])
      setOpenShifts([])
      setLoading(false)
      return
    }

    const grouped = days.map((day) => ({ day, employees: [] }))
    const open = []

    ;(data ?? []).forEach((shift) => {
      const entry = {
        id: shift.id,
        name: shift.employee_name,
        shift: formatTime(shift.start_time, shift.end_time),
        type: 'Schicht',
      }

      if (shift.open) {
        open.push({
          id: shift.id,
          day: shift.day,
          shift: formatTime(shift.start_time, shift.end_time),
        })
        return
      }

      const dayGroup = grouped.find((group) => group.day === shift.day)
      if (dayGroup) {
        dayGroup.employees.push(entry)
      }
    })

    setWeeklyShifts(grouped.sort(sortByDay))
    setOpenShifts(open.sort(sortByDay))
    setLoading(false)
  }, [])

  useEffect(() => {
    // The first load intentionally synchronizes React state with Supabase on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShifts()

    supabase.auth.getUser().then(({ data }) => {
      setAdminUser(data.user ?? null)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [loadShifts])

  async function loginAdmin() {
    setSaving(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })

    setSaving(false)

    if (error) {
      setMessage('Admin Login fehlgeschlagen.')
      return
    }

    setAdminUser(data.user)
    setMessage('Admin Login erfolgreich.')
  }

  async function logoutAdmin() {
    await supabase.auth.signOut()
    setAdminUser(null)
  }

  async function generateSchedule() {
    setSaving(true)
    setMessage('')

    const rows = []
    let cursor = 0

    days.forEach((day) => {
      const employeesForDay = []

      shiftTimes.forEach((time) => {
        let employee = employees[cursor % employees.length]
        let guard = 0

        while (isBlacklisted(employeesForDay, employee.name) && guard < employees.length) {
          cursor += 1
          employee = employees[cursor % employees.length]
          guard += 1
        }

        employeesForDay.push(employee.name)
        rows.push({
          day,
          employee_name: employee.name,
          start_time: time.start_time,
          end_time: time.end_time,
          open: false,
        })
        cursor += 1
      })
    })

    const { error: deleteError } = await supabase.from('shifts').delete().not('id', 'is', null)

    if (deleteError) {
      setMessage(`Alter Dienstplan konnte nicht ersetzt werden: ${deleteError.message}`)
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('shifts').insert(rows)

    if (insertError) {
      setMessage(`Dienstplan konnte nicht gespeichert werden: ${insertError.message}`)
      setSaving(false)
      return
    }

    await loadShifts()
    setSaving(false)
    setMessage('Dienstplan wurde generiert.')
  }

  async function releaseShift(shiftId) {
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('shifts')
      .update({ open: true, employee_name: null })
      .eq('id', shiftId)

    if (error) {
      setMessage(`Schicht konnte nicht freigegeben werden: ${error.message}`)
    } else {
      await loadShifts()
      setMessage('Schicht wurde freigegeben.')
    }

    setSaving(false)
  }

  async function takeShift(shiftId) {
    if (!activeEmployee) {
      setMessage('Bitte zuerst als Mitarbeiter anmelden.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('shifts')
      .update({ open: false, employee_name: activeEmployee })
      .eq('id', shiftId)

    if (error) {
      setMessage(`Schicht konnte nicht uebernommen werden: ${error.message}`)
    } else {
      await loadShifts()
      setMessage('Schicht wurde uebernommen.')
    }

    setSaving(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-red-950 via-red-900 to-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-yellow-300">
              Dienstplanung
            </p>
            <h1 className="text-4xl font-bold text-yellow-400 sm:text-5xl">China Town</h1>
            <p className="mt-2 text-gray-300">Wochenplan, offene Schichten und Mitarbeiterverwaltung.</p>
          </div>

          <button
            onClick={loadShifts}
            disabled={loading || saving}
            className="rounded-2xl border border-yellow-400/40 px-5 py-3 font-bold text-yellow-300 transition hover:bg-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Aktualisieren
          </button>
        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-5 py-4 text-sm text-yellow-100">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-yellow-400">Admin Login</h2>
              {adminUser && (
                <button onClick={logoutAdmin} className="text-sm font-semibold text-red-200 hover:text-red-100">
                  Abmelden
                </button>
              )}
            </div>

            <div className="space-y-4">
              <input
                className={inputClass}
                type="email"
                placeholder="Admin E-Mail"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
              />
              <input
                className={inputClass}
                type="password"
                placeholder="Passwort"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
              />
              <button
                onClick={loginAdmin}
                disabled={saving || !adminEmail || !adminPassword}
                className="w-full rounded-2xl bg-yellow-400 py-4 font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Als Admin anmelden
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-6 text-2xl font-bold text-yellow-400">Mitarbeiter Login</h2>

            <div className="space-y-4">
              <select
                className={inputClass}
                value={selectedEmployee}
                onChange={(event) => setSelectedEmployee(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.name} value={employee.name} className="bg-red-950">
                    {employee.name} - {employee.role}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setActiveEmployee(selectedEmployee)}
                className="w-full rounded-2xl bg-green-500 py-4 font-bold text-black transition hover:bg-green-400"
              >
                Als Mitarbeiter anmelden
              </button>
              {currentEmployee && (
                <p className="text-sm text-green-200">
                  Angemeldet als {currentEmployee.name} ({currentEmployee.role})
                </p>
              )}
            </div>
          </div>
        </section>

        {adminUser && (
          <section className="mb-8 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
            <h2 className="mb-6 text-2xl font-bold text-yellow-400">Admin Bereich</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={generateSchedule}
                disabled={saving}
                className="rounded-2xl bg-yellow-400 py-4 font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Dienstplan generieren
              </button>
              <button className="rounded-2xl bg-red-500 py-4 font-bold text-white">Mitarbeiter verwalten</button>
              <button className="rounded-2xl bg-green-500 py-4 font-bold text-black">Schichten freigeben</button>
              <button onClick={() => window.print()} className="rounded-2xl bg-blue-500 py-4 font-bold text-white">
                Wochenplan exportieren
              </button>
            </div>
          </section>
        )}

        <section className="mb-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-6 text-2xl font-bold text-yellow-400">Mitarbeiter</h2>
            <div className="space-y-3">
              {employees.map((employee) => (
                <div key={employee.name} className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
                  <div>
                    <p className="font-semibold">{employee.name}</p>
                    <p className="text-sm text-gray-400">{employee.role}</p>
                  </div>
                  <span className="rounded-xl bg-green-500/20 px-3 py-1 text-sm text-green-300">Aktiv</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-6 text-2xl font-bold text-yellow-400">Regeln</h2>
            <div className="space-y-4">
              <div className="rounded-2xl bg-black/30 p-4">
                <p className="font-semibold text-red-300">Konflikt Mitarbeiter</p>
                <p className="mt-2 text-gray-300">gokay-sahin und melik-hak duerfen nicht zusammen arbeiten.</p>
              </div>
              <div className="rounded-2xl bg-black/30 p-4">
                <p className="font-semibold text-yellow-300">Offene Schichten</p>
                <p className="mt-2 text-gray-300">Mitarbeiter koennen offene Schichten uebernehmen.</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-6 text-3xl font-bold text-yellow-400">Wochenplan</h2>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-gray-300">Lade Dienstplan...</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {weeklyShifts.map((day) => (
                <div key={day.day} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h3 className="mb-6 text-2xl font-bold text-yellow-300">{day.day}</h3>

                  <div className="space-y-4">
                    {day.employees.length === 0 ? (
                      <p className="rounded-2xl bg-black/30 p-4 text-sm text-gray-400">Keine Schichten geplant.</p>
                    ) : (
                      day.employees.map((employee) => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-black/30 p-4"
                        >
                          <div>
                            <p className="font-semibold">{employee.name}</p>
                            <p className="text-sm text-gray-400">{employee.type}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 text-right">
                            <span className="font-medium text-yellow-400">{employee.shift}</span>
                            {(adminUser || activeEmployee === employee.name) && (
                              <button
                                onClick={() => releaseShift(employee.id)}
                                disabled={saving}
                                className="rounded-xl bg-red-500/20 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Abmelden
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-3xl border border-yellow-400/20 bg-white/5 p-6">
          <h2 className="text-2xl font-bold text-yellow-400">Offene Schichten</h2>
          <p className="mt-2 text-gray-400">Freigegebene Schichten, die Mitarbeiter uebernehmen koennen.</p>

          <div className="mt-6 space-y-4">
            {openShifts.length === 0 ? (
              <p className="rounded-2xl bg-black/30 p-4 text-sm text-gray-400">Aktuell gibt es keine offenen Schichten.</p>
            ) : (
              openShifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between gap-4 rounded-2xl bg-black/30 p-4">
                  <div>
                    <p className="font-semibold">{shift.day}</p>
                    <p className="text-sm text-gray-400">{shift.shift}</p>
                  </div>
                  <button
                    onClick={() => takeShift(shift.id)}
                    disabled={saving || !activeEmployee}
                    className="rounded-2xl bg-yellow-400 px-5 py-3 font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
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
