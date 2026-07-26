import { CHROMATIC, noteIdx, enh } from './notes.js';
import { MODES, MSI, DN, DQ, DL, tNote } from './formulas.js';

export const HF = {
  "7": [
    { fn:"V7 → I (dominante)",    degree:"V",   key:"Resuelve a tónica mayor",         mode:"Mixolidio",  modeIvs:MODES["Mixolidio"], tensions:["9","13"],          avoid:["11"],     resolutions:["I△7","I"],       why:"El tritono (3ª–7ª) se resuelve por semitono. Tensión máxima del sistema tonal." },
    { fn:"V7/iv (hacia menor)",   degree:"V",   key:"Resuelve a acorde menor",          mode:"Alterada",   modeIvs:MODES["Alterada"],  tensions:["b9","#9","#11","b13"], avoid:[], resolutions:["im7","im"],     why:"Modo Alterado: todas las tensiones disponibles. Color oscuro — cadencias menores en tango y jazz." },
    { fn:"SubV7 (tritonal)",      degree:"bII", key:"Reemplaza V7 — bajo por semitono", mode:"Lidio b7",   modeIvs:MODES["Lidio b7"],  tensions:["9","#11","13"],   avoid:[],         resolutions:["I△7","I"],       why:"Comparte el tritono con V7. El bajo baja un semitono en vez del salto de 5ª." },
    { fn:"Dominante de paso",     degree:"?",   key:"Conecta cromáticamente",           mode:"Mixolidio",  modeIvs:MODES["Mixolidio"], tensions:["9","13"],          avoid:[],         resolutions:["siguiente"],     why:"No establece tonalidad. Genera movimiento cromático sin perturbar el centro." },
    { fn:"I7 Blues / tango",      degree:"I",   key:"Tónica estática — color blue-tango",mode:"Blues",    modeIvs:MODES["Blues"],     tensions:["9","#9","13"],     avoid:["b9"],     resolutions:["IV7","V7"],      why:"En Blues el I7 es estático, no resuelve. La b9 destruye el color del género." },
  ],
  "maj7": [
    { fn:"I△7 — Tónica mayor",    degree:"I",   key:"Centro tonal luminoso",            mode:"Lidio",      modeIvs:MODES["Lidio"],     tensions:["9","#11","13"],   avoid:["11"],     resolutions:["estático"],      why:"#11 (Lidio) evita conflicto con la 4ª justa. Color más sofisticado de la función." },
    { fn:"IV△7 — Subdominante",   degree:"IV",  key:"Color lírico — no resuelve fuerte",mode:"Lidio",      modeIvs:MODES["Lidio"],     tensions:["9","#11"],        avoid:["11"],     resolutions:["I△7","V7"],      why:"La 11ª justa crea fricción con la 3ª del I. Con Lidio (#11) el movimiento es fluido." },
    { fn:"△7 Modal",              degree:"I",   key:"Tónica de modo sin función tonal", mode:"Jónico",     modeIvs:MODES["Jónico"],    tensions:["9","6","13"],     avoid:[],         resolutions:["estático"],      why:"En música modal el △7 es punto de reposo absoluto. Frecuente en tango moderno." },
  ],
  "min7": [
    { fn:"ii m7 — Pre-dominante", degree:"ii",  key:"Pre-dominante en ii–V–I",          mode:"Dórico",     modeIvs:MODES["Dórico"],    tensions:["9","11"],         avoid:["b9"],     resolutions:["V7","V7sus4"],   why:"Dórico (6ª mayor) da brillo típico del jazz. Evitar b9 — suena Frigio." },
    { fn:"iii m7 — Mediante",     degree:"iii", key:"Sustituto de tónica, más oscuro",  mode:"Frigio",     modeIvs:MODES["Frigio"],    tensions:["11"],             avoid:["9","13"], resolutions:["IV△7","ii m7"], why:"Tiene b9 (Frigio). Crea tensión suave que impulsa hacia el IV." },
    { fn:"vi m7 — Relativa menor",degree:"vi",  key:"Tónica relativa estable",          mode:"Eólico",     modeIvs:MODES["Eólico"],    tensions:["9","11"],         avoid:[],         resolutions:["estático"],      why:"Comparte 3 notas con I△7. Reemplaza la tónica mayor con color oscuro." },
    { fn:"iv m7 — Subdominante m.",degree:"iv", key:"Borrowed del modo menor",          mode:"Eólico",     modeIvs:MODES["Eólico"],    tensions:["9","11","b6"],    avoid:[],         resolutions:["I△7","V7","bVII△7"], why:"La b6 delata que viene del modo menor. Oscuridad expresiva. Muy usado en tango." },
  ],
  "m7b5": [
    { fn:"iiø7 — Pre-dominante m.",degree:"ii", key:"Supertónica en contexto menor",    mode:"Locrio #2",  modeIvs:MODES["Locrio #2"], tensions:["9","11","b13"],   avoid:[],         resolutions:["V7b9","V7alt"],  why:"Locrio #2 da 9ª natural, más melódico que Locrio. Clave en ii-V-i del tango." },
    { fn:"ø7 de color modal",     degree:"?",   key:"Color sin función tonal fija",     mode:"Locrio #2",  modeIvs:MODES["Locrio #2"], tensions:["9","11"],         avoid:[],         resolutions:["variable"],      why:"Puede flotar ambiguamente en tango moderno y jazz sin necesitar resolver." },
  ],
  "maj": [
    { fn:"I Mayor — Tónica",      degree:"I",   key:"Centro tonal clásico",             mode:"Jónico",     modeIvs:MODES["Jónico"],    tensions:["9","6"],          avoid:["7"],      resolutions:["estático"],      why:"Sin 7ª el sonido es más abierto y clásico. Frecuente en cierres de tango." },
    { fn:"IV Mayor — Subdominante",degree:"IV", key:"Hacia dominante o tónica",         mode:"Lidio",      modeIvs:MODES["Lidio"],     tensions:["9","#11"],        avoid:[],         resolutions:["V","I"],         why:"Con #11 (Lidio) suena brillante y moderno sin abandonar la función." },
    { fn:"V Mayor — Dominante s/7",degree:"V",  key:"Menos tensión que V7",             mode:"Mixolidio",  modeIvs:MODES["Mixolidio"], tensions:["9","13"],         avoid:["11"],     resolutions:["I","I△7"],       why:"Sin la 7ª la tensión es menor. Común en pasajes clásicos y folclóricos." },
  ],
  "min": [
    { fn:"i menor — Tónica menor",degree:"i",   key:"Centro tonal oscuro",              mode:"Eólico",     modeIvs:MODES["Eólico"],    tensions:["9","11","b6"],    avoid:[],         resolutions:["estático"],      why:"La b6 eólica refuerza el color oscuro esencial del tango." },
    { fn:"iv menor — Subdom. menor",degree:"iv",key:"Peso expresivo en modo menor",     mode:"Eólico",     modeIvs:MODES["Eólico"],    tensions:["9","11"],         avoid:[],         resolutions:["V7","i","bVII"], why:"Junto al V7 forma la cadencia perfecta menor. Muy frecuente en tango y milonga." },
  ],
  "dim7": [
    { fn:"vii°7 — Sensible dism.", degree:"vii",key:"Cada nota a semitono de la tónica",mode:"Disminuida", modeIvs:MODES["Disminuida"],tensions:[],                 avoid:[],         resolutions:["I△7","I","i"],   why:"Simétrico: divide la octava en 4 partes. Fundamental en tango como paso cromático." },
    { fn:"°7 cromático de paso",   degree:"?",  key:"Conecta por movimiento de bajo",   mode:"Disminuida", modeIvs:MODES["Disminuida"],tensions:[],                 avoid:[],         resolutions:["acorde a semitono"], why:"Puede transponerse cada 3 semitonos. Ideal para modulaciones rápidas en tango." },
  ],
  "minMaj7": [
    { fn:"i△7 — Tónica menor △7", degree:"i",  key:"Expresión máxima tango/cine",      mode:"Menor Mel.", modeIvs:MODES["Menor Mel."],tensions:["9","11","6"],     avoid:[],         resolutions:["im7","I△7"],     why:"Acorde de apertura de líneas cromáticas descendentes. Piazzolla, tango moderno, cine." },
  ],
};

export const getFns = (q) =>
  HF[q] || [{ fn:"Acorde de color", degree:"?", key:"Uso libre / modal", mode:"Según contexto", modeIvs:MODES["Jónico"], tensions:["varía"], avoid:[], resolutions:["variable"], why:"Sin función tonal fija. Depende del contexto armónico." }];

export const COF = [
  {note:"C",  minor:"Am",  deg:0,   sig:"Sin alteraciones", minorFull:"A menor"},
  {note:"G",  minor:"Em",  deg:30,  sig:"1♯ (F#)",          minorFull:"E menor"},
  {note:"D",  minor:"Bm",  deg:60,  sig:"2♯ (F#,C#)",       minorFull:"B menor"},
  {note:"A",  minor:"F#m", deg:90,  sig:"3♯",               minorFull:"F# menor"},
  {note:"E",  minor:"C#m", deg:120, sig:"4♯",               minorFull:"C# menor"},
  {note:"B",  minor:"G#m", deg:150, sig:"5♯",               minorFull:"G# menor"},
  {note:"F#", minor:"D#m", deg:180, sig:"6♯",               minorFull:"D# menor"},
  {note:"Db", minor:"Bbm", deg:210, sig:"5♭",               minorFull:"Bb menor"},
  {note:"Ab", minor:"Fm",  deg:240, sig:"4♭",               minorFull:"F menor"},
  {note:"Eb", minor:"Cm",  deg:270, sig:"3♭ (Bb,Eb,Ab)",    minorFull:"C menor"},
  {note:"Bb", minor:"Gm",  deg:300, sig:"2♭ (Bb,Eb)",       minorFull:"G menor"},
  {note:"F",  minor:"Dm",  deg:330, sig:"1♭ (Bb)",          minorFull:"D menor"},
];

export function getMSD(root) {
  const ri = noteIdx(root);
  if(ri === -1) return null;
  const notes = MSI.map(i => CHROMATIC[(ri + i) % 12]);
  return {
    notes,
    diatonic: notes.map((n, i) => ({
      note:n, degree:DN[i], quality:DQ[i], label:DL[i], full:`${n}${DQ[i]}`,
    })),
  };
}

export function computeProg(chords) {
  const scores = {};
  COF.forEach(({ note }) => {
    const ri = noteIdx(note);
    if(ri === -1) return;
    let sc = 0;
    const scale = MSI.map(i => CHROMATIC[(ri + i) % 12]);
    chords.forEach(({ root }) => {
      if(scale.includes(root))      sc += 2;
      if(scale.includes(enh(root))) sc += 2;
    });
    scores[note] = sc;
  });
  const key = Object.entries(scores).sort((a,b) => b[1] - a[1])[0][0];
  const ki  = noteIdx(key);
  const sn  = MSI.map(i => CHROMATIC[(ki + i) % 12]);
  return chords.map(({ root, quality, raw, notes }) => {
    const ri = sn.indexOf(root) !== -1 ? sn.indexOf(root) : sn.indexOf(enh(root));
    return { raw, root, quality, notes, degree: ri >= 0 ? DN[ri] : "?", key, fn: getFns(quality)[0] };
  });
}
