import { useState, useEffect, useCallback, useMemo } from "react";
import { nc } from '../../theory/notes.js';
import { getFns } from '../../theory/harmony.js';
import { buildVoicing } from '../../theory/voicings.js';
import { parseChord } from '../../theory/parser.js';
import { playChord, playTone } from '../../audio/engine.js';
import Nota from '../harmony/Nota.jsx';
import VoicingDisplay from '../harmony/VoicingDisplay.jsx';
import FnCard from '../harmony/FnCard.jsx';
import Circulo from '../harmony/Circulo.jsx';
import TablaComparativa from '../harmony/TablaComparativa.jsx';

export default function ChordTab() {
  const [chordInput, setChordInput] = useState("Dm7");
  const [chord,      setChord]      = useState(null);
  const [openFns,    setOpenFns]    = useState([0]);
  const [showTable,  setShowTable]  = useState(false);

  const analyzeChord = useCallback(() => {
    const c = parseChord(chordInput);
    setChord(c); setOpenFns([0]); setShowTable(false);
    if(c) playChord(c.notes);
  }, [chordInput]);

  useEffect(() => { setChord(parseChord("Dm7")); }, []);

  const fns     = useMemo(() => chord ? getFns(chord.quality) : [], [chord]);
  const voicing = useMemo(() => chord ? buildVoicing(chord.root, chord.quality) : null, [chord]);
  const toggleFn = useCallback(i => setOpenFns(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]), []);

  return (
    <div className="space-y-5 stagger">
      {/* Input */}
      <div className="flex gap-2">
        <input value={chordInput} onChange={e => setChordInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && analyzeChord()}
          placeholder="Ej: Dm7, G7, Cmaj7, Am7b5, Bb7alt…"
          className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-lg text-gray-100"
          style={{ fontFamily:"monospace" }} />
        <button onClick={analyzeChord}
          className="px-5 py-3 rounded-xl text-sm font-bold"
          style={{ background:"#1e2a4a", border:"1px solid #4466cc", color:"#88aaff", whiteSpace:"nowrap" }}>
          Analizar
        </button>
      </div>

      {chord && <>
        {/* Acorde */}
        <div className="rounded-2xl p-5 border border-gray-700" style={{ background:"#0e0e20" }}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Acorde</p>
          <div className="flex items-baseline gap-3 mb-4 flex-wrap">
            <h2 className="text-3xl font-bold" style={{ fontFamily:"'Libre Baskerville',serif" }}>
              {chord.root}<span className="text-gray-400">{chord.formula.symbol}</span>
            </h2>
            <span className="text-lg text-gray-400 italic">{chord.formula.label}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {chord.notes.map(n => <Nota key={n} note={n} size="lg" />)}
          </div>
          {voicing && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Voicing</p>
              <VoicingDisplay leftVoice={voicing.L} rightVoice={voicing.R} />
            </div>
          )}
          <button onClick={() => playChord(chord.notes)}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold border"
            style={{ background:"#0d1520", borderColor:"#2a3a5a", color:"#88aaff" }}>
            ▶ Escuchar acorde
          </button>
        </div>

        {/* Funciones armónicas */}
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            Funciones armónicas <span className="text-gray-700">({fns.length})</span>
          </p>
          <div className="flex gap-1 ml-auto">
            {["Detalle","Tabla"].map((v, vi) => (
              <button key={v} onClick={() => setShowTable(vi === 1)}
                className="px-3 py-1 rounded-lg text-xs border"
                style={{ background:showTable===(vi===1)?"#1e2a4a":"transparent", borderColor:showTable===(vi===1)?"#4466cc":"#333", color:showTable===(vi===1)?"#88aaff":"#666" }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {showTable
          ? <TablaComparativa fns={fns} root={chord.root} />
          : <div className="space-y-2">
              {fns.map((f, i) => (
                <FnCard key={i} fn={f} root={chord.root}
                  isOpen={openFns.includes(i)} onToggle={() => toggleFn(i)} />
              ))}
            </div>
        }

        {/* Círculo */}
        <div className="rounded-xl p-4 border border-gray-800" style={{ background:"#0b0f20" }}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Círculo de Quintas</p>
          <Circulo highlighted={[chord.root]} />
        </div>
      </>}
    </div>
  );
}
