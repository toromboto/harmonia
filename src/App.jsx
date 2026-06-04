import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { YIN } from "pitchfinder";

// ─── COLORES TONALES ──────────────────────────────────────────────────────────
const NC_DEFAULT = {
  C:"#1E50DC", D:"#28A03C", E:"#82501E", F:"#C8B98C",
  G:"#E6C814", A:"#D22828", B:"#7828B4",
  "C#":"#2378B4","Db":"#2378B4",
  "D#":"#28B464","Eb":"#28B464",
  "F#":"#D7C050","Gb":"#D7C050",
  "G#":"#DC781E","Ab":"#DC781E",
  "A#":"#A5286E","Bb":"#A5286E",
};
const PALETTE_KEY = "harmonia_palette_v1";
const EDIT_HASH   = "murcielago";

function loadPalette() {
  try {
    const saved = localStorage.getItem(PALETTE_KEY);
    if (!saved) return {...NC_DEFAULT};
    const parsed = JSON.parse(saved);
    const merged = {...NC_DEFAULT, ...parsed};
    const ENH = {"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
    Object.keys(ENH).forEach(s=>{ if(merged[s]) merged[ENH[s]]=merged[s]; });
    return merged;
  } catch { return {...NC_DEFAULT}; }
}
let NC = loadPalette();
const nc = (n) => NC[n?.replace(/[0-9]/g,"").trim()] || "#888";

const CHROMATIC  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC = {"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
const enh = n => ENHARMONIC[n]||n;
const noteIdx = n => {
  const i=CHROMATIC.indexOf(n); if(i>=0) return i;
  const e=Object.entries(ENHARMONIC).find(([,v])=>v===n);
  return e?CHROMATIC.indexOf(e[0]):-1;
};
const fromRoot = (root,semi) => CHROMATIC[(noteIdx(root)+semi+120)%12];
const buildScale = (root,ivs) => {
  // Para escalas de 7 notas: usar spelling diatónico correcto
  // (una nota por letra de la escala, sin repetir C D E F G A B)
  const CHROMATIC_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const CHROMATIC_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  // Notas que prefieren bemoles como raíz
  const FLAT_KEYS = new Set(["F","Bb","Eb","Ab","Db","Gb"]);
  const useFlat = FLAT_KEYS.has(root);
  const SCALE = useFlat ? CHROMATIC_FLAT : CHROMATIC_SHARP;
  const ri = CHROMATIC_SHARP.indexOf(root) !== -1
    ? CHROMATIC_SHARP.indexOf(root)
    : CHROMATIC_FLAT.indexOf(root);

  if (ivs.length !== 7) {
    // Para escalas no diatónicas (pentatónicas, blues, etc.) usar el método simple
    return ivs.map(i => SCALE[(ri+i+120)%12]);
  }

  // Para escalas de 7 notas: garantizar una letra por grado
  const LETTERS = ["C","D","E","F","G","A","B"];
  const rootLetter = root.replace(/[#b]/,"");
  const rootLetterIdx = LETTERS.indexOf(rootLetter);

  return ivs.map((interval, degree) => {
    const targetLetter = LETTERS[(rootLetterIdx + degree) % 7];
    const chromIdx = (ri + interval + 120) % 12;
    // Buscar la nota con la letra correcta
    for (const spelling of [CHROMATIC_SHARP, CHROMATIC_FLAT]) {
      const note = spelling[chromIdx];
      if (note.replace(/[#b]/,"") === targetLetter) return note;
    }
    // Fallback: doble alteración (raro) — usar nota cromática simple
    return SCALE[chromIdx];
  });
};

const LAT={"DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F","FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B"};
const ENG_LAT=Object.fromEntries(Object.entries(LAT).map(([k,v])=>[v,k]));

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let _ctx=null;
const getCtx=()=>{if(!_ctx)try{_ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}return _ctx;};
const MIDI={C:60,"C#":61,"Db":61,D:62,"D#":63,"Eb":63,E:64,F:65,"F#":66,"Gb":66,G:67,"G#":68,"Ab":68,A:69,"A#":70,"Bb":70,B:71};

// ── SONIDO TIPO BANDONEÓN ─────────────────────────────────────────────────────
// Timbre: mezcla de parciales con microdesafinación (efecto chorus natural de acordeón).
// Dos osciladores por parcial ligeramente desafinados → corusing que imita las lengüetas.
// Envolvente de fuelle: ataque suave (10ms), sustain plano, release al soltar.
//
// playBandSound(eng, oct, dur?)
//   Uso con duración fija (biblioteca, análisis): dur en segundos
//   Retorna {stop()} para corte manual (botón sostenido)
const playBandSound = (eng, oct=4, dur=null) => {
  try {
    const ctx = getCtx(); if (!ctx) return {stop:()=>{}};
    if (ctx.state==="suspended") ctx.resume();
    const midi = (MIDI[eng]??60) + (oct-4)*12;
    const baseFreq = 440 * Math.pow(2,(midi-69)/12);

    // Master gain (envolvente de fuelle)
    const master = ctx.createGain();
    master.connect(ctx.destination);

    // Parciales del bandoneón: fundamental + 2ª + 3ª + 5ª
    // Cada parcial tiene dos lengüetas ligeramente desafinadas (±cents)
    const PARCIALES = [
      {h:1,  vol:0.28, detune:4},   // fundamental — dos lengüetas ±4 cents
      {h:2,  vol:0.18, detune:3},   // octava
      {h:3,  vol:0.12, detune:5},   // quinta
      {h:4,  vol:0.07, detune:3},   // 2ª octava
      {h:6,  vol:0.04, detune:6},   // 3ª
    ];

    const oscs = [];
    PARCIALES.forEach(({h, vol, detune}) => {
      const freq = baseFreq * h;
      [-detune, +detune].forEach((d, di) => {
        const osc  = ctx.createOscillator();
        const gn   = ctx.createGain();
        osc.connect(gn); gn.connect(master);
        osc.type = "sawtooth";
        // Microdesafinación en cents
        osc.frequency.value = freq * Math.pow(2, d/1200);
        gn.gain.value = vol * (di===0 ? 0.55 : 0.45); // balance entre las dos lengüetas
        osc.start();
        oscs.push({osc, gn});
      });
    });

    // Ataque tipo fuelle: sube en 15ms
    const t0 = ctx.currentTime;
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.6, t0 + 0.015);

    const stop = () => {
      try {
        const t = ctx.currentTime;
        // Release: baja en 60ms (suena natural al soltar el botón)
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + 0.06);
        oscs.forEach(({osc}) => { try{osc.stop(t+0.07);}catch(e){} });
      } catch(e){}
    };

    if (dur !== null) {
      // Duración fija: release al final
      master.gain.setValueAtTime(0.6, t0 + 0.015);
      master.gain.setValueAtTime(0.6, t0 + dur - 0.06);
      master.gain.linearRampToValueAtTime(0, t0 + dur);
      oscs.forEach(({osc}) => { try{osc.stop(t0+dur+0.01);}catch(e){} });
      return {stop:()=>{}};
    }

    return {stop};
  } catch(e) { return {stop:()=>{}}; }
};

// playTone: para piano, análisis armónico (sin cambios)
const playTone=(note,octave=4,dur=0.7)=>{
  try{
    const ctx=getCtx();if(!ctx)return;
    if(ctx.state==="suspended")ctx.resume();
    const midi=(MIDI[note]??60)+(octave-4)*12;
    const freq=440*Math.pow(2,(midi-69)/12);
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type="triangle";osc.frequency.value=freq;
    gain.gain.setValueAtTime(0.22,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    osc.start();osc.stop(ctx.currentTime+dur);
  }catch(e){}
};
const playBand=(noteLat,octave)=>{
  const eng=LAT[noteLat]||noteLat;
  playBandSound(eng, octave, 1.0);
};
const playChord=(notes)=>notes.forEach((n,i)=>setTimeout(()=>playTone(n,4,1.2),i*20));

// ─── TEORÍA ───────────────────────────────────────────────────────────────────
const FORMULAS={
  "maj": {intervals:[0,4,7],          label:"Mayor",      symbol:""    },
  "min": {intervals:[0,3,7],          label:"Menor",      symbol:"m"   },
  "7":   {intervals:[0,4,7,10],       label:"Dom. 7ª",    symbol:"7"   },
  "maj7":{intervals:[0,4,7,11],       label:"Mayor 7ª",   symbol:"△7"  },
  "min7":{intervals:[0,3,7,10],       label:"Menor 7ª",   symbol:"m7"  },
  "dim": {intervals:[0,3,6],          label:"Disminuido", symbol:"°"   },
  "dim7":{intervals:[0,3,6,9],        label:"Dim. 7ª",    symbol:"°7"  },
  "m7b5":{intervals:[0,3,6,10],       label:"Semidism.",  symbol:"ø7"  },
  "aug": {intervals:[0,4,8],          label:"Aumentado",  symbol:"+"   },
  "sus2":{intervals:[0,2,7],          label:"Sus2",       symbol:"sus2"},
  "sus4":{intervals:[0,5,7],          label:"Sus4",       symbol:"sus4"},
  "9":   {intervals:[0,4,7,10,2],     label:"Dom. 9ª",    symbol:"9"   },
  "maj9":{intervals:[0,4,7,11,2],     label:"Mayor 9ª",   symbol:"△9"  },
  "min9":{intervals:[0,3,7,10,2],     label:"Menor 9ª",   symbol:"m9"  },
  "13":  {intervals:[0,4,7,10,2,9],   label:"Dom. 13ª",   symbol:"13"  },
  "7b9": {intervals:[0,4,7,10,1],     label:"Dom. b9",    symbol:"7b9" },
  "7#9": {intervals:[0,4,7,10,3],     label:"Dom. #9",    symbol:"7#9" },
  "7alt":{intervals:[0,4,7,10,1,3,8], label:"Alt.",       symbol:"7alt"},
};

const MODES={
  "Jónico":       [0,2,4,5,7,9,11],
  "Dórico":       [0,2,3,5,7,9,10],
  "Frigio":       [0,1,3,5,7,8,10],
  "Lidio":        [0,2,4,6,7,9,11],
  "Mixolidio":    [0,2,4,5,7,9,10],
  "Eólico":       [0,2,3,5,7,8,10],
  "Locrio":       [0,1,3,5,6,8,10],
  "Locrio #2":    [0,2,3,5,6,8,10],
  "Lidio b7":     [0,2,4,6,7,9,10],
  "Alterada":     [0,1,3,4,6,8,10],
  "Frigio Dom.":  [0,1,4,5,7,8,10],
  "Disminuida":   [0,2,3,5,6,8,9,11],
  "Blues":        [0,3,5,6,7,10],
  "Menor Arm.":   [0,2,3,5,7,8,11],
  "Jónico #5":    [0,2,4,5,8,9,11],
  "Dórico #4":    [0,2,3,6,7,9,10],
  "Lidio #2":     [0,3,4,6,7,9,11],
  "Ultra Locrio": [0,1,3,4,6,8,9],
  "Menor Mel.":   [0,2,3,5,7,9,11],
  "Dórico b2":    [0,1,3,5,7,9,10],
  "Lidio Aum.":   [0,2,4,6,8,9,11],
  "Lidio Dom.":   [0,2,4,6,7,9,10],
  "Mixolidio b6": [0,2,4,5,7,8,10],
};

const T_SEMI={"9":2,"b9":1,"#9":3,"11":5,"#11":6,"13":9,"b13":8,"6":9,"b6":8,"b7":10,"7":11};
const tNote=(root,t)=>{const s=T_SEMI[t];return s!==undefined?fromRoot(root,s):null;};

const MODE_BY_DEGREE=[
  {name:"Jónico",   ivs:MODES["Jónico"],   q:"maj7",tensions:["9","13"],       avoid:["11"], degree:"I"  },
  {name:"Dórico",   ivs:MODES["Dórico"],   q:"m7",  tensions:["9","11"],       avoid:["b9"], degree:"II" },
  {name:"Frigio",   ivs:MODES["Frigio"],   q:"m7",  tensions:["11"],           avoid:["9","13"],degree:"III"},
  {name:"Lidio",    ivs:MODES["Lidio"],    q:"maj7",tensions:["9","#11","13"],  avoid:[],     degree:"IV" },
  {name:"Mixolidio",ivs:MODES["Mixolidio"],q:"7",   tensions:["9","13"],       avoid:["11"], degree:"V"  },
  {name:"Eólico",   ivs:MODES["Eólico"],   q:"m7",  tensions:["9","11"],       avoid:[],     degree:"VI" },
  {name:"Locrio",   ivs:MODES["Locrio"],   q:"m7b5",tensions:["11","b13"],     avoid:["b9"], degree:"VII"},
];
const MODE_BY_DEGREE_MINOR=[
  {name:"Eólico",    ivs:MODES["Eólico"],    q:"m7",  tensions:["9","11"],       avoid:[],         degree:"i"   },
  {name:"Locrio",    ivs:MODES["Locrio"],    q:"m7b5",tensions:["11","b13"],     avoid:["b9"],     degree:"ii"  },
  {name:"Jónico",    ivs:MODES["Jónico"],    q:"maj7",tensions:["9","13"],       avoid:["11"],     degree:"bIII"},
  {name:"Dórico",    ivs:MODES["Dórico"],    q:"m7",  tensions:["9","11"],       avoid:["b9"],     degree:"iv"  },
  {name:"Frigio",    ivs:MODES["Frigio"],    q:"m7",  tensions:["11"],           avoid:["9","13"], degree:"v"   },
  {name:"Lidio",     ivs:MODES["Lidio"],     q:"maj7",tensions:["9","#11","13"], avoid:[],         degree:"bVI" },
  {name:"Mixolidio", ivs:MODES["Mixolidio"], q:"7",   tensions:["9","13"],       avoid:["11"],     degree:"bVII"},
];

const HF={
  "7":[
    {fn:"V7 → I (dominante)",degree:"V",key:"Resuelve a tónica mayor",mode:"Mixolidio",modeIvs:MODES["Mixolidio"],tensions:["9","13"],avoid:["11"],resolutions:["I△7","I"],why:"El tritono (3ª–7ª) se resuelve por semitono. Tensión máxima del sistema tonal."},
    {fn:"V7/iv (hacia menor)",degree:"V",key:"Resuelve a acorde menor",mode:"Alterada",modeIvs:MODES["Alterada"],tensions:["b9","#9","b13"],avoid:["9","13"],resolutions:["im7","im"],why:"Tensiones alteradas crean color oscuro. Idiomático del tango en cadencias menores."},
    {fn:"SubV7 (tritonal)",degree:"bII",key:"Reemplaza V7 — bajo por semitono",mode:"Lidio b7",modeIvs:MODES["Lidio b7"],tensions:["9","#11","13"],avoid:[],resolutions:["I△7","I"],why:"Comparte el tritono con V7. El bajo baja un semitono en vez del salto de 5ª."},
    {fn:"Dominante de paso",degree:"?",key:"Conecta cromáticamente",mode:"Mixolidio",modeIvs:MODES["Mixolidio"],tensions:["9","13"],avoid:[],resolutions:["siguiente"],why:"No establece tonalidad. Genera movimiento cromático sin perturbar el centro."},
    {fn:"I7 Blues / tango",degree:"I",key:"Tónica con color blue-tango",mode:"Blues",modeIvs:MODES["Blues"],tensions:["b9","#9"],avoid:[],resolutions:["IV7","V7"],why:"La 7ª menor es constitutiva del sonido, no tensión a resolver."},
  ],
  "maj7":[
    {fn:"I△7 — Tónica mayor",degree:"I",key:"Centro tonal luminoso",mode:"Lidio",modeIvs:MODES["Lidio"],tensions:["9","#11","13"],avoid:["11"],resolutions:["estático"],why:"#11 (Lidio) evita conflicto con la 4ª justa. Color más sofisticado de la función."},
    {fn:"IV△7 — Subdominante",degree:"IV",key:"Color lírico — no resuelve fuerte",mode:"Lidio",modeIvs:MODES["Lidio"],tensions:["9","#11"],avoid:["11"],resolutions:["I△7","V7"],why:"La 11ª justa crea fricción con la 3ª del I. Con Lidio (#11) el movimiento es fluido."},
    {fn:"△7 Modal",degree:"I",key:"Tónica de modo sin función tonal",mode:"Jónico",modeIvs:MODES["Jónico"],tensions:["9","6","13"],avoid:[],resolutions:["estático"],why:"En música modal el △7 es punto de reposo absoluto. Frecuente en tango moderno."},
  ],
  "min7":[
    {fn:"ii m7 — Pre-dominante",degree:"ii",key:"Pre-dominante en ii–V–I",mode:"Dórico",modeIvs:MODES["Dórico"],tensions:["9","11"],avoid:["b9"],resolutions:["V7","V7sus4"],why:"Dórico (6ª mayor) da brillo típico del jazz. Evitar b9 — suena Frigio."},
    {fn:"iii m7 — Mediante",degree:"iii",key:"Sustituto de tónica, más oscuro",mode:"Frigio",modeIvs:MODES["Frigio"],tensions:["11"],avoid:["9","13"],resolutions:["IV△7","ii m7"],why:"Tiene b9 (Frigio). Crea tensión suave que impulsa hacia el IV."},
    {fn:"vi m7 — Relativa menor",degree:"vi",key:"Tónica relativa estable",mode:"Eólico",modeIvs:MODES["Eólico"],tensions:["9","11"],avoid:[],resolutions:["estático"],why:"Comparte 3 notas con I△7. Reemplaza la tónica mayor con color oscuro."},
    {fn:"iv m7 — Subdominante menor",degree:"iv",key:"Borrowed del modo menor",mode:"Eólico",modeIvs:MODES["Eólico"],tensions:["9","11","b6"],avoid:[],resolutions:["I△7","V7","bVII△7"],why:"La b6 delata que viene del modo menor. Oscuridad expresiva. Muy usado en tango."},
  ],
  "m7b5":[
    {fn:"iiø7 — Pre-dominante en menor",degree:"ii",key:"Supertónica en contexto menor",mode:"Locrio #2",modeIvs:MODES["Locrio #2"],tensions:["9","11","b13"],avoid:[],resolutions:["V7b9","V7alt"],why:"Locrio #2 da 9ª natural, más melódico que Locrio. Clave en ii-V-i del tango."},
    {fn:"ø7 de color modal",degree:"?",key:"Color sin función tonal fija",mode:"Locrio #2",modeIvs:MODES["Locrio #2"],tensions:["9","11"],avoid:[],resolutions:["variable"],why:"Puede flotar ambiguamente en tango moderno y jazz sin necesitar resolver."},
  ],
  "maj":[
    {fn:"I Mayor — Tónica",degree:"I",key:"Centro tonal clásico",mode:"Jónico",modeIvs:MODES["Jónico"],tensions:["9","6"],avoid:["7"],resolutions:["estático"],why:"Sin 7ª el sonido es más abierto y clásico. Frecuente en cierres de tango."},
    {fn:"IV Mayor — Subdominante",degree:"IV",key:"Hacia dominante o tónica",mode:"Lidio",modeIvs:MODES["Lidio"],tensions:["9","#11"],avoid:[],resolutions:["V","I"],why:"Con #11 (Lidio) suena brillante y moderno sin abandonar la función."},
    {fn:"V Mayor — Dominante sin 7ª",degree:"V",key:"Menos tensión que V7",mode:"Mixolidio",modeIvs:MODES["Mixolidio"],tensions:["9","13"],avoid:["11"],resolutions:["I","I△7"],why:"Sin la 7ª la tensión es menor. Común en pasajes clásicos y folclóricos."},
  ],
  "min":[
    {fn:"i menor — Tónica menor",degree:"i",key:"Centro tonal oscuro",mode:"Eólico",modeIvs:MODES["Eólico"],tensions:["9","11","b6"],avoid:[],resolutions:["estático"],why:"La b6 eólica refuerza el color oscuro esencial del tango."},
    {fn:"iv menor — Subdominante menor",degree:"iv",key:"Peso expresivo en modo menor",mode:"Eólico",modeIvs:MODES["Eólico"],tensions:["9","11"],avoid:[],resolutions:["V7","i","bVII"],why:"Junto al V7 forma la cadencia perfecta menor. Muy frecuente en tango y milonga."},
  ],
  "dim7":[
    {fn:"vii°7 — Sensible disminuido",degree:"vii",key:"Cada nota a semitono de la tónica",mode:"Disminuida",modeIvs:MODES["Disminuida"],tensions:[],avoid:[],resolutions:["I△7","I","i"],why:"Simétrico: divide la octava en 4 partes. Fundamental en tango como paso cromático."},
    {fn:"°7 cromático de paso",degree:"?",key:"Conecta por movimiento de bajo",mode:"Disminuida",modeIvs:MODES["Disminuida"],tensions:[],avoid:[],resolutions:["acorde a semitono"],why:"Puede transponerse cada 3 semitonos. Ideal para modulaciones rápidas en tango."},
  ],
};
const getFns=(q)=>HF[q]||[{fn:"Acorde de color",degree:"?",key:"Uso libre / modal",mode:"Según contexto",modeIvs:MODES["Jónico"],tensions:["varía"],avoid:[],resolutions:["variable"],why:"Sin función tonal fija. Depende del contexto armónico."}];

// ─── VOICING REAL DE PIANO ────────────────────────────────────────────────────
// MI: tónica sola en bajo (oct 2)
// MD: 3ª + 7ª (guía-notas) en oct 4, extensiones en oct 5
const buildVoicing=(root,quality)=>{
  const f=FORMULAS[quality]||FORMULAS["maj"];
  const ivs=f.intervals;
  const has=s=>ivs.some(i=>(i%12)===s%12);
  const has7=has(10)||has(11);
  const L=[];
  L.push({note:root,role:"Tónica (bajo)",oct:2});
  if(!has7&&has(7)) L.push({note:fromRoot(root,7),role:"Quinta",oct:2});
  if(has(6))        L.push({note:fromRoot(root,6),role:"5ª dim.",oct:2});
  if(has(8))        L.push({note:fromRoot(root,8),role:"5ª aum.",oct:2});
  const R=[];
  if(has(3))  R.push({note:fromRoot(root,3), role:"3ª menor",oct:4});
  if(has(4))  R.push({note:fromRoot(root,4), role:"3ª mayor",oct:4});
  if(has(10)) R.push({note:fromRoot(root,10),role:"7ª menor", oct:4});
  if(has(11)) R.push({note:fromRoot(root,11),role:"7ª mayor", oct:4});
  if(!has7&&has(7)) R.push({note:fromRoot(root,7),role:"Quinta",oct:4});
  const extL={1:"b9",2:"9ª",3:"#9",5:"11ª",6:"#11",8:"b13",9:"13ª"};
  ivs.filter(i=>i>11).forEach(i=>{
    const s=i%12;
    R.push({note:fromRoot(root,s),role:extL[s]||"ext.",oct:5});
  });
  return {L,R};
};

// ─── CÍRCULO DE QUINTAS ───────────────────────────────────────────────────────
const COF=[
  {note:"C",  minor:"Am",  deg:0,   sig:"Sin alteraciones", minorFull:"A menor"},
  {note:"G",  minor:"Em",  deg:30,  sig:"1♯ (F#)",         minorFull:"E menor"},
  {note:"D",  minor:"Bm",  deg:60,  sig:"2♯ (F#,C#)",      minorFull:"B menor"},
  {note:"A",  minor:"F#m", deg:90,  sig:"3♯",              minorFull:"F# menor"},
  {note:"E",  minor:"C#m", deg:120, sig:"4♯",              minorFull:"C# menor"},
  {note:"B",  minor:"G#m", deg:150, sig:"5♯",              minorFull:"G# menor"},
  {note:"F#", minor:"D#m", deg:180, sig:"6♯",              minorFull:"D# menor"},
  {note:"Db", minor:"Bbm", deg:210, sig:"5♭",              minorFull:"Bb menor"},
  {note:"Ab", minor:"Fm",  deg:240, sig:"4♭",              minorFull:"F menor"},
  {note:"Eb", minor:"Cm",  deg:270, sig:"3♭ (Bb,Eb,Ab)",   minorFull:"C menor"},
  {note:"Bb", minor:"Gm",  deg:300, sig:"2♭ (Bb,Eb)",      minorFull:"G menor"},
  {note:"F",  minor:"Dm",  deg:330, sig:"1♭ (Bb)",         minorFull:"D menor"},
];
const MSI=[0,2,4,5,7,9,11];
const DN=["I","II","III","IV","V","VI","VII"];
const DQ=["maj7","m7","m7","maj7","7","m7","m7b5"];
const DL=["Tónica","Supertónica","Mediante","Subdominante","Dominante","Relativa m.","Sensible"];
const DN_MIN=["i","ii","bIII","iv","v","bVI","bVII"];
const DQ_MIN=["m7","m7b5","maj7","m7","m7","maj7","7"];
const DL_MIN=["Tónica","Supertónica","Mediante","Subdominante","Dominante","Submediante","Subtónica"];

const getMSD=(root)=>{
  const ri=noteIdx(root);if(ri===-1)return null;
  const notes=MSI.map(i=>CHROMATIC[(ri+i)%12]);
  return{notes,diatonic:notes.map((n,i)=>({note:n,degree:DN[i],quality:DQ[i],label:DL[i],full:`${n}${DQ[i]}`}))};
};

const parseChord=(input)=>{
  try{
    const s=input.trim();
    const rm=s.match(/^([A-G][#b]?)/);if(!rm)return null;
    const root=rm[1];
    const rest=s.slice(root.length).toLowerCase().replace(/\s/g,"");
    let q="maj";
    if(rest.includes("m7b5")||rest.includes("ø"))q="m7b5";
    else if(rest.includes("dim7")||rest.includes("°7"))q="dim7";
    else if(rest.includes("dim")||rest.includes("°"))q="dim";
    else if(rest.includes("maj7")||rest.includes("△7")||rest.includes("∆7"))q="maj7";
    else if(rest.includes("maj9")||rest.includes("△9"))q="maj9";
    else if(rest.includes("maj"))q="maj7";
    else if(rest.includes("m9"))q="min9";
    else if(rest.includes("m7"))q="min7";
    else if(rest.includes("7b9"))q="7b9";
    else if(rest.includes("7#9"))q="7#9";
    else if(rest.includes("7alt")||rest.includes("alt"))q="7alt";
    else if(rest.includes("13"))q="13";
    else if(rest.includes("9"))q="9";
    else if(rest.includes("7"))q="7";
    else if(rest.includes("aug")||rest.includes("+"))q="aug";
    else if(rest.includes("sus2"))q="sus2";
    else if(rest.includes("sus4")||rest.includes("sus"))q="sus4";
    else if(rest.includes("m"))q="min";
    const formula=FORMULAS[q]||FORMULAS["maj"];
    const notes=formula.intervals.map(i=>fromRoot(root,i%12));
    return{root,quality:q,notes,formula,raw:s};
  }catch(e){return null;}
};

const computeProg=(chords)=>{
  const MINOR_SCALE=[0,2,3,5,7,8,10];
  // Detectar menor: cadencia ii m7b5->V7->i, reposo en menor, V7->acorde menor
  let isMinor=false;
  for(let i=0;i<chords.length-1;i++){
    const cur=chords[i],nxt=chords[i+1];
    if(cur.quality==="m7b5"&&nxt.quality==="7"){
      const expV=CHROMATIC[(noteIdx(cur.root)+2+120)%12];
      if(nxt.root===expV||enh(nxt.root)===expV) isMinor=true;
    }
    if((nxt.quality==="min"||nxt.quality==="min7")&&cur.quality==="7"){
      const expI=CHROMATIC[(noteIdx(cur.root)+5+120)%12];
      if(nxt.root===expI||enh(nxt.root)===expI) isMinor=true;
    }
  }
  const lastQ=chords[chords.length-1]?.quality;
  if(lastQ==="min"||lastQ==="min7") isMinor=true;

  const scores={};
  if(isMinor){
    COF.forEach(({minor})=>{
      const minRoot=minor.replace("m","");
      const ri=noteIdx(minRoot);if(ri===-1)return;
      let sc=0;const scale=MINOR_SCALE.map(i=>CHROMATIC[(ri+i+120)%12]);
      chords.forEach(({root})=>{if(scale.includes(root)||scale.includes(enh(root)))sc+=2;});
      scores[minRoot]=sc;
    });
  } else {
    COF.forEach(({note})=>{
      const ri=noteIdx(note);if(ri===-1)return;
      let sc=0;const scale=MSI.map(i=>CHROMATIC[(ri+i)%12]);
      chords.forEach(({root})=>{if(scale.includes(root))sc+=2;if(scale.includes(enh(root)))sc+=2;});
      scores[note]=sc;
    });
  }
  const key=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
  const ki=noteIdx(key);
  if(isMinor){
    const sn=MINOR_SCALE.map(i=>CHROMATIC[(ki+i+120)%12]);
    return chords.map(({root,quality,raw,notes})=>{
      const ri=sn.indexOf(root)!==-1?sn.indexOf(root):sn.indexOf(enh(root));
      const di=ri>=0?MODE_BY_DEGREE_MINOR[ri]:null;
      return{raw,root,quality,notes,degree:di?di.degree:"?",key,isMinor:true,fn:getFns(quality)[0]};
    });
  } else {
    const sn=MSI.map(i=>CHROMATIC[(ki+i)%12]);
    return chords.map(({root,quality,raw,notes})=>{
      const ri=sn.indexOf(root)!==-1?sn.indexOf(root):sn.indexOf(enh(root));
      const di=ri>=0?MODE_BY_DEGREE[ri]:null;
      return{raw,root,quality,notes,degree:di?di.degree:"?",key,isMinor:false,fn:getFns(quality)[0]};
    });
  }
};

// ─── BIBLIOTECA DE PROGRESIONES ───────────────────────────────────────────────
const BIBLIOTECA=[
  {genero:"Tango",color:"#f472b6",icon:"💃",items:[
    {titulo:"ii–V–i tango oscuro",              prog:"Bm7b5 – E7b9 – Am",         nota:"La cadencia menor por excelencia del tango. La b9 crea tensión máxima."},
    {titulo:"Cadencia andaluza",                prog:"Am – G – F – E7",            nota:"Base del tango flamenco. El E7 con frigio dominante."},
    {titulo:"Turnaround Piazzolla",             prog:"Amaj7 – F#m7 – Bm7b5 – E7alt",nota:"Típico de Piazzolla: mayor 7ª → relativa → semidism. → dominante alterado."},
    {titulo:"Tango en La menor",                prog:"Am – Dm – E7 – Am – Fmaj7 – Bm7b5 – E7 – Am",nota:"Progresión completa de tango tradicional."},
    {titulo:"Cadena de dominantes",             prog:"E7 – A7 – D7 – G7 – Cmaj7", nota:"Cada acorde resuelve al siguiente por 5ª. Muy usado como puente."},
    {titulo:"Resolución al menor (ii-V-i)",     prog:"Dm7b5 – G7b9 – Cm",          nota:"ii-V-i en do menor. El G7b9 con frigio dominante."},
    {titulo:"La Cumparsita",                    prog:"Am – E7 – Am – Dm – E7 – Am",nota:"Cadencia menor del tango más famoso del mundo."},
    {titulo:"Milonga criolla",                  prog:"D – A7 – D – G – D – A7 – D",nota:"Base armónica de la milonga campera. Simple y efectiva."},
    {titulo:"Intercambio modal tanguero",       prog:"Am – Amaj7 – Am7 – D9 – Bm7b5 – E7 – Am",nota:"Línea cromática descendente en la 7ª. Muy expresiva."},
  ]},
  {genero:"Jazz",color:"#60a5fa",icon:"🎷",items:[
    {titulo:"ii–V–I en Do mayor",               prog:"Dm7 – G7 – Cmaj7",           nota:"La cadencia más importante del jazz. Base de toda improvisación."},
    {titulo:"Turnaround I–VI–II–V",             prog:"Cmaj7 – A7 – Dm7 – G7",      nota:"Turnaround clásico. El A7 es dominante secundario de Dm7."},
    {titulo:"Blues en Fa",                      prog:"F7 – Bb7 – F7 – C7 – Bb7 – F7",nota:"Blues de 12 compases simplificado. Todos los acordes son dominantes."},
    {titulo:"Sustitución tritonal",             prog:"Dm7 – Db7 – Cmaj7",           nota:"Db7 reemplaza a G7 (a tritono). El bajo baja cromáticamente."},
    {titulo:"Rhythm Changes (sección A)",       prog:"Bbmaj7 – G7 – Cm7 – F7 – Dm7 – G7 – Cm7 – F7",nota:"Base de 'I Got Rhythm'. Estándar de bebop."},
    {titulo:"Giant Steps (Coltrane)",           prog:"Bmaj7 – D7 – Gmaj7 – Bb7 – Ebmaj7",nota:"Ciclo de 3ras mayores. Modulación simétrica de Coltrane."},
    {titulo:"So What (modal)",                  prog:"Dm7 – Ebm7",                  nota:"Modal jazz. Un acorde por 16 compases, luego sube un semitono."},
    {titulo:"Autumn Leaves",                    prog:"Cm7 – F7 – Bbmaj7 – Am7b5 – D7 – Gm",nota:"Clásico del jazz. Dos ii-V-I (mayor y menor) encadenados."},
    {titulo:"All The Things You Are",           prog:"Fm7 – Bbm7 – Eb7 – Abmaj7 – Dbmaj7 – G7 – Cmaj7",nota:"Modulaciones por 3ras. Estándar armónicamente complejo."},
    {titulo:"Solar (Miles Davis)",              prog:"Cm – Gm7 – C7 – Fmaj7 – Fm7 – Bb7 – Ebmaj7 – Dm7b5 – G7",nota:"Forma de 12 compases con dos centros tonales."},
  ]},
  {genero:"Choro / MPB",color:"#34d399",icon:"🎸",items:[
    {titulo:"Cadência do choro",                prog:"Am – E7 – Am – Dm – Am – E7 – Am",nota:"Cadência menor clásica do choro brasileiro."},
    {titulo:"ii–V–I brasileiro (Jobim)",        prog:"Dm7 – G7 – Cmaj7 – A7 – Dm7 – G7 – Cmaj7",nota:"El ii-V-I de Jobim tiene un A7 intercalado que da movimiento."},
    {titulo:"Bossa Nova clásica",               prog:"Cmaj7 – Dm7 – G7 – Em7 – A7 – Dm7 – G7",nota:"Movimiento típico de la bossa: tónica → subdominante → dominante."},
    {titulo:"Garota de Ipanema",                prog:"Fmaj7 – G7 – Gm7 – Gb7 – Fmaj7",nota:"El Gb7 es sustituto tritonal del C7. Movimiento cromático descendente."},
    {titulo:"Wave (Tom Jobim)",                 prog:"Dmaj7 – Bm7 – Em7 – A7 – D9 – Db7 – Dmaj7",nota:"Db7 como SubV7 resolviendo a la tónica."},
    {titulo:"Progressão cromática",             prog:"Cmaj7 – B7 – Bbmaj7 – A7 – Abmaj7 – G7 – Cmaj7",nota:"Descenso cromático de dominantes secundarios."},
    {titulo:"IV menor (intercambio modal)",     prog:"Cmaj7 – Fm7 – Bb7 – Cmaj7 – Am7 – D7 – Dm7 – G7",nota:"El Fm7-Bb7 viene del modo paralelo menor. Color oscuro inesperado."},
    {titulo:"Choro moderno",                    prog:"Am – D7 – Gmaj7 – Cmaj7 – Fmaj7 – Bm7b5 – E7 – Am",nota:"Ciclo de quintas descendente con ii-V-i al final."},
  ]},
  {genero:"Latinoamérica",color:"#fb923c",icon:"🌎",items:[
    {titulo:"Son montuno (Cuba)",               prog:"Cm – G7 – Cm – Fm – Cm – G7 – Cm",nota:"Base del son cubano. El G7 con frigio dominante sobre Cm."},
    {titulo:"Guajira (modo frigio-mayor)",      prog:"E – F – E – Am – E – Am",    nota:"El E mayor sobre contexto menor crea el sonido flamenco-cubano."},
    {titulo:"Bolero romántico",                 prog:"Cmaj7 – Am7 – Dm7 – G7 – Em7 – A7 – Dm7 – G7 – Cmaj7",nota:"El I-VI-II-V extendido del bolero latinoamericano."},
    {titulo:"Salsa / Mambo",                   prog:"Dm7 – G7 – Cmaj7 – Fm7 – Bb7 – Ebmaj7",nota:"ii-V-I que modula a la subdominante menor. Muy usado en salsa."},
    {titulo:"Vals peruano",                     prog:"Am – E7 – Am – Dm – Am – E7 – Am – C – G – Am",nota:"Cadencia menor con apertura a la relativa mayor."},
    {titulo:"Joropo venezolano",                prog:"D – A – D – G – D – A7 – D", nota:"Armonía mayor simple y bailable. Base del joropo llanero."},
    {titulo:"Candombe (Uruguay)",               prog:"Dm – A7 – Dm – Gm – Dm – A7 – Dm",nota:"Cadencia menor del candombe. Grave, oscura y rítmica."},
    {titulo:"Cueca chilena",                    prog:"D – G – A7 – D – Bm – G – A7 – D",nota:"Base armónica de la cueca. I-IV-V-I con paso por la relativa menor."},
    {titulo:"Cumbia armónica",                  prog:"Am – Dm – Am – E7 – Am",     nota:"La cumbia en su forma más simple. i-iv-i-V7-i."},
    {titulo:"Samba moderna",                    prog:"Dm7 – G7 – Cmaj7 – Fm7 – Bb7 – Ebmaj7 – Am7 – D7",nota:"Samba con modulaciones por 3ras. Color brasileira avanzado."},
  ]},
];

// ─── BANDONEÓN — layout leído de imagen ───────────────────────────────────────
const BLO=[ // Izquierda Abriendo
  [{n:"SOL#",o:2},{n:"SOL",o:3},{n:"LA#",o:3},{n:"DO#",o:4},{n:"FA",o:4},{n:"FA",o:4},{n:"SOL",o:4}],
  [{n:"LA",o:2},{n:"LA",o:3},{n:"RE#",o:3},{n:"DO",o:4},{n:"MI",o:4},{n:"LA#",o:4},{n:"FA",o:4}],
  [{n:"MI",o:2},{n:"RE",o:3},{n:"SI",o:3},{n:"RE",o:3},{n:"FA#",o:4},{n:"DO#",o:4}],
  [{n:"SOL#",o:2},{n:"SOL",o:3},{n:"LA",o:3},{n:"RE#",o:3},{n:"FA#",o:3},{n:"DO#",o:3},{n:"DO",o:4}],
  [{n:"SI",o:2},{n:"MI",o:3},{n:"SOL",o:3},{n:"RE",o:3},{n:"RE#",o:2}],
  [{n:"RE",o:2},{n:"SI",o:2},{n:"MI",o:3}],
];
const BLC=[ // Izquierda Cerrando
  [{n:"SOL#",o:2},{n:"LA#",o:3},{n:"RE#",o:3},{n:"DO#",o:3},{n:"RE#",o:3},{n:"SOL",o:4}],
  [{n:"RE",o:2},{n:"RE",o:3},{n:"LA#",o:3},{n:"SI",o:3},{n:"DO",o:4},{n:"DO",o:4},{n:"FA#",o:4}],
  [{n:"SOL",o:2},{n:"SOL",o:3},{n:"SI",o:3},{n:"RE",o:4},{n:"FA",o:4},{n:"DO#",o:4}],
  [{n:"MI",o:2},{n:"LA",o:2},{n:"LA",o:3},{n:"DO#",o:3},{n:"SI",o:3},{n:"FA#",o:4},{n:"SI",o:4}],
  [{n:"LA",o:2},{n:"FA#",o:2},{n:"SOL#",o:2},{n:"SI",o:2}],
  [{n:"MI",o:2},{n:"MI",o:3},{n:"FA",o:3}],
];
const BRO=[ // Derecha Abriendo
  [{n:"SI",o:4},{n:"SOL#",o:4},{n:"SOL",o:5},{n:"SOL",o:4},{n:"SOL",o:5},{n:"FA",o:5},{n:"FA",o:5}],
  [{n:"DO",o:5},{n:"DO#",o:5},{n:"LA",o:4},{n:"RE",o:5},{n:"FA#",o:5},{n:"LA#",o:5},{n:"DO",o:5},{n:"RE#",o:5},{n:"RE",o:5}],
  [{n:"SI",o:4},{n:"MI",o:4},{n:"DO#",o:5},{n:"FA#",o:5},{n:"LA",o:5},{n:"DO",o:6},{n:"RE#",o:6}],
  [{n:"FA",o:4},{n:"SOL#",o:4},{n:"RE#",o:4},{n:"FA#",o:4},{n:"LA",o:4},{n:"RE#",o:5},{n:"FA#",o:5}],
  [{n:"LA",o:4},{n:"MI",o:4},{n:"FA",o:4},{n:"DO",o:5},{n:"RE",o:5},{n:"MI",o:5}],
  [{n:"SOL",o:4},{n:"SI",o:4},{n:"LA#",o:4},{n:"SOL",o:5}],
];
const BRC=[ // Derecha Cerrando
  [{n:"LA",o:4},{n:"SOL#",o:4},{n:"FA#",o:5},{n:"FA",o:5},{n:"DO",o:6},{n:"FA",o:5},{n:"RE#",o:6}],
  [{n:"RE",o:5},{n:"DO#",o:5},{n:"SOL#",o:5},{n:"LA#",o:5},{n:"DO",o:6},{n:"RE#",o:5},{n:"RE",o:6}],
  [{n:"FA#",o:4},{n:"FA#",o:4},{n:"FA#",o:5},{n:"SOL",o:5},{n:"LA",o:5},{n:"RE",o:6}],
  [{n:"SOL#",o:5},{n:"MI",o:5},{n:"RE#",o:5},{n:"FA#",o:5},{n:"LA#",o:5},{n:"SOL#",o:5}],
  [{n:"SOL#",o:4},{n:"MI",o:4},{n:"LA",o:4},{n:"DO#",o:5},{n:"MI",o:5},{n:"SI",o:5}],
  [{n:"SOL",o:4},{n:"LA#",o:4},{n:"SI",o:4},{n:"DO#",o:6}],
];
const OCT_C={
  2:{bg:"#7c3aed",border:"#6d28d9"},
  3:{bg:"#ea580c",border:"#c2410c"},
  4:{bg:"#059669",border:"#047857"},
  5:{bg:"#db2777",border:"#be185d"},
  6:{bg:"#2563eb",border:"#1d4ed8"},
};

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

// Nota con punto de color — sin texto del color escrito
const Nota=({note,size="md"})=>{
  const color=nc(note);
  const sz={sm:"px-2 py-0.5 text-xs",md:"px-3 py-1 text-sm",lg:"px-4 py-1.5 text-base"};
  return(
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold border-2 cursor-pointer ${sz[size]}`}
      style={{backgroundColor:color+"18",borderColor:color,color}}
      onClick={()=>playTone(note,4,0.7)}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:color}}/>
      {note}
    </span>
  );
};

// Piano multi-octava — 3 octavas (C3-B5)
// Colores: cada tecla activa usa su color tonal propio
// Diferencia de mano: barra superior azul=MI, barra color tonal=MD
const Piano=({leftVoice=[],rightVoice=[]})=>{
  const WHITE=["C","D","E","F","G","A","B"];
  const BLACK=[{n:"C#",a:0},{n:"D#",a:1},{n:"F#",a:3},{n:"G#",a:4},{n:"A#",a:5}];
  const OCTS=[3,4,5];
  const ww=30,wh=115,bw=18,bh=71;
  const W=WHITE.length*ww*OCTS.length;

  const key=(note,oct,x,w,h,isBlack)=>{
    const L=leftVoice.find(v=>v.note===note&&v.oct===oct);
    const R=rightVoice.find(v=>v.note===note&&v.oct===oct);
    const tonal=nc(note);
    const active=L||R;
    // fondo: color tonal suave si activo, clásico si no
    const fill=active
      ? tonal+(isBlack?"55":"28")
      : (isBlack?"#1c1a18":"#f7f5ef");
    const stroke=L?"#4488ff":R?tonal:(isBlack?"#444":"#bbb");
    const sw=active?2.5:0.8;
    const dotY=isBlack?h-15:h-25;
    const lblY=isBlack?h-6:h-10;
    return(
      <g key={note+oct} style={{cursor:"pointer"}} onClick={()=>playTone(note,oct,0.7)}>
        <rect x={x+0.5} y={0} width={w-1} height={h} rx={isBlack?2:3}
          fill={fill} stroke={stroke} strokeWidth={sw}/>
        {/* Barra superior: identifica la mano */}
        {L&&<rect x={x+1} y={0} width={w-2} height={4} rx={1} fill="#4488ff"/>}
        {R&&<rect x={x+1} y={0} width={w-2} height={4} rx={1} fill={tonal}/>}
        {/* Punto de color tonal */}
        {active&&<circle cx={x+w/2} cy={dotY} r={isBlack?3.5:4.5} fill={tonal}/>}
        {/* Nota */}
        <text x={x+w/2} y={lblY} textAnchor="middle" fontSize={isBlack?5.5:7}
          fill={active?(isBlack?"#eee":"#222"):(isBlack?"#555":"#ccc")}
          fontFamily="serif" fontWeight={active?"bold":"normal"}>{note}</text>
        {/* Rol */}
        {active&&!isBlack&&(L||R).role&&(
          <text x={x+w/2} y={h-30} textAnchor="middle" fontSize="5"
            fill={tonal} fontFamily="sans-serif">
            {(L||R).role.split(" ")[0]}
          </text>
        )}
      </g>
    );
  };

  return(
    <div>
      {/* Labels octava */}
      <div className="flex mb-1">
        {OCTS.map(o=>(
          <div key={o} style={{width:WHITE.length*ww+"px",fontSize:"9px",color:"#666",textAlign:"center"}}>
            Oct.{o}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${wh}`} style={{minWidth:W+"px",height:"125px",display:"block"}}>
          {/* Separadores */}
          {OCTS.map((o,oi)=>oi>0&&(
            <line key={"s"+o} x1={oi*WHITE.length*ww} y1={0}
              x2={oi*WHITE.length*ww} y2={wh} stroke="#666" strokeWidth="1"/>
          ))}
          {/* Blancas */}
          {OCTS.map((o,oi)=>WHITE.map((n,i)=>
            key(n,o,oi*WHITE.length*ww+i*ww,ww,wh,false)
          ))}
          {/* Negras */}
          {OCTS.map((o,oi)=>BLACK.map(({n,a})=>
            key(n,o,oi*WHITE.length*ww+(a+1)*ww-bw/2,bw,bh,true)
          ))}
        </svg>
      </div>
      {/* Leyenda */}
      <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-2 rounded" style={{background:"#4488ff"}}/>
          M.izquierda — tónica (bajo, oct.2)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-2 rounded" style={{background:"linear-gradient(90deg,#28A03C,#D22828,#7828B4)"}}/>
          M.derecha — 3ª · 7ª · extensiones (oct.4-5)
        </span>
      </div>
      {/* Detalle de voces */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-lg p-2.5 border" style={{background:"#07101f",borderColor:"#1a3060"}}>
          <p className="text-xs font-bold mb-2" style={{color:"#4488ff"}}>← Mano izquierda</p>
          <div className="space-y-1">
            {leftVoice.map((v,i)=>(
              <div key={i} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:nc(v.note)}}/>
                <span className="font-bold text-sm" style={{color:nc(v.note)}}>{v.note}</span>
                <span className="text-gray-600 text-xs">oct.{v.oct}</span>
                <span className="text-gray-500 text-xs ml-auto">{v.role}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg p-2.5 border" style={{background:"#071507",borderColor:"#1a4a28"}}>
          <p className="text-xs font-bold mb-2 text-green-400">Mano derecha →</p>
          <div className="space-y-1">
            {rightVoice.map((v,i)=>(
              <div key={i} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:nc(v.note)}}/>
                <span className="font-bold text-sm" style={{color:nc(v.note)}}>{v.note}</span>
                <span className="text-gray-600 text-xs">oct.{v.oct}</span>
                <span className="text-gray-500 text-xs ml-auto">{v.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Card de función armónica desplegable
const FnCard=({fn,root,isOpen,onToggle})=>{
  const scale=useMemo(()=>fn.modeIvs?buildScale(root,fn.modeIvs):[],[root,fn.modeIvs]);
  const twn=useMemo(()=>(fn.tensions||[]).map(t=>({label:t,note:tNote(root,t)})),[root,fn.tensions]);
  const awn=useMemo(()=>(fn.avoid||[]).map(t=>({label:t,note:tNote(root,t)})),[root,fn.avoid]);
  return(
    <div className="rounded-xl border overflow-hidden" style={{borderColor:isOpen?"#4466cc":"#1e2030"}}>
      <button className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
        style={{background:isOpen?"#111d36":"#0c0c1c"}} onClick={onToggle}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
            style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>{fn.degree}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-blue-200 truncate">{fn.fn}</p>
            <p className="text-xs text-gray-500 italic truncate">{fn.key}</p>
          </div>
        </div>
        <span className="text-gray-600 text-xs flex-shrink-0">{isOpen?"▲":"▼"}</span>
      </button>
      {isOpen&&(
        <div className="px-4 pb-4 pt-3 space-y-3" style={{background:"#09091a"}}>
          {/* Modo + Escala */}
          <div className="rounded-lg p-3 border border-gray-800" style={{background:"#0c0f20"}}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-indigo-300 font-semibold">Modo:</span>
              <span className="text-sm font-bold text-white">{fn.mode}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {scale.map((n,i)=>(
                <button key={i} onClick={()=>playTone(n,4,0.5)}
                  className="flex flex-col items-center px-2 py-1.5 rounded-lg border text-sm font-bold"
                  style={{backgroundColor:nc(n)+"22",borderColor:nc(n)+"66",color:nc(n),minWidth:"34px"}}>
                  <span>{n}</span>
                  <span style={{fontSize:"8px",opacity:0.5}}>{i+1}°</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 font-mono">{scale.join(" — ")}</p>
          </div>
          {/* Tensiones y evitar */}
          <div className="grid grid-cols-2 gap-2">
            {twn.length>0&&(
              <div className="rounded-lg p-3 border border-green-900" style={{background:"#070f07"}}>
                <p className="text-xs font-bold text-green-400 mb-2">✅ Tensiones</p>
                <div className="space-y-1.5">
                  {twn.map(({label,note},i)=>{
                    const color=note?nc(note):"#888";
                    return(
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-green-300 w-7">{label}</span>
                        <span className="text-gray-600 text-xs">→</span>
                        {note?<button onClick={()=>playTone(note,4,0.5)}
                          className="px-2 py-0.5 rounded-full text-sm font-bold border"
                          style={{backgroundColor:color+"22",borderColor:color,color}}>{note}</button>
                        :<span className="text-gray-600 text-xs italic">varía</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {awn.length>0&&(
              <div className="rounded-lg p-3 border border-red-900" style={{background:"#0f0707"}}>
                <p className="text-xs font-bold text-red-400 mb-2">⚠️ Evitar</p>
                <div className="space-y-1.5">
                  {awn.map(({label,note},i)=>{
                    const color=note?nc(note):"#888";
                    return(
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-red-400 w-7">{label}</span>
                        <span className="text-gray-600 text-xs">→</span>
                        {note&&<span className="px-2 py-0.5 rounded-full text-sm font-bold border"
                          style={{backgroundColor:color+"22",borderColor:color,color}}>{note}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {fn.resolutions?.length>0&&(
            <div className="rounded-lg p-2.5 border border-yellow-900" style={{background:"#0f0e07"}}>
              <span className="text-xs text-yellow-400 font-semibold">➜ </span>
              <span className="text-sm text-yellow-200 font-mono">{fn.resolutions.join(" · ")}</span>
            </div>
          )}
          <div className="rounded-lg p-3 border border-gray-800" style={{background:"#08080f"}}>
            <p className="text-xs text-gray-500 mb-1">💡 Por qué funciona</p>
            <p className="text-sm text-gray-300 leading-relaxed">{fn.why}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Tabla comparativa
const TablaComparativa=({fns,root})=>(
  <div className="overflow-x-auto rounded-xl border border-gray-800" style={{background:"#080a14"}}>
    <table className="w-full text-xs" style={{minWidth:"550px"}}>
      <thead>
        <tr style={{background:"#0e1228",borderBottom:"1px solid #2a3a5a"}}>
          {["Grado","Función","Modo","Escala","Tensiones","Evitar"].map(h=>(
            <th key={h} className="text-left px-3 py-2 text-gray-500 uppercase tracking-widest font-normal text-xs">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {fns.map((f,i)=>{
          const scale=f.modeIvs?buildScale(root,f.modeIvs):[];
          const twn=(f.tensions||[]).map(t=>{const n=tNote(root,t);return n?`${t}→${n}`:t;});
          const awn=(f.avoid||[]).map(t=>{const n=tNote(root,t);return n?`${t}→${n}`:t;});
          return(
            <tr key={i} style={{borderBottom:"1px solid #111520",background:i%2===0?"transparent":"#0a0c18"}}>
              <td className="px-3 py-2">
                <span className="font-mono font-bold px-1.5 py-0.5 rounded text-xs"
                  style={{background:"#0d1520",color:"#88aaff"}}>{f.degree}</span>
              </td>
              <td className="px-3 py-2">
                <p className="font-semibold text-blue-200">{f.fn}</p>
                <p className="text-gray-500 italic">{f.key}</p>
              </td>
              <td className="px-3 py-2 text-indigo-300 whitespace-nowrap">{f.mode}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {scale.map((n,j)=>(
                    <button key={j} onClick={()=>playTone(n,4,0.5)}
                      className="px-1.5 py-0.5 rounded border font-bold"
                      style={{backgroundColor:nc(n)+"22",borderColor:nc(n)+"55",color:nc(n)}}>
                      {n}
                    </button>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {twn.map((t,j)=>(
                    <span key={j} className="px-1.5 py-0.5 rounded font-mono"
                      style={{background:"#0a1f0a",borderColor:"#2d5c2d",color:"#6dbd6d",border:"1px solid #2d5c2d"}}>{t}</span>
                  ))}
                  {!twn.length&&<span className="text-gray-700">—</span>}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {awn.map((t,j)=>(
                    <span key={j} className="px-1.5 py-0.5 rounded font-mono"
                      style={{background:"#1f0a0a",color:"#bd6d6d",border:"1px solid #5c2d2d"}}>{t}</span>
                  ))}
                  {!awn.length&&<span className="text-gray-700">—</span>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// Círculo de quintas interactivo completo
const Circulo=({highlighted=[],onSelect=null,selectedKey=null})=>{
  const cx=180,cy=180,R=140,Rm=96,Ri=58;
  const scaleData=useMemo(()=>{
    if(!selectedKey) return null;
    const ri=noteIdx(selectedKey);if(ri===-1)return null;
    const notes=MSI.map(i=>CHROMATIC[(ri+i)%12]);
    return notes.map((n,i)=>({
      note:n,degree:DN[i],quality:DQ[i],
      mode:MODE_BY_DEGREE[i],
      tensions:(MODE_BY_DEGREE[i].tensions||[]).map(t=>({label:t,note:tNote(n,t)})),
    }));
  },[selectedKey]);

  return(
    <div>
      <svg viewBox="0 0 360 360" className="w-full max-w-sm mx-auto select-none">
        <defs>
          <radialGradient id="bgCOF" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#1a1a2e"/>
            <stop offset="100%" stopColor="#0a0a16"/>
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={175} fill="url(#bgCOF)" stroke="#2a2a3a" strokeWidth="1"/>

        {/* Anillo externo: mayores */}
        {COF.map(({note,deg})=>{
          const angle=(deg-90)*(Math.PI/180);
          const ox=cx+R*Math.cos(angle),oy=cy+R*Math.sin(angle);
          const isSel=selectedKey===note;
          const isHi=highlighted.includes(note)||highlighted.includes(enh(note));
          const color=nc(note);
          return(
            <g key={"M"+note} style={{cursor:onSelect?"pointer":"default"}}
              onClick={()=>onSelect&&onSelect(isSel?null:note)}>
              <circle cx={ox} cy={oy} r={isSel?22:19}
                fill={isSel?color:isHi?color+"cc":"#1e1e38"}
                stroke={isSel||isHi?color:"#3a3a5a"}
                strokeWidth={isSel?3:isHi?2:1}
                opacity={isSel||isHi?1:0.7}/>
              <text x={ox} y={oy+1} textAnchor="middle" dominantBaseline="middle"
                fontSize={isSel?11:10} fontWeight="bold"
                fill={isSel||isHi?"#fff":"#aaa"} fontFamily="serif">{note}</text>
            </g>
          );
        })}

        {/* Anillo medio: menores */}
        {COF.map(({note,minor,deg})=>{
          const angle=(deg-90)*(Math.PI/180);
          const mx=cx+Rm*Math.cos(angle),my=cy+Rm*Math.sin(angle);
          const isHi=highlighted.includes(note);
          const color=nc(note);
          return(
            <g key={"m"+note}>
              <circle cx={mx} cy={my} r={13}
                fill={isHi?color+"22":"transparent"}
                stroke={isHi?color+"88":"#2a2a4a"} strokeWidth="1"/>
              <text x={mx} y={my+1} textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5" fill={isHi?"#ccc":"#555"} fontFamily="serif">{minor}</text>
            </g>
          );
        })}

        {/* Anillo interior: grados de la escala seleccionada */}
        {selectedKey&&scaleData&&scaleData.map((sd,i)=>{
          const angle=(i*(360/7)-90)*(Math.PI/180);
          const ix=cx+Ri*Math.cos(angle),iy=cy+Ri*Math.sin(angle);
          const color=nc(sd.note);
          return(
            <g key={"g"+i} style={{cursor:"pointer"}} onClick={()=>playTone(sd.note,4,0.6)}>
              <circle cx={ix} cy={iy} r={15} fill={color+"33"} stroke={color} strokeWidth="1.5"/>
              <text x={ix} y={iy-3} textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fontWeight="bold" fill={color} fontFamily="serif">{sd.degree}</text>
              <text x={ix} y={iy+5} textAnchor="middle" dominantBaseline="middle"
                fontSize="6.5" fill={color+"cc"} fontFamily="serif">{sd.note}</text>
            </g>
          );
        })}

        {/* Centro */}
        <circle cx={cx} cy={cy} r={42} fill="#0a0a16" stroke="#1a1a2a" strokeWidth="1"/>
        {selectedKey?(
          <>
            <text x={cx} y={cy-12} textAnchor="middle" fontSize="14" fontWeight="bold"
              fill={nc(selectedKey)} fontFamily="serif">{selectedKey}</text>
            <text x={cx} y={cy+2} textAnchor="middle" fontSize="9"
              fill="#888" fontFamily="serif">Mayor</text>
            <text x={cx} y={cy+14} textAnchor="middle" fontSize="7"
              fill="#555" fontFamily="serif">{COF.find(c=>c.note===selectedKey)?.sig}</text>
          </>
        ):(
          <>
            <text x={cx} y={cy-6}  textAnchor="middle" fontSize="9" fill="#444" fontFamily="serif">Círculo</text>
            <text x={cx} y={cy+6}  textAnchor="middle" fontSize="9" fill="#444" fontFamily="serif">de Quintas</text>
          </>
        )}
      </svg>

      {/* Panel interactivo cuando hay tonalidad seleccionada */}
      {selectedKey&&scaleData&&(
        <div className="mt-4 space-y-3">
          {/* Notas de la escala */}
          <div className="rounded-xl p-3 border border-gray-800" style={{background:"#0d0f1e"}}>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              Escala de {selectedKey} Mayor — {COF.find(c=>c.note===selectedKey)?.sig}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {scaleData.map((sd,i)=>(
                <button key={i} onClick={()=>playTone(sd.note,4,0.6)}
                  className="flex flex-col items-center px-2.5 py-2 rounded-xl border font-bold"
                  style={{backgroundColor:nc(sd.note)+"18",borderColor:nc(sd.note)+"55",
                    color:nc(sd.note),minWidth:"36px"}}>
                  <span className="text-sm">{sd.note}</span>
                  <span style={{fontSize:"9px",opacity:0.6}}>{sd.degree}</span>
                </button>
              ))}
            </div>
            <button onClick={()=>playChord(scaleData.map(s=>s.note))}
              className="text-xs px-3 py-1 rounded border mt-1"
              style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>
              ▶ Escuchar escala
            </button>
          </div>

          {/* Tabla completa: grados, modos, tensiones */}
          <div className="rounded-xl border border-gray-800 overflow-hidden" style={{background:"#080a14"}}>
            <p className="text-xs text-gray-500 uppercase tracking-widest px-4 py-2 border-b border-gray-800">
              Grados · Modos · Tensiones disponibles
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{minWidth:"480px"}}>
                <thead>
                  <tr style={{background:"#0e1228",borderBottom:"1px solid #2a3a5a"}}>
                    {["Gr.","Nota","Acorde","Modo","Tensiones","Evitar"].map(h=>(
                      <th key={h} className="text-left px-3 py-2 text-gray-600 font-normal uppercase tracking-widest text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scaleData.map((sd,i)=>{
                    const color=nc(sd.note);
                    const twn=sd.tensions.map(({label,note})=>note?`${label}→${note}`:label);
                    const awn=(sd.mode.avoid||[]).map(t=>{const n=tNote(sd.note,t);return n?`${t}→${n}`:t;});
                    return(
                      <tr key={i} style={{borderBottom:"1px solid #111520",background:i%2===0?"transparent":"#0a0c18"}}>
                        <td className="px-3 py-2">
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded text-xs"
                            style={{background:color+"22",color}}>{sd.degree}</span>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={()=>playTone(sd.note,4,0.6)}
                            className="font-bold text-sm" style={{color}}>{sd.note}</button>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={()=>{const c=parseChord(`${sd.note}${sd.quality}`);if(c)playChord(c.notes);}}
                            className="font-bold hover:opacity-75" style={{color,fontSize:"12px"}}>
                            {sd.note}{sd.quality} ▶
                          </button>
                        </td>
                        <td className="px-3 py-2 text-indigo-300 whitespace-nowrap">{sd.mode.name}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {twn.map((t,j)=>(
                              <span key={j} className="px-1.5 py-0.5 rounded font-mono whitespace-nowrap"
                                style={{background:"#0a1f0a",color:"#6dbd6d",border:"1px solid #2d5c2d"}}>{t}</span>
                            ))}
                            {!twn.length&&<span className="text-gray-700">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {awn.map((t,j)=>(
                              <span key={j} className="px-1.5 py-0.5 rounded font-mono whitespace-nowrap"
                                style={{background:"#1f0a0a",color:"#bd6d6d",border:"1px solid #5c2d2d"}}>{t}</span>
                            ))}
                            {!awn.length&&<span className="text-gray-700">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acordes diatónicos escuchables */}
          <div className="rounded-xl p-3 border border-gray-800" style={{background:"#0d0f1e"}}>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Acordes diatónicos — escuchá cada uno</p>
            <div className="flex flex-wrap gap-2">
              {scaleData.map((sd,i)=>{
                const color=nc(sd.note);
                return(
                  <button key={i}
                    onClick={()=>{const c=parseChord(`${sd.note}${sd.quality}`);if(c)playChord(c.notes);}}
                    className="flex flex-col items-center px-3 py-2 rounded-xl border font-bold"
                    style={{backgroundColor:color+"18",borderColor:color+"66",color,minWidth:"44px"}}>
                    <span className="text-xs opacity-60">{sd.degree}</span>
                    <span className="text-sm">{sd.note}</span>
                    <span className="text-xs opacity-75">{sd.quality}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tonalidades vecinas para navegación */}
          <div className="rounded-xl p-3 border border-gray-800" style={{background:"#0d0f1e"}}>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Tonalidades vecinas</p>
            <div className="flex gap-2 flex-wrap">
              {[
                {label:"← Subdominante",note:COF[(COF.findIndex(c=>c.note===selectedKey)+11)%12]?.note},
                {label:"Dominante →",note:COF[(COF.findIndex(c=>c.note===selectedKey)+1)%12]?.note},
                {label:"Relativa menor",note:COF.find(c=>c.note===selectedKey)?.minor?.replace("m","")},
              ].filter(v=>v.note).map((v,i)=>{
                const color=nc(v.note);
                return(
                  <button key={i} onClick={()=>onSelect&&onSelect(v.note)}
                    className="flex flex-col items-center px-3 py-2 rounded-xl border text-xs"
                    style={{backgroundColor:color+"18",borderColor:color+"55",color}}>
                    <span className="opacity-60 mb-0.5">{v.label}</span>
                    <span className="font-bold text-sm">{v.note}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={()=>onSelect&&onSelect(null)}
            className="text-xs text-gray-600 hover:text-gray-400">✕ Cerrar tonalidad</button>
        </div>
      )}
    </div>
  );
};

// Botón del bandoneón
const BBtn=({noteLat,oct,pressed,onDown,onUp,size=38})=>{
  const oc=OCT_C[oct]||{bg:"#555",border:"#333"};
  const eng=LAT[noteLat]||noteLat;
  const tc=nc(eng);
  return(
    <button
      onMouseDown={()=>onDown(noteLat,oct)}
      onMouseUp={()=>onUp(noteLat,oct)}
      onMouseLeave={()=>onUp(noteLat,oct)}
      onTouchStart={e=>{e.preventDefault();onDown(noteLat,oct);}}
      onTouchEnd={e=>{e.preventDefault();onUp(noteLat,oct);}}
      className="rounded-full flex flex-col items-center justify-center select-none flex-shrink-0"
      style={{
        width:size,height:size,
        background:pressed
          ?`radial-gradient(circle at 35% 35%,${tc},${tc}aa)`
          :`radial-gradient(circle at 35% 35%,${oc.bg}ee,${oc.bg}88)`,
        border:`2px solid ${pressed?tc:oc.border}`,
        boxShadow:pressed?`0 0 10px ${tc}88,inset 0 1px 3px rgba(255,255,255,0.4)`:`0 3px 6px rgba(0,0,0,0.6)`,
        transform:pressed?"scale(0.93)":"scale(1)",
        transition:"all 0.07s ease",cursor:"pointer",
      }}>
      <span style={{fontSize:size<36?"6.5px":"7.5px",fontWeight:"bold",color:pressed?"#fff":"rgba(0,0,0,0.9)",lineHeight:1}}>{noteLat}</span>
      <span style={{fontSize:"5.5px",color:pressed?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.5)"}}>{oct}</span>
    </button>
  );
};

const BGrid=({layout,pressed,onDown,onUp,title,size=36})=>(
  <div>
    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">{title}</p>
    <div className="inline-block p-3 rounded-2xl"
      style={{background:"linear-gradient(145deg,#281a08,#140e04)",border:"2px solid #6b4c1e",boxShadow:"0 8px 24px rgba(0,0,0,0.7)"}}>
      {layout.map((row,ri)=>(
        <div key={ri} className="flex gap-1 mb-1" style={{marginLeft:ri%2===1?(size+4)/2+"px":"0px"}}>
          {row.map((btn,bi)=>{
            const pr=pressed.some(p=>p.ri===ri&&p.bi===bi);
            return<BBtn key={`${ri}-${bi}`} noteLat={btn.n} oct={btn.o}
              pressed={pr}
              onDown={(n,o)=>onDown({n,o,ri,bi})}
              onUp={()=>onUp({ri,bi})}
              size={size}/>;
          })}
        </div>
      ))}
      <div className="flex gap-2 mt-2 justify-center flex-wrap">
        {[...new Set(layout.flat().map(b=>b.o))].sort().map(oct=>{
          const c=OCT_C[oct];if(!c)return null;
          return(<div key={oct} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{background:c.bg,border:`1px solid ${c.border}`}}/>
            <span style={{fontSize:"8px",color:"#777"}}>Oct.{oct}</span>
          </div>);
        })}
      </div>
    </div>
  </div>
);

// ─── TABLAS DE OCTAVAS — generadas dinámicamente desde los datos de cada botón ──
// Al editar el teclado, oct_abre/oct_cierra en cada botón actualiza estas tablas.
// Fuente inicial: Rheinische 142 (behinger.github.io/bandoneon)

function buildOctMaps(leftBtns, rightBtns) {
  const OCT_L_OPEN  = {}, OCT_L_CLOSE = {};
  const OCT_R_OPEN  = {}, OCT_R_CLOSE = {};
  leftBtns.forEach(b  => { OCT_L_OPEN[b.id]  = b.oct_abre  ?? 2; OCT_L_CLOSE[b.id]  = b.oct_cierra ?? 2; });
  rightBtns.forEach(b => { OCT_R_OPEN[b.id]  = b.oct_abre  ?? 4; OCT_R_CLOSE[b.id]  = b.oct_cierra ?? 4; });
  return { OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE };
}

// Tablas estáticas de fallback (valores del layout de referencia)
// Se usan solo si los botones no tienen oct_abre/oct_cierra
// ─── OCTAVAS REALES POR BOTÓN (fuente: Rheinische 142, layout de referencia) ─────
// Mano derecha: range A2–G5 / Mano izquierda: range F#1–A3
const FALLBACK_OCT_R_OPEN = {
  "R01":2,
  "R02":5,
  "R03":2,
  "R04":5,
  "R05":5,
  "R06":5,
  "R07":5,
  "R08":3,
  "R09":5,
  "R10":3,
  "R11":3,
  "R12":3,
  "R13":4,
  "R14":5,
  "R15":5,
  "R16":3,
  "R17":3,
  "R18":4,
  "R19":3,
  "R20":3,
  "R21":4,
  "R22":4,
  "R23":2,
  "R24":3,
  "R25":3,
  "R26":3,
  "R27":4,
  "R28":4,
  "R29":4,
  "R30":4,
  "R31":2,
  "R32":3,
  "R33":4,
  "R34":4,
  "R35":4,
  "R36":4,
  "R37":5,
  "R38":4
};
const FALLBACK_OCT_R_CLOSE = {
  "R01":3,
  "R02":5,
  "R03":5,
  "R04":3,
  "R05":2,
  "R06":4,
  "R07":5,
  "R08":3,
  "R09":5,
  "R10":3,
  "R11":3,
  "R12":3,
  "R13":3,
  "R14":4,
  "R15":5,
  "R16":4,
  "R17":4,
  "R18":4,
  "R19":2,
  "R20":4,
  "R21":4,
  "R22":5,
  "R23":4,
  "R24":4,
  "R25":3,
  "R26":3,
  "R27":5,
  "R28":5,
  "R29":4,
  "R30":5,
  "R31":2,
  "R32":4,
  "R33":5,
  "R34":5,
  "R35":4,
  "R36":4,
  "R37":5,
  "R38":3
};
const FALLBACK_OCT_L_OPEN = {
  "L01":3,
  "L02":3,
  "L03":3,
  "L04":3,
  "L05":2,
  "L06":3,
  "L07":3,
  "L08":3,
  "L09":2,
  "L10":1,
  "L11":2,
  "L12":2,
  "L13":2,
  "L14":1,
  "L15":1,
  "L16":1,
  "L17":3,
  "L18":2,
  "L19":2,
  "L20":1,
  "L21":2,
  "L22":3,
  "L23":1,
  "L24":2,
  "L25":3,
  "L26":1,
  "L27":1,
  "L28":2,
  "L29":2,
  "L30":1,
  "L31":2,
  "L32":3,
  "L33":2
};
const FALLBACK_OCT_L_CLOSE = {
  "L01":3,
  "L02":2,
  "L03":1,
  "L04":2,
  "L05":3,
  "L06":3,
  "L07":2,
  "L08":1,
  "L09":3,
  "L10":2,
  "L11":2,
  "L12":3,
  "L13":1,
  "L14":2,
  "L15":2,
  "L16":1,
  "L17":3,
  "L18":1,
  "L19":2,
  "L20":2,
  "L21":3,
  "L22":3,
  "L23":3,
  "L24":2,
  "L25":1,
  "L26":1,
  "L27":1,
  "L28":1,
  "L29":1,
  "L30":1,
  "L31":1,
  "L32":1,
  "L33":2
};


// ─── STORAGE DE CONFIGURACIÓN ────────────────────────────────────────────────
const STORAGE_KEY_L = "bandoneon_left_v1";
const STORAGE_KEY_R = "bandoneon_right_v1";

const DEFS_L = [
  { id:"L01", row:0, x:208, y:46,  abre:"SOL#", cierra:"SOL#", color_abre:"#ff6a00", color_cierra:"#ff6a00", oct_abre:0, oct_cierra:2 },
  { id:"L02", row:0, x:308, y:40,  abre:"LA#",  cierra:"LA#",  color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:0, oct_cierra:0 },
  { id:"L03", row:0, x:416, y:42,  abre:"DO#",  cierra:"RE#",  color_abre:"#01c7fc", color_cierra:"#84cc16", oct_abre:1, oct_cierra:0 },
  { id:"L04", row:0, x:526, y:58,  abre:"FA",   cierra:"RE#",  color_abre:"#d38301", color_cierra:"#84cc16", oct_abre:1, oct_cierra:2 },
  { id:"L05", row:0, x:640, y:78,  abre:"SOL#", cierra:"SOL",  color_abre:"#ff6a00", color_cierra:"#fefb41", oct_abre:2, oct_cierra:2 },
  { id:"L06", row:1, x:64,  y:126, abre:"MI",   cierra:"RE",   color_abre:"#583300", color_cierra:"#587934", oct_abre:0, oct_cierra:0 },
  { id:"L07", row:1, x:162, y:106, abre:"LA",   cierra:"RE",   color_abre:"#a62c17", color_cierra:"#587934", oct_abre:2, oct_cierra:1 },
  { id:"L08", row:1, x:258, y:96,  abre:"SOL",  cierra:"LA#",  color_abre:"#fefb41", color_cierra:"#e63b7a", oct_abre:1, oct_cierra:1 },
  { id:"L09", row:1, x:358, y:98,  abre:"RE#",  cierra:"DO",   color_abre:"#84cc16", color_cierra:"#285ff4", oct_abre:1, oct_cierra:2 },
  { id:"L10", row:1, x:472, y:108, abre:"FA",   cierra:"DO#",  color_abre:"#d38301", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:2 },
  { id:"L11", row:1, x:576, y:108, abre:"LA#",  cierra:"DO",   color_abre:"#e63b7a", color_cierra:"#285ff4", oct_abre:1, oct_cierra:1 },
  { id:"L12", row:1, x:680, y:142, abre:"FA",   cierra:"FA#",  color_abre:"#d38301", color_cierra:"#feb43f", oct_abre:0, oct_cierra:2 },
  { id:"L13", row:2, x:110, y:172, abre:"RE",   cierra:"SOL",  color_abre:"#587934", color_cierra:"#fefb41", oct_abre:1, oct_cierra:0 },
  { id:"L14", row:2, x:210, y:156, abre:"LA",   cierra:"SOL",  color_abre:"#a62c17", color_cierra:"#fefb41", oct_abre:1, oct_cierra:1 },
  { id:"L15", row:2, x:302, y:154, abre:"DO",   cierra:"SI",   color_abre:"#285ff4", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:1 },
  { id:"L16", row:2, x:410, y:162, abre:"MI",   cierra:"RE",   color_abre:"#583300", color_cierra:"#587934", oct_abre:2, oct_cierra:2 },
  { id:"L17", row:2, x:528, y:164, abre:"DO",   cierra:"FA",   color_abre:"#285ff4", color_cierra:"#d38301", oct_abre:1, oct_cierra:2 },
  { id:"L18", row:2, x:618, y:170, abre:"SOL",  cierra:"FA#",  color_abre:"#fefb41", color_cierra:"#feb43f", oct_abre:0, oct_cierra:0 },
  { id:"L19", row:3, x:66,  y:252, abre:"MI",   cierra:"LA",   color_abre:"#583300", color_cierra:"#a62c17", oct_abre:1, oct_cierra:1 },
  { id:"L20", row:3, x:158, y:230, abre:"SOL#", cierra:"MI",   color_abre:"#ff6a00", color_cierra:"#583300", oct_abre:1, oct_cierra:1 },
  { id:"L21", row:3, x:254, y:222, abre:"SI",   cierra:"LA",   color_abre:"#5e30eb", color_cierra:"#a62c17", oct_abre:1, oct_cierra:1 },
  { id:"L22", row:3, x:354, y:218, abre:"RE",   cierra:"DO#",  color_abre:"#587934", color_cierra:"#01c7fc", oct_abre:2, oct_cierra:2 },
  { id:"L23", row:3, x:458, y:224, abre:"FA#",  cierra:"MI",   color_abre:"#feb43f", color_cierra:"#583300", oct_abre:2, oct_cierra:2 },
  { id:"L24", row:3, x:560, y:234, abre:"DO#",  cierra:"SOL#", color_abre:"#00a1d8", color_cierra:"#ff6a00", oct_abre:2, oct_cierra:1 },
  { id:"L25", row:3, x:646, y:246, abre:"FA#",  cierra:"SI",   color_abre:"#feb43f", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:0 },
  { id:"L26", row:4, x:26,  y:328, abre:"RE",   cierra:"MI",   color_abre:"#587934", color_cierra:"#754400", oct_abre:0, oct_cierra:0 },
  { id:"L27", row:4, x:110, y:308, abre:"SI",   cierra:"MI",   color_abre:"#5e30eb", color_cierra:"#583300", oct_abre:0, oct_cierra:1 },
  { id:"L28", row:4, x:204, y:294, abre:"SOL",  cierra:"SOL#", color_abre:"#705200", color_cierra:"#ecac22", oct_abre:2, oct_cierra:2 },
  { id:"L29", row:4, x:298, y:288, abre:"LA",   cierra:"LA",   color_abre:"#a62c17", color_cierra:"#a62c17", oct_abre:2, oct_cierra:0 },
  { id:"L30", row:4, x:390, y:286, abre:"RE#",  cierra:"SI",   color_abre:"#84cc16", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:0 },
  { id:"L31", row:4, x:496, y:296, abre:"FA#",  cierra:"FA",   color_abre:"#feb43f", color_cierra:"#d38301", oct_abre:1, oct_cierra:0 },
  { id:"L32", row:4, x:590, y:306, abre:"RE#",  cierra:"DO#",  color_abre:"#84cc16", color_cierra:"#01c7fc", oct_abre:0, oct_cierra:0 },
  { id:"L33", row:4, x:674, y:324, abre:"DO",   cierra:"FA",   color_abre:"#285ff4", color_cierra:"#d38301", oct_abre:0, oct_cierra:0 },
];

const DEFS_R = [
  { id:"R01", row:0, x:174, y:0,   abre:"SI",   cierra:"SI",   color_abre:"#5e30eb", color_cierra:"#5e30eb", oct_abre:1, oct_cierra:2 },
  { id:"R02", row:0, x:274, y:0,   abre:"SOL#", cierra:"SOL#", color_abre:"#ff6a00", color_cierra:"#ff6a00", oct_abre:4, oct_cierra:4 },
  { id:"R03", row:0, x:376, y:0,   abre:"SOL",  cierra:"FA#",  color_abre:"#fefb41", color_cierra:"#ffc777", oct_abre:1, oct_cierra:4 },
  { id:"R04", row:0, x:484, y:0,   abre:"FA",   cierra:"FA",   color_abre:"#a96800", color_cierra:"#a96800", oct_abre:4, oct_cierra:2 },
  { id:"R05", row:0, x:220, y:38,  abre:"LA",   cierra:"SOL",  color_abre:"#a62c17", color_cierra:"#fefb41", oct_abre:4, oct_cierra:1 },
  { id:"R06", row:0, x:326, y:38,  abre:"FA#",  cierra:"LA#",  color_abre:"#ffc777", color_cierra:"#e63b7a", oct_abre:4, oct_cierra:3 },
  { id:"R07", row:0, x:432, y:40,  abre:"MI",   cierra:"DO",   color_abre:"#583300", color_cierra:"#285ff4", oct_abre:4, oct_cierra:4 },
  { id:"R08", row:1, x:128, y:46,  abre:"DO#",  cierra:"DO",   color_abre:"#01c7fc", color_cierra:"#285ff4", oct_abre:2, oct_cierra:2 },
  { id:"R09", row:1, x:528, y:50,  abre:"RE#",  cierra:"RE#",  color_abre:"#84cc16", color_cierra:"#84cc16", oct_abre:4, oct_cierra:4 },
  { id:"R10", row:1, x:88,  y:104, abre:"DO",   cierra:"RE",   color_abre:"#285ff4", color_cierra:"#587934", oct_abre:2, oct_cierra:2 },
  { id:"R11", row:1, x:178, y:98,  abre:"RE",   cierra:"DO#",  color_abre:"#587934", color_cierra:"#01c7fc", oct_abre:2, oct_cierra:2 },
  { id:"R12", row:1, x:280, y:86,  abre:"SOL",  cierra:"SOL#", color_abre:"#fefb41", color_cierra:"#ff6a00", oct_abre:2, oct_cierra:2 },
  { id:"R13", row:1, x:388, y:86,  abre:"LA#",  cierra:"LA#",  color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:3, oct_cierra:2 },
  { id:"R14", row:1, x:484, y:94,  abre:"DO",   cierra:"MI",   color_abre:"#285ff4", color_cierra:"#583300", oct_abre:4, oct_cierra:3 },
  { id:"R15", row:1, x:572, y:114, abre:"RE",   cierra:"RE",   color_abre:"#587934", color_cierra:"#587934", oct_abre:4, oct_cierra:4 },
  { id:"R16", row:2, x:42,  y:188, abre:"SI",   cierra:"DO",   color_abre:"#5e30eb", color_cierra:"#285ff4", oct_abre:2, oct_cierra:3 },
  { id:"R17", row:2, x:136, y:168, abre:"MI",   cierra:"DO#",  color_abre:"#583300", color_cierra:"#01c7fc", oct_abre:2, oct_cierra:3 },
  { id:"R18", row:2, x:236, y:156, abre:"DO#",  cierra:"FA#",  color_abre:"#01c7fc", color_cierra:"#ffc777", oct_abre:3, oct_cierra:3 },
  { id:"R19", row:2, x:342, y:148, abre:"FA#",  cierra:"SI",   color_abre:"#ffc777", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:1 },
  { id:"R20", row:2, x:436, y:156, abre:"LA",   cierra:"SI",   color_abre:"#a62c17", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:3 },
  { id:"R21", row:2, x:530, y:164, abre:"DO",   cierra:"RE",   color_abre:"#285ff4", color_cierra:"#587934", oct_abre:3, oct_cierra:3 },
  { id:"R22", row:2, x:612, y:184, abre:"MI",   cierra:"SOL",  color_abre:"#583300", color_cierra:"#fefb41", oct_abre:3, oct_cierra:4 },
  { id:"R23", row:2, x:0,   y:262, abre:"LA",   cierra:"RE",   color_abre:"#a62c17", color_cierra:"#587934", oct_abre:1, oct_cierra:3 },
  { id:"R24", row:2, x:94,  y:246, abre:"FA",   cierra:"FA",   color_abre:"#a96800", color_cierra:"#a96800", oct_abre:2, oct_cierra:3 },
  { id:"R25", row:3, x:188, y:232, abre:"LA#",  cierra:"MI",   color_abre:"#e63b7a", color_cierra:"#583300", oct_abre:2, oct_cierra:2 },
  { id:"R26", row:3, x:284, y:224, abre:"SOL#", cierra:"LA",   color_abre:"#ff6a00", color_cierra:"#a62c17", oct_abre:2, oct_cierra:2 },
  { id:"R27", row:3, x:386, y:224, abre:"SI",   cierra:"DO#",  color_abre:"#5e30eb", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:4 },
  { id:"R28", row:3, x:478, y:232, abre:"RE",   cierra:"MI",   color_abre:"#587934", color_cierra:"#583300", oct_abre:3, oct_cierra:4 },
  { id:"R29", row:3, x:570, y:246, abre:"SOL#", cierra:"LA",   color_abre:"#ff6a00", color_cierra:"#a62c17", oct_abre:3, oct_cierra:3 },
  { id:"R30", row:3, x:654, y:266, abre:"SI",   cierra:"DO#",  color_abre:"#5e30eb", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:4 },
  { id:"R31", row:3, x:26,  y:328, abre:"LA#",  cierra:"LA#",  color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:1, oct_cierra:1 },
  { id:"R32", row:3, x:122, y:312, abre:"RE#",  cierra:"RE#",  color_abre:"#84cc16", color_cierra:"#84cc16", oct_abre:2, oct_cierra:3 },
  { id:"R33", row:4, x:220, y:298, abre:"FA",   cierra:"FA",   color_abre:"#a96800", color_cierra:"#a96800", oct_abre:3, oct_cierra:4 },
  { id:"R34", row:4, x:316, y:296, abre:"RE#",  cierra:"MI",   color_abre:"#84cc16", color_cierra:"#583300", oct_abre:3, oct_cierra:4 },
  { id:"R35", row:4, x:412, y:300, abre:"FA#",  cierra:"SOL#", color_abre:"#ffc777", color_cierra:"#ff6a00", oct_abre:3, oct_cierra:3 },
  { id:"R36", row:4, x:500, y:308, abre:"LA",   cierra:"SI",   color_abre:"#a62c17", color_cierra:"#5e30eb", oct_abre:3, oct_cierra:3 },
  { id:"R37", row:4, x:594, y:322, abre:"DO#",  cierra:"MI",   color_abre:"#01c7fc", color_cierra:"#583300", oct_abre:4, oct_cierra:4 },
  { id:"R38", row:4, x:680, y:346, abre:"SOL",  cierra:"RE#",  color_abre:"#fefb41", color_cierra:"#84cc16", oct_abre:3, oct_cierra:2 },
];

function loadBtns() {
  try {
    const rawL = localStorage.getItem(STORAGE_KEY_L);
    const rawR = localStorage.getItem(STORAGE_KEY_R);
    // Retrocompatibilidad: si los datos guardados no tienen oct_abre, los tomamos de DEFS
    const mergeOct = (loaded, defaults) => loaded.map(b => {
      if (b.oct_abre !== undefined) return b;
      const def = defaults.find(d => d.id === b.id);
      return { ...b, oct_abre: def?.oct_abre ?? 3, oct_cierra: def?.oct_cierra ?? 3 };
    });
    return {
      left:  rawL ? mergeOct(JSON.parse(rawL), DEFS_L) : DEFS_L.map(b=>({...b})),
      right: rawR ? mergeOct(JSON.parse(rawR), DEFS_R) : DEFS_R.map(b=>({...b})),
    };
  } catch { return { left: DEFS_L.map(b=>({...b})), right: DEFS_R.map(b=>({...b})) }; }
}

function saveBtns(left, right) {
  try {
    localStorage.setItem(STORAGE_KEY_L, JSON.stringify(left));
    localStorage.setItem(STORAGE_KEY_R, JSON.stringify(right));
  } catch(e) {}
}

function clearBtns() {
  localStorage.removeItem(STORAGE_KEY_L);
  localStorage.removeItem(STORAGE_KEY_R);
}

function btnsToCSV(left, right) {
  const h = "id,row,x,y,abre,cierra,color_abre,color_cierra,oct_abre,oct_cierra";
  const rows = [...left,...right].map(b=>
    `${b.id},${b.row},${b.x},${b.y},${b.abre},${b.cierra},${b.color_abre},${b.color_cierra},${b.oct_abre??3},${b.oct_cierra??3}`
  );
  return [h,...rows].join("\n");
}

function downloadCSV(left, right) {
  const blob = new Blob([btnsToCSV(left,right)], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `bandoneon_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function generateCSS(left, right) {
  return [...left,...right].map(b=>
    `/* ${b.id} */ [data-btn="${b.id}"]{position:absolute;left:${b.x}px;top:${b.y}px;--ca:${b.color_abre};--cc:${b.color_cierra};}`
  ).join("\n");
}

function parseCSV(text) {
  try {
    const lines = text.trim().split("\n").filter(l=>l.trim());
    const data  = lines[0].toLowerCase().startsWith("id") ? lines.slice(1) : lines;
    const all   = data.map(line => {
      const [id,row,x,y,abre,cierra,color_abre,color_cierra,oct_abre,oct_cierra] = line.split(",").map(s=>s.trim());
      if (!id||!abre) return null;
      return {id, row:parseInt(row)||0, x:parseInt(x)||0, y:parseInt(y)||0,
        abre:abre||"DO", cierra:cierra||"DO", color_abre:color_abre||"", color_cierra:color_cierra||"",
        oct_abre: oct_abre!==undefined&&oct_abre!=="" ? parseInt(oct_abre) : 3,
        oct_cierra: oct_cierra!==undefined&&oct_cierra!=="" ? parseInt(oct_cierra) : 3};
    }).filter(Boolean);
    return { left: all.filter(b=>b.id.startsWith("L")), right: all.filter(b=>b.id.startsWith("R")) };
  } catch { return null; }
}

const ALL_NOTES_LAT = ["DO","DO#","RE","RE#","MI","FA","FA#","SOL","SOL#","LA","LA#","SI"];
const BTN_SIZE = 44;
const SNAP = 2;
const snapV = v => Math.round(v/SNAP)*SNAP;

// ─── BOTÓN VISUAL ─────────────────────────────────────────────────────────────
function BandBtn({ btn, bellows, pressed, isHeard, onDown, onUp, draggable=false, onMove, oct=null }) {
  const note  = bellows === "abre" ? btn.abre  : btn.cierra;
  const color = bellows === "abre" ? btn.color_abre : btn.color_cierra;
  const isOn  = pressed.includes(btn.id);
  const isAct = isOn || isHeard;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (draggable && onMove) {
      const ox = e.clientX - btn.x, oy = e.clientY - btn.y;
      const move = e2 => onMove(btn.id, snapV(Math.max(0,e2.clientX-ox)), snapV(Math.max(0,e2.clientY-oy)));
      const up   = () => { window.removeEventListener("mousemove",move); window.removeEventListener("mouseup",up); };
      window.addEventListener("mousemove",move); window.addEventListener("mouseup",up);
    } else { onDown && onDown(btn); }
  }, [btn, draggable, onMove, onDown]);

  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    if (draggable && onMove) {
      const t=e.touches[0], ox=t.clientX-btn.x, oy=t.clientY-btn.y;
      const move=e2=>{e2.preventDefault();const t2=e2.touches[0];onMove(btn.id,snapV(Math.max(0,t2.clientX-ox)),snapV(Math.max(0,t2.clientY-oy)));};
      const up=()=>{window.removeEventListener("touchmove",move);window.removeEventListener("touchend",up);};
      window.addEventListener("touchmove",move,{passive:false}); window.addEventListener("touchend",up);
    } else { onDown && onDown(btn); }
  }, [btn, draggable, onMove, onDown]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={()=>!draggable&&onUp&&onUp(btn.id)}
      onMouseLeave={()=>!draggable&&onUp&&onUp(btn.id)}
      onTouchStart={handleTouchStart}
      onTouchEnd={e=>{e.preventDefault();!draggable&&onUp&&onUp(btn.id);}}
      data-btn={btn.id}
      style={{
        position:"absolute", left:btn.x, top:btn.y,
        width:BTN_SIZE, height:BTN_SIZE, borderRadius:"50%",
        cursor:draggable?"grab":"pointer", touchAction:"none", userSelect:"none",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        background: isAct
          ? `radial-gradient(circle at 36% 30%,${color}ff,${color}cc 55%,${color}88)`
          : `radial-gradient(circle at 36% 30%,${color}99,${color}44 60%,${color}22)`,
        border:`2.5px solid ${isAct?(isHeard?"#ffffff":color):color+"aa"}`,
        boxShadow: isAct
          ? isHeard ? `0 0 22px #fff,0 0 44px ${color}` : `0 0 18px ${color}cc`
          : "0 2px 8px rgba(0,0,0,.7)",
        transform: isHeard?"scale(1.1)":isOn?"scale(0.95)":"scale(1)",
        transition:"transform .08s,box-shadow .12s",
        zIndex: isAct?20:1,
      }}
    >
      <div style={{position:"absolute",top:5,left:9,width:11,height:7,borderRadius:"50%",background:"rgba(255,255,255,.22)",filter:"blur(1px)",pointerEvents:"none"}}/>
      <span style={{fontSize:note.length>2?7:9,fontWeight:800,color:"#fff",fontFamily:"'Courier New',monospace",lineHeight:1,zIndex:1,textShadow:"0 1px 3px rgba(0,0,0,.9)"}}>{note}</span>
      {/* Puntos de octava relativa — siempre derechos gracias a un wrapper sin rotación */}
      {oct !== null && !draggable && (
        <div style={{
          display:"flex", gap:2, marginTop:2, zIndex:2,
          // Contrarotación: si el teclado está rotado ±90°, este div lo cancela
          // Se pasa como prop octRot para que el texto/puntos queden siempre derechos
        }}>
          {[1,2,3].map(i=>(
            <div key={i} style={{
              width:3.5, height:3.5, borderRadius:"50%",
              background: i <= (oct ?? 0)
                ? "rgba(255,255,255,0.9)"
                : "rgba(255,255,255,0.2)",
            }}/>
          ))}
        </div>
      )}
      {draggable && (
        <span style={{fontSize:6.5,color:"rgba(255,255,255,.9)",fontFamily:"monospace",lineHeight:1,zIndex:1,fontWeight:700}}>
          {btn.id.replace(/[LRlr]/,"")}
        </span>
      )}
    </div>
  );
}

// ─── CANVAS RESPONSIVE ───────────────────────────────────────────────────────
function BandCanvas({ buttons, bellows, pressed, heardIds=[], onDown, onUp,
  draggable=false, onMove, showGrid=false, onSelect=null, selected=null, mobile=false, octMap=null }) {

  const W = Math.max(...buttons.map(b=>b.x)) + BTN_SIZE + 16;
  const H = Math.max(...buttons.map(b=>b.y)) + BTN_SIZE + 20;

  // En móvil usamos CSS zoom: el navegador reescala el elemento completo
  // y ajusta automáticamente el espacio que ocupa en el layout.
  // 330px = ancho seguro en móvil (deja margen para padding del contenedor)
  const MOB_W = 330;
  const zoom  = mobile ? MOB_W / W : 1;
  // Alto que ocupa visualmente tras el zoom
  const visH  = mobile ? Math.ceil(H * zoom) : H;

  const canvas = (
    <div
      onClick={()=>onSelect&&onSelect(null)}
      style={{
        position: "relative",
        width: W, height: H,
        flexShrink: 0,
        background: showGrid
          ? `repeating-linear-gradient(0deg,transparent,transparent 9px,rgba(90,58,24,.18) 10px),
             repeating-linear-gradient(90deg,transparent,transparent 9px,rgba(90,58,24,.18) 10px),#0e0701`
          : "linear-gradient(145deg,#281a08,#140e04)",
        border: `2px solid ${draggable?"#f5c06055":"#6b4c1e"}`,
        borderRadius: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,.7)",
        touchAction: "none",
        zoom: zoom,         // escala todo incluyendo botones y posiciones
      }}
    >
      {buttons.map(btn=>(
        <BandBtn key={btn.id} btn={btn} bellows={bellows}
          pressed={selected?[selected]:pressed}
          isHeard={heardIds.includes(btn.id)}
          onDown={e=>{onSelect&&onSelect(btn.id); onDown&&onDown(btn);}}
          onUp={onUp} draggable={draggable} onMove={onMove}
          oct={octMap ? octMap[btn.id] : null}/>
      ))}
    </div>
  );

  if (!mobile) {
    return <div style={{overflowX:"auto",paddingBottom:4}}>{canvas}</div>;
  }

  return (
    <div style={{width:"100%", overflow:"hidden"}}>
      {canvas}
    </div>
  );
}

// ─── MODAL GUARDADO ───────────────────────────────────────────────────────────
function SavedModal({ cssText, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#0e0e20",border:"1.5px solid #4466cc",borderRadius:16,padding:"24px 24px 20px",maxWidth:440,width:"100%"}}>
        <div style={{fontSize:28,marginBottom:8}}>✅</div>
        <h3 style={{color:"#88aaff",fontWeight:700,fontSize:17,marginBottom:8}}>Configuración guardada</h3>
        <p style={{color:"#9ca3af",fontSize:13,lineHeight:1.6,marginBottom:14}}>
          Tu configuración se guardó en este dispositivo y se cargará automáticamente la próxima vez.
        </p>
        <div style={{background:"#1a2540",border:"1px solid #4466cc44",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
          <p style={{color:"#fbbf24",fontWeight:700,fontSize:12,marginBottom:5}}>📱 ¿Otro dispositivo?</p>
          <p style={{color:"#9ca3af",fontSize:12,lineHeight:1.6}}>
            Se descargó un <b style={{color:"#88aaff"}}>.csv</b> con tu configuración. En el otro dispositivo usá <b style={{color:"#2dd4bf"}}>↑ Importar CSV</b>.
          </p>
        </div>
        <div style={{background:"#111827",border:"1px solid #374151",borderRadius:10,padding:"8px 14px",marginBottom:16}}>
          <p style={{color:"#6b7280",fontSize:11,lineHeight:1.6}}>
            💡 Para que sea permanente en el código, usá <b style={{color:"#f5c060"}}>↓ Ver JS</b> en el editor y pegá el resultado en tu <code style={{color:"#88aaff"}}>App.jsx</code> reemplazando <code>DEFS_L</code> y <code>DEFS_R</code>.
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>navigator.clipboard.writeText(cssText).then(()=>setCopied(true))} style={{
            flex:1,padding:"7px",borderRadius:9,border:"1px solid #3a2010",background:"#1a0e04",
            color:copied?"#2dd4bf":"#f5c060",fontFamily:"monospace",fontWeight:700,fontSize:11,cursor:"pointer"
          }}>{copied?"✓ CSS copiado":"{} CSS"}</button>
          <button onClick={onClose} style={{
            flex:2,padding:"7px",borderRadius:9,border:"none",
            background:"linear-gradient(135deg,#1e2a4a,#4a8af0)",
            color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"
          }}>Entendido ✓</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL IMPORTAR CSV ───────────────────────────────────────────────────────
function ImportModal({ onImport, onClose }) {
  const fileRef = useRef(null);
  const [error,   setError]   = useState("");
  const [preview, setPreview] = useState(null);
  const [parsed,  setParsed]  = useState(null);

  const handleFile = e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = parseCSV(ev.target.result);
      if (!result||(!result.left.length&&!result.right.length)) { setError("CSV inválido o sin datos."); return; }
      setError(""); setParsed(result); setPreview({left:result.left.length,right:result.right.length});
    };
    reader.readAsText(file); e.target.value="";
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#0e0e20",border:"1.5px solid #2dd4bf44",borderRadius:16,padding:"22px 22px 18px",maxWidth:400,width:"100%"}}>
        <h3 style={{color:"#2dd4bf",fontWeight:700,fontSize:16,marginBottom:8}}>📂 Importar configuración</h3>
        <p style={{color:"#9ca3af",fontSize:12,lineHeight:1.6,marginBottom:14}}>
          Seleccioná el <b>.csv</b> descargado en una sesión anterior. Reemplazará la configuración actual.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{display:"none"}}/>
        <button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:9,borderRadius:9,border:"1px solid #2dd4bf44",background:"#0a1a18",color:"#2dd4bf",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:10}}>
          Elegir archivo .csv
        </button>
        {error&&<p style={{color:"#f87171",fontSize:11,marginBottom:10,background:"#270808",padding:"5px 10px",borderRadius:6}}>⚠ {error}</p>}
        {preview&&(
          <div style={{background:"#0a1a08",border:"1px solid #2dd4bf44",borderRadius:10,padding:"8px 12px",marginBottom:12}}>
            <p style={{color:"#4ade80",fontWeight:700,fontSize:12,marginBottom:3}}>✓ Archivo válido</p>
            <p style={{color:"#9ca3af",fontSize:11}}>Izquierda: <b style={{color:"#88aaff"}}>{preview.left}</b> · Derecha: <b style={{color:"#88aaff"}}>{preview.right}</b></p>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"7px",borderRadius:9,border:"1px solid #374151",background:"transparent",color:"#6b7280",fontSize:12,cursor:"pointer"}}>Cancelar</button>
          {parsed&&<button onClick={()=>onImport(parsed.left,parsed.right)} style={{flex:2,padding:"7px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#134e4a,#2dd4bf)",color:"#0f172a",fontWeight:700,fontSize:13,cursor:"pointer"}}>Aplicar y guardar</button>}
        </div>
      </div>
    </div>
  );
}

function DesktopBandLayout({
  leftBtns, rightBtns, bellows, view,
  pressedL, pressedR, heardIdsL, heardIdsR,
  downL, upL, downR, upR,
  OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE,
  activeNotes, detected, heardNote, LAT,
}) {
  const [voicingHighlight, setVoicingHighlight] = useState(new Set());

  const LAYOUT_KEY = "bandoneon_layout_v1";
  const defaultLayout = {rotL:-90,scaleL:100,mirLH:false,mirLV:false,rotR:90,scaleR:100,mirRH:false,mirRV:false};
  const [layout, setLayout] = useState(()=>{
    try{const s=localStorage.getItem(LAYOUT_KEY);return s?{...defaultLayout,...JSON.parse(s)}:defaultLayout;}
    catch{return defaultLayout;}
  });
  const [showLayoutCtrl, setShowLayoutCtrl] = useState(false);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.7);

  const updateLayout = (key,val) => {
    setLayout(prev=>{
      const next={...prev,[key]:val};
      try{localStorage.setItem(LAYOUT_KEY,JSON.stringify(next));}catch{}
      return next;
    });
  };

  const applyPreset = (preset) => {
    const presets={
      normal:  {rotL:0,  scaleL:100,mirLH:false,mirLV:false,rotR:0,  scaleR:100,mirRH:false,mirRV:false},
      rotados: {rotL:-90,scaleL:100,mirLH:false,mirLV:false,rotR:90, scaleR:100,mirRH:false,mirRV:false},
      espejados:{rotL:-90,scaleL:100,mirLH:true, mirLV:false,rotR:90, scaleR:100,mirRH:true, mirRV:false},
      vertical:{rotL:0,  scaleL:85, mirLH:false,mirLV:false,rotR:0,  scaleR:85, mirRH:false,mirRV:false},
    };
    const next={...defaultLayout,...presets[preset]};
    setLayout(next);
    try{localStorage.setItem(LAYOUT_KEY,JSON.stringify(next));}catch{}
  };

  const BTN=44;
  const rawW_L = leftBtns.length  ? Math.max(...leftBtns.map(b=>b.x)) +BTN+16 : 750;
  const rawH_L = leftBtns.length  ? Math.max(...leftBtns.map(b=>b.y)) +BTN+20 : 400;
  const rawW_R = rightBtns.length ? Math.max(...rightBtns.map(b=>b.x))+BTN+16 : 750;
  const rawH_R = rightBtns.length ? Math.max(...rightBtns.map(b=>b.y))+BTN+20 : 400;
  const GAP = 12;
  const CENTER_W = 220;

  useEffect(()=>{
    if(!containerRef.current) return;
    const obs = new ResizeObserver(()=>{
      const totalW = containerRef.current.clientWidth;
      const neededW = rawH_L + rawH_R + GAP*2;
      const scaleByW = totalW>0 ? (totalW*0.96)/neededW : 1;
      const availH = window.innerHeight - 260;
      const maxRawW = Math.max(rawW_L, rawW_R);
      const scaleByH = availH>0 ? (availH*0.72)/maxRawW : 1;
      setScale(Math.max(0.35, Math.min(1, scaleByW, scaleByH)));
    });
    obs.observe(containerRef.current);
    return ()=>obs.disconnect();
  },[rawW_L,rawW_R,rawH_L,rawH_R]);

  // ScaledCanvas con rotación, escala y espejo
  const ScaledCanvas = ({buttons, bellows:bel, pressed, heardIds, onDown, onUp,
    octMap, rawW, rawH, label, rotation=0, scalePct=100, mirH=false, mirV=false}) => {
    const finalScale = scale * (scalePct/100);
    const rotated = rotation!==0;
    const scaledW = rawW*finalScale, scaledH = rawH*finalScale;
    const outerW = rotated ? scaledH : scaledW;
    const outerH = rotated ? scaledW : scaledH;
    const dx = rotated ? (scaledH-scaledW)/2 : 0;
    const dy = rotated ? (scaledW-scaledH)/2 : 0;

    // Calcular octava relativa (1=grave 2=media 3=aguda)
    const octs = octMap ? [...new Set(buttons.map(b=>octMap[b.id]).filter(o=>o!=null))].sort((a,b)=>a-b) : [];
    const octRel = (btnId) => {
      if(!octMap||octs.length===0) return null;
      const o=octMap[btnId]; if(o==null) return null;
      if(octs.length===1) return 2;
      if(octs.length===2) return octs.indexOf(o)===0?1:3;
      const step=(octs.length-1)/2;
      return Math.round(octs.indexOf(o)/step)+1;
    };

    return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontSize:9,color:"#5a3a18",marginBottom:4,letterSpacing:".14em",textAlign:"center",fontFamily:"monospace"}}>
          {label} · {buttons.length}
        </div>
        <div style={{width:Math.ceil(outerW),height:Math.ceil(outerH),position:"relative",flexShrink:0,overflow:"hidden"}}>
          <div style={{position:"absolute",top:Math.ceil(dy),left:Math.ceil(dx),
            width:Math.ceil(scaledW),height:Math.ceil(scaledH),
            transformOrigin:"center center",
            transform:`rotate(${rotation}deg) scaleX(${mirH?-1:1}) scaleY(${mirV?-1:1})`}}>
            <div style={{width:rawW,height:rawH,transformOrigin:"top left",
              transform:`scale(${finalScale})`,position:"relative",touchAction:"none"}}>
              {buttons.map(btn=>{
                const notaLat=bel==="abre"?btn.abre:btn.cierra;
                const notaEng=LAT[notaLat]||notaLat;
                const isVoicing=voicingHighlight.has(notaEng);
                return(
                  <BandBtn key={btn.id} btn={btn} bellows={bel}
                    pressed={pressed} isHeard={heardIds.includes(btn.id)||isVoicing}
                    onDown={onDown} onUp={onUp} oct={octRel(btn.id)}/>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Panel central con notas tocadas y buscador de voicing
  const CentralPanel = () => {
    const CHROMATIC_C=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const ENH2={"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
    const LAT2={"DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F","FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B"};
    const ENG_LAT2=Object.fromEntries(Object.entries(LAT2).map(([k,v])=>[v,k]));
    const [input,setInput]=useState("");
    const [result,setResult]=useState(null);

    const MIDI_C={C:60,"C#":61,D:62,"D#":63,E:64,F:65,"F#":66,G:67,"G#":68,A:69,"A#":70,B:71};

    // VOICINGS — lógica de bajo real:
    // - Mano IZQUIERDA: siempre en octava 2 (grave). Tónica como bajo + opcionalmente quinta.
    // - Mano DERECHA: notas guía (3ª + 7ª) en oct 3-4. Tensiones opcionales en oct 4-5.
    // - Los semitonos se interpretan en ABSOLUTO dentro de la octava del instrumento,
    //   no como distancia desde la raíz en registro agudo.
    // Estructura: left[] = semitonos sobre la raíz para mano izq (oct 2)
    //             right[] = semitonos sobre la raíz para mano der (oct 3-4)
    // Los valores 0-11 = oct 2 (izq) o oct 3 (der)
    // Los valores 12-23 = oct 3 (izq) o oct 4 (der)
    // Los valores 24+ = oct 5 (der, tensiones altas)
    const VOICINGS={
      // TRIADAS
      "maj":[
        {nombre:"Básico",       left:[0],    right:[4,7,12],    desc:"IZQ: raíz(bajo) · DER: 3ª·5ª·8ª"},
        {nombre:"Con quinta",   left:[0,7],  right:[4,12,16],   desc:"IZQ: raíz·5ª(bajo) · DER: 3ª·8ª·10ª"},
      ],
      "min":[
        {nombre:"Básico",       left:[0],    right:[3,7,12],    desc:"IZQ: raíz(bajo) · DER: 3ªm·5ª·8ª"},
        {nombre:"Con quinta",   left:[0,7],  right:[3,12,15],   desc:"IZQ: raíz·5ª(bajo) · DER: 3ªm·8ª·10ª"},
      ],
      // CUATRIADAS — voicing 1 = el más frecuente en tango/jazz
      "7":[
        {nombre:"Con raíz",     left:[0],    right:[4,7,10],    desc:"IZQ: raíz(bajo) · DER: 3ª·5ª·7ªm"},
        {nombre:"Tango/Jazz",   left:[0,7],  right:[4,10,16],   desc:"IZQ: raíz·5ª(bajo) · DER: 3ª·7ªm·9ª"},
        {nombre:"Shell",        left:[0,10], right:[4,16,21],   desc:"IZQ: raíz·7ªm(bajo) · DER: 3ª·9ª·13ª"},
      ],
      "maj7":[
        {nombre:"Con raíz",     left:[0],    right:[4,7,11],    desc:"IZQ: raíz(bajo) · DER: 3ª·5ª·7ª"},
        {nombre:"Clásico",      left:[0,7],  right:[4,11,16],   desc:"IZQ: raíz·5ª(bajo) · DER: 3ª·7ª·9ª"},
        {nombre:"Shell",        left:[0,11], right:[4,16,21],   desc:"IZQ: raíz·7ª(bajo) · DER: 3ª·9ª·13ª"},
      ],
      "min7":[
        {nombre:"Con raíz",     left:[0],    right:[3,7,10],    desc:"IZQ: raíz(bajo) · DER: 3ªm·5ª·7ªm"},
        {nombre:"Tango/Jazz",   left:[0,7],  right:[3,10,16],   desc:"IZQ: raíz·5ª(bajo) · DER: 3ªm·7ªm·9ª"},
        {nombre:"Shell",        left:[0,10], right:[3,16,21],   desc:"IZQ: raíz·7ªm(bajo) · DER: 3ªm·9ª·11ª"},
      ],
      "m7b5":[
        {nombre:"Con raíz",     left:[0],    right:[3,6,10],    desc:"IZQ: raíz(bajo) · DER: 3ªm·5ªb·7ªm"},
        {nombre:"Clásico",      left:[0,6],  right:[3,10,16],   desc:"IZQ: raíz·5ªb(bajo) · DER: 3ªm·7ªm·9ª"},
      ],
      "dim7":[
        {nombre:"Con raíz",     left:[0],    right:[3,6,9],     desc:"IZQ: raíz(bajo) · DER: 3ªm·5ªb·7ªbb"},
        {nombre:"Simétrico",    left:[0,6],  right:[3,9,18],    desc:"IZQ: raíz·5ªb(bajo) · DER: 3ªm·7ªbb·9ªb"},
      ],
      "default":[
        {nombre:"Básico",       left:[0],    right:[4,7,12],    desc:"IZQ: raíz(bajo) · DER: 3ª·5ª·8ª"},
      ],
    };

    const parseCentral=(s)=>{
      const t=s.trim();
      const mLat=t.match(/^(DO#|DO|RE#|RE|MI|FA#|FA|SOL#|SOL|LA#|LA|SI)/i);
      const mEng=t.match(/^([A-G][#b]?)/);
      let root=null,rest="";
      if(mLat){root=LAT2[mLat[1].toUpperCase()];rest=t.slice(mLat[1].length).toLowerCase().trim();}
      else if(mEng){
        root=mEng[1];
        if(root.length>1&&root[1]==="b")root=CHROMATIC_C[(CHROMATIC_C.indexOf(root[0])+11)%12];
        rest=t.slice(mEng[1].length).toLowerCase().trim();
      }
      if(!root)return null;
      let q="maj";
      if(rest.includes("m7b5")||rest.includes("ø"))q="m7b5";
      else if(rest.includes("dim7")||rest.includes("°7"))q="dim7";
      else if(rest.includes("maj7")||rest.includes("△7"))q="maj7";
      else if(rest.includes("m7"))q="min7";
      else if(rest.includes("7"))q="7";
      else if(/^m(?!aj)/.test(rest))q="min";
      const rootIdx=CHROMATIC_C.indexOf(root);
      const vs=VOICINGS[q]||VOICINGS["default"];
      // noteFromSemi: calcula nota y octava real según la mano
      // Mano izquierda: raíz siempre en oct 2 (bajo grave)
      //   semi 0-11 → oct 2 | semi 12-23 → oct 3
      // Mano derecha: notas guía en oct 3-4, tensiones en oct 4-5
      //   semi 0-11 → oct 3 | semi 12-23 → oct 4 | semi 24+ → oct 5
      const noteFromSemi=(semi,hand)=>{
        const e=CHROMATIC_C[(rootIdx+semi+120)%12];
        let oct;
        if(hand==="left"){
          oct = semi<12 ? 2 : 3;
        } else {
          oct = semi<12 ? 3 : semi<24 ? 4 : 5;
        }
        return{eng:e,lat:ENG_LAT2[e]||e,semi,oct};
      };
      const voicings=vs.map(v=>({
        ...v,
        notesLeft: v.left.map(s=>noteFromSemi(s,"left")),
        notesRight:v.right.map(s=>noteFromSemi(s,"right")),
        notes:[
          ...v.left.map(s=>noteFromSemi(s,"left")),
          ...v.right.map(s=>noteFromSemi(s,"right")),
        ],
      }));
      return{rootEng:root,rootLat:ENG_LAT2[root]||root,q,voicings};
    };

    const playVoicing=(notes)=>{
      notes.forEach(({eng,oct},i)=>setTimeout(()=>playBandSound(eng,oct,1.5),i*30));
      setVoicingHighlight(new Set(notes.map(n=>n.eng)));
    };

    const handleAnalyze=()=>{
      const r=parseCentral(input);setResult(r);
      if(r&&r.voicings[0])playVoicing(r.voicings[0].notes);
      else setVoicingHighlight(new Set());
    };

    const hasActive=activeNotes.length>0||heardNote;

    return(
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {hasActive&&(
          <div style={{background:"#09090f",borderRadius:10,padding:"8px 10px",border:"1px solid #1a1a28"}}>
            <div style={{fontSize:8,color:"#383848",marginBottom:5,letterSpacing:".12em",fontFamily:"monospace"}}>TOCANDO AHORA</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:detected?6:0}}>
              {activeNotes.map(n=>{
                const notaPura=n.replace(/\d+$/,"");
                const engKey=LAT[notaPura]||notaPura;
                const oct=(n.match(/\d+$/)||[""])[0];
                return(<span key={n} style={{padding:"2px 6px",borderRadius:20,background:nc(engKey)+"22",border:`1px solid ${nc(engKey)}`,color:nc(engKey),fontWeight:700,fontSize:10}}>{notaPura}<span style={{fontSize:"0.7em",opacity:.6,marginLeft:1}}>{oct}</span></span>);
              })}
            </div>
            {detected&&(
              <>
                <div style={{fontSize:22,fontWeight:900,color:"#88aaff",fontFamily:"serif",lineHeight:1,textAlign:"center",padding:"4px 0 2px"}}>{detected}</div>
                {(()=>{
                  const LAT2loc={"DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F","FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B"};
                  const convDet=detected.replace(/^(DO#|DO|RE#|RE|MI|FA#|FA|SOL#|SOL|LA#|LA|SI)/i,m=>LAT2loc[m.toUpperCase()]||m);
                  const r=parseCentral(convDet);
                  if(!r||!r.voicings[0])return null;
                  const v=r.voicings[0];
                  return(
                    <div style={{marginTop:6,padding:"5px 8px",borderRadius:7,background:"#0a0a1a",border:"1px solid #1a1a38"}}>
                      <div style={{fontSize:7,color:"#555",fontFamily:"monospace",marginBottom:4,letterSpacing:".1em"}}>VOICING SUGERIDO</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                        <div style={{borderLeft:"2px solid #34d39933",paddingLeft:5}}>
                          <div style={{fontSize:6,color:"#34d399",marginBottom:3,fontFamily:"monospace"}}>IZQ ←</div>
                          <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
                            {v.notesLeft.map((n,ni)=>(<span key={ni} style={{padding:"1px 5px",borderRadius:4,background:nc(n.eng)+"22",border:"1px solid "+nc(n.eng)+"55",fontSize:9,fontWeight:800,color:nc(n.eng),fontFamily:"monospace"}}>{n.lat}<span style={{fontSize:6,opacity:.5,marginLeft:1}}>{n.oct}</span></span>))}
                          </div>
                        </div>
                        <div style={{borderLeft:"2px solid #f472b633",paddingLeft:5}}>
                          <div style={{fontSize:6,color:"#f472b6",marginBottom:3,fontFamily:"monospace"}}>DER →</div>
                          <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
                            {v.notesRight.map((n,ni)=>(<span key={ni} style={{padding:"1px 5px",borderRadius:4,background:nc(n.eng)+"22",border:"1px solid "+nc(n.eng)+"55",fontSize:9,fontWeight:800,color:nc(n.eng),fontFamily:"monospace"}}>{n.lat}<span style={{fontSize:6,opacity:.5,marginLeft:1}}>{n.oct}</span></span>))}
                          </div>
                        </div>
                      </div>
                      <div style={{fontSize:7,color:"#333",marginTop:3,fontStyle:"italic",fontFamily:"monospace"}}>{v.desc}</div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        <div style={{background:"#09090f",borderRadius:10,padding:"8px 10px",border:"1px solid #1a1a28"}}>
          <div style={{fontSize:8,color:"#383848",marginBottom:6,letterSpacing:".12em",fontFamily:"monospace"}}>CONSULTAR VOICING</div>
          <div style={{display:"flex",gap:4,marginBottom:6}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAnalyze()}
              placeholder="Ej: Rem7, Sol7, Dm7"
              style={{flex:1,background:"#111120",border:"1px solid #2a2a44",borderRadius:6,padding:"4px 7px",color:"#ccc",fontSize:10,fontFamily:"monospace",outline:"none"}}/>
            <button onClick={handleAnalyze} style={{padding:"4px 9px",borderRadius:6,border:"none",background:"#1e2a4a",color:"#88aaff",fontWeight:700,fontSize:10,cursor:"pointer"}}>▶</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {["Dm7","G7","Cmaj7","Am7b5","E7","Am"].map(ex=>(
              <button key={ex} onClick={()=>{setInput(ex);const r=parseCentral(ex);setResult(r);if(r&&r.voicings[0])playVoicing(r.voicings[0].notes);}}
                style={{padding:"2px 6px",borderRadius:5,border:"1px solid #222234",background:"transparent",color:"#444466",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {result&&(
          <div style={{background:"#09090f",borderRadius:10,padding:"8px 10px",border:"1px solid #1a1a28"}}>
            <div style={{fontSize:9,color:"#88aaff",fontWeight:700,fontFamily:"serif",marginBottom:6,textAlign:"center"}}>
              {result.rootLat}<span style={{opacity:.7}}>{result.q}</span>
            </div>
            {result.voicings.map((v,vi)=>(
              <div key={vi} onClick={()=>playVoicing(v.notes)}
                style={{marginBottom:5,padding:"6px 8px",borderRadius:8,
                  border:`1px solid ${vi===0?"#2a2a50":"#141420"}`,
                  background:vi===0?"#0d0d1e":"transparent",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:9,fontWeight:700,color:vi===0?"#88aaff":"#555",fontFamily:"monospace"}}>{v.nombre}</span>
                  <span style={{fontSize:8,color:"#333"}}>▶</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                  <div style={{background:"#08080e",borderRadius:6,padding:"4px 6px",borderLeft:"2px solid #34d39944"}}>
                    <div style={{fontSize:7,color:"#34d399",marginBottom:3,fontFamily:"monospace"}}>← IZQ (bajo)</div>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {v.notesLeft.map((n,ni)=>(
                        <div key={ni} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"2px 4px",borderRadius:4,background:nc(n.eng)+"22",border:`1px solid ${nc(n.eng)}55`}}>
                          <span style={{fontSize:9,fontWeight:800,color:nc(n.eng),fontFamily:"monospace"}}>{n.lat}</span>
                          <span style={{fontSize:6,color:"#444"}}>{n.oct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{background:"#08080e",borderRadius:6,padding:"4px 6px",borderLeft:"2px solid #f472b644"}}>
                    <div style={{fontSize:7,color:"#f472b6",marginBottom:3,fontFamily:"monospace"}}>DER → (acorde)</div>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {v.notesRight.map((n,ni)=>(
                        <div key={ni} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"2px 4px",borderRadius:4,background:nc(n.eng)+"22",border:`1px solid ${nc(n.eng)}55`}}>
                          <span style={{fontSize:9,fontWeight:800,color:nc(n.eng),fontFamily:"monospace"}}>{n.lat}</span>
                          <span style={{fontSize:6,color:"#444"}}>{n.oct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:7,color:"#333",marginTop:4,fontStyle:"italic",fontFamily:"monospace"}}>{v.desc}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{fontSize:8,color:"#2a2a3a",fontFamily:"monospace",textAlign:"center",lineHeight:1.6}}>
          Rheinische · 71 botones · <span style={{color:"#1a3a1a"}}>▷ abre</span> · <span style={{color:"#3a1a3a"}}>◁ cierra</span>
        </div>
      </div>
    );
  };

  // Controles de layout
  const Slider=({label,val,min,max,keyName})=>(
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
      <span style={{fontSize:10,color:"#7a5030",width:44,flexShrink:0}}>{label}</span>
      <input type="range" min={min} max={max} value={val}
        onChange={e=>updateLayout(keyName,parseInt(e.target.value))}
        style={{flex:1,accentColor:"#f5c060",height:3,cursor:"pointer"}}/>
      <span style={{fontSize:10,color:"#f5c060",width:34,textAlign:"right",fontFamily:"monospace"}}>
        {val}{keyName.startsWith("rot")?"°":"%"}
      </span>
    </div>
  );

  const MirBtn=({label,keyName})=>(
    <button onClick={()=>updateLayout(keyName,!layout[keyName])}
      style={{fontSize:10,padding:"2px 8px",borderRadius:5,cursor:"pointer",fontFamily:"monospace",
        border:`1px solid ${layout[keyName]?"#f5c060":"#3a2010"}`,
        background:layout[keyName]?"#2a1804":"transparent",
        color:layout[keyName]?"#f5c060":"#6a4020"}}>
      {label}
    </button>
  );

  const showL=view==="ambas"||view==="izquierda";
  const showR=view==="ambas"||view==="derecha";

  return(
    <div ref={containerRef} style={{width:"100%",paddingBottom:8}}>

      {/* Panel de control de layout */}
      <div style={{marginBottom:10}}>
        <button onClick={()=>setShowLayoutCtrl(p=>!p)}
          style={{fontSize:10,padding:"3px 10px",borderRadius:6,border:"1px solid #3a2010",
            background:"transparent",color:showLayoutCtrl?"#f5c060":"#6a4020",
            fontFamily:"monospace",cursor:"pointer"}}>
          ⚙ Posición teclados {showLayoutCtrl?"▲":"▼"}
        </button>
        {showLayoutCtrl&&(
          <div style={{marginTop:8,padding:"10px 14px",background:"#100802",border:"1px solid #3a2010",borderRadius:10,display:"flex",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 180px",minWidth:160}}>
              <div style={{fontSize:10,fontWeight:700,color:"#34d399",marginBottom:6,fontFamily:"monospace"}}>← IZQ</div>
              <Slider label="rotación" val={layout.rotL} min={-180} max={180} keyName="rotL"/>
              <Slider label="escala"   val={layout.scaleL} min={40} max={150} keyName="scaleL"/>
              <div style={{display:"flex",gap:5,marginTop:4}}><MirBtn label="↔ H" keyName="mirLH"/><MirBtn label="↕ V" keyName="mirLV"/></div>
            </div>
            <div style={{flex:"1 1 180px",minWidth:160}}>
              <div style={{fontSize:10,fontWeight:700,color:"#f472b6",marginBottom:6,fontFamily:"monospace"}}>DER →</div>
              <Slider label="rotación" val={layout.rotR} min={-180} max={180} keyName="rotR"/>
              <Slider label="escala"   val={layout.scaleR} min={40} max={150} keyName="scaleR"/>
              <div style={{display:"flex",gap:5,marginTop:4}}><MirBtn label="↔ H" keyName="mirRH"/><MirBtn label="↕ V" keyName="mirRV"/></div>
            </div>
            <div style={{flex:"1 1 140px",minWidth:120}}>
              <div style={{fontSize:10,fontWeight:700,color:"#888",marginBottom:6,fontFamily:"monospace"}}>PRESETS</div>
              {[["normal","horizontal"],["rotados","±90° instrumento"],["espejados","espejados"],["vertical","apilado"]].map(([k,l])=>(
                <button key={k} onClick={()=>applyPreset(k)}
                  style={{display:"block",width:"100%",textAlign:"left",fontSize:10,padding:"3px 8px",marginBottom:3,borderRadius:5,border:"1px solid #3a2010",background:"transparent",color:"#7a5030",fontFamily:"monospace",cursor:"pointer"}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Teclados */}
      <div style={{display:"flex",gap:GAP*2,justifyContent:"center",alignItems:"flex-start",marginBottom:12,flexWrap:"nowrap"}}>
        {showL&&(
          <ScaledCanvas buttons={leftBtns} bellows={bellows} pressed={pressedL} heardIds={heardIdsL}
            onDown={downL} onUp={upL} octMap={bellows==="abre"?OCT_L_OPEN:OCT_L_CLOSE}
            rawW={rawW_L} rawH={rawH_L} label="← IZQ"
            rotation={layout.rotL} scalePct={layout.scaleL} mirH={layout.mirLH} mirV={layout.mirLV}/>
        )}
        {showR&&(
          <ScaledCanvas buttons={rightBtns} bellows={bellows} pressed={pressedR} heardIds={heardIdsR}
            onDown={downR} onUp={upR} octMap={bellows==="abre"?OCT_R_OPEN:OCT_R_CLOSE}
            rawW={rawW_R} rawH={rawH_R} label="DER →"
            rotation={layout.rotR} scalePct={layout.scaleR} mirH={layout.mirRH} mirV={layout.mirRV}/>
        )}
      </div>

      {/* Panel inferior */}
      <div style={{width:"100%"}}><CentralPanel/></div>
    </div>
  );
}

// ─── EDITOR DRAG & DROP ───────────────────────────────────────────────────────
function BandEditor({ initialLeft, initialRight, onSave, onCancel }) {
  const [leftBtns,  setLeftBtns]  = useState(()=>initialLeft.map(b=>({...b})));
  const [rightBtns, setRightBtns] = useState(()=>initialRight.map(b=>({...b})));
  const [mode,      setMode]      = useState("abre");
  const [selected,  setSelected]  = useState(null);
  const [popupPos,  setPopupPos]  = useState(null);
  const [copied,    setCopied]    = useState(false);

  const selBtn = selected
    ? (selected.side==="L" ? leftBtns : rightBtns).find(b=>b.id===selected.id)
    : null;

  const editBtn = (id, side, field, val) => {
    const setter = side==="L" ? setLeftBtns : setRightBtns;
    setter(p=>p.map(b=>b.id===id ? {...b,[field]:val} : b));
  };

  const handleBtnClick = (btn, side, e) => {
    if(selected?.id===btn.id && selected?.side===side){setSelected(null);setPopupPos(null);return;}
    setSelected({id:btn.id, side});
    if(e){
      const rect=e.currentTarget.getBoundingClientRect();
      const cont=document.getElementById("band-editor-cont");
      const cRect=cont?cont.getBoundingClientRect():{left:0,top:0};
      setPopupPos({x:rect.left-cRect.left+rect.width/2, y:rect.top-cRect.top-8});
    }
  };

  const jsText=()=>{
    const fmt=(arr,name)=>{
      const ls=arr.map(b=>`  { id:"${b.id}", row:${b.row}, x:${b.x}, y:${b.y}, abre:"${b.abre}", cierra:"${b.cierra}", color_abre:"${b.color_abre}", color_cierra:"${b.color_cierra}", oct_abre:${b.oct_abre??3}, oct_cierra:${b.oct_cierra??3} },`);
      return`const ${name} = [\n${ls.join("\n")}\n];`;
    };
    return`// Pegá esto en App.jsx\n\n`+fmt(leftBtns,"DEFS_L")+"\n\n"+fmt(rightBtns,"DEFS_R");
  };

  const pill=(active,v="orange")=>({
    padding:"5px 12px",borderRadius:8,border:"none",fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:10,cursor:"pointer",
    background:active?(v==="orange"?"linear-gradient(135deg,#a05010,#f5c060)":"linear-gradient(135deg,#1a4a8a,#4a8af0)"):"transparent",
    color:active?(v==="orange"?"#0a0502":"#fff"):"#6a4020",
  });

  const EditorCanvas=({buttons,side,label})=>{
    const rawW=Math.max(...buttons.map(b=>b.x))+BTN_SIZE+16;
    const rawH=Math.max(...buttons.map(b=>b.y))+BTN_SIZE+20;
    return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <p style={{fontSize:9,color:"#7a5030",marginBottom:4,letterSpacing:".1em",fontFamily:"monospace"}}>{label}</p>
        <div style={{position:"relative",width:rawW,height:rawH,flexShrink:0,
          background:"linear-gradient(145deg,#281a08,#140e04)",
          border:`2px solid ${selected?.side===side?"#f5c060":"#3a2010"}`,borderRadius:14}}>
          {buttons.map(btn=>{
            const note=mode==="abre"?btn.abre:btn.cierra;
            const color=mode==="abre"?btn.color_abre:btn.color_cierra;
            const isSel=selected?.id===btn.id&&selected?.side===side;
            return(
              <div key={btn.id} onClick={e=>handleBtnClick(btn,side,e)}
                style={{position:"absolute",left:btn.x,top:btn.y,width:BTN_SIZE,height:BTN_SIZE,borderRadius:"50%",cursor:"pointer",userSelect:"none",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  background:isSel?`radial-gradient(circle at 36% 30%,${color}ff,${color}cc)`:`radial-gradient(circle at 36% 30%,${color}99,${color}44 60%,${color}22)`,
                  border:`2.5px solid ${isSel?"#f5c060":color+"aa"}`,
                  boxShadow:isSel?`0 0 0 3px #f5c06088,0 0 18px ${color}cc`:`0 2px 8px rgba(0,0,0,.7)`,
                  transform:isSel?"scale(1.15)":"scale(1)",transition:"all .15s",zIndex:isSel?30:1}}>
                <span style={{fontSize:note.length>2?7:9,fontWeight:800,color:"#fff",fontFamily:"monospace",lineHeight:1,textShadow:"0 1px 3px rgba(0,0,0,.9)"}}>{note}</span>
                <span style={{fontSize:6,color:"rgba(255,255,255,.7)",fontFamily:"monospace"}}>{mode==="abre"?(btn.oct_abre??"-"):(btn.oct_cierra??"-")}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return(
    <div style={{fontFamily:"'Courier New',monospace"}}>
      <div style={{marginBottom:10,padding:"8px 14px",background:"#1a0e04",border:"1.5px solid #f5c060",borderRadius:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{color:"#f5c060",fontWeight:800,fontSize:12}}>✏️ MODO EDICIÓN</span>
        <span style={{color:"#7a5030",fontSize:10}}>Hacé clic en cualquier botón para editar</span>
        <button onClick={()=>onSave(leftBtns,rightBtns)} style={{padding:"6px 16px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0d9488,#2dd4bf)",color:"#0a0502",fontWeight:800,fontSize:12,cursor:"pointer",marginLeft:"auto"}}>💾 Guardar y salir</button>
        <button onClick={onCancel} style={{padding:"6px 12px",borderRadius:9,border:"1px solid #3a2010",background:"transparent",color:"#7a5030",fontSize:11,cursor:"pointer"}}>Cancelar</button>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",background:"#100802",border:"1.5px solid #3a2010",borderRadius:10,padding:3,gap:3}}>
          <button style={pill(mode==="abre")}   onClick={()=>{setMode("abre");  setSelected(null);setPopupPos(null);}}>▷ Abre</button>
          <button style={pill(mode==="cierra")} onClick={()=>{setMode("cierra");setSelected(null);setPopupPos(null);}}>◁ Cierra</button>
        </div>
        <span style={{fontSize:9,color:"#4a2a08"}}>{selected?`${selected.id} — ${selected.side==="L"?"Mano Izq":"Mano Der"}`:"Tocá un botón"}</span>
        {selected&&<button onClick={()=>{setSelected(null);setPopupPos(null);}} style={{marginLeft:"auto",padding:"3px 10px",borderRadius:6,border:"1px solid #3a2010",background:"transparent",color:"#6a4020",fontSize:10,cursor:"pointer"}}>✕</button>}
      </div>

      <div id="band-editor-cont" style={{position:"relative"}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center",paddingBottom:8,overflowX:"auto"}}>
          <EditorCanvas buttons={leftBtns}  side="L" label="MANO IZQUIERDA"/>
          <EditorCanvas buttons={rightBtns} side="R" label="MANO DERECHA"/>
        </div>

        {selBtn&&popupPos&&(
          <div style={{position:"absolute",left:Math.max(10,Math.min(popupPos.x-140,600)),top:Math.max(10,popupPos.y-195),
            width:288,background:"#0e0a02",border:"1.5px solid #f5c060",borderRadius:12,padding:"10px 12px",zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,.85)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{color:"#f5c060",fontWeight:800,fontSize:12}}>{selBtn.id} — {selected.side==="L"?"IZQ":"DER"}</span>
              <button onClick={()=>{setSelected(null);setPopupPos(null);}} style={{background:"transparent",border:"none",color:"#6a4020",fontSize:14,cursor:"pointer",lineHeight:1}}>✕</button>
            </div>
            <div style={{padding:"6px 8px",background:"#0a1408",borderRadius:7,border:"1px solid #2a4010",marginBottom:5}}>
              <p style={{fontSize:8,fontWeight:700,color:"#34d399",letterSpacing:".1em",marginBottom:5}}>▷ ABRIENDO</p>
              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                <select value={selBtn.abre} onChange={e=>editBtn(selBtn.id,selected.side,"abre",e.target.value)}
                  style={{background:"#1a0e04",color:"#34d399",border:"1px solid #34d39955",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:11,cursor:"pointer",width:70}}>
                  {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{fontSize:9,color:"#4a3010"}}>oct.</span>
                <select value={selBtn.oct_abre??3} onChange={e=>editBtn(selBtn.id,selected.side,"oct_abre",parseInt(e.target.value))}
                  style={{background:"#1a0e04",color:"#34d399",border:"1px solid #34d39955",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:11,cursor:"pointer",width:46}}>
                  {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <input type="color" value={selBtn.color_abre||"#888"} onChange={e=>editBtn(selBtn.id,selected.side,"color_abre",e.target.value)}
                  style={{width:26,height:22,padding:1,borderRadius:4,border:"none",cursor:"pointer"}}/>
              </div>
            </div>
            <div style={{padding:"6px 8px",background:"#140a14",borderRadius:7,border:"1px solid #401040"}}>
              <p style={{fontSize:8,fontWeight:700,color:"#f472b6",letterSpacing:".1em",marginBottom:5}}>◁ CERRANDO</p>
              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                <select value={selBtn.cierra} onChange={e=>editBtn(selBtn.id,selected.side,"cierra",e.target.value)}
                  style={{background:"#1a0e04",color:"#f472b6",border:"1px solid #f472b655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:11,cursor:"pointer",width:70}}>
                  {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{fontSize:9,color:"#4a3010"}}>oct.</span>
                <select value={selBtn.oct_cierra??3} onChange={e=>editBtn(selBtn.id,selected.side,"oct_cierra",parseInt(e.target.value))}
                  style={{background:"#1a0e04",color:"#f472b6",border:"1px solid #f472b655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:11,cursor:"pointer",width:46}}>
                  {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <input type="color" value={selBtn.color_cierra||"#888"} onChange={e=>editBtn(selBtn.id,selected.side,"color_cierra",e.target.value)}
                  style={{width:26,height:22,padding:1,borderRadius:4,border:"none",cursor:"pointer"}}/>
              </div>
            </div>
            <div style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",borderTop:"8px solid #f5c060"}}/>
          </div>
        )}
      </div>

      <div style={{marginTop:12,display:"flex",gap:6}}>
        <button onClick={()=>navigator.clipboard.writeText(jsText()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})}
          style={{padding:"4px 12px",borderRadius:7,border:"1px solid #3a2010",background:copied?"#0d9488":"#1a0e04",color:copied?"#fff":"#f5c060",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer"}}>
          {copied?"✓ Copiado":"↓ Copiar JS para el repo"}
        </button>
      </div>
    </div>
  );
}

// ─── BANDONEÓN TAB PRINCIPAL ──────────────────────────────────────────────────
function BandoneonTab() {
  const [leftBtns,    setLeftBtns]    = useState([]);
  const [rightBtns,   setRightBtns]   = useState([]);
  const [editMode,    setEditMode]    = useState(false);

  // Mapas de octava derivados de los botones cargados
  const { OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE } = useMemo(
    () => buildOctMaps(leftBtns, rightBtns),
    [leftBtns, rightBtns]
  );
  const [bellows,     setBellows]     = useState("abre");
  const [view,        setView]        = useState("ambas");
  const [pressedL,    setPressedL]    = useState([]);
  const [pressedR,    setPressedR]    = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [heardNote,   setHeardNote]   = useState("");
  const [errorAudio,  setErrorAudio]  = useState("");
  const [showSaved,   setShowSaved]   = useState(false);
  const [showImport,  setShowImport]  = useState(false);
  const [cssText,     setCSSText]     = useState("");
  const [fromStorage, setFromStorage] = useState(false);

  // Ref para guardar los nodos de sonido activos — permite cortar exactamente al soltar
  // Mapa: btnId → {stop()} devuelto por playBandSound
  const soundNodes = useRef({});

  const LAT = {"DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F","FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B"};
  const ENG_TO_LAT = {"C":"DO","C#":"DO#","D":"RE","D#":"RE#","E":"MI","F":"FA","F#":"FA#","G":"SOL","G#":"SOL#","A":"LA","A#":"LA#","B":"SI"};
  const NOTES_ENG = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const CHROMATIC_B = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  const noteIdxB = n => {
    const i=CHROMATIC_B.indexOf(n); if(i>=0)return i;
    const m={"Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#"};
    return CHROMATIC_B.indexOf(m[n]??"");
  };

  // Cargar al montar
  useEffect(()=>{
    const {left,right}=loadBtns();
    setLeftBtns(left); setRightBtns(right);
    try { setFromStorage(!!localStorage.getItem(STORAGE_KEY_L)); } catch {}
  },[]);

  // Micrófono YIN
  const NOTES_ENG_MEMO  = useMemo(()=>NOTES_ENG, []);
  const ENG_TO_LAT_MEMO = useMemo(()=>ENG_TO_LAT,[]);

  useEffect(()=>{
    if(!isListening){setHeardNote("");return;}

    // Refs para garantizar cleanup aunque el componente se desmonte
    let audioCtx = null;
    let stream   = null;
    let rafId    = null;
    let alive    = true;  // flag para cancelar tick si el efecto se limpió

    async function start(){
      try{
        stream = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
        if(!alive){stream.getTracks().forEach(t=>t.stop());return;}

        const AC = window.AudioContext||(window.webkitAudioContext);
        audioCtx = new AC();
        if(audioCtx.state==="suspended") await audioCtx.resume();
        if(!alive){audioCtx.close();stream.getTracks().forEach(t=>t.stop());return;}

        const src      = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);

        const buf    = new Float32Array(analyser.fftSize);
        const detect = YIN({sampleRate: audioCtx.sampleRate||44100});

        function tick(){
          if(!alive) return;  // no seguir si el efecto fue limpiado
          analyser.getFloatTimeDomainData(buf);
          const pitch = detect(buf);
          if(pitch && pitch > 50 && pitch < 2000){
            const noteNum  = 12*(Math.log(pitch/440)/Math.log(2))+69;
            const midiRnd  = Math.round(noteNum);
            const eng      = NOTES_ENG[midiRnd % 12];
            const octave   = Math.floor(midiRnd / 12) - 1;
            const lat      = ENG_TO_LAT[eng] || "DO";
            setHeardNote(lat + octave);
          } else {
            setHeardNote("");
          }
          rafId = requestAnimationFrame(tick);
        }
        tick();
      }catch(err){
        if(alive){
          setErrorAudio("Error de micrófono: "+(err?.message??"permisos denegados"));
          setIsListening(false);
        }
      }
    }

    start();

    return()=>{
      alive = false;  // detiene el tick inmediatamente
      if(rafId)    cancelAnimationFrame(rafId);
      if(stream)   stream.getTracks().forEach(t=>t.stop());
      if(audioCtx && audioCtx.state!=="closed") audioCtx.close();
    };
  },[isListening]);


  // IDs iluminados por mic
  // heardNote es "SOL3" (nota+octava) — iluminar solo el botón con esa nota en esa octava
  const heardIdsL = useMemo(()=>{
    if(!heardNote) return [];
    const octMapL = bellows==="abre" ? OCT_L_OPEN : OCT_L_CLOSE;
    return leftBtns
      .filter(b=>{
        const nota = bellows==="abre" ? b.abre : b.cierra;
        return (nota + (octMapL[b.id]??"")) === heardNote;
      })
      .map(b=>b.id);
  }, [heardNote,bellows,leftBtns]);
  const heardIdsR = useMemo(()=>{
    if(!heardNote) return [];
    const octMapR = bellows==="abre" ? OCT_R_OPEN : OCT_R_CLOSE;
    return rightBtns
      .filter(b=>{
        const nota = bellows==="abre" ? b.abre : b.cierra;
        return (nota + (octMapR[b.id]??"")) === heardNote;
      })
      .map(b=>b.id);
  }, [heardNote,bellows,rightBtns]);

  // Notas activas
  const activeNotes = useMemo(()=>{
    const octL = bellows==="abre" ? OCT_L_OPEN : OCT_L_CLOSE;
    const octR = bellows==="abre" ? OCT_R_OPEN : OCT_R_CLOSE;
    const all=[
      ...pressedL.map(id=>{
        const b=leftBtns.find(x=>x.id===id); if(!b) return "";
        const nota=LAT[bellows==="abre"?b.abre:b.cierra]??"";
        return nota ? nota+(octL[id]??"") : "";
      }),
      ...pressedR.map(id=>{
        const b=rightBtns.find(x=>x.id===id); if(!b) return "";
        const nota=LAT[bellows==="abre"?b.abre:b.cierra]??"";
        return nota ? nota+(octR[id]??"") : "";
      }),
    ].filter(n=>n.trim());
    return[...new Set(all)];
  },[pressedL,pressedR,bellows,leftBtns,rightBtns]);

  // Detección de acorde
  // Algoritmo: probar cada nota única como raíz potencial (rotación de inversiones).
  // Para cada candidata se calculan los intervalos desde ella y se evalúa
  // si coincide con un patrón conocido. Se elige la raíz con mejor match,
  // priorizando calidades más específicas (m7b5 > dim7 > maj7 > ...).
  const detected = useMemo(()=>{
    if(activeNotes.length<2)return null;

    // Extraer notas únicas (sin octava, sin duplicados por clase de nota)
    const noteOnly = [...new Set(activeNotes.map(n=>n.replace(/\d+$/,"")))];
    const uniqueIdxs = [...new Set(noteOnly.map(n=>noteIdxB(n)).filter(i=>i>=0))];
    if(uniqueIdxs.length<2) return null;

    // Tabla de patrones: calidad → intervalos requeridos (orden importa para prioridad)
    const PATTERNS = [
      { q:"m7b5",  ivs:[3,6,10] },
      { q:"dim7",  ivs:[3,6,9]  },
      { q:"maj7",  ivs:[4,7,11] },
      { q:"m7",    ivs:[3,7,10] },
      { q:"7",     ivs:[4,7,10] },
      { q:"maj",   ivs:[4,7]    },
      { q:"m",     ivs:[3,7]    },
      { q:"dim",   ivs:[3,6]    },
      { q:"aug",   ivs:[4,8]    },
      { q:"sus4",  ivs:[5,7]    },
      { q:"sus2",  ivs:[2,7]    },
    ];

    // Intentar cada nota única como raíz
    let bestRoot = null, bestQ = null, bestScore = -1;

    for(const rootIdx of uniqueIdxs){
      const ivs = uniqueIdxs
        .map(i => (i - rootIdx + 12) % 12)
        .filter(i => i !== 0)
        .sort((a,b)=>a-b);
      const hasAll = (required) => required.every(r => ivs.includes(r));

      for(let pi=0; pi<PATTERNS.length; pi++){
        const {q, ivs: req} = PATTERNS[pi];
        if(hasAll(req)){
          // Puntuación: favorece patrones con más intervalos coincidentes
          // y aparece antes en la lista (más específico)
          const score = req.length * 100 - pi;
          if(score > bestScore){
            bestScore = score;
            bestRoot  = rootIdx;
            bestQ     = q;
          }
          break; // un match por raíz candidata es suficiente
        }
      }
    }

    if(bestRoot === null) return null;
    const rootEng = CHROMATIC_B[bestRoot];
    const rootLat = ENG_TO_LAT[rootEng] ?? rootEng;
    return `${rootLat}${bestQ}`;
  },[activeNotes]);

  const getOct = useCallback((btn, bellows) => {
    // Usar oct_abre/oct_cierra del botón directamente (editables por el usuario)
    return bellows === "abre"
      ? (btn.oct_abre  ?? (btn.id.startsWith("L") ? 2 : 4))
      : (btn.oct_cierra ?? (btn.id.startsWith("L") ? 2 : 4));
  }, []);

  const downL=useCallback((btn)=>{
    if(soundNodes.current[btn.id]) return; // ya está sonando
    const oct  = getOct(btn, bellows);
    const note = bellows==='abre' ? btn.abre : btn.cierra;
    const eng  = LAT[note]||note;
    // Inicia nota con sustain real — el nodo queda vivo hasta upL
    soundNodes.current[btn.id] = playBandSound(eng, oct, null);
    setPressedL(p=>[...new Set([...p,btn.id])]);
  },[bellows,getOct,LAT]);

  const upL = useCallback((id)=>{
    if(soundNodes.current[id]){
      soundNodes.current[id].stop();
      delete soundNodes.current[id];
    }
    setPressedL(p=>p.filter(x=>x!==id));
  },[]);

  const downR=useCallback((btn)=>{
    if(soundNodes.current[btn.id]) return;
    const oct  = getOct(btn, bellows);
    const note = bellows==='abre' ? btn.abre : btn.cierra;
    const eng  = LAT[note]||note;
    soundNodes.current[btn.id] = playBandSound(eng, oct, null);
    setPressedR(p=>[...new Set([...p,btn.id])]);
  },[bellows,getOct,LAT]);

  const upR = useCallback((id)=>{
    if(soundNodes.current[id]){
      soundNodes.current[id].stop();
      delete soundNodes.current[id];
    }
    setPressedR(p=>p.filter(x=>x!==id));
  },[]);

  const handleSave=useCallback((left,right)=>{
    setLeftBtns(left); setRightBtns(right);
    saveBtns(left,right); downloadCSV(left,right);
    setCSSText(generateCSS(left,right));
    setEditMode(false); setShowSaved(true); setFromStorage(true);
  },[]);

  const handleImport=useCallback((left,right)=>{
    setLeftBtns(left); setRightBtns(right);
    saveBtns(left,right); setFromStorage(true); setShowImport(false);
  },[]);

  const pill=(active,v="orange")=>({
    padding:"5px 12px",borderRadius:8,border:"none",
    fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:10,cursor:"pointer",transition:"all .18s",
    background:active?(v==="orange"?"linear-gradient(135deg,#a05010,#f5c060)":"linear-gradient(135deg,#1a4a8a,#4a8af0)"):"transparent",
    color:active?(v==="orange"?"#0a0502":"#fff"):"#6a4020",
  });

  // Detectar móvil
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  },[]);

  if (!leftBtns.length) return <div style={{color:"#555",padding:20,fontSize:13}}>Cargando...</div>;

  if (editMode) return (
    <BandEditor initialLeft={leftBtns} initialRight={rightBtns} onSave={handleSave} onCancel={()=>setEditMode(false)}/>
  );

  return (
    <div style={{fontFamily:"'Courier New',monospace"}}>

      {/* Barra herramientas */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14,padding:"8px 12px",background:"#080810",border:"1px solid #1e1e2e",borderRadius:10}}>
        <div style={{display:"flex",alignItems:"center",gap:5,flex:"1 1 auto"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:fromStorage?"#2dd4bf":"#6b7280"}}/>
          <span style={{fontSize:10,color:fromStorage?"#2dd4bf":"#6b7280",fontFamily:"monospace"}}>
            {fromStorage?"Config. personalizada":"Config. por defecto"}
          </span>
        </div>
        <button onClick={()=>{setIsListening(false);setEditMode(true);}} style={{padding:"5px 13px",borderRadius:9,border:"1px solid #4466cc",background:"#1e2a4a",color:"#88aaff",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>✏️ Editar teclado</button>
        <button onClick={()=>setShowImport(true)} style={{padding:"5px 13px",borderRadius:9,border:"1px solid #2dd4bf44",background:"transparent",color:"#2dd4bf",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>↑ Importar CSV</button>
        {fromStorage&&(
          <button
            onClick={()=>{clearBtns();const{left,right}=loadBtns();setLeftBtns(left);setRightBtns(right);setFromStorage(false);}}
            style={{padding:"5px 10px",borderRadius:9,border:"1px solid #374151",
              background:"transparent",color:"#6b7280",fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>
            ⟳ Defaults
          </button>
        )}
      </div>

      {/* Panel mic */}
      <div style={{marginBottom:10,padding:"8px 12px",background:"#0a0602",border:"1.5px dashed #5a3018",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6,minHeight:56}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 auto"}}>
          <div style={{width:9,height:9,borderRadius:"50%",background:isListening?"#2DD4BF":"#4a2e10",boxShadow:isListening?"0 0 8px #2DD4BF":"none",flexShrink:0}}/>
          <div>
            <div style={{fontSize:10,fontWeight:800,color:"#eab308"}}>MODO ESCUCHA FÍSICA</div>
            <div style={{fontSize:8,color:"#6a4020"}}>Tocá tu instrumento. Los botones con esa nota brillan en blanco.</div>
          </div>
        </div>
        {isListening&&(
          <div style={{background:"#0c0c1a",border:"1px solid #88aaff44",padding:"3px 10px",borderRadius:8,minWidth:55,textAlign:"center"}}>
            <span style={{fontSize:8,color:"#6a4020",display:"block"}}>NOTA MIC</span>
            <span style={{fontSize:13,fontWeight:900,color:heardNote?"#88aaff":"#4a2e10"}}>
              {heardNote
                ? heardNote.replace(/(\d+)$/, "") + " " + (heardNote.match(/\d+$/) || [""])[0]
                : "..."}
            </span>
          </div>
        )}
        <button
          onClick={()=>{setIsListening(p=>!p);setErrorAudio("");}}
          style={{
            padding:"5px 12px",borderRadius:9,border:"none",
            fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",
            background:isListening?"linear-gradient(135deg,#941c1c,#ef4444)":"linear-gradient(135deg,#134e4a,#2dd4bf)",
            color:isListening?"#fff":"#0f172a",
          }}>
          {isListening?"✕ Apagar Mic":"🎙️ Escuchar"}
        </button>
      </div>
      {errorAudio&&<div style={{marginBottom:10,padding:"5px 10px",background:"#270808",border:"1px solid #ef444455",borderRadius:6,fontSize:9,color:"#f87171"}}>⚠ {errorAudio}</div>}

      {/* Controles fuelle/vista */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
        {/* Fuelle */}
        <div style={{display:"flex",background:"#100802",border:"1.5px solid #3a2010",borderRadius:10,padding:3,gap:2}}>
          {[["abre","▷ Abre"],["cierra","◁ Cierra"]].map(([b,l])=>(
            <button key={b} style={{...pill(bellows===b),padding:isMobile?"5px 10px":"5px 12px"}}
              onClick={()=>{
                // Cortar todos los sonidos activos antes de cambiar fuelle
                Object.values(soundNodes.current).forEach(n=>n.stop());
                soundNodes.current={};
                setBellows(b);setPressedL([]);setPressedR([]);
              }}>{l}</button>
          ))}
        </div>
        {/* Vista — en móvil solo mostrar si es "ambas" para ahorrar espacio */}
        <div style={{display:"flex",background:"#100802",border:"1.5px solid #2a3060",borderRadius:10,padding:3,gap:2}}>
          {[["ambas","Ambas"],["izquierda","IZQ"],["derecha","DER"]].map(([v,l])=>(
            <button key={v} style={{...pill(view===v,"blue"),padding:isMobile?"5px 8px":"5px 12px"}}
              onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
        <button onClick={()=>{Object.values(soundNodes.current).forEach(n=>n.stop());soundNodes.current={};setPressedL([]);setPressedR([]);}}
          style={{padding:"5px 9px",borderRadius:9,border:"1px solid #3a2010",background:"transparent",color:"#6a4020",fontFamily:"monospace",fontSize:10,cursor:"pointer",marginLeft:"auto"}}>
          ✕
        </button>
      </div>

      {/* ── LAYOUT PRINCIPAL: Móvil apilado / Desktop 3 columnas ── */}
      {isMobile ? (
        // ── MÓVIL: notas arriba, luego teclados apilados ──
        <>
          {/* Notas + acorde en móvil */}
          <div style={{minHeight:44,marginBottom:8}}>
          {(activeNotes.length>0||heardNote)&&(
            <div style={{marginBottom:10,padding:"6px 10px",background:"#0c0c1a",border:"1px solid #2a2a4a",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:5}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:"1 1 auto"}}>
                {heardNote&&(<span style={{padding:"2px 8px",borderRadius:20,background:"#88aaff22",border:"1px solid #88aaff",color:"#88aaff",fontWeight:700,fontSize:10}}>🎙️ {heardNote}</span>)}
                {activeNotes.map(n=>{
                  const notaPura=n.replace(/\d+$/,"");
                  const oct=(n.match(/\d+$/)||[""])[0];
                  const engKey=LAT[notaPura]||notaPura;
                  return(<span key={n} style={{padding:"2px 8px",borderRadius:20,background:nc(engKey)+"22",border:`1px solid ${nc(engKey)}`,color:nc(engKey),fontWeight:700,fontSize:10}}>{notaPura}<span style={{fontSize:"0.75em",opacity:.7,marginLeft:1}}>{oct}</span></span>);
                })}
              </div>
              {detected&&(<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:8,color:"#555"}}>Acorde</div><div style={{fontSize:17,fontWeight:900,color:"#88aaff",fontFamily:"serif"}}>{detected}</div></div>)}
            </div>
          )}
          </div>
          {/* Teclados apilados */}
          <div style={{display:"flex",flexDirection:"column",gap:10,paddingBottom:8}}>
            {(view==="ambas"||view==="izquierda")&&(
              <div>
                <div style={{fontSize:9,color:"#7a5030",marginBottom:5,letterSpacing:"0.12em",display:"flex",alignItems:"center",gap:6}}>
                  <span>MANO IZQUIERDA · {leftBtns.length} botones</span>
                  <span style={{opacity:.5,fontSize:8}}>↑ abre / cierra ↓</span>
                </div>
                <BandCanvas buttons={leftBtns} bellows={bellows} pressed={pressedL} heardIds={heardIdsL} onDown={downL} onUp={upL} mobile={true} octMap={bellows==="abre"?OCT_L_OPEN:OCT_L_CLOSE}/>
              </div>
            )}
            {(view==="ambas"||view==="derecha")&&(
              <div>
                <div style={{fontSize:9,color:"#7a5030",marginBottom:5,letterSpacing:"0.12em"}}>MANO DERECHA · {rightBtns.length} botones</div>
                <BandCanvas buttons={rightBtns} bellows={bellows} pressed={pressedR} heardIds={heardIdsR} onDown={downR} onUp={upR} mobile={true} octMap={bellows==="abre"?OCT_R_OPEN:OCT_R_CLOSE}/>
              </div>
            )}
          </div>
        </>
      ) : (
        // ── DESKTOP: 3 columnas [Izq] [Panel Central] [Der] ──
        // Los teclados usan transform:scale() para caber en pantalla sin scroll
        <DesktopBandLayout
          leftBtns={leftBtns} rightBtns={rightBtns}
          bellows={bellows} view={view}
          pressedL={pressedL} pressedR={pressedR}
          heardIdsL={heardIdsL} heardIdsR={heardIdsR}
          downL={downL} upL={upL} downR={downR} upR={upR}
          OCT_L_OPEN={OCT_L_OPEN} OCT_L_CLOSE={OCT_L_CLOSE}
          OCT_R_OPEN={OCT_R_OPEN} OCT_R_CLOSE={OCT_R_CLOSE}
          activeNotes={activeNotes} detected={detected}
          heardNote={heardNote} LAT={LAT}
        />
      )}

      <div style={{marginTop:10,padding:"7px 11px",background:"#0a0a12",border:"1px solid #1a1a2a",borderRadius:8,fontSize:11,color:"#555"}}>
        <b style={{color:"#7a5030"}}>Sistema Rheinische</b> · 71 botones · Bisonoro: nota diferente al{" "}
        <span style={{color:"#34d399"}}>abrir</span> y al <span style={{color:"#f472b6"}}>cerrar</span> el fuelle.
      </div>

      {showSaved&&<SavedModal cssText={cssText} onClose={()=>setShowSaved(false)}/>}
      {showImport&&<ImportModal onImport={handleImport} onClose={()=>setShowImport(false)}/>}
    </div>
  );
}



// ─── VITRAL TAB ───────────────────────────────────────────────────────────────
function VitralTab(){
  const NOTAS_V=[
    {eng:"C", lat:"DO",  natural:true },
    {eng:"C#",lat:"DO#", natural:false},
    {eng:"D", lat:"RE",  natural:true },
    {eng:"D#",lat:"RE#", natural:false},
    {eng:"E", lat:"MI",  natural:true },
    {eng:"F", lat:"FA",  natural:true },
    {eng:"F#",lat:"FA#", natural:false},
    {eng:"G", lat:"SOL", natural:true },
    {eng:"G#",lat:"SOL#",natural:false},
    {eng:"A", lat:"LA",  natural:true },
    {eng:"A#",lat:"LA#", natural:false},
    {eng:"B", lat:"SI",  natural:true },
  ];
  const PASOS_V=[
    {idx:[0,1,2,3,4,5,6,7,8,9,10,11],roles:["","","","","","","","","","","",""],desc:"Las 12 notas del sistema cromático · hacé clic para escuchar cada una"},
    {idx:[0,2,4,5,7,9,11],roles:["I","II","III","IV","V","VI","VII"],desc:"Escala de Do Mayor · 7 notas · 7 colores · la paleta de la tonalidad"},
    {idx:[9,11,0,2,4,5,7],roles:["i","ii","bIII","iv","v","bVI","bVII"],desc:"Escala de La Menor natural · el carácter oscuro del modo eólico"},
    {idx:[2,5,9,0],roles:["Raíz","3ªm","5ª","7ªm"],desc:"Dm7 · Re menor 7ª · cuatro colores que definen este acorde"},
    {idx:[7,11,2,5],roles:["Raíz","3ª","5ª","7ªm"],desc:"G7 · Sol dominante · el acorde de máxima tensión tonal"},
    {idx:[0,4,7,11],roles:["Raíz","3ª","5ª","7ª"],desc:"Cmaj7 · Do mayor séptima · luminoso y estable"},
  ];
  const ENH_MAP={"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
  const CHROMATIC_V=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const [pasoV,setPasoV]=useState(0);
  const [hoverV,setHoverV]=useState(null);
  const [revealed,setRevealed]=useState(false);
  const [showPassInput,setShowPassInput]=useState(false);
  const [passInput,setPassInput]=useState("");
  const [passError,setPassError]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const [palette,setPalette]=useState(()=>loadPalette());
  const [saved,setSaved]=useState(false);
  const [palVersion,setPalVersion]=useState(0);

  useEffect(()=>{setRevealed(false);const t=setTimeout(()=>setRevealed(true),50);return()=>clearTimeout(t);},[pasoV,palVersion]);

  const paso=PASOS_V[pasoV];
  const activas=new Set(paso.idx);
  const txtClr=(hex)=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return(r*299+g*587+b*114)/1000>128?"#1a1a1a":"#ffffff";};
  const getColor=(eng)=>palette[eng]||NC_DEFAULT[eng]||"#888";

  const handlePassSubmit=()=>{
    if(passInput.toLowerCase()===EDIT_HASH){setEditMode(true);setShowPassInput(false);setPassInput("");setPassError(false);}
    else{setPassError(true);setTimeout(()=>setPassError(false),1500);}
  };
  const handleColorChange=(eng,hex)=>{
    setPalette(prev=>{const next={...prev,[eng]:hex};if(ENH_MAP[eng])next[ENH_MAP[eng]]=hex;return next;});
  };
  const handleSave=()=>{
    const diff={};
    CHROMATIC_V.forEach(eng=>{if(palette[eng]&&palette[eng]!==NC_DEFAULT[eng])diff[eng]=palette[eng];});
    try{localStorage.setItem(PALETTE_KEY,JSON.stringify(diff));}catch(e){}
    NC=loadPalette();setSaved(true);setPalVersion(v=>v+1);setTimeout(()=>setSaved(false),2000);
  };
  const handleReset=()=>{localStorage.removeItem(PALETTE_KEY);NC={...NC_DEFAULT};setPalette({...NC_DEFAULT});setPalVersion(v=>v+1);};

  const ALT_NAT=180,ALT_ALT=148;
  return(
    <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",paddingBottom:"2rem"}}>
      <div style={{textAlign:"center",padding:"1.5rem 0 1rem",position:"relative"}}>
        <p style={{fontFamily:"'Courier New',monospace",fontSize:10,letterSpacing:".2em",color:"#3a2e0a",marginBottom:".6rem"}}>HARMONÍA · INTRODUCCIÓN</p>
        <h1 style={{fontFamily:"'Libre Baskerville',serif",fontWeight:400,fontSize:"clamp(1.4rem,3vw,2.2rem)",letterSpacing:".06em",color:"#d4a030",marginBottom:".3rem"}}>Sistema de Colores Tonales</h1>
        <p style={{fontStyle:"italic",fontSize:".9rem",color:"#5a4820",letterSpacing:".03em"}}>Cada nota tiene un color único e invariable — la base visual de Harmonía</p>
        {!editMode&&!showPassInput&&(
          <button onClick={()=>setShowPassInput(true)}
            style={{position:"absolute",top:16,right:0,fontSize:10,fontFamily:"monospace",letterSpacing:".1em",color:"#6a4a18",background:"#0a0800",border:"1px solid #3a2808",borderRadius:99,cursor:"pointer",padding:"4px 12px",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#c89030";e.currentTarget.style.color="#c89030";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#3a2808";e.currentTarget.style.color="#6a4a18";}}>
            ✎ paleta
          </button>
        )}
        {showPassInput&&!editMode&&(
          <div style={{position:"absolute",top:12,right:0,display:"flex",gap:6,alignItems:"center",padding:"6px 10px",borderRadius:10,background:"#0a0800",border:"1px solid #3a2808"}}>
            <input type="password" value={passInput} onChange={e=>setPassInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handlePassSubmit()} placeholder="contraseña" autoFocus
              style={{background:"transparent",border:"none",outline:"none",color:passError?"#cc3333":"#c89030",fontFamily:"monospace",fontSize:11,letterSpacing:".08em",width:110}}/>
            <button onClick={handlePassSubmit} style={{background:"transparent",border:"1px solid #3a2808",color:"#8a6020",borderRadius:5,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>→</button>
            <button onClick={()=>{setShowPassInput(false);setPassInput("");setPassError(false);}} style={{background:"transparent",border:"none",color:"#3a2808",fontSize:13,cursor:"pointer",lineHeight:1}}>✕</button>
            {passError&&<span style={{color:"#cc3333",fontSize:9,fontFamily:"monospace"}}>incorrecta</span>}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:6,justifyContent:"center",alignItems:"flex-end",padding:"0 .5rem",flexWrap:"nowrap",overflow:"hidden"}}>
        {NOTAS_V.map((n,i)=>{
          const color=getColor(n.eng);
          const activa=activas.has(i);
          const esHover=hoverV===i;
          const alt=n.natural?ALT_NAT:ALT_ALT;
          return(
            <div key={i} onMouseEnter={()=>setHoverV(i)} onMouseLeave={()=>setHoverV(null)}
              onClick={()=>{const ctx=getCtx();if(ctx&&ctx.state==="suspended")ctx.resume();playTone(n.eng,4,.8);}}
              style={{width:n.natural?52:36,height:alt,flexShrink:0,borderRadius:"999px 999px 50% 50%",position:"relative",cursor:"pointer",
                background:`linear-gradient(180deg,${color}ee 0%,${color}99 55%,${color}55 100%)`,
                border:`1px solid ${color}${activa?"aa":"33"}`,
                boxShadow:activa?`0 0 ${esHover?40:28}px ${color}${esHover?"99":"55"},inset 0 0 14px rgba(0,0,0,.3)`:"none",
                filter:activa?"brightness(1) saturate(1)":"brightness(.15) saturate(.15)",
                opacity:revealed?1:0,
                transform:`translateY(${revealed?(esHover?-10:0):20}px) scale(${esHover?1.04:1})`,
                transition:`transform .25s cubic-bezier(.34,1.56,.64,1),filter .3s,opacity .4s,box-shadow .3s`,
                transitionDelay:revealed?`${i*40}ms`:"0ms"}}>
              <div style={{position:"absolute",top:0,left:"15%",right:"15%",height:"35%",background:"linear-gradient(180deg,rgba(255,255,255,.28) 0%,transparent 100%)",borderRadius:"50% 50% 0 0",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:12,left:0,right:0,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:n.natural?12:10,fontWeight:700,color:txtClr(color),textShadow:"0 1px 6px rgba(0,0,0,.9)",lineHeight:1}}>{n.eng}</span>
                <span style={{fontFamily:"monospace",fontSize:7,color:txtClr(color),opacity:.7,letterSpacing:".04em"}}>{n.lat}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{height:10,background:"linear-gradient(90deg,transparent,#3a2808 15%,#6a4a10 50%,#3a2808 85%,transparent)",borderRadius:"0 0 8px 8px",margin:"0 .5rem .8rem"}}>
        <div style={{height:2,background:"linear-gradient(90deg,transparent,rgba(200,144,0,.5),transparent)"}}/>
      </div>

      <div style={{textAlign:"center",marginBottom:"1.2rem"}}>
        <p style={{fontFamily:"monospace",fontSize:9,letterSpacing:".18em",color:"#3a2e0a",marginBottom:"1rem"}}>EXPLORAR EN CONTEXTO</p>
        <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
          {["Cromática","Mayor (C)","Menor (Am)","Dm7","G7","Cmaj7"].map((label,i)=>(
            <button key={i} onClick={()=>setPasoV(i)}
              style={{padding:"5px 14px",borderRadius:99,cursor:"pointer",fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:".82rem",letterSpacing:".03em",border:`1px solid ${pasoV===i?"#8a6020":"#2a1e06"}`,background:pasoV===i?"#1a1000":"transparent",color:pasoV===i?"#c89030":"#4a3a10",transition:"all .2s"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {pasoV>0&&(
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:"1rem"}}>
          {paso.idx.map((ni,ri)=>{
            const n=NOTAS_V[ni];const color=getColor(n.eng);
            return(
              <div key={ri} onClick={()=>{const ctx=getCtx();if(ctx&&ctx.state==="suspended")ctx.resume();playTone(n.eng,4,.8);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:color,boxShadow:`0 0 18px ${color}66`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
                  <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:13,fontWeight:700,color:txtClr(color),lineHeight:1}}>{n.eng}</span>
                  <span style={{fontFamily:"monospace",fontSize:7,color:txtClr(color),opacity:.7}}>{n.lat}</span>
                </div>
                <span style={{fontFamily:"monospace",fontSize:8,color:"#4a3a10",letterSpacing:".06em"}}>{paso.roles[ri]}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{height:8,borderRadius:99,maxWidth:560,margin:"0 auto .8rem",opacity:.75,boxShadow:"0 2px 16px rgba(0,0,0,.4)",background:`linear-gradient(90deg,${paso.idx.map(i=>getColor(NOTAS_V[i].eng)).join(",")})`}}/>
      <p style={{textAlign:"center",fontStyle:"italic",color:"#4a3a18",fontSize:".85rem",letterSpacing:".02em",marginBottom:"1.5rem"}}>{paso.desc}</p>

      {editMode&&(
        <div style={{marginTop:"1rem",padding:"1rem 1.2rem",background:"#080800",border:"1px solid #3a2808",borderRadius:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
            <p style={{fontFamily:"monospace",fontSize:10,letterSpacing:".15em",color:"#6a4020"}}>EDITOR DE PALETA</p>
            <button onClick={()=>setEditMode(false)} style={{background:"transparent",border:"none",color:"#3a2808",fontSize:14,cursor:"pointer"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:"1rem"}}>
            {NOTAS_V.map((n,i)=>{
              const color=palette[n.eng]||NC_DEFAULT[n.eng];
              const isModified=color!==NC_DEFAULT[n.eng];
              return(
                <div key={i} style={{padding:"8px",borderRadius:8,border:`1px solid ${isModified?"#6a4020":"#1a1200"}`,background:"#0a0800",display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input type="color" value={color} onChange={e=>handleColorChange(n.eng,e.target.value)}
                      style={{width:32,height:32,padding:1,borderRadius:6,border:`2px solid ${color}`,cursor:"pointer",background:"transparent"}}/>
                    <div>
                      <div style={{fontFamily:"'Libre Baskerville',serif",fontWeight:700,fontSize:13,color}}>{n.eng}</div>
                      <div style={{fontFamily:"monospace",fontSize:8,color:"#4a3a10",letterSpacing:".06em"}}>{n.lat}</div>
                    </div>
                    {isModified&&<div style={{width:5,height:5,borderRadius:"50%",background:"#c89030",marginLeft:"auto",flexShrink:0}}/>}
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:8,color:"#3a2808",letterSpacing:".06em"}}>{color}</div>
                  <div style={{height:24,borderRadius:"999px 999px 40% 40%",background:`linear-gradient(180deg,${color}cc,${color}66)`,border:`1px solid ${color}55`}}/>
                  {isModified&&<button onClick={()=>handleColorChange(n.eng,NC_DEFAULT[n.eng])} style={{fontSize:8,fontFamily:"monospace",color:"#4a2a08",background:"transparent",border:"none",cursor:"pointer",letterSpacing:".06em",textAlign:"left"}}>↺ restaurar</button>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
            <button onClick={handleReset} style={{padding:"6px 14px",borderRadius:8,cursor:"pointer",fontFamily:"monospace",fontSize:10,letterSpacing:".08em",border:"1px solid #3a2808",background:"transparent",color:"#6a4020"}}>↺ restaurar todo</button>
            <button onClick={handleSave} style={{padding:"6px 18px",borderRadius:8,cursor:"pointer",fontFamily:"monospace",fontSize:10,letterSpacing:".08em",border:"none",background:saved?"linear-gradient(135deg,#0d4a18,#2dd4bf)":"linear-gradient(135deg,#4a2a00,#c89030)",color:saved?"#fff":"#0a0500",fontWeight:700,transition:"background .3s"}}>
              {saved?"✓ guardado":"💾 guardar paleta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function HarmoniaApp(){
  const[tab,setTab]=useState("colors");
  const[navOpen,setNavOpen]=useState(false);
  const[chordInput,setChordInput]=useState("Dm7");
  const[chord,setChord]=useState(null);
  const[openFns,setOpenFns]=useState([0]);
  const[showTable,setShowTable]=useState(false);
  const[progInput,setProgInput]=useState("Dm7 – G7 – Cmaj7");
  const[progression,setProgression]=useState(null);
  const[selectedKey,setSelectedKey]=useState(null);
  const[bibGenero,setBibGenero]=useState("Tango");

  const analyzeChord=useCallback(()=>{
    const c=parseChord(chordInput);
    setChord(c);setOpenFns([0]);setShowTable(false);
    if(c)playChord(c.notes);
  },[chordInput]);

  const analyzeProg=useCallback(()=>{
    try{
      const parts=progInput.split(/[\s–\-,|]+/).filter(Boolean);
      const parsed=parts.map(p=>parseChord(p)).filter(Boolean);
      if(parsed.length>0)setProgression(computeProg(parsed));
    }catch(e){}
  },[progInput]);

  useEffect(()=>{const c=parseChord("Dm7");setChord(c);},[]);

  const fns=useMemo(()=>chord?getFns(chord.quality):[],[chord]);
  const voicing=useMemo(()=>chord?buildVoicing(chord.root,chord.quality):null,[chord]);
  const toggleFn=useCallback(i=>setOpenFns(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]),[]);

  const TABS=[
    {id:"colors",    label:"Colores",    icon:"🎨"},
    {id:"chord",     label:"Acorde",     icon:"🎼"},
    {id:"prog",      label:"Progresión", icon:"🔗"},
    {id:"biblioteca",label:"Biblioteca", icon:"📚"},
    {id:"bandoneon", label:"Bandoneón",  icon:"🎵"},
    {id:"circle",    label:"Quintas",    icon:"⭕"},
    {id:"modos",     label:"Modos",      icon:"📐"},
  ];

  return(
    <div className="min-h-screen text-gray-100 flex flex-col" style={{
      background:"linear-gradient(135deg,#0a0a1a 0%,#0d0d22 50%,#0a1020 100%)",
      fontFamily:"'Crimson Text',Georgia,serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:wght@400;700&display=swap');
        .glow-input:focus{outline:none;box-shadow:0 0 0 2px #4466cc55}
        .stagger>*{animation:fadeUp 0.3s ease both}
        .stagger>*:nth-child(1){animation-delay:.03s}.stagger>*:nth-child(2){animation-delay:.08s}
        .stagger>*:nth-child(3){animation-delay:.13s}.stagger>*:nth-child(4){animation-delay:.18s}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      `}</style>

      {/* ── HEADER ── */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {/* Hamburger para móvil */}
        <button onClick={()=>setNavOpen(o=>!o)}
          className="flex flex-col gap-1.5 p-2 rounded-lg border border-gray-700 hover:border-gray-500 flex-shrink-0"
          style={{background:"#111"}}>
          <span className="block w-5 h-0.5 bg-gray-400"/>
          <span className="block w-5 h-0.5 bg-gray-400"/>
          <span className="block w-5 h-0.5 bg-gray-400"/>
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{fontFamily:"'Libre Baskerville',serif",letterSpacing:"0.06em"}}>
            <span style={{color:"#4488ff"}}>Har</span>
            <span style={{color:"#cc4444"}}>mo</span>
            <span style={{color:"#44bb44"}}>nía</span>
          </h1>
          <p className="text-xs text-gray-500 italic">Bandoneón · Tango · Jazz · Colores tonales</p>
        </div>
        {/* Tab actual visible en header */}
        <div className="ml-auto text-sm text-gray-400">
          {TABS.find(t=>t.id===tab)?.icon} {TABS.find(t=>t.id===tab)?.label}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR VERTICAL ── */}
        <div className={`flex-shrink-0 border-r border-gray-800 transition-all duration-200 ${navOpen?"w-48":"w-0 overflow-hidden md:w-48"}`}
          style={{background:"#080810"}}>
          <nav className="py-3 px-2 space-y-1 w-48">
            {TABS.map(t=>(
              <button key={t.id}
                onClick={()=>{setTab(t.id);setNavOpen(false);}}
                className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm transition-all"
                style={{
                  background:tab===t.id?"#1e2a4a":"transparent",
                  borderLeft:tab===t.id?"3px solid #4466cc":"3px solid transparent",
                  color:tab===t.id?"#88aaff":"#666",
                  fontWeight:tab===t.id?"600":"400",
                }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-3 py-4 md:px-6 md:py-6">

            {/* ══ ACORDE ══ */}
            {tab==="chord"&&(
              <div className="space-y-5 stagger">
                <div className="flex gap-2">
                  <input value={chordInput} onChange={e=>setChordInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&analyzeChord()}
                    placeholder="Ej: Dm7, G7, Cmaj7, Am7b5, Bb7alt…"
                    className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-lg text-gray-100"
                    style={{fontFamily:"monospace"}}/>
                  <button onClick={analyzeChord}
                    className="px-5 py-3 rounded-xl text-sm font-bold"
                    style={{background:"#1e2a4a",border:"1px solid #4466cc",color:"#88aaff",whiteSpace:"nowrap"}}>
                    Analizar
                  </button>
                </div>

                {chord&&<>
                  <div className="rounded-2xl p-5 border border-gray-700" style={{background:"#0e0e20"}}>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Acorde</p>
                    <div className="flex items-baseline gap-3 mb-4 flex-wrap">
                      <h2 className="text-3xl font-bold" style={{fontFamily:"'Libre Baskerville',serif"}}>
                        {chord.root}<span className="text-gray-400">{chord.formula.symbol}</span>
                      </h2>
                      <span className="text-lg text-gray-400 italic">{chord.formula.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {chord.notes.map(n=><Nota key={n} note={n} size="lg"/>)}
                    </div>
                    {voicing&&(
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Voicing real en piano</p>
                        <div className="rounded-xl p-3 border border-gray-700" style={{background:"#111825"}}>
                          <Piano leftVoice={voicing.L} rightVoice={voicing.R}/>
                        </div>
                      </div>
                    )}
                    <button onClick={()=>playChord(chord.notes)}
                      className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold border"
                      style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>
                      ▶ Escuchar acorde
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">
                      Funciones armónicas <span className="text-gray-700">({fns.length})</span>
                    </p>
                    <div className="flex gap-1 ml-auto">
                      {["Detalle","Tabla"].map((v,vi)=>(
                        <button key={v} onClick={()=>setShowTable(vi===1)}
                          className="px-3 py-1 rounded-lg text-xs border"
                          style={{background:showTable===(vi===1)?"#1e2a4a":"transparent",
                            borderColor:showTable===(vi===1)?"#4466cc":"#333",
                            color:showTable===(vi===1)?"#88aaff":"#666"}}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {showTable
                    ?<TablaComparativa fns={fns} root={chord.root}/>
                    :<div className="space-y-2">
                        {fns.map((f,i)=>(
                          <FnCard key={i} fn={f} root={chord.root}
                            isOpen={openFns.includes(i)} onToggle={()=>toggleFn(i)}/>
                        ))}
                      </div>
                  }

                  <div className="rounded-xl p-4 border border-gray-800" style={{background:"#0b0f20"}}>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Círculo de Quintas</p>
                    <Circulo highlighted={[chord.root]}/>
                  </div>
                </>}
              </div>
            )}

            {/* ══ PROGRESIÓN ══ */}
            {tab==="prog"&&(
              <div className="space-y-5 stagger">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Acordes separados por guion, coma o espacio</p>
                  <div className="flex gap-2">
                    <input value={progInput} onChange={e=>setProgInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&analyzeProg()}
                      placeholder="Ej: Dm7 – G7 – Cmaj7"
                      className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-lg"
                      style={{fontFamily:"monospace"}}/>
                    <button onClick={analyzeProg}
                      className="px-5 py-3 rounded-xl text-sm font-bold"
                      style={{background:"#1e2a4a",border:"1px solid #4466cc",color:"#88aaff"}}>
                      Analizar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["Dm7 – G7 – Cmaj7","Am7b5 – D7b9 – Gm","Cmaj7 – A7 – Dm7 – G7","Am – E7 – Am – Dm"].map(ex=>(
                      <button key={ex} onClick={()=>setProgInput(ex)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {progression&&(
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 uppercase tracking-widest">
                      Tonalidad probable:
                      <span className="ml-2 text-yellow-400 font-bold text-base">{progression[0]?.key} Mayor</span>
                    </p>
                    {progression.map((ch,i)=>{
                      const f=ch.fn;
                      const scale=f?.modeIvs?buildScale(ch.root,f.modeIvs):[];
                      const twn=(f?.tensions||[]).map(t=>({label:t,note:tNote(ch.root,t)}));
                      const v=buildVoicing(ch.root,ch.quality);
                      // Acordes diatónicos de la escala modal
                      const dia=scale.length>=7?scale.map((sn,si)=>{
                        const md=MODE_BY_DEGREE[si];if(!md)return null;
                        const chNotes=[0,2,4,6].map(ci=>scale[(si+ci)%7]);
                        const tens=(md.tensions||[]).map(t=>({label:t,note:tNote(sn,t)}));
                        const avd=(md.avoid||[]).map(t=>({label:t,note:tNote(sn,t)}));
                        return{root:sn,degree:DN[si],quality:DQ[si],mode:md.name,chNotes,tens,avd};
                      }).filter(Boolean):[];

                      return(
                        <div key={i} className="rounded-2xl border border-gray-700 overflow-hidden" style={{background:"#0e0e1c"}}>
                          <div className="px-4 pt-4 pb-3 border-b border-gray-800">
                            <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                              <span className="text-2xl font-bold" style={{fontFamily:"'Libre Baskerville',serif"}}>{ch.raw}</span>
                              <button onClick={()=>playChord(ch.notes)} className="text-sm text-gray-600 hover:text-blue-400">▶</button>
                              <span className="text-xs px-2.5 py-1 rounded-full border"
                                style={{background:"#1a2540",borderColor:"#4466cc",color:"#88aaff"}}>
                                {ch.degree} en {ch.key}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {ch.notes.map(n=><Nota key={n} note={n} size="sm"/>)}
                            </div>
                            {/* Piano voicing */}
                            <div className="rounded-xl p-2.5 border border-gray-700 mb-3" style={{background:"#111825"}}>
                              <p className="text-xs text-gray-600 mb-1.5">Voicing en piano</p>
                              <Piano leftVoice={v.L} rightVoice={v.R}/>
                            </div>
                            {f&&(
                              <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
                                <span><span className="text-indigo-300">Modo: </span><span className="text-white font-semibold">{f.mode}</span></span>
                                {twn.length>0&&(
                                  <span className="flex gap-1.5 flex-wrap items-center">
                                    <span className="text-gray-500">Tensiones:</span>
                                    {twn.map(({label,note},j)=>{
                                      const color=note?nc(note):"#888";
                                      return(
                                        <span key={j} className="font-mono text-xs px-1.5 py-0.5 rounded border"
                                          style={{background:color+"18",borderColor:color+"55",color}}>
                                          {label}{note?`→${note}`:""}
                                        </span>
                                      );
                                    })}
                                  </span>
                                )}
                                {f.avoid?.length>0&&(
                                  <span className="text-xs text-red-400">
                                    Evitar: {f.avoid.map(t=>{const n=tNote(ch.root,t);return n?`${t}→${n}`:t;}).join(" · ")}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Acordes diatónicos */}
                          {dia.length>0&&(
                            <div className="px-4 py-3">
                              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                                Acordes diatónicos — {scale.join(" · ")}
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs" style={{minWidth:"460px"}}>
                                  <thead>
                                    <tr style={{borderBottom:"1px solid #1e2438"}}>
                                      {["Gr.","Acorde","Notas","Modo","Tensiones","Evitar"].map(h=>(
                                        <th key={h} className="text-left pb-1.5 text-gray-600 font-normal">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dia.map((dc,di)=>{
                                      const rc=nc(dc.root);
                                      return(
                                        <tr key={di} style={{borderBottom:"1px solid #111420",background:di%2===0?"transparent":"#0a0c1a"}}>
                                          <td className="py-1.5 pr-2">
                                            <span className="font-mono font-bold px-1.5 py-0.5 rounded"
                                              style={{background:rc+"22",color:rc}}>{dc.degree}</span>
                                          </td>
                                          <td className="py-1.5 pr-2">
                                            <button className="font-bold hover:opacity-75" style={{color:rc}}
                                              onClick={()=>{const c=parseChord(`${dc.root}${dc.quality}`);if(c)playChord(c.notes);}}>
                                              {dc.root}{dc.quality} ▶
                                            </button>
                                          </td>
                                          <td className="py-1.5 pr-2">
                                            <div className="flex gap-0.5 flex-wrap">
                                              {dc.chNotes.map((n,ni)=>(
                                                <span key={ni} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full border font-bold"
                                                  style={{fontSize:"9px",backgroundColor:nc(n)+"18",borderColor:nc(n)+"55",color:nc(n)}}>
                                                  <span className="w-1.5 h-1.5 rounded-full" style={{background:nc(n)}}/>{n}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="py-1.5 pr-2 text-indigo-300 whitespace-nowrap">{dc.mode}</td>
                                          <td className="py-1.5 pr-2">
                                            <div className="flex gap-0.5 flex-wrap">
                                              {dc.tens.map(({label,note},ti)=>(
                                                <span key={ti} className="px-1 py-0.5 rounded font-mono whitespace-nowrap"
                                                  style={{background:"#0a1f0a",color:"#6dbd6d",border:"1px solid #2d5c2d",fontSize:"9px"}}>
                                                  {label}{note?`→${note}`:""}
                                                </span>
                                              ))}
                                              {!dc.tens.length&&<span className="text-gray-700">—</span>}
                                            </div>
                                          </td>
                                          <td className="py-1.5">
                                            <div className="flex gap-0.5 flex-wrap">
                                              {dc.avd.map(({label,note},ai)=>(
                                                <span key={ai} className="px-1 py-0.5 rounded font-mono whitespace-nowrap"
                                                  style={{background:"#1f0a0a",color:"#bd6d6d",border:"1px solid #5c2d2d",fontSize:"9px"}}>
                                                  {label}{note?`→${note}`:""}
                                                </span>
                                              ))}
                                              {!dc.avd.length&&<span className="text-gray-700">—</span>}
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
            )}

            {/* ══ BIBLIOTECA ══ */}
            {tab==="biblioteca"&&(
              <div className="space-y-4 stagger">
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>
                    <span style={{color:"#f59e0b"}}>📚</span>
                    <span className="ml-2">Biblioteca de Progresiones</span>
                  </h2>
                  <p className="text-sm text-gray-500">Progresiones del tango, jazz y música latinoamericana. Hacé click para analizar.</p>
                </div>

                {/* Selector de género */}
                <div className="flex gap-2 flex-wrap">
                  {BIBLIOTECA.map(g=>(
                    <button key={g.genero} onClick={()=>setBibGenero(g.genero)}
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold border"
                      style={{
                        background:bibGenero===g.genero?g.color+"33":"transparent",
                        borderColor:bibGenero===g.genero?g.color:"#333",
                        color:bibGenero===g.genero?g.color:"#666",
                      }}>
                      {g.icon} {g.genero}
                    </button>
                  ))}
                </div>

                {/* Progresiones del género */}
                {BIBLIOTECA.filter(g=>g.genero===bibGenero).map(g=>(
                  <div key={g.genero} className="space-y-3">
                    {g.items.map((item,i)=>{
                      const parts=item.prog.split(/[\s–\-,|]+/).filter(Boolean);
                      const parsed=parts.map(p=>parseChord(p)).filter(Boolean);
                      return(
                        <div key={i} className="rounded-xl border border-gray-700 overflow-hidden" style={{background:"#0e0e1c"}}>
                          <div className="px-4 py-3">
                            <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-gray-200">{item.titulo}</p>
                                {item.nota&&<p className="text-xs text-gray-500 italic mt-0.5">{item.nota}</p>}
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <button onClick={()=>{
                                  let d=0;
                                  parsed.forEach(ch=>{setTimeout(()=>playChord(ch.notes),d);d+=700;});
                                }}
                                  className="px-2.5 py-1 rounded-lg text-xs border"
                                  style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>
                                  ▶
                                </button>
                                <button onClick={()=>{
                                  setProgInput(item.prog);
                                  setTab("prog");
                                  setTimeout(()=>{
                                    const prs=item.prog.split(/[\s–\-,|]+/).filter(Boolean).map(p=>parseChord(p)).filter(Boolean);
                                    if(prs.length>0)setProgression(computeProg(prs));
                                  },50);
                                }}
                                  className="px-2.5 py-1 rounded-lg text-xs border font-semibold"
                                  style={{background:"#1e2a4a",borderColor:"#4466cc",color:"#88aaff"}}>
                                  Analizar →
                                </button>
                              </div>
                            </div>
                            {/* Acordes con colores */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {parsed.map((ch,ci)=>(
                                <button key={ci} onClick={()=>playChord(ch.notes)}
                                  className="px-2.5 py-1 rounded-lg border font-bold text-xs"
                                  style={{backgroundColor:nc(ch.root)+"22",borderColor:nc(ch.root)+"66",color:nc(ch.root)}}>
                                  {ch.raw}
                                </button>
                              ))}
                            </div>
                            {/* Puntos de notas */}
                            <div className="flex gap-1 flex-wrap">
                              {parsed.map((ch,ci)=>(
                                <div key={ci} className="flex gap-0.5 items-center">
                                  {ch.notes.map((n,ni)=>(
                                    <div key={ni} className="w-2 h-2 rounded-full"
                                      style={{background:nc(n)}} title={n}/>
                                  ))}
                                  {ci<parsed.length-1&&<span className="text-gray-700 mx-1 text-xs">–</span>}
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
            )}

            {/* ══ BANDONEÓN ══ */}
            {tab==="bandoneon"&&(
              <div className="stagger">
                <div className="mb-4">
                  <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>
                    <span style={{color:"#f472b6"}}>🎵 Bandoneón</span>
                    <span className="text-gray-500 text-sm font-normal ml-2 italic">Rheinische · 71 botones</span>
                  </h2>
                  <p className="text-xs text-gray-500">Presioná botones para tocar y detectar acordes</p>
                </div>
                <BandoneonTab/>
              </div>
            )}

            {/* ══ QUINTAS ══ */}
            {tab==="circle"&&(
              <div className="stagger">
                <div className="mb-4">
                  <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>⭕ Círculo de Quintas</h2>
                  <p className="text-xs text-gray-500">Tocá cualquier tonalidad para ver escala, modos y tensiones por grado</p>
                </div>
                <Circulo
                  highlighted={COF.map(c=>c.note)}
                  onSelect={setSelectedKey}
                  selectedKey={selectedKey}/>
              </div>
            )}

            {/* ══ MODOS ══ */}
            {tab==="modos"&&(
              <div className="stagger space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>📐 Modos de la Escala Mayor</h2>
                  <p className="text-xs text-gray-500">Los 7 modos griegos, sus tensiones y su uso en tango y jazz</p>
                </div>
                {MODE_BY_DEGREE.map((md,i)=>{
                  const root="C";
                  const scale=buildScale(root,md.ivs);
                  const rootOfMode=scale[i]||root;
                  const scaleFromMode=buildScale(rootOfMode,md.ivs);
                  const twn=md.tensions.map(t=>({label:t,note:tNote(rootOfMode,t)}));
                  const awn=md.avoid.map(t=>({label:t,note:tNote(rootOfMode,t)}));
                  return(
                    <div key={i} className="rounded-xl border border-gray-700 overflow-hidden" style={{background:"#0e0e1c"}}>
                      <div className="px-4 py-3 border-b border-gray-800" style={{background:"#111825"}}>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold px-2 py-1 rounded text-sm"
                            style={{background:nc(CHROMATIC[(noteIdx("C")+MSI[i])%12])+"33",
                              color:nc(CHROMATIC[(noteIdx("C")+MSI[i])%12])}}>
                            {DN[i]}
                          </span>
                          <div>
                            <p className="font-bold text-base text-white">{md.name}</p>
                            <p className="text-xs text-gray-500">{md.q} — Grado {DN[i]} de la escala mayor</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5">Escala desde C {md.name}:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {buildScale("C",md.ivs).map((n,ni)=>(
                              <button key={ni} onClick={()=>playTone(n,4,0.5)}
                                className="flex flex-col items-center px-2 py-1.5 rounded-lg border text-xs font-bold"
                                style={{backgroundColor:nc(n)+"22",borderColor:nc(n)+"55",color:nc(n),minWidth:"30px"}}>
                                <span>{n}</span>
                                <span style={{fontSize:"8px",opacity:0.5}}>{ni+1}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg p-2.5 border border-green-900" style={{background:"#070f07"}}>
                            <p className="text-xs font-bold text-green-400 mb-1.5">✅ Tensiones</p>
                            <div className="flex flex-wrap gap-1">
                              {twn.map(({label,note},j)=>{
                                const color=note?nc(note):"#6dbd6d";
                                return(
                                  <span key={j} className="px-1.5 py-0.5 rounded border font-mono text-xs"
                                    style={{background:color+"18",borderColor:color+"55",color}}>
                                    {label}{note?`→${note}`:""}
                                  </span>
                                );
                              })}
                              {!twn.length&&<span className="text-gray-700 text-xs">Sin tensiones adicionales</span>}
                            </div>
                          </div>
                          <div className="rounded-lg p-2.5 border border-red-900" style={{background:"#0f0707"}}>
                            <p className="text-xs font-bold text-red-400 mb-1.5">⚠️ Evitar</p>
                            <div className="flex flex-wrap gap-1">
                              {awn.map(({label,note},j)=>{
                                const color=note?nc(note):"#bd6d6d";
                                return(
                                  <span key={j} className="px-1.5 py-0.5 rounded border font-mono text-xs"
                                    style={{background:color+"18",borderColor:color+"55",color}}>
                                    {label}{note?`→${note}`:""}
                                  </span>
                                );
                              })}
                              {!awn.length&&<span className="text-gray-700 text-xs">—</span>}
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
            )}

            {/* ══ COLORES — VITRAL ══ */}
            {tab==="colors"&&<VitralTab/>}

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800 px-4 py-2 text-center flex-shrink-0">
        <p className="text-xs text-gray-700 italic">
          Harmonía · Armonía para bandoneón · Tango · Jazz · Sistema de color tonal
        </p>
      </div>
    </div>
  );
}
