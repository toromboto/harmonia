import { useState } from "react";
import { nc } from '../../theory/notes.js';
import { computeProg } from '../../theory/harmony.js';
import { parseChord } from '../../theory/parser.js';
import { playChord } from '../../audio/engine.js';
import { BIBLIOTECA } from '../../data/biblioteca.js';

export default function BibliotecaTab({ onAnalizar }) {
  const [bibGenero, setBibGenero] = useState("Tango");

  return (
    <div className="space-y-4 stagger">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily:"'Libre Baskerville',serif" }}>
          <span style={{ color:"#f59e0b" }}>📚</span>
          <span className="ml-2">Biblioteca de Progresiones</span>
        </h2>
        <p className="text-sm text-gray-500">Progresiones del tango, jazz y música latinoamericana.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {BIBLIOTECA.map(g => (
          <button key={g.genero} onClick={() => setBibGenero(g.genero)}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold border"
            style={{ background:bibGenero===g.genero?g.color+"33":"transparent", borderColor:bibGenero===g.genero?g.color:"#333", color:bibGenero===g.genero?g.color:"#666" }}>
            {g.icon} {g.genero}
          </button>
        ))}
      </div>

      {BIBLIOTECA.filter(g => g.genero === bibGenero).map(g => (
        <div key={g.genero} className="space-y-3">
          {g.items.map((item, i) => {
            const parts  = item.prog.split(/[\s–\-,|]+/).filter(Boolean);
            const parsed = parts.map(p => parseChord(p)).filter(Boolean);
            return (
              <div key={i} className="rounded-xl border border-gray-700 overflow-hidden" style={{ background:"#0e0e1c" }}>
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-200">{item.titulo}</p>
                      {item.nota && <p className="text-xs text-gray-500 italic mt-0.5">{item.nota}</p>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { let d=0; parsed.forEach(ch => { setTimeout(() => playChord(ch.notes), d); d+=700; }); }}
                        className="px-2.5 py-1 rounded-lg text-xs border"
                        style={{ background:"#0d1520", borderColor:"#2a3a5a", color:"#88aaff" }}>▶</button>
                      <button onClick={() => onAnalizar && onAnalizar(item.prog)}
                        className="px-2.5 py-1 rounded-lg text-xs border font-semibold"
                        style={{ background:"#1e2a4a", borderColor:"#4466cc", color:"#88aaff" }}>
                        Analizar →
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {parsed.map((ch, ci) => (
                      <button key={ci} onClick={() => playChord(ch.notes)}
                        className="px-2.5 py-1 rounded-lg border font-bold text-xs"
                        style={{ backgroundColor:nc(ch.root)+"22", borderColor:nc(ch.root)+"66", color:nc(ch.root) }}>
                        {ch.raw}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {parsed.map((ch, ci) => (
                      <div key={ci} className="flex gap-0.5 items-center">
                        {ch.notes.map((n, ni) => (
                          <div key={ni} className="w-2 h-2 rounded-full" style={{ background:nc(n) }} title={n} />
                        ))}
                        {ci < parsed.length-1 && <span className="text-gray-700 mx-1 text-xs">–</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
