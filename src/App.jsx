import { useState, useEffect, useCallback, useMemo } from "react";

// ─── COLORES ──────────────────────────────────────────────────────────────────
const NOTE_COLORS = {
  C:    { name:"Azul",        hex:"#1E50DC" },
  D:    { name:"Verde",       hex:"#28A03C" },
  E:    { name:"Marrón",      hex:"#82501E" },
  F:    { name:"Beige",       hex:"#C8B98C" },
  G:    { name:"Amarillo",    hex:"#E6C814" },
  A:    { name:"Rojo",        hex:"#D22828" },
  B:    { name:"Violeta",     hex:"#7828B4" },
  "C#": { name:"Turquesa",    hex:"#2378B4" },
  "Db": { name:"Turquesa",    hex:"#2378B4" },
  "D#": { name:"Verde claro", hex:"#28B464" },
  "Eb": { name:"Verde claro", hex:"#28B464" },
  "F#": { name:"Am.beige",    hex:"#D7C050" },
  "Gb": { name:"Am.beige",    hex:"#D7C050" },
  "G#": { name:"Naranja",     hex:"#DC781E" },
  "Ab": { name:"Naranja",     hex:"#DC781E" },
  "A#": { name:"Bordo",       hex:"#A5286E" },
  "Bb": { name:"Bordo",       hex:"#A5286E" },
};
const nc = (n) => NOTE_COLORS[n?.replace(/[0-9]/g,"").trim()] || { hex:"#888", name:"?" };

const CHROMATIC  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };
const enh = (n) => ENHARMONIC[n] || n;
const noteIdx = (n) => {
  const i = CHROMATIC.indexOf(n); if (i>=0) return i;
  const e = Object.entries(ENHARMONIC).find(([,v])=>v===n);
  return e ? CHROMATIC.indexOf(e[0]) : -1;
};
const fromRoot = (root, semi) => CHROMATIC[(noteIdx(root)+semi+120)%12];
const buildScale = (root, ivs) => ivs.map(i=>fromRoot(root,i));

// Nota latina → inglés
const LAT = { "DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F","FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B" };
const ENG_LAT = Object.fromEntries(Object.entries(LAT).map(([k,v])=>[v,k]));

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let _ctx=null;
const getCtx=()=>{ if(!_ctx)try{_ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){} return _ctx; };
const MIDI={C:60,"C#":61,"Db":61,D:62,"D#":63,"Eb":63,E:64,F:65,"F#":66,"Gb":66,G:67,"G#":68,"Ab":68,A:69,"A#":70,"Bb":70,B:71};

const playTone=(note,octave=4,dur=0.7,type="triangle")=>{
  try{
    const ctx=getCtx();if(!ctx)return;
    if(ctx.state==="suspended")ctx.resume();
    const midi=(MIDI[note]??60)+(octave-4)*12;
    const freq=440*Math.pow(2,(midi-69)/12);
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type=type;osc.frequency.value=freq;
    gain.gain.setValueAtTime(0.2,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    osc.start();osc.stop(ctx.currentTime+dur);
  }catch(e){}
};

const playBand=(noteLat,octave)=>{
  const eng=LAT[noteLat]||noteLat;
  [1,2,3].forEach((h,i)=>{
    try{
      const ctx=getCtx();if(!ctx)return;
      if(ctx.state==="suspended")ctx.resume();
      const midi=(MIDI[eng]??60)+(octave-4)*12;
      const freq=440*Math.pow(2,(midi-69)/12)*h;
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.type="sawtooth";osc.frequency.value=freq;
      const v=[0.22,0.10,0.05][i];
      gain.gain.setValueAtTime(v,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+1.0);
      osc.start();osc.stop(ctx.currentTime+1.0);
    }catch(e){}
  });
};

const playChord=(notes)=>notes.forEach((n,i)=>setTimeout(()=>playTone(n,4,1.2),i*20));

// ─── FÓRMULAS ─────────────────────────────────────────────────────────────────
const FORMULAS={
  "maj": {intervals:[0,4,7],          label:"Mayor",      symbol:"△"   },
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

// ─── MODOS ────────────────────────────────────────────────────────────────────
const MODES={
  "Jónico":      [0,2,4,5,7,9,11],
  "Dórico":      [0,2,3,5,7,9,10],
  "Frigio":      [0,1,3,5,7,8,10],
  "Lidio":       [0,2,4,6,7,9,11],
  "Mixolidio":   [0,2,4,5,7,9,10],
  "Eólico":      [0,2,3,5,7,8,10],
  "Locrio":      [0,1,3,5,6,8,10],
  "Locrio #2":   [0,2,3,5,6,8,10],
  "Lidio b7":    [0,2,4,6,7,9,10],
  "Alterada":    [0,1,3,4,6,8,10],
  "Frigio Dom.": [0,1,4,5,7,8,10],
  "Disminuida":  [0,2,3,5,6,8,9,11],
  "Blues":       [0,3,5,6,7,10],
};

const T_SEMI={"9":2,"b9":1,"#9":3,"11":5,"#11":6,"13":9,"b13":8,"6":9,"b6":8,"b7":10,"7":11};
const tNote=(root,t)=>{ const s=T_SEMI[t]; return s!==undefined?fromRoot(root,s):null; };

// ─── FUNCIONES ARMÓNICAS ──────────────────────────────────────────────────────
const HF={
  "7":[
    {fn:"V7 → I (dominante principal)",degree:"V",key:"Resuelve a tónica mayor",
     mode:"Mixolidio",modeIvs:MODES["Mixolidio"],
     tensions:["9","13"],avoid:["11"],resolutions:["I△7","I"],
     why:"El tritono (3ª–7ª) crea tensión máxima que se resuelve por semitono hacia la tónica."},
    {fn:"V7/iv (dominante hacia menor)",degree:"V",key:"Resuelve a acorde menor",
     mode:"Alterada",modeIvs:MODES["Alterada"],
     tensions:["b9","#9","b13"],avoid:["9","13"],resolutions:["im7","im"],
     why:"Las tensiones alteradas crean color oscuro idiomático del tango. Muy frecuente en cadencias menores."},
    {fn:"SubV7 (sustituto tritonal)",degree:"bII",key:"Reemplaza al V7 — bajo por semitono",
     mode:"Lidio b7",modeIvs:MODES["Lidio b7"],
     tensions:["9","#11","13"],avoid:[],resolutions:["I△7","I"],
     why:"Comparte el tritono con el dominante original. El bajo baja un semitono en vez del salto de 5ª."},
    {fn:"Dominante de paso",degree:"?",key:"Conecta acordes cromáticamente",
     mode:"Mixolidio",modeIvs:MODES["Mixolidio"],
     tensions:["9","13"],avoid:[],resolutions:["acorde siguiente"],
     why:"No establece tonalidad. Genera movimiento cromático sin perturbar el centro tonal."},
    {fn:"I7 Blues / tango oscuro",degree:"I",key:"Tónica con color blue-tango",
     mode:"Blues",modeIvs:MODES["Blues"],
     tensions:["b9","#9"],avoid:[],resolutions:["IV7","V7"],
     why:"La 7ª menor es constitutiva del color, no una tensión a resolver. Fundamental en tango y jazz."},
  ],
  "maj7":[
    {fn:"I△7 — Tónica mayor",degree:"I",key:"Centro tonal luminoso",
     mode:"Lidio",modeIvs:MODES["Lidio"],
     tensions:["9","#11","13"],avoid:["11"],resolutions:["estático"],
     why:"La #11 (Lidio) evita el conflicto con la 4ª justa y da el color más sofisticado de esta función."},
    {fn:"IV△7 — Subdominante mayor",degree:"IV",key:"Color lírico — no resuelve fuerte",
     mode:"Lidio",modeIvs:MODES["Lidio"],
     tensions:["9","#11"],avoid:["11"],resolutions:["I△7","V7"],
     why:"La 11ª justa crea fricción con la 3ª del I. Con Lidio (#11) el movimiento es melódicamente fluido."},
    {fn:"△7 Modal",degree:"I",key:"Tónica de modo sin movimiento funcional",
     mode:"Jónico",modeIvs:MODES["Jónico"],
     tensions:["9","6","13"],avoid:[],resolutions:["estático"],
     why:"En música modal el △7 es punto de reposo absoluto. Frecuente en tango moderno."},
  ],
  "min7":[
    {fn:"ii m7 — Pre-dominante",degree:"ii",key:"Pre-dominante en cadencia ii–V–I",
     mode:"Dórico",modeIvs:MODES["Dórico"],
     tensions:["9","11"],avoid:["b9"],resolutions:["V7","V7sus4"],
     why:"Dórico (6ª mayor) da brillo típico del jazz. Evitar b9 — suena Frigio y rompe la función."},
    {fn:"iii m7 — Mediante",degree:"iii",key:"Sustituto de tónica, más oscuro",
     mode:"Frigio",modeIvs:MODES["Frigio"],
     tensions:["11"],avoid:["9","13"],resolutions:["IV△7","ii m7"],
     why:"Tiene b9 (Frigio). Evitar la 9ª. Crea tensión suave que impulsa hacia el IV."},
    {fn:"vi m7 — Relativa menor",degree:"vi",key:"Tónica relativa estable",
     mode:"Eólico",modeIvs:MODES["Eólico"],
     tensions:["9","11"],avoid:[],resolutions:["estático"],
     why:"Comparte 3 notas con I△7. Reemplaza la tónica mayor con color más oscuro."},
    {fn:"iv m7 — Subdominante menor",degree:"iv",key:"Borrowed del modo menor",
     mode:"Eólico",modeIvs:MODES["Eólico"],
     tensions:["9","11","b6"],avoid:[],resolutions:["I△7","V7","bVII△7"],
     why:"La b6 delata que viene del modo menor. Oscuridad expresiva inesperada. Muy usado en tango."},
  ],
  "m7b5":[
    {fn:"iiø7 — Pre-dominante en menor",degree:"ii",key:"Supertónica en contexto menor",
     mode:"Locrio #2",modeIvs:MODES["Locrio #2"],
     tensions:["9","11","b13"],avoid:[],resolutions:["V7b9","V7alt"],
     why:"Locrio #2 da 9ª natural, más melódico que Locrio puro. Clave en ii-V-i del tango."},
    {fn:"ø7 de color modal",degree:"?",key:"Color sin función tonal fija",
     mode:"Locrio #2",modeIvs:MODES["Locrio #2"],
     tensions:["9","11"],avoid:[],resolutions:["variable"],
     why:"Puede flotar ambiguamente en tango moderno y jazz sin necesitar resolver."},
  ],
  "maj":[
    {fn:"I Mayor — Tónica",degree:"I",key:"Centro tonal clásico",
     mode:"Jónico",modeIvs:MODES["Jónico"],
     tensions:["9","6"],avoid:["7"],resolutions:["estático"],
     why:"Sin 7ª el sonido es más abierto y clásico. Frecuente en cierres de tango."},
    {fn:"IV Mayor — Subdominante",degree:"IV",key:"Hacia dominante o tónica",
     mode:"Lidio",modeIvs:MODES["Lidio"],
     tensions:["9","#11"],avoid:[],resolutions:["V","I"],
     why:"Con #11 (Lidio) suena brillante y moderno sin abandonar la función."},
    {fn:"V Mayor — Dominante sin 7ª",degree:"V",key:"Menos tensión que V7",
     mode:"Mixolidio",modeIvs:MODES["Mixolidio"],
     tensions:["9","13"],avoid:["11"],resolutions:["I","I△7"],
     why:"Sin la 7ª la tensión es menor. Común en pasajes clásicos y folclóricos."},
  ],
  "min":[
    {fn:"i menor — Tónica menor",degree:"i",key:"Centro tonal oscuro",
     mode:"Eólico",modeIvs:MODES["Eólico"],
     tensions:["9","11","b6"],avoid:[],resolutions:["estático"],
     why:"La b6 eólica refuerza el color oscuro esencial del tango."},
    {fn:"iv menor — Subdominante menor",degree:"iv",key:"Peso expresivo en modo menor",
     mode:"Eólico",modeIvs:MODES["Eólico"],
     tensions:["9","11"],avoid:[],resolutions:["V7","i","bVII"],
     why:"Junto al V7 forma la cadencia perfecta menor. Muy frecuente en tango y milonga."},
  ],
  "dim7":[
    {fn:"vii°7 — Sensible disminuido",degree:"vii",key:"Cada nota a semitono de la tónica",
     mode:"Disminuida",modeIvs:MODES["Disminuida"],
     tensions:[],avoid:[],resolutions:["I△7","I","i"],
     why:"Simétrico: divide la octava en 4 partes. Fundamental en tango — muy usado como paso cromático."},
    {fn:"°7 cromático de paso",degree:"?",key:"Conecta por movimiento de bajo",
     mode:"Disminuida",modeIvs:MODES["Disminuida"],
     tensions:[],avoid:[],resolutions:["acorde a semitono"],
     why:"Puede transponerse cada 3 semitonos. Ideal para modulaciones rápidas en tango."},
  ],
};
const getFns=(q)=>HF[q]||[{fn:"Acorde de color",degree:"?",key:"Uso libre / modal",
  mode:"Según contexto",modeIvs:MODES["Jónico"],tensions:["varía"],avoid:[],
  resolutions:["variable"],why:"Sin función tonal fija. Depende del contexto armónico."}];

// ─── VOICING POR MANOS ────────────────────────────────────────────────────────
const buildVoicing=(root,quality)=>{
  const f=FORMULAS[quality]||FORMULAS["maj"];
  const ivs=f.intervals;
  const has=(s)=>ivs.some(i=>(i%12)===s%12);

  // Mano izquierda: bajo + quinta (+ 7ª si la hay)
  const L=[];
  L.push({note:root,       role:"Fundamental (bajo)",   oct:3});
  if(has(7))  L.push({note:fromRoot(root,7), role:"Quinta",          oct:3});
  if(has(10)) L.push({note:fromRoot(root,10),role:"7ª menor",        oct:3});
  if(has(11)) L.push({note:fromRoot(root,11),role:"7ª mayor",        oct:3});

  // Mano derecha: 3ª + extensiones en oct 4–5
  const R=[];
  if(has(3))  R.push({note:fromRoot(root,3), role:"3ª menor",        oct:4});
  if(has(4))  R.push({note:fromRoot(root,4), role:"3ª mayor",        oct:4});
  if(has(6))  R.push({note:fromRoot(root,6), role:"5ª disminuida",   oct:4});
  if(has(8))  R.push({note:fromRoot(root,8), role:"5ª aumentada",    oct:4});
  // Extensiones (>7) en oct 5
  ivs.filter(i=>i>11).forEach(i=>{
    const labels={2:"9ª",1:"b9",3:"#9",5:"11ª",6:"#11",9:"13ª",8:"b13"};
    const s=i%12;
    R.push({note:fromRoot(root,s),role:labels[s]||`+${i}`,oct:5});
  });
  return {L,R};
};

// ─── CÍRCULO DE QUINTAS ───────────────────────────────────────────────────────
const COF=[
  {note:"C",  minor:"Am",  deg:0,   minorName:"A menor",  sig:"Sin alteraciones"},
  {note:"G",  minor:"Em",  deg:30,  minorName:"E menor",  sig:"1 sostenido (F#)"},
  {note:"D",  minor:"Bm",  deg:60,  minorName:"B menor",  sig:"2 sostenidos"},
  {note:"A",  minor:"F#m", deg:90,  minorName:"F# menor", sig:"3 sostenidos"},
  {note:"E",  minor:"C#m", deg:120, minorName:"C# menor", sig:"4 sostenidos"},
  {note:"B",  minor:"G#m", deg:150, minorName:"G# menor", sig:"5 sostenidos"},
  {note:"F#", minor:"D#m", deg:180, minorName:"D# menor", sig:"6 sostenidos"},
  {note:"Db", minor:"Bbm", deg:210, minorName:"Bb menor", sig:"5 bemoles"},
  {note:"Ab", minor:"Fm",  deg:240, minorName:"F menor",  sig:"4 bemoles"},
  {note:"Eb", minor:"Cm",  deg:270, minorName:"C menor",  sig:"3 bemoles"},
  {note:"Bb", minor:"Gm",  deg:300, minorName:"G menor",  sig:"2 bemoles"},
  {note:"F",  minor:"Dm",  deg:330, minorName:"D menor",  sig:"1 bemol (Bb)"},
];
const MSI=[0,2,4,5,7,9,11];
const DN=["I","II","III","IV","V","VI","VII"];
const DQ=["△7","m7","m7","△7","7","m7","ø7"];
const DL=["Tónica","Supertónica","Mediante","Subdominante","Dominante","Relativa m.","Sensible"];

const getMSD=(root)=>{
  const ri=noteIdx(root);if(ri===-1)return null;
  const notes=MSI.map(i=>CHROMATIC[(ri+i)%12]);
  return {notes,diatonic:notes.map((n,i)=>({note:n,degree:DN[i],quality:DQ[i],label:DL[i],full:`${n}${DQ[i]}`}))};
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
  const scores={};
  COF.forEach(({note})=>{
    const ri=noteIdx(note);if(ri===-1)return;
    let sc=0;const scale=MSI.map(i=>CHROMATIC[(ri+i)%12]);
    chords.forEach(({root})=>{if(scale.includes(root))sc+=2;if(scale.includes(enh(root)))sc+=2;});
    scores[note]=sc;
  });
  const key=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
  const ki=noteIdx(key);const sn=MSI.map(i=>CHROMATIC[(ki+i)%12]);
  return chords.map(({root,quality,raw,notes})=>{
    const ri=sn.indexOf(root)!==-1?sn.indexOf(root):sn.indexOf(enh(root));
    return{raw,root,quality,notes,degree:ri>=0?DN[ri]:"?",key,fn:getFns(quality)[0]};
  });
};

// ─── BANDONEÓN — LAYOUT REAL DESDE IMAGEN ─────────────────────────────────────
// Cada fila = array de {note, oct}  (nota en español)
// Leído de la imagen de referencia: de arriba (exterior) hacia abajo (interior)
// Mano izquierda: octavas 2-3-4 / Mano derecha: octavas 3-4-5-6

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

// Colores por octava (igual que la imagen)
const OCT_C={
  2:{bg:"#7c3aed",border:"#6d28d9",label:"Oct. 2"},
  3:{bg:"#ea580c",border:"#c2410c",label:"Oct. 3"},
  4:{bg:"#059669",border:"#047857",label:"Oct. 4"},
  5:{bg:"#db2777",border:"#be185d",label:"Oct. 5"},
  6:{bg:"#2563eb",border:"#1d4ed8",label:"Oct. 6"},
};

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

const ColorNote=({note,size="md",showName=true})=>{
  const c=nc(note);
  const cls={sm:"px-2 py-1 text-sm",md:"px-3 py-1.5 text-base",lg:"px-4 py-2 text-lg"};
  return(
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold border-2 cursor-pointer ${cls[size]}`}
      style={{backgroundColor:c.hex+"22",borderColor:c.hex,color:c.hex}}
      onClick={()=>playTone(note,4,0.7)}>
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:c.hex}}/>
      {note}{showName&&<span className="opacity-60 text-xs font-normal">({c.name})</span>}
    </span>
  );
};

// Piano multi-octava con manos separadas
// Muestra 3 octavas completas: C3-B3 (izq), C4-B4 (ambas), C5-B5 (der)
const PianoMulti=({leftVoice=[],rightVoice=[],allNotes=[]})=>{
  const WHITE=["C","D","E","F","G","A","B"];
  const BLACK=[{n:"C#",a:0},{n:"D#",a:1},{n:"F#",a:3},{n:"G#",a:4},{n:"A#",a:5}];
  const OCTAVES=[3,4,5];
  const ww=32,wh=110,bw=20,bh=68;
  const totalW=WHITE.length*ww*OCTAVES.length;

  const lNotes=leftVoice.map(v=>v.note);
  const rNotes=rightVoice.map(v=>v.note);

  const getFill=(note,octave,isBlack)=>{
    // Buscar si esta nota+octava está en alguna mano
    const inL=leftVoice.some(v=>v.note===note&&v.oct===octave);
    const inR=rightVoice.some(v=>v.note===note&&v.oct===octave);
    if(inL) return "#4488ff";
    if(inR) return nc(note).hex;
    // Si es nota del acorde (sin octava específica) mostrar tenue
    if(allNotes.includes(note)) return nc(note).hex+"55";
    return isBlack?"#1a1a1a":"#f0ece0";
  };

  return(
    <div className="overflow-x-auto pb-2">
      {/* Labels de octavas */}
      <div className="flex mb-1" style={{paddingLeft:"4px"}}>
        {OCTAVES.map(oct=>(
          <div key={oct} style={{width:WHITE.length*ww+"px"}} className="text-center text-xs text-gray-600">
            Oct. {oct}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${totalW} ${wh}`} style={{minWidth:totalW+"px",height:"120px"}}>
        {OCTAVES.map((oct,oi)=>{
          const xOff=oi*WHITE.length*ww;
          return(
            <g key={oct}>
              {/* separador de octava */}
              {oi>0&&<line x1={xOff} y1={0} x2={xOff} y2={wh} stroke="#333" strokeWidth="1.5"/>}
              {WHITE.map((n,i)=>{
                const fill=getFill(n,oct,false);
                const hasColor=fill!=="#f0ece0";
                return(
                  <g key={n+oct} style={{cursor:"pointer"}} onClick={()=>playTone(n,oct,0.7)}>
                    <rect x={xOff+i*ww+1} y={0} width={ww-2} height={wh} rx="3"
                      fill={fill} stroke="#444" strokeWidth="0.5"/>
                    <text x={xOff+i*ww+ww/2} y={wh-8} textAnchor="middle" fontSize="8"
                      fill={hasColor?"#fff":"#888"} fontFamily="serif" fontWeight={hasColor?"bold":"normal"}>{n}</text>
                  </g>
                );
              })}
              {BLACK.map(({n,a})=>{
                const fill=getFill(n,oct,true);
                const hasColor=fill!=="#1a1a1a";
                const x=xOff+(a+1)*ww-bw/2;
                return(
                  <g key={n+oct} style={{cursor:"pointer"}} onClick={()=>playTone(n,oct,0.7)}>
                    <rect x={x} y={0} width={bw} height={bh} rx="2"
                      fill={fill} stroke={hasColor?fill:"#000"} strokeWidth="0.5"/>
                    <text x={x+bw/2} y={bh-7} textAnchor="middle" fontSize="6.5"
                      fill="#fff" fontFamily="serif">{n}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {/* Leyenda */}
      <div className="flex gap-4 mt-2 flex-wrap px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{background:"#4488ff"}}/>
          <span className="text-xs text-gray-400">Mano izquierda (bajo + 5ª + 7ª)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{background:"#f59e0b"}}/>
          <span className="text-xs text-gray-400">Mano derecha (3ª + extensiones)</span>
        </div>
      </div>
    </div>
  );
};

// Tabla comparativa de escalas y tensiones por función
const ScaleCompareTable=({fns,root})=>{
  return(
    <div className="overflow-x-auto rounded-2xl border border-gray-800" style={{background:"#080a14"}}>
      <table className="w-full text-sm" style={{minWidth:"600px"}}>
        <thead>
          <tr style={{background:"#0e1228",borderBottom:"1px solid #2a3a5a"}}>
            <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-normal w-8">Grado</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-normal">Función</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-normal">Modo</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-normal">Escala</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-normal">Tensiones</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-widest font-normal">Evitar</th>
          </tr>
        </thead>
        <tbody>
          {fns.map((f,i)=>{
            const scale=f.modeIvs?buildScale(root,f.modeIvs):[];
            const twn=(f.tensions||[]).map(t=>{const n=tNote(root,t);return n?`${t}→${n}`:t;});
            const awn=(f.avoid||[]).map(t=>{const n=tNote(root,t);return n?`${t}→${n}`:t;});
            return(
              <tr key={i} style={{borderBottom:"1px solid #1a1a2a",background:i%2===0?"transparent":"#0a0c18"}}>
                <td className="px-4 py-3">
                  <span className="font-mono font-bold text-sm px-2 py-1 rounded"
                    style={{background:"#0d1520",color:"#88aaff"}}>{f.degree}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-blue-200 text-sm">{f.fn}</p>
                  <p className="text-gray-500 text-xs italic">{f.key}</p>
                </td>
                <td className="px-4 py-3 text-indigo-300 font-semibold text-sm whitespace-nowrap">{f.mode}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {scale.map((n,j)=>{
                      const c=nc(n);
                      return(
                        <button key={j} onClick={()=>playTone(n,4,0.5)}
                          className="px-1.5 py-0.5 rounded text-xs font-bold border"
                          style={{backgroundColor:c.hex+"22",borderColor:c.hex+"55",color:c.hex}}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {twn.length>0
                    ?<div className="flex flex-wrap gap-1">
                        {twn.map((t,j)=>(
                          <span key={j} className="px-2 py-0.5 rounded text-xs font-mono border"
                            style={{background:"#0a1f0a",borderColor:"#2d5c2d",color:"#6dbd6d"}}>{t}</span>
                        ))}
                      </div>
                    :<span className="text-gray-600 text-xs italic">—</span>}
                </td>
                <td className="px-4 py-3">
                  {awn.length>0
                    ?<div className="flex flex-wrap gap-1">
                        {awn.map((t,j)=>(
                          <span key={j} className="px-2 py-0.5 rounded text-xs font-mono border"
                            style={{background:"#1f0a0a",borderColor:"#5c2d2d",color:"#bd6d6d"}}>{t}</span>
                        ))}
                      </div>
                    :<span className="text-gray-600 text-xs italic">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Acordeón de función armónica individual
const FnCard=({fn,root,isOpen,onToggle})=>{
  const scale=useMemo(()=>fn.modeIvs?buildScale(root,fn.modeIvs):[],[root,fn.modeIvs]);
  const twn=useMemo(()=>(fn.tensions||[]).map(t=>({label:t,note:tNote(root,t)})),[root,fn.tensions]);
  const awn=useMemo(()=>(fn.avoid||[]).map(t=>({label:t,note:tNote(root,t)})),[root,fn.avoid]);
  return(
    <div className="rounded-2xl border overflow-hidden" style={{borderColor:isOpen?"#4466cc":"#1e1e2e"}}>
      <button className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
        style={{background:isOpen?"#111d36":"#0c0c1c"}} onClick={onToggle}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-mono font-bold px-2 py-1 rounded border flex-shrink-0"
            style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>{fn.degree}</span>
          <div className="min-w-0">
            <p className="font-bold text-base text-blue-200 truncate">{fn.fn}</p>
            <p className="text-sm text-gray-500 italic truncate">{fn.key}</p>
          </div>
        </div>
        <span className="text-gray-500 flex-shrink-0">{isOpen?"▲":"▼"}</span>
      </button>
      {isOpen&&(
        <div className="px-5 pb-5 pt-4 space-y-4" style={{background:"#09091a"}}>
          <div className="rounded-xl p-4 border border-gray-800" style={{background:"#0c0f20"}}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-indigo-300 font-semibold">Modo:</span>
              <span className="text-base font-bold text-white">{fn.mode}</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">Escala completa:</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {scale.map((n,i)=>{const c=nc(n);return(
                <button key={i} onClick={()=>playTone(n,4,0.5)}
                  className="flex flex-col items-center px-3 py-2 rounded-xl border font-bold text-base cursor-pointer"
                  style={{backgroundColor:c.hex+"22",borderColor:c.hex+"66",color:c.hex,minWidth:"40px"}}>
                  <span>{n}</span><span style={{fontSize:"9px",opacity:0.5}}>{i+1}°</span>
                </button>
              );})}
            </div>
            <p className="text-sm text-gray-600 font-mono">{scale.join(" — ")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {twn.length>0&&(
              <div className="rounded-xl p-4 border border-green-900" style={{background:"#070f07"}}>
                <p className="text-sm font-bold text-green-400 mb-3">✅ Tensiones</p>
                <div className="space-y-2">
                  {twn.map(({label,note},i)=>{const c=note?nc(note):{hex:"#888"};return(
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-green-300 w-8">{label}</span>
                      <span className="text-gray-600 text-sm">→</span>
                      {note?<button onClick={()=>playTone(note,4,0.5)}
                        className="px-3 py-1 rounded-full text-base font-bold border"
                        style={{backgroundColor:c.hex+"22",borderColor:c.hex,color:c.hex}}>{note}</button>
                      :<span className="text-gray-600 italic text-sm">varía</span>}
                    </div>
                  );})}
                </div>
              </div>
            )}
            {awn.length>0&&(
              <div className="rounded-xl p-4 border border-red-900" style={{background:"#0f0707"}}>
                <p className="text-sm font-bold text-red-400 mb-3">⚠️ Evitar</p>
                <div className="space-y-2">
                  {awn.map(({label,note},i)=>{const c=note?nc(note):{hex:"#888"};return(
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-red-400 w-8">{label}</span>
                      <span className="text-gray-600 text-sm">→</span>
                      {note&&<span className="px-3 py-1 rounded-full text-base font-bold border"
                        style={{backgroundColor:c.hex+"22",borderColor:c.hex,color:c.hex}}>{note}</span>}
                    </div>
                  );})}
                </div>
              </div>
            )}
          </div>
          {fn.resolutions?.length>0&&(
            <div className="rounded-xl p-3 border border-yellow-900" style={{background:"#0f0e07"}}>
              <span className="text-sm text-yellow-400 font-semibold">➜ </span>
              <span className="text-base text-yellow-200 font-mono">{fn.resolutions.join(" · ")}</span>
            </div>
          )}
          <div className="rounded-xl p-4 border border-gray-800" style={{background:"#08080f"}}>
            <p className="text-sm text-gray-500 mb-1">💡 Por qué funciona</p>
            <p className="text-base text-gray-300 leading-relaxed">{fn.why}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Círculo de quintas
const CircleOfFifths=({highlighted=[],onSelect=null,selectedKey=null})=>{
  const cx=160,cy=160,R=125,r=82;
  return(
    <svg viewBox="0 0 320 320" className="w-full max-w-xs mx-auto select-none">
      <defs><radialGradient id="bgG7" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#1a1a2e"/><stop offset="100%" stopColor="#0d0d1a"/>
      </radialGradient></defs>
      <circle cx={cx} cy={cy} r={155} fill="url(#bgG7)" stroke="#333" strokeWidth="1"/>
      {COF.map(({note,minor,deg})=>{
        const angle=(deg-90)*(Math.PI/180);
        const isHi=highlighted.includes(note)||highlighted.includes(enh(note));
        const isSel=selectedKey===note;
        const ox=cx+R*Math.cos(angle),oy=cy+R*Math.sin(angle);
        const mx=cx+r*Math.cos(angle),my=cy+r*Math.sin(angle);
        const c=nc(note);
        return(<g key={note} style={{cursor:onSelect?"pointer":"default"}} onClick={()=>onSelect&&onSelect(note)}>
          <circle cx={ox} cy={oy} r={isSel?21:18} fill={isHi?c.hex:"#1e1e3a"}
            stroke={isHi?c.hex:isSel?"#88aaff":"#444"} strokeWidth={isHi||isSel?2.5:1} opacity={isHi||isSel?1:0.7}/>
          <text x={ox} y={oy+1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="bold"
            fill={isHi?"#fff":"#aaa"} fontFamily="serif">{note}</text>
          <circle cx={mx} cy={my} r={12} fill="transparent" stroke={isHi?"#555":"#2a2a4a"} strokeWidth="1"/>
          <text x={mx} y={my+1} textAnchor="middle" dominantBaseline="middle" fontSize="7"
            fill={isHi?"#ccc":"#555"} fontFamily="serif">{minor}</text>
        </g>);
      })}
      <circle cx={cx} cy={cy} r={42} fill="#0d0d1a" stroke="#222" strokeWidth="1"/>
      <text x={cx} y={cy-7} textAnchor="middle" fontSize="8" fill="#555" fontFamily="serif">Círculo</text>
      <text x={cx} y={cy+5} textAnchor="middle" fontSize="8" fill="#555" fontFamily="serif">de</text>
      <text x={cx} y={cy+17} textAnchor="middle" fontSize="8" fill="#555" fontFamily="serif">Quintas</text>
    </svg>
  );
};

// ─── BOTÓN BANDONEÓN ──────────────────────────────────────────────────────────
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
          ?`radial-gradient(circle at 35% 35%,${tc.hex},${tc.hex}aa)`
          :`radial-gradient(circle at 35% 35%,${oc.bg}ee,${oc.bg}88)`,
        border:`2px solid ${pressed?tc.hex:oc.border}`,
        boxShadow:pressed
          ?`0 0 10px ${tc.hex}88,inset 0 1px 3px rgba(255,255,255,0.4)`
          :`0 3px 6px rgba(0,0,0,0.6),inset 0 1px 2px rgba(255,255,255,0.1)`,
        transform:pressed?"scale(0.93)":"scale(1)",
        transition:"all 0.07s ease",
        cursor:"pointer",
      }}
    >
      <span style={{fontSize:size<36?"6.5px":"7.5px",fontWeight:"bold",
        color:pressed?"#fff":"rgba(0,0,0,0.9)",lineHeight:1,textAlign:"center"}}>{noteLat}</span>
      <span style={{fontSize:"5.5px",color:pressed?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.5)"}}>{oct}</span>
    </button>
  );
};

// Grilla de botones — layout hexagonal como imagen
const BGrid=({layout,pressed,onDown,onUp,title,size=36})=>(
  <div>
    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">{title}</p>
    <div className="inline-block p-3 rounded-2xl"
      style={{background:"linear-gradient(145deg,#281a08,#140e04)",border:"2px solid #6b4c1e",
        boxShadow:"0 8px 24px rgba(0,0,0,0.7)"}}>
      {layout.map((row,ri)=>(
        <div key={ri} className="flex gap-1 mb-1"
          style={{marginLeft:ri%2===1?(size+4)/2+"px":"0px"}}>
          {row.map((btn,bi)=>{
            const key=`${ri}-${bi}`;
            const pr=pressed.some(p=>p.ri===ri&&p.bi===bi);
            return<BBtn key={key} noteLat={btn.n} oct={btn.o}
              pressed={pr}
              onDown={(n,o)=>onDown({n,o,ri,bi})}
              onUp={(n,o)=>onUp({ri,bi})}
              size={size}/>;
          })}
        </div>
      ))}
      {/* Leyenda octavas */}
      <div className="flex gap-2 mt-2 justify-center flex-wrap">
        {[...new Set(layout.flat().map(b=>b.o))].sort().map(oct=>{
          const c=OCT_C[oct];if(!c)return null;
          return(<div key={oct} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{background:c.bg,border:`1px solid ${c.border}`}}/>
            <span style={{fontSize:"8px",color:"#777"}}>{c.label}</span>
          </div>);
        })}
      </div>
    </div>
  </div>
);

// ─── PESTAÑA BANDONEÓN ────────────────────────────────────────────────────────
function BandoneonTab(){
  const[bellows,setBellows]=useState("abriendo");
  const[view,setView]=useState("ambas");
  const[pL,setPL]=useState([]);
  const[pR,setPR]=useState([]);

  const LL=bellows==="abriendo"?BLO:BLC;
  const RL=bellows==="abriendo"?BRO:BRC;

  const downL=useCallback(({n,o,ri,bi})=>{
    playBand(n,o);
    setPL(p=>[...p.filter(x=>!(x.ri===ri&&x.bi===bi)),{n,o,ri,bi}]);
  },[]);
  const upL=useCallback(({ri,bi})=>setPL(p=>p.filter(x=>!(x.ri===ri&&x.bi===bi))),[]);
  const downR=useCallback(({n,o,ri,bi})=>{
    playBand(n,o);
    setPR(p=>[...p.filter(x=>!(x.ri===ri&&x.bi===bi)),{n,o,ri,bi}]);
  },[]);
  const upR=useCallback(({ri,bi})=>setPR(p=>p.filter(x=>!(x.ri===ri&&x.bi===bi))),[]);

  const changeBellows=(b)=>{setBellows(b);setPL([]);setPR([]);};

  const activeNotes=useMemo(()=>[...new Set([
    ...pL.map(p=>LAT[p.n]||p.n),
    ...pR.map(p=>LAT[p.n]||p.n),
  ])],[pL,pR]);

  const detected=useMemo(()=>{
    if(activeNotes.length<2)return null;
    const idxs=activeNotes.map(n=>noteIdx(n)).filter(i=>i>=0).sort((a,b)=>a-b);
    const root=CHROMATIC[idxs[0]];
    const ivs=idxs.map(i=>(i-idxs[0]+12)%12).sort((a,b)=>a-b);
    const has=i=>ivs.includes(i);
    let q="?";
    if(has(4)&&has(7)&&has(11))q="△7";
    else if(has(3)&&has(7)&&has(10))q="m7";
    else if(has(4)&&has(7)&&has(10))q="7";
    else if(has(3)&&has(6)&&has(9))q="°7";
    else if(has(3)&&has(6)&&has(10))q="ø7";
    else if(has(4)&&has(7))q="△";
    else if(has(3)&&has(7))q="m";
    else if(has(3)&&has(6))q="°";
    else if(has(4)&&has(8))q="+";
    else if(has(2)&&has(7))q="sus2";
    else if(has(5)&&has(7))q="sus4";
    else q=`(${ivs.join(",")})`;
    const rootLat=ENG_LAT[root]||root;
    return`${rootLat}${q}`;
  },[activeNotes]);

  const bSize=view==="ambas"?32:40;

  return(
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Fuelle:</span>
          {["abriendo","cerrando"].map(b=>(
            <button key={b} onClick={()=>changeBellows(b)}
              className="px-3 py-2 rounded-xl text-sm font-bold border"
              style={{background:bellows===b?(b==="abriendo"?"#071f0e":"#1f0710"):"transparent",
                borderColor:bellows===b?(b==="abriendo"?"#34d399":"#f472b6"):"#333",
                color:bellows===b?(b==="abriendo"?"#34d399":"#f472b6"):"#666"}}>
              {b==="abriendo"?"↔ Abriendo":"↔ Cerrando"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {[{id:"izquierda",label:"M. Izq"},{id:"ambas",label:"Ambas"},{id:"derecha",label:"M. Der"}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{background:view===v.id?"#1e2a4a":"transparent",
                borderColor:view===v.id?"#4466cc":"#333",color:view===v.id?"#88aaff":"#666"}}>
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={()=>{setPL([]);setPR([]);}}
          className="ml-auto text-sm px-3 py-2 rounded-lg border border-gray-800 text-gray-500 hover:text-gray-300">
          ✕ Limpiar
        </button>
      </div>

      {/* Panel notas activas */}
      <div className="rounded-2xl p-4 border border-gray-700" style={{background:"#0c0c1a",minHeight:"72px"}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Notas activas</p>
            {activeNotes.length>0
              ?<div className="flex flex-wrap gap-2">
                  {activeNotes.map((n,i)=>{const c=nc(n);return(
                    <span key={i} className="px-3 py-1 rounded-full text-base font-bold border"
                      style={{backgroundColor:c.hex+"22",borderColor:c.hex,color:c.hex}}>
                      <span className="text-xs opacity-60 mr-1">{ENG_LAT[n]||n}</span>{n}
                    </span>
                  );})}
                </div>
              :<p className="text-gray-600 italic text-sm">Presioná botones para tocar</p>}
          </div>
          {detected&&(
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Acorde detectado</p>
              <p className="text-3xl font-bold" style={{fontFamily:"serif",color:"#88aaff"}}>{detected}</p>
            </div>
          )}
        </div>
        {activeNotes.length>0&&(
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse"
              style={{background:bellows==="abriendo"?"#34d399":"#f472b6"}}/>
            <span className="text-xs" style={{color:bellows==="abriendo"?"#34d399":"#f472b6"}}>
              {bellows}
            </span>
            <span className="text-gray-700 text-xs ml-2">{activeNotes.length} nota{activeNotes.length!==1?"s":""}</span>
          </div>
        )}
      </div>

      {/* Teclados */}
      <div className={`flex gap-4 flex-wrap ${view==="ambas"?"justify-center":"justify-start"}`}>
        {(view==="ambas"||view==="izquierda")&&(
          <BGrid layout={LL} pressed={pL} onDown={downL} onUp={upL}
            title={`Mano Izquierda — ${bellows}`} size={bSize}/>
        )}
        {(view==="ambas"||view==="derecha")&&(
          <BGrid layout={RL} pressed={pR} onDown={downR} onUp={upR}
            title={`Mano Derecha — ${bellows}`} size={bSize}/>
        )}
      </div>

      <div className="rounded-xl p-4 border border-gray-800 text-sm text-gray-500" style={{background:"#0a0a12"}}>
        <p className="font-semibold text-gray-400 mb-1">Sistema Rheinische — Bandoneón argentino (71 botones)</p>
        <p>Instrumento <span className="text-gray-300 font-semibold">bisonoro</span>: cada botón produce una nota diferente al <span className="text-green-400">abrir</span> y al <span className="text-pink-400">cerrar</span> el fuelle. Layout fiel a la imagen de referencia.</p>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function HarmoniaApp(){
  const[tab,setTab]=useState("chord");
  const[chordInput,setChordInput]=useState("Dm7");
  const[chord,setChord]=useState(null);
  const[openFns,setOpenFns]=useState([0]);
  const[showTable,setShowTable]=useState(false);
  const[progInput,setProgInput]=useState("Dm7 – G7 – Cmaj7");
  const[progression,setProgression]=useState(null);
  const[selectedKey,setSelectedKey]=useState(null);
  const keyData=useMemo(()=>selectedKey?getMSD(selectedKey):null,[selectedKey]);

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
    }catch(e){console.error(e);}
  },[progInput]);

  useEffect(()=>{const c=parseChord("Dm7");setChord(c);},[]);

  const fns=useMemo(()=>chord?getFns(chord.quality):[],[chord]);
  const voicing=useMemo(()=>chord?buildVoicing(chord.root,chord.quality):null,[chord]);
  const toggleFn=useCallback((i)=>setOpenFns(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]),[]);

  const TABS=[
    {id:"chord",    label:"Acorde"},
    {id:"prog",     label:"Progresión"},
    {id:"bandoneon",label:"🎵 Bandoneón"},
    {id:"circle",   label:"Quintas"},
    {id:"colors",   label:"Colores"},
  ];

  return(
    <div className="min-h-screen text-gray-100" style={{
      background:"linear-gradient(135deg,#0a0a1a 0%,#0d0d22 50%,#0a1020 100%)",
      fontFamily:"'Crimson Text',Georgia,serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:wght@400;700&display=swap');
        .tab-btn{transition:all 0.2s}
        .glow-input:focus{outline:none;box-shadow:0 0 0 2px #4466cc55}
        .stagger>*{animation:fadeUp 0.35s ease both}
        .stagger>*:nth-child(1){animation-delay:.04s}.stagger>*:nth-child(2){animation-delay:.10s}
        .stagger>*:nth-child(3){animation-delay:.17s}.stagger>*:nth-child(4){animation-delay:.24s}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div className="border-b border-gray-800 px-4 py-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{fontFamily:"'Libre Baskerville',serif",letterSpacing:"0.06em"}}>
            <span style={{color:"#4488ff"}}>Har</span>
            <span style={{color:"#cc4444"}}>mo</span>
            <span style={{color:"#44bb44"}}>nía</span>
          </h1>
          <p className="text-sm text-gray-500 italic mt-1">Armonía para bandoneón · Tango · Jazz · Colores tonales</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className="tab-btn px-3 py-2 rounded-lg text-sm border"
              style={{background:tab===t.id?"#1e2a4a":"transparent",borderColor:tab===t.id?"#4466cc":"#333",
                color:tab===t.id?"#88aaff":"#666",opacity:tab===t.id?1:0.75}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ══ ACORDE ══ */}
        {tab==="chord"&&(
          <div className="space-y-6 stagger">
            <div className="flex gap-3">
              <input value={chordInput} onChange={e=>setChordInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&analyzeChord()}
                placeholder="Ej: Dm7, G7, Cmaj7, Am7b5, Bb7alt…"
                className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-xl text-gray-100"
                style={{fontFamily:"monospace"}}/>
              <button onClick={analyzeChord} className="px-6 py-4 rounded-xl text-base font-bold"
                style={{background:"#1e2a4a",border:"1px solid #4466cc",color:"#88aaff",whiteSpace:"nowrap"}}>
                Analizar
              </button>
            </div>

            {chord&&<>
              {/* Estructura */}
              <div className="rounded-2xl p-6 border border-gray-700" style={{background:"#0e0e20"}}>
                <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Acorde</p>
                <div className="flex items-baseline gap-3 mb-5 flex-wrap">
                  <h2 className="text-4xl font-bold" style={{fontFamily:"'Libre Baskerville',serif"}}>
                    {chord.root}<span className="text-gray-400">{chord.formula.symbol}</span>
                  </h2>
                  <span className="text-xl text-gray-400 italic">{chord.formula.label}</span>
                </div>
                <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Notas</p>
                <div className="flex flex-wrap gap-3 mb-6">
                  {chord.notes.map(n=><ColorNote key={n} note={n} size="lg"/>)}
                </div>

                {/* Voicing por manos */}
                {voicing&&<>
                  <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Distribución por manos</p>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="rounded-xl p-4 border" style={{background:"#07101f",borderColor:"#1a3060"}}>
                      <p className="text-sm font-bold mb-3" style={{color:"#4488ff"}}>← Mano izquierda</p>
                      <p className="text-xs text-gray-500 mb-2">Bajo + quinta + 7ª (oct. 3)</p>
                      <div className="space-y-1.5">
                        {voicing.L.map((v,i)=>{const c=nc(v.note);return(
                          <div key={i} className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-sm font-bold border"
                              style={{backgroundColor:"#4488ff22",borderColor:"#4488ff",color:"#88aaff"}}>
                              {v.note}
                            </span>
                            <span className="text-xs text-gray-500">{v.role}</span>
                          </div>
                        );})}
                      </div>
                    </div>
                    <div className="rounded-xl p-4 border" style={{background:"#071507",borderColor:"#1a4a1a"}}>
                      <p className="text-sm font-bold mb-3 text-green-300">Mano derecha →</p>
                      <p className="text-xs text-gray-500 mb-2">3ª + extensiones (oct. 4–5)</p>
                      <div className="space-y-1.5">
                        {voicing.R.map((v,i)=>{const c=nc(v.note);return(
                          <div key={i} className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-sm font-bold border"
                              style={{backgroundColor:c.hex+"22",borderColor:c.hex,color:c.hex}}>
                              {v.note}
                            </span>
                            <span className="text-xs text-gray-500">{v.role}</span>
                          </div>
                        );})}
                      </div>
                    </div>
                  </div>

                  {/* Piano multi-octava */}
                  <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Piano de referencia (3 octavas)</p>
                  <div className="rounded-xl p-4 border border-gray-800" style={{background:"#0a0a18"}}>
                    <PianoMulti leftVoice={voicing.L} rightVoice={voicing.R} allNotes={chord.notes}/>
                  </div>
                </>}

                <button onClick={()=>playChord(chord.notes)}
                  className="mt-4 w-full py-3 rounded-xl text-base font-semibold border"
                  style={{background:"#0d1520",borderColor:"#2a3a5a",color:"#88aaff"}}>
                  ▶ Escuchar acorde
                </button>
              </div>

              {/* Toggle entre tabla y acordeones */}
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500 uppercase tracking-widest">
                  Funciones armónicas <span className="text-gray-700">({fns.length})</span>
                </p>
                <div className="flex gap-1.5 ml-auto">
                  <button onClick={()=>setShowTable(false)}
                    className="px-3 py-1.5 rounded-lg text-xs border"
                    style={{background:!showTable?"#1e2a4a":"transparent",borderColor:!showTable?"#4466cc":"#333",
                      color:!showTable?"#88aaff":"#666"}}>
                    Detalle
                  </button>
                  <button onClick={()=>setShowTable(true)}
                    className="px-3 py-1.5 rounded-lg text-xs border"
                    style={{background:showTable?"#1e2a4a":"transparent",borderColor:showTable?"#4466cc":"#333",
                      color:showTable?"#88aaff":"#666"}}>
                    Tabla comparativa
                  </button>
                </div>
              </div>

              {showTable
                ?<ScaleCompareTable fns={fns} root={chord.root}/>
                :<div className="space-y-3">
                    {fns.map((f,i)=>(
                      <FnCard key={i} fn={f} root={chord.root}
                        isOpen={openFns.includes(i)} onToggle={()=>toggleFn(i)}/>
                    ))}
                  </div>
              }

              {/* Círculo */}
              <div className="rounded-2xl p-5 border border-gray-800" style={{background:"#0b0f20"}}>
                <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Posición en el Círculo de Quintas</p>
                <CircleOfFifths highlighted={[chord.root]}/>
              </div>
            </>}
          </div>
        )}

        {/* ══ PROGRESIÓN ══ */}
        {tab==="prog"&&(
          <div className="space-y-6 stagger">
            <div>
              <p className="text-sm text-gray-500 mb-3">Ingresá acordes separados por guion, coma o espacio</p>
              <div className="flex gap-3">
                <input value={progInput} onChange={e=>setProgInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&analyzeProg()}
                  placeholder="Ej: Dm7 – G7 – Cmaj7"
                  className="glow-input flex-1 bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-xl"
                  style={{fontFamily:"monospace"}}/>
                <button onClick={analyzeProg} className="px-6 py-4 rounded-xl text-base font-bold"
                  style={{background:"#1e2a4a",border:"1px solid #4466cc",color:"#88aaff"}}>
                  Analizar
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {["Dm7 – G7 – Cmaj7","Am7b5 – D7b9 – Gm","Cmaj7 – A7 – Dm7 – G7","Am – E7 – Am – Dm"].map(ex=>(
                  <button key={ex} onClick={()=>setProgInput(ex)}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300">{ex}</button>
                ))}
              </div>
            </div>
            {progression&&(
              <div className="space-y-4">
                <p className="text-sm text-gray-500 uppercase tracking-widest">
                  Tonalidad probable:
                  <span className="ml-2 text-yellow-400 font-bold text-lg">{progression[0]?.key} Mayor</span>
                </p>
                {progression.map((ch,i)=>{
                  const f=ch.fn;
                  const twn=(f?.tensions||[]).map(t=>({label:t,note:tNote(ch.root,t)}));
                  const scale=f?.modeIvs?buildScale(ch.root,f.modeIvs):[];
                  return(
                    <div key={i} className="rounded-2xl p-5 border border-gray-700" style={{background:"#0e0e1c"}}>
                      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
                        <span className="text-3xl font-bold" style={{fontFamily:"'Libre Baskerville',serif"}}>{ch.raw}</span>
                        <button onClick={()=>{const c=parseChord(ch.raw);if(c)playChord(c.notes);}}
                          className="text-sm text-gray-600 hover:text-blue-400">▶</button>
                        <span className="text-sm px-3 py-1 rounded-full border"
                          style={{background:"#1a2540",borderColor:"#4466cc",color:"#88aaff"}}>
                          {ch.degree} en {ch.key}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {ch.notes.map(n=><ColorNote key={n} note={n} size="md" showName={false}/>)}
                      </div>
                      {f&&(
                        <div className="rounded-xl p-4 border border-gray-800 space-y-3" style={{background:"#090912"}}>
                          <p className="text-base font-bold text-blue-300">{f.fn}</p>
                          <p className="text-sm"><span className="text-indigo-300">Modo: </span>
                            <span className="text-white font-semibold">{f.mode}</span></p>
                          {scale.length>0&&(
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Escala:</p>
                              <p className="text-base font-mono text-gray-300">{scale.join(" — ")}</p>
                            </div>
                          )}
                          {twn.length>0&&(
                            <div>
                              <p className="text-sm text-gray-500 mb-1.5">Tensiones:</p>
                              <div className="flex flex-wrap gap-2">
                                {twn.map(({label,note},j)=>{const c=note?nc(note):{hex:"#888"};return(
                                  <span key={j} className="text-sm font-mono px-2 py-1 rounded border"
                                    style={{background:c.hex+"18",borderColor:c.hex+"55",color:c.hex}}>
                                    {label}{note?` → ${note}`:""}</span>
                                );})}
                              </div>
                            </div>
                          )}
                          {f.avoid?.length>0&&(
                            <p className="text-sm"><span className="text-red-400">Evitar: </span>
                              <span className="text-gray-400">{f.avoid.map(t=>{const n=tNote(ch.root,t);return n?`${t}→${n}`:t;}).join("  ·  ")}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ BANDONEÓN ══ */}
        {tab==="bandoneon"&&(
          <div className="stagger">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>
                <span style={{color:"#f472b6"}}>Bandoneón</span>
                <span className="text-gray-500 text-sm font-normal ml-3 italic">Sistema Rheinische · 71 botones</span>
              </h2>
              <p className="text-sm text-gray-500">Tocá los botones para escuchar y detectar acordes en tiempo real</p>
            </div>
            <BandoneonTab/>
          </div>
        )}

        {/* ══ CÍRCULO ══ */}
        {tab==="circle"&&(
          <div className="stagger">
            <p className="text-sm text-gray-500 mb-5">Tocá cualquier tonalidad para ver sus detalles</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <CircleOfFifths highlighted={COF.map(c=>c.note)} onSelect={setSelectedKey} selectedKey={selectedKey}/>
              <div>
                {selectedKey&&keyData?(
                  <div className="rounded-2xl border border-gray-700 overflow-hidden" style={{background:"#0e0e1c"}}>
                    <div className="p-5 border-b border-gray-800" style={{background:nc(selectedKey).hex+"18"}}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full border-2"
                          style={{background:nc(selectedKey).hex,borderColor:nc(selectedKey).hex+"80"}}/>
                        <div>
                          <h3 className="text-2xl font-bold"
                            style={{fontFamily:"'Libre Baskerville',serif",color:nc(selectedKey).hex}}>
                            {selectedKey} Mayor
                          </h3>
                          <p className="text-sm text-gray-500">{COF.find(c=>c.note===selectedKey)?.sig}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 border-b border-gray-800">
                      <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Notas</p>
                      <div className="flex flex-wrap gap-2">
                        {keyData.notes.map(n=><ColorNote key={n} note={n} size="md" showName={false}/>)}
                      </div>
                    </div>
                    <div className="p-5 border-b border-gray-800">
                      <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Acordes diatónicos</p>
                      <div className="space-y-2">
                        {keyData.diatonic.map(d=>{const c=nc(d.note);return(
                          <div key={d.degree} className="flex items-center gap-3">
                            <span className="w-10 text-center font-mono font-bold text-base"
                              style={{color:"#88aaff"}}>{d.degree}</span>
                            <span className="font-bold text-base w-20" style={{color:c.hex}}>{d.full}</span>
                            <span className="text-gray-500 text-sm">{d.label}</span>
                            <button onClick={()=>{const ch=parseChord(d.full);if(ch)playChord(ch.notes);}}
                              className="ml-auto text-gray-600 hover:text-blue-400 text-sm">▶</button>
                          </div>
                        );})}
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-gray-500 mb-1">Relativa menor</p>
                      <p className="text-lg text-gray-300">{COF.find(c=>c.note===selectedKey)?.minorName}</p>
                      <button onClick={()=>setSelectedKey(null)}
                        className="mt-4 text-sm text-gray-600 hover:text-gray-400">✕ Cerrar</button>
                    </div>
                  </div>
                ):(
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 uppercase tracking-widest mb-3">Todas las tonalidades</p>
                    {COF.map(({note,minor})=>{const c=nc(note);return(
                      <button key={note} onClick={()=>setSelectedKey(note)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-800 text-left hover:border-gray-600"
                        style={{background:"#0e0e1c"}}>
                        <div className="w-6 h-6 rounded-full border" style={{backgroundColor:c.hex+"33",borderColor:c.hex}}/>
                        <span className="font-bold text-base w-8" style={{color:c.hex}}>{note}</span>
                        <span className="text-gray-500 text-sm">Mayor</span>
                        <span className="text-gray-600 text-sm ml-auto">→ {minor} relativa</span>
                      </button>
                    );})}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ COLORES ══ */}
        {tab==="colors"&&(
          <div className="stagger">
            <p className="text-sm text-gray-500 uppercase tracking-widest mb-6">Sistema cromático tonal</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {Object.entries(NOTE_COLORS).filter(([n])=>n.length===1).map(([note,col])=>(
                <div key={note} className="rounded-2xl p-5 border cursor-pointer"
                  style={{background:col.hex+"11",borderColor:col.hex+"44"}} onClick={()=>playTone(note,4,0.7)}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full border-2" style={{background:col.hex,borderColor:col.hex}}/>
                    <div>
                      <p className="text-2xl font-bold" style={{color:col.hex,fontFamily:"'Libre Baskerville',serif"}}>{note}</p>
                      <p className="text-sm" style={{color:col.hex+"bb"}}>{col.name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 font-mono">{col.hex}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 uppercase tracking-widest mb-4">Notas alteradas</p>
            <div className="grid grid-cols-2 gap-4">
              {["C#","D#","F#","G#","A#"].map(note=>{const col=NOTE_COLORS[note];return(
                <div key={note} className="rounded-2xl p-5 border cursor-pointer"
                  style={{background:col.hex+"11",borderColor:col.hex+"44"}} onClick={()=>playTone(note,4,0.7)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full"
                      style={{background:`linear-gradient(135deg,${col.hex},${col.hex}88)`}}/>
                    <div>
                      <p className="font-bold text-lg" style={{color:col.hex}}>{note} / {ENHARMONIC[note]}</p>
                      <p className="text-sm" style={{color:col.hex+"99"}}>{col.name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 font-mono mt-2">{col.hex}</p>
                </div>
              );})}
            </div>
          </div>
        )}

      </div>

      <div className="border-t border-gray-800 mt-8 px-6 py-4 text-center">
        <p className="text-sm text-gray-600 italic">
          Harmonía · Armonía para bandoneón · Tango · Jazz · Sistema de color tonal
        </p>
      </div>
    </div>
  );
}