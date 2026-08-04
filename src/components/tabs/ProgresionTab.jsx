import { useState, useCallback, useEffect } from "react";
import { nc } from '../../theory/notes.js';
import { buildScale } from '../../theory/notes.js';
import { tNote, DN, DQ, MODE_BY_DEGREE } from '../../theory/formulas.js';
import { computeProg } from '../../theory/harmony.js';
import { buildVoicing } from '../../theory/voicings.js';
import { parseChord } from '../../theory/parser.js';
import { playChord } from '../../audio/engine.js';
import Nota from '../harmony/Nota.jsx';
import VoicingDisplay from '../harmony/VoicingDisplay.jsx';

const EJEMPLOS = ["Dm7 – G7 – Cmaj7","Am7b5 – D7b9 – Gm","Cmaj7 – A7 – Dm7 – G7","Am – E7 – Am – Dm"];

export default function ProgresionTab({ initialProg = null }) {
  const [progInput,   setProgInput]   = useState(initialProg || "Dm7 – G7 – Cmaj7");
  const [progression, setProgression] = useState(null);

  // Si llega una progresión desde la Biblioteca, analizarla automáticamente
  useEffect(() => {
    if(initialProg) {
      setProgInput(initialProg);
      const parts  = initialProg.split(/[\s\u2013\-,|]+/).filter(Boolean);
      const parsed = parts.map(p => parseChord(p)).filter(Boolean);
      if(parsed.length > 0) setProgression(computeProg(parsed));
    }
  }, [initialProg]);

  const analyzeProg = useCallback(() => {
    const parts  = progInput.split(/[\s–\-,|]+/).filter(Boolean);
    const parsed = parts.map(p => parseChord(p)).filter(Boolean);
    if(parsed.length > 0) setProgression(computeProg(parsed));
  }, [progInput]);

  return (
    <div className="space-y-5 stagger">
      <div>
        <p className="text-sm text-gray-500 mb-2">Acordes separados por guion, coma o espacio</p>
        <div className="flex gap-2">
          <input value={progInput} onChange={e => setProgInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyzeProg()}
            placeholder="Ej: Dm7 – G7 – Cmaj7"
            className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-lg"
            style={{ fontFamily:"monospace" }} />
          <button onClick={analyzeProg}
            className="px-5 py-3 rounded-xl text-sm font-bold"
            style={{ background:"#1e2a4a", border:"1px solid #4466cc", color:"#88aaff" }}>
            Analizar
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {EJEMPLOS.map(ex => (
            <button key={ex} onClick={() => setProgInput(ex)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {progression && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 uppercase tracking-widest">
            Tonalidad probable:
            <span className="ml-2 text-yellow-400 font-bold text-base">{progression[0]?.key} Mayor</span>
          </p>
          {progression.map((ch, i) => {
            const f     = ch.fn;
            const scale = f?.modeIvs ? buildScale(ch.root, f.modeIvs) : [];
            const twn   = (f?.tensions || []).map(t => ({ label:t, note:tNote(ch.root,t) }));
            const v     = buildVoicing(ch.root, ch.quality);
            const dia   = scale.length >= 7 ? scale.map((sn, si) => {
              const md = MODE_BY_DEGREE[si]; if(!md) return null;
              const chNotes = [0,2,4,6].map(ci => scale[(si+ci)%7]);
              const tens = (md.tensions||[]).map(t => ({ label:t, note:tNote(sn,t) }));
              const avd  = (md.avoid  ||[]).map(t => ({ label:t, note:tNote(sn,t) }));
              return { root:sn, degree:DN[si], quality:DQ[si], mode:md.name, chNotes, tens, avd };
            }).filter(Boolean) : [];

            return (
              <div key={i} className="rounded-2xl border border-gray-700 overflow-hidden" style={{ background:"#0e0e1c" }}>
                <div className="px-4 pt-4 pb-3 border-b border-gray-800">
                  <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                    <span className="text-2xl font-bold" style={{ fontFamily:"'Libre Baskerville',serif" }}>{ch.raw}</span>
                    <button onClick={() => playChord(ch.notes)} className="text-sm text-gray-600 hover:text-blue-400">▶</button>
                    <span className="text-xs px-2.5 py-1 rounded-full border"
                      style={{ background:"#1a2540", borderColor:"#4466cc", color:"#88aaff" }}>
                      {ch.degree} en {ch.key}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {ch.notes.map(n => <Nota key={n} note={n} size="sm" />)}
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-gray-600 mb-1.5">Voicing</p>
                    <VoicingDisplay leftVoice={v.L} rightVoice={v.R} />
                  </div>
                  {f && (
                    <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
                      <span><span className="text-indigo-300">Modo: </span><span className="text-white font-semibold">{f.mode}</span></span>
                      {twn.length > 0 && (
                        <span className="flex gap-1.5 flex-wrap items-center">
                          <span className="text-gray-500">Tensiones:</span>
                          {twn.map(({ label, note }, j) => {
                            const color = note ? nc(note) : "#888";
                            return (
                              <span key={j} className="font-mono text-xs px-1.5 py-0.5 rounded border"
                                style={{ background:color+"18", borderColor:color+"55", color }}>
                                {label}{note ? `→${note}` : ""}
                              </span>
                            );
                          })}
                        </span>
                      )}
                      {f.avoid?.length > 0 && (
                        <span className="text-xs text-red-400">
                          Evitar: {f.avoid.map(t => { const n = tNote(ch.root,t); return n ? `${t}→${n}` : t; }).join(" · ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {dia.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                      Acordes diatónicos — {scale.join(" · ")}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" style={{ minWidth:"460px" }}>
                        <thead>
                          <tr style={{ borderBottom:"1px solid #1e2438" }}>
                            {["Gr.","Acorde","Notas","Modo","Tensiones","Evitar"].map(h => (
                              <th key={h} className="text-left pb-1.5 text-gray-600 font-normal">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dia.map((dc, di) => {
                            const rc = nc(dc.root);
                            return (
                              <tr key={di} style={{ borderBottom:"1px solid #111420", background:di%2===0?"transparent":"#0a0c1a" }}>
                                <td className="py-1.5 pr-2">
                                  <span className="font-mono font-bold px-1.5 py-0.5 rounded" style={{ background:rc+"22", color:rc }}>{dc.degree}</span>
                                </td>
                                <td className="py-1.5 pr-2">
                                  <button className="font-bold hover:opacity-75" style={{ color:rc }}
                                    onClick={() => { const c = parseChord(`${dc.root}${dc.quality}`); if(c) playChord(c.notes); }}>
                                    {dc.root}{dc.quality} ▶
                                  </button>
                                </td>
                                <td className="py-1.5 pr-2">
                                  <div className="flex gap-0.5 flex-wrap">
                                    {dc.chNotes.map((n, ni) => (
                                      <span key={ni} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full border font-bold"
                                        style={{ fontSize:"9px", backgroundColor:nc(n)+"18", borderColor:nc(n)+"55", color:nc(n) }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background:nc(n) }} />{n}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-1.5 pr-2 text-indigo-300 whitespace-nowrap">{dc.mode}</td>
                                <td className="py-1.5 pr-2">
                                  <div className="flex gap-0.5 flex-wrap">
                                    {dc.tens.map(({ label, note }, ti) => (
                                      <span key={ti} className="px-1 py-0.5 rounded font-mono whitespace-nowrap"
                                        style={{ background:"#0a1f0a", color:"#6dbd6d", border:"1px solid #2d5c2d", fontSize:"9px" }}>
                                        {label}{note ? `→${note}` : ""}
                                      </span>
                                    ))}
                                    {!dc.tens.length && <span className="text-gray-700">—</span>}
                                  </div>
                                </td>
                                <td className="py-1.5">
                                  <div className="flex gap-0.5 flex-wrap">
                                    {dc.avd.map(({ label, note }, ai) => (
                                      <span key={ai} className="px-1 py-0.5 rounded font-mono whitespace-nowrap"
                                        style={{ background:"#1f0a0a", color:"#bd6d6d", border:"1px solid #5c2d2d", fontSize:"9px" }}>
                                        {label}{note ? `→${note}` : ""}
                                      </span>
                                    ))}
                                    {!dc.avd.length && <span className="text-gray-700">—</span>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
