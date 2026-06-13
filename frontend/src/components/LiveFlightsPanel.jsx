export default function LiveFlightsPanel({ flights }) {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4 text-white shadow-xl border border-slate-700">
      <h2 className="text-lg font-semibold mb-3">Live Flights Around India</h2>

      <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
        {flights.length === 0 ? (
          <p className="text-sm text-slate-400">No live flights loaded yet.</p>
        ) : (
          flights.map((f, idx) => (
            <div key={`${f.callsign}-${idx}`} className="rounded-xl bg-slate-800 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{f.callsign}</div>
                <span className="text-xs text-emerald-400">{f.status}</span>
              </div>
              <div className="text-sm text-slate-300 mt-1">
                {f.from} → {f.to}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {f.airline} · {f.altitude ? `${f.altitude} ft` : "altitude N/A"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}