import { nc } from '../../theory/notes.js';
import { buildScale } from '../../theory/notes.js';
import { tNote } from '../../theory/formulas.js';
import { playTone } from '../../audio/engine.js';

export default function TablaComparativa({ fns, root }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800" style={{ background:"#080a14" }}>
      <table className="w-full text-xs" style={{ minWidth:"550px" }}>
        <thead>
          <tr style={{ background:"#0e1228", borderBottom:"1px solid #2a3a5a" }}>
            {["Grado","Función","Modo","Escala","Tensiones","Evitar"].map(h => (
              <th key={h} className="text-left px-3 py-2 text-gray-500 uppercase tracking-widest font-normal text-xs">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fns.map((f, i) => {
            const scale = f.modeIvs ? buildScale(root, f.modeIvs) : [];
            const twn = (f.tensions || []).map(t => { const n = tNote(root, t); return n ? `${t}→${n}` : t; });
            const awn = (f.avoid   || []).map(t => { const n = tNote(root, t); return n ? `${t}→${n}` : t; });
            return (
              <tr key={i} style={{ borderBottom:"1px solid #111520", background:i%2===0?"transparent":"#0a0c18" }}>
                <td className="px-3 py-2">
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded text-xs"
                    style={{ background:"#0d1520", color:"#88aaff" }}>{f.degree}</span>
                </td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-blue-200">{f.fn}</p>
                  <p className="text-gray-500 italic">{f.key}</p>
                </td>
                <td className="px-3 py-2 text-indigo-300 whitespace-nowrap">{f.mode}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {scale.map((n, j) => (
                      <button key={j} onClick={() => playTone(n, 4, 0.5)}
                        className="px-1.5 py-0.5 rounded border font-bold"
                        style={{ backgroundColor:nc(n)+"22", borderColor:nc(n)+"55", color:nc(n) }}>{n}</button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {twn.map((t, j) => (
                      <span key={j} className="px-1.5 py-0.5 rounded font-mono"
                        style={{ background:"#0a1f0a", borderColor:"#2d5c2d", color:"#6dbd6d", border:"1px solid #2d5c2d" }}>{t}</span>
                    ))}
                    {!twn.length && <span className="text-gray-700">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {awn.map((t, j) => (
                      <span key={j} className="px-1.5 py-0.5 rounded font-mono"
                        style={{ background:"#1f0a0a", color:"#bd6d6d", border:"1px solid #5c2d2d" }}>{t}</span>
                    ))}
                    {!awn.length && <span className="text-gray-700">—</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
