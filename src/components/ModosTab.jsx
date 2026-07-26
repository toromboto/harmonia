import { nc, CHROMATIC, noteIdx } from '../../theory/notes.js';
import { buildScale } from '../../theory/notes.js';
import { tNote, MSI, DN, MODE_BY_DEGREE } from '../../theory/formulas.js';
import { playTone } from '../../audio/engine.js';

export default function ModosTab() {
  return (
    <div className="stagger space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily:"'Libre Baskerville',serif" }}>📐 Modos de la Escala Mayor</h2>
        <p className="text-xs text-gray-500">Los 7 modos griegos, sus tensiones y su uso en tango y jazz</p>
      </div>

      {MODE_BY_DEGREE.map((md, i) => {
        const rootOfMode = buildScale("C", MODES_JÓNICO)[i] || "C";
        const scale      = buildScale("C", md.ivs);
        const twn = md.tensions.map(t => ({ label:t, note:tNote(rootOfMode, t) }));
        const awn = md.avoid.map(t   => ({ label:t, note:tNote(rootOfMode, t) }));
        const degColor = nc(CHROMATIC[(noteIdx("C") + MSI[i]) % 12]);

        return (
          <div key={i} className="rounded-xl border border-gray-700 overflow-hidden" style={{ background:"#0e0e1c" }}>
            <div className="px-4 py-3 border-b border-gray-800" style={{ background:"#111825" }}>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold px-2 py-1 rounded text-sm"
                  style={{ background:degColor+"33", color:degColor }}>{md.degree}</span>
                <div>
                  <p className="font-bold text-base text-white">{md.name}</p>
                  <p className="text-xs text-gray-500">{md.q} — Grado {md.degree} de la escala mayor</p>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Escala desde C {md.name}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {scale.map((n, ni) => (
                    <button key={ni} onClick={() => playTone(n, 4, 0.5)}
                      className="flex flex-col items-center px-2 py-1.5 rounded-lg border text-xs font-bold"
                      style={{ backgroundColor:nc(n)+"22", borderColor:nc(n)+"55", color:nc(n), minWidth:"30px" }}>
                      <span>{n}</span>
                      <span style={{ fontSize:"8px", opacity:0.5 }}>{ni+1}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-2.5 border border-green-900" style={{ background:"#070f07" }}>
                  <p className="text-xs font-bold text-green-400 mb-1.5">✅ Tensiones</p>
                  <div className="flex flex-wrap gap-1">
                    {twn.map(({ label, note }, j) => {
                      const color = note ? nc(note) : "#6dbd6d";
                      return (
                        <span key={j} className="px-1.5 py-0.5 rounded border font-mono text-xs"
                          style={{ background:color+"18", borderColor:color+"55", color }}>
                          {label}{note ? `→${note}` : ""}
                        </span>
                      );
                    })}
                    {!twn.length && <span className="text-gray-700 text-xs">Sin tensiones adicionales</span>}
                  </div>
                </div>
                <div className="rounded-lg p-2.5 border border-red-900" style={{ background:"#0f0707" }}>
                  <p className="text-xs font-bold text-red-400 mb-1.5">⚠️ Evitar</p>
                  <div className="flex flex-wrap gap-1">
                    {awn.map(({ label, note }, j) => {
                      const color = note ? nc(note) : "#bd6d6d";
                      return (
                        <span key={j} className="px-1.5 py-0.5 rounded border font-mono text-xs"
                          style={{ background:color+"18", borderColor:color+"55", color }}>
                          {label}{note ? `→${note}` : ""}
                        </span>
                      );
                    })}
                    {!awn.length && <span className="text-gray-700 text-xs">—</span>}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-indigo-300 font-semibold">Uso típico: </span>
                {[
                  "Tónica mayor, jazz, bossa nova, pop",
                  "ii grado, jazz-funk, tango luminoso",
                  "iii grado, color oscuro, transición",
                  "IV mayor, bossa nova, jazz moderno",
                  "V7, dominante de todos los estilos",
                  "vi grado, balada, tango en menor",
                  "vii°, paso cromático, tango expresivo",
                ][i]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MODES_JÓNICO = [0,2,4,5,7,9,11];
