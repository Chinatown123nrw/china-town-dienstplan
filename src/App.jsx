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

  const shifts = [
    {
      day: 'Montag',
      employees: [
        { name: '01-santiago-oconner', shift: '16:00 - 17:30', type: '1 1/2 Stunden' },
        { name: '03-amelie-bloom', shift: '17:30 - 18:30', type: '1 Stunde' },
        { name: '04-miguel-monroe', shift: '18:30 - 20:00', type: '1 1/2 Stunden' },
        { name: '06-bella-dark', shift: '20:00 - 21:00', type: '1 Stunde' },
        { name: '07-jason-brocks', shift: '21:00 - 22:00', type: '1 Stunde' },
      ],
    },
    {
      day: 'Dienstag',
      employees: [
        { name: '02-david-lox', shift: '16:00 - 17:30', type: '1 1/2 Stunden' },
        { name: '08-jessy-hart-vorlauf', shift: '17:30 - 18:30', type: '1 Stunde' },
        { name: '09-fabio-caruso', shift: '18:30 - 20:00', type: '1 1/2 Stunden' },
        { name: '10-cardi-oconner', shift: '20:00 - 21:00', type: '1 Stunde' },
        { name: '13-chris-martens', shift: '21:00 - 22:00', type: '1 Stunde' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-950 via-red-900 to-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-5xl font-bold text-yellow-400">
              China Town
            </h1>
            <p className="text-gray-300 mt-2">
              Automatische Wochenplanung bis 22 Uhr
            </p>
          </div>

          <button className="bg-yellow-400 text-black px-6 py-3 rounded-2xl font-bold hover:scale-105 transition">
            Admin Bereich
          </button>
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

                      <button className="bg-red-500/20 hover:bg-red-500/40 text-red-300 px-3 py-1 rounded-xl text-xs transition">
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
                Abgemeldete Schichten können übernommen werden.
              </p>
            </div>

            <span className="bg-red-500/20 text-red-300 px-4 py-2 rounded-xl text-sm">
              Offen
            </span>
          </div>

          <div className="bg-black/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">Mittwoch 20:00 - 21:00</p>
              <p className="text-gray-400 text-sm">
                Schicht wurde freigegeben
              </p>
            </div>

            <button className="bg-yellow-400 text-black px-5 py-3 rounded-2xl font-bold hover:scale-105 transition">
              Übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
