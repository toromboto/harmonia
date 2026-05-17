import { useState, useEffect, useCallback, useMemo } from "react";

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

function BandoneonTab(){
  const[bellows,setBellows]=useState("abriendo");
  const[view,setView]=useState("ambas");
  const[pL,setPL]=useState([]);
  const[pR,setPR]=useState([]);
  const LL=bellows==="abriendo"?BLO:BLC;
  const RL=bellows==="abriendo"?BRO:BRC;
  const downL=useCallback(({n,o,ri,bi})=>{playBand(n,o);setPL(p=>[...p.filter(x=>!(x.ri===ri&&x.bi===bi)),{n,o,ri,bi}]);},[]);
  const upL=useCallback(({ri,bi})=>setPL(p=>p.filter(x=>!(x.ri===ri&&x.bi===bi))),[]);
  const downR=useCallback(({n,o,ri,bi})=>{playBand(n,o);setPR(p=>[...p.filter(x=>!(x.ri===ri&&x.bi===bi)),{n,o,ri,bi}]);},[]);
  const upR=useCallback(({ri,bi})=>setPR(p=>p.filter(x=>!(x.ri===ri&&x.bi===bi))),[]);
  const changeBellows=b=>{setBellows(b);setPL([]);setPR([]);};
  const activeNotes=useMemo(()=>[...new Set([...pL.map(p=>LAT[p.n]||p.n),...pR.map(p=>LAT[p.n]||p.n)])],[pL,pR]);
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
    else q=`(${ivs.join(",")})`;
    return`${ENG_LAT[root]||root}${q}`;
  },[activeNotes]);
  const bSize=view==="ambas"?32:40;
  return(
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Fuelle:</span>
          {["abriendo","cerrando"].map(b=>(
            <button key={b} onClick={()=>changeBellows(b)}
              className="px-3 py-1.5 rounded-xl text-sm font-bold border"
              style={{background:bellows===b?(b==="abriendo"?"#071f0e":"#1f0710"):"transparent",
                borderColor:bellows===b?(b==="abriendo"?"#34d399":"#f472b6"):"#333",
                color:bellows===b?(b==="abriendo"?"#34d399":"#f472b6"):"#666"}}>
              {b==="abriendo"?"↔ Abrir":"↔ Cerrar"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[{id:"izquierda",label:"M.Izq"},{id:"ambas",label:"Ambas"},{id:"derecha",label:"M.Der"}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)}
              className="px-2.5 py-1.5 rounded-lg text-xs border"
              style={{background:view===v.id?"#1e2a4a":"transparent",borderColor:view===v.id?"#4466cc":"#333",color:view===v.id?"#88aaff":"#666"}}>
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={()=>{setPL([]);setPR([]);}} className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-gray-800 text-gray-500">✕ Limpiar</button>
      </div>
      <div className="rounded-2xl p-4 border border-gray-700" style={{background:"#0c0c1a",minHeight:"64px"}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Notas activas</p>
            {activeNotes.length>0
              ?<div className="flex flex-wrap gap-2">
                  {activeNotes.map((n,i)=>(
                    <span key={i} className="px-2.5 py-1 rounded-full text-sm font-bold border"
                      style={{backgroundColor:nc(n)+"22",borderColor:nc(n),color:nc(n)}}>
                      <span className="text-xs opacity-60 mr-1">{ENG_LAT[n]||n}</span>{n}
                    </span>
                  ))}
                </div>
              :<p className="text-gray-600 italic text-sm">Presioná botones para tocar</p>}
          </div>
          {detected&&(
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Acorde detectado</p>
              <p className="text-2xl font-bold" style={{fontFamily:"serif",color:"#88aaff"}}>{detected}</p>
            </div>
          )}
        </div>
      </div>
      <div className={`flex gap-4 flex-wrap ${view==="ambas"?"justify-center":"justify-start"}`}>
        {(view==="ambas"||view==="izquierda")&&(
          <BGrid layout={LL} pressed={pL} onDown={downL} onUp={upL}
            title={`M.Izquierda — ${bellows}`} size={bSize}/>
        )}
        {(view==="ambas"||view==="derecha")&&(
          <BGrid layout={RL} pressed={pR} onDown={downR} onUp={upR}
            title={`M.Derecha — ${bellows}`} size={bSize}/>
        )}
      </div>
      <div className="rounded-xl p-3 border border-gray-800 text-xs text-gray-500" style={{background:"#0a0a12"}}>
        <span className="font-semibold text-gray-400">Sistema Rheinische — 71 botones. </span>
        Bisonoro: cada botón produce nota diferente al <span className="text-green-400">abrir</span> y al <span className="text-pink-400">cerrar</span>.
      </div>
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
          <div className="max-w-2xl mx-auto px-4 py-6">

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
