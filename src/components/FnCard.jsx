import { useState, useMemo } from "react";
import { nc } from '../../theory/notes.js';
import { buildScale } from '../../theory/notes.js';
import { tNote, DN, DQ_POR_MODO, DQ_SIMBOLO } from '../../theory/formulas.js';
import { playTone } from '../../audio/engine.js';

// Card desplegable de función armónica.
// Muestra: modo + escala + acordes diatónicos + tensiones + avoid + resoluciones + explicación.
export default function FnCard({ fn, root, isOpen, onToggle }) {
  const scale = useMemo(
    () => fn.modeIvs ? buildScale(root, fn.modeIvs) : [],
    [root, fn.modeIvs]
  );

  const twn = useMemo(
    () => (fn.tensions || []).map(t => ({ label: t, note: tNote(root, t) })),
    [root, fn.tensions]
  );

  const awn = useMemo(
    () => (fn.avoid || []).map(t => ({ label: t, note: tNote(root, t) })),
    [root, fn.avoid]
  );

  const diatonic = useMemo(() => {
    const calidades = DQ_POR_MODO[fn.mode];
    if(!calidades || scale.length < 7) return [];
    return scale.slice(0, 7).map((nota, i) => ({
      nota,
      grado: DN[i],
      calidad: calidades[i],
      simbolo: DQ_SIMBOLO[calidades[i]] ?? calidades[i],
    }));
  }, [scale, fn.mode]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: isOpen ? "#4466cc" : "#1e2030" }}>
      {/* Header */}
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
        style={{ background: isOpen ? "#111d36" : "#0c0c1c" }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
            style={{ background: "#0d1520", borderColor: "#2a3a5a", color: "#88aaff" }}>
            {fn.degree}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-blue-200 truncate">{fn.fn}</p>
            <p className="text-xs text-gray-500 italic truncate">{fn.key}</p>
          </div>
        </div>
        <span className="text-gray-600 text-xs flex-shrink-0">{isOpen ? "▲" : "▼"}</span>
      </button>

      {/* Body */}
      {isOpen && (
        <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: "#09091a" }}>

          {/* Modo + Escala */}
          <div className="rounded-lg p-3 border border-gray-800" style={{ background: "#0c0f20" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-indigo-300 font-semibold">Modo:</span>
              <span className="text-sm font-bold text-white">{fn.mode}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {scale.map((n, i) => (
                <button key={i} onClick={() => playTone(n, 4, 0.5)}
                  className="flex flex-col items-center px-2 py-1.5 rounded-lg border text-sm font-bold"
                  style={{ backgroundColor: nc(n) + "22", borderColor: nc(n) + "66", color: nc(n), minWidth: "34px" }}>
                  <span>{n}</span>
                  <span style={{ fontSize: "8px", opacity: 0.5 }}>{i + 1}°</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 font-mono">{scale.join(" — ")}</p>

            {/* Acordes diatónicos */}
            {diatonic.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-widest">Acordes diatónicos</p>
                <div className="flex flex-wrap gap-1.5">
                  {diatonic.map((d, i) => {
                    const color = nc(d.nota);
                    const chordNotes = [0,2,4,6].map(ci => scale[(i + ci) % 7]);
                    return (
                      <button key={i}
                        onClick={() => chordNotes.forEach((n, j) => setTimeout(() => playTone(n, 4, 0.8), j * 15))}
                        className="flex flex-col items-center px-2 py-1.5 rounded-lg border font-bold"
                        style={{ backgroundColor: color + "18", borderColor: color + "55", color, minWidth: "40px" }}>
                        <span style={{ fontSize: "9px", opacity: 0.55 }}>{d.grado}</span>
                        <span className="text-sm">{d.nota}</span>
                        <span style={{ fontSize: "9px", opacity: 0.75 }}>{d.simbolo}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tensiones y avoid */}
          <div className="grid grid-cols-2 gap-2">
            {twn.length > 0 && (
              <div className="rounded-lg p-3 border border-green-900" style={{ background: "#070f07" }}>
                <p className="text-xs font-bold text-green-400 mb-2">✅ Tensiones</p>
                <div className="space-y-1.5">
                  {twn.map(({ label, note }, i) => {
                    const color = note ? nc(note) : "#888";
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-green-300 w-7">{label}</span>
                        <span className="text-gray-600 text-xs">→</span>
                        {note
                          ? <button onClick={() => playTone(note, 4, 0.5)}
                              className="px-2 py-0.5 rounded-full text-sm font-bold border"
                              style={{ backgroundColor: color + "22", borderColor: color, color }}>{note}</button>
                          : <span className="text-gray-600 text-xs italic">varía</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {awn.length > 0 && (
              <div className="rounded-lg p-3 border border-red-900" style={{ background: "#0f0707" }}>
                <p className="text-xs font-bold text-red-400 mb-2">⚠️ Evitar</p>
                <div className="space-y-1.5">
                  {awn.map(({ label, note }, i) => {
                    const color = note ? nc(note) : "#888";
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-red-400 w-7">{label}</span>
                        <span className="text-gray-600 text-xs">→</span>
                        {note && (
                          <span className="px-2 py-0.5 rounded-full text-sm font-bold border"
                            style={{ backgroundColor: color + "22", borderColor: color, color }}>{note}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Resoluciones */}
          {fn.resolutions?.length > 0 && (
            <div className="rounded-lg p-2.5 border border-yellow-900" style={{ background: "#0f0e07" }}>
              <span className="text-xs text-yellow-400 font-semibold">➜ </span>
              <span className="text-sm text-yellow-200 font-mono">{fn.resolutions.join(" · ")}</span>
            </div>
          )}

          {/* Por qué funciona */}
          <div className="rounded-lg p-3 border border-gray-800" style={{ background: "#08080f" }}>
            <p className="text-xs text-gray-500 mb-1">💡 Por qué funciona</p>
            <p className="text-sm text-gray-300 leading-relaxed">{fn.why}</p>
          </div>
        </div>
      )}
    </div>
  );
}
