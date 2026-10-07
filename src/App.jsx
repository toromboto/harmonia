import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { YIN } from "pitchfinder";

// ─── COLORES TONALES ──────────────────────────────────────────────────────────
// Paleta oficial "de estudio" (Manual de teoría musical a través del color,
// Capítulo 0 / Capítulo 5 / Anexo — Ficha de referencia rápida).
// Fuente única de verdad para el color de cada nota en TODA la app.
const NC = {
  C:"#002e93", D:"#357a25", E:"#845523", F:"#b8823c",
  G:"#f1b302", A:"#cd2821", B:"#672e87",
  "C#":"#23879f","Db":"#23879f",
  "D#":"#91a51e","Eb":"#91a51e",
  "F#":"#ecd9a3","Gb":"#ecd9a3",
  "G#":"#dc7212","Ab":"#dc7212",
  "A#":"#da4571","Bb":"#da4571",
};
const nc = (n) => { const k=n?.replace(/[0-9]/g,"").trim(); if(NC[k]) return NC[k]; const i=noteIdx(k); return (i>=0 && NC[CHROMATIC[i]]) || "#888"; };

// ─── MEZCLA DE COLOR DE ACORDES (Capítulo 10 del manual) ──────────────────────
// Modelo "luz" (promedio aditivo en RGB) con criterio "raíz dominante":
// la fundamental se queda con rootWeight% del peso total (80% por defecto) y el
// resto del acorde reparte en partes iguales el porcentaje restante. Así el color
// resultante nunca se aleja demasiado de la tónica, sin importar las tensiones.
const hexToRgb = (hex) => {
  const h = hex.replace("#","");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
};
const rgbToHex = (r,g,b) => "#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");
const mixLuzRaizDominante = (notes, rootWeight=0.8) => {
  // notes: array de nombres de nota (la primera es la raíz)
  if(!notes || notes.length===0) return "#888888";
  if(notes.length===1) return nc(notes[0]);
  const restW = (1-rootWeight)/(notes.length-1);
  let r=0,g=0,b=0;
  notes.forEach((n,i)=>{
    const w = i===0 ? rootWeight : restW;
    const [rr,gg,bb] = hexToRgb(nc(n));
    r+=rr*w; g+=gg*w; b+=bb*w;
  });
  return rgbToHex(r,g,b);
};

const CHROMATIC  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC = {"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
const enh = n => ENHARMONIC[n]||n;
const NAT_PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const LETRAS = ["C","D","E","F","G","A","B"];
const LAT_NOMBRE = {C:"Do",D:"Re",E:"Mi",F:"Fa",G:"Sol",A:"La",B:"Si"};
// Altura (0-11) de cualquier nombre bien escrito: C, C#, Db, F##, Bbb…
const noteIdx = n => {
  const i=CHROMATIC.indexOf(n); if(i>=0) return i;
  const m=/^([A-G])(#{1,2}|b{1,2}|x)?$/.exec(String(n||"").trim());
  if(!m) return -1;
  const acc = !m[2] ? 0 : m[2]==="x" ? 2 : m[2][0]==="#" ? m[2].length : -m[2].length;
  return ((NAT_PC[m[1]]+acc)%12+12)%12;
};
// Grado (letra) por defecto según la distancia en semitonos, cuando no se conoce el intervalo exacto.
const GRADO_DEF  = {0:0,1:1,2:1,3:2,4:2,5:3,6:4,7:4,8:5,9:5,10:6,11:6};
const GRADO_DEF_SOST = {0:0,1:0,2:1,3:1,4:2,5:3,6:3,7:4,8:4,9:5,10:5,11:6};
// Deletrea respetando la regla: cada grado usa una letra distinta (3ª = dos letras arriba, 7ª = seis, etc.).
const spell = (root,semi,deg,sost=false) => {
  const ri=noteIdx(root); if(ri<0) return CHROMATIC[((semi%12)+12)%12];
  const sm=((semi%12)+12)%12;
  const d = deg!==undefined ? deg : (sost?GRADO_DEF_SOST:GRADO_DEF)[sm];
  const letter = LETRAS[(LETRAS.indexOf(root[0])+d)%7];
  const target=(ri+sm)%12;
  let diff=((target-NAT_PC[letter])%12+12)%12; if(diff>6) diff-=12;
  if(Math.abs(diff)>2) return CHROMATIC[target];
  return letter+(diff===0?"":diff>0?"#".repeat(diff):"b".repeat(-diff));
};
const fromRoot = (root,semi,deg) => spell(root,semi,deg);
const buildScale = (root,ivs) => {
  const key=ivs.join(",");
  if(ivs.length===7) return ivs.map((iv,i)=>spell(root,iv,i));
  if(key==="0,3,5,6,7,10") return ivs.map((iv,i)=>spell(root,iv,[0,2,3,4,4,6][i]));
  if(key==="0,2,3,5,6,8,9,11") return ivs.map((iv,i)=>spell(root,iv,[0,1,2,3,4,5,5,6][i]));
  if(ivs.length===12){ // cromática: sostenidos o bemoles según la tonalidad
    const usaBemoles = /b/.test(root) || root==="F";
    const nombres = usaBemoles ? ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] : CHROMATIC;
    return ivs.map(iv=>nombres[(noteIdx(root)+iv)%12]);
  }
  return ivs.map(iv=>spell(root,iv));
};
// Nombre en español con símbolos (Si♭, Fa♯, Do𝄪…)
const nombreLat = (n) => {
  const m=/^([A-G])(.*)$/.exec(String(n||"")); if(!m) return n;
  const acc=m[2].replace(/##/g,"𝄪").replace(/#/g,"♯").replace(/bb/g,"♭♭").replace(/b/g,"♭");
  return LAT_NOMBRE[m[1]]+acc;
};
const LAT={"DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F","FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B"};
const ENG_LAT=Object.fromEntries(Object.entries(LAT).map(([k,v])=>[v,k]));

// ─── SISTEMA DE DISEÑO: botones tipo "pill" compartidos ──────────────────────
const UI_FONT = "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif";
const uiPill = (on, extra={}) => ({
  padding:"6px 13px", borderRadius:9, fontFamily:UI_FONT, fontSize:11.5, fontWeight:600, letterSpacing:"0.02em",
  cursor:"pointer", lineHeight:1.2,
  border:`1px solid ${on?"#ececec":"#2c2c30"}`,
  background:on?"#ececec":"rgba(255,255,255,.015)",
  color:on?"#0d0d0e":"#a0a0a6",
  boxShadow:on?"0 1px 0 rgba(255,255,255,.35) inset, 0 4px 14px rgba(0,0,0,.35)":"none",
  transition:"background .15s, border-color .15s, color .15s, transform .12s, box-shadow .15s",
  ...extra,
});
const uiLabel = {fontFamily:UI_FONT,fontSize:10,letterSpacing:"0.18em",color:"#7c7c82",textTransform:"uppercase",fontWeight:600};

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let _ctx=null;
const getCtx=()=>{if(!_ctx)try{_ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}return _ctx;};
const MIDI={C:60,"C#":61,"Db":61,D:62,"D#":63,"Eb":63,E:64,F:65,"F#":66,"Gb":66,G:67,"G#":68,"Ab":68,A:69,"A#":70,"Bb":70,B:71};

const playTone=(note,octave=4,dur=0.7)=>{
  try{
    const ctx=getCtx();if(!ctx)return;
    if(ctx.state==="suspended")ctx.resume();
    const midi=(noteIdx(note)>=0?60+noteIdx(note):60)+(octave-4)*12;
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
      const midi=(noteIdx(eng)>=0?60+noteIdx(eng):60)+(octave-4)*12;
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
  "maj": {intervals:[0,4,7], degs:[0,2,4],          label:"Mayor",      symbol:"△"   },
  "min": {intervals:[0,3,7], degs:[0,2,4],          label:"Menor",      symbol:"m"   },
  "7":   {intervals:[0,4,7,10], degs:[0,2,4,6],       label:"Dom. 7ª",    symbol:"7"   },
  "maj7":{intervals:[0,4,7,11], degs:[0,2,4,6],       label:"Mayor 7ª",   symbol:"△7"  },
  "min7":{intervals:[0,3,7,10], degs:[0,2,4,6],       label:"Menor 7ª",   symbol:"m7"  },
  "dim": {intervals:[0,3,6], degs:[0,2,4],          label:"Disminuido", symbol:"°"   },
  "dim7":{intervals:[0,3,6,9], degs:[0,2,4,6],        label:"Dim. 7ª",    symbol:"°7"  },
  "m7b5":{intervals:[0,3,6,10], degs:[0,2,4,6],       label:"Semidism.",  symbol:"ø7"  },
  "aug": {intervals:[0,4,8], degs:[0,2,4],          label:"Aumentado",  symbol:"+"   },
  "sus2":{intervals:[0,2,7], degs:[0,1,4],          label:"Sus2",       symbol:"sus2"},
  "sus4":{intervals:[0,5,7], degs:[0,3,4],          label:"Sus4",       symbol:"sus4"},
  "9":   {intervals:[0,4,7,10,2], degs:[0,2,4,6,1],     label:"Dom. 9ª",    symbol:"9"   },
  "maj9":{intervals:[0,4,7,11,2], degs:[0,2,4,6,1],     label:"Mayor 9ª",   symbol:"△9"  },
  "min9":{intervals:[0,3,7,10,2], degs:[0,2,4,6,1],     label:"Menor 9ª",   symbol:"m9"  },
  "13":  {intervals:[0,4,7,10,2,9], degs:[0,2,4,6,1,5],   label:"Dom. 13ª",   symbol:"13"  },
  "7b9": {intervals:[0,4,7,10,1], degs:[0,2,4,6,1],     label:"Dom. b9",    symbol:"7b9" },
  "7#9": {intervals:[0,4,7,10,3], degs:[0,2,4,6,1],     label:"Dom. #9",    symbol:"7#9" },
  "7alt":{intervals:[0,4,7,10,1,3,8], degs:[0,2,4,6,1,1,5], label:"Alt.",       symbol:"7alt"},
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
const T_DEG={"9":1,"b9":1,"#9":1,"11":3,"#11":3,"13":5,"b13":5,"6":5,"b6":5,"b7":6,"7":6};
const tNote=(root,t)=>{const s=T_SEMI[t];return s!==undefined?fromRoot(root,s,T_DEG[t]):null;};

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
  if(!has7&&has(7)) L.push({note:fromRoot(root,7,4),role:"Quinta",oct:2});
  if(has(6))        L.push({note:fromRoot(root,6,4),role:"5ª dim.",oct:2});
  if(has(8))        L.push({note:fromRoot(root,8,4),role:"5ª aum.",oct:2});
  const R=[];
  if(has(3))  R.push({note:fromRoot(root,3,2), role:"3ª menor",oct:4});
  if(has(4))  R.push({note:fromRoot(root,4,2), role:"3ª mayor",oct:4});
  if(has(10)) R.push({note:fromRoot(root,10,6),role:"7ª menor", oct:4});
  if(has(11)) R.push({note:fromRoot(root,11,6),role:"7ª mayor", oct:4});
  if(!has7&&has(7)) R.push({note:fromRoot(root,7,4),role:"Quinta",oct:4});
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
  const notes=buildScale(root,MSI);
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
    const notes=formula.intervals.map((i,k)=>fromRoot(root,i%12,formula.degs?formula.degs[k]:undefined));
    return{root,quality:q,notes,formula,raw:s};
  }catch(e){return null;}
};

const computeProg=(chords)=>{
  const scores={};
  COF.forEach(({note})=>{
    const ri=noteIdx(note);if(ri===-1)return;
    let sc=0;const scalePcs=MSI.map(i=>(ri+i)%12);
    chords.forEach(({root})=>{ if(scalePcs.includes(noteIdx(root))) sc+=4; });
    scores[note]=sc;
  });
  const key=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
  const ki=noteIdx(key);const snPcs=MSI.map(i=>(ki+i)%12);
  return chords.map(({root,quality,raw,notes})=>{
    const ri=snPcs.indexOf(noteIdx(root));
    return{raw,root,quality,notes,degree:ri>=0?DN[ri]:"?",key,fn:getFns(quality)[0]};
  });
};

// ─── BIBLIOTECA DE PROGRESIONES ───────────────────────────────────────────────
const BIBLIOTECA=[
  {genero:"Tango",color:"#e6e6e6",icon:"💃",items:[
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
  {genero:"Jazz",color:"#e6e6e6",icon:"🎷",items:[
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
  {genero:"Choro / MPB",color:"#e6e6e6",icon:"🎸",items:[
    {titulo:"Cadência do choro",                prog:"Am – E7 – Am – Dm – Am – E7 – Am",nota:"Cadência menor clásica do choro brasileiro."},
    {titulo:"ii–V–I brasileiro (Jobim)",        prog:"Dm7 – G7 – Cmaj7 – A7 – Dm7 – G7 – Cmaj7",nota:"El ii-V-I de Jobim tiene un A7 intercalado que da movimiento."},
    {titulo:"Bossa Nova clásica",               prog:"Cmaj7 – Dm7 – G7 – Em7 – A7 – Dm7 – G7",nota:"Movimiento típico de la bossa: tónica → subdominante → dominante."},
    {titulo:"Garota de Ipanema",                prog:"Fmaj7 – G7 – Gm7 – Gb7 – Fmaj7",nota:"El Gb7 es sustituto tritonal del C7. Movimiento cromático descendente."},
    {titulo:"Wave (Tom Jobim)",                 prog:"Dmaj7 – Bm7 – Em7 – A7 – D9 – Db7 – Dmaj7",nota:"Db7 como SubV7 resolviendo a la tónica."},
    {titulo:"Progressão cromática",             prog:"Cmaj7 – B7 – Bbmaj7 – A7 – Abmaj7 – G7 – Cmaj7",nota:"Descenso cromático de dominantes secundarios."},
    {titulo:"IV menor (intercambio modal)",     prog:"Cmaj7 – Fm7 – Bb7 – Cmaj7 – Am7 – D7 – Dm7 – G7",nota:"El Fm7-Bb7 viene del modo paralelo menor. Color oscuro inesperado."},
    {titulo:"Choro moderno",                    prog:"Am – D7 – Gmaj7 – Cmaj7 – Fmaj7 – Bm7b5 – E7 – Am",nota:"Ciclo de quintas descendente con ii-V-i al final."},
  ]},
  {genero:"Latinoamérica",color:"#e6e6e6",icon:"🌎",items:[
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
      : (isBlack?"#1c1c1c":"#f7f5ef");
    const stroke=L?"#e6e6e6":R?tonal:(isBlack?"#444":"#bbb");
    const sw=active?2.5:0.8;
    const dotY=isBlack?h-15:h-25;
    const lblY=isBlack?h-6:h-10;
    return(
      <g key={note+oct} style={{cursor:"pointer"}} onClick={()=>playTone(note,oct,0.7)}>
        <rect x={x+0.5} y={0} width={w-1} height={h} rx={isBlack?2:3}
          fill={fill} stroke={stroke} strokeWidth={sw}/>
        {/* Barra superior: identifica la mano */}
        {L&&<rect x={x+1} y={0} width={w-2} height={4} rx={1} fill="#e6e6e6"/>}
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
          <span className="inline-block w-6 h-2 rounded" style={{background:"#e6e6e6"}}/>
          M.izquierda — tónica (bajo, oct.2)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-2 rounded" style={{background:"linear-gradient(90deg,#6b9c7c,#b5564f,#e6e6e6)"}}/>
          M.derecha — 3ª · 7ª · extensiones (oct.4-5)
        </span>
      </div>
      {/* Detalle de voces */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-lg p-2.5 border" style={{background:"#0a0a0a",borderColor:"#e6e6e6"}}>
          <p className="text-xs font-bold mb-2" style={{color:"#e6e6e6"}}>← Mano izquierda</p>
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
        <div className="rounded-lg p-2.5 border" style={{background:"#0a0a0a",borderColor:"#232323"}}>
          <p className="text-xs font-bold mb-2 text-[#eee6d6]">Mano derecha →</p>
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
    <div className="rounded-xl border overflow-hidden" style={{borderColor:isOpen?"#e6e6e6":"#1a1a1a"}}>
      <button className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
        style={{background:isOpen?"#1a1a1a":"#0a0a0a"}} onClick={onToggle}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
            style={{background:"#1a1a1a",borderColor:"#333333",color:"#e6e6e6"}}>{fn.degree}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#d4d4d4] truncate">{fn.fn}</p>
            <p className="text-xs text-gray-500 italic truncate">{fn.key}</p>
          </div>
        </div>
        <span className="text-gray-600 text-xs flex-shrink-0">{isOpen?"▲":"▼"}</span>
      </button>
      {isOpen&&(
        <div className="px-4 pb-4 pt-3 space-y-3" style={{background:"#0a0a0a"}}>
          {/* Modo + Escala */}
          <div className="rounded-lg p-3 border border-gray-800" style={{background:"#121212"}}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[#a3a3a3] font-semibold">Modo:</span>
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
            <div className="rounded-lg p-2.5 border border-[#333333]" style={{background:"#0a0a0a"}}>
              <span className="text-xs text-[#d4d4d4] font-semibold">➜ </span>
              <span className="text-sm text-[#cfcfcf] font-mono">{fn.resolutions.join(" · ")}</span>
            </div>
          )}
          <div className="rounded-lg p-3 border border-gray-800" style={{background:"#0a0a0a"}}>
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
  <div className="overflow-x-auto rounded-xl border border-gray-800" style={{background:"#121212"}}>
    <table className="w-full text-xs" style={{minWidth:"550px"}}>
      <thead>
        <tr style={{background:"#1a1a1a",borderBottom:"1px solid #333333"}}>
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
            <tr key={i} style={{borderBottom:"1px solid #2a2a2a",background:i%2===0?"transparent":"#1a1a1a"}}>
              <td className="px-3 py-2">
                <span className="font-mono font-bold px-1.5 py-0.5 rounded text-xs"
                  style={{background:"#1a1a1a",color:"#e6e6e6"}}>{f.degree}</span>
              </td>
              <td className="px-3 py-2">
                <p className="font-semibold text-[#d4d4d4]">{f.fn}</p>
                <p className="text-gray-500 italic">{f.key}</p>
              </td>
              <td className="px-3 py-2 text-[#a3a3a3] whitespace-nowrap">{f.mode}</td>
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
            <stop offset="0%" stopColor="#1a1a1a"/>
            <stop offset="100%" stopColor="#0a0a0a"/>
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={175} fill="url(#bgCOF)" stroke="#232323" strokeWidth="1"/>

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
                fill={isSel?color:isHi?color+"cc":"#1a1a1a"}
                stroke={isSel||isHi?color:"#e6e6e6"}
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
                stroke={isHi?color+"88":"#333333"} strokeWidth="1"/>
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
        <circle cx={cx} cy={cy} r={42} fill="#0a0a0a" stroke="#2a2a2a" strokeWidth="1"/>
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
          <div className="rounded-xl p-3 border border-gray-800" style={{background:"#121212"}}>
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
              style={{background:"#1a1a1a",borderColor:"#333333",color:"#e6e6e6"}}>
              ▶ Escuchar escala
            </button>
          </div>

          {/* Tabla completa: grados, modos, tensiones */}
          <div className="rounded-xl border border-gray-800 overflow-hidden" style={{background:"#121212"}}>
            <p className="text-xs text-gray-500 uppercase tracking-widest px-4 py-2 border-b border-gray-800">
              Grados · Modos · Tensiones disponibles
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{minWidth:"480px"}}>
                <thead>
                  <tr style={{background:"#1a1a1a",borderBottom:"1px solid #333333"}}>
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
                      <tr key={i} style={{borderBottom:"1px solid #2a2a2a",background:i%2===0?"transparent":"#1a1a1a"}}>
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
                        <td className="px-3 py-2 text-[#a3a3a3] whitespace-nowrap">{sd.mode.name}</td>
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
          <div className="rounded-xl p-3 border border-gray-800" style={{background:"#121212"}}>
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
          <div className="rounded-xl p-3 border border-gray-800" style={{background:"#121212"}}>
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
      style={{background:"linear-gradient(145deg,#1d1d1d,#101010)",border:"2px solid #3a3a3a",boxShadow:"0 8px 24px rgba(0,0,0,0.7)"}}>
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
// Octavas según el CSV de referencia (2026-10-06). Notación científica: Do4 = Do central.
const FALLBACK_OCT_R_OPEN = {
  "R01":5,
  "R02":5,
  "R03":5,
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
  "R16":2,
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
  "R27":3,
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
  "R01":5,
  "R02":5,
  "R03":5,
  "R04":5,
  "R05":5,
  "R06":5,
  "R07":5,
  "R08":3,
  "R09":5,
  "R10":3,
  "R11":3,
  "R12":3,
  "R13":3,
  "R14":3,
  "R15":5,
  "R16":2,
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
const FALLBACK_OCT_L_OPEN = {
  "L01":1,
  "L02":1,
  "L03":1,
  "L04":2,
  "L05":3,
  "L06":1,
  "L07":1,
  "L08":2,
  "L09":2,
  "L10":3,
  "L11":2,
  "L12":1,
  "L13":2,
  "L14":2,
  "L15":3,
  "L16":3,
  "L17":2,
  "L18":1,
  "L19":2,
  "L20":2,
  "L21":2,
  "L22":3,
  "L23":3,
  "L24":3,
  "L25":1,
  "L26":1,
  "L27":1,
  "L28":3,
  "L29":3,
  "L30":3,
  "L31":2,
  "L32":1,
  "L33":1
};
const FALLBACK_OCT_L_CLOSE = {
  "L01":1,
  "L02":1,
  "L03":2,
  "L04":3,
  "L05":3,
  "L06":1,
  "L07":2,
  "L08":2,
  "L09":3,
  "L10":2,
  "L11":2,
  "L12":1,
  "L13":1,
  "L14":2,
  "L15":2,
  "L16":3,
  "L17":3,
  "L18":2,
  "L19":1,
  "L20":2,
  "L21":2,
  "L22":3,
  "L23":3,
  "L24":2,
  "L25":1,
  "L26":1,
  "L27":2,
  "L28":3,
  "L29":3,
  "L30":3,
  "L31":2,
  "L32":1,
  "L33":1
};


// ─── STORAGE DE CONFIGURACIÓN ────────────────────────────────────────────────
const STORAGE_KEY_L = "bandoneon_left_v1";
const STORAGE_KEY_R = "bandoneon_right_v1";

const DEFS_L = [
  { id:"L01", row:0, x:208, y: 46, abre:"SOL#", cierra:"SOL#", color_abre:"#ff6a00", color_cierra:"#ff6a00", oct_abre:1, oct_cierra:1 },
  { id:"L02", row:0, x:308, y: 40, abre:"LA#", cierra:"LA#", color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:1, oct_cierra:1 },
  { id:"L03", row:0, x:416, y: 42, abre:"DO#", cierra:"RE#", color_abre:"#01c7fc", color_cierra:"#84cc16", oct_abre:1, oct_cierra:2 },
  { id:"L04", row:0, x:526, y: 58, abre:"FA", cierra:"RE#", color_abre:"#d38301", color_cierra:"#84cc16", oct_abre:2, oct_cierra:3 },
  { id:"L05", row:0, x:640, y: 78, abre:"SOL#", cierra:"SOL", color_abre:"#ff6a00", color_cierra:"#fefb41", oct_abre:3, oct_cierra:3 },
  { id:"L06", row:1, x: 64, y:126, abre:"MI", cierra:"RE", color_abre:"#583300", color_cierra:"#587934", oct_abre:1, oct_cierra:1 },
  { id:"L07", row:1, x:162, y:106, abre:"LA", cierra:"RE", color_abre:"#a62c17", color_cierra:"#587934", oct_abre:1, oct_cierra:2 },
  { id:"L08", row:1, x:258, y: 96, abre:"SOL", cierra:"LA#", color_abre:"#faf600", color_cierra:"#e63b7a", oct_abre:2, oct_cierra:2 },
  { id:"L09", row:1, x:358, y: 98, abre:"RE#", cierra:"DO", color_abre:"#84cc16", color_cierra:"#285ff4", oct_abre:2, oct_cierra:3 },
  { id:"L10", row:1, x:472, y:108, abre:"FA", cierra:"DO#", color_abre:"#d38301", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:2 },
  { id:"L11", row:1, x:576, y:108, abre:"LA#", cierra:"DO", color_abre:"#e63b7a", color_cierra:"#285ff4", oct_abre:2, oct_cierra:2 },
  { id:"L12", row:1, x:680, y:142, abre:"FA", cierra:"FA#", color_abre:"#d38301", color_cierra:"#feb43f", oct_abre:1, oct_cierra:1 },
  { id:"L13", row:2, x:110, y:172, abre:"RE", cierra:"SOL", color_abre:"#587934", color_cierra:"#fefb41", oct_abre:2, oct_cierra:1 },
  { id:"L14", row:2, x:210, y:156, abre:"LA", cierra:"SOL", color_abre:"#a62c17", color_cierra:"#fefb41", oct_abre:2, oct_cierra:2 },
  { id:"L15", row:2, x:302, y:154, abre:"DO", cierra:"SI", color_abre:"#285ff4", color_cierra:"#5e30eb", oct_abre:3, oct_cierra:2 },
  { id:"L16", row:2, x:410, y:162, abre:"MI", cierra:"RE", color_abre:"#583300", color_cierra:"#587934", oct_abre:3, oct_cierra:3 },
  { id:"L17", row:2, x:528, y:164, abre:"DO", cierra:"FA", color_abre:"#285ff4", color_cierra:"#d38301", oct_abre:2, oct_cierra:3 },
  { id:"L18", row:2, x:618, y:170, abre:"SOL", cierra:"FA#", color_abre:"#fffb00", color_cierra:"#feb43f", oct_abre:1, oct_cierra:2 },
  { id:"L19", row:3, x: 66, y:252, abre:"MI", cierra:"LA", color_abre:"#583300", color_cierra:"#a62c17", oct_abre:2, oct_cierra:1 },
  { id:"L20", row:3, x:158, y:230, abre:"SOL#", cierra:"MI", color_abre:"#ff6a00", color_cierra:"#583300", oct_abre:2, oct_cierra:2 },
  { id:"L21", row:3, x:254, y:222, abre:"SI", cierra:"LA", color_abre:"#5e30eb", color_cierra:"#a62c17", oct_abre:2, oct_cierra:2 },
  { id:"L22", row:3, x:354, y:218, abre:"RE", cierra:"DO#", color_abre:"#587934", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:3 },
  { id:"L23", row:3, x:458, y:224, abre:"FA#", cierra:"MI", color_abre:"#feb43f", color_cierra:"#583300", oct_abre:3, oct_cierra:3 },
  { id:"L24", row:3, x:560, y:234, abre:"DO#", cierra:"SOL#", color_abre:"#00a1d8", color_cierra:"#ff6a00", oct_abre:3, oct_cierra:2 },
  { id:"L25", row:3, x:646, y:246, abre:"FA#", cierra:"SI", color_abre:"#feb43f", color_cierra:"#5e30eb", oct_abre:1, oct_cierra:1 },
  { id:"L26", row:4, x: 26, y:328, abre:"RE", cierra:"MI", color_abre:"#587934", color_cierra:"#754400", oct_abre:1, oct_cierra:1 },
  { id:"L27", row:4, x:110, y:308, abre:"SI", cierra:"MI", color_abre:"#5e30eb", color_cierra:"#583300", oct_abre:1, oct_cierra:2 },
  { id:"L28", row:4, x:204, y:294, abre:"SOL", cierra:"FA#", color_abre:"#faf200", color_cierra:"#ecac22", oct_abre:3, oct_cierra:3 },
  { id:"L29", row:4, x:298, y:288, abre:"LA", cierra:"LA", color_abre:"#a62c17", color_cierra:"#a62c17", oct_abre:3, oct_cierra:3 },
  { id:"L30", row:4, x:390, y:286, abre:"RE#", cierra:"SI", color_abre:"#84cc16", color_cierra:"#5e30eb", oct_abre:3, oct_cierra:3 },
  { id:"L31", row:4, x:496, y:296, abre:"FA#", cierra:"FA", color_abre:"#fda821", color_cierra:"#d38301", oct_abre:2, oct_cierra:2 },
  { id:"L32", row:4, x:590, y:306, abre:"RE#", cierra:"DO#", color_abre:"#84cc16", color_cierra:"#01c7fc", oct_abre:1, oct_cierra:1 },
  { id:"L33", row:4, x:670, y:320, abre:"DO", cierra:"FA", color_abre:"#285ff4", color_cierra:"#d38301", oct_abre:1, oct_cierra:1 },
];

const DEFS_R = [
  { id:"R01", row:0, x:174, y:  0, abre:"SI", cierra:"SI", color_abre:"#5e30eb", color_cierra:"#5e30eb", oct_abre:5, oct_cierra:5 },
  { id:"R02", row:0, x:274, y:  0, abre:"SOL#", cierra:"SOL#", color_abre:"#ff6a00", color_cierra:"#ff6a00", oct_abre:5, oct_cierra:5 },
  { id:"R03", row:0, x:376, y:  0, abre:"SOL", cierra:"FA#", color_abre:"#fefb41", color_cierra:"#ffc777", oct_abre:5, oct_cierra:5 },
  { id:"R04", row:0, x:484, y:  0, abre:"FA", cierra:"FA", color_abre:"#a96800", color_cierra:"#a96800", oct_abre:5, oct_cierra:5 },
  { id:"R05", row:0, x:220, y: 38, abre:"LA", cierra:"SOL", color_abre:"#a62c17", color_cierra:"#fefb41", oct_abre:5, oct_cierra:5 },
  { id:"R06", row:0, x:326, y: 38, abre:"FA#", cierra:"LA#", color_abre:"#ffc777", color_cierra:"#e63b7a", oct_abre:5, oct_cierra:5 },
  { id:"R07", row:0, x:432, y: 40, abre:"MI", cierra:"DO", color_abre:"#583300", color_cierra:"#285ff4", oct_abre:5, oct_cierra:5 },
  { id:"R08", row:1, x:128, y: 46, abre:"DO#", cierra:"DO", color_abre:"#01c7fc", color_cierra:"#285ff4", oct_abre:3, oct_cierra:3 },
  { id:"R09", row:1, x:528, y: 50, abre:"RE#", cierra:"RE#", color_abre:"#84cc16", color_cierra:"#84cc16", oct_abre:5, oct_cierra:5 },
  { id:"R10", row:1, x: 88, y:104, abre:"DO", cierra:"RE", color_abre:"#285ff4", color_cierra:"#587934", oct_abre:3, oct_cierra:3 },
  { id:"R11", row:1, x:178, y: 98, abre:"RE", cierra:"DO#", color_abre:"#587934", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:3 },
  { id:"R12", row:1, x:280, y: 86, abre:"SOL", cierra:"SOL#", color_abre:"#fefb41", color_cierra:"#ff6a00", oct_abre:3, oct_cierra:3 },
  { id:"R13", row:1, x:388, y: 86, abre:"LA#", cierra:"LA#", color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:4, oct_cierra:3 },
  { id:"R14", row:1, x:484, y: 94, abre:"DO", cierra:"DO", color_abre:"#285ff4", color_cierra:"#285ff4", oct_abre:5, oct_cierra:3 },
  { id:"R15", row:1, x:572, y:114, abre:"RE", cierra:"RE", color_abre:"#587934", color_cierra:"#587934", oct_abre:5, oct_cierra:5 },
  { id:"R16", row:2, x: 42, y:188, abre:"SI", cierra:"SI", color_abre:"#5e30eb", color_cierra:"#6230eb", oct_abre:2, oct_cierra:2 },
  { id:"R17", row:2, x:136, y:168, abre:"MI", cierra:"FA#", color_abre:"#583300", color_cierra:"#ffc777", oct_abre:3, oct_cierra:3 },
  { id:"R18", row:2, x:236, y:156, abre:"DO#", cierra:"FA#", color_abre:"#01c7fc", color_cierra:"#ffc777", oct_abre:4, oct_cierra:4 },
  { id:"R19", row:2, x:342, y:148, abre:"FA#", cierra:"SOL", color_abre:"#ffc777", color_cierra:"#fefb41", oct_abre:3, oct_cierra:3 },
  { id:"R20", row:2, x:436, y:156, abre:"LA", cierra:"SI", color_abre:"#a62c17", color_cierra:"#5e30eb", oct_abre:3, oct_cierra:3 },
  { id:"R21", row:2, x:530, y:164, abre:"DO", cierra:"RE", color_abre:"#285ff4", color_cierra:"#587934", oct_abre:4, oct_cierra:4 },
  { id:"R22", row:2, x:612, y:184, abre:"MI", cierra:"SOL", color_abre:"#583300", color_cierra:"#fefb41", oct_abre:4, oct_cierra:4 },
  { id:"R23", row:2, x:  0, y:262, abre:"LA", cierra:"LA", color_abre:"#b51717", color_cierra:"#b51717", oct_abre:2, oct_cierra:2 },
  { id:"R24", row:2, x: 94, y:246, abre:"FA", cierra:"FA", color_abre:"#a96800", color_cierra:"#a96800", oct_abre:3, oct_cierra:3 },
  { id:"R25", row:3, x:188, y:232, abre:"LA#", cierra:"MI", color_abre:"#e63b7a", color_cierra:"#583300", oct_abre:3, oct_cierra:3 },
  { id:"R26", row:3, x:284, y:224, abre:"SOL#", cierra:"LA", color_abre:"#ff6a00", color_cierra:"#a62c17", oct_abre:3, oct_cierra:3 },
  { id:"R27", row:3, x:386, y:224, abre:"SI", cierra:"DO#", color_abre:"#5e30eb", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:4 },
  { id:"R28", row:3, x:478, y:232, abre:"RE", cierra:"MI", color_abre:"#587934", color_cierra:"#583300", oct_abre:4, oct_cierra:4 },
  { id:"R29", row:3, x:570, y:246, abre:"SOL#", cierra:"LA", color_abre:"#ff6a00", color_cierra:"#a62c17", oct_abre:4, oct_cierra:4 },
  { id:"R30", row:3, x:654, y:266, abre:"SI", cierra:"DO#", color_abre:"#5e30eb", color_cierra:"#01c7fc", oct_abre:4, oct_cierra:4 },
  { id:"R31", row:3, x: 26, y:328, abre:"LA#", cierra:"LA#", color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:2, oct_cierra:2 },
  { id:"R32", row:3, x:122, y:312, abre:"RE#", cierra:"RE#", color_abre:"#84cc16", color_cierra:"#84cc16", oct_abre:3, oct_cierra:3 },
  { id:"R33", row:4, x:220, y:298, abre:"FA", cierra:"FA", color_abre:"#a96800", color_cierra:"#a96800", oct_abre:4, oct_cierra:4 },
  { id:"R34", row:4, x:316, y:296, abre:"RE#", cierra:"MI", color_abre:"#84cc16", color_cierra:"#583300", oct_abre:4, oct_cierra:4 },
  { id:"R35", row:4, x:412, y:300, abre:"FA#", cierra:"SOL#", color_abre:"#ffc777", color_cierra:"#ff6a00", oct_abre:4, oct_cierra:4 },
  { id:"R36", row:4, x:500, y:308, abre:"LA", cierra:"SI", color_abre:"#a62c17", color_cierra:"#5e30eb", oct_abre:4, oct_cierra:4 },
  { id:"R37", row:4, x:594, y:322, abre:"DO#", cierra:"MI", color_abre:"#01c7fc", color_cierra:"#583300", oct_abre:5, oct_cierra:5 },
  { id:"R38", row:4, x:680, y:346, abre:"SOL", cierra:"RE#", color_abre:"#fefb41", color_cierra:"#84cc16", oct_abre:4, oct_cierra:4 },
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
// ═══════════════════════════════════════════════════════════════════════════
// ─── ARMADOR DE ACORDES (compartido por Bandoneón y Entrenador) ──────────────
// Se construye por capas: fundamental → tipo → séptima → novena/oncena/trecena.
// Devuelve las alturas (sin octava) y la etiqueta de intervalo de cada una.
// ═══════════════════════════════════════════════════════════════════════════
const ACORDE_BASES = [
  {id:"M",   label:"Mayor",      ivs:[0,4,7], lab:["R","3","5"]},
  {id:"m",   label:"menor",      ivs:[0,3,7], lab:["R","b3","5"]},
  {id:"dim", label:"Disminuido", ivs:[0,3,6], lab:["R","b3","b5"]},
  {id:"aug", label:"Aumentado",  ivs:[0,4,8], lab:["R","3","#5"]},
  {id:"sus2",label:"sus2",       ivs:[0,2,7], lab:["R","2","5"]},
  {id:"sus4",label:"sus4",       ivs:[0,5,7], lab:["R","4","5"]},
];
const ACORDE_SEPT = [{id:"none",label:"Sin 7ª"},{id:"b7",label:"7ª menor",iv:10,lab:"b7"},{id:"M7",label:"7ª mayor",iv:11,lab:"7"},{id:"bb7",label:"7ª disminuida",iv:9,lab:"bb7"}];
const ACORDE_NOV  = [{id:"none",label:"—"},{id:"b9",label:"b9",iv:1,lab:"b9"},{id:"9",label:"9",iv:2,lab:"9"},{id:"#9",label:"#9",iv:3,lab:"#9"}];
const ACORDE_UND  = [{id:"none",label:"—"},{id:"11",label:"11",iv:5,lab:"11"},{id:"#11",label:"#11",iv:6,lab:"#11"}];
const ACORDE_TRE  = [{id:"none",label:"—"},{id:"b13",label:"b13",iv:8,lab:"b13"},{id:"13",label:"13",iv:9,lab:"13"}];
const ACORDE_INI  = {root:"C",base:"M",sept:"none",nov:"none",und:"none",tre:"none",seis:false,sin5:false};
const ACORDE_RAICES = ["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"];
const GRADO_LAB = {"R":0,"2":1,"3":2,"b3":2,"4":3,"5":4,"b5":4,"#5":4,"6":5,"b7":6,"7":6,"bb7":6,"b9":1,"9":1,"#9":1,"11":3,"#11":3,"b13":5,"13":5};

const ROM_N=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII"];
// "R","3","b7","9","#11","13","8" → I, III, ♭VII, IX, ♯XI, XIII, VIII
const aRomano = (lab)=>{
  if(lab==="R") return "I";
  const m=/^(bb|b|#)?(\d+)$/.exec(String(lab));
  if(!m) return lab;
  const acc=m[1]==="bb"?"♭♭":m[1]==="b"?"♭":m[1]==="#"?"♯":"";
  return acc+(ROM_N[+m[2]-1]||m[2]);
};
function useRomanos(){
  const [r,setR]=useState(()=>{ try{ const v=localStorage.getItem("harmonia_romanos"); return v===null?true:v==="1"; }catch(e){ return true; } });
  const set=(v)=>{ setR(v); try{ localStorage.setItem("harmonia_romanos",v?"1":"0"); }catch(e){} };
  return [r,set];
}
function calcAcorde(ac,romano){
    const r = noteIdx(ac.root);
    const base = ACORDE_BASES.find(b=>b.id===ac.base);
    let items = base.ivs.map((iv,i)=>({iv,lab:base.lab[i],up:false}));
    if(ac.sin5) items = items.filter((_,i)=>i!==2);
    const add=(list,id,up)=>{ const o=list.find(x=>x.id===id); if(o&&o.iv!==undefined) items.push({iv:o.iv,lab:o.lab,up}); };
    if(ac.seis) items.push({iv:9,lab:"6",up:false});
    add(ACORDE_SEPT,ac.sept,false); add(ACORDE_NOV,ac.nov,true); add(ACORDE_UND,ac.und,true); add(ACORDE_TRE,ac.tre,true);
    const seen=new Set(), tones=[];
    items.forEach(it=>{
      const esc = spell(ac.root, it.iv, GRADO_LAB[it.lab]);          // escritura correcta: 3ª = otra letra, etc.
      const pc  = CHROMATIC[noteIdx(esc)];
      if(seen.has(pc)) return; seen.add(pc);
      tones.push({...it,pc,esc,nombre:nombreLat(esc)});
    });
    const tonesF=tones.map(t=>({...t,lab:romano?aRomano(t.lab):t.lab}));
    const labelByPc={}; tonesF.forEach(t=>{labelByPc[t.pc]=t.lab;});
    const partes=[];
    if(ac.seis) partes.push("6");
    if(ac.sept!=="none") partes.push(ACORDE_SEPT.find(x=>x.id===ac.sept).label);
    if(ac.nov!=="none") partes.push(ac.nov);
    if(ac.und!=="none") partes.push(ac.und);
    if(ac.tre!=="none") partes.push(ac.tre);
    const name = `${nombreLat(ac.root)} ${base.label}`+(ac.sin5?" (sin 5ª)":"")+(partes.length?" + "+partes.join(" + "):"");
    return {tones:tonesF,labelByPc,name,rootIdx:r};
  }
function useAcorde(romano=false,setRomano=()=>{}){
  const [ac,setAc]     = useState(ACORDE_INI);
  const [open,setOpen] = useState(false);
  const set   = (k,v)=>setAc(p=>({...p,[k]:v}));
  const reset = ()=>setAc(ACORDE_INI);
  const setAll = (obj)=>setAc({...ACORDE_INI,...obj});
  const calc = useMemo(()=>calcAcorde(ac,romano),[ac,romano]);
  return {ac,set,reset,setAll,open,setOpen,romano,setRomano,...calc,key:JSON.stringify(ac)};
}

const tocarAcordeBand = (A)=>{
  A.tones.forEach((t,i)=>{
    const a = A.rootIdx + t.iv + (t.up?12:0);
    setTimeout(()=>playBand(CHROMATIC[a%12], 3+Math.floor(a/12)), i*35);
  });
};

function ArmadorAcordes({ a, collapsible=true, children }){
  const UI={bg:"#121212",line:"#2a2a2a",text:"#e6e6e6",mute:"#8a8a8a"};
  const pill=(on)=>uiPill(on);
  const Fila=({titulo,list,campo})=>(
    <div className="mb-3">
      <p style={{fontSize:10,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase",marginBottom:6}}>{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map(o=>(<button key={o.id} style={pill(a.ac[campo]===o.id)} onClick={()=>a.set(campo,o.id)}>{o.label}</button>))}
      </div>
    </div>
  );
  const abierto = !collapsible || a.open;
  return(
    <div className="rounded-xl mb-3" style={{background:UI.bg,border:`1px solid ${UI.line}`,padding:"10px 12px"}}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div style={{minWidth:0}}>
          <p style={{fontSize:10,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase"}}>🎼 Armar acorde</p>
          {(abierto||!collapsible) ? null : <p style={{fontSize:12,color:UI.text,marginTop:2}}>{a.name}</p>}
        </div>
        {collapsible && (
          <button onClick={()=>a.setOpen(!a.open)} style={{...pill(a.open),padding:"5px 12px"}}>{a.open?"Ocultar":"Abrir"}</button>
        )}
      </div>

      {abierto && (
        <div className="mt-3">
          <div className="mb-3">
            <p style={{fontSize:10,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase",marginBottom:6}}>1 · Fundamental</p>
            <div className="flex flex-wrap gap-1.5">
              {ACORDE_RAICES.map(x=>(<button key={x} style={pill(a.ac.root===x)} onClick={()=>a.set("root",x)}>{nombreLat(x)}</button>))}
            </div>
          </div>
          <Fila titulo="2 · Tipo de acorde" list={ACORDE_BASES} campo="base"/>
          <Fila titulo="3 · Séptima" list={ACORDE_SEPT} campo="sept"/>
          <div className="grid sm:grid-cols-3 gap-x-4">
            <Fila titulo="4 · Novena" list={ACORDE_NOV} campo="nov"/>
            <Fila titulo="Oncena" list={ACORDE_UND} campo="und"/>
            <Fila titulo="Trecena" list={ACORDE_TRE} campo="tre"/>
          </div>
          <div className="mb-3">
            <p style={{fontSize:10,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase",marginBottom:6}}>Extras</p>
            <div className="flex flex-wrap gap-1.5">
              <button style={pill(a.ac.seis)} onClick={()=>a.set("seis",!a.ac.seis)}>Sexta (6)</button>
              <button style={pill(a.ac.sin5)} onClick={()=>a.set("sin5",!a.ac.sin5)}>Sin quinta</button>
              <button style={{...pill(false),marginLeft:"auto"}} onClick={a.reset}>⟳ Limpiar</button>
            </div>
          </div>

          {/* Resultado */}
          <div style={{borderTop:`1px solid ${UI.line}`,paddingTop:10}}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p style={{fontSize:14,fontFamily:"'Libre Baskerville',serif",fontWeight:700,color:UI.text}}>{a.name}</p>
              <button onClick={()=>tocarAcordeBand(a)} style={{padding:"6px 14px",borderRadius:9,border:`1px solid ${UI.text}`,background:"transparent",color:UI.text,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>▶ Tocar acorde</button>
            </div>
            <div className="flex gap-1.5 mb-2 items-center">
              <span style={{fontSize:10,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase",marginRight:4}}>Función</span>
              <button style={pill(a.romano)} onClick={()=>a.setRomano(true)}>I · III · V</button>
              <button style={pill(!a.romano)} onClick={()=>a.setRomano(false)}>1 · 3 · 5</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {a.tones.map(t=>(
                <div key={t.pc} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:44,height:44,borderRadius:10,background:nc(t.pc),border:"2px solid rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",
                    color:txtSobre(nc(t.pc)),fontFamily:"serif",fontWeight:900,fontSize:13}}>{t.nombre}</div>
                  <span style={{fontSize:10,fontFamily:"monospace",color:UI.mute}}>{t.lab}</span>
                </div>
              ))}
            </div>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

// Cuántos botones de cada mano dan cada nota del acorde (abriendo y cerrando).
function DisponibilidadAcorde({ tones, leftBtns, rightBtns, bellows }){
  const cnt=(btns,fu,pc)=>btns.filter(b=>{ const n=fu==="abre"?b.abre:b.cierra; return (LAT[n]||n)===pc; }).length;
  const cols=[["izq","abre","IZQ ▷",leftBtns],["izq","cierra","IZQ ◁",leftBtns],["der","abre","DER ▷",rightBtns],["der","cierra","DER ◁",rightBtns]];
  return(
    <div className="mt-3 overflow-x-auto" style={{borderTop:"1px solid #2a2a2a",paddingTop:10}}>
      <p style={{fontSize:10,letterSpacing:"0.14em",color:"#8a8a8a",textTransform:"uppercase",marginBottom:6}}>Dónde está cada nota (cantidad de botones)</p>
      <table style={{borderCollapse:"collapse",fontSize:11,fontFamily:"monospace",width:"100%"}}>
        <thead>
          <tr>
            <th style={{textAlign:"left",padding:"3px 6px",color:"#8a8a8a",fontWeight:600}}>Nota</th>
            {cols.map(c=>(<th key={c[2]} style={{padding:"3px 6px",color:c[1]===bellows?"#e6e6e6":"#555",fontWeight:700}}>{c[2]}</th>))}
          </tr>
        </thead>
        <tbody>
          {tones.map(t=>(
            <tr key={t.pc} style={{borderTop:"1px solid #1a1a1a"}}>
              <td style={{padding:"4px 6px"}}>
                <span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:nc(t.pc),marginRight:6,verticalAlign:"middle"}}/>
                <span style={{color:"#e6e6e6"}}>{t.nombre}</span> <span style={{color:"#8a8a8a"}}>{t.lab}</span>
              </td>
              {cols.map(c=>{ const n=cnt(c[3],c[1],t.pc); return(
                <td key={c[2]} style={{textAlign:"center",padding:"4px 6px",color:n?(c[1]===bellows?"#e6e6e6":"#8a8a8a"):"#444"}}>{n||"—"}</td>
              );})}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{fontSize:10,color:"#555",marginTop:6,lineHeight:1.5}}>Columna clara = fuelle actual. Si una nota no aparece en una mano con este fuelle, probá la otra mano o el otro sentido del fuelle.</p>
    </div>
  );
}

// Mide el ancho real de un contenedor aunque aparezca después (p. ej. tras cargar los botones).
function useAnchoMedido(){
  const [w,setW]=useState(0);
  const roRef=useRef(null);
  const ref=useCallback((el)=>{
    if(roRef.current){ roRef.current.disconnect(); roRef.current=null; }
    if(!el) return;
    const upd=()=>setW(Math.floor(el.getBoundingClientRect().width)||el.clientWidth||0);
    upd();
    if(typeof ResizeObserver!=="undefined"){ const ro=new ResizeObserver(upd); ro.observe(el); roRef.current=ro; }
  },[]);
  return [ref,w];
}

// ─── DISPOSICIÓN DE LOS TECLADOS: lado a lado (izquierda a la izquierda) o apilados ─────────
const anchoMano = (btns)=> btns.length ? Math.max(...btns.map(b=>b.x))+BTN_SIZE+16 : 740;
function useDisposicion(){
  const [lado,setLado]=useState(true);
  const [full,setFull]=useState(false);
  useEffect(()=>{
    const f=()=>setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",f);
    return ()=>document.removeEventListener("fullscreenchange",f);
  },[]);
  const toggleFull=()=>{ try{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }catch(e){} };
  return {lado,setLado,full,toggleFull};
}
// Con ambos teclados y modo "lado a lado", los dos usan la misma escala y llenan todo el ancho.
function calcAnchos(wrapWidth,L,R,ambas,lado,isMobile){
  if(ambas && lado && !isMobile){
    const gap=14, WL=anchoMano(L), WR=anchoMano(R), k=(wrapWidth-gap)/(WL+WR);
    return {fila:true,gap,aL:Math.floor(WL*k),aR:Math.floor(WR*k)};
  }
  return {fila:false,gap:18,aL:wrapWidth,aR:wrapWidth};
}
function ControlesDisposicion({d,isMobile}){
  const on=(v)=>uiPill(v,{padding:"5px 11px"});
  return(
    <div style={{display:"flex",background:"#121212",border:"1.5px solid #333333",borderRadius:10,padding:3,gap:2}}>
      {!isMobile && <button style={on(d.lado)} onClick={()=>d.setLado(true)} title="Izquierda a la izquierda, derecha a la derecha">◫ Lado a lado</button>}
      {!isMobile && <button style={on(!d.lado)} onClick={()=>d.setLado(false)} title="Uno debajo del otro, más grandes">☰ Apilados</button>}
      <button style={on(d.full)} onClick={d.toggleFull} title="Usa toda la pantalla">{d.full?"⛶ Salir":"⛶ Pantalla completa"}</button>
    </div>
  );
}

function BandBtn({ btn, bellows, pressed, isHeard, onDown, onUp, draggable=false, onMove, oct=null, chordActive=false, chordLabel=null }) {
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
        transition:"transform .08s,box-shadow .12s, opacity .2s",
        zIndex: isAct?20:(chordLabel?15:1),
        opacity: chordActive && !chordLabel && !isAct ? 0.25 : 1,
        ...(chordLabel ? {border:"3px solid #ffffff", boxShadow:`0 0 0 3px #ffffff55, 0 0 16px ${color}`} : {}),
      }}
    >
      {chordLabel && (
        <span style={{position:"absolute",top:-6,right:-6,minWidth:17,height:17,padding:"0 3px",borderRadius:9,background:"#fff",color:"#101010",
          fontSize:9,fontWeight:800,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3,boxShadow:"0 1px 4px rgba(0,0,0,.6)"}}>{chordLabel}</span>
      )}
      <div style={{position:"absolute",top:5,left:9,width:11,height:7,borderRadius:"50%",background:"rgba(255,255,255,.22)",filter:"blur(1px)",pointerEvents:"none"}}/>
      {oct !== null ? (
        <span title={`${note} · octava ${oct}`} style={{display:"flex",alignItems:"baseline",gap:1,zIndex:1,lineHeight:1,textShadow:"0 1px 3px rgba(0,0,0,.9)"}}>
          <span style={{fontSize:note.length>2?9:11,fontWeight:800,color:"#fff",fontFamily:"'Courier New',monospace"}}>{note}</span>
          <span style={{fontSize:note.length>2?10:12,fontWeight:900,color:"#fff",fontFamily:"'Courier New',monospace",opacity:.95}}>{oct}</span>
        </span>
      ) : (
        <>
          <span style={{fontSize:note.length>2?7:9,fontWeight:800,color:"#fff",fontFamily:"'Courier New',monospace",lineHeight:1,zIndex:1,textShadow:"0 1px 3px rgba(0,0,0,.9)"}}>{note}</span>
          <span style={{fontSize:6.5,color:"rgba(255,255,255,.9)",fontFamily:"monospace",lineHeight:1,zIndex:1,fontWeight:700}}>
            {draggable ? btn.id.replace(/[LRlr]/,"") : ""}
          </span>
        </>
      )}
    </div>
  );
}

// ─── CANVAS RESPONSIVE ───────────────────────────────────────────────────────
// ─── MAPA DE ALTURAS: todas las teclas de una mano ordenadas de grave a agudo ──
// Sirve para estudiar y para verificar que las octavas sean correlativas.
function MapaAlturas({ btns, bellows, titulo }){
  const PCL={"DO":0,"DO#":1,"RE":2,"RE#":3,"MI":4,"FA":5,"FA#":6,"SOL":7,"SOL#":8,"LA":9,"LA#":10,"SI":11};
  const items = btns.map(b=>{
    const lat = bellows==="abre" ? b.abre : b.cierra;
    const oct = bellows==="abre" ? (b.oct_abre ?? 3) : (b.oct_cierra ?? 3);
    return { id:b.id, lat, oct, midi:12*(oct+1)+PCL[lat] };
  }).sort((x,y)=>x.midi-y.midi || x.id.localeCompare(y.id));
  const cuenta={}; items.forEach(i=>{cuenta[i.midi]=(cuenta[i.midi]||0)+1;});
  const nombre=(lat)=>lat.charAt(0)+lat.slice(1).toLowerCase();
  return(
    <div style={{marginBottom:14}}>
      <p style={{fontFamily:UI_FONT,fontSize:10,letterSpacing:"0.16em",color:"#7c7c82",textTransform:"uppercase",fontWeight:600,marginBottom:8}}>
        {titulo} · {bellows==="abre"?"abriendo":"cerrando"} · de grave a agudo
      </p>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {items.map((it,k)=>{
          const col=nc(LAT[it.lat]||it.lat), dup=cuenta[it.midi]>1;
          return(
            <button key={it.id+k} onClick={()=>playBand(it.lat,it.oct)} title={`Tecla ${it.id}`}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,padding:"5px 7px",minWidth:46,borderRadius:9,cursor:"pointer",
                background:col+"26",border:`1.5px ${dup?"dashed":"solid"} ${dup?"#ffffff":col+"aa"}`,color:"#f2f2f2"}}>
              <span style={{fontFamily:"serif",fontWeight:800,fontSize:13}}>{nombre(it.lat)}<span style={{fontSize:13}}>{it.oct}</span></span>
              <span style={{fontFamily:"monospace",fontSize:8.5,opacity:.65}}>{it.id}{dup?" · repetida":""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BandCanvas({ buttons, bellows, pressed, heardIds=[], onDown, onUp,
  draggable=false, onMove, showGrid=false, onSelect=null, selected=null, octMap=null, maxWidth=null, maxScale=1, chordMap=null }) {

  const W = Math.max(...buttons.map(b=>b.x)) + BTN_SIZE + 16;
  const H = Math.max(...buttons.map(b=>b.y)) + BTN_SIZE + 20;

  // Escalado con transform (estándar, soporta todos los navegadores —
  // a diferencia de la propiedad CSS "zoom", que en algunos Android/Firefox
  // no funciona y hace que el teclado se corte o desaparezca).
  // Si viene maxWidth, escalamos para que el teclado entre exactamente en ese ancho.
  // Sin maxWidth, se muestra a tamaño real (usado por el editor drag&drop,
  // donde la escala 1:1 es necesaria para que el arrastre calcule bien la posición).
  const target = maxWidth || W;
  const scale  = Math.min(maxScale, target / W);
  const scaledW = Math.ceil(W * scale);
  const scaledH = Math.ceil(H * scale);

  const canvas = (
    <div
      onClick={()=>onSelect&&onSelect(null)}
      style={{
        position: "relative",
        width: W, height: H, boxSizing: "border-box",
        flexShrink: 0,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        background: showGrid
          ? `repeating-linear-gradient(0deg,transparent,transparent 9px,rgba(255,255,255,.06) 10px),
             repeating-linear-gradient(90deg,transparent,transparent 9px,rgba(255,255,255,.06) 10px),#0c0c0c`
          : "linear-gradient(145deg,#1d1d1d,#101010)",
        border: `2px solid ${draggable?"#e6e6e655":"#3a3a3a"}`,
        borderRadius: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,.7)",
        touchAction: "none",
      }}
    >
      {buttons.map(btn=>(
        <BandBtn key={btn.id} btn={btn} bellows={bellows}
          pressed={selected?[selected]:pressed}
          isHeard={heardIds.includes(btn.id)}
          onDown={e=>{onSelect&&onSelect(btn.id); onDown&&onDown(btn);}}
          onUp={onUp} draggable={draggable} onMove={onMove}
          oct={octMap ? octMap[btn.id] : null}
          chordActive={!!chordMap}
          chordLabel={chordMap ? (chordMap[(()=>{const n=bellows==="abre"?btn.abre:btn.cierra; return LAT[n]||n;})()] || null) : null}/>
      ))}
    </div>
  );

  // Contenedor con el tamaño YA escalado, para que el layout reserve
  // exactamente ese espacio (el transform no cambia el tamaño en el flujo normal).
  if (maxWidth || scale < 1) {
    return <div style={{width:scaledW, height:scaledH, overflow:"hidden", flexShrink:0}}>{canvas}</div>;
  }
  return <div style={{overflowX:"auto",paddingBottom:4}}>{canvas}</div>;
}

// ─── MODAL GUARDADO ───────────────────────────────────────────────────────────
function SavedModal({ cssText, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#121212",border:"1.5px solid #e6e6e6",borderRadius:16,padding:"24px 24px 20px",maxWidth:440,width:"100%"}}>
        <div style={{fontSize:28,marginBottom:8}}>✅</div>
        <h3 style={{color:"#e6e6e6",fontWeight:700,fontSize:17,marginBottom:8}}>Configuración guardada</h3>
        <p style={{color:"#8a8a8a",fontSize:13,lineHeight:1.6,marginBottom:14}}>
          Tu configuración se guardó en este dispositivo y se cargará automáticamente la próxima vez.
        </p>
        <div style={{background:"#232323",border:"1px solid #e6e6e644",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
          <p style={{color:"#e6e6e6",fontWeight:700,fontSize:12,marginBottom:5}}>📱 ¿Otro dispositivo?</p>
          <p style={{color:"#8a8a8a",fontSize:12,lineHeight:1.6}}>
            Se descargó un <b style={{color:"#e6e6e6"}}>.csv</b> con tu configuración. En el otro dispositivo usá <b style={{color:"#e6e6e6"}}>↑ Importar CSV</b>.
          </p>
        </div>
        <div style={{background:"#121212",border:"1px solid #2a2a2a",borderRadius:10,padding:"8px 14px",marginBottom:16}}>
          <p style={{color:"#8a8a8a",fontSize:11,lineHeight:1.6}}>
            💡 Para que sea permanente en el código, usá <b style={{color:"#e6e6e6"}}>↓ Ver JS</b> en el editor y pegá el resultado en tu <code style={{color:"#e6e6e6"}}>App.jsx</code> reemplazando <code>DEFS_L</code> y <code>DEFS_R</code>.
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>navigator.clipboard.writeText(cssText).then(()=>setCopied(true))} style={{
            flex:1,padding:"7px",borderRadius:9,border:"1px solid #2a2a2a",background:"#121212",
            color:copied?"#e6e6e6":"#e6e6e6",fontFamily:"monospace",fontWeight:700,fontSize:11,cursor:"pointer"
          }}>{copied?"✓ CSS copiado":"{} CSS"}</button>
          <button onClick={onClose} style={{
            flex:2,padding:"7px",borderRadius:9,border:"none",
            background:"#e6e6e6",
            color:"#0a0a0a",fontWeight:700,fontSize:13,cursor:"pointer"
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
      <div style={{background:"#121212",border:"1.5px solid #e6e6e644",borderRadius:16,padding:"22px 22px 18px",maxWidth:400,width:"100%"}}>
        <h3 style={{color:"#e6e6e6",fontWeight:700,fontSize:16,marginBottom:8}}>📂 Importar configuración</h3>
        <p style={{color:"#8a8a8a",fontSize:12,lineHeight:1.6,marginBottom:14}}>
          Seleccioná el <b>.csv</b> descargado en una sesión anterior. Reemplazará la configuración actual.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{display:"none"}}/>
        <button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:9,borderRadius:9,border:"1px solid #e6e6e644",background:"#e6e6e6",color:"#e6e6e6",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:10}}>
          Elegir archivo .csv
        </button>
        {error&&<p style={{color:"#d98f88",fontSize:11,marginBottom:10,background:"#121212",padding:"5px 10px",borderRadius:6}}>⚠ {error}</p>}
        {preview&&(
          <div style={{background:"#0a0a0a",border:"1px solid #e6e6e644",borderRadius:10,padding:"8px 12px",marginBottom:12}}>
            <p style={{color:"#8fc19f",fontWeight:700,fontSize:12,marginBottom:3}}>✓ Archivo válido</p>
            <p style={{color:"#8a8a8a",fontSize:11}}>Izquierda: <b style={{color:"#e6e6e6"}}>{preview.left}</b> · Derecha: <b style={{color:"#e6e6e6"}}>{preview.right}</b></p>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"7px",borderRadius:9,border:"1px solid #2a2a2a",background:"transparent",color:"#8a8a8a",fontSize:12,cursor:"pointer"}}>Cancelar</button>
          {parsed&&<button onClick={()=>onImport(parsed.left,parsed.right)} style={{flex:2,padding:"7px",borderRadius:9,border:"none",background:"#e6e6e6",color:"#121212",fontWeight:700,fontSize:13,cursor:"pointer"}}>Aplicar y guardar</button>}
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

  const pill=(active,v="orange")=>uiPill(active);

  return (
    <div style={{fontFamily:UI_FONT}}>
      {/* Banner */}
      <div style={{marginBottom:12,padding:"8px 14px",background:"#121212",border:"1.5px solid #e6e6e6",borderRadius:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{color:"#e6e6e6",fontWeight:800,fontSize:12}}>✏️ MODO EDICIÓN</span>
        <span style={{color:"#8a8a8a",fontSize:10}}>Arrastrá · Flechas=2px · Shift=10px</span>
        <button onClick={()=>onSave(leftBtns,rightBtns)} style={{padding:"6px 16px",borderRadius:9,border:"none",background:"#e6e6e6",color:"#0a0a0a",fontWeight:800,fontSize:12,cursor:"pointer",marginLeft:"auto"}}>💾 Guardar y salir</button>
        <button onClick={onCancel} style={{padding:"6px 12px",borderRadius:9,border:"1px solid #2a2a2a",background:"transparent",color:"#8a8a8a",fontSize:11,cursor:"pointer"}}>Cancelar</button>
      </div>

      {/* Controles */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
        <div style={{display:"flex",background:"#121212",border:"1.5px solid #2a2a2a",borderRadius:10,padding:3,gap:3}}>
          <button style={pill(mode==="abre")}   onClick={()=>setMode("abre")}>▷ Abre</button>
          <button style={pill(mode==="cierra")} onClick={()=>setMode("cierra")}>◁ Cierra</button>
        </div>
        <div style={{display:"flex",background:"#121212",border:"1.5px solid #333333",borderRadius:10,padding:3,gap:3}}>
          <button style={pill(hand==="left","blue")}  onClick={()=>{setHand("left"); setSelected(null);}}>IZQ {leftBtns.length}</button>
          <button style={pill(hand==="right","blue")} onClick={()=>{setHand("right");setSelected(null);}}>DER {rightBtns.length}</button>
        </div>
        <button onClick={()=>setShowGrid(p=>!p)} style={{padding:"5px 10px",borderRadius:9,border:"1.5px solid #2a2a2a",background:"#121212",color:showGrid?"#e6e6e6":"#8a8a8a",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer"}}>{showGrid?"⊞ Grid ON":"⊞ Grid"}</button>
        <button onClick={()=>setButtons(initials.map(b=>({...b})))} style={{padding:"5px 10px",borderRadius:9,border:"1px solid #2a2a2a",background:"transparent",color:"#8a8a8a",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>⟳ Reset mano</button>
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
            <div style={{marginTop:8,padding:"8px 12px",background:"#121212",border:"1px solid #2a2a2a",borderRadius:10}}>
              {/* Fila superior: ID + posición + nudge */}
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                <span style={{color:"#e6e6e6",fontWeight:800,fontSize:12}}>{selBtn.id}</span>
                <span style={{color:"#8a8a8a",fontSize:10}}>x:{selBtn.x} y:{selBtn.y}</span>
                <div style={{marginLeft:"auto",display:"flex",gap:3}}>
                  {[["←",-SNAP,0],["→",SNAP,0],["↑",0,-SNAP],["↓",0,SNAP]].map(([l,dx,dy])=>(
                    <button key={l} onClick={()=>setButtons(p=>p.map(b=>b.id===selected?{...b,x:Math.max(0,b.x+dx),y:Math.max(0,b.y+dy)}:b))}
                      style={{width:24,height:24,borderRadius:5,border:"1px solid #2a2a2a",background:"#121212",color:"#e6e6e6",fontSize:11,cursor:"pointer",padding:0}}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Fila abriendo: nota + octava + color */}
              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",marginBottom:5,padding:"5px 8px",background:"#0a0a0a",borderRadius:7,border:"1px solid #1a1a1a"}}>
                <span style={{color:"#e6e6e6",fontSize:9,fontWeight:700,width:56}}>▷ ABRIENDO</span>
                <select value={selBtn.abre} onChange={e=>handleEdit(selBtn.id,"abre",e.target.value)}
                  style={{background:"#121212",color:"#e6e6e6",border:"1px solid #e6e6e655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:64}}>
                  {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{color:"#8a8a8a",fontSize:9}}>oct.</span>
                <select value={selBtn.oct_abre??3} onChange={e=>handleEdit(selBtn.id,"oct_abre",parseInt(e.target.value))}
                  style={{background:"#121212",color:"#e6e6e6",border:"1px solid #e6e6e655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:44}}>
                  {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <span style={{color:"#8a8a8a",fontSize:8,marginLeft:4}}>🎨</span>
                <input type="color" value={selBtn.color_abre||"#888"} onChange={e=>handleEdit(selBtn.id,"color_abre",e.target.value)}
                  style={{width:22,height:20,padding:1,borderRadius:4,border:"none",cursor:"pointer"}}/>
                <span style={{color:"#8a8a8a",fontSize:8,marginLeft:2,opacity:.7}}>
                  {selBtn.abre}{selBtn.oct_abre??3} = {(440*Math.pow(2,([0,2,4,5,7,9,11,0].indexOf(["DO","RE","MI","FA","SOL","LA","SI"].indexOf(selBtn.abre))||0)/12)).toFixed(0)}Hz
                </span>
              </div>
              {/* Fila cerrando: nota + octava + color */}
              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",padding:"5px 8px",background:"#0a0a0a",borderRadius:7,border:"1px solid #1a1a1a"}}>
                <span style={{color:"#e6e6e6",fontSize:9,fontWeight:700,width:56}}>◁ CERRANDO</span>
                <select value={selBtn.cierra} onChange={e=>handleEdit(selBtn.id,"cierra",e.target.value)}
                  style={{background:"#121212",color:"#e6e6e6",border:"1px solid #e6e6e655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:64}}>
                  {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{color:"#8a8a8a",fontSize:9}}>oct.</span>
                <select value={selBtn.oct_cierra??3} onChange={e=>handleEdit(selBtn.id,"oct_cierra",parseInt(e.target.value))}
                  style={{background:"#121212",color:"#e6e6e6",border:"1px solid #e6e6e655",borderRadius:5,padding:"2px 4px",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer",width:44}}>
                  {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                <span style={{color:"#8a8a8a",fontSize:8,marginLeft:4}}>🎨</span>
                <input type="color" value={selBtn.color_cierra||"#888"} onChange={e=>handleEdit(selBtn.id,"color_cierra",e.target.value)}
                  style={{width:22,height:20,padding:1,borderRadius:4,border:"none",cursor:"pointer"}}/>
              </div>
            </div>
          )}

          {/* Exportar JS */}
          <div style={{marginTop:10,display:"flex",gap:6}}>
            <button onClick={()=>setShowJS(p=>!p)} style={{padding:"4px 12px",borderRadius:7,border:"1px solid #2a2a2a",background:"#121212",color:"#e6e6e6",fontFamily:"monospace",fontWeight:700,fontSize:10,cursor:"pointer"}}>
              {showJS?"Ocultar":"↓ Ver JS para el repo"}
            </button>
          </div>
          {showJS&&(
            <div style={{position:"relative",marginTop:8}}>
              <textarea readOnly value={jsText()} style={{width:"100%",height:140,background:"#0a0a0a",color:"#e6e6e6",border:"1px solid #2a2a2a",borderRadius:8,padding:8,fontSize:8,fontFamily:"'Courier New',monospace",resize:"vertical",boxSizing:"border-box"}}/>
              <button onClick={()=>navigator.clipboard.writeText(jsText()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})}
                style={{position:"absolute",top:6,right:6,padding:"2px 9px",borderRadius:5,border:"1px solid #2a2a2a",background:copied?"#e6e6e6":"#121212",color:copied?"#fff":"#8a8a8a",fontFamily:"monospace",fontSize:9,cursor:"pointer"}}>
                {copied?"✓ Copiado":"Copiar"}
              </button>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div style={{flex:"0 0 300px",minWidth:260}}>
          <div style={{fontSize:10,fontWeight:800,color:"#e6e6e6",marginBottom:6}}>TABLA · {hand==="left"?"IZQUIERDA":"DERECHA"}</div>
          <div style={{overflowY:"auto",maxHeight:460,border:"1px solid #121212",borderRadius:8}}>
            <table style={{borderCollapse:"collapse",fontSize:9,width:"100%",fontFamily:"'Courier New',monospace"}}>
              <thead>
                <tr style={{background:"#121212",position:"sticky",top:0}}>
                  {["ID","X","Y","▷ Nota","oct","◁ Nota","oct","🎨▷","🎨◁"].map(h=>(
                    <th key={h} style={{padding:"5px 4px",textAlign:"left",color:"#8a8a8a",borderBottom:"1px solid #121212",whiteSpace:"nowrap",fontSize:8}}>{h}</th>
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
                      <td style={{padding:"2px 4px",color:"#8a8a8a"}}>{btn.x}</td>
                      <td style={{padding:"2px 4px",color:"#8a8a8a"}}>{btn.y}</td>
                      <td style={{padding:"2px 2px"}}>
                        <select value={btn.abre} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"abre",e.target.value);}} onClick={e=>e.stopPropagation()}
                          style={{background:"#121212",color:"#e6e6e6",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:48}}>
                          {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"2px 2px"}} onClick={e=>e.stopPropagation()}>
                        <select value={btn.oct_abre??3} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"oct_abre",parseInt(e.target.value));}} onClick={e=>e.stopPropagation()}
                          style={{background:"#121212",color:"#e6e6e6",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:30}}>
                          {[0,1,2,3,4,5,6].map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"2px 2px"}}>
                        <select value={btn.cierra} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"cierra",e.target.value);}} onClick={e=>e.stopPropagation()}
                          style={{background:"#121212",color:"#e6e6e6",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:48}}>
                          {ALL_NOTES_LAT.map(n=><option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"2px 2px"}} onClick={e=>e.stopPropagation()}>
                        <select value={btn.oct_cierra??3} onChange={e=>{e.stopPropagation();handleEdit(btn.id,"oct_cierra",parseInt(e.target.value));}} onClick={e=>e.stopPropagation()}
                          style={{background:"#121212",color:"#e6e6e6",border:"none",borderRadius:4,padding:"1px 2px",fontFamily:"monospace",fontSize:8,cursor:"pointer",width:30}}>
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

  // ─── AUDIO SOSTENIDO ────────────────────────────────────────────────────
  // Antes cada nota sonaba con duración fija (1s), como un "pip". Un bandoneón
  // real suena mientras el botón está apretado, y varias notas pueden sonar
  // juntas hasta que se sueltan. Acá guardamos los nodos de audio activos por
  // botón (id) en un ref: se crean al presionar y se apagan (con una rampa
  // corta para evitar clicks) al soltar.
  const activeAudioRef = useRef({}); // { [btnId]: {gainMain, oscs[]} }
  const MIDI_B={C:60,"C#":61,D:62,"D#":63,E:64,F:65,"F#":66,G:67,"G#":68,A:69,"A#":70,B:71};

  const startNote = useCallback((id, eng, oct)=>{
    try{
      const ctx=getCtx();if(!ctx)return;
      if(ctx.state==="suspended")ctx.resume();
      if(activeAudioRef.current[id]) return; // ya está sonando (evita doble-disparo)
      // Altura científica: Do4 = 60 (Do central). midi = 12·(octava+1) + semitono
      const midi=(MIDI_B[eng]??60)+(oct-4)*12;
      const freq=440*Math.pow(2,(midi-69)/12);
      const gainMain=ctx.createGain();
      gainMain.gain.setValueAtTime(0,ctx.currentTime);
      gainMain.gain.linearRampToValueAtTime(1,ctx.currentTime+0.012); // ataque breve, sin click
      gainMain.connect(ctx.destination);
      // En las notas graves se refuerzan los armónicos para que se oigan también en parlantes chicos
      const grave = freq<140;
      const parciales = grave ? [1,2,3,4,5,6] : [1,2,3];
      const ganancias = grave ? [0.20,0.16,0.12,0.09,0.06,0.04] : [0.22,0.10,0.05];
      const oscs=parciales.map((h,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain();
        osc.type="sawtooth";
        osc.frequency.value=freq*h;
        g.gain.value=ganancias[i];
        osc.connect(g);g.connect(gainMain);
        osc.start();
        return osc;
      });
      activeAudioRef.current[id]={gainMain,oscs};
    }catch(e){}
  },[]);

  const stopNote = useCallback((id)=>{
    const n=activeAudioRef.current[id];
    if(!n)return;
    try{
      const ctx=getCtx();if(!ctx)return;
      const t=ctx.currentTime;
      n.gainMain.gain.cancelScheduledValues(t);
      n.gainMain.gain.setValueAtTime(n.gainMain.gain.value,t);
      n.gainMain.gain.linearRampToValueAtTime(0.0001,t+0.09); // release corto, natural
      n.oscs.forEach(o=>o.stop(t+0.11));
    }catch(e){}
    delete activeAudioRef.current[id];
  },[]);

  const stopAllNotes = useCallback(()=>{
    Object.keys(activeAudioRef.current).forEach(stopNote);
  },[stopNote]);

  // Corta todo lo que esté sonando si el componente se desmonta
  useEffect(()=>()=>stopAllNotes(),[stopAllNotes]);

  const downL=useCallback((btn)=>{
    const oct = getOct(btn, bellows);
    const note = bellows==='abre' ? btn.abre : btn.cierra;
    startNote(btn.id, LAT[note]||note, oct);
    setPressedL(p=>[...new Set([...p,btn.id])]);
  },[bellows,getOct,startNote]);
  const upL  =useCallback((id)=>{
    stopNote(id);
    setPressedL(p=>p.filter(x=>x!==id));
  },[stopNote]);
  const downR=useCallback((btn)=>{
    const oct = getOct(btn, bellows);
    const note = bellows==='abre' ? btn.abre : btn.cierra;
    startNote(btn.id, LAT[note]||note, oct);
    setPressedR(p=>[...new Set([...p,btn.id])]);
  },[bellows,getOct,startNote]);
  const upR  =useCallback((id)=>{
    stopNote(id);
    setPressedR(p=>p.filter(x=>x!==id));
  },[stopNote]);

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

  const pill=(active,v="orange")=>uiPill(active);

  // Detectar móvil
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  },[]);

  // Mide el ancho REAL disponible del contenedor (no una suposición fija)
  // y lo reparte entre los teclados visibles, para que los dos entren siempre.
  const [canvasWrapRef, wrapMedido] = useAnchoMedido();
  const wrapWidth = wrapMedido || 900;
  const bothVisible = view==="ambas";
  const [romano,setRomano]=useRomanos();
  const acorde = useAcorde(romano,setRomano);
  const chordMap = acorde.open ? acorde.labelByPc : null;
  const canvasMaxWidth = wrapWidth; // cada teclado usa todo el ancho (apilados) para verse lo más grande posible
  const disp = useDisposicion();
  const an = calcAnchos(wrapWidth,leftBtns,rightBtns,view==="ambas",disp.lado,isMobile);

  if (!leftBtns.length) return <div style={{color:"#555",padding:20,fontSize:13}}>Cargando...</div>;

  if (editMode) return (
    <BandEditor initialLeft={leftBtns} initialRight={rightBtns} onSave={handleSave} onCancel={()=>setEditMode(false)}/>
  );

  return (
    <div style={{fontFamily:UI_FONT}}>

      {/* Barra herramientas */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14,padding:"8px 12px",background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:10}}>
        <div style={{display:"flex",alignItems:"center",gap:5,flex:"1 1 auto"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:fromStorage?"#e6e6e6":"#8a8a8a"}}/>
          <span style={{fontSize:10,color:fromStorage?"#e6e6e6":"#8a8a8a",fontFamily:"monospace"}}>
            {fromStorage?"Config. personalizada":"Config. por defecto"}
          </span>
        </div>
        <button onClick={()=>{stopAllNotes();setIsListening(false);setEditMode(true);}} style={{padding:"5px 13px",borderRadius:9,border:"1px solid #e6e6e6",background:"#1a1a1a",color:"#e6e6e6",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>✏️ Editar teclado</button>
        <button onClick={()=>setShowImport(true)} style={{padding:"5px 13px",borderRadius:9,border:"1px solid #e6e6e644",background:"transparent",color:"#e6e6e6",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"monospace"}}>↑ Importar CSV</button>
        {fromStorage&&(
          <button
            onClick={()=>{clearBtns();const{left,right}=loadBtns();setLeftBtns(left);setRightBtns(right);setFromStorage(false);}}
            style={{padding:"5px 10px",borderRadius:9,border:"1px solid #2a2a2a",
              background:"transparent",color:"#8a8a8a",fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>
            ⟳ Defaults
          </button>
        )}
      </div>

      {/* Panel mic */}
      <div style={{marginBottom:10,padding:"8px 12px",background:"#121212",border:"1.5px dashed #e6e6e6",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6,minHeight:56}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:"1 1 auto"}}>
          <div style={{width:9,height:9,borderRadius:"50%",background:isListening?"#e6e6e6":"#232323",boxShadow:isListening?"0 0 8px #e6e6e6":"none",flexShrink:0}}/>
          <div>
            <div style={{fontSize:10,fontWeight:800,color:"#e6e6e6"}}>MODO ESCUCHA FÍSICA</div>
            <div style={{fontSize:8,color:"#8a8a8a"}}>Tocá tu instrumento. Los botones con esa nota brillan en blanco.</div>
          </div>
        </div>
        {isListening&&(
          <div style={{background:"#121212",border:"1px solid #e6e6e644",padding:"3px 10px",borderRadius:8,minWidth:55,textAlign:"center"}}>
            <span style={{fontSize:8,color:"#8a8a8a",display:"block"}}>NOTA MIC</span>
            <span style={{fontSize:13,fontWeight:900,color:heardNote?"#e6e6e6":"#232323"}}>
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
            background:isListening?"linear-gradient(135deg,#b5564f,#b5564f)":"#e6e6e6",
            color:isListening?"#fff":"#121212",
          }}>
          {isListening?"✕ Apagar Mic":"🎙️ Escuchar"}
        </button>
      </div>
      {errorAudio&&<div style={{marginBottom:10,padding:"5px 10px",background:"#121212",border:"1px solid #b5564f55",borderRadius:6,fontSize:9,color:"#d98f88"}}>⚠ {errorAudio}</div>}

      {/* Controles fuelle/vista */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
        {/* Fuelle */}
        <div style={{display:"flex",background:"#121212",border:"1.5px solid #2a2a2a",borderRadius:10,padding:3,gap:2}}>
          {[["abre","▷ Abre"],["cierra","◁ Cierra"]].map(([b,l])=>(
            <button key={b} style={{...pill(bellows===b),padding:isMobile?"5px 10px":"5px 12px"}}
              onClick={()=>{stopAllNotes();setBellows(b);setPressedL([]);setPressedR([]);}}>{l}</button>
          ))}
        </div>
        {/* Vista — en móvil solo mostrar si es "ambas" para ahorrar espacio */}
        <div style={{display:"flex",background:"#121212",border:"1.5px solid #333333",borderRadius:10,padding:3,gap:2}}>
          {[["ambas","Ambas"],["izquierda","IZQ"],["derecha","DER"]].map(([v,l])=>(
            <button key={v} style={{...pill(view===v,"blue"),padding:isMobile?"5px 8px":"5px 12px"}}
              onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
        <ControlesDisposicion d={disp} isMobile={isMobile}/>
        <button onClick={()=>{stopAllNotes();setPressedL([]);setPressedR([]);}}
          style={{padding:"5px 9px",borderRadius:9,border:"1px solid #2a2a2a",background:"transparent",color:"#8a8a8a",fontFamily:"monospace",fontSize:10,cursor:"pointer",marginLeft:"auto"}}>
          ✕
        </button>
      </div>

      {/* Notas + acorde — altura fija para no desplazar el canvas */}
      <div style={{minHeight:44,marginBottom:8}}>
      {(activeNotes.length>0||heardNote)&&(
        <div style={{
          marginBottom:10,
          padding:isMobile?"6px 10px":"7px 12px",
          background:"#121212",
          border:"1px solid #333333",
          borderRadius:10,
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          flexWrap:"wrap",
          gap:5,
        }}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:"1 1 auto"}}>
            {heardNote&&(
              <span style={{padding:"2px 8px",borderRadius:20,background:"#e6e6e622",border:"1px solid #e6e6e6",color:"#e6e6e6",fontWeight:700,fontSize:isMobile?10:11}}>
                🎙️ {heardNote}
              </span>
            )}
            {activeNotes.map(n=>{
              const notaPura = n.replace(/\d+$/,"");   // "SOL3"→"SOL"
              const oct      = (n.match(/\d+$/) || [""])[0]; // "SOL3"→"3"
              const engKey   = LAT[notaPura] || notaPura;
              return (
                <span key={n} style={{padding:"2px 8px",borderRadius:20,background:nc(engKey)+"22",border:`1px solid ${nc(engKey)}`,color:nc(engKey),fontWeight:700,fontSize:isMobile?10:11}}>
                  {notaPura}<span style={{fontSize:"0.75em",opacity:.7,marginLeft:1}}>{oct}</span>
                </span>
              );
            })}
          </div>
          {detected&&(
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:8,color:"#555"}}>Acorde</div>
              <div style={{fontSize:isMobile?17:20,fontWeight:900,color:"#e6e6e6",fontFamily:"serif"}}>{detected}</div>
            </div>
          )}
        </div>
      )}
      </div>

      <ArmadorAcordes a={acorde}>
        <DisponibilidadAcorde tones={acorde.tones} leftBtns={leftBtns} rightBtns={rightBtns} bellows={bellows}/>
      </ArmadorAcordes>

      {/* Canvas — se mide el ancho real disponible y se reparte entre los teclados
          que estén visibles, para garantizar que SIEMPRE entren sin recortarse. */}
      <div ref={canvasWrapRef} style={{
        display: "flex",
        flexDirection: an.fila ? "row" : "column",
        gap: an.gap,
        alignItems: an.fila ? "flex-start" : "stretch",
        paddingBottom: 8,
      }}>
        {(view==="ambas"||view==="izquierda")&&(
          <div style={{width: an.fila ? an.aL : "100%", flexShrink:0}}>
            <div style={{fontSize:11,color:"#8a8a8a",marginBottom:5,letterSpacing:"0.12em",
              display:"flex",alignItems:"center",gap:6}}>
              <span>MANO IZQUIERDA · {leftBtns.length} botones</span>
              {isMobile&&<span style={{opacity:.5,fontSize:8}}>↑ abre / cierra ↓</span>}
            </div>
            <BandCanvas buttons={leftBtns} bellows={bellows}
              pressed={pressedL} heardIds={heardIdsL}
              onDown={downL} onUp={upL} mobile={isMobile}
              maxWidth={an.aL} maxScale={3.6} chordMap={chordMap}
              octMap={bellows==="abre" ? OCT_L_OPEN : OCT_L_CLOSE}/>
          </div>
        )}
        {(view==="ambas"||view==="derecha")&&(
          <div style={{width: an.fila ? an.aR : "100%", flexShrink:0}}>
            <div style={{fontSize:11,color:"#8a8a8a",marginBottom:5,letterSpacing:"0.12em"}}>
              MANO DERECHA · {rightBtns.length} botones
            </div>
            <BandCanvas buttons={rightBtns} bellows={bellows}
              pressed={pressedR} heardIds={heardIdsR}
              onDown={downR} onUp={upR} mobile={isMobile}
              maxWidth={an.aR} maxScale={3.6} chordMap={chordMap}
              octMap={bellows==="abre" ? OCT_R_OPEN : OCT_R_CLOSE}/>
          </div>
        )}
      </div>

      <details style={{marginTop:14,background:"#121214",border:"1px solid #26262a",borderRadius:12,padding:"10px 14px"}}>
        <summary style={{cursor:"pointer",fontFamily:UI_FONT,fontSize:12,fontWeight:600,color:"#cfcfd4",letterSpacing:"0.03em"}}>
          Mapa de alturas · octavas de cada tecla
        </summary>
        <div style={{marginTop:12}}>
          <p style={{fontFamily:UI_FONT,fontSize:11,color:"#7c7c82",lineHeight:1.5,marginBottom:12}}>
            Las octavas siguen la numeración científica (Do4 es el Do central). Tocá una nota para oírla. Si una altura aparece repetida en dos teclas se marca con borde punteado.
          </p>
          <MapaAlturas btns={leftBtns}  bellows={bellows} titulo="Mano izquierda"/>
          <MapaAlturas btns={rightBtns} bellows={bellows} titulo="Mano derecha"/>
        </div>
      </details>

      <div style={{marginTop:10,padding:"7px 11px",background:"#121212",border:"1px solid #2a2a2a",borderRadius:8,fontSize:11,color:"#555"}}>
        <b style={{color:"#8a8a8a"}}>Sistema Rheinische</b> · 71 botones · Bisonoro: nota diferente al{" "}
        <span style={{color:"#e6e6e6"}}>abrir</span> y al <span style={{color:"#e6e6e6"}}>cerrar</span> el fuelle.
      </div>

      {showSaved&&<SavedModal cssText={cssText} onClose={()=>setShowSaved(false)}/>}
      {showImport&&<ImportModal onImport={handleImport} onClose={()=>setShowImport(false)}/>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// ─── EL CÓDIGO — Manual de teoría musical a través del color ─────────────────
// Contenido íntegro del manual del sistema de color (Toromboto), organizado
// en capítulos navegables. Es la puerta de entrada a toda la app: todo lo
// demás (piano, acordes, bandoneón, círculo de quintas) usa esta paleta.
// ═══════════════════════════════════════════════════════════════════════════

const CROM_SIMPLE = {C:"Do", "C#":"Do#", D:"Re", "D#":"Re#", E:"Mi", F:"Fa",
  "F#":"Fa#", G:"Sol", "G#":"Sol#", A:"La", "A#":"Sib", B:"Si"};
const CROM_DOBLE = {C:"Do", "C#":"Do#/Reb", D:"Re", "D#":"Re#/Mib", E:"Mi", F:"Fa",
  "F#":"Fa#/Solb", G:"Sol", "G#":"Sol#/Lab", A:"La", "A#":"Sib/La#", B:"Si"};

// ─── paleta "real" (cap. 5bis): interpolación continua de matiz entre las
// tres anclas innegociables — Do (azul), Sol (amarillo), La (rojo) — en sus
// posiciones reales sobre la rueda. Se calcula en vivo, no es una paleta fija.
function hexToHsl(hex){
  let [r,g,b]=hexToRgb(hex).map(v=>v/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}
  else{
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      default: h=(r-g)/d+4;
    }
    h/=6;
  }
  return [h*360,s,l];
}
function hslToHex(h,s,l){
  h=((h%360)+360)%360; h/=360;
  const hue2rgb=(p,q,t)=>{
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  };
  let r,g,b;
  if(s===0){ r=g=b=l; }
  else{
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return rgbToHex(r*255,g*255,b*255);
}
function circularLerpHue(h1,h2,t){
  const diff = ((h2-h1+540)%360)-180;
  return h1 + diff*t;
}
const paletteReal = (()=>{
  const idxDo=0, idxSol=7, idxLa=9;
  const [hDo] = hexToHsl(NC.C);
  const [hSol] = hexToHsl(NC.G);
  const [hLa] = hexToHsl(NC.A);
  const sAvg=0.62, lAvg=0.40;
  const out={};
  CHROMATIC.forEach((n,i)=>{
    let h;
    if(i<=idxSol) h=circularLerpHue(hDo,hSol,(i-idxDo)/(idxSol-idxDo));
    else if(i<=idxLa) h=circularLerpHue(hSol,hLa,(i-idxSol)/(idxLa-idxSol));
    else h=circularLerpHue(hLa,hDo+360,(i-idxLa)/(12-idxLa));
    out[n]=hslToHex(h,sAvg,lAvg);
  });
  return out;
})();

// ─── Tira lineal de los 12 colores ───────────────────────────────────────────
const TiraCromatica=({highlight=[], usePaletteReal=false})=>(
  <div className="flex flex-wrap gap-1.5 justify-center">
    {CHROMATIC.map(n=>{
      const active = highlight.length===0 || highlight.includes(n);
      const color = usePaletteReal ? paletteReal[n] : nc(n);
      return(
        <div key={n} className="flex flex-col items-center" style={{opacity:active?1:0.28}}>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2" style={{background:color,borderColor:color}}
            onClick={()=>playTone(n,4,0.6)}/>
          <span className="text-[10px] text-gray-400 mt-1">{CROM_SIMPLE[n]}</span>
        </div>
      );
    })}
  </div>
);

// ─── Rueda cromática de los 12 colores ───────────────────────────────────────
const RuedaCromatica=({size=270, highlight=[], usePaletteReal=false, showHex=false})=>{
  const cx=size/2, cy=size/2, R=size*0.36;
  return(
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block" style={{maxWidth:size, width:"100%"}}>
      <circle cx={cx} cy={cy} r={R+28} fill="#0a0a0a" stroke="#232323" strokeWidth="1"/>
      {CHROMATIC.map((n,i)=>{
        const angle=(i*30-90)*(Math.PI/180);
        const x=cx+R*Math.cos(angle), y=cy+R*Math.sin(angle);
        const active = highlight.length===0 || highlight.includes(n);
        const color = usePaletteReal ? paletteReal[n] : nc(n);
        return(
          <g key={n} opacity={active?1:0.28} style={{cursor:"pointer"}} onClick={()=>playTone(n,4,0.6)}>
            <circle cx={x} cy={y} r={17} fill={color} stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5"/>
            <text x={x} y={y+30} textAnchor="middle" fontSize="10" fill="#aaa" fontFamily="serif">{CROM_SIMPLE[n]}</text>
            {showHex&&<text x={x} y={y+41} textAnchor="middle" fontSize="6.5" fill="#666" fontFamily="monospace">{color}</text>}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={3} fill="#333"/>
    </svg>
  );
};

// ─── Tarjeta de mezcla (Cap. 6 / 10): notas de entrada → color resultante ────
const MixFigure=({titulo, notes, rootWeight=0.8, nota})=>{
  const mix = mixLuzRaizDominante(notes, rootWeight);
  return(
    <div className="rounded-xl border border-gray-800 p-3" style={{background:"#121212"}}>
      <p className="text-xs text-gray-500 mb-2">{titulo}</p>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {notes.map((n,i)=>(
          <div key={i} className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-md border border-white/10" style={{background:nc(n)}}/>
            <span className="text-[9px] text-gray-500 mt-0.5">{CROM_SIMPLE[n]||n}</span>
          </div>
        ))}
        <span className="text-gray-600 mx-1">↓</span>
        <div className="flex flex-col items-center">
          <div className="w-16 h-9 rounded-md border-2 border-white/25" style={{background:mix}}/>
          <span className="text-[9px] text-gray-400 mt-0.5 font-mono">{mix}</span>
        </div>
      </div>
      {nota&&<p className="text-xs text-gray-500 italic">{nota}</p>}
    </div>
  );
};

// ─── Pequeños helpers de presentación reutilizados en todos los capítulos ────
const CapP=({children})=>(<p className="text-sm text-gray-300 leading-relaxed mb-3">{children}</p>);
const CapH3=({children})=>(<h3 className="text-base font-bold text-[#d4d4d4] mt-5 mb-2" style={{fontFamily:"'Libre Baskerville',serif"}}>{children}</h3>);
const CapNota=({children})=>(
  <div className="rounded-lg p-3 border border-[#333333] my-3" style={{background:"#0a0a0a"}}>
    <p className="text-xs text-[#cfcfcf] leading-relaxed italic">{children}</p>
  </div>
);
const CapFig=({caption, children})=>(
  <div className="rounded-xl p-4 border border-gray-800 my-4" style={{background:"#121212"}}>
    {children}
    {caption&&<p className="text-xs text-gray-500 italic mt-3 text-center">{caption}</p>}
  </div>
);
const CapImgPend=({texto})=>(
  <div className="rounded-lg p-3 border border-dashed border-gray-700 my-3" style={{background:"#121212"}}>
    <p className="text-xs text-gray-500 italic">🖼️ Imagen pendiente en el libro — {texto}</p>
  </div>
);
const ConceptoPar=({a,b,descA,descB})=>(
  <div className="rounded-lg p-3 border border-gray-800" style={{background:"#121212"}}>
    <p className="text-sm font-bold text-[#e6e6e6] italic mb-1">{a} ↔ {b}</p>
    <p className="text-xs text-gray-500 leading-relaxed">{descA}</p>
  </div>
);

// ─── Tabla piedra / energía / chakra (Parte IV) ──────────────────────────────
const PIEDRAS = [
  {n:"C",  piedra:"Zafiro",             energia:"Serenidad mental, alineación de los planos físico, cognitivo y espiritual", chakra:"Garganta (azul)"},
  {n:"C#", piedra:"Aguamarina",         energia:"Calma, fluidez, conexión con la intuición", chakra:"Garganta (azul)"},
  {n:"D",  piedra:"Esmeralda",          energia:"Activación del corazón: compasión, amor, coraje para seguir el propio camino", chakra:"Corazón (verde)"},
  {n:"D#", piedra:"Peridoto",           energia:"Liberación del estrés y los celos, renovación, alegría", chakra:"Corazón (verde)"},
  {n:"E",  piedra:"Cuarzo ahumado",     energia:"Arraigo (grounding), protección, disolución de energías negativas", chakra:"— (tierra)"},
  {n:"F",  piedra:"Cuarzo champán",     energia:"Variante suave de la abundancia del citrino, con matiz más terroso", chakra:"Plexo solar (amarillo)"},
  {n:"F#", piedra:"Citrino pálido",     energia:"Variante suave de la abundancia del citrino, con matiz más terroso", chakra:"Plexo solar (amarillo)"},
  {n:"G",  piedra:"Citrino",            energia:"Abundancia, prosperidad, manifestación de objetivos, confianza", chakra:"Plexo solar (amarillo)"},
  {n:"G#", piedra:"Granate espesartina",energia:"Coraje, vitalidad, pasión creativa", chakra:"Sacro (naranja)"},
  {n:"A",  piedra:"Rubí",               energia:"Pasión, fuerza vital, vitalidad", chakra:"Raíz (rojo)"},
  {n:"A#", piedra:"Morganita",          energia:"Amor incondicional, autocompasión", chakra:"Corazón (rosa)"},
  {n:"B",  piedra:"Amatista",           energia:"Calma profunda, claridad, intuición, protección espiritual", chakra:"Tercer ojo (violeta)"},
];

// ─── PRESENTACIÓN: CRISTALES SONOROS ─────────────────────────────────────────
// Los doce colores como cristales. Tocar uno hace sonar la nota con timbre de
// fuelle (el mismo del bandoneón de la app). Abajo se elige la escala y solo
// sus colores quedan encendidos. Interfaz neutra para que lo único con color
// sean las notas.
const ESCALAS_HERO = [
  {id:"mayor",  corto:"Mayor",       nombre:"mayor",           ivs:[0,2,4,5,7,9,11]},
  {id:"menor",  corto:"Menor",       nombre:"menor natural",   ivs:[0,2,3,5,7,8,10]},
  {id:"menorA", corto:"Menor armónica", nombre:"menor armónica", ivs:[0,2,3,5,7,8,11]},
  {id:"menorM", corto:"Menor melódica", nombre:"menor melódica", ivs:[0,2,3,5,7,9,11]},
  {id:"pentaM", corto:"Pent. mayor", nombre:"pentatónica mayor", ivs:[0,2,4,7,9]},
  {id:"pentam", corto:"Pent. menor", nombre:"pentatónica menor", ivs:[0,3,5,7,10]},
  {id:"blues",  corto:"Blues",       nombre:"blues",           ivs:[0,3,5,6,7,10]},
  {id:"crom",   corto:"Cromática",   nombre:"cromática (los 12 sonidos)", ivs:[0,1,2,3,4,5,6,7,8,9,10,11]},
];
const GRADO_LABEL = {0:"1",1:"b2",2:"2",3:"b3",4:"3",5:"4",6:"b5",7:"5",8:"b6",9:"6",10:"b7",11:"7"};
const txtSobre = hex => { const [r,g,b]=hexToRgb(hex); return (0.299*r+0.587*g+0.114*b)>150 ? "#14110a" : "#ffffff"; };
const pasoLabel = d => d===1?"S":d===2?"T":d===3?"T½":String(d);

function Cristal({color, size=64}){
  return(
    <svg viewBox="0 0 64 76" width="100%" style={{display:"block",maxWidth:size,overflow:"visible"}}>
      <polygon points="14,6 50,6 62,26 32,72 2,26" fill={color}/>
      <polygon points="14,6 50,6 44,26 20,26" fill="#fff" fillOpacity=".30"/>
      <polygon points="14,6 20,26 2,26" fill="#fff" fillOpacity=".12"/>
      <polygon points="50,6 62,26 44,26" fill="#000" fillOpacity=".10"/>
      <polygon points="2,26 20,26 32,72" fill="#000" fillOpacity=".16"/>
      <polygon points="20,26 44,26 32,72" fill="#fff" fillOpacity=".07"/>
      <polygon points="62,26 44,26 32,72" fill="#000" fillOpacity=".32"/>
      <polygon points="18,9 30,9 26,20" fill="#fff" fillOpacity=".45"/>
      <polygon points="14,6 50,6 62,26 32,72 2,26" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function CristalesColor(){
  const [root,setRoot]   = useState("C");
  const [escId,setEscId] = useState("mayor");
  const [playing,setPlaying] = useState(null);   // nota que está sonando (escala)
  const timers = useRef([]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);

  const esc   = ESCALAS_HERO.find(e=>e.id===escId);
  const r     = noteIdx(root);
  const escritas = buildScale(root, esc.ivs);                      // nombres con la enarmonía correcta
  const notes = escritas.map(n=>CHROMATIC[noteIdx(n)]);            // alturas (para los colores)
  const nombreDe = {}; escritas.forEach(n=>{ nombreDe[CHROMATIC[noteIdx(n)]] = nombreLat(n); });
  const gradoDe = {}; esc.ivs.forEach((iv,i)=>{ gradoDe[notes[i]] = GRADO_LABEL[iv]; });
  const pasos = esc.ivs.map((iv,i)=>(i===esc.ivs.length-1?12:esc.ivs[i+1])-iv);

  const stop = ()=>{ timers.current.forEach(clearTimeout); timers.current=[]; setPlaying(null); };
  const tocarNota = (x)=>{ playBand(x,4); };
  const tocarEscala = ()=>{
    stop();
    const seq=[...esc.ivs,12];
    seq.forEach((iv,i)=>{
      timers.current.push(setTimeout(()=>{
        const a=r+iv; const x=CHROMATIC[a%12];
        playBand(x, 4+Math.floor(a/12)); setPlaying(x);
      }, i*480));
    });
    timers.current.push(setTimeout(()=>setPlaying(null), seq.length*480+300));
  };

  const UI = {bg:"#101010", line:"#262626", text:"#e6e6e6", mute:"#8a8a8a", pillOn:"#e6e6e6"};
  const pill=(on)=>uiPill(on);

  return(
    <div className="rounded-2xl mb-5" style={{background:UI.bg,border:`1px solid ${UI.line}`,padding:"16px 14px"}}>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <p style={{fontSize:11,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase"}}>Los doce colores</p>
        <p style={{fontSize:11,color:UI.mute}}>Tocá un cristal para escucharlo</p>
      </div>

      {/* Cristales */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-x-2 gap-y-4 mb-5">
        {CHROMATIC.map(x=>{
          const on = notes.includes(x);
          const sonando = playing===x;
          return(
            <button key={x} onClick={()=>tocarNota(x)}
              style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                opacity:on?1:0.16, filter:on?"none":"saturate(.3)",
                transform: sonando ? "translateY(-8px) scale(1.12)" : on ? "translateY(-3px)" : "none",
                transition:"transform .14s ease, opacity .25s ease, filter .25s ease"}}>
              <div style={{width:"100%",display:"flex",justifyContent:"center",
                filter: sonando ? `drop-shadow(0 6px 14px ${nc(x)}cc)` : on ? `drop-shadow(0 4px 8px ${nc(x)}55)` : "none"}}>
                <Cristal color={nc(x)}/>
              </div>
              <span style={{fontSize:11,fontFamily:"serif",fontWeight:700,color:on?UI.text:UI.mute}}>{on?nombreDe[x]:CROM_SIMPLE[x]}</span>
              <span style={{fontSize:9,fontFamily:"monospace",color:UI.mute,height:11}}>{on?gradoDe[x]:""}</span>
            </button>
          );
        })}
      </div>

      {/* Selector de escala */}
      <div style={{borderTop:`1px solid ${UI.line}`,paddingTop:12}}>
        <p style={{fontSize:10,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase",marginBottom:8}}>Tonalidad</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["C","Db","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(x=>(
            <button key={x} style={pill(x===root)} onClick={()=>{stop();setRoot(x);}}>{nombreLat(x)}</button>
          ))}
        </div>
        <p style={{fontSize:10,letterSpacing:"0.14em",color:UI.mute,textTransform:"uppercase",marginBottom:8}}>Escala</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ESCALAS_HERO.map(e=>(
            <button key={e.id} style={pill(e.id===escId)} onClick={()=>{stop();setEscId(e.id);}}>{e.corto}</button>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p style={{fontSize:15,fontFamily:"'Libre Baskerville',serif",color:UI.text,fontWeight:700}}>
              {nombreLat(root)} {esc.nombre}
            </p>
            <p style={{fontSize:11,fontFamily:"monospace",color:UI.mute,marginTop:3}}>
              {escritas.map(nombreLat).join(" · ")}
            </p>
            <p style={{fontSize:11,fontFamily:"monospace",color:UI.mute,marginTop:2,letterSpacing:"0.12em"}}>
              {pasos.map(pasoLabel).join(" ")} <span style={{opacity:.6,letterSpacing:0}}>(T tono · S semitono)</span>
            </p>
          </div>
          <button onClick={playing?stop:tocarEscala}
            style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${UI.pillOn}`,background:"transparent",color:UI.text,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"monospace"}}>
            {playing?"■ Parar":"▶ Tocar escala"}
          </button>
        </div>
      </div>
    </div>
  );
}

const PasoCard=({n,titulo,children})=>(
  <div className="flex gap-3 rounded-xl border p-3 my-2" style={{background:"#121212",borderColor:"#2a2a2a"}}>
    <div className="flex-shrink-0 flex items-center justify-center rounded-full font-black"
      style={{width:30,height:30,background:"#e6e6e6",color:"#0a0a0a",fontFamily:"serif",fontSize:15}}>{n}</div>
    <div className="min-w-0">
      <p className="text-sm font-bold mb-1" style={{color:"#d4d4d4"}}>{titulo}</p>
      <p className="text-xs text-gray-400 leading-relaxed">{children}</p>
    </div>
  </div>
);

// ─── Estructura del libro: partes y capítulos ────────────────────────────────
const CAPITULOS = [
{ parte:"Parte I — Fundamentos", id:"cap0", titulo:"Cap. 0 — El código de color", body: (
  <>
    <div className="rounded-xl p-4 mb-4 border" style={{background:"#0a0a0a",borderColor:"#333333"}}>
      <p className="text-[10px] uppercase tracking-widest mb-2" style={{color:"#8a8a8a"}}>Antes de empezar</p>
      <p className="text-sm text-gray-300 leading-relaxed">Antes de que este sistema te ahorre un solo segundo de cálculo, te va a pedir algo: que te aprendas doce colores de memoria, con la misma seriedad con la que en algún momento te aprendiste el nombre de las doce notas. Esto no es gratis, y vale la pena decirlo así, sin vueltas, en la primera página: hay una inversión inicial antes de que aparezca la ganancia. Cualquier método serio la tiene —el solfeo, la digitación, las escalas— y este no es la excepción.</p>
    </div>
    <CapP>Lo que sí cambia es qué estás memorizando. No estás memorizando teoría todavía. Estás memorizando una paleta: doce parches de color, cada uno con un nombre de nota al lado. Nada más. La teoría llega después, capítulo a capítulo, apoyada en esa memorización — pero si llegás al capítulo de acordes sin tener el color automatizado, vas a estar leyendo colores en vez de reconociéndolos, y ahí el sistema entero pierde su función.</CapP>

    <CapH3>El orden en que conviene aprenderlo</CapH3>
    <CapP>Este libro presenta la paleta en tres pasos, cada uno con un propósito distinto.</CapP>
    <PasoCard n="1" titulo="Primero, una tira">Las doce notas en fila, igual que las teclas de un piano o de un bandoneón desplegadas en línea recta. Es la forma más directa de un primer contacto — no hay ángulos que leer, no hay geometría que entender todavía. Solo doce colores, uno al lado del otro, cada uno con su nombre.</PasoCard>
    <PasoCard n="2" titulo="Después, la rueda">Las mismas doce notas, ahora en círculo. Acá aparece algo que la tira no podía mostrar: que las notas no son una lista que termina, sino un ciclo que vuelve sobre sí mismo — la relación circular entre semitonos que vas a necesitar más adelante para entender intervalos, el círculo de quintas, y la geometría de los acordes del capítulo 8.</PasoCard>
    <PasoCard n="3" titulo="Por último, tarjetas de estudio">Una nota por vez, con su color y su enarmónico (por ejemplo, Do sostenido y Re bemol comparten color). Este es el paso de memorización activa propiamente dicho: repetición, no explicación. Es donde el código deja de ser información y empieza a ser reflejo. (Podés practicar esto en la pestaña <b>Colores</b> de la app: tocá cada tarjeta para escuchar la nota mientras fijás el color.)</PasoCard>

    <CapH3>Un aviso sobre lo que este código puede generar</CapH3>
    <CapNota>Una vez que la asociación color-nota está bien afianzada, puede pasar algo que vale la pena anticipar: empezar a "ver" notas en colores que no tienen nada que ver con este sistema — una partitura sin colorear, un semáforo, cualquier superficie con estos doce tonos. No es un efecto grave ni motivo de preocupación, pero sí una fricción real que otros métodos de asociación fuerte también generan. Este libro no lo esconde: es el precio de automatizar bien una asociación. Y como con cualquier escalera, el objetivo final es soltarla — llegar a un punto donde el color ya no hace falta, porque la nota se reconoce sola.</CapNota>
  </>
)},
{ parte:"Parte I — Fundamentos", id:"cap1", titulo:"Cap. 1 — Introducción", body: (
  <>
    <CapP>Pensá en un cifrado de jazz cualquiera. Un La13.</CapP>
    <CapP>Para leerlo, no alcanza con saber que es un acorde de La. Hay que reconstruir la escala de La, contar seis grados hacia arriba, recordar que la "trecena" es en realidad la sexta trasladada una octava, y llegar —recién ahí— al Fa sostenido. Todo eso, en el tiempo que dura un compás, muchas veces varios acordes seguidos, en tiempo real, mientras seguís tocando.</CapP>
    <CapP>Ese cálculo mental es exactamente el problema que este libro intenta resolver. No reemplazando la teoría —hace falta saber que el La13 lleva el Fa sostenido, eso no cambia—, sino agregándole una capa de reconocimiento instantáneo por encima del cálculo: si cada una de las doce notas tiene un color fijo y propio, ver el Fa sostenido en una partitura, en un cifrado o en un diagrama de acorde deja de ser una operación aritmética y pasa a ser una percepción directa. Un color no se calcula. Se reconoce.</CapP>
    <CapH3>Para qué sirve esto, en la práctica</CapH3>
    <CapP>Antes de entrar en el sistema, conviene decir con toda claridad qué es este libro y qué no es. No es un tratado de teoría del color con la música como excusa, ni una manera nueva de aprender armonía. Es un manual de estudio, pensado para alguien que va a pasar meses —tal vez un año— practicando un instrumento, y que en ese tiempo se va a topar una y otra vez con cifrados y partituras que hay que leer más rápido de lo que se los puede calcular. El color no cambia qué es un La13. Cambia cuánto tarda el ojo en encontrarlo.</CapP>
    <CapP>Con el tiempo —y esto no hace falta forzarlo, aparece solo con la práctica— el color también empieza a mostrar patrones: por qué ciertos acordes "se sienten" parecidos, por qué una progresión suena como suena. El capítulo 8 lleva esto un paso más allá y muestra que cada tipo de acorde traza una figura geométrica fija sobre la rueda de colores. Para algunos cerebros —los que procesan mejor una forma espacial que una fórmula— eso suma una capa más de reconocimiento. No es necesario para el uso básico del sistema, pero está ahí para quien lo aproveche.</CapP>
    <CapP>Y hay una última capa, todavía más opcional: el capítulo de piedras preciosas y energía (Parte IV) conecta este sistema con la litoterapia y la sanación por sonido. Eso es tradición, no método de estudio —lo va a disfrutar quien ya tenga un interés personal en esos temas, desde la salud o la espiritualidad, y quien no, puede saltearlo sin perderse nada del sistema central.</CapP>
    <CapH3>Qué vas a encontrar en este libro</CapH3>
    <CapP>El corazón del libro es un mapeo completo y sistemático: las doce notas de la escala cromática, cada una con un color propio, consistente, y derivado por una lógica explícita de mezcla —no elegido al azar ni por estética. De ahí en más, el libro recorre cómo ese sistema se comporta con acordes, tonalidades, el círculo de quintas, y termina en aplicaciones prácticas: lectura rápida de partituras, reconocimiento de acordes, y sí — entender de un vistazo qué nota es la trecena de cualquier cifrado que tengas enfrente.</CapP>
    <CapP>Los cinco primeros colores de ese mapeo —los que sostienen la pentatónica original— tienen además una historia de origen, ligada al shakuhachi, la flauta de bambú japonesa. Vale la pena decirlo desde acá: esa historia es un adorno, no el argumento. Ayuda a memorizar los primeros cinco colores con una imagen en vez de una tabla, y tiene su propio encanto —pero el sistema no depende de ella. Si mañana se olvida la leyenda, la rueda de colores y su lógica de mezcla siguen intactas.</CapP>
    <CapH3>A quién está dirigido</CapH3>
    <CapP>A cualquiera que quiera leer música más rápido de lo que puede calcularla. No hace falta formación previa en teoría —el libro construye los conceptos desde la base—, pero va a resultar especialmente útil para quien ya toca y se topa, una y otra vez, con el mismo problema del La13: saber la teoría, y aun así tardar un segundo de más en encontrar la nota.</CapP>
    <CapP>El núcleo teórico-cromático del sistema es universal — vale para cualquier instrumento. Pero la aplicación práctica (cómo se traduce un color en un movimiento de mano) sí depende del instrumento, así que este libro desarrolla en profundidad el bandoneón y el piano — los dos instrumentos donde el autor puede dar ejemplos de primera mano — y deja abierta, como expansión futura, la traducción a otros instrumentos (guitarra, cuerdas, vientos).</CapP>
  </>
)},
{ parte:"Parte I — Fundamentos", id:"cap2", titulo:"Cap. 2 — Música y color, en paralelo", body: (
  <>
    <CapP>Antes de entrar en el sistema propiamente dicho, conviene alinear dos vocabularios: el de la música y el del color. No porque sean el mismo lenguaje —no lo son—, sino porque este libro va a moverse todo el tiempo entre los dos, y ayuda tener claro qué concepto de un lado corresponde, aproximadamente, a qué concepto del otro.</CapP>
    <div className="grid sm:grid-cols-2 gap-3 my-3">
      <ConceptoPar a="Semitono" b="Matiz" descA="El semitono es la unidad mínima de la música occidental temperada: la distancia más pequeña entre dos notas. El matiz (hue) es la unidad mínima de identidad de un color. En este sistema, cada uno de los doce semitonos de la octava recibe un matiz propio y fijo."/>
      <ConceptoPar a="Escala" b="Gama" descA="Una escala es un subconjunto ordenado de notas dentro de la octava. Una gama, en color, es un subconjunto de matices seleccionados de la rueda completa. La pentatónica como los 'cinco colores ancla' es exactamente este paralelo."/>
      <ConceptoPar a="Timbre" b="Saturación y valor" descA="El timbre distingue un La tocado en violín de un La tocado en trompeta, aunque sea la misma nota. La saturación y el valor cumplen un rol parecido en color. Este libro trabaja principalmente con matiz, pero saturación y valor aparecen más adelante al hablar de acordes mayores y menores."/>
      <ConceptoPar a="Octava" b="Vuelta de la rueda" descA="Después de doce semitonos, la música 'vuelve' a la misma nota, una octava más arriba. Después de recorrer los doce matices de la rueda cromática, el color también completa una vuelta — la misma forma para los dos lenguajes."/>
    </div>
    <CapP>Con este vocabulario compartido, ya se puede avanzar al terreno donde otros lo intentaron antes.</CapP>
  </>
)},
{ parte:"Parte I — Fundamentos", id:"cap3", titulo:"Cap. 3 — Antecedentes históricos", body: (
  <>
    <CapP>Cruzar sonido y color no es una idea nueva. Antes de este sistema, hubo al menos cuatro intentos serios —y ninguno se puso de acuerdo con los demás—, lo cual, paradójicamente, es el mejor argumento a favor de construir un sistema propio y explícito en vez de buscar "la" respuesta correcta.</CapP>
    <CapP><b className="text-gray-200">Isaac Newton (1704).</b> En su tratado <i>Opticks</i>, Newton dividió el espectro de luz en siete colores —ni seis ni ocho— porque buscaba una analogía directa con las siete notas de la escala diatónica. Empezó su círculo en Re, en modo dorio, porque es la única escala de teclas blancas simétrica. Fue el primer cruce "científico" entre los dos mundos, aunque hoy se entiende como una analogía forzada entre dos fenómenos físicos sin relación real.</CapP>
    <CapP><b className="text-gray-200">Alexander Scriabin (1910).</b> El compositor ruso construyó, para su obra <i>Prometeo: El poema del fuego</i>, un sistema donde cada tonalidad tenía un color asignado, pensado para proyectarse en un teclado de luces (el <i>clavier à lumières</i>) durante la ejecución. Ordenó las doce tonalidades según el círculo de quintas y les asignó colores siguiendo el orden del espectro visible —lo cual quiere decir que, dibujado en círculo de quintas, su sistema es un arcoíris perfecto, y dibujado en orden cromático, es un desorden completo. Es la elección inversa a la de este libro, que privilegia el orden cromático por sobre el de quintas.</CapP>
    <CapP><b className="text-gray-200">Nikolai Rimsky-Korsakov (siglo XIX).</b> A diferencia de Newton y Scriabin, Rimsky-Korsakov no diseñó un sistema: describía una sinestesia que decía percibir espontáneamente. Por eso sus colores no siguen ninguna lógica geométrica, y por eso chocó públicamente con Scriabin —para uno, Do mayor era blanco; para el otro, rojo—. Ninguno de los dos estaba "equivocado": estaban describiendo experiencias distintas, no midiendo el mismo fenómeno.</CapP>
    <CapP><b className="text-gray-200">Gong-Shang-Jue-Zhi-Yu (China, antigüedad).</b> El precedente más antiguo y, para este libro, el más significativo: un sistema pentatónico —Gong, Shang, Jue, Zhi, Yu, equivalentes a Do-Re-Mi-Sol-La— vinculado desde hace milenios a los cinco elementos (Wu Xing) y sus colores tradicionales: tierra-amarillo, metal-blanco, madera-verde, fuego-rojo, agua-negro/azul. No coincide con los colores de este libro, pero es la prueba de que la idea central —pentatónica más color más naturaleza— tiene una tradición real y antigua, no inventada para la ocasión.</CapP>
    <CapImgPend texto="comparativa de los cuatro sistemas históricos (Newton, Scriabin, Rimsky-Korsakov, Gong-Shang-Jue-Zhi-Yu) uno al lado del otro."/>
    <CapP>Ningún sistema histórico coincide con otro. Eso no es una falla del proyecto: es la evidencia de que este cruce siempre fue, y siempre va a ser, una construcción simbólica —nunca un hecho descubierto. Este libro no pretende ser la excepción. Pretende, en cambio, ser el más explícito y mejor justificado de todos.</CapP>
  </>
)},
{ parte:"Parte I — Fundamentos", id:"cap4", titulo:"Cap. 4 — La historia del shakuhachi", body: (
  <>
    <CapP>Antes de entrar en la historia, una aclaración de peso: lo que sigue es el origen romanceado de los primeros cinco colores, no el argumento que sostiene el sistema. El argumento está en el capítulo 5, donde esos cinco colores se combinan por mezcla y generan matemáticamente el resto de la rueda. Esta historia es, en cambio, la forma más simple de memorizar el punto de partida — una imagen en vez de una tabla — y funciona bien precisamente porque no pretende ser más que eso.</CapP>
    <CapP>Antes de cualquier historia, hay una certeza que no necesita relato para sostenerse: en español, la nota Sol comparte nombre con el astro Sol — y el sol, a simple vista, es amarillo. No hace falta ninguna leyenda para afirmar que Sol es amarillo: es la correspondencia más firme de todo el sistema, la verdad de la que se parte, no una hipótesis más entre varias. Todo lo demás se construye a partir de ahí, y vuelve ahí cada vez que hace falta un punto fijo.</CapP>
    <CapP>Lo que sigue en este capítulo tiene un estatus distinto, y conviene decirlo con esa claridad: es una historia transmitida de viva voz, sin registro documentado, contada por un amigo —luthier e intérprete de shakuhachi, la flauta de bambú japonesa, que construyó instrumentos con cañas traídas de Tailandia—. No es el origen de todo el sistema. Es un relato romántico, probablemente modificado con los años como toda historia oral, que se incluye acá no como fundamento sino como acompañamiento — en gran parte porque tiene una coincidencia genuina que vale la pena señalar: en la propia historia, cuando aparece la nota asociada a la vida, aparece también el rojo — la sangre, el corazón. Esa coincidencia no prueba nada, pero suma, y por eso tiene un lugar en el libro.</CapP>
    <CapImgPend texto="ilustración atmosférica de la leyenda (montaña, sol, cielo, pasto, ganado a la distancia) — a generar en Midjourney."/>
    <CapP>Con esa jerarquía clara —Sol-amarillo como certeza, el resto como historia oral que acompaña—, así es como se cuenta:</CapP>
    <CapP>Antes de que existiera una escala como tal, alguien mira hacia arriba y ve el sol —claro, luminoso—. De ahí nace la primera referencia: Sol es amarillo.</CapP>
    <CapP>Después el cielo: Do es azul. Después lo que crece bajo los pies, el pasto de la montaña: Re es verde. Después la tierra y la piedra de la montaña misma: Mi es marrón. Y por último, lejos, el color de la vida —el ganado, la gente a la distancia—: La es rojo.</CapP>
    <CapFig caption="La pentatónica original: Do, Re, Mi, Sol, La. Azul, verde, marrón, amarillo, rojo.">
      <TiraCromatica highlight={["C","D","E","G","A"]}/>
    </CapFig>
    <CapP>Con el tiempo, cuando la música se volvió más compleja y se agregaron las notas "de en medio" —Fa y Si—, esas dos no heredaron un color de la leyenda. Y no hace falta que lo tengan: la pentatónica es, en gran parte del mundo, la capa más antigua de la música —China, África, los Andes, la música celta, el propio shakuhachi—, y agregar notas después es, históricamente, lo normal. Fa y Si son esa segunda capa. El capítulo 5 muestra de dónde sale, entonces, su color.</CapP>
  </>
)},
{ parte:"Parte I — Fundamentos", id:"cap5", titulo:"Cap. 5 — De la pentatónica al cromatismo", body: (
  <>
    <CapP>Los cinco colores de origen no se quedan aislados: se combinan entre sí, por mezcla directa, para generar los siete colores restantes y completar la rueda de doce.</CapP>
    <CapP>Do (azul) y Re (verde) se mezclan y dan Do sostenido, celeste — una mezcla válida en dos sentidos a la vez, porque el celeste, a diferencia del resto, es también un color espectral real: existe físicamente en la luz, entre el azul y el verde. Re (verde) y Mi (marrón) dan Re sostenido, un oliva que resulta de la mezcla real entre ambos. Mi (marrón) y Sol (amarillo) dan, en dos pasos, Fa y Fa sostenido —un dorado que se aclara a medida que se acerca al amarillo—. Sol (amarillo) y La (rojo) se mezclan y dan Sol sostenido, naranja. Y por último, La (rojo) y Do (azul) se mezclan y dan Si, violeta —que a su vez, mezclado otra vez con La, da Sib, rosa—.</CapP>
    <CapP>El marrón merece una aclaración aparte, porque a primera vista parece "romper" el espectro: no existe una banda de luz que produzca marrón. Técnicamente es un naranja oscurecido y desaturado, un color que solo existe por mezcla o por sombra, nunca en un prisma. Eso significa que ubicarlo donde lo ubica la leyenda —entre el verde y el amarillo— no viola ninguna ley óptica: el marrón nunca tuvo un lugar "correcto" en el espectro que este sistema esté alterando.</CapP>
    <CapFig caption="Figura 5. Las cinco notas ancla y las mezclas que completan la rueda de doce.">
      <RuedaCromatica highlight={["C","D","E","G","A"]}/>
    </CapFig>
    <CapP>Y acá aparece un cierre que no estaba planeado, pero que sostiene el argumento con una precisión que vale la pena señalar: Fa y Si, las dos notas sin historia propia, están exactamente a distancia de tritono entre sí —seis semitonos—. El tritono es, en música, el intervalo de mayor tensión e inestabilidad. Y en este sistema de color, es también el único intervalo cuya relación cromática es un <b>complementario exacto</b> —el par de colores de máximo contraste posible en toda la rueda—. Las dos notas que llegaron después, sin mito de origen, resultan ser las que generan, al mismo tiempo, la máxima tensión armónica y el máximo contraste visual. No hizo falta forzarlo: es consecuencia directa de aplicar la misma lógica hasta el final.</CapP>
  </>
)},
{ parte:"Parte I — Fundamentos", id:"cap5bis", titulo:"Cap. 5bis — Una variante real: el espectro continuo", body: (
  <>
    <CapP>Todo lo construido hasta acá —la leyenda del shakuhachi, la mezcla pentatónica, el marrón de Mi que en realidad es un naranja ensombrecido— pertenece a lo que este libro va a llamar, de ahora en más, la <b>paleta de estudio</b>. Es una paleta pensada para enseñar: cada color tiene una historia, una razón, un porqué que se puede contar en una frase. Eso es, exactamente, lo que la vuelve memorable — y también lo que la vuelve, en un sentido estricto, artificial: nadie en la naturaleza mezcla marrón con amarillo para producir un color intermedio, porque el marrón no es un color de la luz.</CapP>
    <CapP>Pero hay preguntas que la paleta de estudio no está pensada para responder bien. Si dos o tres notas se combinan en un acorde, ¿qué pasa si en vez de mezclar el marrón de Mi lo que se mezcla es un matiz continuo, sin sombras narrativas de por medio? Para eso este libro construye una segunda paleta, con un criterio completamente distinto: no contar una historia, sino calcular con la mayor coherencia física posible dentro del mismo sistema temperado de doce colores.</CapP>
    <CapP>Esta segunda paleta —la paleta real, o espectral— parte de los tres únicos anclajes que este libro considera innegociables, porque no dependen de una leyenda sino de una coincidencia de idioma y de percepción directa: Do es azul (el cielo), Sol es amarillo (el sol, con el mismo nombre en español) y La es rojo. Entre esos tres puntos fijos, en vez de mezclar colores nota por nota como hizo el capítulo 5, la paleta real interpola un matiz continuo alrededor de toda la rueda, sin agregar ningún color a mano. El resultado es una rueda que sí es, de punta a punta, un espectro real: no hay marrón, no hay oliva, no hay beige — hay una progresión ininterrumpida de matiz, igual que un arcoíris continuo doblado en círculo.</CapP>
    <CapP>Esto tiene un costo, y conviene decirlo con la misma honestidad que sostuvo el capítulo anterior: al interpolar matemáticamente, la paleta real pierde la justificación individual de cada color. Mi ya no es "la tierra de la montaña" — es, simplemente, el matiz que le toca por posición entre el verde de Re y el amarillo de Sol. Se gana continuidad física; se pierde historia. Es la razón por la que este libro nunca usa la paleta real para enseñar el sistema por primera vez.</CapP>
    <div className="grid sm:grid-cols-2 gap-4 my-4">
      <CapFig caption="Paleta de estudio — narrativa">
        <RuedaCromatica size={220}/>
      </CapFig>
      <CapFig caption="Paleta real — calculada en vivo (interpolación de matiz Do→Sol→La)">
        <RuedaCromatica size={220} usePaletteReal/>
      </CapFig>
    </div>
    <CapNota>Esta segunda rueda se calcula acá mismo, en la app, con el método que describe el libro (interpolación circular de matiz entre las tres anclas). No es una paleta fija ni "oficial" — es una demostración en vivo del criterio del capítulo, para comparar contra la paleta de estudio.</CapNota>
    <CapP>Las dos paletas conviven a propósito, cada una con su función: la de estudio para aprender y reconocer, la real para calcular mezclas de acordes con un criterio más físicamente coherente cuando se necesita esa precisión. Ninguna de las dos es "la verdadera". Las dos son honestas sobre lo que sacrifican, y esa honestidad —no una fórmula descubierta— es lo que sostiene todo el sistema.</CapP>
  </>
)},
{ parte:"Parte II — El sistema en profundidad", id:"cap6", titulo:"Cap. 6 — La correspondencia de la tercera", body: (
  <>
    <CapP>Hay una pregunta que este sistema no podía dejar sin responder: ¿por qué el marrón —justamente el color más "irregular" de toda la rueda— cae exactamente en Mi, la tercera de la tónica?</CapP>
    <CapP>La respuesta no es solo narrativa. En armonía, la tercera de un acorde es la nota que decide si ese acorde es mayor o menor. La fundamental y la quinta son estructurales, estables, casi neutras; la tercera es la que "tiñe" el carácter emocional del acorde entero. Por eso, en la jerga de la armonía, muchos músicos la llaman directamente "la nota de color" del acorde —mucho antes de que existiera este libro.</CapP>
    <CapP>El marrón, en teoría del color, cumple una función estructuralmente idéntica: no es un matiz propio, es una modificación de valor y saturación sobre otro color —un naranja oscurecido—. No aporta una identidad nueva: aporta una sombra sobre una identidad existente.</CapP>
    <CapP>La nota cuya función musical es matizar la armonía es representada, con coherencia real y no solo poética, por la familia de color cuya función óptica es exactamente matizar en lugar de aportar un color propio. Es la misma lógica que después aparece, otra vez, en el mundo mineral: el mismo ion de cromo produce rojo en el rubí y verde en la esmeralda, dependiendo únicamente de la estructura que lo aloja. La identidad no cambia. La expresión sí, según el contexto. Ese principio —contexto que define expresión sin alterar identidad— es, en el fondo, el que sostiene a todo el libro.</CapP>
    <CapH3>La tercera como nota de color, en cualquier tonalidad</CapH3>
    <CapP>Todo lo anterior se explicó con Do como ejemplo, pero el principio es transportable a las doce tonalidades. Tomemos Sol sostenido, que en este sistema es naranja —la mezcla entre Sol y La—. Su quinta es siempre Re sostenido (oliva), sea la tonalidad mayor o menor: la quinta es estructural y no cambia el carácter del acorde. Lo que sí cambia es la tercera: en Sol sostenido mayor, la tercera es Do (azul); en Sol sostenido menor, la tercera es Si (violeta). Dos colores completamente distintos matizando el mismo naranja de base, solo por el cambio de un semitono en la tercera — la manifestación cromática exacta de lo que ese semitono hace armónicamente.</CapP>
    <div className="grid grid-cols-2 gap-3 my-4">
      <MixFigure titulo="Sol# mayor (Sol#–Do–Re#)" notes={["G#","C","D#"]} nota="Fundamental naranja + tercera mayor (Do, azul) + quinta oliva."/>
      <MixFigure titulo="Sol# menor (Sol#–Si–Re#)" notes={["G#","B","D#"]} nota="Misma fundamental y quinta — la tercera menor (Si, violeta) tiñe todo el acorde distinto."/>
    </div>
    <CapP>Esto se repite, con sus propios valores, para cualquiera de las doce tónicas — probalo en la pestaña <b>Acorde</b> con cualquier acorde mayor y su relativo menor.</CapP>
  </>
)},
{ parte:"Parte II — El sistema en profundidad", id:"cap7", titulo:"Cap. 7 — El doble temperamento", body: (
  <>
    <CapP>Este es el capítulo bisagra: todo lo anterior construye hacia acá, y todo lo que sigue lo aplica.</CapP>
    <CapP>La música occidental temperada no usa las proporciones "puras" de la afinación natural —la serie armónica—. Las ajusta, deliberadamente, para poder dividir la octava en doce semitonos exactamente iguales. Es una decisión práctica, no un descubrimiento: se sacrifica la pureza acústica para ganar un sistema funcional y transportable a cualquier tonalidad.</CapP>
    <CapP>Este libro hace, con el color, exactamente el mismo gesto. Y para demostrarlo —no solo para afirmarlo— se pusieron a prueba tres intentos distintos de encontrar una correspondencia física real entre sonido y color, y los tres, de manera consistente, fallaron:</CapP>
    <CapP><b className="text-gray-200">Primero</b>, el espectro de luz real no tiene el mismo tamaño que una octava musical —ocupa apenas menos de una octava—, así que ningún mapeo directo de frecuencia de sonido a frecuencia de luz logra que las doce notas entren completas en el rango visible: algo siempre queda afuera, en infrarrojo o ultravioleta.</CapP>
    <CapP><b className="text-gray-200">Segundo</b>, incluso usando la técnica válida de elevar una frecuencia de audio cuarenta octavas para llevarla al rango de luz visible, el resultado no coincide con los colores de este sistema — de hecho invierte varias asignaciones (Do termina siendo infrarrojo, invisible; La termina siendo naranja, no rojo).</CapP>
    <CapP><b className="text-gray-200">Tercero</b>, se compararon las propiedades físicas reales de las doce piedras preciosas elegidas para cada nota —densidad, dureza, índice de refracción— contra la frecuencia sonora de cada nota. La correlación estadística fue prácticamente cero en los tres casos.</CapP>
    <CapNota>Tres intentos, tres resultados negativos, siempre de la misma manera. Y ese patrón repetido es, en sí mismo, el argumento central de todo el libro: si alguno de esos tres intentos hubiera arrojado una correlación fuerte, sería motivo de sospecha, no de celebración. Que los tres fallen limpiamente confirma que este es un sistema <b>temperado</b>: construido con criterios explícitos y defendibles, no derivado de una fórmula de la naturaleza. Y sin embargo, el sistema funciona —porque nunca pretendió ser un hallazgo. Pretendió, desde el principio, ser un lenguaje.</CapNota>
    <CapH3>Un anclaje real, sin necesidad de leyenda</CapH3>
    <CapP>Todo lo anterior son intentos de correspondencia física que fallaron, y este libro los cuenta igual porque el fracaso ordenado es parte del argumento. Pero hay una sola nota, en todo el sistema, que sí tiene un anclaje físico real, verificable y ajeno a cualquier leyenda: el La. No por ninguna propiedad de su color —la idea de que el rojo sea "el primer color que percibe el ojo" circula bastante, pero no resiste una revisión mínima: según qué estudio se consulte, el primer matiz en aparecer en el umbral de percepción es el amarillo, no el rojo, y no hay acuerdo real entre las fuentes.</CapP>
    <CapP>Lo que el La sí tiene, y que ninguna otra nota de la escala tiene, es un anclaje universalmente estandarizado: los 440 Hz del diapasón, la referencia de afinación de la música occidental (norma ISO 16), el punto del que parte cualquier instrumento que se afina hoy. No es una leyenda ni una elección estética — es, probablemente, el hecho más verificable de todo este libro.</CapP>
    <CapP>Y en este sistema, el La ya es rojo desde el capítulo 4 —la vida, la sangre, a la distancia—, sin que hiciera falta ajustar nada para lograrlo. Que la única nota con anclaje físico real termine siendo también el color de mayor intensidad simbólica de la leyenda no es una prueba de nada, pero sí es una segunda capa de sentido que vale la pena señalar.</CapP>
  </>
)},
{ parte:"Parte II — El sistema en profundidad", id:"cap8", titulo:"Cap. 8 — El círculo de quintas en color", body: (
  <>
    <CapP>El círculo de quintas —la forma en que las tonalidades se organizan por su distancia armónica, no por su distancia cromática— revela algo que el círculo cromático simple no muestra.</CapP>
    <CapP>Cada salto de una quinta equivale, en la rueda de doce colores de este sistema, a un giro constante de 210 grados. No es un número cualquiera: coincide con relaciones que la teoría del color ya nombra formalmente.</CapP>
    <CapP>El <b>tritono</b> —seis semitonos, 180°— es un complementario exacto: el intervalo más disonante e inestable de la música cae en el par de colores de máximo contraste posible. La <b>quinta justa</b> —210°— es un split-complementario: consonancia máxima después de la octava, pero el color no llega al opuesto exacto, se queda a 30° de distancia — contraste resuelto, no frontal. La <b>tercera mayor</b> —120°— es el ángulo clásico del esquema tríadico en teoría del color, el más vibrante y equilibrado que existe.</CapP>
    <CapP>Dibujado como estrella de doce puntas —la forma tradicional del círculo de quintas—, cada conexión de este sistema resulta ser siempre split-complementaria: nunca un choque frontal, siempre una tensión resuelta. Y si se reordena la rueda completa según el círculo de quintas en vez del orden cromático, los colores dejan de avanzar en degradé y saltan de forma irregular — la elección exactamente inversa a la de Scriabin, que ordenó por quintas para lograr ahí su arcoíris prolijo, sacrificando el orden cromático. Este sistema prioriza lo opuesto, a propósito.</CapP>
    <CapH3>La geometría de los acordes</CapH3>
    <CapP>Si el círculo de quintas ya mostraba que un intervalo fijo es siempre el mismo ángulo, no importa desde qué nota se lo mida, el paso siguiente es natural: un acorde entero —no ya un intervalo suelto, sino una combinación de varias notas— también traza una figura fija sobre la rueda.</CapP>
    <CapP>Una tríada mayor cualquiera son tres puntos: la fundamental, la tercera mayor (4 semitonos) y la quinta justa (7 semitonos). Esos tres puntos, unidos, forman un triángulo. Do mayor es Do-Mi-Sol: un triángulo escaleno con vértices en esas tres posiciones. Sumarle la séptima mayor (Si, 11 semitonos) no cambia el triángulo — lo extiende a un cuadrilátero, agregando un cuarto vértice. Y una tríada menor, que solo difiere de la mayor en un semitono (la tercera baja de Mi a Mib), traza un triángulo parecido pero no idéntico: un vértice se corre, la figura entera se deforma un poco.</CapP>
    <CapP>Y ahí aparece la utilidad más concreta de pensar los acordes como figuras: trasponer deja de ser recalcular notas una por una, y pasa a ser girar la misma figura sobre la rueda. Un Do mayor trasladado a Fa no es "hay que pensar cuál es la tercera de Fa" — es tomar el mismo triángulo y rotarlo hasta que la fundamental caiga en Fa. La forma no cambia nunca; lo único que cambia es la orientación. Cada tipo de acorde —mayor, menor, séptima mayor, séptima dominante, disminuido, aumentado— tiene su propia figura característica, fija, reconocible de un vistazo, sea cual sea la tonalidad.</CapP>
    <CapP>Para acordes de cuatro notas en adelante, la misma rueda admite una segunda lectura, más propia del vocabulario del jazz: en vez de una única figura cerrada, el acorde se puede descomponer en una <b>base</b> (fundamental, tercera, quinta y séptima) y sus <b>tensiones</b> (novena, oncena, trecena). Esta doble lectura es exactamente el concepto de poliacorde: pensar una estructura superior como dos acordes más simples sonando a la vez. (La pestaña <b>Quintas</b> de esta app ya implementa el círculo interactivo de este capítulo.)</CapP>
  </>
)},
{ parte:"Parte III — Aplicación", id:"cap9", titulo:"Cap. 9 — Lectura rápida de partituras por color", body: (
  <>
    <CapNota>Capítulo en desarrollo — sección práctica, pendiente de definir ejercicios concretos de lectura.</CapNota>
    <CapP>La idea central de este capítulo es simple de enunciar y requiere práctica para volverse automática: en vez de leer una nota, calcular su nombre, y recién ahí reconocer su función armónica, el color permite saltar directo al último paso. Un pasaje de partitura coloreado según este sistema convierte la lectura en reconocimiento de patrón visual —qué colores se repiten, cuáles contrastan, dónde aparece la tensión de un tritono— antes que en decodificación nota por nota.</CapP>
    <CapP>Falta desarrollar acá: ejercicios progresivos de lectura, ejemplos de partituras reales coloreadas, y una guía de cómo aplicar el sistema a instrumentos específicos (teclado, bandoneón, cuerdas, viento).</CapP>
  </>
)},
{ parte:"Parte III — Aplicación", id:"cap10", titulo:"Cap. 10 — Acordes y tonalidades por mezcla", body: (
  <>
    <CapP>Si cada nota tiene un color, un acorde —varias notas simultáneas— puede pensarse como una mezcla de colores. Este sistema resuelve esa mezcla con tres decisiones independientes, no con una fórmula única:</CapP>
    <CapP><b className="text-gray-200">Cuánto pesa cada nota.</b> El modelo armónico usa la proporción real de la serie de armónicos naturales. El modelo narrativo le da más peso a la tercera, coherente con el capítulo 6. Pero ninguno de los dos resuelve un problema práctico: si la séptima, la novena o la trecena pesan casi lo mismo que la fundamental, el color final puede terminar más cerca de esa tensión que de la raíz — un Do13 con la trecena en La puede leerse casi rojo, y deja de comunicar que sigue siendo, ante todo, un acorde de Do.</CapP>
    <CapP>Por eso el modo por defecto de esta app es un tercer criterio: <b>raíz dominante</b>. La fundamental se queda con un porcentaje fijo del peso total —80% por defecto— y todo lo demás se reparte en partes iguales el porcentaje restante. El resultado es un color que nunca se aleja demasiado de la raíz, sin importar cuántas notas se agreguen encima.</CapP>
    <CapP><b className="text-gray-200">Cómo se mezclan.</b> El modelo de <i>luz</i> mezcla por promedio aditivo de RGB —como sumar haces de proyector—. El modelo de <i>pintura</i> mezcla en espacio sustractivo —como pigmento real: cuantos más colores se suman, más se oscurece. Esta app usa el modelo de luz.</CapP>
    <CapP>El sistema no se detiene en la tríada: se extiende a séptimas, novenas, acordes disminuidos, aumentados y suspendidos, cada uno con su propia combinación de notas y, por lo tanto, su propio color resultante. Estos son los mismos ejemplos del libro, calculados en vivo con la paleta actual:</CapP>
    <div className="grid sm:grid-cols-3 gap-3 my-4">
      <MixFigure titulo="Re mayor (Re–Fa#–La)" notes={["D","F#","A"]}/>
      <MixFigure titulo="Re menor (Re–Fa–La)" notes={["D","F","A"]}/>
      <MixFigure titulo="Sol7 (Sol–Si–Re–Fa)" notes={["G","B","D","F"]}/>
    </div>
    <CapP>La tonalidad completa de una obra —no solo un acorde aislado— se resuelve como el color de su acorde tónica: Re mayor es la mezcla de Re-Fa♯-La; Re menor, la mezcla de Re-Fa-La. Es la solución más económica y la más coherente con todo lo demás: la identidad de una tonalidad es, en la práctica musical, la calidad de su tríada tónica.</CapP>
    <CapP>La pestaña <b>Acorde</b> de esta app implementa este capítulo en forma práctica: analizá cualquier cifrado y vas a ver sus notas coloreadas con esta misma paleta.</CapP>
  </>
)},
{ parte:"Parte III — Aplicación", id:"cap11", titulo:"Cap. 11 — Reconocimiento de acordes", body: (
  <CapNota>Capítulo pendiente — de acuerdo a lo conversado, esta sección "musical neta" —entrenar el reconocimiento auditivo y visual de acordes usando el sistema de color— queda para una etapa posterior del desarrollo del libro.</CapNota>
)},
{ parte:"Parte III — Aplicación", id:"cap12", titulo:"Cap. 12 — Ejercicios progresivos", body: (
  <CapNota>Capítulo pendiente de diseño. Estructura tentativa: ejercicios de reconocimiento de notas sueltas por color → intervalos → tríadas → acordes extendidos → lectura de fragmentos breves → progresiones tonales completas. Falta definir la cantidad de niveles y si se acompañan de partituras reales o de ejercicios propios.</CapNota>
)},
{ parte:"Parte IV — Una puerta lateral", id:"piedras", titulo:"Piedras, energía y sonido", body: (
  <>
    <CapP>Esta es la única puerta lateral del libro. Todo lo anterior —Partes I, II y III— es el sistema propiamente dicho: justificado, temperado, y transportable a cualquier tonalidad. Lo que sigue acá es distinto en naturaleza, no solo en tono.</CapP>
    <CapP>Este capítulo nace de una inquietud personal: las piedras preciosas tienen colores propios —ya vimos, en el capítulo 6, que ese color tiene una causa atómica real y verificable—, pero en muchas tradiciones espirituales, además, se les atribuyen propiedades energéticas. La pregunta que dio origen a este capítulo fue simple: si cada piedra de este sistema ya tiene asignada una nota musical propia, ¿podría esa nota funcionar como una forma de "sintonizar" o reforzar simbólicamente la energía que la tradición le atribuye a esa piedra?</CapP>
    <CapNota>Lo que sigue es tradición espiritual, no evidencia científica. La sanación con cristales (litoterapia) y la sanación con sonido son prácticas con siglos de historia —documentadas ya en la Mesopotamia sumeria, hacia el 3000 a.C.— pero no cuentan con respaldo científico validado. Se presentan acá como una capa de sentido para quien la busca, no como un hecho comprobado.</CapNota>
    <CapH3>Correspondencia entre piedra, energía tradicional y nota</CapH3>
    <div className="overflow-x-auto rounded-xl border border-gray-800" style={{background:"#121212"}}>
      <table className="w-full text-xs" style={{minWidth:"520px"}}>
        <thead>
          <tr style={{background:"#1a1a1a",borderBottom:"1px solid #333333"}}>
            {["Nota","Piedra","Energía tradicional","Chakra"].map(h=>(
              <th key={h} className="text-left px-3 py-2 text-gray-500 uppercase tracking-widest font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PIEDRAS.map((p,i)=>(
            <tr key={p.n} style={{borderBottom:"1px solid #2a2a2a",background:i%2===0?"transparent":"#1a1a1a"}}>
              <td className="px-3 py-2">
                <button onClick={()=>playTone(p.n,4,0.6)} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold border-2"
                  style={{backgroundColor:nc(p.n)+"18",borderColor:nc(p.n),color:nc(p.n)}}>
                  {CROM_DOBLE[p.n]}
                </button>
              </td>
              <td className="px-3 py-2 italic text-gray-300">{p.piedra}</td>
              <td className="px-3 py-2 text-gray-500">{p.energia}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{p.chakra}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <CapH3>La nota como forma simbólica de sintonía</CapH3>
    <CapP>La propuesta de este capítulo, dentro de ese marco de tradición y no de ciencia, es sencilla: ya que cada piedra tiene asignada una nota musical exacta dentro de este sistema, tocar esa nota específica —en un xilófono, un cuenco tibetano afinado, una voz, cualquier instrumento— cerca de la piedra, o simplemente mientras se la sostiene, ofrece una forma de sintonía simbólica coherente con todo el resto del sistema: la misma nota que la representa en color es, ahora, también la que la representa en sonido. No se plantea como un mecanismo físico comprobado — se plantea como un gesto ritual con sentido interno, consistente de principio a fin con la lógica de todo el libro.</CapP>
  </>
)},
{ parte:"Anexos", id:"anexo", titulo:"Anexo — Ficha de referencia rápida", body: (
  <>
    <CapP>Los doce colores oficiales del sistema, con su hex y su piedra correspondiente — la misma paleta que usa toda esta app.</CapP>
    <div className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden" style={{background:"#121212"}}>
      {PIEDRAS.map(p=>(
        <div key={p.n} className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-8 h-8 rounded-full border-2 flex-shrink-0" style={{background:nc(p.n),borderColor:nc(p.n)}}/>
          <span className="font-bold w-16" style={{color:nc(p.n),fontFamily:"'Libre Baskerville',serif"}}>{CROM_DOBLE[p.n]}</span>
          <span className="font-mono text-xs text-gray-600 w-20">{nc(p.n)}</span>
          <span className="italic text-gray-500 text-sm">{p.piedra}</span>
        </div>
      ))}
    </div>
    <CapNota>Pendiente de compilación futura: guías de ejercitación por instrumento (bandoneón, piano), y partituras reales coloreadas con el sistema — quedan para publicaciones independientes de este manual, una vez que el método demuestre su naturalidad en el uso diario.</CapNota>
  </>
)},
];

// ─── Componente de la pestaña "El Código" ────────────────────────────────────
function ElCodigoTab(){
  const [capIdx, setCapIdx] = useState(0);
  const cap = CAPITULOS[capIdx];
  const partes = [...new Set(CAPITULOS.map(c=>c.parte))];

  return(
    <div className="stagger">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>
          📖 El Código — Manual de teoría musical a través del color
        </h2>
        <p className="text-xs text-gray-500">Temperamento cromático: un sistema de doce colores para leer música más rápido de lo que se la puede calcular.</p>
      </div>

      {capIdx===0 && <CristalesColor/>}

      {/* Selector de capítulo, agrupado por parte */}
      <select value={capIdx} onChange={e=>setCapIdx(parseInt(e.target.value))}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 mb-4"
        style={{fontFamily:"monospace"}}>
        {partes.map(parte=>(
          <optgroup key={parte} label={parte}>
            {CAPITULOS.map((c,i)=> c.parte===parte && (
              <option key={c.id} value={i}>{c.titulo}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="rounded-2xl p-5 border border-gray-700" style={{background:"#121212"}}>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{cap.parte}</p>
        <h3 className="text-lg font-bold mb-4" style={{fontFamily:"'Libre Baskerville',serif",color:"#e6e6e6"}}>{cap.titulo}</h3>
        {cap.body}
      </div>

      <div className="flex justify-between mt-4">
        <button disabled={capIdx===0} onClick={()=>setCapIdx(i=>Math.max(0,i-1))}
          className="px-4 py-2 rounded-xl text-sm border disabled:opacity-30"
          style={{background:"#1a1a1a",borderColor:"#333333",color:"#e6e6e6"}}>
          ← Anterior
        </button>
        <button disabled={capIdx===CAPITULOS.length-1} onClick={()=>setCapIdx(i=>Math.min(CAPITULOS.length-1,i+1))}
          className="px-4 py-2 rounded-xl text-sm border disabled:opacity-30"
          style={{background:"#1a1a1a",borderColor:"#333333",color:"#e6e6e6"}}>
          Siguiente →
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// ─── ENTRENADOR — ejercicio: pintar el teclado del bandoneón ─────────────────
// Teclado en blanco: el usuario toca cada botón, elige entre los 12 colores
// del sistema cromático, y puede corregirse contra el mapa real de notas.
// ═══════════════════════════════════════════════════════════════════════════

// Ventana chica anclada a una tecla (no tapa ni oscurece la página)
function PopoverAnclado({ rect, onClose, width=260, estimado=230, children }){
  const M=8, vw=window.innerWidth, vh=window.innerHeight;
  const cx=rect.left+rect.width/2;
  const left=Math.min(Math.max(cx-width/2,M), vw-width-M);
  const arriba = rect.top-M >= estimado+10;
  let top = arriba ? rect.top-estimado-10 : rect.bottom+10;
  top=Math.min(Math.max(top,M), vh-estimado-M);
  const flecha=Math.min(Math.max(cx-left,18), width-18);
  useEffect(()=>{
    const close=()=>onClose(); const key=(e)=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("scroll",close,true); window.addEventListener("resize",close); window.addEventListener("keydown",key);
    return ()=>{ window.removeEventListener("scroll",close,true); window.removeEventListener("resize",close); window.removeEventListener("keydown",key); };
  },[onClose]);
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{position:"fixed",left,top,width,background:"#131315",border:"1.5px solid #e6e6e6",borderRadius:12,padding:"12px 12px 10px",boxShadow:"0 10px 30px rgba(0,0,0,.65)",fontFamily:UI_FONT,color:"#ececec"}}>
        <div style={{position:"absolute",left:flecha-6,[arriba?"bottom":"top"]:-7,width:12,height:12,background:"#131315",
          borderRight:arriba?"1.5px solid #e6e6e6":"none",borderBottom:arriba?"1.5px solid #e6e6e6":"none",
          borderLeft:arriba?"none":"1.5px solid #e6e6e6",borderTop:arriba?"none":"1.5px solid #e6e6e6",transform:"rotate(45deg)"}}/>
        {children}
      </div>
    </div>
  );
}

// Menú de color chico, anclado a la tecla tocada (no tapa la página ni la oscurece)
function HojaDeColor({ rect, actual, onPick, onErase, onClose }){
  const PW=244, PH=158, M=8;
  const vw=window.innerWidth, vh=window.innerHeight;
  const cx=rect.left+rect.width/2;
  const left=Math.min(Math.max(cx-PW/2,M), vw-PW-M);
  const arriba = rect.top-M >= PH+10;
  let top = arriba ? rect.top-PH-10 : rect.bottom+10;
  top=Math.min(Math.max(top,M), vh-PH-M);
  const arrowLeft=Math.min(Math.max(cx-left,18), PW-18);

  useEffect(()=>{
    const close=()=>onClose();
    const key=(e)=>{ if(e.key==="Escape") onClose(); };
    window.addEventListener("scroll",close,true);
    window.addEventListener("resize",close);
    window.addEventListener("keydown",key);
    return ()=>{
      window.removeEventListener("scroll",close,true);
      window.removeEventListener("resize",close);
      window.removeEventListener("keydown",key);
    };
  },[onClose]);

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{position:"fixed",left,top,width:PW,background:"#121212",border:"1.5px solid #e6e6e6",borderRadius:12,
          padding:"10px 10px 8px",boxShadow:"0 10px 30px rgba(0,0,0,.65)"}}>
        <div style={{position:"absolute",left:arrowLeft-6,[arriba?"bottom":"top"]:-7,width:12,height:12,background:"#121212",
          borderRight:arriba?"1.5px solid #e6e6e6":"none",borderBottom:arriba?"1.5px solid #e6e6e6":"none",
          borderLeft:arriba?"none":"1.5px solid #e6e6e6",borderTop:arriba?"none":"1.5px solid #e6e6e6",
          transform:"rotate(45deg)"}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"6px 4px",marginBottom:8}}>
          {CHROMATIC.map(n=>{
            const sel = actual===nc(n);
            return(
              <button key={n} onClick={()=>onPick(nc(n))}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:0,background:"none",border:"none",cursor:"pointer"}}>
                <span style={{display:"block",width:30,height:30,borderRadius:"50%",background:nc(n),
                  border:sel?"3px solid #fff":"2px solid rgba(255,255,255,.22)"}}/>
                <span style={{fontSize:9,color:sel?"#e6e6e6":"#aaa",fontFamily:"monospace"}}>{CROM_SIMPLE[n]}</span>
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={onErase} style={{flex:1,padding:"5px",borderRadius:8,border:"1px solid #5c2d2d",background:"#1f0a0a",color:"#d98f88",fontWeight:700,fontSize:11,cursor:"pointer"}}>🗑 Borrar</button>
          <button onClick={onClose} style={{flex:1,padding:"5px",borderRadius:8,border:"1px solid #2a2a2a",background:"transparent",color:"#8a8a8a",fontSize:11,cursor:"pointer"}}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// Teclado en blanco, escalado para entrar siempre en el ancho disponible
// (misma técnica de transform:scale ya usada en BandCanvas).
function PaintCanvas({ buttons, guesses, keyOf, checked, correctOf, onTapButton, maxWidth, maxScale=3, activeId=null, chord=null, escala=null, rotulo=null }){
  const W = Math.max(...buttons.map(b=>b.x)) + BTN_SIZE + 16;
  const H = Math.max(...buttons.map(b=>b.y)) + BTN_SIZE + 20;
  const target = maxWidth || W;
  // El teclado se ajusta exactamente al ancho disponible (sin scroll lateral).
  const scale = Math.min(maxScale, target / W);
  const scaledW = Math.ceil(W * scale), scaledH = Math.ceil(H * scale);

  return (
    <div style={{width:"100%", overflow:"hidden"}}>
    <div style={{width:scaledW, height:scaledH, overflow:"hidden", flexShrink:0, margin:"0 auto"}}>
      <div style={{
        position:"relative", width:W, height:H, boxSizing:"border-box",
        transform:`scale(${scale})`, transformOrigin:"top left",
        background:"linear-gradient(145deg,#1d1d1d,#101010)",
        border:"2px solid #3a3a3a", borderRadius:16,
        boxShadow:"0 8px 24px rgba(0,0,0,.7)",
      }}>
        {buttons.map(btn=>{
          let bg, borderCss, glow, content=null;
          if(escala){
            const st=escala.stateOf(btn); bg=st.bg; borderCss=st.border; glow=st.glow; content=st.content;
          } else if(chord){
            const sel = chord.isSel(btn), lab = chord.labelOf(btn);
            const ok = checked && sel && lab, bad = checked && sel && !lab;
            const miss = checked && !sel && lab && chord.isMissed(btn);
            const verResp = chord.reveal && lab;
            bg = verResp ? correctOf(btn) : sel ? "#6a6a6a" : "#1a1a1a";
            borderCss = ok ? "3px solid #6b9c7c" : bad ? "3px solid #b5564f" : miss ? "3px dashed #ffffff"
              : (sel||verResp) ? "3px solid #ffffff" : "3px solid #555";
            glow = btn.id===activeId ? "0 0 0 4px #e6e6e6" : (ok ? "0 0 10px #6b9c7caa" : miss ? "0 0 10px #ffffff88" : "none");
            if(ok) content=<span style={{fontSize:14,color:"#fff",fontWeight:800}}>✓</span>;
            else if(bad) content=<span style={{fontSize:13,color:"#fff",fontWeight:800}}>✕</span>;
            else if(verResp||miss) content=<span style={{fontSize:12,color:miss?"#fff":txtSobre(bg),fontWeight:800,fontFamily:"monospace"}}>{lab}</span>;
          } else {
            const guess = guesses[keyOf(btn.id)];
            const correct = checked ? correctOf(btn) : null;
            const isRight = checked && guess && guess===correct;
            const isWrong = checked && guess && guess!==correct;
            bg = guess || "#1a1a1a";
            borderCss = `3px solid ${isRight?"#6b9c7c":isWrong?"#b5564f":guess?"rgba(255,255,255,.5)":"#555"}`;
            glow = btn.id===activeId ? "0 0 0 4px #e6e6e6" : (guess ? `0 0 10px ${guess}99` : "none");
            const etq = (checked && rotulo && guess) ? rotulo(btn) : null;
            const marca = (m,sz)=> <span style={{display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1.05,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,.95)"}}>
              <span style={{fontSize:sz,fontWeight:800}}>{m}</span>{etq ? <span style={{fontSize:8.5,fontWeight:800,fontFamily:"monospace"}}>{etq}</span> : null}</span>;
            if(isRight) content=marca("✓",13);
            if(isWrong) content=marca("✕",12);
          }
          return (
            <button key={btn.id} onClick={(e)=>onTapButton(btn, e.currentTarget.getBoundingClientRect())}
              style={{
                position:"absolute", left:btn.x, top:btn.y, width:BTN_SIZE, height:BTN_SIZE, borderRadius:"50%",
                background:bg, border:borderCss, boxShadow:glow,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              }}>
              {content}
            </button>
          );
        })}
      </div>
    </div>
    </div>
  );
}

// ─── ESCALAS PARA EL ENTRENADOR ──────────────────────────────────────────────
const ESC_ENT = [
  {id:"mayor",  nombre:"Mayor",          ivs:[0,2,4,5,7,9,11]},
  {id:"menor",  nombre:"Menor natural",  ivs:[0,2,3,5,7,8,10]},
  {id:"menorA", nombre:"Menor armónica", ivs:[0,2,3,5,7,8,11]},
  {id:"menorM", nombre:"Menor melódica", ivs:[0,2,3,5,7,9,11]},
  {id:"crom",   nombre:"Cromática",      ivs:[0,1,2,3,4,5,6,7,8,9,10,11]},
];
// Botones de una mano con su altura real (nota + octava) para el fuelle indicado
function itemsMano(btns, bellows){
  return btns.map(b=>{
    const lat = bellows==="abre" ? b.abre : b.cierra;
    const eng = LAT[lat]||lat, pc = noteIdx(eng);
    const oct = bellows==="abre" ? (b.oct_abre??3) : (b.oct_cierra??3);
    return {b, pc, oct, midi:12*(oct+1)+pc};
  });
}
// Camino de la escala sobre una mano: la nota siguiente es la más cercana por encima (o por debajo), a no más de 4 semitonos.
// startIdx < 0 = automático: elige el primer punto de partida desde el que la escala sale completa.
function rutaEscala(btns, bellows, rootPc, ivs, dir, startIdx){
  const items = itemsMano(btns, bellows);
  const asc = [...new Map(items.filter(i=>i.pc===rootPc).sort((a,b)=>a.midi-b.midi).map(i=>[i.midi,i])).values()];
  const sube = dir!=="baja";
  const tonics = sube ? asc : [...asc].reverse();
  if(!tonics.length) return {route:[], missing:[rootPc], tonics, items, startUsed:0};
  const n = ivs.length;
  const grados = sube ? [...Array(n).keys(),0] : [0,...[...Array(n-1).keys()].map(k=>n-1-k),0];
  const pcs = grados.map(k=>(rootPc+ivs[k])%12);
  const build = (start)=>{
    const route=[{item:start,deg:0}], missing=[]; let cur=start.midi;
    for(let k=1;k<pcs.length;k++){
      const cand = items.filter(i=>i.pc===pcs[k] && (sube ? (i.midi>cur && i.midi-cur<=4) : (i.midi<cur && cur-i.midi<=4)));
      if(!cand.length){ missing.push(pcs[k]); break; }
      const it = cand.reduce((a,b)=> sube ? (b.midi<a.midi?b:a) : (b.midi>a.midi?b:a));
      route.push({item:it,deg:grados[k]}); cur=it.midi;
    }
    return {route,missing};
  };
  let used = startIdx;
  if(startIdx<0){ used = tonics.findIndex(t=>build(t).missing.length===0); if(used<0) used=0; }
  used = Math.min(used, tonics.length-1);
  const r = build(tonics[used]);
  return {route:r.route, missing:r.missing, tonics, items, startUsed:used};
}

function EntrenadorTab({preset}={}){
  const [leftBtns, setLeftBtns]   = useState([]);
  const [rightBtns, setRightBtns] = useState([]);
  useEffect(()=>{ const {left,right}=loadBtns(); setLeftBtns(left); setRightBtns(right); },[]);

  const [bellows, setBellows] = useState("abre");
  const [view, setView]       = useState("ambas");
  const [guesses, setGuesses] = useState({}); // `${id}|${bellows}` -> hex
  const [checked, setChecked] = useState(false);
  const [picker, setPicker]   = useState(null); // botón abierto en la hoja de color
  const [copied, setCopied]   = useState(false);
  const [modo, setModo]       = useState("colores");   // "colores" | "acordes"
  const [chordSel, setChordSel] = useState({});         // `${id}|${bellows}` -> true
  const [reveal, setReveal]     = useState(false);
  const [romano,setRomano]=useRomanos();
  const acorde = useAcorde(romano,setRomano);
  useEffect(()=>{ setChecked(false); setReveal(false); },[acorde.key, modo]);
  // — Escalas —
  const [escRoot,setEscRoot]=useState("C"), [escTipo,setEscTipo]=useState("mayor"), [escMano,setEscMano]=useState("der");
  const [escDir,setEscDir]=useState("sube"), [escStart,setEscStart]=useState(-1), [escModo,setEscModo]=useState("ver");
  const [prog,setProg]=useState({i:1,err:0,hint:false,wrong:null});
  const escTimers=useRef([]);
  const [info,setInfo]=useState(null);   // ventana de la tecla (escalas)
  useEffect(()=>()=>escTimers.current.forEach(clearTimeout),[]);
  // Ejercicio asignado por el profesor: deja el entrenador listo para practicarlo
  useEffect(()=>{
    if(!preset) return;
    setBellows(preset.fuelle==="cierra"?"cierra":"abre");
    if(preset.tipo==="escala"){
      setModo("escalas"); setEscRoot(preset.root||"C"); setEscTipo(preset.escala||"mayor"); setEscMano(preset.mano==="izq"?"izq":"der");
      setEscDir(preset.dir==="baja"?"baja":"sube"); setEscStart(preset.inicio===undefined?-1:preset.inicio); setEscModo(preset.modoEj==="practica"?"practica":"ver");
      setView(preset.mano==="izq"?"izquierda":"derecha");
    } else if(preset.tipo==="acorde"){
      setModo("acordes"); acorde.setAll(preset.ac||{}); setView("ambas");
    }
  },[preset&&preset.nonce]);
  useEffect(()=>{ setProg({i:1,err:0,hint:false,wrong:null}); setInfo(null); },[escRoot,escTipo,escMano,escDir,escStart,escModo,bellows,modo]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<640);
    check(); window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  const [wrapRef, wrapMedido] = useAnchoMedido();
  const wrapWidth = wrapMedido || 900;
  const bothVisible = view==="ambas";
  const maxW = wrapWidth; // cada teclado usa todo el ancho (apilados), así se ven lo más grandes posible
  const disp = useDisposicion();
  const an = calcAnchos(wrapWidth,leftBtns,rightBtns,view==="ambas",disp.lado,isMobile);

  const keyOf = useCallback((id)=>`${id}|${bellows}`,[bellows]);
  const correctOf = useCallback((btn)=>{
    const noteLat = bellows==="abre" ? btn.abre : btn.cierra;
    return nc(LAT[noteLat]||noteLat);
  },[bellows]);

  const openPicker = (btn, rect)=> setPicker({btn, rect});
  const closePicker = useCallback(()=>setPicker(null),[]);
  const pickColor = (hex)=>{
    setGuesses(g=>({...g, [keyOf(picker.btn.id)]: hex}));
    setPicker(null);
  };
  const erase = ()=>{
    setGuesses(g=>{ const n={...g}; delete n[keyOf(picker.btn.id)]; return n; });
    setPicker(null);
  };

  const allButtons = useMemo(()=>[...leftBtns, ...rightBtns],[leftBtns,rightBtns]);
  const pcOf = (btn)=>{ const n = bellows==="abre" ? btn.abre : btn.cierra; return LAT[n]||n; };
  const isSel = (btn)=>!!chordSel[keyOf(btn.id)];
  const chordLabelOf = (btn)=>acorde.labelByPc[pcOf(btn)]||null;
  const toggleSel = (btn)=>{ setChordSel(s=>{ const n={...s}; const k=keyOf(btn.id); if(n[k]) delete n[k]; else n[k]=true; return n; }); setChecked(false); };
  const selected  = allButtons.filter(isSel);
  const selOk     = selected.filter(b=>chordLabelOf(b));
  const selBad    = selected.filter(b=>!chordLabelOf(b));
  const coveredPcs = new Set(selOk.map(pcOf));
  const faltanTones = acorde.tones.filter(tn=>!coveredPcs.has(tn.pc));
  const faltanPcs = new Set(faltanTones.map(tn=>tn.pc));
  const chordProps = modo==="acordes" ? { isSel, labelOf:chordLabelOf, isMissed:(btn)=>faltanPcs.has(pcOf(btn)), reveal } : null;
  const escDef   = ESC_ENT.find(e=>e.id===escTipo);
  const escIvs   = (escTipo==="menorM" && escDir==="baja") ? ESC_ENT[1].ivs : escDef.ivs;   // melódica: baja como natural
  const escRootPc = noteIdx(escRoot);
  const escNombres = buildScale(escRoot, escIvs);
  const escPcSet = new Set(escNombres.map(noteIdx));
  const escDeletreo = {}; escNombres.forEach(n=>{ escDeletreo[noteIdx(n)] = nombreLat(n); });
  const escBtns  = escMano==="izq" ? leftBtns : rightBtns;
  const escR     = useMemo(()=> modo==="escalas" && escBtns.length ? rutaEscala(escBtns,bellows,escRootPc,escIvs,escDir,escStart) : {route:[],missing:[],tonics:[],items:[]},
                           [modo,escBtns,bellows,escRootPc,escTipo,escDir,escStart]);
  const escIdxById = {}; escR.route.forEach((r,i)=>{ escIdxById[r.item.b.id]=i; });
  const itemDe = (btn)=> itemsMano([btn],bellows)[0];
  const etiqueta = (it)=> (escDeletreo[it.pc]||CROM_SIMPLE[CHROMATIC[it.pc]]) + it.oct;
  const tocarItem = (it)=> playBand(CHROMATIC[it.pc], it.oct);
  // Digitación: viene dentro del ejercicio asignado (solo si la configuración sigue siendo la del ejercicio)
  const sigAct = [escTipo,escRoot,escMano,escDir,bellows,escStart].join("|");
  const sigPre = (preset&&preset.tipo==="escala") ? [preset.escala||"mayor",preset.root||"C",preset.mano==="izq"?"izq":"der",preset.dir==="baja"?"baja":"sube",preset.fuelle==="cierra"?"cierra":"abre",preset.inicio===undefined?-1:preset.inicio].join("|") : "";
  const dedos  = (preset&&preset.dedos&&sigAct===sigPre) ? preset.dedos : (preset&&preset.ruta&&sigAct===sigPre ? preset.ruta.map(p=>p.d||"") : []);
  const notaOct = (btn)=>{ const it=itemDe(btn); return CROM_SIMPLE[CHROMATIC[it.pc]]+it.oct; };
  const funcionDe = (pc)=>{ const k=escNombres.findIndex(n=>noteIdx(n)===pc); if(k<0) return null; const lab=GRADO_LABEL[escIvs[k]]; return romano?aRomano(lab):lab; };
  const verDedo = (i)=> escModo==="ver" || i<prog.i || (prog.hint && i===prog.i);
  const gradoTxt = (r,i)=>{ const n=escIvs.length; const esOct = escR.route.length===n+1 && (escDir!=="baja" ? i===n : i===0); const lab = esOct ? "8" : GRADO_LABEL[escIvs[r.deg]]; return romano ? aRomano(lab) : lab; };
  const escEscuchar = ()=>{
    escTimers.current.forEach(clearTimeout); escTimers.current=[];
    escR.route.forEach((r,i)=>escTimers.current.push(setTimeout(()=>tocarItem(r.item), i*430)));
  };
  const escTap = (btn, rect)=>{
    const it = itemDe(btn); tocarItem(it);
    if(escModo==="ver"){ setInfo({btn,rect}); return; }
    if(escModo!=="practica" || prog.i>=escR.route.length) return;
    const exp = escR.route[prog.i].item;
    const enMano = escBtns.some(x=>x.id===btn.id);
    if(enMano && it.midi===exp.midi){ setProg(p=>({...p,i:p.i+1,hint:false,wrong:null})); }
    else {
      setProg(p=>({...p,err:p.err+1,wrong:btn.id}));
      escTimers.current.push(setTimeout(()=>setProg(p=>({...p,wrong:null})),700));
    }
  };
  const escStateOf = (btn)=>{
    const it = itemDe(btn), col = nc(CHROMATIC[it.pc]), ri = escIdxById[btn.id], enEsc = escPcSet.has(it.pc);
    const num = (n,sub,bg,ded)=> <span style={{display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1.05,color:txtSobre(bg)}}>
        <b style={{fontSize:String(n).length>2?11:14}}>{n}</b><span style={{fontSize:8.5,fontWeight:800,fontFamily:"monospace"}}>{sub}</span>
        {ded ? <span style={{position:"absolute",top:-8,right:-8,minWidth:18,height:18,padding:"0 3px",borderRadius:9,background:"#fff",color:"#111",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(0,0,0,.7)"}}>{ded}</span> : null}</span>;
    if(escModo==="ver"){
      if(ri!==undefined) return {bg:col, border:"3px solid #fff", glow:`0 0 14px ${col}cc`, content:num(gradoTxt(escR.route[ri],ri),etiqueta(it),col,verDedo(ri)?dedos[ri]:0)};
      if(enEsc) return {bg:col+"55", border:`2px solid ${col}`, glow:"none", content:<span style={{fontSize:8.5,fontWeight:700,color:"#ddd",fontFamily:"monospace"}}>{etiqueta(it)}</span>};
      return {bg:"#121212", border:"3px solid #262626", glow:"none", content:null};
    }
    // práctica: no se regalan los colores hasta acertar
    if(ri!==undefined && ri<prog.i) return {bg:col, border:"3px solid #6b9c7c", glow:`0 0 12px ${col}aa`, content:num(gradoTxt(escR.route[ri],ri),etiqueta(it),col,verDedo(ri)?dedos[ri]:0)};
    const esProx = prog.hint && escR.route[prog.i] && escR.route[prog.i].item.b.id===btn.id;
    if(prog.wrong===btn.id) return {bg:"#3a1a1a", border:"3px solid #b5564f", glow:"0 0 10px #b5564f", content:<span style={{color:"#fff",fontWeight:800}}>✕</span>};
    if(esProx) return {bg:"#1a1a1a", border:"3px dashed #fff", glow:"0 0 10px #ffffff88", content:null};
    return {bg:"#1a1a1a", border:"3px solid #555", glow:"none", content:null};
  };
  const scaleProps = modo==="escalas" ? { stateOf:escStateOf } : null;
  const tapBtn = (btn, rect)=> modo==="acordes" ? toggleSel(btn) : modo==="escalas" ? escTap(btn, rect) : openPicker(btn, rect);
  const painted = allButtons.filter(b=>guesses[keyOf(b.id)]);
  const correctos = painted.filter(b=>guesses[keyOf(b.id)]===correctOf(b));

  const reiniciarFuelle = ()=>{
    if(modo==="escalas"){ setProg({i:1,err:0,hint:false,wrong:null}); return; }
    if(modo==="acordes"){
      setChordSel(s=>{ const n={...s}; allButtons.forEach(b=>delete n[keyOf(b.id)]); return n; });
      setChecked(false); setReveal(false);
      return;
    }
    setGuesses(g=>{
      const n={...g};
      allButtons.forEach(b=>delete n[keyOf(b.id)]);
      return n;
    });
    setChecked(false);
  };

  const buildCSV = ()=>{
    const rows=["boton,mano,fuelle,nota,color_correcto,color_elegido,resultado"];
    allButtons.forEach(b=>{
      const g = guesses[keyOf(b.id)];
      if(!g) return;
      const noteLat = bellows==="abre" ? b.abre : b.cierra;
      const correct = correctOf(b);
      rows.push(`${b.id},${b.id.startsWith("L")?"izquierda":"derecha"},${bellows},${noteLat},${correct},${g},${g===correct?"correcto":"incorrecto"}`);
    });
    return rows.join("\n");
  };

  const descargarCSV = ()=>{
    const blob = new Blob([buildCSV()], {type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `ejercicio_bandoneon_${bellows}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const copiarResumen = ()=>{
    const texto = `🎵 Ejercicio bandoneón — fuelle ${bellows==="abre"?"ABRIENDO":"CERRANDO"}\n`+
      `Pintados: ${painted.length}/${allButtons.length} · Correctos: ${correctos.length}/${painted.length||0}\n\n`+
      painted.map(b=>{
        const g = guesses[keyOf(b.id)];
        const correct = correctOf(b);
        const noteLat = bellows==="abre" ? b.abre : b.cierra;
        return `${b.id} (${noteLat}): ${g===correct ? "✅" : "❌ correcto="+correct}`;
      }).join("\n");
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(texto).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
    }
  };

  const pill=(active,v="orange")=>uiPill(active);

  if(!leftBtns.length) return <div style={{color:"#555",padding:20,fontSize:13}}>Cargando...</div>;

  return (
    <div style={{fontFamily:UI_FONT}}>
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>
          🎓 Entrenador — Pintá el teclado
        </h2>
        <p className="text-xs text-gray-500">
          Tocá cada botón y elegí, de memoria, el color que le corresponde. Después tocá "Corregir" para ver qué acertaste.
        </p>
      </div>

      {/* Modo del ejercicio */}
      <div style={{display:"flex",background:"#121212",border:"1.5px solid #2a2a2a",borderRadius:10,padding:3,gap:2,marginBottom:10,width:"fit-content"}}>
        {[["colores","🎨 Pintar colores"],["acordes","🎼 Armar acordes"],["escalas","🎶 Escalas"]].map(([m,l])=>(
          <button key={m} style={{...pill(modo===m),padding:"6px 14px",fontSize:11}} onClick={()=>setModo(m)}>{l}</button>
        ))}
      </div>

      {modo==="escalas" && (
        <div className="rounded-xl mb-3" style={{background:"#121212",border:"1px solid #2a2a2a",padding:"12px 14px"}}>
          <p className="text-xs text-gray-500 mb-3">Elegí una escala: el teclado te sugiere el camino coloreado, nota por nota y con su octava real. Después pasá a <b>Practicar</b> y tocala de memoria; el color aparece cuando acertás. Usá el botón Abre/Cierra de arriba para cambiar el sentido del fuelle.</p>
          <p style={uiLabel}>Tónica</p>
          <div className="flex flex-wrap gap-1.5 mb-3 mt-2">{ACORDE_RAICES.map(x=>(<button key={x} style={uiPill(escRoot===x)} onClick={()=>{setEscRoot(x);setEscStart(-1);}}>{nombreLat(x)}</button>))}</div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 mb-3">
            <div><p style={uiLabel}>Escala</p><div className="flex flex-wrap gap-1.5 mt-2">{ESC_ENT.map(e=>(<button key={e.id} style={uiPill(escTipo===e.id)} onClick={()=>setEscTipo(e.id)}>{e.nombre}</button>))}</div></div>
            <div><p style={uiLabel}>Mano</p><div className="flex gap-1.5 mt-2">{[["der","Derecha"],["izq","Izquierda"]].map(([v,l])=>(<button key={v} style={uiPill(escMano===v)} onClick={()=>{setEscMano(v);setEscStart(-1);}}>{l}</button>))}</div></div>
            <div><p style={uiLabel}>Sentido</p><div className="flex gap-1.5 mt-2">{[["sube","↑ Sube"],["baja","↓ Baja"]].map(([v,l])=>(<button key={v} style={uiPill(escDir===v)} onClick={()=>{setEscDir(v);setEscStart(-1);}}>{l}</button>))}</div></div>
          </div>
          {escR.tonics.length>1 && (<><p style={uiLabel}>Empezar en</p>
            <div className="flex flex-wrap gap-1.5 mb-3 mt-2">{escR.tonics.map((t,i)=>(<button key={t.midi} style={uiPill(escR.startUsed===i)} onClick={()=>setEscStart(i)}>{etiqueta(t)}</button>))}</div></>)}
          <div className="flex flex-wrap gap-2 items-center mb-3">
            {[["ver","👁 Ver la escala"],["practica","✋ Practicar"]].map(([v,l])=>(<button key={v} style={uiPill(escModo===v,{padding:"7px 16px"})} onClick={()=>setEscModo(v)}>{l}</button>))}
            <button style={uiPill(false)} onClick={escEscuchar}>▶ Escuchar</button>
            {escModo==="practica" && <button style={uiPill(prog.hint)} onClick={()=>setProg(p=>({...p,hint:!p.hint}))}>💡 Pista</button>}
          </div>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <span style={uiLabel}>Función</span>
            <button style={uiPill(romano)} onClick={()=>setRomano(true)}>I · II · III</button>
            <button style={uiPill(!romano)} onClick={()=>setRomano(false)}>1 · 2 · 3</button>
          </div>
          {/* fila coloreada sugerida */}
          <div style={{display:"flex",gap:6}}>
            {escR.route.map((r,i)=>{ const col=nc(CHROMATIC[r.item.pc]); const hecho = escModo==="ver" || i<prog.i; return(
              <div key={i} style={{flex:"1 1 0",minWidth:0,borderRadius:10,padding:"7px 2px",textAlign:"center",cursor:"default",background:hecho?col:"#161616",border:`2px solid ${hecho?"rgba(255,255,255,.35)":"#2a2a2a"}`,color:hecho?txtSobre(col):"#555",transition:"background .2s"}}>
                <div style={{fontSize:10,fontWeight:800,fontFamily:"monospace",opacity:.85}}>{gradoTxt(r,i)}</div>
                <div style={{fontSize:13,fontWeight:900,fontFamily:"serif"}}>{hecho?etiqueta(r.item):"?"}</div>
                <div style={{marginTop:3,minHeight:16,fontSize:11,fontWeight:900,fontFamily:"monospace",opacity:.9}}>{verDedo(i)?(dedos[i]?("☝"+dedos[i]):"·"):""}</div>
              </div>);})}
          </div>
          <p style={{fontSize:11,color:"#8a8a8a",margin:"8px 0 0"}}>
            {dedos.some(x=>x) ? "Dedos sugeridos (☝): 1 índice · 2 medio · 3 anular · 4 meñique. Con \"1/2\" podés usar cualquiera de los dos. Tocá una tecla para ver su octava y su dedo."
              : "Tocá una tecla del camino para ver su octava y su función. Los dedos aparecen cuando el ejercicio viene de una tarea de tu profesor."}
          </p>
          {escR.missing.length>0 && <p style={{fontSize:11.5,color:"#c9a25a",margin:"10px 0 0"}}>⚠ Con este fuelle y esta mano no hay {escR.missing.length>1?"notas":"una nota"} más arriba/abajo ({escR.missing.map(pc=>escDeletreo[pc]||CROM_SIMPLE[CHROMATIC[pc]]).join(", ")}). Probá el otro sentido del fuelle, la otra mano u otra octava de inicio.</p>}
          {escModo==="practica" && (
            <p style={{fontSize:13,margin:"10px 0 0",color:prog.i>=escR.route.length&&escR.route.length?"#6b9c7c":"#cfcfcf"}}>
              {prog.i>=escR.route.length&&escR.route.length ? `¡Escala completa! Errores: ${prog.err}` : `Tocá la nota ${prog.i+1} de ${escR.route.length}${prog.err?` · errores: ${prog.err}`:""}`}
            </p>)}
        </div>
      )}

      {modo==="acordes" && (
        <>
          <p className="text-xs text-gray-500 mb-2">
            Armá el acorde (fundamental, tipo, séptima, extensiones) y marcá en los teclados los botones que lo forman, con una mano o con las dos. Después tocá "Corregir". Podés ir sumando notas al acorde y seguir marcando.
          </p>
          <ArmadorAcordes a={acorde} collapsible={false}/>
        </>
      )}

      {/* Controles */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
        <div style={{display:"flex",background:"#121212",border:"1.5px solid #2a2a2a",borderRadius:10,padding:3,gap:2}}>
          {[["abre","▷ Abre"],["cierra","◁ Cierra"]].map(([b,l])=>(
            <button key={b} style={pill(bellows===b)} onClick={()=>setBellows(b)}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",background:"#121212",border:"1.5px solid #333333",borderRadius:10,padding:3,gap:2}}>
          {[["ambas","Ambas"],["izquierda","IZQ"],["derecha","DER"]].map(([v,l])=>(
            <button key={v} style={pill(view===v,"blue")} onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
        <ControlesDisposicion d={disp} isMobile={isMobile}/>
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          {modo==="acordes" && (
            <button onClick={()=>setReveal(r=>!r)} style={{padding:"6px 12px",borderRadius:9,border:"1px solid #e6e6e6",background:reveal?"#e6e6e6":"transparent",color:reveal?"#0a0a0a":"#e6e6e6",fontWeight:700,fontSize:10,cursor:"pointer"}}>
              👁 {reveal?"Ocultar respuesta":"Ver respuesta"}
            </button>
          )}
          {modo!=="escalas" && <button onClick={()=>setChecked(true)} style={{padding:"6px 14px",borderRadius:9,border:"none",background:"#e6e6e6",color:"#0a0a0a",fontWeight:800,fontSize:11,cursor:"pointer"}}>
            ✓ Corregir
          </button>}
          <button onClick={reiniciarFuelle} style={{padding:"6px 12px",borderRadius:9,border:"1px solid #2a2a2a",background:"transparent",color:"#8a8a8a",fontSize:10,cursor:"pointer"}}>
            ⟳ Reiniciar
          </button>
        </div>
      </div>

      {/* Marcador */}
      <div style={{marginBottom:10,padding:"8px 12px",background:"#121212",border:"1px solid #333333",borderRadius:10,display:"flex",gap:16,flexWrap:"wrap",fontSize:11}}>
        {modo==="escalas" ? (
          <>
            <span style={{color:"#8a8a8a"}}>Escala: <b style={{color:"#e6e6e6"}}>{nombreLat(escRoot)} {escDef.nombre.toLowerCase()}</b></span>
            <span style={{color:"#8a8a8a"}}>Fuelle: <b style={{color:"#e6e6e6"}}>{bellows==="abre"?"abriendo":"cerrando"}</b></span>
            {escModo==="practica" && <span style={{color:"#8a8a8a"}}>Progreso: <b style={{color:"#e6e6e6"}}>{Math.min(prog.i,escR.route.length)}/{escR.route.length}</b> · errores <b style={{color:prog.err?"#d98f88":"#e6e6e6"}}>{prog.err}</b></span>}
          </>
        ) : modo==="colores" ? (
          <>
            <span style={{color:"#8a8a8a"}}>Pintados: <b style={{color:"#e6e6e6"}}>{painted.length}/{allButtons.length}</b></span>
            {checked && <span style={{color:"#8a8a8a"}}>Correctos: <b style={{color:"#e6e6e6"}}>{correctos.length}/{painted.length}</b></span>}
          </>
        ) : (
          <>
            <span style={{color:"#8a8a8a"}}>Marcados: <b style={{color:"#e6e6e6"}}>{selected.length}</b></span>
            {checked && <span style={{color:"#8a8a8a"}}>Notas del acorde cubiertas: <b style={{color:"#e6e6e6"}}>{acorde.tones.length-faltanTones.length}/{acorde.tones.length}</b></span>}
            {checked && <span style={{color:"#8a8a8a"}}>Botones que no son del acorde: <b style={{color:selBad.length?"#d98f88":"#e6e6e6"}}>{selBad.length}</b></span>}
            {checked && faltanTones.length>0 && <span style={{color:"#8a8a8a"}}>Faltan: <b style={{color:"#e6e6e6"}}>{faltanTones.map(tn=>tn.nombre).join(", ")}</b></span>}
          </>
        )}
      </div>

      {/* Teclados */}
      <div ref={wrapRef} style={{display:"flex",flexDirection:an.fila?"row":"column",gap:an.gap,alignItems:an.fila?"flex-start":"stretch",paddingBottom:8}}>
        {(view==="ambas"||view==="izquierda")&&(
          <div style={{width: an.fila ? an.aL : "100%", flexShrink:0}}>
            <p style={{fontSize:11,color:"#8a8a8a",marginBottom:6,letterSpacing:"0.12em"}}>MANO IZQUIERDA · {leftBtns.length} botones</p>
            <PaintCanvas buttons={leftBtns} guesses={guesses} keyOf={keyOf} checked={checked} correctOf={correctOf} onTapButton={tapBtn} maxWidth={an.aL} maxScale={3.6} activeId={modo==="escalas" ? info?.btn.id : picker?.btn.id} chord={chordProps} escala={scaleProps} rotulo={modo==="colores"?notaOct:null}/>
          </div>
        )}
        {(view==="ambas"||view==="derecha")&&(
          <div style={{width: an.fila ? an.aR : "100%", flexShrink:0}}>
            <p style={{fontSize:11,color:"#8a8a8a",marginBottom:6,letterSpacing:"0.12em"}}>MANO DERECHA · {rightBtns.length} botones</p>
            <PaintCanvas buttons={rightBtns} guesses={guesses} keyOf={keyOf} checked={checked} correctOf={correctOf} onTapButton={tapBtn} maxWidth={an.aR} maxScale={3.6} activeId={modo==="escalas" ? info?.btn.id : picker?.btn.id} chord={chordProps} escala={scaleProps} rotulo={modo==="colores"?notaOct:null}/>
          </div>
        )}
      </div>

      {/* Enviar para revisión */}
      {modo==="colores" && <div style={{marginTop:14,padding:"10px 14px",background:"#121212",border:"1px solid #2a2a2a",borderRadius:10}}>
        <p style={{fontSize:10,color:"#8a8a8a",marginBottom:8,fontWeight:700}}>📤 MANDAR PARA REVISIÓN</p>
        <p style={{fontSize:10,color:"#555",marginBottom:10,lineHeight:1.5}}>
          La app todavía no tiene un servidor donde juntar esto automáticamente. Por ahora: descargá el CSV o copiá el resumen y mandámelo por WhatsApp o mail.
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={descargarCSV} disabled={!painted.length} style={{padding:"7px 14px",borderRadius:9,border:"1px solid #e6e6e644",background:"transparent",color:"#e6e6e6",fontWeight:700,fontSize:11,cursor:"pointer",opacity:painted.length?1:0.4}}>
            ↓ Descargar CSV
          </button>
          <button onClick={copiarResumen} disabled={!painted.length} style={{padding:"7px 14px",borderRadius:9,border:"1px solid #e6e6e6",background:"#1a1a1a",color:"#e6e6e6",fontWeight:700,fontSize:11,cursor:"pointer",opacity:painted.length?1:0.4}}>
            {copied?"✓ Copiado":"⧉ Copiar resumen"}
          </button>
        </div>
      </div>}

      {modo==="escalas" && info && (()=>{
        const it=itemDe(info.btn), ri=escIdxById[info.btn.id], col=nc(CHROMATIC[it.pc]);
        const fn = ri!==undefined ? gradoTxt(escR.route[ri],ri) : funcionDe(it.pc);
        const ded = ri!==undefined ? (dedos[ri]||"") : "";
        return (
          <PopoverAnclado rect={info.rect} onClose={()=>setInfo(null)} width={262} estimado={190}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:col,border:"2px solid rgba(255,255,255,.4)",flexShrink:0}}/>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:"'Libre Baskerville',serif",fontWeight:700,fontSize:20,lineHeight:1.1}}>{etiqueta(it)}</div>
                <div style={{fontSize:11,color:"#8a8a8a"}}>Tecla {info.btn.id} · {bellows==="abre"?"abriendo":"cerrando"}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:14,fontSize:12.5,marginBottom:ri!==undefined?10:4}}>
              <span><span style={{color:"#8a8a8a"}}>Octava </span><b>{it.oct}</b></span>
              <span><span style={{color:"#8a8a8a"}}>Función </span><b>{fn||"fuera de la escala"}</b></span>
            </div>
            {ri!==undefined ? (
              <div style={{fontSize:13}}>{ded ? <>Dedo sugerido: <b>{ded.includes("/")?("uno de estos: "+nomDedo(ded)):(ded+" · "+nomDedo(ded))}</b></> : <span style={{color:"#8a8a8a"}}>Sin dedo indicado para esta nota.</span>}</div>
            ) : (
              <div style={{fontSize:11.5,color:"#8a8a8a"}}>Esta tecla no está en el camino sugerido.</div>
            )}
            <div style={{display:"flex",gap:6,marginTop:10}}>
              <button style={uiPill(false,{flex:1})} onClick={()=>tocarItem(it)}>▶ Escuchar</button>
              <button style={uiPill(false,{flex:1})} onClick={()=>setInfo(null)}>Cerrar</button>
            </div>
          </PopoverAnclado>
        );
      })()}

      {modo==="colores" && picker&&<HojaDeColor rect={picker.rect} actual={guesses[keyOf(picker.btn.id)]} onPick={pickColor} onErase={erase} onClose={closePicker}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── CÍRCULO DE QUINTAS INTERACTIVO ──────────────────────────────────────────
// Tres anillos (mayores · menores relativas · disminuidos) que giran. Arriba
// siempre queda la "armadura" elegida; el anillo de puntos muestra las notas
// de la escala con su grado y los acordes diatónicos se iluminan con su cifrado.
// ═══════════════════════════════════════════════════════════════════════════
const CQ_MAJ = ["C","G","D","A","E","B","F#","Db","Ab","Eb","Bb","F"];
const CQ_MIN = ["A","E","B","F#","C#","G#","D#","Bb","F","C","G","D"];
const CQ_ESC = [
  {id:"mayor",  nombre:"Mayor",           ivs:[0,2,4,5,7,9,11], off:0,  deg:0, fam:"may"},
  {id:"menor",  nombre:"Menor natural",   ivs:[0,2,3,5,7,8,10], off:9,  deg:5, fam:"men"},
  {id:"menorA", nombre:"Menor armónica",  ivs:[0,2,3,5,7,8,11], off:9,  deg:5, fam:"men"},
  {id:"menorM", nombre:"Menor melódica",  ivs:[0,2,3,5,7,9,11], off:9,  deg:5, fam:"men"},
  {id:"dorico", nombre:"Dórico",          ivs:[0,2,3,5,7,9,10], off:2,  deg:1, fam:"mod"},
  {id:"frigio", nombre:"Frigio",          ivs:[0,1,3,5,7,8,10], off:4,  deg:2, fam:"mod"},
  {id:"lidio",  nombre:"Lidio",           ivs:[0,2,4,6,7,9,11], off:5,  deg:3, fam:"mod"},
  {id:"mixo",   nombre:"Mixolidio",       ivs:[0,2,4,5,7,9,10], off:7,  deg:4, fam:"mod"},
  {id:"locrio", nombre:"Locrio",          ivs:[0,1,3,5,6,8,10], off:11, deg:6, fam:"mod"},
  {id:"pentaM", nombre:"Pent. mayor",     ivs:[0,2,4,7,9],      off:0,  deg:0, fam:"pen"},
  {id:"pentam", nombre:"Pent. menor",     ivs:[0,3,5,7,10],     off:9,  deg:5, fam:"pen"},
];
const CQ_MAJ_IV = [0,2,4,5,7,9,11];
const CQ_NUM = ["I","II","III","IV","V","VI","VII"];
const cqPcOfPos = p => (p*7)%12;
const cqPosOfPc = pc => (((pc%12)+12)%12*7)%12;
const cqAcc = n => String(n).replace(/^([A-G])(##|#|bb|b)/, (m,l,a)=>l+({"#":"♯","##":"𝄪","b":"♭","bb":"♭♭"}[a]));
const cqPol = (cx,cy,r,deg)=>{ const a=deg*Math.PI/180; return [cx+r*Math.sin(a), cy-r*Math.cos(a)]; };
const cqSector = (cx,cy,r0,r1,a0,a1)=>{
  const [x0,y0]=cqPol(cx,cy,r1,a0), [x1,y1]=cqPol(cx,cy,r1,a1), [x2,y2]=cqPol(cx,cy,r0,a1), [x3,y3]=cqPol(cx,cy,r0,a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`;
};

function cqChords(notes, ivs){
  if(ivs.length!==7) return [];
  return ivs.map((iv,i)=>{
    const r=notes[i];
    const i3=(ivs[(i+2)%7]-iv+12)%12, i5=(ivs[(i+4)%7]-iv+12)%12, i7=(ivs[(i+6)%7]-iv+12)%12;
    let tri="?", ts="", sev="7";
    if(i3===4&&i5===7){tri="maj";ts="";   sev=i7===11?"△7":"7";}
    else if(i3===3&&i5===7){tri="min";ts="m"; sev=i7===11?"m△7":"m7";}
    else if(i3===3&&i5===6){tri="dim";ts="°"; sev=i7===9?"°7":"ø7";}
    else if(i3===4&&i5===8){tri="aug";ts="+"; sev=i7===11?"+△7":"+7";}
    const d=iv-CQ_MAJ_IV[i]; const pre=d<0?"♭":d>0?"♯":"";
    let num=CQ_NUM[i]; if(tri==="min"||tri==="dim") num=num.toLowerCase();
    return {root:r,rootPc:noteIdx(r),tri,ts,sev,roman:pre+num+(tri==="dim"?"°":tri==="aug"?"+":""),i3,i5,i7,deg:i};
  });
}
const cqPlay = (root, ivs, dur=1.3)=>{
  const r=noteIdx(root); ivs.forEach((iv,k)=>{ const a=r+iv; setTimeout(()=>playTone(CHROMATIC[a%12],3+Math.floor(a/12),dur),k*18); });
};

function CirculoQuintas(){
  const [pos,setPos]     = useState(0);        // posición de la armadura que queda arriba
  const [escId,setEscId] = useState("mayor");
  const [enh6,setEnh6]   = useState(false);   // false: F♯ / D♯   true: G♭ / E♭
  const [solfeo,setSolfeo] = useState(false);
  const [rot,setRot]     = useState(0);
  const [dragging,setDragging] = useState(false);
  const [playing,setPlaying]   = useState(-1);
  const svgRef=useRef(null), moved=useRef(false), timers=useRef([]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);

  const esc = CQ_ESC.find(e=>e.id===escId);
  const majName = p => p===6 ? (enh6?"Gb":"F#") : CQ_MAJ[p];
  const minName = p => p===6 ? (enh6?"Eb":"D#") : CQ_MIN[p];
  const dimName = p => spell(majName(p),11,6);
  const lbl = n => solfeo ? nombreLat(n) : cqAcc(n);
  const lblChord = (root,sym) => lbl(root)+sym;

  const parentName = majName(pos);
  const tonic = spell(parentName, esc.off, esc.deg);
  const notes = buildScale(tonic, esc.ivs);
  const chords = cqChords(notes, esc.ivs);
  const notePcs = notes.map(noteIdx);
  const posSet = new Set(notePcs.map(cqPosOfPc));

  // ¿las notas ocupan posiciones consecutivas? → se dibuja la "ventana"
  let ventana=null;
  for(let st=0;st<12 && !ventana;st++){
    const run=[...Array(posSet.size)].map((_,k)=>(st+k)%12);
    if(run.every(x=>posSet.has(x))) ventana={start:st,len:posSet.size};
  }

  // armadura
  const sharps = pos<=6 && !(pos===6&&enh6);
  const nAcc = sharps ? pos : (pos===6 ? 6 : 12-pos);
  const ORD_S=["F","C","G","D","A","E","B"], ORD_B=["B","E","A","D","G","C","F"];
  const accList = (sharps?ORD_S.slice(0,nAcc).map(n=>n+"#"):ORD_B.slice(0,nAcc).map(n=>n+"b"));
  const sigTxt = nAcc===0 ? "sin alteraciones" : `${nAcc}${sharps?"♯":"♭"}  (${accList.map(lbl).join(" ")})`;

  // ── giro ──
  const goTo=(np,ne=escId)=>{
    setPos(np); setEscId(ne);
    setRot(r=>{ const cur=((r%360)+360)%360, target=(360-np*30)%360; let d=target-cur; if(d>180)d-=360; if(d<-180)d+=360; return r+d; });
  };
  const mover=(dp)=>goTo(((pos+dp)%12+12)%12);
  const cambiarEsc=(id)=>{ // conserva la tónica y gira hasta su nueva armadura
    const ne=CQ_ESC.find(e=>e.id===id);
    const pc=noteIdx(tonic);
    goTo(cqPosOfPc(pc-ne.off), id);
  };
  const onDown=(e)=>{
    if(e.button!==undefined && e.button!==0) return;
    const rect=svgRef.current.getBoundingClientRect();
    const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
    const ang=ev=>Math.atan2(ev.clientX-cx, -(ev.clientY-cy))*180/Math.PI;
    const a0=ang(e), r0=rot, sx=e.clientX, sy=e.clientY;
    moved.current=false; let live=r0;
    const mv=(ev)=>{
      if(!moved.current && Math.hypot(ev.clientX-sx,ev.clientY-sy)<6) return;
      moved.current=true; setDragging(true);
      let d=ang(ev)-a0; if(d>180)d-=360; if(d<-180)d+=360;
      live=r0+d; setRot(live);
    };
    const up=()=>{
      window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); window.removeEventListener("pointercancel",up);
      if(!moved.current) return;
      const snapped=Math.round(live/30)*30;
      const np=(((-Math.round(live/30))%12)+12)%12;
      setDragging(false); setRot(snapped); setPos(np);
    };
    window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); window.addEventListener("pointercancel",up);
  };
  const clickSeg=(p,ring)=>{
    if(moved.current) return;
    if(ring==="maj"){ const ne="mayor";  goTo(p,ne); playTone(majName(p),4,0.5); }
    if(ring==="min"){ goTo(p,"menor");   playTone(minName(p),4,0.5); }
    if(ring==="dim"){ goTo(p,"locrio");  playTone(dimName(p),4,0.5); }
  };

  const tocarEscala=()=>{
    timers.current.forEach(clearTimeout); timers.current=[];
    const seq=[...esc.ivs,12]; const r=noteIdx(tonic);
    seq.forEach((iv,i)=>{ timers.current.push(setTimeout(()=>{ const a=r+iv; playTone(CHROMATIC[a%12],4+Math.floor(a/12),0.6); setPlaying(i<esc.ivs.length?i:0); },i*420)); });
    timers.current.push(setTimeout(()=>setPlaying(-1),seq.length*420+300));
  };
  const cadencia=(lista)=>{ lista.forEach((c,i)=>setTimeout(()=>cqPlay(c.root,c.ivs,1.6),i*1100)); };

  // acordes diatónicos → anillo/posición
  const chordAt = {maj:{},min:{},dim:{}};
  chords.forEach(c=>{
    if(c.tri==="maj") chordAt.maj[cqPosOfPc(c.rootPc)]=c;
    if(c.tri==="min") chordAt.min[cqPosOfPc(c.rootPc+3)]=c;
    if(c.tri==="dim") chordAt.dim[cqPosOfPc(c.rootPc+1)]=c;
  });

  // relaciones
  const nameOf=(p,e)=>{ const ee=CQ_ESC.find(x=>x.id===e); return spell(majName(p),ee.off,ee.deg); };
  const rels=[];
  if(esc.id==="mayor") rels.push({t:"Relativa menor",   n:lbl(nameOf(pos,"menor"))+" menor",  go:()=>goTo(pos,"menor")});
  else if(esc.fam==="men") rels.push({t:"Relativa mayor", n:lbl(nameOf(pos,"mayor"))+" mayor",  go:()=>goTo(pos,"mayor")});
  else rels.push({t:"Tonalidad madre", n:lbl(parentName)+" mayor", go:()=>goTo(pos,"mayor")});
  if(esc.id==="mayor"||esc.fam==="men"){
    const par = esc.id==="mayor" ? "menor" : "mayor";
    const ne=CQ_ESC.find(x=>x.id===par);
    rels.push({t:esc.id==="mayor"?"Paralela menor":"Paralela mayor", n:lbl(tonic)+(esc.id==="mayor"?" menor":" mayor"), go:()=>goTo(cqPosOfPc(noteIdx(tonic)-ne.off),par)});
  }
  rels.push({t:"Dominante (V)",     n:lbl(nameOf((pos+1)%12,esc.id))+" "+esc.nombre.toLowerCase(),  go:()=>mover(1)});
  rels.push({t:"Subdominante (IV)", n:lbl(nameOf((pos+11)%12,esc.id))+" "+esc.nombre.toLowerCase(), go:()=>mover(-1)});

  // cadencia ii–V–I y dominantes secundarios (mayor / menor natural)
  let cad=null, sec=[];
  if(esc.id==="mayor"||esc.id==="menor"){
    const m=esc.id==="mayor";
    cad=[
      {root:notes[1], ivs:m?[0,3,7,10]:[0,3,6,10], nombre:lblChord(notes[1], m?"m7":"ø7")},
      {root:notes[4], ivs:[0,4,7,10],               nombre:lblChord(notes[4],"7")},
      {root:notes[0], ivs:m?[0,4,7,11]:[0,3,7,10], nombre:lblChord(notes[0], m?"△7":"m7")},
    ];
    chords.forEach((c,i)=>{
      if(i===0||(c.tri!=="maj"&&c.tri!=="min")) return;
      const dom=spell(c.root,7,4);
      sec.push({label:`V7/${c.roman}`, nombre:lblChord(dom,"7"), root:dom, ivs:[0,4,7,10]});
    });
  }

  // ── geometría ──
  const CX=290, CY=290, RO=[230,172], RM=[172,124], RI=[124,90], RB=[236,266], RD=251;
  const rotStyle=(x,y)=>({transform:`rotate(${-rot}deg)`,transformOrigin:`${x}px ${y}px`,transition:dragging?"none":"transform .7s cubic-bezier(.3,.9,.3,1)",pointerEvents:"none"});
  const UI={line:"#2a2a2e",mute:"#8a8a90",text:"#ececec"};

  const segs=(ring,r,nombre,subtxt)=>[...Array(12)].map((_,p)=>{
    const a0=p*30-14.2, a1=p*30+14.2;
    const pc = ring==="maj"?cqPcOfPos(p):ring==="min"?(cqPcOfPos(p)+9)%12:(cqPcOfPos(p)+11)%12;
    const ch = chordAt[ring][p];
    const col = nc(CHROMATIC[pc]);
    const esTonica = ch && ch.deg===0;
    const [x,y]=cqPol(CX,CY,(r[0]+r[1])/2,p*30);
    const fs = ring==="maj"?21:ring==="min"?16:13;
    return(
      <g key={ring+p}>
        <path d={cqSector(CX,CY,r[0],r[1],a0,a1)} onClick={()=>clickSeg(p,ring)} style={{cursor:"pointer",transition:"fill .3s, stroke .3s"}}
          fill={ch?col:"#141416"} fillOpacity={ch?0.88:1} stroke={esTonica?"#ffffff":ch?"#ffffffaa":UI.line} strokeWidth={esTonica?3:ch?1.5:1}/>
        <g style={rotStyle(x,y)}>
          <text x={x} y={ch?y-2:y+(ring==="maj"?-1:4)} textAnchor="middle" dominantBaseline="middle"
            style={{fontFamily:"'Libre Baskerville',serif",fontWeight:700,fontSize:fs,fill:ch?txtSobre(col):"#9a9aa0"}}>{nombre(p)}</text>
          {ch ? (
            <text x={x} y={y+(ring==="maj"?17:14)} textAnchor="middle" dominantBaseline="middle"
              style={{fontFamily:UI_FONT,fontWeight:800,fontSize:ring==="dim"?10:12,fill:txtSobre(col),opacity:.95}}>{ch.roman}</text>
          ) : subtxt ? (
            <text x={x} y={y+16} textAnchor="middle" dominantBaseline="middle" style={{fontFamily:UI_FONT,fontWeight:600,fontSize:10.5,fill:"#5c5c62"}}>{subtxt(p)}</text>
          ) : null}
        </g>
      </g>
    );
  });
  const sigDe=(p)=> p===0?"0" : p<6?`${p}♯` : p===6?(enh6?"6♭":"6♯") : `${12-p}♭`;

  const pill=(on)=>uiPill(on);
  return(
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>Círculo de Quintas</h2>
        <p className="text-xs text-gray-500">Girá la rueda arrastrándola, tocá una tonalidad o usá las flechas. Elegí la escala y el círculo se reordena solo.</p>
      </div>

      {/* Escalas */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CQ_ESC.map(e=>(<button key={e.id} style={pill(e.id===escId)} onClick={()=>cambiarEsc(e.id)}>{e.nombre}</button>))}
      </div>

      {/* Rueda */}
      <div style={{position:"relative",maxWidth:560,margin:"0 auto"}}>
        <svg ref={svgRef} viewBox="0 0 580 580" width="100%" onPointerDown={onDown}
          style={{display:"block",touchAction:"pan-y",userSelect:"none",WebkitUserSelect:"none",cursor:dragging?"grabbing":"grab"}}>
          {/* marcador fijo */}
          <polygon points="290,20 281,4 299,4" fill="#ececec"/>
          <g style={{transform:`rotate(${rot}deg)`,transformOrigin:`${CX}px ${CY}px`,transition:dragging?"none":"transform .7s cubic-bezier(.3,.9,.3,1)"}}>
            {/* ventana de notas */}
            {ventana && <path d={cqSector(CX,CY,RB[0],RB[1],ventana.start*30-15,(ventana.start+ventana.len-1)*30+15)} fill="#ffffff" fillOpacity=".07" stroke="#ffffff" strokeOpacity=".28" strokeWidth="1"/>}
            {/* anillos */}
            {segs("maj",RO,p=>lbl(majName(p)),sigDe)}
            {segs("min",RM,p=>lbl(minName(p))+"m",null)}
            {segs("dim",RI,p=>lbl(dimName(p))+"°",null)}
            {/* puntos de notas (grado) */}
            {[...Array(12)].map((_,p)=>{
              const pc=cqPcOfPos(p); const idx=notePcs.indexOf(pc); const [x,y]=cqPol(CX,CY,RD,p*30);
              if(idx<0) return <circle key={"d"+p} cx={x} cy={y} r={2.5} fill="#3a3a40"/>;
              const col=nc(CHROMATIC[pc]); const on=playing===idx;
              return(
                <g key={"d"+p}>
                  <circle cx={x} cy={y} r={on?16:13} fill={col} stroke="#fff" strokeWidth={idx===0?3:1.2} style={{transition:"r .12s"}}/>
                  <g style={rotStyle(x,y)}>
                    <text x={x} y={y+0.5} textAnchor="middle" dominantBaseline="middle" style={{fontFamily:UI_FONT,fontWeight:800,fontSize:idx<=9?11:10,fill:txtSobre(col)}}>{GRADO_LABEL[esc.ivs[idx]]}</text>
                  </g>
                </g>
              );
            })}
          </g>
          {/* centro fijo */}
          <circle cx={CX} cy={CY} r={84} fill="#0e0e10" stroke="#2a2a2e" strokeWidth="1.5"/>
          <text x={CX} y={CY-16} textAnchor="middle" dominantBaseline="middle" style={{fontFamily:"'Libre Baskerville',serif",fontWeight:700,fontSize:38,fill:"#ececec"}}>{lbl(tonic)}</text>
          <text x={CX} y={CY+18} textAnchor="middle" dominantBaseline="middle" style={{fontFamily:UI_FONT,fontWeight:600,fontSize:13,fill:"#b4b4ba"}}>{esc.nombre}</text>
          <text x={CX} y={CY+38} textAnchor="middle" dominantBaseline="middle" style={{fontFamily:UI_FONT,fontSize:11,fill:"#707076"}}>{nAcc===0?"sin alteraciones":`${nAcc}${sharps?"♯":"♭"}`}</text>
        </svg>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3 mb-5">
        <button style={pill(false)} onClick={()=>mover(-1)}>◀ Subdominante</button>
        <button style={pill(false)} onClick={()=>mover(1)}>Dominante ▶</button>
        <button style={pill(solfeo)} onClick={()=>setSolfeo(s=>!s)}>{solfeo?"Do Re Mi":"A B C"}</button>
        <button style={pill(enh6)} onClick={()=>setEnh6(s=>!s)} title="Escritura de la tonalidad de 6 alteraciones">{enh6?"G♭ / E♭":"F♯ / D♯"}</button>
        <button style={{...pill(false),borderColor:"#ececec",color:"#ececec"}} onClick={tocarEscala}>▶ Tocar escala</button>
      </div>

      {/* Escala */}
      <div className="rounded-xl p-4 mb-3" style={{background:"#121214",border:"1px solid #26262a"}}>
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <p style={uiLabel}>Escala de {lbl(tonic)} {esc.nombre.toLowerCase()}</p>
          <p style={{fontFamily:UI_FONT,fontSize:11,color:UI.mute}}>Armadura: {sigTxt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {notes.map((n,i)=>{
            const col=nc(n); const on=playing===i;
            return(
              <button key={i} onClick={()=>playTone(n,4,0.6)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:50,padding:"8px 8px 6px",borderRadius:11,cursor:"pointer",
                  background:col,color:txtSobre(col),border:`2px solid ${on?"#fff":"rgba(255,255,255,.2)"}`,transform:on?"translateY(-4px)":"none"}}>
                <span style={{fontFamily:"'Libre Baskerville',serif",fontWeight:700,fontSize:15}}>{lbl(n)}</span>
                <span style={{fontFamily:UI_FONT,fontSize:10,fontWeight:700,opacity:.8}}>{GRADO_LABEL[esc.ivs[i]]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Acordes diatónicos */}
      {chords.length>0 && (
        <div className="rounded-xl p-4 mb-3" style={{background:"#121214",border:"1px solid #26262a"}}>
          <p style={{...uiLabel,marginBottom:10}}>Acordes diatónicos · tocá para oírlos</p>
          <div className="overflow-x-auto">
            <table style={{borderCollapse:"collapse",width:"100%",fontFamily:UI_FONT,fontSize:13}}>
              <thead><tr style={{color:UI.mute,fontSize:10,letterSpacing:"0.14em",textTransform:"uppercase"}}>
                <th style={{textAlign:"left",padding:"4px 8px",fontWeight:600}}>Grado</th>
                <th style={{textAlign:"left",padding:"4px 8px",fontWeight:600}}>Tríada</th>
                <th style={{textAlign:"left",padding:"4px 8px",fontWeight:600}}>Cuatríada</th>
              </tr></thead>
              <tbody>
                {chords.map((c,i)=>{
                  const col=nc(CHROMATIC[c.rootPc]);
                  const tIvs=[0,c.i3,c.i5], sIvs=[0,c.i3,c.i5,c.i7];
                  return(
                    <tr key={i} style={{borderTop:"1px solid #1c1c1f"}}>
                      <td style={{padding:"6px 8px",color:"#cfcfd4",fontWeight:700}}>
                        <span style={{display:"inline-block",width:9,height:9,borderRadius:3,background:col,marginRight:8}}/>{c.roman}
                      </td>
                      <td style={{padding:"4px 8px"}}>
                        <button onClick={()=>cqPlay(c.root,tIvs)} style={{...pill(false),padding:"4px 11px",fontFamily:"'Libre Baskerville',serif",fontSize:13}}>{lblChord(c.root,c.ts)}</button>
                      </td>
                      <td style={{padding:"4px 8px"}}>
                        <button onClick={()=>cqPlay(c.root,sIvs)} style={{...pill(false),padding:"4px 11px",fontFamily:"'Libre Baskerville',serif",fontSize:13}}>{lblChord(c.root,c.sev)}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tonalidades relacionadas */}
      <div className="rounded-xl p-4 mb-3" style={{background:"#121214",border:"1px solid #26262a"}}>
        <p style={{...uiLabel,marginBottom:10}}>Tonalidades vecinas · tocá para saltar</p>
        <div className="grid grid-cols-2 gap-2">
          {rels.map((r,i)=>(
            <button key={i} onClick={r.go} style={{textAlign:"left",padding:"9px 12px",borderRadius:10,cursor:"pointer",background:"rgba(255,255,255,.02)",border:"1px solid #2a2a2e",color:"#ececec"}}>
              <span style={{display:"block",fontFamily:UI_FONT,fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:UI.mute,marginBottom:3}}>{r.t}</span>
              <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:14,fontWeight:700}}>{r.n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cadencia y dominantes secundarios */}
      {cad && (
        <div className="rounded-xl p-4" style={{background:"#121214",border:"1px solid #26262a"}}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p style={uiLabel}>Cadencia ii – V – I</p>
            <button style={{...pill(false),borderColor:"#ececec",color:"#ececec"}} onClick={()=>cadencia(cad)}>▶ Escuchar</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {cad.map((c,i)=>(
              <span key={i} style={{padding:"6px 12px",borderRadius:9,background:"rgba(255,255,255,.03)",border:"1px solid #2a2a2e",fontFamily:"'Libre Baskerville',serif",fontSize:14,fontWeight:700,color:"#ececec"}}>{c.nombre}</span>
            ))}
          </div>
          <p style={{...uiLabel,marginBottom:8}}>Dominantes secundarias</p>
          <div className="flex flex-wrap gap-2">
            {sec.map((c,i)=>(
              <button key={i} onClick={()=>cqPlay(c.root,c.ivs)} style={{...pill(false),display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 12px"}}>
                <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:14,fontWeight:700,color:"#ececec"}}>{c.nombre}</span>
                <span style={{fontSize:9.5,letterSpacing:"0.08em",color:UI.mute}}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ORGANIZADOR DE CLASES (solo profesor) y MIS TAREAS (alumnos) ────────────
// Cada ejercicio de escala viaja COMPLETO: camino, octavas, frecuencias y digitación.
// Los datos se publican en "clases.json" junto a index.html.
// ═══════════════════════════════════════════════════════════════════════════
const ORG_KEY = "harmonia_org";
const idn = ()=>Math.random().toString(36).slice(2,8);
const cargarOrg = ()=>{ try{ const j=JSON.parse(localStorage.getItem(ORG_KEY)||"null"); if(j&&Array.isArray(j.clases)) return {alumnos:j.alumnos||[],clases:j.clases,asign:j.asign||{}}; }catch(e){} return {alumnos:[],clases:[],asign:{}}; };
const EJ_NUEVO = {tipo:"escala",root:"C",escala:"mayor",mano:"der",dir:"sube",fuelle:"abre",modoEj:"ver",inicio:-1,dedos:[],ac:ACORDE_INI,texto:"",indic:""};
const inpS = {background:"#0e0e10",border:"1px solid #2a2a2e",borderRadius:9,padding:"7px 10px",color:"#ececec",fontSize:13,fontFamily:UI_FONT,minWidth:0};
const Sel = ({v,set,opts,w})=>(<select style={{...inpS,width:w}} value={v} onChange={e=>set(e.target.value)}>{opts.map(o=>(<option key={String(o[0])} value={o[0]}>{o[1]}</option>))}</select>);
const OPT_MANO=[["der","Mano derecha"],["izq","Mano izquierda"]], OPT_DIR=[["sube","Sube"],["baja","Baja"]], OPT_FUELLE=[["abre","Abriendo"],["cierra","Cerrando"]], OPT_MODO=[["ver","Ver la escala"],["practica","Practicar"]];
const DEDO_OPC=[["","—"],["1","1"],["2","2"],["3","3"],["4","4"],["1/2","1 o 2"],["2/3","2 o 3"],["3/4","3 o 4"]];
const NOM_DEDO_1={1:"índice",2:"medio",3:"anular",4:"meñique"};
const nomDedo = (d)=>String(d).split("/").map(x=>NOM_DEDO_1[x]||x).join(" o ");
const fmtHz = (h)=>h.toFixed(2).replace(".",",");

// Camino completo de una escala sobre el teclado del profesor: función, nota con octava, frecuencia y tecla.
function rutaDeEjercicio(e, btns){
  const esc=ESC_ENT.find(x=>x.id===e.escala)||ESC_ENT[0];
  const ivs=(e.escala==="menorM"&&e.dir==="baja")?ESC_ENT[1].ivs:esc.ivs;
  const root=e.root||"C", rootPc=noteIdx(root), dir=e.dir==="baja"?"baja":"sube";
  const manoBtns=e.mano==="izq"?btns.left:btns.right;
  const r=rutaEscala(manoBtns,e.fuelle==="cierra"?"cierra":"abre",rootPc,ivs,dir,e.inicio===undefined?-1:e.inicio);
  const nom={}; buildScale(root,ivs).forEach(n=>{ nom[noteIdx(n)]=nombreLat(n); });
  const nombreDe=(it)=>(nom[it.pc]||CROM_SIMPLE[CHROMATIC[it.pc]])+it.oct;
  const n=ivs.length;
  const pasos=r.route.map((st,i)=>{
    const esOct=r.route.length===n+1&&(dir!=="baja"?i===n:i===0);
    const it=st.item;
    return {g:esOct?"8":GRADO_LABEL[ivs[st.deg]],pc:it.pc,n:nombreDe(it),hz:Math.round(440*Math.pow(2,(it.midi-69)/12)*100)/100,b:it.b.id};
  });
  return {pasos,inicios:r.tonics.map(nombreDe),faltan:r.missing.map(pc=>nom[pc]||CROM_SIMPLE[CHROMATIC[pc]]),usado:r.startUsed};
}

function descEj(e){
  if(e.tipo==="escala"){
    const esc=ESC_ENT.find(x=>x.id===e.escala)||ESC_ENT[0];
    const nom = esc.id==="crom" ? `Escala cromática desde ${nombreLat(e.root||"C")}` : `Escala de ${nombreLat(e.root||"C")} ${esc.nombre.toLowerCase()}`;
    const desde = e.ruta&&e.ruta[0] ? ` · desde ${e.ruta[0].n}` : "";
    return `${nom}${desde} · ${e.mano==="izq"?"mano izquierda":"mano derecha"} · ${e.dir==="baja"?"baja":"sube"} · ${e.fuelle==="cierra"?"cerrando":"abriendo"}${e.modoEj==="practica"?" · practicar":""}`;
  }
  if(e.tipo==="acorde") return `Acorde ${calcAcorde({...ACORDE_INI,...(e.ac||{})},false).name} · ${e.fuelle==="cierra"?"cerrando":"abriendo"}`;
  return e.texto||"Tarea";
}

function OrganizadorTab({onProbar}){
  const [org,setOrg]=useState(cargarOrg);
  const btns=useMemo(()=>loadBtns(),[]);
  const [romano]=useRomanos();
  const [nuevoAl,setNuevoAl]=useState("");
  const [abierta,setAbierta]=useState(null);
  const [ej,setEj]=useState(EJ_NUEVO);
  const [conf,setConf]=useState(null);
  const [msg,setMsg]=useState("");
  const guardar=(o)=>{ setOrg(o); try{ localStorage.setItem(ORG_KEY,JSON.stringify(o)); }catch(e){} };
  const aviso=(t)=>{ setMsg(t); setTimeout(()=>setMsg(""),3500); };

  const addAlumno=()=>{ const n=nuevoAl.trim();
    if(!/^[A-Za-z0-9._-]{2,30}$/.test(n)) return aviso("Usá el mismo usuario con el que entra el alumno (2 a 30 letras o números, sin espacios).");
    if(org.alumnos.some(a=>a.toLowerCase()===n.toLowerCase())) return aviso("Ese alumno ya está en la lista.");
    guardar({...org,alumnos:[...org.alumnos,n]}); setNuevoAl(""); };
  const delAlumno=(n)=>{ if(conf!=="a"+n){ setConf("a"+n); return; } setConf(null);
    const asign={...org.asign}; delete asign[n]; guardar({...org,alumnos:org.alumnos.filter(a=>a!==n),asign}); };
  const importarUsuarios=async(file)=>{ if(!file) return; try{ const j=JSON.parse(await file.text()); const us=(j.users||[]).map(u=>u.u).filter(Boolean);
      const nuevos=us.filter(u=>!org.alumnos.some(a=>a.toLowerCase()===u.toLowerCase())); guardar({...org,alumnos:[...org.alumnos,...nuevos]}); aviso(`${nuevos.length} alumno(s) agregados.`);
    }catch(e){ aviso("Ese archivo no es un usuarios.json válido."); } };

  const addClase=()=>{ const n=org.clases.length+1; guardar({...org,clases:[...org.clases,{id:idn(),nombre:`Clase ${n}`,titulo:"",ejercicios:[]}]}); };
  const updClase=(id,patch)=>guardar({...org,clases:org.clases.map(c=>c.id===id?{...c,...patch}:c)});
  const moverClase=(id,d)=>{ const a=[...org.clases], i=a.findIndex(c=>c.id===id), j=i+d; if(j<0||j>=a.length) return; [a[i],a[j]]=[a[j],a[i]]; guardar({...org,clases:a}); };
  const delClase=(id)=>{ if(conf!=="c"+id){ setConf("c"+id); return; } setConf(null);
    const asign={}; Object.entries(org.asign).forEach(([u,l])=>{ asign[u]=l.filter(x=>x!==id); });
    guardar({...org,clases:org.clases.filter(c=>c.id!==id),asign}); };

  // ejercicio: formulario, guardado (nuevo o editado) y borrado
  const setP=(patch,reiniciaDedos=true)=>setEj(e=>({...e,...patch,...(reiniciaDedos?{dedos:[]}:{})}));
  const rutaForm = ej.tipo==="escala" ? rutaDeEjercicio(ej,btns) : null;
  const guardarEj=(cid)=>{
    let nuevo={...ej,id:ej.id||idn()};
    if(nuevo.tipo==="texto"&&!nuevo.texto.trim()) return aviso("Escribí la consigna de la tarea.");
    if(nuevo.tipo==="escala"){
      if(!rutaForm||!rutaForm.pasos.length) return aviso("Con este fuelle y esta mano no hay camino para esa escala. Probá otro fuelle, otra mano u otra nota de inicio.");
      nuevo.ruta=rutaForm.pasos.map((p,i)=>({...p,d:(ej.dedos&&ej.dedos[i])||""}));
    }
    const c=org.clases.find(x=>x.id===cid), ya=c.ejercicios.some(x=>x.id===nuevo.id);
    updClase(cid,{ejercicios:ya?c.ejercicios.map(x=>x.id===nuevo.id?nuevo:x):[...c.ejercicios,nuevo]});
    setAbierta(null); setEj(EJ_NUEVO); aviso(ya?"Ejercicio actualizado.":"Ejercicio agregado a la clase."); };
  const editarEj=(cid,e)=>{ setAbierta(cid); setEj({...EJ_NUEVO,...e,dedos:e.ruta?e.ruta.map(p=>p.d||""):[]}); };
  const delEj=(cid,eid)=>updClase(cid,{ejercicios:org.clases.find(c=>c.id===cid).ejercicios.filter(e=>e.id!==eid)});

  // asignación
  const tiene=(u,cid)=>(org.asign[u]||[]).includes(cid);
  const todosAsig=(cid)=>org.alumnos.length>0&&org.alumnos.every(u=>tiene(u,cid));
  const toggle=(u,cid)=>{ const l=org.asign[u]||[]; guardar({...org,asign:{...org.asign,[u]:l.includes(cid)?l.filter(x=>x!==cid):[...l,cid]}}); };
  const toggleTodos=(cid)=>{ const todos=todosAsig(cid); const asign={...org.asign};
    org.alumnos.forEach(u=>{ const l=(asign[u]||[]).filter(x=>x!==cid); asign[u]=todos?l:[...l,cid]; }); guardar({...org,asign}); };

  const descargar=()=>{ const data={version:2,clases:org.clases,asignaciones:org.asign};
    const b=new Blob([JSON.stringify(data,null,1)],{type:"application/json"}), a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="clases.json"; document.body.appendChild(a); a.click(); a.remove(); };
  const cargar=async(file)=>{ if(!file) return; try{ const j=JSON.parse(await file.text()); if(!Array.isArray(j.clases)) throw 0;
      const asign=j.asignaciones||{}; const alumnos=[...new Set([...org.alumnos,...Object.keys(asign)])]; guardar({alumnos,clases:j.clases,asign}); aviso("Clases cargadas."); }catch(e){ aviso("Ese archivo no es un clases.json válido."); } };

  const card={background:"#121212",border:"1px solid #2a2a2a",borderRadius:12,padding:"12px 14px",marginBottom:12};
  const peq={...uiPill(false),padding:"4px 10px",fontSize:11};
  return(
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>Organizador de clases</h2>
        <p className="text-xs text-gray-500">Solo vos ves esta pestaña. Cada ejercicio de escala sale completo para el alumno: notas con su octava, frecuencia y dedos sugeridos.</p>
      </div>

      <div style={{...card,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <button style={uiPill(true)} onClick={descargar}>⬇ Descargar clases.json</button>
        <label style={{...uiPill(false),display:"inline-block"}}>⬆ Cargar clases.json<input type="file" accept=".json,application/json" style={{display:"none"}} onChange={e=>{cargar(e.target.files[0]);e.target.value="";}}/></label>
        <span style={{fontSize:11,color:"#8a8a8a",flex:"1 1 260px"}}>Cuando termines, descargá el archivo y copialo junto a <b>index.html</b> (Netlify: carpeta para-subir · Vercel: carpeta public). Todo se guarda también en este navegador.</span>
        {msg && <span style={{fontSize:12,color:"#c9a25a",width:"100%"}}>{msg}</span>}
      </div>

      {/* 1 · alumnos */}
      <div style={card}>
        <p style={uiLabel}>1 · Alumnos</p>
        <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
          {org.alumnos.length===0 && <span style={{fontSize:12,color:"#8a8a8a"}}>Todavía no cargaste alumnos.</span>}
          {org.alumnos.map(n=>(<span key={n} style={{...uiPill(false),display:"inline-flex",gap:8,alignItems:"center",cursor:"default"}}>{n}
            <button onClick={()=>delAlumno(n)} style={{background:"none",border:"none",color:conf==="a"+n?"#c0615a":"#8a8a8a",cursor:"pointer",fontSize:11,padding:0}}>{conf==="a"+n?"¿Seguro?":"✕"}</button></span>))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input style={{...inpS,flex:"1 1 180px"}} placeholder="usuario del alumno (ej: maria)" value={nuevoAl} onChange={e=>setNuevoAl(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") addAlumno(); }} autoCapitalize="none"/>
          <button style={uiPill(true)} onClick={addAlumno}>Agregar</button>
          <label style={{...uiPill(false),display:"inline-block"}}>Importar de usuarios.json<input type="file" accept=".json,application/json" style={{display:"none"}} onChange={e=>{importarUsuarios(e.target.files[0]);e.target.value="";}}/></label>
        </div>
        <p style={{fontSize:11,color:"#8a8a8a",margin:"8px 0 0"}}>El nombre tiene que ser exactamente el usuario con el que el alumno entra a la página.</p>
      </div>

      {/* 2 · clases */}
      <div style={card}>
        <div className="flex items-center justify-between mb-2"><p style={uiLabel}>2 · Clases, ejercicios y a quién se asignan</p><button style={uiPill(true,{padding:"5px 12px"})} onClick={addClase}>＋ Nueva clase</button></div>
        {org.clases.length===0 && <p style={{fontSize:12,color:"#8a8a8a",margin:"6px 0 0"}}>Creá la primera clase, por ejemplo "Clase 1 · Escala de Do mayor".</p>}
        {org.clases.map((c,ci)=>(
          <div key={c.id} style={{border:"1px solid #2a2a2a",borderRadius:10,padding:"10px 12px",marginTop:10,background:"#0e0e10"}}>
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <input style={{...inpS,width:110,fontWeight:700}} value={c.nombre} onChange={e=>updClase(c.id,{nombre:e.target.value})}/>
              <input style={{...inpS,flex:"1 1 200px"}} placeholder="título (ej: Escala de Do mayor, mano derecha)" value={c.titulo} onChange={e=>updClase(c.id,{titulo:e.target.value})}/>
              <button style={peq} disabled={ci===0} onClick={()=>moverClase(c.id,-1)}>↑</button>
              <button style={peq} disabled={ci===org.clases.length-1} onClick={()=>moverClase(c.id,1)}>↓</button>
              <button style={{...peq,color:conf==="c"+c.id?"#c0615a":"#a0a0a6"}} onClick={()=>delClase(c.id)}>{conf==="c"+c.id?"¿Seguro?":"Eliminar"}</button>
            </div>
            {/* a quién */}
            <div className="flex flex-wrap gap-1.5 items-center mb-2">
              <span style={{...uiLabel,marginRight:4}}>Asignada a</span>
              <button style={uiPill(todosAsig(c.id),{padding:"4px 10px",fontSize:11})} onClick={()=>toggleTodos(c.id)}>Todos</button>
              {org.alumnos.map(u=>(<button key={u} style={uiPill(tiene(u,c.id),{padding:"4px 10px",fontSize:11})} onClick={()=>toggle(u,c.id)}>{u}</button>))}
              {org.alumnos.length===0 && <span style={{fontSize:11,color:"#8a8a8a"}}>cargá alumnos arriba para poder asignarla</span>}
            </div>
            {c.ejercicios.length===0 && <p style={{fontSize:12,color:"#8a8a8a",margin:"4px 0 8px"}}>Sin ejercicios todavía.</p>}
            {c.ejercicios.map((e,k)=>(
              <div key={e.id} style={{padding:"6px 0",borderTop:k?"1px solid #1c1c1f":"none"}}>
                <div className="flex flex-wrap gap-2 items-center">
                  <span style={{fontSize:12.5,flex:"1 1 260px"}}><b style={{color:"#8a8a8a",marginRight:6}}>{k+1}.</b>{descEj(e)}</span>
                  {e.tipo!=="texto" && <button style={peq} onClick={()=>onProbar(e)}>▶ Probar</button>}
                  <button style={peq} onClick={()=>editarEj(c.id,e)}>✎ Editar</button>
                  <button style={peq} onClick={()=>delEj(c.id,e.id)}>✕</button>
                </div>
                {e.ruta && <div style={{fontSize:11,color:"#8a8a8a",margin:"4px 0 0 20px",fontFamily:"monospace"}}>{e.ruta.map(p=>`${romano?aRomano(p.g):p.g} ${p.n}${p.d?" ☝"+p.d:""}`).join(" · ")}</div>}
              </div>
            ))}
            {abierta===c.id ? (
              <div style={{marginTop:10,padding:10,border:"1px dashed #333",borderRadius:10}}>
                <p style={{...uiLabel,marginBottom:8}}>{ej.id?"Editar ejercicio":"Nuevo ejercicio"}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Sel v={ej.tipo} set={v=>setP({tipo:v})} opts={[["escala","Escala"],["acorde","Acorde"],["texto","Tarea libre (texto)"]]}/>
                  {ej.tipo==="escala" && <>
                    <Sel v={ej.root} set={v=>setP({root:v,inicio:-1})} opts={ACORDE_RAICES.map(x=>[x,nombreLat(x)])}/>
                    <Sel v={ej.escala} set={v=>setP({escala:v,inicio:-1})} opts={ESC_ENT.map(x=>[x.id,x.nombre])}/>
                    <Sel v={ej.mano} set={v=>setP({mano:v,inicio:-1})} opts={OPT_MANO}/>
                    <Sel v={ej.dir} set={v=>setP({dir:v,inicio:-1})} opts={OPT_DIR}/>
                    <Sel v={ej.fuelle} set={v=>setP({fuelle:v,inicio:-1})} opts={OPT_FUELLE}/>
                    <Sel v={ej.modoEj} set={v=>setP({modoEj:v},false)} opts={OPT_MODO}/>
                  </>}
                  {ej.tipo==="acorde" && <>
                    <Sel v={ej.ac.root} set={v=>setP({ac:{...ej.ac,root:v}},false)} opts={ACORDE_RAICES.map(x=>[x,nombreLat(x)])}/>
                    <Sel v={ej.ac.base} set={v=>setP({ac:{...ej.ac,base:v}},false)} opts={ACORDE_BASES.map(x=>[x.id,x.label])}/>
                    <Sel v={ej.ac.sept} set={v=>setP({ac:{...ej.ac,sept:v}},false)} opts={ACORDE_SEPT.map(x=>[x.id,x.label])}/>
                    <Sel v={ej.ac.nov} set={v=>setP({ac:{...ej.ac,nov:v}},false)} opts={ACORDE_NOV.map(x=>[x.id,"Novena "+x.label])}/>
                    <Sel v={ej.ac.und} set={v=>setP({ac:{...ej.ac,und:v}},false)} opts={ACORDE_UND.map(x=>[x.id,"Oncena "+x.label])}/>
                    <Sel v={ej.ac.tre} set={v=>setP({ac:{...ej.ac,tre:v}},false)} opts={ACORDE_TRE.map(x=>[x.id,"Trecena "+x.label])}/>
                    <button style={uiPill(ej.ac.seis,{padding:"6px 10px"})} onClick={()=>setP({ac:{...ej.ac,seis:!ej.ac.seis}},false)}>Sexta</button>
                    <button style={uiPill(ej.ac.sin5,{padding:"6px 10px"})} onClick={()=>setP({ac:{...ej.ac,sin5:!ej.ac.sin5}},false)}>Sin quinta</button>
                    <Sel v={ej.fuelle} set={v=>setP({fuelle:v},false)} opts={OPT_FUELLE}/>
                  </>}
                  {ej.tipo==="texto" && <textarea style={{...inpS,width:"100%"}} rows={2} placeholder="Consigna (ej: tocar la escala con metrónomo a 60, dos veces sin errores)" value={ej.texto} onChange={e=>setP({texto:e.target.value},false)}/>}
                </div>

                {/* camino + digitación */}
                {ej.tipo==="escala" && rutaForm && (
                  <div style={{marginBottom:10}}>
                    {rutaForm.inicios.length>1 && (
                      <div className="flex flex-wrap gap-1.5 items-center mb-2">
                        <span style={{...uiLabel,marginRight:4}}>Empezar en</span>
                        {rutaForm.inicios.map((n,i)=>(<button key={n+i} style={uiPill(rutaForm.usado===i,{padding:"4px 10px",fontSize:11})} onClick={()=>setP({inicio:i})}>{n}</button>))}
                      </div>
                    )}
                    {rutaForm.pasos.length===0 ? (
                      <p style={{fontSize:12,color:"#c9a25a",margin:0}}>Con este fuelle y esta mano esa escala no tiene camino. Probá otro fuelle, otra mano u otra escala.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table style={{borderCollapse:"collapse",width:"100%",fontSize:12.5}}>
                          <thead><tr style={{color:"#8a8a8a",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase"}}>
                            {["Función","Nota","Frecuencia","Tecla","Dedo",""].map(h=>(<th key={h} style={{textAlign:"left",padding:"4px 8px",fontWeight:600}}>{h}</th>))}
                          </tr></thead>
                          <tbody>
                            {rutaForm.pasos.map((p,i)=>(
                              <tr key={i} style={{borderTop:"1px solid #1c1c1f"}}>
                                <td style={{padding:"4px 8px",fontWeight:700}}>{romano?aRomano(p.g):p.g}</td>
                                <td style={{padding:"4px 8px"}}><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:nc(CHROMATIC[p.pc]),marginRight:7}}/>{p.n}</td>
                                <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#a0a0a6"}}>{fmtHz(p.hz)} Hz</td>
                                <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#a0a0a6"}}>{p.b}</td>
                                <td style={{padding:"3px 8px"}}><Sel v={(ej.dedos&&ej.dedos[i])||""} set={v=>{ const d=rutaForm.pasos.map((_,k)=>(ej.dedos&&ej.dedos[k])||""); d[i]=v; setEj({...ej,dedos:d}); }} opts={DEDO_OPC} w={86}/></td>
                                <td style={{padding:"3px 8px"}}><button style={peq} onClick={()=>playBand(CHROMATIC[p.pc],parseInt(p.n.slice(-1),10))}>▶</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p style={{fontSize:11,color:"#8a8a8a",margin:"6px 0 0"}}>Dedo: 1 índice · 2 medio · 3 anular · 4 meñique. Con "1 o 2" sugerís dos opciones para esa nota.</p>
                      </div>
                    )}
                    {rutaForm.faltan.length>0 && <p style={{fontSize:11.5,color:"#c9a25a",margin:"6px 0 0"}}>⚠ Falta en este camino: {rutaForm.faltan.join(", ")}.</p>}
                  </div>
                )}
                <textarea style={{...inpS,width:"100%",marginBottom:8}} rows={2} placeholder="Indicaciones para el alumno (opcional): tempo, articulación, cuántas repeticiones…" value={ej.indic||""} onChange={e=>setP({indic:e.target.value},false)}/>
                <div className="flex gap-2"><button style={uiPill(true)} onClick={()=>guardarEj(c.id)}>{ej.id?"Guardar cambios":"Agregar a la clase"}</button><button style={uiPill(false)} onClick={()=>{ setAbierta(null); setEj(EJ_NUEVO); }}>Cancelar</button></div>
              </div>
            ) : (
              <button style={{...peq,marginTop:8}} onClick={()=>{ setAbierta(c.id); setEj(EJ_NUEVO); }}>＋ Agregar ejercicio</button>
            )}
          </div>
        ))}
      </div>

      {/* 3 · resumen */}
      <details style={card}>
        <summary style={{cursor:"pointer",...uiLabel}}>3 · Resumen de asignaciones</summary>
        {(org.alumnos.length===0||org.clases.length===0) ? (
          <p style={{fontSize:12,color:"#8a8a8a",margin:"8px 0 0"}}>Cargá al menos un alumno y una clase.</p>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table style={{borderCollapse:"collapse",fontSize:12.5,width:"100%"}}>
              <thead><tr>
                <th style={{textAlign:"left",padding:"6px 8px",color:"#8a8a8a",fontWeight:600}}>Alumno</th>
                {org.clases.map(c=>(<th key={c.id} title={c.titulo} style={{padding:"6px 8px",fontWeight:700,whiteSpace:"nowrap"}}>{c.nombre}</th>))}
              </tr></thead>
              <tbody>
                {org.alumnos.map(u=>(<tr key={u} style={{borderTop:"1px solid #1c1c1f"}}>
                  <td style={{padding:"7px 8px",fontWeight:600}}>{u}</td>
                  {org.clases.map(c=>(<td key={c.id} style={{textAlign:"center",padding:"7px 8px"}}>
                    <input type="checkbox" checked={tiene(u,c.id)} onChange={()=>toggle(u,c.id)} style={{width:18,height:18,cursor:"pointer"}}/></td>))}
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      <p style={{fontSize:11,color:"#6a6a6a",lineHeight:1.5}}>Aviso: clases.json es un archivo público de tu sitio: quien tenga el enlace podría leerlo. No incluyas datos personales. Tampoco podés ver desde acá si el alumno hizo la tarea.</p>
    </div>
  );
}

function MisTareasTab({onPracticar}){
  const u = window.__USUARIO || "";
  const [romano]=useRomanos();
  const [datos,setDatos]=useState(null), [err,setErr]=useState(false);
  const [hechas,setHechas]=useState(()=>{ try{ return JSON.parse(localStorage.getItem("harmonia_hechas_"+u)||"{}"); }catch(e){ return {}; } });
  useEffect(()=>{ let vivo=true;
    fetch("clases.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{ if(!vivo) return; if(j&&Array.isArray(j.clases)) setDatos(j); else setErr(true); }).catch(()=>{ if(vivo) setErr(true); });
    return ()=>{vivo=false;}; },[]);
  const marcar=(id)=>{ const n={...hechas,[id]:!hechas[id]}; setHechas(n); try{ localStorage.setItem("harmonia_hechas_"+u,JSON.stringify(n)); }catch(e){} };
  const ids = (datos&&datos.asignaciones&&datos.asignaciones[u]) || [];
  const clases = datos ? ids.map(id=>datos.clases.find(c=>c.id===id)).filter(Boolean) : [];
  const card={background:"#121212",border:"1px solid #2a2a2a",borderRadius:12,padding:"12px 14px",marginBottom:12};
  return(
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1" style={{fontFamily:"'Libre Baskerville',serif"}}>Mis tareas</h2>
        <p className="text-xs text-gray-500">{u ? `Tareas de ${u}. ` : ""}Tocá "Practicar" para abrir el ejercicio ya preparado en el Entrenador, con sus notas, octavas y dedos.</p>
      </div>
      {!datos && !err && <p style={{fontSize:13,color:"#8a8a8a"}}>Cargando…</p>}
      {err && <div style={card}><p style={{fontSize:13,margin:0,color:"#a0a0a6"}}>Todavía no hay tareas publicadas.</p></div>}
      {datos && clases.length===0 && <div style={card}><p style={{fontSize:13,margin:0,color:"#a0a0a6"}}>Todavía no tenés tareas asignadas.</p></div>}
      {clases.map(c=>(
        <div key={c.id} style={card}>
          <div style={{fontFamily:"'Libre Baskerville',serif",fontWeight:700,fontSize:16}}>{c.nombre}</div>
          {c.titulo && <div style={{fontSize:13,color:"#a0a0a6",margin:"2px 0 8px"}}>{c.titulo}</div>}
          {c.ejercicios.map((e,k)=>(
            <div key={e.id} style={{padding:"8px 0",borderTop:"1px solid #1c1c1f"}}>
              <div className="flex flex-wrap gap-2 items-center">
                <span style={{flex:"1 1 240px",fontSize:13,opacity:hechas[e.id]?0.5:1,textDecoration:hechas[e.id]?"line-through":"none"}}><b style={{color:"#8a8a8a",marginRight:6}}>{k+1}.</b>{descEj(e)}</span>
                {e.tipo!=="texto" && <button style={uiPill(true,{padding:"6px 14px"})} onClick={()=>onPracticar(e)}>▶ Practicar</button>}
                <button style={uiPill(!!hechas[e.id],{padding:"6px 12px"})} onClick={()=>marcar(e.id)}>{hechas[e.id]?"✓ Hecha":"Marcar hecha"}</button>
              </div>
              {e.ruta && (
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                  {e.ruta.map((p,i)=>{ const col=nc(CHROMATIC[p.pc]); return(
                    <div key={i} title={`${fmtHz(p.hz)} Hz · tecla ${p.b}`} style={{background:col,color:txtSobre(col),borderRadius:9,padding:"5px 9px",textAlign:"center",minWidth:58,border:"1.5px solid rgba(255,255,255,.3)"}}>
                      <div style={{fontSize:9.5,fontWeight:800,fontFamily:"monospace",opacity:.85}}>{romano?aRomano(p.g):p.g}</div>
                      <div style={{fontSize:13,fontWeight:900,fontFamily:"serif"}}>{p.n}</div>
                      <div style={{fontSize:9,fontFamily:"monospace",opacity:.85}}>{fmtHz(p.hz)} Hz</div>
                      <div style={{fontSize:11,fontWeight:900,fontFamily:"monospace",minHeight:15}}>{p.d?("☝"+p.d):""}</div>
                    </div>); })}
                </div>
              )}
              {e.indic && <div style={{fontSize:12.5,color:"#cfcfcf",marginTop:8,whiteSpace:"pre-wrap"}}>📝 {e.indic}</div>}
            </div>
          ))}
        </div>
      ))}
      <p style={{fontSize:11,color:"#6a6a6a"}}>Lo que marcás como hecho se guarda solo en este dispositivo; tu profesor no lo ve.</p>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function HarmoniaApp(){
  const[tab,setTab]=useState("codigo");
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
  const toggleFn=useCallback(i=>setOpenFns(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]),[]);

  const [preset,setPreset]=useState(null);
  const TABS=[
    {id:"codigo",    label:"El Código",  icon:"◐"},
    {id:"chord",     label:"Acorde",     icon:"♪"},
    {id:"prog",      label:"Progresión", icon:"→"},
    {id:"biblioteca",label:"Biblioteca", icon:"▤"},
    {id:"bandoneon", label:"Bandoneón",  icon:"♬"},
    {id:"entrenador",label:"Entrenador", icon:"◎"},
    {id:"circle",    label:"Quintas",    icon:"○"},
    {id:"colors",    label:"Colores",    icon:"●"},
    {id:"modos",     label:"Modos",      icon:"≋"},
  ];
  if(window.__ALUMNO) TABS.splice(1,0,{id:"tareas",label:"Mis tareas",icon:"✎"}); else TABS.push({id:"organizador",label:"Organizador",icon:"▦"});
  const practicar=(e)=>{ setPreset({...e,nonce:Date.now()}); setTab("entrenador"); };

  return(
    <div className="min-h-screen text-gray-100 flex flex-col" style={{
      background:"linear-gradient(160deg,#09090a 0%,#0f0f10 55%,#111113 100%)",
      fontFamily:"'Crimson Text',Georgia,serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        .glow-input:focus{outline:none;box-shadow:0 0 0 2px #e6e6e655}
        button{transition:background-color .15s,border-color .15s,color .15s,transform .12s,opacity .2s,box-shadow .15s,filter .15s}
        button:not(:disabled):hover{filter:brightness(1.14)}
        button:not(:disabled):active{transform:scale(.97)}
        button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #ececec;outline-offset:2px}
        button:disabled{opacity:.4;cursor:default}
        .nav-item{position:relative}
        .nav-item:hover{background:#141416}
        ::selection{background:#ececec;color:#0d0d0e}
        .stagger>*{animation:fadeUp 0.3s ease both}
        .stagger>*:nth-child(1){animation-delay:.03s}.stagger>*:nth-child(2){animation-delay:.08s}
        .stagger>*:nth-child(3){animation-delay:.13s}.stagger>*:nth-child(4){animation-delay:.18s}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2c2c30;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:#3d3d42}
      `}</style>

      {/* ── HEADER ── */}
      <div className="px-4 md:px-6 py-3 flex items-center gap-4 flex-shrink-0"
        style={{borderBottom:"1px solid #1f1f22",background:"rgba(10,10,11,.88)",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:30}}>
        <button onClick={()=>setNavOpen(o=>!o)} aria-label="Menú"
          className={`${(tab==="bandoneon"||tab==="entrenador")?"":"md:hidden"} flex flex-col gap-1 p-2.5 rounded-lg flex-shrink-0`}
          style={{background:"#121214",border:"1px solid #2a2a2e"}}>
          <span className="block w-4 h-px" style={{background:"#a0a0a6"}}/>
          <span className="block w-4 h-px" style={{background:"#a0a0a6"}}/>
          <span className="block w-4 h-px" style={{background:"#a0a0a6"}}/>
        </button>
        <div style={{lineHeight:1.15}}>
          <h1 style={{fontFamily:"'Libre Baskerville',serif",fontSize:19,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#ececec"}}>Harmonía</h1>
          <p style={{fontFamily:UI_FONT,fontSize:9.5,letterSpacing:"0.24em",textTransform:"uppercase",color:"#707076",marginTop:3}}>Bandoneón · Tango · Jazz</p>
        </div>
        <div className="ml-auto flex items-center gap-2" style={{fontFamily:UI_FONT,fontSize:12,color:"#9a9aa0",letterSpacing:"0.04em"}}>
          <span style={{opacity:.6}}>{TABS.find(t=>t.id===tab)?.icon}</span>
          <span style={{fontWeight:600,color:"#d6d6da"}}>{TABS.find(t=>t.id===tab)?.label}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR VERTICAL ── */}
        <div className={`flex-shrink-0 transition-all duration-200 ${navOpen?"w-52":((tab==="bandoneon"||tab==="entrenador")?"w-0 overflow-hidden":"w-0 overflow-hidden md:w-52")}`}
          style={{background:"#0b0b0c",borderRight:"1px solid #1f1f22"}}>
          <nav className="py-4 px-3 space-y-0.5 w-52">
            <p style={{...uiLabel,padding:"0 10px 8px",fontSize:9}}>Secciones</p>
            {TABS.map(t=>{
              const act=tab===t.id;
              return(
                <button key={t.id}
                  onClick={()=>{setTab(t.id);setNavOpen(false);}}
                  className="nav-item w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3"
                  style={{
                    fontFamily:UI_FONT,fontSize:13,letterSpacing:"0.01em",
                    background:act?"#17171a":"transparent",
                    color:act?"#f0f0f2":"#7d7d84",
                    fontWeight:act?600:500,
                    boxShadow:act?"inset 2px 0 0 #ececec":"none",
                  }}>
                  <span style={{width:16,textAlign:"center",fontSize:14,opacity:act?1:.55}}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <div className="flex-1 overflow-y-auto">
          <div className={`${(tab==="bandoneon"||tab==="entrenador")?"max-w-[1700px]":tab==="codigo"?"max-w-3xl":(tab==="organizador"||tab==="tareas")?"max-w-4xl":"max-w-2xl"} mx-auto ${(tab==="bandoneon"||tab==="entrenador")?"px-2 py-4 md:px-5 md:py-6":"px-3 py-4 md:px-8 md:py-8"}`}>

            {/* ══ EL CÓDIGO ══ */}
            {tab==="codigo"&&<ElCodigoTab/>}

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
                    style={{background:"#1a1a1a",border:"1px solid #e6e6e6",color:"#e6e6e6",whiteSpace:"nowrap"}}>
                    Analizar
                  </button>
                </div>

                {chord&&<>
                  <div className="rounded-2xl p-5 border border-gray-700" style={{background:"#121212"}}>
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
                                        <button onClick={()=>playChord(chord.notes)}
                      className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold border"
                      style={{background:"#1a1a1a",borderColor:"#333333",color:"#e6e6e6"}}>
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
                          style={{background:showTable===(vi===1)?"#1a1a1a":"transparent",
                            borderColor:showTable===(vi===1)?"#e6e6e6":"#333",
                            color:showTable===(vi===1)?"#e6e6e6":"#666"}}>
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

                  <div className="rounded-xl p-4 border border-gray-800" style={{background:"#121212"}}>
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
                      style={{background:"#1a1a1a",border:"1px solid #e6e6e6",color:"#e6e6e6"}}>
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
                      <span className="ml-2 text-[#d4d4d4] font-bold text-base">{progression[0]?.key} Mayor</span>
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
                        <div key={i} className="rounded-2xl border border-gray-700 overflow-hidden" style={{background:"#121212"}}>
                          <div className="px-4 pt-4 pb-3 border-b border-gray-800">
                            <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                              <span className="text-2xl font-bold" style={{fontFamily:"'Libre Baskerville',serif"}}>{ch.raw}</span>
                              <button onClick={()=>playChord(ch.notes)} className="text-sm text-gray-600 hover:text-[#d4d4d4]">▶</button>
                              <span className="text-xs px-2.5 py-1 rounded-full border"
                                style={{background:"#232323",borderColor:"#e6e6e6",color:"#e6e6e6"}}>
                                {ch.degree} en {ch.key}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {ch.notes.map(n=><Nota key={n} note={n} size="sm"/>)}
                            </div>
                            {/* Piano voicing */}
                            <div className="rounded-xl p-2.5 border border-gray-700 mb-3" style={{background:"#121212"}}>
                              <p className="text-xs text-gray-600 mb-1.5">Voicing en piano</p>
                              <Piano leftVoice={v.L} rightVoice={v.R}/>
                            </div>
                            {f&&(
                              <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
                                <span><span className="text-[#a3a3a3]">Modo: </span><span className="text-white font-semibold">{f.mode}</span></span>
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
                                    <tr style={{borderBottom:"1px solid #1a1a1a"}}>
                                      {["Gr.","Acorde","Notas","Modo","Tensiones","Evitar"].map(h=>(
                                        <th key={h} className="text-left pb-1.5 text-gray-600 font-normal">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dia.map((dc,di)=>{
                                      const rc=nc(dc.root);
                                      return(
                                        <tr key={di} style={{borderBottom:"1px solid #121212",background:di%2===0?"transparent":"#0a0a0a"}}>
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
                                          <td className="py-1.5 pr-2 text-[#a3a3a3] whitespace-nowrap">{dc.mode}</td>
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
                    <span style={{color:"#e6e6e6"}}>📚</span>
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
                        <div key={i} className="rounded-xl border border-gray-700 overflow-hidden" style={{background:"#121212"}}>
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
                                  style={{background:"#1a1a1a",borderColor:"#333333",color:"#e6e6e6"}}>
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
                                  style={{background:"#1a1a1a",borderColor:"#e6e6e6",color:"#e6e6e6"}}>
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
                    <span style={{color:"#e6e6e6"}}>🎵 Bandoneón</span>
                    <span className="text-gray-500 text-sm font-normal ml-2 italic">Rheinische · 71 botones</span>
                  </h2>
                  <p className="text-xs text-gray-500">Presioná botones para tocar y detectar acordes</p>
                </div>
                <BandoneonTab/>
              </div>
            )}

            {/* ══ ENTRENADOR ══ */}
            {tab==="entrenador"&&<EntrenadorTab preset={preset}/>}
            {tab==="organizador"&&!window.__ALUMNO&&<OrganizadorTab onProbar={practicar}/>}
            {tab==="tareas"&&<MisTareasTab onPracticar={practicar}/>}

            {/* ══ QUINTAS ══ */}
            {tab==="circle"&&<CirculoQuintas/>}

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
                    <div key={i} className="rounded-xl border border-gray-700 overflow-hidden" style={{background:"#121212"}}>
                      <div className="px-4 py-3 border-b border-gray-800" style={{background:"#121212"}}>
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
                          <span className="text-[#a3a3a3] font-semibold">Uso típico: </span>
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
