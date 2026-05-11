import { useEffect, useState } from 'react'
import { supabase } from './supabase'
export default function ChinaTownDienstplan() {
  const blacklist = [
    ['11-gokay-sahin', '15-melik-hak'],
  ];

  const employees = [
    { name: '01-santiago-oconner', role: 'Geschäftsführer' },
    { name: '02-david-lox', role: 'Geschäftsführer' },
    { name: '03-amelie-bloom', role: 'Service' },
    { name: '04-miguel-monroe', role: 'Küche' },
    { name: '05-raff-raichts', role: 'Bar' },
    { name: '06-bella-dark', role: 'Kasse' },
    { name: '07-jason-brocks', role: 'Lieferung' },
    { name: '08-jessy-hart-vorlauf', role: 'Service' },
    { name: '09-fabio-caruso', role: 'Küche' },
    { name: '10-cardi-oconner', role: 'Bar' },
    { name: '11-gokay-sahin', role: 'Service' },
    { name: '12', role: 'Aushilfe' },
    { name: '13-chris-martens', role: 'Lieferung' },
    { name: '14-lilly-bennett', role: 'Kasse' },
    { name: '15-melik-hak', role: 'Service' },
  ];

  const [shifts, setShifts] = useState([])
  const [openShifts, setOpenShifts] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  useEffect(() => {
  const getShifts = async () => {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')

    if (!error) {
      const grouped = {}
      const open = []

      data.forEach((shift) => {
        if (shift.open === true) {
          open.push({
            id: shift.id,
            day: shift.day,
            shift: `${shift.start_time} - ${shift.end_time}`,
          })
        }

        if (!grouped[shift.day]) {
          grouped[shift.day] = []
        }

        if (shift.open !== true) {
          grouped[shift.day].push({
            name: shift.employee_name,
            shift: `${shift.start_time} - ${shift.end_time}`,
            type: 'Schicht',
          })
        }
      })

      const formatted = Object.keys(grouped).map((day) => ({
        day,
        employees: grouped[day],
      }))

      setShifts(formatted)
      setOpenShifts(open)
    }
  }

  getShifts()
  const getUser = async () => {
  const { data } = await supabase.auth.getUser()

    if (data.user) {
      setUser(data.user)
    }
  }

  getUser()
}, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-950 via-red-900 to-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h2 className="text-3xl font-bold text-yellow-400 mb-6">
              Admin Login
            </h2>

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Admin E-Mail"
                onChange={(e) => setEmail(e.target.value)}
              />

              <input   
                type="password"
                placeholder="Passwort"
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                onClick={async () => {
                  const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                  })

                  if (error) {
                    alert('Login fehlgeschlagen')
                  } else {
                    setUser(data.user)
                    alert('Login erfolgreich')
                  }
                }}
                className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-bold hover:scale-[1.01] transition"
              >
                Als Admin anmelden
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h2 className="text-3xl font-bold text-yellow-400 mb-6">
              Mitarbeiter Login
            </h2>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Mitarbeiter Name"
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400"
              />

              <input
                type="password"
                placeholder="Passwort"
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400"
              />

              <button
                onClick={async () => {
                  const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                  })

                  if (error) {
                    alert('Login fehlgeschlagen')
                  } else {
                    setUser(data.user)
                    alert('Login erfolgreich')
                  }
                }}
                className="w-full bg-green-500 text-black py-4 rounded-2xl font-bold hover:scale-[1.01] transition"
              >
                Als Mitarbeiter anmelden
              </button>
            </div>
          </div>
        </div>

        {user && (
              <div className="mb-10 bg-yellow-400/10 border border-yellow-400/20 rounded-3xl p-6">
                <h2 className="text-3xl font-bold text-yellow-400 mb-6">
                  Admin Bereich
                </h2>

                <div className="grid md:grid-cols-2 gap-4">

                  <button
                    className="bg-yellow-400 text-black py-4 rounded-2xl font-bold"
                  >
                    Dienstplan generieren
                  </button>

                  <button
                    className="bg-red-500 text-white py-4 rounded-2xl font-bold"
                  >
                    Mitarbeiter verwalten
                  </button>

                  <button
                    className="bg-green-500 text-black py-4 rounded-2xl font-bold"
                  >
                    Schichten freigeben
                  </button>

                  <button
                    className="bg-blue-500 text-white py-4 rounded-2xl font-bold"
                  >
                    Wochenplan exportieren
                  </button>

                </div>
              </div>
            )}
        </div>
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-5xl font-bold text-yellow-400">
                China Town
              </h1>

              <p className="text-gray-300 mt-2">
                Automatische Wochenplanung bis 22 Uhr
              </p>
            </div>
          </div>
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h2 className="text-3xl font-bold text-yellow-400 mb-6">
              Mitarbeiter
            </h2>

            <div className="space-y-4">
              {employees.map((employee, index) => (
                <div
                  key={index}
                  className="bg-black/30 rounded-2xl p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">{employee.name}</p>
                    <p className="text-sm text-gray-400">{employee.role}</p>
                  </div>

                  <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-xl text-sm">
                    Aktiv
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h2 className="text-3xl font-bold text-yellow-400 mb-6">
              Regeln
            </h2>

            <div className="space-y-4">
              <div className="bg-black/30 rounded-2xl p-4">
                <p className="font-semibold text-red-300">
                  Konflikt Mitarbeiter
                </p>
                <p className="text-gray-300 mt-2">
                  gokay-sahin und melik-hak dürfen nicht zusammen arbeiten.
                </p>
              </div>

              <div className="bg-black/30 rounded-2xl p-4">
                <p className="font-semibold text-yellow-300">
                  Offene Schichten
                </p>
                <p className="text-gray-300 mt-2">
                  Mitarbeiter können offene Schichten übernehmen.
                </p>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-4xl font-bold text-yellow-400 mb-8">
          Wochenplan
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {shifts.map((shift, index) => (
            <div
              key={index}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-2xl font-bold text-yellow-300 mb-6">
                {shift.day}
              </h3>

              <div className="space-y-4">
                {shift.employees.map((employee, idx) => (
                  <div
                    key={idx}
                    className="bg-black/30 rounded-2xl p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold">{employee.name}</p>
                      <p className="text-sm text-gray-400">{employee.type}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-yellow-400 font-medium">
                        {employee.shift}
                      </span>
                        <button
                        onClick={async () => {
                          await supabase
                            .from('shifts')
                            .update({ open: true })
                            .eq('employee_name', employee.name)

                          location.reload()
                        }}
                        className="bg-red-500/20 hover:bg-red-500/40 text-red-300 px-3 py-1 rounded-xl text-xs transition"
                      >
                        Abmelden
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-white/5 border border-yellow-400/20 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-3xl font-bold text-yellow-400">
                  Offene Schichten
                </h2>

                <p className="text-gray-400 mt-2">
                  Freigegebene Schichten
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {openShifts.map((shift, index) => (
                <div
                  key={index}
                  className="bg-black/30 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {shift.day}
                    </p>

                    <p className="text-gray-400 text-sm">
                      {shift.shift}
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      await supabase
                        .from('shifts')
                        .update({
                          open: false,
                          employee_name: '08-jessy-hart-vorlauf',
                        })
                        .eq('id', shift.id)

                      location.reload()
                    }}
                    className="bg-yellow-400 text-black px-5 py-3 rounded-2xl font-bold hover:scale-105 transition"
                  >
                    Übernehmen
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  )
}
