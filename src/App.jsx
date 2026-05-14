import { useState, useEffect } from "react";

// ─── SISTEMA DE COLORES ───────────────────────────────────────────────────────
const NOTE_COLORS = {
  C:  { rgb: [30, 80, 220],   name: "Azul",         hex: "#1E50DC" },
  D:  { rgb: [40, 160, 60],   name: "Verde",        hex: "#28A03C" },
  E:  { rgb: [130, 80, 30],   name: "Marrón",       hex: "#82501E" },
  F:  { rgb: [200, 185, 140], name: "Beige",        hex: "#C8B98C" },
  G:  { rgb: [230, 200, 20],  name: "Amarillo",     hex: "#E6C814" },
  A:  { rgb: [210, 40, 40],   name: "Rojo",         hex: "#D22828" },
  B:  { rgb: [120, 40, 180],  name: "Violeta",      hex: "#7828B4" },
  "C#": { rgb: [35, 120, 180],  name: "Turquesa",      hex: "#2378B4" },
  "Db": { rgb: [35, 120, 180],  name: "Turquesa",      hex: "#2378B4" },
  "D#": { rgb: [40, 180, 100],  name: "Verde claro",   hex: "#28B464" },
  "Eb": { rgb: [40, 180, 100],  name: "Verde claro",   hex: "#28B464" },
  "F#": { rgb: [215, 192, 80],  name: "Amarillo beige",hex: "#D7C050" },
  "Gb": { rgb: [215, 192, 80],  name: "Amarillo beige",hex: "#D7C050" },
  "G#": { rgb: [220, 120, 30],  name: "Naranja",       hex: "#DC781E" },
  "Ab": { rgb: [220, 120, 30],  name: "Naranja",       hex: "#DC781E" },
  "A#": { rgb: [165, 40, 110],  name: "Bordo",         hex: "#A5286E" },
  "Bb": { rgb: [165, 40, 110],  name: "Bordo",         hex: "#A5286E" },
};

const getNoteColor = (note) => {
  const clean = note.replace(/[0-9]/g, "").trim();
  return NOTE_COLORS[clean] || { hex: "#888", name: "?", rgb: [128, 128, 128] };
};

const CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };
const enharmonic = (n) => ENHARMONIC[n] || n;

const intervalFromRoot = (root, semitones) => {
  const idx = CHROMATIC.indexOf(root);
  return CHROMATIC[(idx + semitones + 12) % 12];
};

const CHORD_FORMULAS = {
  "maj":  { intervals:[0,4,7],             label:"Mayor",       symbol:"△" },
  "min":  { intervals:[0,3,7],             label:"Menor",       symbol:"m" },
  "7":    { intervals:[0,4,7,10],          label:"Dom. 7ª",     symbol:"7" },
  "maj7": { intervals:[0,4,7,11],          label:"Mayor 7ª",    symbol:"△7" },
  "min7": { intervals:[0,3,7,10],          label:"Menor 7ª",    symbol:"m7" },
  "dim":  { intervals:[0,3,6],             label:"Disminuido",  symbol:"°" },
  "dim7": { intervals:[0,3,6,9],           label:"Dim. 7ª",     symbol:"°7" },
  "m7b5": { intervals:[0,3,6,10],          label:"Semidism.",   symbol:"ø7" },
  "aug":  { intervals:[0,4,8],             label:"Aumentado",   symbol:"+" },
  "sus2": { intervals:[0,2,7],             label:"Sus2",        symbol:"sus2" },
  "sus4": { intervals:[0,5,7],             label:"Sus4",        symbol:"sus4" },
  "9":    { intervals:[0,4,7,10,14],       label:"Dom. 9ª",     symbol:"9" },
  "maj9": { intervals:[0,4,7,11,14],       label:"Mayor 9ª",    symbol:"△9" },
  "min9": { intervals:[0,3,7,10,14],       label:"Menor 9ª",    symbol:"m9" },
  "13":   { intervals:[0,4,7,10,14,21],    label:"Dom. 13ª",    symbol:"13" },
  "7b9":  { intervals:[0,4,7,10,13],       label:"Dom. b9",     symbol:"7b9" },
  "7#9":  { intervals:[0,4,7,10,15],       label:"Dom. #9",     symbol:"7#9" },
  "7alt": { intervals:[0,4,7,10,13,15,20], label:"Alt.",        symbol:"7alt" },
};

const HARMONIC_FUNCTIONS = {
  "7": [
    { fn:"V7 de ♭VII → I", key:"V7 resolviendo a tónica relativa", tensions:["9","13"], avoid:["11"], scale:"Mixolidio", example:"G7→C" },
    { fn:"V7/IV (subdominante dominante)", key:"Dominante del IV", tensions:["9","13"], avoid:["11"], scale:"Mixolidio", example:"C7→F" },
    { fn:"V7/iv (dominante menor)", key:"Resuelve a iv menor", tensions:["b9","#9","b13"], avoid:["9","13"], scale:"Alterada", example:"C7→Fm" },
    { fn:"Sustituto tritonal", key:"Tritono del dominante original", tensions:["9","#11","13"], avoid:[], scale:"Lidio b7", example:"Gb7≈C7" },
    { fn:"Dominante de paso", key:"Conecta acordes por cromatismo", tensions:["9","13"], avoid:[], scale:"Mixolidio", example:"D7→G" },
    { fn:"Dominante blues", key:"Color bluesy sin resolución tonal", tensions:["b9","#9"], avoid:[], scale:"Blues/Mixolidio b3", example:"" },
  ],
  "maj7": [
    { fn:"I△7 Tónica mayor", key:"Centro tonal mayor", tensions:["9","#11","13"], avoid:["11"], scale:"Jónico / Lidio", example:"Cmaj7=I" },
    { fn:"IV△7 Subdominante", key:"Color lírico, no resuelve fuerte", tensions:["9","#11"], avoid:["11"], scale:"Lidio", example:"Fmaj7=IV" },
  ],
  "min7": [
    { fn:"ii m7 Supertónica", key:"Pre-dominante en cadencia ii-V-I", tensions:["9","11"], avoid:["b9"], scale:"Dórico", example:"Dm7=ii" },
    { fn:"iii m7 Mediante", key:"Sustituto de la tónica", tensions:["9","11"], avoid:[], scale:"Frigio", example:"Em7=iii" },
    { fn:"vi m7 Relativa menor", key:"Tónica relativa, estable", tensions:["9","11"], avoid:[], scale:"Eólico", example:"Am7=vi" },
  ],
  "m7b5": [
    { fn:"iiø7 en menor", key:"Pre-dominante en contexto menor", tensions:["9","11","b13"], avoid:[], scale:"Locrio / Locrio #2", example:"Bm7b5=viiø" },
  ],
  "maj": [
    { fn:"I Mayor simple", key:"Tónica sin color 7ª", tensions:["9","6"], avoid:["7"], scale:"Jónico", example:"C=I" },
    { fn:"IV Mayor simple", key:"Subdominante simple", tensions:["9","6"], avoid:[], scale:"Jónico", example:"F=IV" },
    { fn:"V Mayor simple", key:"Dominante sin 7ª", tensions:["9","13"], avoid:["11"], scale:"Mixolidio", example:"G=V" },
  ],
  "min": [
    { fn:"i menor natural", key:"Tónica en tonalidad menor", tensions:["9","11","b6"], avoid:[], scale:"Eólico", example:"Am=i" },
    { fn:"iv menor", key:"Subdominante menor", tensions:["9","11","b6"], avoid:[], scale:"Eólico", example:"Dm=iv" },
  ],
  "dim7": [
    { fn:"vii°7 de dominante", key:"Acorde de paso cromático", tensions:[], avoid:[], scale:"Disminuida (tono-semitono)", example:"B°7=vii°" },
  ],
};

const getFunctions = (quality) =>
  HARMONIC_FUNCTIONS[quality] || [
    { fn:"Acorde de color", key:"Uso libre / modal", tensions:["varía"], avoid:[], scale:"Según contexto", example:"" },
  ];

const CIRCLE_OF_FIFTHS = [
  { note:"C",  minor:"Am",  deg:0   },
  { note:"G",  minor:"Em",  deg:30  },
  { note:"D",  minor:"Bm",  deg:60  },
  { note:"A",  minor:"F#m", deg:90  },
  { note:"E",  minor:"C#m", deg:120 },
  { note:"B",  minor:"G#m", deg:150 },
  { note:"F#", minor:"D#m", deg:180 },
  { note:"Db", minor:"Bbm", deg:210 },
  { note:"Ab", minor:"Fm",  deg:240 },
  { note:"Eb", minor:"Cm",  deg:270 },
  { note:"Bb", minor:"Gm",  deg:300 },
  { note:"F",  minor:"Dm",  deg:330 },
];

const MAJOR_SCALE_INTERVALS = [0,2,4,5,7,9,11];
const DEGREE_NAMES = ["I","II","III","IV","V","VI","VII"];

const analyzeProgression = (chords) => {
  const scores = {};
  CIRCLE_OF_FIFTHS.forEach(({ note }) => {
    let score = 0;
    const scale = MAJOR_SCALE_INTERVALS.map(i => CHROMATIC[(CHROMATIC.indexOf(note) + i) % 12]);
    chords.forEach(({ root }) => {
      if (scale.includes(root)) score += 2;
      if (scale.includes(enharmonic(root))) score += 2;
    });
    scores[note] = score;
  });
  const key = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const keyIdx = CHROMATIC.indexOf(key);
  const scaleNotes = MAJOR_SCALE_INTERVALS.map(i => CHROMATIC[(keyIdx + i) % 12]);
  return chords.map(({ root, quality, raw }) => {
    const rootInScale =
      scaleNotes.indexOf(root) !== -1
        ? scaleNotes.indexOf(root)
        : scaleNotes.indexOf(enharmonic(root));
    const degree = rootInScale >= 0 ? DEGREE_NAMES[rootInScale] : "?";
    return { raw, root, quality, degree, key };
  });
};

const parseChord = (input) => {
  const s = input.trim();
  const rootMatch = s.match(/^([A-G][#b]?)/);
  if (!rootMatch) return null;
  const root = rootMatch[1];
  const rest = s.slice(root.length).toLowerCase().replace(/\s/g, "");
  let quality = "maj";
  if (rest.includes("m7b5") || rest.includes("ø")) quality = "m7b5";
  else if (rest.includes("dim7") || rest.includes("°7")) quality = "dim7";
  else if (rest.includes("dim") || rest.includes("°")) quality = "dim";
  else if (rest.includes("maj7") || rest.includes("△7") || rest.includes("∆7")) quality = "maj7";
  else if (rest.includes("maj9") || rest.includes("△9")) quality = "maj9";
  else if (rest.includes("maj")) quality = "maj7";
  else if (rest.includes("m9")) quality = "min9";
  else if (rest.includes("m7")) quality = "min7";
  else if (rest.includes("7b9")) quality = "7b9";
  else if (rest.includes("7#9")) quality = "7#9";
  else if (rest.includes("7alt") || rest.includes("alt")) quality = "7alt";
  else if (rest.includes("13")) quality = "13";
  else if (rest.includes("9")) quality = "9";
  else if (rest.includes("7")) quality = "7";
  else if (rest.includes("aug") || rest.includes("+")) quality = "aug";
  else if (rest.includes("sus2")) quality = "sus2";
  else if (rest.includes("sus4") || rest.includes("sus")) quality = "sus4";
  else if (rest.includes("m")) quality = "min";
  const formula = CHORD_FORMULAS[quality];
  const notes = formula.intervals.map(i => intervalFromRoot(root, i % 12));
  return { root, quality, notes, formula, raw: s };
};

// ─── COMPONENTES VISUALES ─────────────────────────────────────────────────────

const ColorNote = ({ note, size = "md", showName = true }) => {
  const color = getNoteColor(note);
  const sizes = { sm:"px-2 py-0.5 text-xs", md:"px-3 py-1 text-sm", lg:"px-4 py-2 text-base" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold border-2 ${sizes[size]}`}
      style={{ backgroundColor: color.hex + "22", borderColor: color.hex, color: color.hex }}
    >
      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color.hex }} />
      {note}
      {showName && <span className="opacity-70 font-normal text-xs">({color.name})</span>}
    </span>
  );
};

const CircleOfFifths = ({ highlighted = [] }) => {
  const cx = 160, cy = 160, R = 130, r = 85;
  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-xs mx-auto select-none">
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#0d0d1a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={155} fill="url(#bgGrad)" stroke="#333" strokeWidth="1" />
      {CIRCLE_OF_FIFTHS.map(({ note, minor, deg }) => {
        const angle = (deg - 90) * (Math.PI / 180);
        const isHighlighted = highlighted.includes(note) || highlighted.includes(note.replace("#","b"));
        const ox = cx + R * Math.cos(angle);
        const oy = cy + R * Math.sin(angle);
        const mx = cx + r * Math.cos(angle);
        const my = cy + r * Math.sin(angle);
        const nc = getNoteColor(note);
        const fill = isHighlighted ? nc.hex : "#1e1e3a";
        const stroke = isHighlighted ? nc.hex : "#444";
        return (
          <g key={note}>
            <circle cx={ox} cy={oy} r={18} fill={fill} stroke={stroke} strokeWidth={isHighlighted ? 2 : 1} opacity={isHighlighted ? 1 : 0.7} />
            <text x={ox} y={oy+1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="bold" fill={isHighlighted ? "#fff" : "#aaa"} fontFamily="serif">{note}</text>
            <circle cx={mx} cy={my} r={12} fill="transparent" stroke={isHighlighted ? "#555" : "#2a2a4a"} strokeWidth="1" />
            <text x={mx} y={my+1} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill={isHighlighted ? "#ccc" : "#555"} fontFamily="serif">{minor}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={45} fill="#0d0d1a" stroke="#222" strokeWidth="1" />
      <text x={cx} y={cy-6} textAnchor="middle" fontSize="9" fill="#666" fontFamily="serif">Círculo</text>
      <text x={cx} y={cy+6} textAnchor="middle" fontSize="9" fill="#666" fontFamily="serif">de Quintas</text>
    </svg>
  );
};

const PianoKeyboard = ({ highlightedNotes = [] }) => {
  const whites = ["C","D","E","F","G","A","B"];
  const blacks = { 1:"C#", 3:"D#", 6:"F#", 8:"G#", 10:"A#" };
  const ww = 36, wh = 110, bw = 24, bh = 68;
  const total = whites.length * ww;
  return (
    <svg viewBox={`0 0 ${total} ${wh}`} className="w-full max-w-sm mx-auto">
      {whites.map((n, i) => {
        const isH = highlightedNotes.includes(n);
        const color = getNoteColor(n);
        return (
          <g key={n}>
            <rect x={i * ww} y={0} width={ww - 2} height={wh} rx="4"
              fill={isH ? color.hex : "#f5f0e8"} stroke="#333" strokeWidth="1" />
            {isH && (
              <text x={i * ww + ww / 2 - 1} y={wh - 12} textAnchor="middle" fontSize="9" fill="#fff" fontFamily="serif" fontWeight="bold">{n}</text>
            )}
          </g>
        );
      })}
      {Object.entries(blacks).map(([pos, n]) => {
        const isH = highlightedNotes.includes(n);
        const color = getNoteColor(n);
        const x = parseInt(pos) * ww - bw / 2 + 1;
        return (
          <g key={n}>
            <rect x={x} y={0} width={bw} height={bh} rx="3"
              fill={isH ? color.hex : "#1a1a1a"} stroke={isH ? color.hex : "#000"} strokeWidth="1" />
            {isH && (
              <text x={x + bw / 2} y={bh - 8} textAnchor="middle" fontSize="7" fill="#fff" fontFamily="serif">{n}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────

export default function HarmoniaApp() {
  const [tab, setTab] = useState("chord");
  const [chordInput, setChordInput] = useState("G7");
  const [chord, setChord] = useState(null);
  const [progInput, setProgInput] = useState("Dm7 – G7 – Cmaj7");
  const [progression, setProgression] = useState(null);
  const [selectedFn, setSelectedFn] = useState(0);

  const analyzeChord = () => {
    const c = parseChord(chordInput);
    setChord(c);
    setSelectedFn(0);
  };

  const analyzeProgression_ = () => {
    const parts = progInput.split(/[\s–\-,|]+/).filter(Boolean);
    const parsed = parts.map(p => parseChord(p)).filter(Boolean);
    if (parsed.length) setProgression(analyzeProgression(parsed));
  };

  useEffect(() => { analyzeChord(); }, []);

  const fns = chord ? getFunctions(chord.quality) : [];
  const currentFn = fns[selectedFn] || fns[0];

  return (
    <div
      className="min-h-screen text-gray-100"
      style={{
        background: "linear-gradient(135deg,#0a0a1a 0%,#0d0d22 50%,#0a1020 100%)",
        fontFamily: "'Crimson Text',Georgia,serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:wght@400;700&display=swap');
        .tab-btn { transition: all 0.2s; }
        .tab-btn:hover { opacity: 1 !important; }
        .fn-card { transition: all 0.2s; cursor: pointer; }
        .fn-card:hover { border-color: #555 !important; }
        .glow-input:focus { outline: none; box-shadow: 0 0 0 2px #4466cc55; }
        .stagger > * { animation: fadeUp 0.4s ease both; }
        .stagger > *:nth-child(1) { animation-delay: 0.05s; }
        .stagger > *:nth-child(2) { animation-delay: 0.12s; }
        .stagger > *:nth-child(3) { animation-delay: 0.19s; }
        .stagger > *:nth-child(4) { animation-delay: 0.26s; }
        .stagger > *:nth-child(5) { animation-delay: 0.33s; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>

      {/* HEADER */}
      <div className="border-b border-gray-800 px-4 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-wide" style={{ fontFamily:"'Libre Baskerville',serif", letterSpacing:"0.05em" }}>
            <span style={{ color:"#4488ff" }}>Har</span>
            <span style={{ color:"#cc4444" }}>mo</span>
            <span style={{ color:"#44bb44" }}>nía</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 italic">Diccionario armónico · Improvisación · Colores tonales</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { id:"chord",  label:"Acorde" },
            { id:"prog",   label:"Progresión" },
            { id:"circle", label:"Quintas" },
            { id:"colors", label:"Colores" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="tab-btn px-3 py-1.5 rounded text-xs border"
              style={{
                background:     tab === t.id ? "#1e2a4a" : "transparent",
                borderColor:    tab === t.id ? "#4466cc" : "#333",
                color:          tab === t.id ? "#88aaff" : "#666",
                opacity:        tab === t.id ? 1 : 0.7,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── TAB: ACORDE ── */}
        {tab === "chord" && (
          <div className="space-y-5 stagger">
            <div className="flex gap-2">
              <input
                value={chordInput}
                onChange={e => setChordInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && analyzeChord()}
                placeholder="Ej: G7, Dm7, Cmaj7, Am7b5, Bb7alt…"
                className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100"
                style={{ fontFamily:"monospace" }}
              />
              <button
                onClick={analyzeChord}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background:"#1e2a4a", border:"1px solid #4466cc", color:"#88aaff" }}
              >
                Analizar
              </button>
            </div>

            {chord && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Estructura del acorde */}
                  <div className="rounded-xl p-4 border border-gray-800" style={{ background:"#0e0e20" }}>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Estructura</p>
                    <h2 className="text-2xl font-bold mb-3" style={{ fontFamily:"'Libre Baskerville',serif" }}>
                      {chord.root}
                      <span className="text-gray-400">{chord.formula.symbol}</span>
                      <span className="ml-2 text-sm font-normal text-gray-400 italic">{chord.formula.label}</span>
                    </h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {chord.notes.map(n => <ColorNote key={n} note={n} size="md" />)}
                    </div>
                    <PianoKeyboard highlightedNotes={chord.notes} />
                  </div>

                  {/* Funciones armónicas */}
                  <div className="rounded-xl p-4 border border-gray-800" style={{ background:"#0e0e20" }}>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Funciones posibles</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {fns.map((f, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedFn(i)}
                          className="fn-card rounded-lg p-2.5 border text-xs"
                          style={{
                            background:   selectedFn === i ? "#1a2540" : "#111",
                            borderColor:  selectedFn === i ? "#4466cc" : "#222",
                          }}
                        >
                          <span className="font-bold text-blue-300">{f.fn}</span>
                          {f.example && <span className="text-gray-500 ml-1 italic">({f.example})</span>}
                          <p className="text-gray-500 mt-0.5">{f.key}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel de detalle */}
                {currentFn && (
                  <div className="rounded-xl p-4 border border-blue-900" style={{ background:"#0b0f20" }}>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                      Contexto: <span className="text-blue-300">{currentFn.fn}</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-2">✅ Tensiones permitidas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {currentFn.tensions.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded text-xs border"
                              style={{ background:"#0a1f0a", borderColor:"#2d5c2d", color:"#6dbd6d" }}>{t}</span>
                          ))}
                          {currentFn.tensions.length === 0 && (
                            <span className="text-gray-600 text-xs italic">Ninguna adicional</span>
                          )}
                        </div>
                        {currentFn.avoid.length > 0 && (
                          <>
                            <p className="text-xs text-gray-500 mb-2 mt-3">⚠️ Evitar</p>
                            <div className="flex flex-wrap gap-1.5">
                              {currentFn.avoid.map(t => (
                                <span key={t} className="px-2 py-0.5 rounded text-xs border"
                                  style={{ background:"#1f0a0a", borderColor:"#5c2d2d", color:"#bd6d6d" }}>{t}</span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-2">🎼 Escala sugerida</p>
                        <div className="px-3 py-2 rounded-lg border text-sm italic"
                          style={{ background:"#0d1520", borderColor:"#2a3a5a", color:"#88aaff" }}>
                          {currentFn.scale}
                        </div>
                        <p className="text-xs text-gray-600 mt-2">{currentFn.key}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-2">🔵 Círculo de Quintas</p>
                        <CircleOfFifths highlighted={[chord.root]} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: PROGRESIÓN ── */}
        {tab === "prog" && (
          <div className="space-y-5 stagger">
            <div>
              <p className="text-xs text-gray-500 mb-2">Ingresá acordes separados por guion, coma o espacio</p>
              <div className="flex gap-2">
                <input
                  value={progInput}
                  onChange={e => setProgInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && analyzeProgression_()}
                  placeholder="Ej: Dm7 – G7 – Cmaj7"
                  className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm"
                  style={{ fontFamily:"monospace" }}
                />
                <button
                  onClick={analyzeProgression_}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ background:"#1e2a4a", border:"1px solid #4466cc", color:"#88aaff" }}
                >
                  Analizar
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {["Dm7 – G7 – Cmaj7","Am7b5 – D7b9 – Gm","Cmaj7 – A7 – Dm7 – G7"].map(ex => (
                  <button
                    key={ex}
                    onClick={() => setProgInput(ex)}
                    className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-500 hover:text-gray-300"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {progression && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-widest">
                  Tonalidad probable:{" "}
                  <span className="text-yellow-400 font-bold">{progression[0]?.key} Mayor</span>
                </p>
                {progression.map((ch, i) => {
                  const f = getFunctions(ch.quality)[0];
                  return (
                    <div key={i} className="rounded-xl p-4 border border-gray-800" style={{ background:"#0e0e1c" }}>
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="min-w-24">
                          <span className="text-2xl font-bold" style={{ fontFamily:"'Libre Baskerville',serif" }}>{ch.raw}</span>
                          <div className="mt-1">
                            <span className="text-xs px-2 py-0.5 rounded border"
                              style={{ background:"#1a2540", borderColor:"#4466cc", color:"#88aaff" }}>
                              {ch.degree} en {ch.key}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {ch.notes.map(n => <ColorNote key={n} note={n} size="sm" showName={false} />)}
                        </div>
                        {f && (
                          <div className="flex-1 min-w-48 text-xs text-gray-500 border-l border-gray-800 pl-4">
                            <p className="text-blue-300 font-semibold">{f.scale}</p>
                            <p className="mt-0.5">
                              Tensiones: <span className="text-green-400">{f.tensions.join(", ") || "—"}</span>
                            </p>
                            {f.avoid.length > 0 && (
                              <p>Evitar: <span className="text-red-400">{f.avoid.join(", ")}</span></p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-xl p-4 border border-gray-800 mt-4" style={{ background:"#0e0e1c" }}>
                  <p className="text-xs text-gray-500 mb-3">Todas las notas de la progresión</p>
                  <PianoKeyboard highlightedNotes={[...new Set(progression.flatMap(c => c.notes))]} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CÍRCULO DE QUINTAS ── */}
        {tab === "circle" && (
          <div className="stagger">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Círculo de Quintas completo</p>
                <CircleOfFifths highlighted={CIRCLE_OF_FIFTHS.map(c => c.note)} />
              </div>
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Tonalidades</p>
                {CIRCLE_OF_FIFTHS.map(({ note, minor }) => {
                  const nc = getNoteColor(note);
                  return (
                    <div key={note} className="flex items-center gap-3 p-2 rounded-lg border border-gray-800" style={{ background:"#0e0e1c" }}>
                      <div className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: nc.hex + "33", borderColor: nc.hex }} />
                      <span className="font-bold w-8" style={{ color: nc.hex }}>{note}</span>
                      <span className="text-gray-500 text-sm">Mayor</span>
                      <span className="text-gray-600 text-xs ml-auto">→ {minor}</span>
                      <span className="text-gray-600 text-xs">Menor rel.</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: COLORES ── */}
        {tab === "colors" && (
          <div className="stagger">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Sistema cromático tonal</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {Object.entries(NOTE_COLORS)
                .filter(([n]) => !["Db","Eb","Gb","Ab","Bb"].includes(n))
                .map(([note, col]) => (
                  <div key={note} className="rounded-xl p-4 border"
                    style={{ background: col.hex + "11", borderColor: col.hex + "44" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full border-2" style={{ background: col.hex, borderColor: col.hex }} />
                      <div>
                        <p className="text-xl font-bold" style={{ color: col.hex, fontFamily:"'Libre Baskerville',serif" }}>{note}</p>
                        <p className="text-xs" style={{ color: col.hex + "99" }}>{col.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-mono">{col.hex}</p>
                    <p className="text-xs text-gray-600 font-mono">rgb({col.rgb.join(", ")})</p>
                  </div>
                ))}
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Notas alteradas (interpolación)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {["C#","D#","F#","G#","A#"].map(note => {
                const col = NOTE_COLORS[note];
                return (
                  <div key={note} className="rounded-xl p-4 border"
                    style={{ background: col.hex + "11", borderColor: col.hex + "44" }}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-full"
                        style={{ background: `linear-gradient(135deg,${col.hex},${col.hex}88)` }} />
                      <div>
                        <p className="font-bold" style={{ color: col.hex }}>{note} / {ENHARMONIC[note]}</p>
                        <p className="text-xs" style={{ color: col.hex + "99" }}>{col.name}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 p-4 rounded-xl border border-gray-800" style={{ background:"#0e0e1c" }}>
              <p className="text-xs text-gray-500 mb-4">Teclado de referencia completo</p>
              <PianoKeyboard highlightedNotes={Object.keys(NOTE_COLORS)} />
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="border-t border-gray-800 mt-8 px-6 py-3 text-center">
        <p className="text-xs text-gray-600 italic">
          Harmonía MVP · Diccionario armónico · Improvisación contextual · Sistema de color tonal
        </p>
      </div>
    </div>
  );
}
