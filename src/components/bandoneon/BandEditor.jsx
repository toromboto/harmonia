import { useState, useCallback, useEffect } from "react";
import { ALL_NOTES_LAT, SNAP, snapV } from '../../data/bandoneon.js';
import BandCanvas from './BandCanvas.jsx';

export default function BandEditor({ initialLeft, initialRight, onSave, onCancel }) {
  const [leftBtns,  setLeftBtns]  = useState(() => initialLeft.map(b => ({...b})));
  const [rightBtns, setRightBtns] = useState(() => initialRight.map(b => ({...b})));
  const [hand,      setHand]      = useState("left");
  const [mode,      setMode]      = useState("abre");
  const [selected,  setSelected]  = useState(null);
  const [showGrid,  setShowGrid]  = useState(true);
  const [showJS,    setShowJS]    = useState(false);
  const [copied,    setCopied]    = useState(false);

  const buttons    = hand === "left" ? leftBtns    : rightBtns;
  const setButtons = hand === "left" ? setLeftBtns : setRightBtns;
  const initials   = hand === "left" ? initialLeft : initialRight;

  const handleMove = useCallback((id, x, y) =>
    setButtons(p => p.map(b => b.id === id ? {...b, x, y} : b)), [setButtons]);
  const handleEdit = useCallback((id, f, v) =>
    setButtons(p => p.map(b => b.id === id ? {...b, [f]: v} : b)), [setButtons]);

  useEffect(() => {
    const h = e => {
      if(!selected) return;
      const step = e.shiftKey ? 10 : SNAP;
      const dirs = { ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] };
      if(!dirs[e.key]) return; e.preventDefault();
      const [dx, dy] = dirs[e.key];
      setButtons(p => p.map(b => b.id === selected ? {...b, x:Math.max(0,b.x+dx), y:Math.max(0,b.y+dy)} : b));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selected, setButtons]);

  const selBtn = buttons.find(b => b.id === selected);

  const jsText = () => {
    const fmt = (arr, name) => {
      const lines = arr.map(b =>
        `  { id:"${b.id}", row:${b.row}, x:${b.x}, y:${b.y}, abre:"${b.abre}", cierra:"${b.cierra}", color_abre:"${b.color_abre}", color_cierra:"${b.color_cierra}", oct_abre:${b.oct_abre??3}, oct_cierra:${b.oct_cierra??3} },`
      );
      return `export const ${name} = [\n${lines.join("\n")}\n];`;
    };
    return `// Pegá esto en src/data/bandoneon.js reemplazando DEFS_L y DEFS_R\n\n` +
      fmt(leftBtns, "DEFS_L") + "\n\n" + fmt(rightBtns, "DEFS_R");
  };

  const pill = (active, v = "orange") => ({
    padding: "5px 12px", borderRadius: 8, border: "none",
    fontFamily: "'Courier New',monospace", fontWeight: 700, fontSize: 10, cursor: "pointer",
    background: active
      ? (v === "orange" ? "linear-gradient(135deg,#a05010,#f5c060)" : "linear-gradient(135deg,#1a4a8a,#4a8af0)")
      : "transparent",
    color: active ? (v === "orange" ? "#0a0502" : "#fff") : "#6a4020",
  });

  return (
    <div style={{ fontFamily: "'Courier New',monospace" }}>
      {/* Banner */}
      <div style={{ marginBottom:12, padding:"8px 14px", background:"#1a0e04", border:"1.5px solid #f5c060", borderRadius:10, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <span style={{ color:"#f5c060", fontWeight:800, fontSize:12 }}>✏️ MODO EDICIÓN</span>
        <span style={{ color:"#7a5030", fontSize:10 }}>Arrastrá · Flechas=2px · Shift=10px</span>
        <button onClick={() => onSave(leftBtns, rightBtns)} style={{ padding:"6px 16px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0d9488,#2dd4bf)", color:"#0a0502", fontWeight:800, fontSize:12, cursor:"pointer", marginLeft:"auto" }}>💾 Guardar y salir</button>
        <button onClick={onCancel} style={{ padding:"6px 12px", borderRadius:9, border:"1px solid #3a2010", background:"transparent", color:"#7a5030", fontSize:11, cursor:"pointer" }}>Cancelar</button>
      </div>

      {/* Controles */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
        <div style={{ display:"flex", background:"#100802", border:"1.5px solid #3a2010", borderRadius:10, padding:3, gap:3 }}>
          <button style={pill(mode === "abre")}   onClick={() => setMode("abre")}>▷ Abre</button>
          <button style={pill(mode === "cierra")} onClick={() => setMode("cierra")}>◁ Cierra</button>
        </div>
        <div style={{ display:"flex", background:"#100802", border:"1.5px solid #2a3060", borderRadius:10, padding:3, gap:3 }}>
          <button style={pill(hand === "left",  "blue")} onClick={() => { setHand("left");  setSelected(null); }}>IZQ {leftBtns.length}</button>
          <button style={pill(hand === "right", "blue")} onClick={() => { setHand("right"); setSelected(null); }}>DER {rightBtns.length}</button>
        </div>
        <button onClick={() => setShowGrid(p => !p)} style={{ padding:"5px 10px", borderRadius:9, border:"1.5px solid #3a2010", background:"#100802", color:showGrid?"#2DD4BF":"#6a4020", fontFamily:"monospace", fontWeight:700, fontSize:10, cursor:"pointer" }}>{showGrid ? "⊞ Grid ON" : "⊞ Grid"}</button>
        <button onClick={() => setButtons(initials.map(b => ({...b})))} style={{ padding:"5px 10px", borderRadius:9, border:"1px solid #3a2010", background:"transparent", color:"#7a5030", fontFamily:"monospace", fontSize:10, cursor:"pointer" }}>⟳ Reset mano</button>
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {/* Canvas */}
        <div style={{ flex:"1 1 380px", minWidth:300 }}>
          <div style={{ overflowX:"auto", paddingBottom:8 }}>
            <BandCanvas buttons={buttons} bellows={mode} pressed={[]} heardIds={[]}
              draggable={true} onMove={handleMove} showGrid={showGrid}
              selected={selected} onSelect={setSelected} />
          </div>

          {/* Info seleccionado */}
          {selBtn && (
            <div style={{ marginTop:8, padding:"8px 12px", background:"#1a0e04", border:"1px solid #3a2010", borderRadius:10 }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:8 }}>
                <span style={{ color:"#f5c060", fontWeight:800, fontSize:12 }}>{selBtn.id}</span>
                <span style={{ color:"#7a5030", fontSize:10 }}>x:{selBtn.x} y:{selBtn.y}</span>
                <div style={{ marginLeft:"auto", display:"flex", gap:3 }}>
                  {[["←",-SNAP,0],["→",SNAP,0],["↑",0,-SNAP],["↓",0,SNAP]].map(([l,dx,dy]) => (
                    <button key={l} onClick={() => setButtons(p => p.map(b => b.id === selected ? {...b, x:Math.max(0,b.x+dx), y:Math.max(0,b.y+dy)} : b))}
                      style={{ width:24, height:24, borderRadius:5, border:"1px solid #3a2010", background:"#100802", color:"#f5c060", fontSize:11, cursor:"pointer", padding:0 }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Abriendo */}
              <div style={{ display:"flex", gap:5, alignItems:"center", flexWrap:"wrap", marginBottom:5, padding:"5px 8px", background:"#0a1408", borderRadius:7, border:"1px solid #2a4010" }}>
                <span style={{ color:"#34d399", fontSize:9, fontWeight:700, width:56 }}>▷ ABRIENDO</span>
                <select value={selBtn.abre} onChange={e => handleEdit(selBtn.id,"abre",e.target.value)}
                  style={{ background:"#1a0e04", color:"#34d399", border:"1px solid #34d39955", borderRadius:5, padding:"2px 4px", fontFamily:"monospace", fontWeight:700, fontSize:10, cursor:"pointer", width:64 }}>
                  {ALL_NOTES_LAT.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{ color:"#6a4020", fontSize:9 }}>oct.</span>
                <select value={selBtn.oct_abre ?? 3} onChange={e => handleEdit(selBtn.id,"oct_abre",parseInt(e.target.value))}
                  style={{ background:"#1a0e04", color:"#34d399", border:"1px solid #34d39955", borderRadius:5, padding:"2px 4px", fontFamily:"monospace", fontWeight:700, fontSize:10, cursor:"pointer", width:44 }}>
                  {[0,1,2,3,4,5,6].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input type="color" value={selBtn.color_abre || "#888"} onChange={e => handleEdit(selBtn.id,"color_abre",e.target.value)}
                  style={{ width:22, height:20, padding:1, borderRadius:4, border:"none", cursor:"pointer" }} />
              </div>
              {/* Cerrando */}
              <div style={{ display:"flex", gap:5, alignItems:"center", flexWrap:"wrap", padding:"5px 8px", background:"#140a14", borderRadius:7, border:"1px solid #401040" }}>
                <span style={{ color:"#f472b6", fontSize:9, fontWeight:700, width:56 }}>◁ CERRANDO</span>
                <select value={selBtn.cierra} onChange={e => handleEdit(selBtn.id,"cierra",e.target.value)}
                  style={{ background:"#1a0e04", color:"#f472b6", border:"1px solid #f472b655", borderRadius:5, padding:"2px 4px", fontFamily:"monospace", fontWeight:700, fontSize:10, cursor:"pointer", width:64 }}>
                  {ALL_NOTES_LAT.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{ color:"#6a4020", fontSize:9 }}>oct.</span>
                <select value={selBtn.oct_cierra ?? 3} onChange={e => handleEdit(selBtn.id,"oct_cierra",parseInt(e.target.value))}
                  style={{ background:"#1a0e04", color:"#f472b6", border:"1px solid #f472b655", borderRadius:5, padding:"2px 4px", fontFamily:"monospace", fontWeight:700, fontSize:10, cursor:"pointer", width:44 }}>
                  {[0,1,2,3,4,5,6].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input type="color" value={selBtn.color_cierra || "#888"} onChange={e => handleEdit(selBtn.id,"color_cierra",e.target.value)}
                  style={{ width:22, height:20, padding:1, borderRadius:4, border:"none", cursor:"pointer" }} />
              </div>
            </div>
          )}

          {/* Exportar JS */}
          <div style={{ marginTop:10, display:"flex", gap:6 }}>
            <button onClick={() => setShowJS(p => !p)} style={{ padding:"4px 12px", borderRadius:7, border:"1px solid #3a2010", background:"#1a0e04", color:"#f5c060", fontFamily:"monospace", fontWeight:700, fontSize:10, cursor:"pointer" }}>
              {showJS ? "Ocultar" : "↓ Ver JS para el repo"}
            </button>
          </div>
          {showJS && (
            <div style={{ position:"relative", marginTop:8 }}>
              <textarea readOnly value={jsText()} style={{ width:"100%", height:140, background:"#080401", color:"#f5c060", border:"1px solid #3a2010", borderRadius:8, padding:8, fontSize:8, fontFamily:"'Courier New',monospace", resize:"vertical", boxSizing:"border-box" }} />
              <button onClick={() => navigator.clipboard.writeText(jsText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
                style={{ position:"absolute", top:6, right:6, padding:"2px 9px", borderRadius:5, border:"1px solid #3a2010", background:copied?"#0d9488":"#1a0e04", color:copied?"#fff":"#7a5030", fontFamily:"monospace", fontSize:9, cursor:"pointer" }}>
                {copied ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div style={{ flex:"0 0 300px", minWidth:260 }}>
          <div style={{ fontSize:10, fontWeight:800, color:"#f5c060", marginBottom:6 }}>TABLA · {hand === "left" ? "IZQUIERDA" : "DERECHA"}</div>
          <div style={{ overflowY:"auto", maxHeight:460, border:"1px solid #2a1608", borderRadius:8 }}>
            <table style={{ borderCollapse:"collapse", fontSize:9, width:"100%", fontFamily:"'Courier New',monospace" }}>
              <thead>
                <tr style={{ background:"#1a0e04", position:"sticky", top:0 }}>
                  {["ID","X","Y","▷ Nota","oct","◁ Nota","oct"].map(h => (
                    <th key={h} style={{ padding:"5px 4px", textAlign:"left", color:"#6a4020", borderBottom:"1px solid #2a1608", whiteSpace:"nowrap", fontSize:8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buttons.map(btn => {
                  const isSel = btn.id === selected;
                  const cNow = mode === "abre" ? btn.color_abre : btn.color_cierra;
                  return (
                    <tr key={btn.id} onClick={() => setSelected(btn.id)}
                      style={{ background:isSel?"rgba(245,192,96,.09)":"transparent", cursor:"pointer", borderBottom:"1px solid rgba(26,14,4,.5)" }}>
                      <td style={{ padding:"2px 4px" }}><span style={{ color:cNow||"#888", fontWeight:700 }}>{btn.id}</span></td>
                      <td style={{ padding:"2px 4px", color:"#7a5030" }}>{btn.x}</td>
                      <td style={{ padding:"2px 4px", color:"#7a5030" }}>{btn.y}</td>
                      <td style={{ padding:"2px 2px" }}>
                        <select value={btn.abre} onChange={e => { e.stopPropagation(); handleEdit(btn.id,"abre",e.target.value); }} onClick={e => e.stopPropagation()}
                          style={{ background:"#1a0e04", color:"#34d399", border:"none", borderRadius:4, padding:"1px 2px", fontFamily:"monospace", fontSize:8, cursor:"pointer", width:48 }}>
                          {ALL_NOTES_LAT.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:"2px 2px" }} onClick={e => e.stopPropagation()}>
                        <select value={btn.oct_abre ?? 3} onChange={e => { e.stopPropagation(); handleEdit(btn.id,"oct_abre",parseInt(e.target.value)); }} onClick={e => e.stopPropagation()}
                          style={{ background:"#1a0e04", color:"#34d399", border:"none", borderRadius:4, padding:"1px 2px", fontFamily:"monospace", fontSize:8, cursor:"pointer", width:30 }}>
                          {[0,1,2,3,4,5,6].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:"2px 2px" }}>
                        <select value={btn.cierra} onChange={e => { e.stopPropagation(); handleEdit(btn.id,"cierra",e.target.value); }} onClick={e => e.stopPropagation()}
                          style={{ background:"#1a0e04", color:"#f472b6", border:"none", borderRadius:4, padding:"1px 2px", fontFamily:"monospace", fontSize:8, cursor:"pointer", width:48 }}>
                          {ALL_NOTES_LAT.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:"2px 2px" }} onClick={e => e.stopPropagation()}>
                        <select value={btn.oct_cierra ?? 3} onChange={e => { e.stopPropagation(); handleEdit(btn.id,"oct_cierra",parseInt(e.target.value)); }} onClick={e => e.stopPropagation()}
                          style={{ background:"#1a0e04", color:"#f472b6", border:"none", borderRadius:4, padding:"1px 2px", fontFamily:"monospace", fontSize:8, cursor:"pointer", width:30 }}>
                          {[0,1,2,3,4,5,6].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
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
