import { useState, useEffect, useCallback, useMemo } from "react";
import { YIN } from "pitchfinder";
import { nc, LAT, ENG_LAT, CHROMATIC } from '../../theory/notes.js';
import { getCtx, MIDI } from '../../audio/engine.js';
import {
  DEFS_L, DEFS_R, buildOctMaps,
  loadBtns, saveBtns, clearBtns, downloadCSV, generateCSS, parseCSV,
  STORAGE_KEY_L,
} from '../../data/bandoneon.js';
import BandCanvas from './BandCanvas.jsx';
import BandEditor from './BandEditor.jsx';

// ─── MODALES ──────────────────────────────────────────────────────────────────
function SavedModal({ cssText, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}>
      <div style={{ background:"#0e0e20", border:"1.5px solid #4466cc", borderRadius:16, padding:"24px 24px 20px", maxWidth:440, width:"100%" }}>
        <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
        <h3 style={{ color:"#88aaff", fontWeight:700, fontSize:17, marginBottom:8 }}>Configuración guardada</h3>
        <p style={{ color:"#9ca3af", fontSize:13, lineHeight:1.6, marginBottom:14 }}>
          Tu configuración se guardó en este dispositivo.
        </p>
        <div style={{ background:"#1a2540", border:"1px solid #4466cc44", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
          <p style={{ color:"#fbbf24", fontWeight:700, fontSize:12, marginBottom:5 }}>📱 ¿Otro dispositivo?</p>
          <p style={{ color:"#9ca3af", fontSize:12, lineHeight:1.6 }}>Se descargó un <b style={{ color:"#88aaff" }}>.csv</b>. Usá <b style={{ color:"#2dd4bf" }}>↑ Importar CSV</b> en el otro.</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => navigator.clipboard.writeText(cssText).then(() => setCopied(true))} style={{ flex:1, padding:"7px", borderRadius:9, border:"1px solid #3a2010", background:"#1a0e04", color:copied?"#2dd4bf":"#f5c060", fontFamily:"monospace", fontWeight:700, fontSize:11, cursor:"pointer" }}>{copied ? "✓ CSS copiado" : "{} CSS"}</button>
          <button onClick={onClose} style={{ flex:2, padding:"7px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#1e2a4a,#4a8af0)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Entendido ✓</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onImport, onClose }) {
  const [error, setError]   = useState("");
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed]   = useState(null);
  const handleFile = e => {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = parseCSV(ev.target.result);
      if(!result || (!result.left.length && !result.right.length)) { setError("CSV inválido."); return; }
      setError(""); setParsed(result); setPreview({ left: result.left.length, right: result.right.length });
    };
    reader.readAsText(file); e.target.value = "";
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}>
      <div style={{ background:"#0e0e20", border:"1.5px solid #2dd4bf44", borderRadius:16, padding:"22px 22px 18px", maxWidth:400, width:"100%" }}>
        <h3 style={{ color:"#2dd4bf", fontWeight:700, fontSize:16, marginBottom:8 }}>📂 Importar configuración</h3>
        <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:"none" }} id="csvInput" />
        <button onClick={() => document.getElementById("csvInput").click()} style={{ width:"100%", padding:9, borderRadius:9, border:"1px solid #2dd4bf44", background:"#0a1a18", color:"#2dd4bf", fontWeight:700, fontSize:13, cursor:"pointer", marginBottom:10 }}>Elegir archivo .csv</button>
        {error && <p style={{ color:"#f87171", fontSize:11, marginBottom:10 }}>⚠ {error}</p>}
        {preview && <div style={{ background:"#0a1a08", border:"1px solid #2dd4bf44", borderRadius:10, padding:"8px 12px", marginBottom:12 }}>
          <p style={{ color:"#4ade80", fontWeight:700, fontSize:12 }}>✓ Válido: Izq {preview.left} · Der {preview.right}</p>
        </div>}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:"7px", borderRadius:9, border:"1px solid #374151", background:"transparent", color:"#6b7280", fontSize:12, cursor:"pointer" }}>Cancelar</button>
          {parsed && <button onClick={() => onImport(parsed.left, parsed.right)} style={{ flex:2, padding:"7px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#134e4a,#2dd4bf)", color:"#0f172a", fontWeight:700, fontSize:13, cursor:"pointer" }}>Aplicar y guardar</button>}
        </div>
      </div>
    </div>
  );
}

// ─── TAB PRINCIPAL ────────────────────────────────────────────────────────────
export default function BandoneonTab() {
  const [leftBtns,    setLeftBtns]    = useState([]);
  const [rightBtns,   setRightBtns]   = useState([]);
  const [editMode,    setEditMode]    = useState(false);
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
  const [isMobile,    setIsMobile]    = useState(false);

  const { OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE } = useMemo(
    () => buildOctMaps(leftBtns, rightBtns), [leftBtns, rightBtns]
  );

  useEffect(() => {
    const { left, right } = loadBtns();
    setLeftBtns(left); setRightBtns(right);
    try { setFromStorage(!!localStorage.getItem(STORAGE_KEY_L)); } catch {}
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Micrófono YIN
  useEffect(() => {
    if(!isListening) { setHeardNote(""); return; }
    let audioCtx = null, stream = null, rafId = null, alive = true;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
        if(!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
        if(audioCtx.state === "suspended") await audioCtx.resume();
        const src      = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        const buf    = new Float32Array(analyser.fftSize);
        const detect = YIN({ sampleRate: audioCtx.sampleRate || 44100 });
        function tick() {
          if(!alive) return;
          analyser.getFloatTimeDomainData(buf);
          const pitch = detect(buf);
          if(pitch && pitch > 50 && pitch < 2000) {
            const noteNum = 12 * (Math.log(pitch / 440) / Math.log(2)) + 69;
            const midiRnd = Math.round(noteNum);
            const eng     = CHROMATIC[midiRnd % 12];
            const octave  = Math.floor(midiRnd / 12) - 1;
            const lat     = ENG_LAT[eng] || "DO";
            setHeardNote(lat + octave);
          } else { setHeardNote(""); }
          rafId = requestAnimationFrame(tick);
        }
        tick();
      } catch(err) {
        if(alive) { setErrorAudio("Error de micrófono: " + (err?.message ?? "permisos denegados")); setIsListening(false); }
      }
    }
    start();
    return () => {
      alive = false;
      if(rafId)    cancelAnimationFrame(rafId);
      if(stream)   stream.getTracks().forEach(t => t.stop());
      if(audioCtx && audioCtx.state !== "closed") audioCtx.close();
    };
  }, [isListening]);

  const heardIdsL = useMemo(() => {
    if(!heardNote) return [];
    const octMap = bellows === "abre" ? OCT_L_OPEN : OCT_L_CLOSE;
    return leftBtns.filter(b => (bellows === "abre" ? b.abre : b.cierra) + (octMap[b.id] ?? "") === heardNote).map(b => b.id);
  }, [heardNote, bellows, leftBtns, OCT_L_OPEN, OCT_L_CLOSE]);

  const heardIdsR = useMemo(() => {
    if(!heardNote) return [];
    const octMap = bellows === "abre" ? OCT_R_OPEN : OCT_R_CLOSE;
    return rightBtns.filter(b => (bellows === "abre" ? b.abre : b.cierra) + (octMap[b.id] ?? "") === heardNote).map(b => b.id);
  }, [heardNote, bellows, rightBtns, OCT_R_OPEN, OCT_R_CLOSE]);

  const activeNotes = useMemo(() => {
    const octL = bellows === "abre" ? OCT_L_OPEN : OCT_L_CLOSE;
    const octR = bellows === "abre" ? OCT_R_OPEN : OCT_R_CLOSE;
    const all = [
      ...pressedL.map(id => { const b = leftBtns.find(x => x.id === id); if(!b) return ""; const nota = LAT[bellows === "abre" ? b.abre : b.cierra] ?? ""; return nota ? nota + (octL[id] ?? "") : ""; }),
      ...pressedR.map(id => { const b = rightBtns.find(x => x.id === id); if(!b) return ""; const nota = LAT[bellows === "abre" ? b.abre : b.cierra] ?? ""; return nota ? nota + (octR[id] ?? "") : ""; }),
    ].filter(n => n.trim());
    return [...new Set(all)];
  }, [pressedL, pressedR, bellows, leftBtns, rightBtns, OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE]);

  const playBtn = useCallback((btn, side) => {
    const note = bellows === "abre" ? btn.abre : btn.cierra;
    const octMap = side === "L"
      ? (bellows === "abre" ? OCT_L_OPEN : OCT_L_CLOSE)
      : (bellows === "abre" ? OCT_R_OPEN : OCT_R_CLOSE);
    const oct = octMap[btn.id] ?? (side === "L" ? 2 : 4);
    const eng = LAT[note] || note;
    try {
      const ctx = getCtx(); if(!ctx) return;
      if(ctx.state === "suspended") ctx.resume();
      [1,2,3].forEach((h, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sawtooth";
        osc.frequency.value = 440 * Math.pow(2, ((MIDI[eng] ?? 60) + (oct - 4) * 12 + Math.log2(h) * 12) / 12);
        const v = [0.22,0.10,0.05][i];
        gain.gain.setValueAtTime(v, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        osc.start(); osc.stop(ctx.currentTime + 1.0);
      });
    } catch(e) {}
  }, [bellows, OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE]);

  const downL = useCallback(btn => { playBtn(btn,"L"); setPressedL(p => [...new Set([...p,btn.id])]); }, [playBtn]);
  const upL   = useCallback(id  => setPressedL(p => p.filter(x => x !== id)), []);
  const downR = useCallback(btn => { playBtn(btn,"R"); setPressedR(p => [...new Set([...p,btn.id])]); }, [playBtn]);
  const upR   = useCallback(id  => setPressedR(p => p.filter(x => x !== id)), []);

  const handleSave = useCallback((left, right) => {
    setLeftBtns(left); setRightBtns(right);
    saveBtns(left, right); downloadCSV(left, right);
    setCSSText(generateCSS(left, right));
    setEditMode(false); setShowSaved(true); setFromStorage(true);
  }, []);

  const handleImport = useCallback((left, right) => {
    setLeftBtns(left); setRightBtns(right);
    saveBtns(left, right); setFromStorage(true); setShowImport(false);
  }, []);

  const pill = (active, v = "orange") => ({
    padding:"5px 12px", borderRadius:8, border:"none", fontFamily:"'Courier New',monospace",
    fontWeight:700, fontSize:10, cursor:"pointer", transition:"all .18s",
    background: active ? (v==="orange"?"linear-gradient(135deg,#a05010,#f5c060)":"linear-gradient(135deg,#1a4a8a,#4a8af0)") : "transparent",
    color: active ? (v==="orange"?"#0a0502":"#fff") : "#6a4020",
  });

  if(!leftBtns.length) return <div style={{ color:"#555", padding:20, fontSize:13 }}>Cargando...</div>;
  if(editMode) return <BandEditor initialLeft={leftBtns} initialRight={rightBtns} onSave={handleSave} onCancel={() => setEditMode(false)} />;

  return (
    <div style={{ fontFamily:"'Courier New',monospace" }}>
      {/* Barra herramientas */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:14, padding:"8px 12px", background:"#080810", border:"1px solid #1e1e2e", borderRadius:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, flex:"1 1 auto" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:fromStorage?"#2dd4bf":"#6b7280" }} />
          <span style={{ fontSize:10, color:fromStorage?"#2dd4bf":"#6b7280", fontFamily:"monospace" }}>
            {fromStorage ? "Config. personalizada" : "Config. por defecto"}
          </span>
        </div>
        <button onClick={() => { setIsListening(false); setEditMode(true); }} style={{ padding:"5px 13px", borderRadius:9, border:"1px solid #4466cc", background:"#1e2a4a", color:"#88aaff", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"monospace" }}>✏️ Editar teclado</button>
        <button onClick={() => setShowImport(true)} style={{ padding:"5px 13px", borderRadius:9, border:"1px solid #2dd4bf44", background:"transparent", color:"#2dd4bf", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"monospace" }}>↑ Importar CSV</button>
        {fromStorage && (
          <button onClick={() => { clearBtns(); const {left,right} = loadBtns(); setLeftBtns(left); setRightBtns(right); setFromStorage(false); }}
            style={{ padding:"5px 10px", borderRadius:9, border:"1px solid #374151", background:"transparent", color:"#6b7280", fontSize:10, cursor:"pointer", fontFamily:"monospace" }}>
            ⟳ Defaults
          </button>
        )}
      </div>

      {/* Panel mic */}
      <div style={{ marginBottom:10, padding:"8px 12px", background:"#0a0602", border:"1.5px dashed #5a3018", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6, minHeight:56 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:"1 1 auto" }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:isListening?"#2DD4BF":"#4a2e10", boxShadow:isListening?"0 0 8px #2DD4BF":"none", flexShrink:0 }} />
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:"#eab308" }}>MODO ESCUCHA FÍSICA</div>
            <div style={{ fontSize:8, color:"#6a4020" }}>Tocá tu instrumento. Los botones con esa nota brillan en blanco.</div>
          </div>
        </div>
        {isListening && (
          <div style={{ background:"#0c0c1a", border:"1px solid #88aaff44", padding:"3px 10px", borderRadius:8, minWidth:55, textAlign:"center" }}>
            <span style={{ fontSize:8, color:"#6a4020", display:"block" }}>NOTA MIC</span>
            <span style={{ fontSize:13, fontWeight:900, color:heardNote?"#88aaff":"#4a2e10" }}>
              {heardNote ? heardNote.replace(/(\d+)$/, "") + " " + (heardNote.match(/\d+$/) || [""])[0] : "..."}
            </span>
          </div>
        )}
        <button onClick={() => { setIsListening(p => !p); setErrorAudio(""); }}
          style={{ padding:"5px 12px", borderRadius:9, border:"none", fontFamily:"monospace", fontWeight:700, fontSize:10, cursor:"pointer", background:isListening?"linear-gradient(135deg,#941c1c,#ef4444)":"linear-gradient(135deg,#134e4a,#2dd4bf)", color:isListening?"#fff":"#0f172a" }}>
          {isListening ? "✕ Apagar Mic" : "🎙️ Escuchar"}
        </button>
      </div>
      {errorAudio && <div style={{ marginBottom:10, padding:"5px 10px", background:"#270808", border:"1px solid #ef444455", borderRadius:6, fontSize:9, color:"#f87171" }}>⚠ {errorAudio}</div>}

      {/* Fuelle / Vista */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
        <div style={{ display:"flex", background:"#100802", border:"1.5px solid #3a2010", borderRadius:10, padding:3, gap:2 }}>
          {[["abre","▷ Abre"],["cierra","◁ Cierra"]].map(([b,l]) => (
            <button key={b} style={{ ...pill(bellows===b), padding:isMobile?"5px 10px":"5px 12px" }}
              onClick={() => { setBellows(b); setPressedL([]); setPressedR([]); }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex", background:"#100802", border:"1.5px solid #2a3060", borderRadius:10, padding:3, gap:2 }}>
          {[["ambas","Ambas"],["izquierda","IZQ"],["derecha","DER"]].map(([v,l]) => (
            <button key={v} style={{ ...pill(view===v,"blue"), padding:isMobile?"5px 8px":"5px 12px" }}
              onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
        <button onClick={() => { setPressedL([]); setPressedR([]); }}
          style={{ padding:"5px 9px", borderRadius:9, border:"1px solid #3a2010", background:"transparent", color:"#6a4020", fontFamily:"monospace", fontSize:10, cursor:"pointer", marginLeft:"auto" }}>✕</button>
      </div>

      {/* Notas activas */}
      <div style={{ minHeight:44, marginBottom:8 }}>
        {activeNotes.length > 0 && (
          <div style={{ marginBottom:10, padding:isMobile?"6px 10px":"7px 12px", background:"#0c0c1a", border:"1px solid #2a2a4a", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:5 }}>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", flex:"1 1 auto" }}>
              {activeNotes.map(n => {
                const notaPura = n.replace(/\d+$/, "");
                const oct      = (n.match(/\d+$/) || [""])[0];
                const engKey   = LAT[notaPura] || notaPura;
                return (
                  <span key={n} style={{ padding:"2px 8px", borderRadius:20, background:nc(engKey)+"22", border:`1px solid ${nc(engKey)}`, color:nc(engKey), fontWeight:700, fontSize:isMobile?10:11 }}>
                    {notaPura}<span style={{ fontSize:"0.75em", opacity:.7, marginLeft:1 }}>{oct}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div style={{ display:"flex", flexDirection:isMobile?"column":"row", gap:isMobile?10:14, flexWrap:isMobile?"nowrap":"wrap", overflowX:isMobile?"hidden":"auto", paddingBottom:8 }}>
        {(view==="ambas"||view==="izquierda") && (
          <div style={{ flex:isMobile?"none":"0 0 auto", width:isMobile?"100%":"auto" }}>
            <div style={{ fontSize:9, color:"#7a5030", marginBottom:5, letterSpacing:"0.12em" }}>
              MANO IZQUIERDA · {leftBtns.length} botones
            </div>
            <BandCanvas buttons={leftBtns} bellows={bellows}
              pressed={pressedL} heardIds={heardIdsL}
              onDown={downL} onUp={upL} mobile={isMobile}
              octMap={bellows==="abre" ? OCT_L_OPEN : OCT_L_CLOSE} />
          </div>
        )}
        {(view==="ambas"||view==="derecha") && (
          <div style={{ flex:isMobile?"none":"0 0 auto", width:isMobile?"100%":"auto" }}>
            <div style={{ fontSize:9, color:"#7a5030", marginBottom:5, letterSpacing:"0.12em" }}>
              MANO DERECHA · {rightBtns.length} botones
            </div>
            <BandCanvas buttons={rightBtns} bellows={bellows}
              pressed={pressedR} heardIds={heardIdsR}
              onDown={downR} onUp={upR} mobile={isMobile}
              octMap={bellows==="abre" ? OCT_R_OPEN : OCT_R_CLOSE} />
          </div>
        )}
      </div>

      <div style={{ marginTop:10, padding:"7px 11px", background:"#0a0a12", border:"1px solid #1a1a2a", borderRadius:8, fontSize:11, color:"#555" }}>
        <b style={{ color:"#7a5030" }}>Sistema Rheinische</b> · 71 botones · Bisonoro:{" "}
        <span style={{ color:"#34d399" }}>abrir</span> y <span style={{ color:"#f472b6" }}>cerrar</span>.
      </div>

      {showSaved  && <SavedModal cssText={cssText} onClose={() => setShowSaved(false)} />}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
    </div>
  );
}
