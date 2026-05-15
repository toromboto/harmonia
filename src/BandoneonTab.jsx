import { useState, useCallback, useMemo, useRef } from "react";

// ─── NOTAS: notación latina → inglesa ────────────────────────────────────────
const LAT_TO_ENG = {
  "DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F",
  "FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B",
};
const ENG_TO_LAT = Object.fromEntries(Object.entries(LAT_TO_ENG).map(([k,v])=>[v,k]));

// Colores del sistema Harmonía (por nota en inglés)
const NOTE_COLORS = {
  C:"#1E50DC", "C#":"#2378B4", D:"#28A03C", "D#":"#28B464",
  E:"#82501E", F:"#C8B98C",  "F#":"#D7C050", G:"#E6C814",
  "G#":"#DC781E", A:"#D22828", "A#":"#A5286E", B:"#7828B4",
};
const getNoteColor = (noteLat) => {
  const eng = LAT_TO_ENG[noteLat] || noteLat;
  return NOTE_COLORS[eng] || "#888";
};

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let _audioCtx = null;
const getCtx = () => {
  if (!_audioCtx) try { _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
  return _audioCtx;
};
const NOTE_MIDI = {
  C:48,"C#":49,D:50,"D#":51,E:52,F:53,"F#":54,G:55,"G#":56,A:57,"A#":58,B:59
};
const OCTAVE_MIDI_OFFSET = { 2:-24, 3:-12, 4:0, 5:12, 6:24 };

const playBandoneonNote = (noteLat, octave, duration=0.8) => {
  try {
    const ctx = getCtx(); if (!ctx) return;
    if (ctx.state==="suspended") ctx.resume();
    const eng = LAT_TO_ENG[noteLat] || noteLat;
    const baseMidi = (NOTE_MIDI[eng] ?? 60) + (OCTAVE_MIDI_OFFSET[octave] ?? 0);
    const freq = 440 * Math.pow(2, (baseMidi-69)/12);
    // Sonido más acordeonístico con múltiples osciladores
    [1, 2, 3].forEach((harmonic, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.value = freq * harmonic;
      const vol = [0.3, 0.15, 0.08][i];
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(); osc.stop(ctx.currentTime + duration);
    });
  } catch(e) {}
};

const playChordNotes = (pressedKeys, layout) => {
  pressedKeys.forEach(keyId => {
    const key = layout.find(k => k.id === keyId);
    if (key) playBandoneonNote(key.note, key.octave);
  });
};

// ─── LAYOUT DEL BANDONEÓN ─────────────────────────────────────────────────────
// Basado en el sistema Rheinische (bandoneón argentino/tango)
// Datos extraídos de la imagen: notas en notación latina con octava

// MANO IZQUIERDA ABRIENDO — 33 botones
const LEFT_OPEN = [
  // Fila exterior (arriba en imagen)
  { id:"lo_1",  note:"SOL#", octave:2, row:0, col:0 },
  { id:"lo_2",  note:"LA#",  octave:2, row:0, col:1 },
  { id:"lo_3",  note:"RE#",  octave:3, row:0, col:2 },
  { id:"lo_4",  note:"DO#",  octave:4, row:0, col:3 },
  { id:"lo_5",  note:"FA",   octave:4, row:0, col:4 },
  { id:"lo_6",  note:"LA#",  octave:4, row:0, col:5 },
  { id:"lo_7",  note:"SOL",  octave:4, row:0, col:6 },
  // Fila 2
  { id:"lo_8",  note:"LA",   octave:2, row:1, col:0 },
  { id:"lo_9",  note:"SOL",  octave:2, row:1, col:1 },
  { id:"lo_10", note:"LA",   octave:3, row:1, col:2 },
  { id:"lo_11", note:"DO",   octave:4, row:1, col:3 },
  { id:"lo_12", note:"MI",   octave:4, row:1, col:4 },
  { id:"lo_13", note:"DO",   octave:4, row:1, col:5 },
  { id:"lo_14", note:"FA",   octave:4, row:1, col:6 },
  // Fila 3
  { id:"lo_15", note:"MI",   octave:2, row:2, col:0 },
  { id:"lo_16", note:"RE",   octave:3, row:2, col:1 },
  { id:"lo_17", note:"SOL",  octave:3, row:2, col:2 },
  { id:"lo_18", note:"SI",   octave:3, row:2, col:3 },
  { id:"lo_19", note:"FA#",  octave:4, row:2, col:4 },
  { id:"lo_20", note:"DO#",  octave:4, row:2, col:5 },
  // Fila 4
  { id:"lo_21", note:"SOL#", octave:2, row:3, col:0 },
  { id:"lo_22", note:"MI",   octave:2, row:3, col:1 },
  { id:"lo_23", note:"LA",   octave:3, row:3, col:2 },
  { id:"lo_24", note:"RE#",  octave:3, row:3, col:3 },
  { id:"lo_25", note:"FA#",  octave:3, row:3, col:4 },
  { id:"lo_26", note:"DO#",  octave:3, row:3, col:5 },
  // Fila 5 (interior)
  { id:"lo_27", note:"SI",   octave:2, row:4, col:0 },
  { id:"lo_28", note:"SOL",  octave:3, row:4, col:1 },
  { id:"lo_29", note:"RE",   octave:3, row:4, col:2 },
  { id:"lo_30", note:"FA#",  octave:2, row:4, col:3 },
  // Fila 6
  { id:"lo_31", note:"RE",   octave:2, row:5, col:0 },
  { id:"lo_32", note:"MI",   octave:3, row:5, col:1 },
  { id:"lo_33", note:"RE#",  octave:2, row:5, col:2 },
];

// MANO IZQUIERDA CERRANDO — mismas posiciones, notas diferentes
const LEFT_CLOSE = [
  { id:"lc_1",  note:"SOL#", octave:2, row:0, col:0 },
  { id:"lc_2",  note:"RE",   octave:2, row:0, col:1 },
  { id:"lc_3",  note:"RE#",  octave:3, row:0, col:2 },
  { id:"lc_4",  note:"DO#",  octave:3, row:0, col:3 },
  { id:"lc_5",  note:"RE#",  octave:3, row:0, col:4 },
  { id:"lc_6",  note:"SOL",  octave:4, row:0, col:5 },
  { id:"lc_7",  note:"LA#",  octave:3, row:0, col:6 },
  { id:"lc_8",  note:"RE",   octave:2, row:1, col:0 },
  { id:"lc_9",  note:"RE",   octave:3, row:1, col:1 },
  { id:"lc_10", note:"SOL",  octave:3, row:1, col:2 },
  { id:"lc_11", note:"SI",   octave:3, row:1, col:3 },
  { id:"lc_12", note:"RE",   octave:4, row:1, col:4 },
  { id:"lc_13", note:"FA",   octave:4, row:1, col:5 },
  { id:"lc_14", note:"FA#",  octave:4, row:1, col:6 },
  { id:"lc_15", note:"SOL",  octave:2, row:2, col:0 },
  { id:"lc_16", note:"SOL",  octave:2, row:2, col:1 },
  { id:"lc_17", note:"DO",   octave:3, row:2, col:2 },
  { id:"lc_18", note:"DO#",  octave:3, row:2, col:3 },
  { id:"lc_19", note:"FA",   octave:3, row:2, col:4 },
  { id:"lc_20", note:"FA#",  octave:3, row:2, col:5 },
  { id:"lc_21", note:"MI",   octave:2, row:3, col:0 },
  { id:"lc_22", note:"LA",   octave:2, row:3, col:1 },
  { id:"lc_23", note:"LA",   octave:3, row:3, col:2 },
  { id:"lc_24", note:"DO#",  octave:3, row:3, col:3 },
  { id:"lc_25", note:"SI",   octave:3, row:3, col:4 },
  { id:"lc_26", note:"DO#",  octave:4, row:3, col:5 },
  { id:"lc_27", note:"MI",   octave:2, row:4, col:0 },
  { id:"lc_28", note:"FA#",  octave:2, row:4, col:1 },
  { id:"lc_29", note:"SOL#", octave:2, row:4, col:2 },
  { id:"lc_30", note:"SI",   octave:2, row:4, col:3 },
  { id:"lc_31", note:"MI",   octave:2, row:5, col:0 },
  { id:"lc_32", note:"MI",   octave:3, row:5, col:1 },
  { id:"lc_33", note:"FA",   octave:3, row:5, col:2 },
];

// MANO DERECHA ABRIENDO — 38 botones
const RIGHT_OPEN = [
  { id:"ro_1",  note:"SI",   octave:4, row:0, col:0 },
  { id:"ro_2",  note:"SOL#", octave:4, row:0, col:1 },
  { id:"ro_3",  note:"SOL",  octave:5, row:0, col:2 },
  { id:"ro_4",  note:"SOL",  octave:4, row:0, col:3 },
  { id:"ro_5",  note:"SOL",  octave:5, row:0, col:4 },
  { id:"ro_6",  note:"FA",   octave:5, row:0, col:5 },
  { id:"ro_7",  note:"FA",   octave:5, row:0, col:6 },
  { id:"ro_8",  note:"DO",   octave:5, row:1, col:0 },
  { id:"ro_9",  note:"RE",   octave:5, row:1, col:1 },
  { id:"ro_10", note:"SOL",  octave:5, row:1, col:2 },
  { id:"ro_11", note:"LA#",  octave:5, row:1, col:3 },
  { id:"ro_12", note:"DO",   octave:5, row:1, col:4 },
  { id:"ro_13", note:"RE#",  octave:5, row:1, col:5 },
  { id:"ro_14", note:"RE",   octave:5, row:1, col:6 },
  { id:"ro_15", note:"SI",   octave:4, row:2, col:0 },
  { id:"ro_16", note:"LA",   octave:4, row:2, col:1 },
  { id:"ro_17", note:"DO#",  octave:5, row:2, col:2 },
  { id:"ro_18", note:"FA#",  octave:5, row:2, col:3 },
  { id:"ro_19", note:"LA",   octave:5, row:2, col:4 },
  { id:"ro_20", note:"DO",   octave:6, row:2, col:5 },
  { id:"ro_21", note:"RE#",  octave:6, row:2, col:6 },
  { id:"ro_22", note:"FA",   octave:4, row:3, col:0 },
  { id:"ro_23", note:"SOL#", octave:4, row:3, col:1 },
  { id:"ro_24", note:"RE#",  octave:4, row:3, col:2 },
  { id:"ro_25", note:"FA#",  octave:4, row:3, col:3 },
  { id:"ro_26", note:"LA",   octave:4, row:3, col:4 },
  { id:"ro_27", note:"RE#",  octave:5, row:3, col:5 },
  { id:"ro_28", note:"FA#",  octave:5, row:3, col:6 },
  { id:"ro_29", note:"LA",   octave:4, row:4, col:0 },
  { id:"ro_30", note:"MI",   octave:4, row:4, col:1 },
  { id:"ro_31", note:"FA",   octave:4, row:4, col:2 },
  { id:"ro_32", note:"DO",   octave:5, row:4, col:3 },
  { id:"ro_33", note:"RE",   octave:5, row:4, col:4 },
  { id:"ro_34", note:"MI",   octave:5, row:4, col:5 },
  { id:"ro_35", note:"SOL",  octave:4, row:5, col:0 },
  { id:"ro_36", note:"SI",   octave:4, row:5, col:1 },
  { id:"ro_37", note:"LA#",  octave:4, row:5, col:2 },
  { id:"ro_38", note:"SOL",  octave:5, row:5, col:3 },
];

// MANO DERECHA CERRANDO
const RIGHT_CLOSE = [
  { id:"rc_1",  note:"LA",   octave:4, row:0, col:0 },
  { id:"rc_2",  note:"SOL#", octave:4, row:0, col:1 },
  { id:"rc_3",  note:"FA#",  octave:5, row:0, col:2 },
  { id:"rc_4",  note:"FA",   octave:5, row:0, col:3 },
  { id:"rc_5",  note:"DO",   octave:6, row:0, col:4 },
  { id:"rc_6",  note:"FA",   octave:5, row:0, col:5 },
  { id:"rc_7",  note:"RE#",  octave:6, row:0, col:6 },
  { id:"rc_8",  note:"RE",   octave:5, row:1, col:0 },
  { id:"rc_9",  note:"DO#",  octave:5, row:1, col:1 },
  { id:"rc_10", note:"SOL#", octave:5, row:1, col:2 },
  { id:"rc_11", note:"LA#",  octave:5, row:1, col:3 },
  { id:"rc_12", note:"DO",   octave:6, row:1, col:4 },
  { id:"rc_13", note:"RE#",  octave:5, row:1, col:5 },
  { id:"rc_14", note:"RE",   octave:6, row:1, col:6 },
  { id:"rc_15", note:"FA#",  octave:4, row:2, col:0 },
  { id:"rc_16", note:"FA#",  octave:4, row:2, col:1 },
  { id:"rc_17", note:"FA#",  octave:5, row:2, col:2 },
  { id:"rc_18", note:"SOL",  octave:5, row:2, col:3 },
  { id:"rc_19", note:"LA",   octave:5, row:2, col:4 },
  { id:"rc_20", note:"RE",   octave:6, row:2, col:5 },
  { id:"rc_21", note:"SOL#", octave:5, row:3, col:0 },
  { id:"rc_22", note:"MI",   octave:5, row:3, col:1 },
  { id:"rc_23", note:"RE#",  octave:5, row:3, col:2 },
  { id:"rc_24", note:"FA#",  octave:5, row:3, col:3 },
  { id:"rc_25", note:"LA#",  octave:5, row:3, col:4 },
  { id:"rc_26", note:"SOL#", octave:5, row:3, col:5 },
  { id:"rc_27", note:"SOL#", octave:4, row:4, col:0 },
  { id:"rc_28", note:"MI",   octave:4, row:4, col:1 },
  { id:"rc_29", note:"LA",   octave:4, row:4, col:2 },
  { id:"rc_30", note:"DO#",  octave:5, row:4, col:3 },
  { id:"rc_31", note:"MI",   octave:5, row:4, col:4 },
  { id:"rc_32", note:"SI",   octave:5, row:4, col:5 },
  { id:"rc_33", note:"SOL",  octave:4, row:5, col:0 },
  { id:"rc_34", note:"LA#",  octave:4, row:5, col:1 },
  { id:"rc_35", note:"SI",   octave:4, row:5, col:2 },
  { id:"rc_36", note:"DO#",  octave:6, row:5, col:3 },
  { id:"rc_37", note:"MI",   octave:4, row:5, col:4 },
  { id:"rc_38", note:"RE#",  octave:4, row:5, col:5 },
];

// Colores por octava (como en la imagen)
const OCTAVE_COLORS = {
  2: { bg:"#a78bfa", border:"#7c3aed", label:"Octava 2" }, // violeta
  3: { bg:"#fb923c", border:"#ea580c", label:"Octava 3" }, // naranja
  4: { bg:"#34d399", border:"#059669", label:"Octava 4" }, // verde
  5: { bg:"#f472b6", border:"#db2777", label:"Octava 5" }, // rosa
  6: { bg:"#60a5fa", border:"#2563eb", label:"Octava 6" }, // azul
};

// ─── DETECCIÓN DE ACORDE ──────────────────────────────────────────────────────
const CHROMATIC_ENG = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const detectChord = (pressedKeys, layout) => {
  if (pressedKeys.length < 2) return null;
  const notes = [...new Set(
    pressedKeys.map(id => {
      const k = layout.find(k=>k.id===id);
      return k ? LAT_TO_ENG[k.note] : null;
    }).filter(Boolean)
  )];
  if (notes.length < 2) return null;

  // Convertir a índices cromaticos
  const indices = notes.map(n => CHROMATIC_ENG.indexOf(n)).filter(i=>i>=0).sort((a,b)=>a-b);
  const root = CHROMATIC_ENG[indices[0]];
  const intervals = indices.map(i => (i - indices[0] + 12) % 12).sort((a,b)=>a-b);

  // Detección por intervalo
  const has = (i) => intervals.includes(i);
  let quality = "?";
  if (has(4)&&has(7)&&has(10)&&has(14)) quality = "9";
  else if (has(3)&&has(7)&&has(10)&&has(14)) quality = "m9";
  else if (has(4)&&has(7)&&has(11)) quality = "△7";
  else if (has(3)&&has(7)&&has(10)) quality = "m7";
  else if (has(4)&&has(7)&&has(10)) quality = "7";
  else if (has(3)&&has(6)&&has(9))  quality = "°7";
  else if (has(3)&&has(6)&&has(10)) quality = "ø7";
  else if (has(4)&&has(7)) quality = "";
  else if (has(3)&&has(7)) quality = "m";
  else if (has(3)&&has(6)) quality = "°";
  else if (has(4)&&has(8)) quality = "+";
  else if (has(2)&&has(7)) quality = "sus2";
  else if (has(5)&&has(7)) quality = "sus4";
  else quality = "intervalo";

  const rootLat = ENG_TO_LAT[root] || root;
  return { name: `${rootLat}${quality}`, notes, root, quality };
};

// ─── COMPONENTE BOTÓN DEL BANDONEÓN ──────────────────────────────────────────
const BandoneonButton = ({ keyData, isPressed, onPress, onRelease, size=44 }) => {
  const octCol = OCTAVE_COLORS[keyData.octave] || { bg:"#555", border:"#333" };
  const noteColor = getNoteColor(keyData.note);
  const active = isPressed;

  return (
    <button
      onMouseDown={() => onPress(keyData.id)}
      onMouseUp={() => onRelease(keyData.id)}
      onMouseLeave={() => onRelease(keyData.id)}
      onTouchStart={(e) => { e.preventDefault(); onPress(keyData.id); }}
      onTouchEnd={(e) => { e.preventDefault(); onRelease(keyData.id); }}
      className="rounded-full flex flex-col items-center justify-center select-none relative"
      style={{
        width: size, height: size,
        background: active
          ? `radial-gradient(circle at 35% 35%, ${noteColor}ff, ${noteColor}99)`
          : `radial-gradient(circle at 35% 35%, ${octCol.bg}cc, ${octCol.bg}55)`,
        border: `2.5px solid ${active ? noteColor : octCol.border}`,
        boxShadow: active
          ? `0 0 12px ${noteColor}88, inset 0 2px 4px rgba(255,255,255,0.3)`
          : `0 3px 6px rgba(0,0,0,0.5), inset 0 1px 3px rgba(255,255,255,0.15)`,
        transform: active ? "translateY(1px) scale(0.95)" : "translateY(0) scale(1)",
        transition: "all 0.08s ease",
        cursor: "pointer",
      }}
    >
      <span style={{
        fontSize: size < 38 ? "7px" : "8px",
        fontWeight: "bold",
        color: active ? "#fff" : "#1a1a1a",
        fontFamily: "serif",
        lineHeight: 1,
        textShadow: active ? "0 1px 2px rgba(0,0,0,0.5)" : "none",
      }}>
        {keyData.note}
      </span>
      <span style={{
        fontSize: "6px",
        color: active ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)",
        fontFamily: "monospace",
      }}>
        {keyData.octave}
      </span>
    </button>
  );
};

// ─── GRILLA DE BOTONES ────────────────────────────────────────────────────────
const ButtonGrid = ({ layout, pressed, onPress, onRelease, title, btnSize=42 }) => {
  const rows = [...new Set(layout.map(k=>k.row))].sort((a,b)=>a-b);
  const maxCol = Math.max(...layout.map(k=>k.col));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest mb-3 text-center"
        style={{ color:"#aaa", fontFamily:"serif", letterSpacing:"0.15em" }}>
        {title}
      </p>
      <div className="inline-block p-3 rounded-2xl"
        style={{ background:"linear-gradient(145deg,#2a2018,#1a1208)", border:"2px solid #5a4020",
          boxShadow:"0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
        {rows.map(row => {
          const rowKeys = layout.filter(k=>k.row===row).sort((a,b)=>a.col-b.col);
          // Offset por fila para simular layout hexagonal del bandoneón
          const offsets = [0, 0.5, 0, 0.5, 0, 0.5];
          const offset = (offsets[row] || 0) * (btnSize + 6);
          return (
            <div key={row} className="flex gap-1.5 mb-1.5" style={{ marginLeft: offset }}>
              {rowKeys.map(k => (
                <BandoneonButton
                  key={k.id}
                  keyData={k}
                  isPressed={pressed.includes(k.id)}
                  onPress={onPress}
                  onRelease={onRelease}
                  size={btnSize}
                />
              ))}
            </div>
          );
        })}
        {/* Leyenda de octavas */}
        <div className="flex gap-2 mt-3 justify-center flex-wrap">
          {Object.entries(OCTAVE_COLORS).map(([oct, col]) => {
            const hasOct = layout.some(k=>k.octave===parseInt(oct));
            if (!hasOct) return null;
            return (
              <div key={oct} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{background:col.bg, border:`1px solid ${col.border}`}}/>
                <span className="text-xs" style={{color:"#888",fontSize:"9px"}}>{col.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── PANEL DE ACORDES DETECTADOS ─────────────────────────────────────────────
const NOTE_COLORS_DISPLAY = {
  C:"#1E50DC","C#":"#2378B4",D:"#28A03C","D#":"#28B464",E:"#82501E",
  F:"#C8B98C","F#":"#D7C050",G:"#E6C814","G#":"#DC781E",A:"#D22828",
  "A#":"#A5286E",B:"#7828B4",
};

const ChordPanel = ({ pressedLeft, pressedRight, leftLayout, rightLayout, bellows }) => {
  const allPressed = [...pressedLeft, ...pressedRight];
  const allLayout = [...leftLayout, ...rightLayout];
  const chord = useMemo(() => detectChord(allPressed, allLayout), [allPressed, allLayout]);

  const pressedNotes = useMemo(() => {
    return [...new Set(allPressed.map(id => {
      const k = allLayout.find(k=>k.id===id);
      return k ? { lat: k.note, eng: LAT_TO_ENG[k.note], oct: k.octave } : null;
    }).filter(Boolean))];
  }, [allPressed, allLayout]);

  return (
    <div className="rounded-2xl p-4 border" style={{
      background:"linear-gradient(145deg,#0d0d1a,#0a0a14)",
      borderColor:"#2a3a5a", minHeight:"120px"
    }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Notas activas</p>
          {pressedNotes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pressedNotes.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border"
                  style={{
                    backgroundColor: (NOTE_COLORS_DISPLAY[n.eng]||"#888") + "22",
                    borderColor: NOTE_COLORS_DISPLAY[n.eng]||"#888",
                    color: NOTE_COLORS_DISPLAY[n.eng]||"#888",
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{background:NOTE_COLORS_DISPLAY[n.eng]||"#888"}}/>
                  {n.lat}<span className="opacity-60 text-xs">{n.oct}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm italic">Presioná botones para tocar</p>
          )}
        </div>
        {chord && (
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Acorde detectado</p>
            <p className="text-3xl font-bold" style={{ fontFamily:"serif", color:"#88aaff" }}>
              {chord.name}
            </p>
          </div>
        )}
      </div>
      {pressedNotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse"
              style={{background: bellows==="abriendo" ? "#34d399" : "#f472b6"}}/>
            <span className="text-xs capitalize" style={{color: bellows==="abriendo" ? "#34d399" : "#f472b6"}}>
              {bellows}
            </span>
          </div>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-xs text-gray-500">{pressedNotes.length} nota{pressedNotes.length!==1?"s":""}</span>
        </div>
      )}
    </div>
  );
};

// ─── APP PRINCIPAL DEL BANDONEÓN ──────────────────────────────────────────────
export default function BandoneonTab() {
  const [bellows, setBellows] = useState("abriendo"); // abriendo | cerrando
  const [view, setView]       = useState("ambas");    // ambas | izquierda | derecha
  const [pressedLeft, setPressedLeft]   = useState([]);
  const [pressedRight, setPressedRight] = useState([]);

  const leftLayout  = bellows === "abriendo" ? LEFT_OPEN  : LEFT_CLOSE;
  const rightLayout = bellows === "abriendo" ? RIGHT_OPEN : RIGHT_CLOSE;

  const pressLeft = useCallback((id) => {
    const key = leftLayout.find(k=>k.id===id);
    if (key) playBandoneonNote(key.note, key.octave);
    setPressedLeft(p => p.includes(id) ? p : [...p, id]);
  }, [leftLayout]);

  const releaseLeft = useCallback((id) => {
    setPressedLeft(p => p.filter(x=>x!==id));
  }, []);

  const pressRight = useCallback((id) => {
    const key = rightLayout.find(k=>k.id===id);
    if (key) playBandoneonNote(key.note, key.octave);
    setPressedRight(p => p.includes(id) ? p : [...p, id]);
  }, [rightLayout]);

  const releaseRight = useCallback((id) => {
    setPressedRight(p => p.filter(x=>x!==id));
  }, []);

  // Limpiar al cambiar fuelle
  const changeBellows = (b) => {
    setBellows(b);
    setPressedLeft([]);
    setPressedRight([]);
  };

  return (
    <div className="space-y-5">
      {/* CONTROLES */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Fuelle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-widest">Fuelle:</span>
          <div className="flex gap-1">
            {["abriendo","cerrando"].map(b => (
              <button key={b} onClick={() => changeBellows(b)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border"
                style={{
                  background: bellows===b ? (b==="abriendo"?"#0a2010":"#200a18") : "transparent",
                  borderColor: bellows===b ? (b==="abriendo"?"#34d399":"#f472b6") : "#333",
                  color: bellows===b ? (b==="abriendo"?"#34d399":"#f472b6") : "#666",
                }}>
                {b==="abriendo" ? "↔ Abriendo" : "↔ Cerrando"}
              </button>
            ))}
          </div>
        </div>
        {/* Vista */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-widest">Vista:</span>
          <div className="flex gap-1">
            {[{id:"izquierda",label:"M. Izq"},{id:"ambas",label:"Ambas"},{id:"derecha",label:"M. Der"}].map(v=>(
              <button key={v.id} onClick={()=>setView(v.id)}
                className="px-3 py-1.5 rounded-lg text-xs border"
                style={{
                  background: view===v.id?"#1e2a4a":"transparent",
                  borderColor: view===v.id?"#4466cc":"#333",
                  color: view===v.id?"#88aaff":"#666",
                }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {/* Limpiar */}
        <button onClick={() => { setPressedLeft([]); setPressedRight([]); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-800 text-gray-500 hover:text-gray-300">
          ✕ Limpiar
        </button>
      </div>

      {/* PANEL DE ACORDE */}
      <ChordPanel
        pressedLeft={pressedLeft}
        pressedRight={pressedRight}
        leftLayout={leftLayout}
        rightLayout={rightLayout}
        bellows={bellows}
      />

      {/* TECLADOS */}
      <div className={`flex gap-6 flex-wrap ${view==="ambas" ? "justify-center" : "justify-start"}`}>
        {(view==="ambas"||view==="izquierda") && (
          <div className="flex flex-col items-center">
            <ButtonGrid
              layout={leftLayout}
              pressed={pressedLeft}
              onPress={pressLeft}
              onRelease={releaseLeft}
              title={`Mano Izquierda — ${bellows}`}
              btnSize={view==="ambas" ? 38 : 44}
            />
          </div>
        )}
        {(view==="ambas"||view==="derecha") && (
          <div className="flex flex-col items-center">
            <ButtonGrid
              layout={rightLayout}
              pressed={pressedRight}
              onPress={pressRight}
              onRelease={releaseRight}
              title={`Mano Derecha — ${bellows}`}
              btnSize={view==="ambas" ? 38 : 44}
            />
          </div>
        )}
      </div>

      {/* LEYENDA */}
      <div className="rounded-xl p-4 border border-gray-800 text-xs text-gray-500"
        style={{background:"#0a0a14"}}>
        <p className="font-semibold text-gray-400 mb-2">ℹ️ Sistema Rheinische (bandoneón argentino)</p>
        <p>El bandoneón es <span className="text-gray-300">bisonoro</span>: cada botón produce una nota distinta al abrir y al cerrar el fuelle. Cambiá entre <span className="text-green-400">Abriendo</span> y <span className="text-pink-400">Cerrando</span> para ver las notas de cada movimiento. Presioná varios botones simultáneamente para formar acordes.</p>
      </div>
    </div>
  );
}
