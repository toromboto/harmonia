import { NC_DEFAULT, ENHARMONIC } from '../../theory/notes.js';
import { playTone } from '../../audio/engine.js';

export default function ColoresTab() {
  return (
    <div className="stagger">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily:"'Libre Baskerville',serif" }}>🎨 Sistema Cromático Tonal</h2>
        <p className="text-xs text-gray-500">Cada nota tiene un color único. Tocá para escuchar.</p>
      </div>

      {/* Notas naturales */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {Object.entries(NC_DEFAULT).filter(([n]) => n.length === 1).map(([note, hex]) => (
          <div key={note} className="rounded-xl p-4 border cursor-pointer"
            style={{ background:hex+"11", borderColor:hex+"44" }}
            onClick={() => playTone(note, 4, 0.7)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2" style={{ background:hex, borderColor:hex }} />
              <div>
                <p className="text-xl font-bold" style={{ color:hex, fontFamily:"'Libre Baskerville',serif" }}>{note}</p>
                <p className="text-xs font-mono text-gray-600">{hex}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notas alteradas */}
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Notas alteradas</p>
      <div className="grid grid-cols-2 gap-3">
        {["C#","D#","F#","G#","A#"].map(note => {
          const hex = NC_DEFAULT[note];
          return (
            <div key={note} className="rounded-xl p-4 border cursor-pointer"
              style={{ background:hex+"11", borderColor:hex+"44" }}
              onClick={() => playTone(note, 4, 0.7)}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full" style={{ background:`linear-gradient(135deg,${hex},${hex}88)` }} />
                <div>
                  <p className="font-bold" style={{ color:hex }}>{note} / {ENHARMONIC[note]}</p>
                  <p className="text-xs font-mono text-gray-600">{hex}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
