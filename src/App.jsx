import { useState, useEffect, useCallback, useMemo } from "react";

// ─── SISTEMA DE COLORES ───────────────────────────────────────────────────────
const NOTE_COLORS = {
  C:    { rgb: [30,  80,  220], name: "Azul",          hex: "#1E50DC" },
  D:    { rgb: [40,  160, 60],  name: "Verde",         hex: "#28A03C" },
  E:    { rgb: [130, 80,  30],  name: "Marrón",        hex: "#82501E" },
  F:    { rgb: [200, 185, 140], name: "Beige",         hex: "#C8B98C" },
  G:    { rgb: [230, 200, 20],  name: "Amarillo",      hex: "#E6C814" },
  A:    { rgb: [210, 40,  40],  name: "Rojo",          hex: "#D22828" },
  B:    { rgb: [120, 40,  180], name: "Violeta",       hex: "#7828B4" },
  "C#": { rgb: [35,  120, 180], name: "Turquesa",      hex: "#2378B4" },
  "Db": { rgb: [35,  120, 180], name: "Turquesa",      hex: "#2378B4" },
  "D#": { rgb: [40,  180, 100], name: "Verde claro",   hex: "#28B464" },
  "Eb": { rgb: [40,  180, 100], name: "Verde claro",   hex: "#28B464" },
  "F#": { rgb: [215, 192, 80],  name: "Amar. beige",   hex: "#D7C050" },
  "Gb": { rgb: [215, 192, 80],  name: "Amar. beige",   hex: "#D7C050" },
  "G#": { rgb: [220, 120, 30],  name: "Naranja",       hex: "#DC781E" },
  "Ab": { rgb: [220, 120, 30],  name: "Naranja",       hex: "#DC781E" },
  "A#": { rgb: [165, 40,  110], name: "Bordo",         hex: "#A5286E" },
  "Bb": { rgb: [165, 40,  110], name: "Bordo",         hex: "#A5286E" },
};

const getNoteColor = (note) => {
  const clean = note.replace(/[0-9]/g, "").trim();
  return NOTE_COLORS[clean] || { hex: "#888", name: "?", rgb: [128,128,128] };
};

const CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };
const enharmonic = (n) => ENHARMONIC[n] || n;

const noteToIndex = (note) => {
  const idx = CHROMATIC.indexOf(note);
  if (idx !== -1) return idx;
  const entry = Object.entries(ENHARMONIC).find(([, v]) => v === note);
  return entry ? CHROMATIC.indexOf(entry[0]) : -1;
};

const intervalFromRoot = (root, semitones) => {
  const idx = noteToIndex(root);
  if (idx === -1) return root;
  return CHROMATIC[(idx + semitones + 12) % 12];
};

// ─── AUDIO (Web Audio API) ────────────────────────────────────────────────────
let audioCtx = null;
const getAudioCtx = () => {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
};

const NOTE_MIDI = { C:48,"C#":49,"Db":49,D:50,"D#":51,"Eb":51,E:52,F:53,"F#":54,"Gb":54,G:55,"G#":56,"Ab":56,A:57,"A#":58,"Bb":58,B:59 };

const playNote = (note, duration = 0.6) => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const midi = NOTE_MIDI[note] ?? 60;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
};

const playChord = (notes) => {
  notes.forEach((n, i) => setTimeout(() => playNote(n, 1.4), i * 25));
};

// ─── FÓRMULAS DE ACORDES ──────────────────────────────────────────────────────
const CHORD_FORMULAS = {
  "maj":  { intervals:[0,4,7],             label:"Mayor",      symbol:"△"    },
  "min":  { intervals:[0,3,7],             label:"Menor",      symbol:"m"    },
  "7":    { intervals:[0,4,7,10],          label:"Dom. 7ª",    symbol:"7"    },
  "maj7": { intervals:[0,4,7,11],          label:"Mayor 7ª",   symbol:"△7"   },
  "min7": { intervals:[0,3,7,10],          label:"Menor 7ª",   symbol:"m7"   },
  "dim":  { intervals:[0,3,6],             label:"Disminuido", symbol:"°"    },
  "dim7": { intervals:[0,3,6,9],           label:"Dim. 7ª",    symbol:"°7"   },
  "m7b5": { intervals:[0,3,6,10],          label:"Semidism.",  symbol:"ø7"   },
  "aug":  { intervals:[0,4,8],             label:"Aumentado",  symbol:"+"    },
  "sus2": { intervals:[0,2,7],             label:"Sus2",       symbol:"sus2" },
  "sus4": { intervals:[0,5,7],             label:"Sus4",       symbol:"sus4" },
  "9":    { intervals:[0,4,7,10,14],       label:"Dom. 9ª",    symbol:"9"    },
  "maj9": { intervals:[0,4,7,11,14],       label:"Mayor 9ª",   symbol:"△9"   },
  "min9": { intervals:[0,3,7,10,14],       label:"Menor 9ª",   symbol:"m9"   },
  "13":   { intervals:[0,4,7,10,14,21],    label:"Dom. 13ª",   symbol:"13"   },
  "7b9":  { intervals:[0,4,7,10,13],       label:"Dom. b9",    symbol:"7b9"  },
  "7#9":  { intervals:[0,4,7,10,15],       label:"Dom. #9",    symbol:"7#9"  },
  "7alt": { intervals:[0,4,7,10,13,15,20], label:"Alt.",       symbol:"7alt" },
};

// ─── FUNCIONES ARMÓNICAS (array completo por calidad) ─────────────────────────
const HARMONIC_FUNCTIONS = {
  "7": [
    { fn:"V7 → I (dominante principal)", degree:"V", key:"Resuelve fuertemente a la tónica mayor",
      tensions:["9","13"], avoid:["11"], scales:["Mixolidio","Pentatónica mayor"],
      resolutions:["I△7","I"],
      why:"El tritono (3ª–7ª) crea la máxima tensión que se resuelve por semitono hacia la tónica.", example:"G7 → C" },
    { fn:"V7/iv (dominante hacia menor)", degree:"V", key:"Resuelve a acorde menor",
      tensions:["b9","#9","b13"], avoid:["9","13"], scales:["Alterada","Frigio Dominante","HM5"],
      resolutions:["im7","im"],
      why:"Las tensiones alteradas (b9,#9,b13) crean color oscuro que pide resolver a un menor.", example:"G7 → Cm" },
    { fn:"Sustituto tritonal", degree:"bII", key:"Reemplaza al dominante por tritono",
      tensions:["9","#11","13"], avoid:[], scales:["Lidio b7","Mixolidio #11"],
      resolutions:["I△7","I"],
      why:"Comparte el tritono con el V7 original. El bajo se mueve por semitono hacia la tónica.", example:"Db7 ≈ G7 → C" },
    { fn:"Dominante de paso", degree:"?", key:"Conecta acordes cromáticamente",
      tensions:["9","13"], avoid:[], scales:["Mixolidio","Dórico"],
      resolutions:["acorde siguiente"],
      why:"No establece tonalidad, solo conecta. Se usa para movimiento cromático en el bajo.", example:"A7 → Dm7" },
    { fn:"Dominante blues", degree:"I", key:"Tónica blues — no resuelve necesariamente",
      tensions:["b9","#9"], avoid:[], scales:["Blues","Mixolidio b3","Pentatónica menor"],
      resolutions:["IV7","I7","V7"],
      why:"En blues el I7 es estable. La 7ª menor es constitutiva del sonido, no tensión a resolver.", example:"C7 tónica en blues de C" },
  ],
  "maj7": [
    { fn:"I△7 — Tónica mayor", degree:"I", key:"Centro tonal estable y luminoso",
      tensions:["9","#11","13"], avoid:["11"], scales:["Jónico","Lidio"],
      resolutions:["estático"],
      why:"La 7ª mayor añade brillo sin tensión. #11 (Lidio) es la extensión más característica.", example:"Cmaj7 = I en C" },
    { fn:"IV△7 — Subdominante", degree:"IV", key:"Color lírico, no resuelve fuerte",
      tensions:["9","#11"], avoid:["11"], scales:["Lidio","Lidio #2"],
      resolutions:["I△7","V7"],
      why:"El IV△7 tiene el mayor potencial lírico. Evitar la 11ª justa por conflicto con la 3ª del I.", example:"Fmaj7 = IV en C" },
    { fn:"△7 Modal — Tónica de modo mayor", degree:"I", key:"Centro de modo mayor sin movimiento tonal",
      tensions:["9","#11","13","6"], avoid:[], scales:["Lidio","Jónico","Lidio aumentado"],
      resolutions:["estático"],
      why:"En música modal no hay ii-V-I. El △7 es punto de reposo absoluto.", example:"Cmaj7 centro en C Lidio" },
  ],
  "min7": [
    { fn:"ii m7 — Supertónica (pre-dominante)", degree:"ii", key:"Pre-dominante en cadencia ii–V–I",
      tensions:["9","11"], avoid:["b9"], scales:["Dórico","Pentatónica menor"],
      resolutions:["V7","V7sus4"],
      why:"El ii m7 prepara el dominante. La 9ª (Dórico) da brillo sin romper la función subdominante.", example:"Dm7 → G7 → Cmaj7" },
    { fn:"iii m7 — Mediante", degree:"iii", key:"Sustituto de la tónica, más oscuro",
      tensions:["11"], avoid:["9","13"], scales:["Frigio","Frigio nat. 2"],
      resolutions:["IV△7","ii m7"],
      why:"Comparte notas con I△7. Frigio tiene b9 → evitar. Produce tensión suave antes del IV.", example:"Em7 = iii en C" },
    { fn:"vi m7 — Relativa menor", degree:"vi", key:"Tónica relativa, estable",
      tensions:["9","11"], avoid:[], scales:["Eólico","Dórico","Pentatónica menor"],
      resolutions:["estático o ii m7"],
      why:"Comparte dos notas con el I. Crea sensación de tónica alternativa sin romper la tonalidad.", example:"Am7 = vi en C" },
    { fn:"iv m7 — Subdominante menor (borrowed)", degree:"iv", key:"Prestado del modo menor paralelo",
      tensions:["9","11","b6"], avoid:[], scales:["Eólico","Menor natural","Dórico"],
      resolutions:["I△7","V7","bVII△7"],
      why:"La b6 es su nota característica — crea oscuridad expresiva inesperada en contexto mayor.", example:"Fm7 en C mayor" },
  ],
  "m7b5": [
    { fn:"iiø7 — Pre-dominante en menor", degree:"ii", key:"Supertónica en contexto menor",
      tensions:["9","11","b13"], avoid:[], scales:["Locrio","Locrio #2"],
      resolutions:["V7b9","V7alt"],
      why:"En menor, el ii es naturalmente ø7. Locrio #2 da 9ª natural para más movimiento melódico.", example:"Bm7b5 → E7b9 → Am" },
    { fn:"ø7 Modal / Color", degree:"?", key:"Uso colorístico sin función clara",
      tensions:["9","11"], avoid:[], scales:["Locrio #2","Superlocrio"],
      resolutions:["variable"],
      why:"En jazz contemporáneo el ø7 puede flotar sin resolver, especialmente con Locrio #2.", example:"Cm7b5 como color" },
  ],
  "maj": [
    { fn:"I Mayor — Tónica", degree:"I", key:"Centro tonal, reposo total",
      tensions:["9","6"], avoid:["7","b7"], scales:["Jónico","Pentatónica mayor"],
      resolutions:["estático"],
      why:"Sin la 7ª el sonido es más abierto y clásico. La 6ª y 9ª añaden color sin tensión.", example:"C = I en C" },
    { fn:"IV Mayor — Subdominante", degree:"IV", key:"Movimiento hacia dominante o tónica",
      tensions:["9","6","#11"], avoid:[], scales:["Jónico","Lidio"],
      resolutions:["V","V7","I"],
      why:"El IV es el grado más estable después de la tónica. Lydian (#11) da color brillante.", example:"F = IV en C" },
    { fn:"V Mayor — Dominante sin 7ª", degree:"V", key:"Dominante con menos tensión que V7",
      tensions:["9","13"], avoid:["11"], scales:["Mixolidio","Pentatónica mayor"],
      resolutions:["I","I△7"],
      why:"Sin la 7ª menor la tensión es menor. Común en música clásica y pop.", example:"G = V en C" },
  ],
  "min": [
    { fn:"i menor — Tónica menor", degree:"i", key:"Centro tonal en modo menor",
      tensions:["9","11","b6"], avoid:[], scales:["Eólico","Menor armónica","Dórico"],
      resolutions:["estático"],
      why:"La tónica menor es el punto de reposo del modo. La b6 (Eólico) refuerza el color oscuro.", example:"Am = i en Am" },
    { fn:"iv menor — Subdominante menor", degree:"iv", key:"Subdominante en contexto menor",
      tensions:["9","11"], avoid:[], scales:["Eólico","Dórico","Frigio"],
      resolutions:["V7","i","bVII"],
      why:"El iv menor tiene gran peso expresivo. Junto con V7 forma la cadencia perfecta menor.", example:"Dm = iv en Am" },
  ],
  "dim7": [
    { fn:"vii°7 — Sensible disminuido", degree:"vii", key:"Leading tone — resuelve a la tónica",
      tensions:[], avoid:[], scales:["Disminuida (T-ST)","Disminuida simétrica"],
      resolutions:["I△7","I","i"],
      why:"Todos sus sonidos están a semitono de la tónica. Escala disminuida T-ST encaja perfectamente.", example:"B°7 → Cmaj7" },
    { fn:"°7 de paso cromático", degree:"?", key:"Conecta acordes por cromatismo del bajo",
      tensions:[], avoid:[], scales:["Disminuida (ST-T)"],
      resolutions:["cualquier acorde a semitono"],
      why:"El dim7 es simétrico — puede transponerse cada 3 semitonos. Útil para modulación.", example:"C°7 entre Cm y Dm" },
  ],
};

const getFunctions = (quality) =>
  HARMONIC_FUNCTIONS[quality] || [{
    fn:"Acorde de color", degree:"?", key:"Uso libre / modal / no tonal",
    tensions:["varía"], avoid:[], scales:["Según contexto"],
    resolutions:["variable"],
    why:"Este tipo de acorde no tiene función tonal fija. Su uso depende del contexto armónico.", example:"",
  }];

// ─── CÍRCULO DE QUINTAS ───────────────────────────────────────────────────────
const CIRCLE_OF_FIFTHS = [
  { note:"C",  minor:"Am",  deg:0,   keyName:"C Mayor",  minorName:"A menor",  signature:"Sin alteraciones" },
  { note:"G",  minor:"Em",  deg:30,  keyName:"G Mayor",  minorName:"E menor",  signature:"1 sostenido (F#)" },
  { note:"D",  minor:"Bm",  deg:60,  keyName:"D Mayor",  minorName:"B menor",  signature:"2 sostenidos (F#,C#)" },
  { note:"A",  minor:"F#m", deg:90,  keyName:"A Mayor",  minorName:"F# menor", signature:"3 sostenidos (F#,C#,G#)" },
  { note:"E",  minor:"C#m", deg:120, keyName:"E Mayor",  minorName:"C# menor", signature:"4 sostenidos" },
  { note:"B",  minor:"G#m", deg:150, keyName:"B Mayor",  minorName:"G# menor", signature:"5 sostenidos" },
  { note:"F#", minor:"D#m", deg:180, keyName:"F# Mayor", minorName:"D# menor", signature:"6 sostenidos" },
  { note:"Db", minor:"Bbm", deg:210, keyName:"Db Mayor", minorName:"Bb menor", signature:"5 bemoles" },
  { note:"Ab", minor:"Fm",  deg:240, keyName:"Ab Mayor", minorName:"F menor",  signature:"4 bemoles" },
  { note:"Eb", minor:"Cm",  deg:270, keyName:"Eb Mayor", minorName:"C menor",  signature:"3 bemoles (Bb,Eb,Ab)" },
  { note:"Bb", minor:"Gm",  deg:300, keyName:"Bb Mayor", minorName:"G menor",  signature:"2 bemoles (Bb,Eb)" },
  { note:"F",  minor:"Dm",  deg:330, keyName:"F Mayor",  minorName:"D menor",  signature:"1 bemol (Bb)" },
];

const MAJOR_SCALE_INTERVALS = [0,2,4,5,7,9,11];
const DEGREE_NAMES    = ["I","II","III","IV","V","VI","VII"];
const DEGREE_QUALITIES= ["△7","m7","m7","△7","7","m7","ø7"];
const DEGREE_LABELS   = ["Tónica","Supertónica","Mediante","Subdominante","Dominante","Relativa m.","Sensible"];

const getMajorScaleData = (root) => {
  const rootIdx = noteToIndex(root);
  if (rootIdx === -1) return null;
  const notes = MAJOR_SCALE_INTERVALS.map(i => CHROMATIC[(rootIdx + i) % 12]);
  const diatonic = notes.map((n, i) => ({
    note: n, degree: DEGREE_NAMES[i],
    quality: DEGREE_QUALITIES[i], label: DEGREE_LABELS[i],
    full: `${n}${DEGREE_QUALITIES[i]}`,
  }));
  return { notes, diatonic };
};

// ─── ANÁLISIS DE PROGRESIONES ─────────────────────────────────────────────────
const computeProgression = (chords) => {
  const scores = {};
  CIRCLE_OF_FIFTHS.forEach(({ note }) => {
    const rootIdx = noteToIndex(note);
    if (rootIdx === -1) return;
    let score = 0;
    const scale = MAJOR_SCALE_INTERVALS.map(i => CHROMATIC[(rootIdx + i) % 12]);
    chords.forEach(({ root }) => {
      if (scale.includes(root)) score += 2;
      if (scale.includes(enharmonic(root))) score += 2;
    });
    scores[note] = score;
  });
  const key = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
  const keyIdx = noteToIndex(key);
  const scaleNotes = MAJOR_SCALE_INTERVALS.map(i => CHROMATIC[(keyIdx + i) % 12]);
  return chords.map(({ root, quality, raw, notes }) => {
    const ri = scaleNotes.indexOf(root) !== -1
      ? scaleNotes.indexOf(root)
      : scaleNotes.indexOf(enharmonic(root));
    const degree = ri >= 0 ? DEGREE_NAMES[ri] : "?";
    return { raw, root, quality, notes, degree, key, fn: getFunctions(quality)[0] };
  });
};

// ─── PARSER DE ACORDES ────────────────────────────────────────────────────────
const parseChord = (input) => {
  try {
    const s = input.trim();
    const rootMatch = s.match(/^([A-G][#b]?)/);
    if (!rootMatch) return null;
    const root = rootMatch[1];
    const rest = s.slice(root.length).toLowerCase().replace(/\s/g,"");
    let quality = "maj";
    if      (rest.includes("m7b5")||rest.includes("ø"))               quality="m7b5";
    else if (rest.includes("dim7")||rest.includes("°7"))               quality="dim7";
    else if (rest.includes("dim")||rest.includes("°"))                 quality="dim";
    else if (rest.includes("maj7")||rest.includes("△7")||rest.includes("∆7")) quality="maj7";
    else if (rest.includes("maj9")||rest.includes("△9"))               quality="maj9";
    else if (rest.includes("maj"))                                     quality="maj7";
    else if (rest.includes("m9"))                                      quality="min9";
    else if (rest.includes("m7"))                                      quality="min7";
    else if (rest.includes("7b9"))                                     quality="7b9";
    else if (rest.includes("7#9"))                                     quality="7#9";
    else if (rest.includes("7alt")||rest.includes("alt"))              quality="7alt";
    else if (rest.includes("13"))                                      quality="13";
    else if (rest.includes("9"))                                       quality="9";
    else if (rest.includes("7"))                                       quality="7";
    else if (rest.includes("aug")||rest.includes("+"))                 quality="aug";
    else if (rest.includes("sus2"))                                    quality="sus2";
    else if (rest.includes("sus4")||rest.includes("sus"))              quality="sus4";
    else if (rest.includes("m"))                                       quality="min";
    const formula = CHORD_FORMULAS[quality] || CHORD_FORMULAS["maj"];
    const notes = formula.intervals.map(i => intervalFromRoot(root, i % 12));
    return { root, quality, notes, formula, raw: s };
  } catch(e) { return null; }
};

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

const ColorNote = ({ note, size="md", showName=true }) => {
  const color = getNoteColor(note);
  const cls = { sm:"px-2 py-0.5 text-xs gap-1", md:"px-3 py-1 text-sm gap-1.5", lg:"px-4 py-2 text-base gap-2" };
  const dot = { sm:"w-1.5 h-1.5", md:"w-2 h-2", lg:"w-2.5 h-2.5" };
  return (
    <span className={`inline-flex items-center rounded-full font-bold border-2 cursor-pointer select-none ${cls[size]}`}
      style={{ backgroundColor:color.hex+"22", borderColor:color.hex, color:color.hex }}
      onClick={() => playNote(note)} title={`Escuchar ${note}`}>
      <span className={`${dot[size]} rounded-full`} style={{ backgroundColor:color.hex }} />
      {note}
      {showName && <span className="opacity-70 font-normal text-xs">({color.name})</span>}
    </span>
  );
};

// Piano corregido: teclas blancas C D E F G A B, negras C# D# F# G# A#
// No hay tecla negra entre E-F ni entre B-C
const PianoKeyboard = ({ highlightedNotes=[] }) => {
  const WHITE = ["C","D","E","F","G","A","B"];
  // afterWhite: índice de la tecla blanca a cuya derecha está la negra
  const BLACK = [
    { name:"C#", afterWhite:0 },
    { name:"D#", afterWhite:1 },
    { name:"F#", afterWhite:3 },
    { name:"G#", afterWhite:4 },
    { name:"A#", afterWhite:5 },
  ];
  const ww=40, wh=120, bw=26, bh=74;
  const isH = (n) => highlightedNotes.includes(n) || highlightedNotes.includes(enharmonic(n));

  return (
    <svg viewBox={`0 0 ${WHITE.length*ww} ${wh}`} className="w-full max-w-sm mx-auto" style={{maxHeight:"130px"}}>
      {WHITE.map((n,i) => {
        const hi = isH(n);
        const col = getNoteColor(n);
        return (
          <g key={n} style={{cursor:"pointer"}} onClick={() => playNote(n)}>
            <rect x={i*ww+1} y={0} width={ww-2} height={wh} rx="4"
              fill={hi ? col.hex : "#f5f0e8"} stroke="#555" strokeWidth="1" />
            <text x={i*ww+ww/2} y={wh-10} textAnchor="middle" fontSize="9"
              fill={hi?"#fff":"#666"} fontFamily="serif" fontWeight={hi?"bold":"normal"}>{n}</text>
          </g>
        );
      })}
      {BLACK.map(({ name, afterWhite }) => {
        const hi = isH(name);
        const col = getNoteColor(name);
        const x = (afterWhite+1)*ww - bw/2;
        return (
          <g key={name} style={{cursor:"pointer"}} onClick={() => playNote(name)}>
            <rect x={x} y={0} width={bw} height={bh} rx="3"
              fill={hi ? col.hex : "#1a1a1a"} stroke={hi ? col.hex : "#000"} strokeWidth="1" />
            <text x={x+bw/2} y={bh-8} textAnchor="middle" fontSize="7" fill="#fff" fontFamily="serif">{name}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Círculo de quintas interactivo
const CircleOfFifths = ({ highlighted=[], onSelect=null, selectedKey=null }) => {
  const cx=160,cy=160,R=125,r=82;
  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-xs mx-auto select-none">
      <defs>
        <radialGradient id="bgGrad2" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#1a1a2e"/>
          <stop offset="100%" stopColor="#0d0d1a"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={155} fill="url(#bgGrad2)" stroke="#333" strokeWidth="1"/>
      {CIRCLE_OF_FIFTHS.map(({ note, minor, deg }) => {
        const angle = (deg-90)*(Math.PI/180);
        const isHi = highlighted.includes(note)||highlighted.includes(enharmonic(note));
        const isSel = selectedKey===note;
        const ox = cx+R*Math.cos(angle), oy = cy+R*Math.sin(angle);
        const mx = cx+r*Math.cos(angle), my = cy+r*Math.sin(angle);
        const nc = getNoteColor(note);
        return (
          <g key={note} style={{cursor:onSelect?"pointer":"default"}} onClick={()=>onSelect&&onSelect(note)}>
            <circle cx={ox} cy={oy} r={isSel?21:18}
              fill={isHi?nc.hex:"#1e1e3a"} stroke={isHi?nc.hex:isSel?"#88aaff":"#444"}
              strokeWidth={isHi||isSel?2.5:1} opacity={isHi||isSel?1:0.7}/>
            <text x={ox} y={oy+1} textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="bold" fill={isHi?"#fff":"#aaa"} fontFamily="serif">{note}</text>
            <circle cx={mx} cy={my} r={12} fill="transparent"
              stroke={isHi?"#555":"#2a2a4a"} strokeWidth="1"/>
            <text x={mx} y={my+1} textAnchor="middle" dominantBaseline="middle"
              fontSize="7" fill={isHi?"#ccc":"#555"} fontFamily="serif">{minor}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={42} fill="#0d0d1a" stroke="#222" strokeWidth="1"/>
      <text x={cx} y={cy-7}  textAnchor="middle" fontSize="8" fill="#555" fontFamily="serif">Círculo</text>
      <text x={cx} y={cy+5}  textAnchor="middle" fontSize="8" fill="#555" fontFamily="serif">de</text>
      <text x={cx} y={cy+17} textAnchor="middle" fontSize="8" fill="#555" fontFamily="serif">Quintas</text>
    </svg>
  );
};

// Acordeón para cada función armónica
const FunctionAccordion = ({ fn, isOpen, onToggle }) => (
  <div className="rounded-lg border overflow-hidden" style={{ borderColor:isOpen?"#4466cc":"#222" }}>
    <button className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2"
      style={{ background:isOpen?"#1a2540":"#111" }} onClick={onToggle}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs px-1.5 py-0.5 rounded font-mono border flex-shrink-0"
          style={{ background:"#0d1520", borderColor:"#2a3a5a", color:"#88aaff" }}>{fn.degree}</span>
        <span className="text-xs font-bold text-blue-300 truncate">{fn.fn}</span>
      </div>
      <span className="text-gray-600 flex-shrink-0 text-xs">{isOpen?"▲":"▼"}</span>
    </button>
    {isOpen && (
      <div className="px-3 pb-3 pt-2 space-y-3" style={{ background:"#0d1020" }}>
        <p className="text-xs text-gray-400 italic">{fn.key}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">✅ Tensiones</p>
            <div className="flex flex-wrap gap-1">
              {fn.tensions.map(t=>(
                <span key={t} className="px-2 py-0.5 rounded text-xs border"
                  style={{ background:"#0a1f0a",borderColor:"#2d5c2d",color:"#6dbd6d" }}>{t}</span>
              ))}
              {fn.tensions.length===0&&<span className="text-gray-600 text-xs italic">—</span>}
            </div>
            {fn.avoid.length>0&&<>
              <p className="text-xs text-gray-500 mb-1.5 mt-2">⚠️ Evitar</p>
              <div className="flex flex-wrap gap-1">
                {fn.avoid.map(t=>(
                  <span key={t} className="px-2 py-0.5 rounded text-xs border"
                    style={{ background:"#1f0a0a",borderColor:"#5c2d2d",color:"#bd6d6d" }}>{t}</span>
                ))}
              </div>
            </>}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">🎼 Escalas</p>
            <div className="space-y-1">
              {fn.scales.map(s=>(
                <div key={s} className="text-xs px-2 py-1 rounded border italic"
                  style={{ background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff" }}>{s}</div>
              ))}
            </div>
          </div>
        </div>
        {fn.resolutions?.length>0&&(
          <div>
            <p className="text-xs text-gray-500 mb-1">➜ Resoluciones</p>
            <p className="text-xs text-yellow-300">{fn.resolutions.join(" · ")}</p>
          </div>
        )}
        <div className="rounded p-2 border border-gray-800" style={{ background:"#0a0a18" }}>
          <p className="text-xs text-gray-500 mb-1">💡 Por qué funciona</p>
          <p className="text-xs text-gray-400">{fn.why}</p>
        </div>
        {fn.example&&<p className="text-xs text-gray-600 font-mono">Ej: {fn.example}</p>}
      </div>
    )}
  </div>
);

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function HarmoniaApp() {
  const [tab, setTab]             = useState("chord");
  const [chordInput, setChordInput] = useState("G7");
  const [chord, setChord]         = useState(null);
  const [openFns, setOpenFns]     = useState([0]);

  // Progresión: el texto y el resultado son estados INDEPENDIENTES
  // Los botones de ejemplo SOLO cambian el texto, NO disparan análisis → sin loop
  const [progInput, setProgInput]       = useState("Dm7 – G7 – Cmaj7");
  const [progression, setProgression]   = useState(null);

  // Círculo
  const [selectedKey, setSelectedKey] = useState(null);
  const keyData = useMemo(() => selectedKey ? getMajorScaleData(selectedKey) : null, [selectedKey]);

  // Analizar acorde (solo cuando el usuario pulsa Analizar o Enter)
  const analyzeChord = useCallback(() => {
    const c = parseChord(chordInput);
    setChord(c);
    setOpenFns([0]);
    if (c) playChord(c.notes);
  }, [chordInput]);

  // Analizar progresión (solo cuando el usuario pulsa Analizar o Enter)
  const analyzeProgression = useCallback(() => {
    try {
      const parts = progInput.split(/[\s–\-,|]+/).filter(Boolean);
      const parsed = parts.map(p => parseChord(p)).filter(Boolean);
      if (parsed.length > 0) setProgression(computeProgression(parsed));
    } catch(e) { console.error(e); }
  }, [progInput]);

  // Solo al montar — análisis inicial del acorde por defecto
  useEffect(() => {
    const c = parseChord("G7");
    setChord(c);
  }, []);

  const fns = useMemo(() => chord ? getFunctions(chord.quality) : [], [chord]);

  const toggleFn = useCallback((i) => {
    setOpenFns(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev,i]);
  }, []);

  return (
    <div className="min-h-screen text-gray-100" style={{
      background:"linear-gradient(135deg,#0a0a1a 0%,#0d0d22 50%,#0a1020 100%)",
      fontFamily:"'Crimson Text',Georgia,serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:wght@400;700&display=swap');
        .tab-btn{transition:all 0.2s}
        .glow-input:focus{outline:none;box-shadow:0 0 0 2px #4466cc55}
        .stagger>*{animation:fadeUp 0.35s ease both}
        .stagger>*:nth-child(1){animation-delay:.04s}
        .stagger>*:nth-child(2){animation-delay:.10s}
        .stagger>*:nth-child(3){animation-delay:.16s}
        .stagger>*:nth-child(4){animation-delay:.22s}
        .stagger>*:nth-child(5){animation-delay:.28s}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div className="border-b border-gray-800 px-4 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{fontFamily:"'Libre Baskerville',serif",letterSpacing:"0.06em"}}>
            <span style={{color:"#4488ff"}}>Har</span>
            <span style={{color:"#cc4444"}}>mo</span>
            <span style={{color:"#44bb44"}}>nía</span>
          </h1>
          <p className="text-xs text-gray-500 italic mt-0.5">Diccionario armónico · Improvisación · Colores tonales</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{id:"chord",label:"Acorde"},{id:"prog",label:"Progresión"},{id:"circle",label:"Quintas"},{id:"colors",label:"Colores"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className="tab-btn px-3 py-1.5 rounded text-xs border"
              style={{background:tab===t.id?"#1e2a4a":"transparent",borderColor:tab===t.id?"#4466cc":"#333",
                color:tab===t.id?"#88aaff":"#666",opacity:tab===t.id?1:0.7}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ══ ACORDE ══════════════════════════════════════════════════════════ */}
        {tab==="chord"&&(
          <div className="space-y-5 stagger">
            <div className="flex gap-2">
              <input value={chordInput} onChange={e=>setChordInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&analyzeChord()}
                placeholder="Ej: G7, Dm7, Cmaj7, Am7b5, Bb7alt…"
                className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100"
                style={{fontFamily:"monospace"}}/>
              <button onClick={analyzeChord} className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{background:"#1e2a4a",border:"1px solid #4466cc",color:"#88aaff"}}>
                Analizar
              </button>
            </div>

            {chord&&<>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Estructura */}
                <div className="rounded-xl p-4 border border-gray-800" style={{background:"#0e0e20"}}>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Estructura</p>
                  <h2 className="text-2xl font-bold mb-3" style={{fontFamily:"'Libre Baskerville',serif"}}>
                    {chord.root}<span className="text-gray-400">{chord.formula.symbol}</span>
                    <span className="ml-2 text-sm font-normal text-gray-400 italic">{chord.formula.label}</span>
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {chord.notes.map(n=><ColorNote key={n} note={n} size="md"/>)}
                  </div>
                  <PianoKeyboard highlightedNotes={chord.notes}/>
                  <button onClick={()=>playChord(chord.notes)}
                    className="mt-3 w-full text-xs py-1.5 rounded border"
                    style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>
                    ▶ Escuchar acorde
                  </button>
                </div>

                {/* Funciones — acordeón */}
                <div className="rounded-xl p-4 border border-gray-800" style={{background:"#0e0e20"}}>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                    Funciones armónicas <span className="text-gray-700 ml-1">({fns.length})</span>
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {fns.map((f,i)=>(
                      <FunctionAccordion key={i} fn={f} isOpen={openFns.includes(i)} onToggle={()=>toggleFn(i)}/>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4 border border-gray-800" style={{background:"#0b0f20"}}>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Posición en el Círculo de Quintas</p>
                <CircleOfFifths highlighted={[chord.root]}/>
              </div>
            </>}
          </div>
        )}

        {/* ══ PROGRESIÓN ══════════════════════════════════════════════════════ */}
        {tab==="prog"&&(
          <div className="space-y-5 stagger">
            <div>
              <p className="text-xs text-gray-500 mb-2">Ingresá acordes separados por guion, coma o espacio</p>
              <div className="flex gap-2">
                <input value={progInput} onChange={e=>setProgInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&analyzeProgression()}
                  placeholder="Ej: Dm7 – G7 – Cmaj7"
                  className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm"
                  style={{fontFamily:"monospace"}}/>
                <button onClick={analyzeProgression} className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                  style={{background:"#1e2a4a",border:"1px solid #4466cc",color:"#88aaff"}}>
                  Analizar
                </button>
              </div>
              {/* Los botones de ejemplo SOLO actualizan el texto (no disparan análisis) */}
              <div className="flex flex-wrap gap-2 mt-2">
                {["Dm7 – G7 – Cmaj7","Am7b5 – D7b9 – Gm","Cmaj7 – A7 – Dm7 – G7","Cm7 – F7 – Bbmaj7"].map(ex=>(
                  <button key={ex} onClick={()=>setProgInput(ex)}
                    className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-500 hover:text-gray-300">
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {progression&&(
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">
                    Tonalidad probable:
                    <span className="ml-2 text-yellow-400 font-bold">{progression[0]?.key} Mayor</span>
                  </p>
                  <button onClick={()=>playChord([...new Set(progression.flatMap(c=>c.notes))])}
                    className="text-xs px-3 py-1 rounded border"
                    style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>
                    ▶ Escuchar todo
                  </button>
                </div>

                {progression.map((ch,i)=>{
                  const f=ch.fn;
                  return (
                    <div key={i} className="rounded-xl p-4 border border-gray-800" style={{background:"#0e0e1c"}}>
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="min-w-28">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold" style={{fontFamily:"'Libre Baskerville',serif"}}>{ch.raw}</span>
                            <button onClick={()=>{const c=parseChord(ch.raw);if(c)playChord(c.notes);}}
                              className="text-xs text-gray-600 hover:text-blue-400">▶</button>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded border mt-1 inline-block"
                            style={{background:"#1a2540",borderColor:"#4466cc",color:"#88aaff"}}>
                            {ch.degree} en {ch.key}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {ch.notes.map(n=><ColorNote key={n} note={n} size="sm" showName={false}/>)}
                        </div>
                        {f&&(
                          <div className="flex-1 min-w-44 text-xs text-gray-500 border-l border-gray-800 pl-4">
                            <p className="text-blue-300 font-semibold">{f.fn}</p>
                            <p className="mt-0.5">Escalas: <span className="text-indigo-300">{f.scales.slice(0,2).join(" / ")}</span></p>
                            <p className="mt-0.5">Tensiones: <span className="text-green-400">{f.tensions.join(", ")||"—"}</span></p>
                            {f.avoid.length>0&&<p>Evitar: <span className="text-red-400">{f.avoid.join(", ")}</span></p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-xl p-4 border border-gray-800" style={{background:"#0e0e1c"}}>
                  <p className="text-xs text-gray-500 mb-3">Todas las notas de la progresión</p>
                  <PianoKeyboard highlightedNotes={[...new Set(progression.flatMap(c=>c.notes))]}/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ CÍRCULO DE QUINTAS (interactivo) ════════════════════════════════ */}
        {tab==="circle"&&(
          <div className="stagger">
            <p className="text-xs text-gray-500 mb-4">Tocá cualquier tonalidad para ver sus detalles</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <CircleOfFifths highlighted={CIRCLE_OF_FIFTHS.map(c=>c.note)}
                  onSelect={setSelectedKey} selectedKey={selectedKey}/>
              </div>

              <div>
                {selectedKey&&keyData ? (
                  <div className="rounded-xl border border-gray-700 overflow-hidden" style={{background:"#0e0e1c"}}>
                    <div className="p-4 border-b border-gray-800"
                      style={{background:getNoteColor(selectedKey).hex+"18"}}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2"
                          style={{background:getNoteColor(selectedKey).hex,
                            borderColor:getNoteColor(selectedKey).hex+"80"}}/>
                        <div>
                          <h3 className="text-xl font-bold" style={{fontFamily:"'Libre Baskerville',serif",
                            color:getNoteColor(selectedKey).hex}}>
                            {selectedKey} Mayor
                          </h3>
                          <p className="text-xs text-gray-500">
                            {CIRCLE_OF_FIFTHS.find(c=>c.note===selectedKey)?.signature}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-b border-gray-800">
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Notas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {keyData.notes.map(n=><ColorNote key={n} note={n} size="sm" showName={false}/>)}
                      </div>
                    </div>

                    <div className="p-4 border-b border-gray-800">
                      <PianoKeyboard highlightedNotes={keyData.notes}/>
                    </div>

                    <div className="p-4 border-b border-gray-800">
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Acordes diatónicos</p>
                      <div className="space-y-1.5">
                        {keyData.diatonic.map(d=>{
                          const nc=getNoteColor(d.note);
                          return (
                            <div key={d.degree} className="flex items-center gap-3 text-xs">
                              <span className="w-8 text-center font-mono font-bold" style={{color:"#88aaff"}}>{d.degree}</span>
                              <span className="font-bold w-16" style={{color:nc.hex}}>{d.full}</span>
                              <span className="text-gray-500">{d.label}</span>
                              <button onClick={()=>{const c=parseChord(d.full);if(c)playChord(c.notes);}}
                                className="ml-auto text-gray-700 hover:text-blue-400">▶</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Relativa menor</p>
                      <p className="text-sm text-gray-300">
                        {CIRCLE_OF_FIFTHS.find(c=>c.note===selectedKey)?.minorName}
                      </p>
                      <button onClick={()=>setSelectedKey(null)}
                        className="mt-3 text-xs text-gray-600 hover:text-gray-400">✕ Cerrar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Todas las tonalidades</p>
                    {CIRCLE_OF_FIFTHS.map(({ note, minor })=>{
                      const nc=getNoteColor(note);
                      return (
                        <button key={note} onClick={()=>setSelectedKey(note)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg border border-gray-800 text-left hover:border-gray-600"
                          style={{background:"#0e0e1c"}}>
                          <div className="w-5 h-5 rounded-full border"
                            style={{backgroundColor:nc.hex+"33",borderColor:nc.hex}}/>
                          <span className="font-bold text-sm w-8" style={{color:nc.hex}}>{note}</span>
                          <span className="text-gray-500 text-xs">Mayor</span>
                          <span className="text-gray-600 text-xs ml-auto">→ {minor} relativa</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ COLORES ══════════════════════════════════════════════════════════ */}
        {tab==="colors"&&(
          <div className="stagger">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Sistema cromático tonal</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {Object.entries(NOTE_COLORS)
                .filter(([n])=>n.length===1)
                .map(([note,col])=>(
                  <div key={note} className="rounded-xl p-4 border cursor-pointer"
                    style={{background:col.hex+"11",borderColor:col.hex+"44"}}
                    onClick={()=>playNote(note)}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full border-2"
                        style={{background:col.hex,borderColor:col.hex}}/>
                      <div>
                        <p className="text-xl font-bold"
                          style={{color:col.hex,fontFamily:"'Libre Baskerville',serif"}}>{note}</p>
                        <p className="text-xs" style={{color:col.hex+"bb"}}>{col.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-mono">{col.hex}</p>
                    <p className="text-xs text-gray-600 font-mono">rgb({col.rgb.join(", ")})</p>
                  </div>
                ))}
            </div>

            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Notas alteradas — interpolación cromática</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {["C#","D#","F#","G#","A#"].map(note=>{
                const col=NOTE_COLORS[note];
                return (
                  <div key={note} className="rounded-xl p-4 border cursor-pointer"
                    style={{background:col.hex+"11",borderColor:col.hex+"44"}}
                    onClick={()=>playNote(note)}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full"
                        style={{background:`linear-gradient(135deg,${col.hex},${col.hex}88)`}}/>
                      <div>
                        <p className="font-bold text-sm" style={{color:col.hex}}>{note} / {ENHARMONIC[note]}</p>
                        <p className="text-xs" style={{color:col.hex+"99"}}>{col.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-mono">{col.hex}</p>
                    <p className="text-xs text-gray-600 font-mono">rgb({col.rgb.join(", ")})</p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl border border-gray-800" style={{background:"#0e0e1c"}}>
              <p className="text-xs text-gray-500 mb-4">Teclado de referencia completo — tocá cada tecla para escucharla</p>
              <PianoKeyboard highlightedNotes={[...CHROMATIC]}/>
              <div className="mt-4 grid grid-cols-6 gap-1.5">
                {CHROMATIC.map(n=>{
                  const c=getNoteColor(n);
                  return (
                    <button key={n} onClick={()=>playNote(n)}
                      className="flex flex-col items-center p-1.5 rounded border text-xs"
                      style={{background:c.hex+"18",borderColor:c.hex+"44",color:c.hex}}>
                      <span className="font-bold">{n}</span>
                      <span className="opacity-60" style={{fontSize:"9px"}}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 mt-8 px-6 py-3 text-center">
        <p className="text-xs text-gray-600 italic">
          Harmonía · Diccionario armónico · Improvisación contextual · Sistema de color tonal
        </p>
      </div>
    </div>
  );
}
