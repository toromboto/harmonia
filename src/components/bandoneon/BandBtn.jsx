import { useCallback } from "react";
import { nc, LAT } from '../../theory/notes.js';
import { OCT_C, BTN_SIZE, snapV } from '../../data/bandoneon.js';

export default function BandBtn({ btn, bellows, pressed, isHeard, onDown, onUp, draggable = false, onMove, oct = null }) {
  const note  = bellows === "abre" ? btn.abre  : btn.cierra;
  const color = bellows === "abre" ? btn.color_abre : btn.color_cierra;
  const isOn  = pressed.includes(btn.id);
  const isAct = isOn || isHeard;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if(draggable && onMove) {
      const ox = e.clientX - btn.x, oy = e.clientY - btn.y;
      const move = e2 => onMove(btn.id, snapV(Math.max(0, e2.clientX - ox)), snapV(Math.max(0, e2.clientY - oy)));
      const up   = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    } else { onDown && onDown(btn); }
  }, [btn, draggable, onMove, onDown]);

  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    if(draggable && onMove) {
      const t = e.touches[0], ox = t.clientX - btn.x, oy = t.clientY - btn.y;
      const move = e2 => { e2.preventDefault(); const t2 = e2.touches[0]; onMove(btn.id, snapV(Math.max(0, t2.clientX - ox)), snapV(Math.max(0, t2.clientY - oy))); };
      const up   = () => { window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up); };
      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", up);
    } else { onDown && onDown(btn); }
  }, [btn, draggable, onMove, onDown]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={() => !draggable && onUp && onUp(btn.id)}
      onMouseLeave={() => !draggable && onUp && onUp(btn.id)}
      onTouchStart={handleTouchStart}
      onTouchEnd={e => { e.preventDefault(); !draggable && onUp && onUp(btn.id); }}
      data-btn={btn.id}
      style={{
        position: "absolute", left: btn.x, top: btn.y,
        width: BTN_SIZE, height: BTN_SIZE, borderRadius: "50%",
        cursor: draggable ? "grab" : "pointer", touchAction: "none", userSelect: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: isAct
          ? `radial-gradient(circle at 36% 30%,${color}ff,${color}cc 55%,${color}88)`
          : `radial-gradient(circle at 36% 30%,${color}99,${color}44 60%,${color}22)`,
        border: `2.5px solid ${isAct ? (isHeard ? "#ffffff" : color) : color + "aa"}`,
        boxShadow: isAct
          ? isHeard ? `0 0 22px #fff,0 0 44px ${color}` : `0 0 18px ${color}cc`
          : "0 2px 8px rgba(0,0,0,.7)",
        transform: isHeard ? "scale(1.1)" : isOn ? "scale(0.95)" : "scale(1)",
        transition: "transform .08s,box-shadow .12s",
        zIndex: isAct ? 20 : 1,
      }}
    >
      <div style={{ position: "absolute", top: 5, left: 9, width: 11, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.22)", filter: "blur(1px)", pointerEvents: "none" }} />
      <span style={{ fontSize: note.length > 2 ? 7 : 9, fontWeight: 800, color: "#fff", fontFamily: "'Courier New',monospace", lineHeight: 1, zIndex: 1, textShadow: "0 1px 3px rgba(0,0,0,.9)" }}>{note}</span>
      <span style={{ fontSize: 6.5, color: "rgba(255,255,255,.9)", fontFamily: "monospace", lineHeight: 1, zIndex: 1, fontWeight: 700 }}>
        {oct !== null ? oct : draggable ? btn.id.replace(/[LRlr]/, "") : ""}
      </span>
    </div>
  );
}
