import { useState } from 'react'
import { supabase } from './supabase'

export default function ChinaTownDienstplan() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('Login fehlgeschlagen')
    } else {
      alert('Erfolgreich eingeloggt')
      console.log(data)
    }
  }

  const blacklist = [
    ['11-gokay-sahin', '15-melik-hak'],
  ]

  const employees = [
    { name: '01-santiago-oconner', role: 'Geschäftsführer' },
    { name: '02-david-lox', role: 'Geschäftsführer' },
    { name: '03-amelie-bloom', role: 'Service' },
    { name: '04-miguel-monroe', role: 'Küche' },
  ]

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
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400"
              />

              <input
                type="password"
                placeholder="Passwort"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400"
              />

              <button
                onClick={handleLogin}
                className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-bold hover:scale-[1.01] transition"
              >
                Als Admin anmelden
              </button>

            </div>
          </div>

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

        </div>

      </div>
    </div>
  )
}