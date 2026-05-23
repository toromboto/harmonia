import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { YIN } from "pitchfinder";

// ─── COLORES TONALES ──────────────────────────────────────────────────────────
const NC = {
  C:"#1E50DC", D:"#28A03C", E:"#82501E", F:"#C8B98C",
  G:"#E6C814", A:"#D22828", B:"#7828B4",
  "C#":"#2378B4","Db":"#2378B4",
  "D#":"#28B464","Eb":"#28B464",
  "F#":"#D7C050","Gb":"#D7C050",
  "G#":"#DC781E","Ab":"#DC781E",
  "A#":"#A5286E","Bb":"#A5286E",
};
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
const buildScale = (root,ivs) => ivs.map(i=>fromRoot(root,i));

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

const MODES={
  "Jónico":     [0,2,4,5,7,9,11],
  "Dórico":     [0,2,3,5,7,9,10],
  "Frigio":     [0,1,3,5,7,8,10],
  "Lidio":      [0,2,4,6,7,9,11],
  "Mixolidio":  [0,2,4,5,7,9,10],
  "Eólico":     [0,2,3,5,7,8,10],
  "Locrio":     [0,1,3,5,6,8,10],
  "Locrio #2":  [0,2,3,5,6,8,10],
  "Lidio b7":   [0,2,4,6,7,9,10],
  "Alterada":   [0,1,3,4,6,8,10],
  "Frigio Dom.":[0,1,4,5,7,8,10],
  "Disminuida": [0,2,3,5,6,8,9,11],
  "Blues":      [0,3,5,6,7,10],
};

const T_SEMI={"9":2,"b9":1,"#9":3,"11":5,"#11":6,"13":9,"b13":8,"6":9,"b6":8,"b7":10,"7":11};
const tNote=(root,t)=>{const s=T_SEMI[t];return s!==undefined?fromRoot(root,s):null;};

const MODE_BY_DEGREE=[
  {name:"Jónico",   ivs:MODES["Jónico"],   q:"△7", tensions:["9","#11","13"],avoid:["11"]},
  {name:"Dórico",   ivs:MODES["Dórico"],   q:"m7", tensions:["9","11"],      avoid:["b9"]},
  {name:"Frigio",   ivs:MODES["Frigio"],   q:"m7", tensions:["11"],          avoid:["9","13"]},
  {name:"Lidio",    ivs:MODES["Lidio"],    q:"△7", tensions:["9","#11","13"],avoid:["11"]},
  {name:"Mixolidio",ivs:MODES["Mixolidio"],q:"7",  tensions:["9","13"],      avoid:["11"]},
  {name:"Eólico",   ivs:MODES["Eólico"],   q:"m7", tensions:["9","11"],      avoid:[]},
  {name:"Locrio",   ivs:MODES["Locrio"],   q:"ø7", tensions:["11","b13"],    avoid:["b9"]},
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
const DQ=["△7","m7","m7","△7","7","m7","ø7"];
const DL=["Tónica","Supertónica","Mediante","Subdominante","Dominante","Relativa m.","Sensible"];

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
      <span style={{fontSize:6.5,color:"rgba(255,255,255,.9)",fontFamily:"monospace",lineHeight:1,zIndex:1,fontWeight:700}}>
        {oct !== null ? oct : draggable ? btn.id.replace(/[LRlr]/,"") : ""}
      </span>
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

// ─── EDITOR DRAG & DROP ───────────────────────────────────────────────────────
function BandEditor({ initialLeft, initialRight, onSave, onCancel }) {
  const [leftBtns,  setLeftBtns]  = useState(()=>initialLeft.map(b=>({...b})));
  const [rightBtns, setRightBtns] = useState(()=>initialRight.map(b=>({...b})));
  const [hand,      setHand]      = useState("left");
  const [mode,      setMode]      = useState("abre");
  const [selected,  setSelected]  = useState(null);
  const [showGrid,  setShowGrid]  = useState(true);
  const [showJS,    setShowJS]    = useState(false);
  const [copied,    setCopied]    = useState(false);

  const buttons    = hand==="left" ? leftBtns    : rightBtns;
  const setButtons = hand==="left" ? setLeftBtns : setRightBtns;
  const initials   = hand==="left" ? initialLeft : initialRight;

  const handleMove = useCallback((id,x,y)=>setButtons(p=>p.map(b=>b.id===id?{...b,x,y}:b)),[setButtons]);
  const handleEdit = useCallback((id,f,v) =>setButtons(p=>p.map(b=>b.id===id?{...b,[f]:v}:b)),[setButtons]);

  useEffect(()=>{
    const h=e=>{
      if(!selected)return;
      const step=e.shiftKey?10:SNAP;
      const dirs={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
      if(!dirs[e.key])return; e.preventDefault();
      const[dx,dy]=dirs[e.key];
      setButtons(p=>p.map(b=>b.id===selected?{...b,x:Math.max(0,b.x+dx),y:Math.max(0,b.y+dy)}:b));
    };
    window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);
  },[selected,setButtons]);

  const selBtn = buttons.find(b=>b.id===selected);

  const jsText = () => {
    const fmt=(arr,name)=>{
      const lines=arr.map(b=>`  { id:"${b.id}", row:${b.row}, x:${b.x}, y:${b.y}, abre:"${b.abre}", cierra:"${b.cierra}", color_abre:"${b.color_abre}", color_cierra:"${b.color_cierra}", oct_abre:${b.oct_abre??3}, oct_cierra:${b.oct_cierra??3} },`);
      return`const ${name} = [\n${lines.join("\n")}\n];`;
    };
    return`// Pegá esto en App.jsx reemplazando DEFS_L y DEFS_R\n\n`+fmt(leftBtns,"DEFS_L")+"\n\n"+fmt(rightBtns,"DEFS_R");
  };

  const pill=(active,v="orange")=>({
    padding:"5px 12px",borderRadius:8,border:"none",
    fontFamily:"'Courier New',monospace",fontWeight:700,fontSize:10,cursor:"pointer",
    background:active?(v==="orange"?"linear-gradient(135deg,#a05010,#f5c060)":"linear-gradient(135deg,#1a4a8a,#4a8af0)"):"transparent",
    color:active?(v==="orange"?"#0a0502":"#fff"):"#6a4020",
  });

  return (
    <div style={{fontFamily:"'Courier New',monospace"}}>
      {/* Banner */}
      <div style={{marginBottom:12,padding:"8px 14px",background:"#1a0e04",border:"1.5px solid #f5c060",borderRadius:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{color:"#f5c060",fontWeight:800,fontSize:12}}>✏️ MODO EDICIÓN</span>
        <span style={{color:"#7a5030",fontSize:10}}>Arrastrá · Flechas=2px · Shift=10px</span>
        <button onClick={()=>onSave(leftBtns,rightBtns)} style={{padding:"6px 16px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0d9488,#2dd4bf)",color:"#0a0502",fontWeight:800,fontSize:12,cursor:"pointer",marginLeft:"auto"}}>💾 Guardar y salir</button>
        <button onClick={onCancel} style={{padding:"6px 12px",borderRadius:9,border:"1px solid #3a2010",background:"transparent",color:"#7a5030",fontSize:11,cursor:"pointer"}}>Cancelar</button>
      </div>

      {/* Controles */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
        <div style={{display:"flex",background:"#100802",border:"1.5px solid #3a2010",borderRadius:10,padding:3,gap:3}}>
          <button style={pill(mode==="abre")}   onClick={()=>setMode("abre")}>▷ Abre</button>
          <button style={pill(mode==="cierra")} onClick={()=>setMode("cierra")}>◁ Cierra</button>
        </div>
        <div style={{display:"flex",background:"#100802",border:"1.5px solid #2a3060",borderRadius:10,padding:3,gap:3}}>
          <button style={pill(hand==="left","blue")}  onClick={()=>{setHand("left"); setSelected(null);}}>IZQ {leftBtns.length}</button>
          <button style={pill(hand==="right","blue")} onClick={()=>{setHand("right");setSelected(null);}}>DER {rightBtns.length}</button>
        </div>
        <button onClick={()=>setShowGrid(p=>!p)} style={{padding:"5px 10px",borderRadius:9,border:"1.5px solid #3a2010",background:"#100802",color:showGrid?"#2DD4BF":"#6a4020",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer"}}>{showGrid?"⊞ Grid ON":"⊞ Grid"}</button>
        <button onClick={()=>setButtons(initials.map(b=>({...b})))} style={{padding:"5px 10px",borderRadius:9,border:"1px solid #3a2010",background:"transparent",color:"#7a5030",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>⟳ Reset mano</button>
      </div>

      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {/* Canvas */}
        <div style={{flex:"1 1 380px",minWidth:300}}>
          <div style={{overflowX:"auto",paddingBottom:8}}>
            <BandCanvas buttons={buttons} bellows={mode} pressed={[]} heardIds={[]}
              draggable={true} onMove={handleMove} showGrid={showGrid}
              selected={selected} onSelect={setSelected}/>
          </div>

          {/* Info seleccionado */}
          {selBtn&&(
            <div style={{marginTop:8,padding:"8px 12px",background:"#1a0e04",border:"1px solid #3a2010",borderRadius:10}}>
              {/* Fila superior: ID + posición + nudge */}
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                <span style={{color:"#f5c060",fontWeight:800,fontSize:12}}>{selBtn.id}</span>
                <span style={{color:"#7a5030",fontSize:10}}>x:{selBtn.x} y:{selBtn.y}</span>
                <div style={{marginLeft:"auto",display:"flex",gap:3}}>
                  {[["←",-SNAP,0],["→",SNAP,0],["↑",0,-SNAP],["↓",0,SNAP]].map(([l,dx,dy])=>(
                    <button key={l} onClick={()=>setButtons(p=>p.map(b=>b.id===selected?{...b,x:Math.max(0,b.x+dx),y:Math.max(0,b.y+dy)}:b))}
                      style={{width:24,height:24,borderRadius:5,border:"1px solid #3a2010",background:"#100802",color:"#f5c060",fontSize:11,cursor:"pointer",padding:0}}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Fila abriendo: nota + octava + color */}
              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",marginBottom:5,padding:"5px 8px",background:"#0a1408",borderRadius:7,border:"1px solid #2a4010"}}>
                <span style={{color:"#34d399",fontSize:9,fontWeight:700,width:56}}>▷ ABRIENDO</span>
                <select value={selBtn.abre} onChange={e=>handleEdit(selBtn.id,"abre",e.target.value)}
                  style={{background:"#1a0e04",color:"#34d399",border:"1px solid #34d39955",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:64}}>
                  {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{color:"#6a4020",fontSize:9}}>oct.</span>
                <select value={selBtn.oct_abre??3} onChange={e=>handleEdit(selBtn.id,"oct_abre",parseInt(e.target.value))}
                  style={{background:"#1a0e04",color:"#34d399",border:"1px solid #34d39955",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:44}}>
                  {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <span style={{color:"#6a4020",fontSize:8,marginLeft:4}}>🎨</span>
                <input type="color" value={selBtn.color_abre||"#888"} onChange={e=>handleEdit(selBtn.id,"color_abre",e.target.value)}
                  style={{width:22,height:20,padding:1,borderRadius:4,border:"none",cursor:"pointer"}}/>
                <span style={{color:"#6a4020",fontSize:8,marginLeft:2,opacity:.7}}>
                  {selBtn.abre}{selBtn.oct_abre??3} = {(440*Math.pow(2,([0,2,4,5,7,9,11,0].indexOf(["DO","RE","MI","FA","SOL","LA","SI"].indexOf(selBtn.abre))||0)/12)).toFixed(0)}Hz
                </span>
              </div>
              {/* Fila cerrando: nota + octava + color */}
              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",padding:"5px 8px",background:"#140a14",borderRadius:7,border:"1px solid #401040"}}>
                <span style={{color:"#f472b6",fontSize:9,fontWeight:700,width:56}}>◁ CERRANDO</span>
                <select value={selBtn.cierra} onChange={e=>handleEdit(selBtn.id,"cierra",e.target.value)}
                  style={{background:"#1a0e04",color:"#f472b6",border:"1px solid #f472b655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:64}}>
                  {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{color:"#6a4020",fontSize:9}}>oct.</span>
                <select value={selBtn.oct_cierra??3} onChange={e=>handleEdit(selBtn.id,"oct_cierra",parseInt(e.target.value))}
                  style={{background:"#1a0e04",color:"#f472b6",border:"1px solid #f472b655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:44}}>
                  {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <span style={{color:"#6a4020",fontSize:8,marginLeft:4}}>🎨</span>
                <input type="color" value={selBtn.color_cierra||"#888"} onChange={e=>handleEdit(selBtn.id,"color_cierra",e.target.value)}
                  style={{width:22,height:20,padding:1,borderRadius:4,border:"none",cursor:"pointer"}}/>
              </div>
            </div>
          )}

          {/* Exportar JS */}
          <div style={{marginTop:10,display:"flex",gap:6}}>
            <button onClick={()=>setShowJS(p=>!p)} style={{padding:"4px 12px",borderRadius:7,border:"1px solid #3a2010",background:"#1a0e04",color:"#f5c060",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer"}}>
              {showJS?"Ocultar":"↓ Ver JS para el repo"}
            </button>
          </div>
          {showJS&&(
            <div style={{position:"relative",marginTop:8}}>
              <textarea readOnly value={jsText()} style={{width:"100%",height:140,background:"#080401",color:"#f5c060",border:"1px solid #3a2010",borderRadius:8,padding:8,fontSize:8,fontFamily:"'Courier New',monospace",resize:"vertical",boxSizing:"border-box"}}/>
              <button onClick={()=>navigator.clipboard.writeText(jsText()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})}
                style={{position:"absolute",top:6,right:6,padding:"2px 9px",borderRadius:5,border:"1px solid #3a2010",background:copied?"#0d9488":"#1a0e04",color:copied?"#fff":"#7a5030",fontFamily:"monospace",fontSize:9,cursor:"pointer"}}>
                {copied?"✓ Copiado":"Copiar"}
              </button>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div style={{flex:"0 0 300px",minWidth:260}}>
          <div style={{fontSize:10,fontWeight:800,color:"#f5c060",marginBottom:6}}>TABLA · {hand==="left"?"IZQUIERDA":"DERECHA"}</div>
          <div style={{overflowY:"auto",maxHeight:460,border:"1px solid #2a1608",borderRadius:8}}>
            <table style={{borderCollapse:"collapse",fontSize:9,width:"100%",fontFamily:"'Courier New',monospace"}}>
              <thead>
                <tr style={{background:"#1a0e04",position:"sticky",top:0}}>
                  {["ID","X","Y","▷ Nota","oct","◁ Nota","oct","🎨▷","🎨◁"].map(h=>(
                    <th key={h} style={{padding:"5px 4px",textAlign:"left",color:"#6a4020",borderBottom:"1px solid #2a1608",whiteSpace:"nowrap",fontSize:8}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buttons.map(btn=>{
                  const isSel=btn.id===selected;
                  const cNow=mode==="abre"?btn.color_abre:btn.color_cierra;
                  return(
                    <tr key={btn.id} onClick={()=>setSelected(btn.id)} style={{background:isSel?"rgba(245,192,96,.09)":"transparent",cursor:"pointer",borderBottom:"1px solid rgba(26,14,4,.5)",outline:isSel?"1px solid rgba(245,192,96,.25)":"none"}}>
                      <td style={{padding:"2px 4px"}}><span style={{color:cNow||"#888",fontWeight:700}}>{btn.id}</span></td>
                      <td style={{padding:"2px 4px",color:"#7a5030"}}>{btn.x}</td>
                      <td style={{padding:"2px 4px",color:"#7a5030"}}>{btn.y}</td>
                      <td style={{padding:"2px 2px"}}>
                        <select value={btn.abre} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"abre",e.target.value);}} onClick={e=>e.stopPropagation()}
                          style={{background:"#1a0e04",color:"#34d399",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:48}}>
                          {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"2px 2px"}} onClick={e=>e.stopPropagation()}>
                        <select value={btn.oct_abre??3} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"oct_abre",parseInt(e.target.value));}} onClick={e=>e.stopPropagation()}
                          style={{background:"#1a0e04",color:"#34d399",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:30}}>
                          {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"2px 2px"}}>
                        <select value={btn.cierra} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"cierra",e.target.value);}} onClick={e=>e.stopPropagation()}
                          style={{background:"#1a0e04",color:"#f472b6",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:48}}>
                          {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"2px 2px"}} onClick={e=>e.stopPropagation()}>
                        <select value={btn.oct_cierra??3} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"oct_cierra",parseInt(e.target.value));}} onClick={e=>e.stopPropagation()}
                          style={{background:"#1a0e04",color:"#f472b6",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:30}}>
                          {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"2px 2px"}} onClick={e=>e.stopPropagation()}>
                        <input type="color" value={btn.color_abre||"#888"} onChange={e=>handleEdit(btn.id,"color_abre",e.target.value)}
                          style={{width:20,height:16,padding:0,borderRadius:3,border:"none",cursor:"pointer"}}/>
                      </td>
                      <td style={{padding:"2px 2px"}} onClick={e=>e.stopPropagation()}>
                        <input type="color" value={btn.color_cierra||"#888"} onChange={e=>handleEdit(btn.id,"color_cierra",e.target.value)}
                          style={{width:20,height:16,padding:0,borderRadius:3,border:"none",cursor:"pointer"}}/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DESKTOP LAYOUT: 3 COLUMNAS con escala automática ────────────────────────
// [Teclado Izq escalado] [Panel central: notas + acorde + fuelle] [Teclado Der escalado]
// Los canvas se escalan con transform:scale para caber sin overflow.
function DesktopBandLayout({
  leftBtns, rightBtns, bellows, view,
  pressedL, pressedR, heardIdsL, heardIdsR,
  downL, upL, downR, upR,
  OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE,
  activeNotes, detected, heardNote, LAT,
}) {
  // voicingHighlight: notas del voicing buscado que se marcan en el teclado
  // formato: Set de strings "NOTA" en inglés (sin octava) ej: {"C","E","G"}
  const [voicingHighlight, setVoicingHighlight] = useState(new Set());
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Dimensiones reales de cada canvas (sin escalar)
  const BTN = 44;
  const rawW_L = leftBtns.length  ? Math.max(...leftBtns.map(b=>b.x))  + BTN + 16 : 750;
  const rawH_L = leftBtns.length  ? Math.max(...leftBtns.map(b=>b.y))  + BTN + 20 : 400;
  const rawW_R = rightBtns.length ? Math.max(...rightBtns.map(b=>b.x)) + BTN + 16 : 750;
  const rawH_R = rightBtns.length ? Math.max(...rightBtns.map(b=>b.y)) + BTN + 20 : 400;

  // Ancho del panel central fijo
  const CENTER_W = 220;
  const GAP = 12;

  useEffect(()=>{
    if(!containerRef.current) return;
    const obs = new ResizeObserver(()=>{
      const totalW = containerRef.current.clientWidth;
      // Los teclados están rotados 90°:
      // su ancho visual = rawH original, su alto visual = rawW original
      // Necesitamos que los dos "anchos visuales" (rawH_L + rawH_R) quepan en totalW
      const neededW  = rawH_L + rawH_R + GAP * 2;
      const scaleByW = totalW > 0 ? (totalW * 0.95) / neededW : 1;
      // Alto disponible: viewport menos controles (~300px)
      const availH   = window.innerHeight - 300;
      // Alto visual de un teclado rotado = rawW
      const maxRawW  = Math.max(rawW_L, rawW_R);
      const scaleByH = availH > 0 ? (availH * 0.55) / maxRawW : 1;
      const s = Math.min(1, scaleByW, scaleByH);
      setScale(Math.max(0.3, s));
    });
    obs.observe(containerRef.current);
    return ()=>obs.disconnect();
  },[rawW_L, rawW_R, rawH_L, rawH_R]);

  // Altura visual que ocupa cada canvas escalado
  const visH_L = Math.ceil(rawH_L * scale);
  const visH_R = Math.ceil(rawH_R * scale);
  const visH   = Math.max(visH_L, visH_R);
  const visW_L = Math.ceil(rawW_L * scale);
  const visW_R = Math.ceil(rawW_R * scale);

  // ── ScaledCanvas con rotación real del instrumento ──────────────────────────
  // rotation: -90 para mano izquierda, +90 para mano derecha
  // voicingHighlight: Set<string> de notas en inglés a resaltar (ej: {"C","E","G"})
  const ScaledCanvas = ({buttons, bellows: bel, pressed, heardIds, onDown, onUp,
    octMap, rawW, rawH, label, rotation=0}) => {

    // Al rotar 90°: el ancho visual pasa a ser el alto original y viceversa
    const rotated = rotation !== 0;
    const visW = rotated ? Math.ceil(rawH * scale) : Math.ceil(rawW * scale);
    const visH = rotated ? Math.ceil(rawW * scale) : Math.ceil(rawH * scale);

    // Origen de transformación: centro del canvas para que la rotación sea correcta
    const translateX = rotated ? (rawH * scale - rawW * scale) / 2 : 0;
    const translateY = rotated ? -(rawH * scale - rawW * scale) / 2 : 0;

    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontSize:9,color:"#5a3a18",marginBottom:4,letterSpacing:"0.14em",
          width:visW+"px",textAlign:"center",fontFamily:"monospace"}}>
          {label} · {buttons.length}
        </div>
        <div style={{width:visW+"px", height:visH+"px", position:"relative", flexShrink:0, overflow:"hidden"}}>
          <div style={{
            position:"absolute",
            top: rotated ? translateY+"px" : "0",
            left: rotated ? translateX+"px" : "0",
            width:rawW+"px", height:rawH+"px",
            transformOrigin:"center center",
            transform:`scale(${scale}) rotate(${rotation}deg)`,
          }}>
            <div style={{position:"relative", width:rawW, height:rawH, touchAction:"none"}}>
              {buttons.map(btn=>{
                // Nota de este botón en el estado actual del fuelle
                const notaLat = bel==="abre" ? btn.abre : btn.cierra;
                const notaEng = LAT[notaLat] || notaLat;
                const isVoicing = voicingHighlight.has(notaEng);
                return (
                  <BandBtn key={btn.id} btn={btn} bellows={bel}
                    pressed={pressed}
                    isHeard={heardIds.includes(btn.id) || isVoicing}
                    onDown={onDown} onUp={onUp}
                    oct={octMap ? octMap[btn.id] : null}/>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Panel central: búsqueda de acorde + disposición sugerida + mini-biblioteca
  const CentralPanel = () => {
    const CHROMATIC_LAT = ["DO","DO#","RE","RE#","MI","FA","FA#","SOL","SOL#","LA","LA#","SI"];
    const [input, setInput] = useState("");
    const [result, setResult] = useState(null);

    // Voicings predefinidos por tipo de acorde (en semitonos desde la raíz)
    // Cada voicing tiene nombre + intervalos desde la fundamental
    const VOICINGS = {
      "△": [
        {nombre:"Cerrado",   ivs:[0,4,7],        desc:"Tríada en posición cerrada"},
        {nombre:"1ª inv.",   ivs:[4,7,12],       desc:"Terce en el bajo"},
        {nombre:"2ª inv.",   ivs:[7,12,16],      desc:"Quinta en el bajo"},
        {nombre:"Abierto",   ivs:[0,7,16],       desc:"Quinta + décima"},
      ],
      "m": [
        {nombre:"Cerrado",   ivs:[0,3,7],        desc:"Tríada menor cerrada"},
        {nombre:"1ª inv.",   ivs:[3,7,12],       desc:"Tercera menor en el bajo"},
        {nombre:"2ª inv.",   ivs:[7,12,15],      desc:"Quinta en el bajo"},
        {nombre:"Abierto",   ivs:[0,7,15],       desc:"Quinta + décima menor"},
      ],
      "7": [
        {nombre:"Guía-notas", ivs:[4,10],        desc:"3ª + 7ª (tritono)"},
        {nombre:"Drop-2",    ivs:[0,4,7,10],     desc:"Posición cerrada"},
        {nombre:"Sin raíz",  ivs:[4,7,10],       desc:"3ª·5ª·7ª sin fundamental"},
        {nombre:"Shell",     ivs:[0,10,16],      desc:"Raíz·7ª·3ª (oct alta)"},
      ],
      "△7": [
        {nombre:"Guía-notas", ivs:[4,11],        desc:"3ª + 7ª mayor"},
        {nombre:"Drop-2",    ivs:[0,4,7,11],     desc:"Posición cerrada"},
        {nombre:"Sin raíz",  ivs:[4,7,11],       desc:"3ª·5ª·7ª mayor"},
        {nombre:"Shell",     ivs:[0,11,16],      desc:"Raíz·△7·3ª (oct alta)"},
      ],
      "m7": [
        {nombre:"Guía-notas", ivs:[3,10],        desc:"3ª menor + 7ª menor"},
        {nombre:"Drop-2",    ivs:[0,3,7,10],     desc:"Posición cerrada"},
        {nombre:"Sin raíz",  ivs:[3,7,10],       desc:"3ª·5ª·7ª sin fundamental"},
        {nombre:"Shell",     ivs:[0,10,15],      desc:"Raíz·7ª·3ª menor (oct alta)"},
      ],
      "m7b5": [
        {nombre:"Guía-notas", ivs:[3,10],        desc:"3ª menor + 7ª menor"},
        {nombre:"Cerrado",   ivs:[0,3,6,10],     desc:"Semidisminuido cerrado"},
        {nombre:"Sin raíz",  ivs:[3,6,10],       desc:"3ª·5ªb·7ª"},
      ],
      "°7": [
        {nombre:"Simétrico", ivs:[0,3,6,9],      desc:"Divisiones simétricas"},
        {nombre:"Sin raíz",  ivs:[3,6,9],        desc:"3 notas del °7"},
      ],
      "default": [
        {nombre:"Todas",     ivs:[0,4,7],        desc:"Disposición básica"},
      ],
    };

    const LAT_ENG2 = {"DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F","FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B"};
    const ENG_LAT2 = Object.fromEntries(Object.entries(LAT_ENG2).map(([k,v])=>[v,k]));
    const MIDI_N = {C:60,"C#":61,D:62,"D#":63,E:64,F:65,"F#":66,G:67,"G#":68,A:69,"A#":70,B:71};
    const CHR = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

    const parseCentral = (s) => {
      const t = s.trim();
      // Detectar raíz en español (DO, RE, MI...) o inglés (C, D, E...)
      const mLat = t.match(/^(DO#|DO|RE#|RE|MI|FA#|FA|SOL#|SOL|LA#|LA|SI)/i);
      const mEng = t.match(/^([A-G][#b]?)/);
      let root = null, rest = "";
      if (mLat) {
        root = LAT_ENG2[mLat[1].toUpperCase()];
        rest = t.slice(mLat[1].length).toLowerCase().trim();
      } else if (mEng) {
        root = mEng[1];
        if (root.length>1 && root[1]==="b") root = CHR[(CHR.indexOf(root[0])+11)%12];
        rest = t.slice(mEng[1].length).toLowerCase().trim();
      }
      if (!root) return null;
      let q = "△";
      if (rest.includes("m7b5")||rest.includes("ø"))  q="m7b5";
      else if (rest.includes("dim7")||rest.includes("°7")) q="°7";
      else if (rest.includes("△7")||rest.includes("maj7")||rest.includes("∆7")) q="△7";
      else if (rest.includes("m7"))  q="m7";
      else if (rest.includes("7"))   q="7";
      else if (rest.includes("m"))   q="m";
      const rootIdx = CHR.indexOf(root);
      const voicingSet = VOICINGS[q] || VOICINGS["default"];
      const voicings = voicingSet.map(v=>({
        ...v,
        notes: v.ivs.map(i=>{
          const noteEng = CHR[(rootIdx+i)%12];
          const oct = 4 + Math.floor((rootIdx+i)/12);
          return {eng:noteEng, lat:ENG_LAT2[noteEng]||noteEng, oct, semi:i};
        }),
      }));
      return {rootEng:root, rootLat:ENG_LAT2[root]||root, q, voicings};
    };

    const playVoicing = (notes) => {
      notes.forEach(({eng, oct},i)=>{
        setTimeout(()=>playBandSound(eng, oct, 1.5), i*30);
      });
      // Marcar estas notas en el teclado
      setVoicingHighlight(new Set(notes.map(n=>n.eng)));
    };

    const handleAnalyze = () => {
      const r = parseCentral(input);
      setResult(r);
      if (r && r.voicings[0]) playVoicing(r.voicings[0].notes);
      else setVoicingHighlight(new Set());
    };

    // Notas activas del teclado — mostrarlas siempre arriba
    const hasActive = activeNotes.length > 0 || heardNote;

    return (
      <div style={{display:"flex",flexDirection:"column",gap:8}}>

        {/* Notas tocadas en el teclado */}
        {hasActive && (
          <div style={{background:"#09090f",borderRadius:10,padding:"8px 10px",border:"1px solid #1a1a28"}}>
            <div style={{fontSize:8,color:"#383848",marginBottom:5,letterSpacing:"0.12em",fontFamily:"monospace"}}>TOCANDO AHORA</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:detected?6:0}}>
              {activeNotes.map(n=>{
                const notaPura=n.replace(/\d+$/,"");
                const oct=(n.match(/\d+$/)||[""])[0];
                const engKey=LAT[notaPura]||notaPura;
                return(<span key={n} style={{padding:"2px 6px",borderRadius:20,background:nc(engKey)+"22",border:`1px solid ${nc(engKey)}`,color:nc(engKey),fontWeight:700,fontSize:10}}>{notaPura}<span style={{fontSize:"0.7em",opacity:.6,marginLeft:1}}>{oct}</span></span>);
              })}
            </div>
            {detected&&(
              <div style={{fontSize:22,fontWeight:900,color:"#88aaff",fontFamily:"serif",lineHeight:1,textAlign:"center",padding:"4px 0 2px"}}>{detected}</div>
            )}
          </div>
        )}

        {/* Buscador de acorde */}
        <div style={{background:"#09090f",borderRadius:10,padding:"8px 10px",border:"1px solid #1a1a28"}}>
          <div style={{fontSize:8,color:"#383848",marginBottom:6,letterSpacing:"0.12em",fontFamily:"monospace"}}>CONSULTAR VOICING</div>
          <div style={{display:"flex",gap:4,marginBottom:6}}>
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleAnalyze()}
              placeholder="Ej: Rem7, Sol7, Cmaj7"
              style={{flex:1,background:"#111120",border:"1px solid #2a2a44",borderRadius:6,padding:"4px 7px",color:"#ccc",fontSize:10,fontFamily:"monospace",outline:"none"}}
            />
            <button onClick={handleAnalyze}
              style={{padding:"4px 9px",borderRadius:6,border:"none",background:"#1e2a4a",color:"#88aaff",fontWeight:700,fontSize:10,cursor:"pointer",flexShrink:0}}>
              ▶
            </button>
          </div>
          {/* Atajos rápidos */}
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {["Dm7","G7","Cmaj7","Am7b5","E7","Am"].map(ex=>(
              <button key={ex} onClick={()=>{setInput(ex);const r=parseCentral(ex);setResult(r);if(r&&r.voicings[0])playVoicing(r.voicings[0].notes);}}
                style={{padding:"2px 6px",borderRadius:5,border:"1px solid #222234",background:"transparent",color:"#444466",fontSize:9,cursor:"pointer",fontFamily:"monospace"}}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Resultado: voicings */}
        {result && (
          <div style={{background:"#09090f",borderRadius:10,padding:"8px 10px",border:"1px solid #1a1a28"}}>
            <div style={{fontSize:9,color:"#88aaff",fontWeight:700,fontFamily:"serif",marginBottom:6,textAlign:"center"}}>
              {result.rootLat}<span style={{opacity:.7}}>{result.q}</span>
            </div>
            {result.voicings.map((v,vi)=>(
              <div key={vi}
                onClick={()=>playVoicing(v.notes)}
                style={{marginBottom:vi<result.voicings.length-1?6:0,padding:"5px 7px",borderRadius:7,
                  border:"1px solid #1a1a30",background:vi===0?"#0e0e1e":"transparent",cursor:"pointer"}}
              >
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:8,fontWeight:700,color:vi===0?"#88aaff":"#444",fontFamily:"monospace",letterSpacing:"0.08em"}}>{v.nombre}</span>
                  <span style={{fontSize:7,color:"#333",fontStyle:"italic"}}>{v.desc}</span>
                  <span style={{fontSize:8,color:"#333"}}>▶</span>
                </div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {v.notes.map((n,ni)=>(
                    <div key={ni} style={{display:"flex",flexDirection:"column",alignItems:"center",
                      padding:"3px 5px",borderRadius:5,
                      background:nc(n.eng)+"18",border:`1px solid ${nc(n.eng)}44`}}>
                      <span style={{fontSize:9,fontWeight:800,color:nc(n.eng),fontFamily:"monospace"}}>{n.lat}</span>
                      <span style={{fontSize:7,color:"#333"}}>{n.oct}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info mínima */}
        <div style={{fontSize:8,color:"#2a2a3a",fontFamily:"monospace",textAlign:"center",lineHeight:1.6}}>
          Rheinische · 71 botones<br/>
          <span style={{color:"#1a3a1a"}}>▷ abre</span> · <span style={{color:"#3a1a3a"}}>◁ cierra</span>
        </div>
      </div>
    );
  };

  const showL = view==="ambas"||view==="izquierda";
  const showR = view==="ambas"||view==="derecha";

  // ── Layout: teclados arriba lado a lado (rotados), panel abajo ancho completo ──
  // El teclado izquierdo gira -90° (como al sostener el instrumento)
  // El teclado derecho gira +90°
  // El scale se calcula sobre las dimensiones POST-rotación:
  //   rotado: ancho visual = rawH, alto visual = rawW
  const scaleL = scale;
  const scaleR = scale;

  return (
    <div ref={containerRef} style={{width:"100%", paddingBottom:8}}>

      {/* ── FILA SUPERIOR: los dos teclados rotados ── */}
      <div style={{display:"flex", gap:GAP*2, justifyContent:"center",
        alignItems:"flex-end", marginBottom:12, flexWrap:"nowrap"}}>

        {showL && (
          <ScaledCanvas
            buttons={leftBtns} bellows={bellows}
            pressed={pressedL} heardIds={heardIdsL}
            onDown={downL} onUp={upL}
            octMap={bellows==="abre"?OCT_L_OPEN:OCT_L_CLOSE}
            rawW={rawW_L} rawH={rawH_L}
            label="← IZQ" rotation={-90}/>
        )}

        {showR && (
          <ScaledCanvas
            buttons={rightBtns} bellows={bellows}
            pressed={pressedR} heardIds={heardIdsR}
            onDown={downR} onUp={upR}
            octMap={bellows==="abre"?OCT_R_OPEN:OCT_R_CLOSE}
            rawW={rawW_R} rawH={rawH_R}
            label="DER →" rotation={90}/>
        )}

      </div>

      {/* ── PANEL INFERIOR: notas activas + buscador de voicings ── */}
      <div style={{width:"100%"}}>
        <CentralPanel/>
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
  const detected = useMemo(()=>{
    if(activeNotes.length<2)return null;
    // activeNotes ahora es "SOL3" — extraer solo la nota para detectar acorde
    const noteOnly = activeNotes.map(n=>n.replace(/\d+$/,""));
    const idxs=noteOnly.map(n=>noteIdxB(n)).filter(i=>i>=0).sort((a,b)=>a-b);
    const root=CHROMATIC_B[idxs[0]];
    const ivs=idxs.map(i=>(i-idxs[0]+12)%12).sort((a,b)=>a-b);
    const has=i=>ivs.includes(i);
    let q="?";
    if(has(4)&&has(7)&&has(11))q="△7"; else if(has(3)&&has(7)&&has(10))q="m7";
    else if(has(4)&&has(7)&&has(10))q="7"; else if(has(3)&&has(6)&&has(9))q="°7";
    else if(has(3)&&has(6)&&has(10))q="ø7"; else if(has(4)&&has(7))q="△";
    else if(has(3)&&has(7))q="m"; else if(has(3)&&has(6))q="°";
    const rootLat = ENG_TO_LAT[root]??root;
    return`${rootLat}${q}`;
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


// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function HarmoniaApp(){
  const[tab,setTab]=useState("chord");
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
    {id:"chord",     label:"Acorde",     icon:"🎼"},
    {id:"prog",      label:"Progresión", icon:"🔗"},
    {id:"biblioteca",label:"Biblioteca", icon:"📚"},
    {id:"bandoneon", label:"Bandoneón",  icon:"🎵"},
    {id:"circle",    label:"Quintas",    icon:"⭕"},
    {id:"colors",    label:"Colores",    icon:"🎨"},
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

            {/* ══ COLORES ══ */}
            {tab==="colors"&&(
              <div className="stagger">
                <div className="mb-4">
                  <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>🎨 Sistema Cromático Tonal</h2>
                  <p className="text-xs text-gray-500">Cada nota tiene un color único. Tocá para escuchar.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {Object.entries(NC).filter(([n])=>n.length===1).map(([note,hex])=>(
                    <div key={note} className="rounded-xl p-4 border cursor-pointer"
                      style={{background:hex+"11",borderColor:hex+"44"}}
                      onClick={()=>playTone(note,4,0.7)}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2" style={{background:hex,borderColor:hex}}/>
                        <div>
                          <p className="text-xl font-bold" style={{color:hex,fontFamily:"'Libre Baskerville',serif"}}>{note}</p>
                          <p className="text-xs font-mono text-gray-600">{hex}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Notas alteradas</p>
                <div className="grid grid-cols-2 gap-3">
                  {["C#","D#","F#","G#","A#"].map(note=>{
                    const hex=NC[note];
                    return(
                      <div key={note} className="rounded-xl p-4 border cursor-pointer"
                        style={{background:hex+"11",borderColor:hex+"44"}}
                        onClick={()=>playTone(note,4,0.7)}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full" style={{background:`linear-gradient(135deg,${hex},${hex}88)`}}/>
                          <div>
                            <p className="font-bold" style={{color:hex}}>{note} / {ENHARMONIC[note]}</p>
                            <p className="text-xs font-mono text-gray-600">{hex}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
