import { BTN_SIZE } from '../../data/bandoneon.js';
import BandBtn from './BandBtn.jsx';

export default function BandCanvas({
  buttons, bellows, pressed, heardIds = [],
  onDown, onUp, draggable = false, onMove,
  showGrid = false, onSelect = null, selected = null,
  mobile = false, octMap = null,
}) {
  const W = Math.max(...buttons.map(b => b.x)) + BTN_SIZE + 16;
  const H = Math.max(...buttons.map(b => b.y)) + BTN_SIZE + 20;
  const MOB_W = 330;
  const zoom  = mobile ? MOB_W / W : 1;

  const canvas = (
    <div
      onClick={() => onSelect && onSelect(null)}
      style={{
        position: "relative", width: W, height: H, flexShrink: 0,
        background: showGrid
          ? `repeating-linear-gradient(0deg,transparent,transparent 9px,rgba(90,58,24,.18) 10px),
             repeating-linear-gradient(90deg,transparent,transparent 9px,rgba(90,58,24,.18) 10px),#0e0701`
          : "linear-gradient(145deg,#281a08,#140e04)",
        border: `2px solid ${draggable ? "#f5c06055" : "#6b4c1e"}`,
        borderRadius: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,.7)",
        touchAction: "none",
        zoom: zoom,
      }}
    >
      {buttons.map(btn => (
        <BandBtn key={btn.id} btn={btn} bellows={bellows}
          pressed={selected ? [selected] : pressed}
          isHeard={heardIds.includes(btn.id)}
          onDown={e => { onSelect && onSelect(btn.id); onDown && onDown(btn); }}
          onUp={onUp} draggable={draggable} onMove={onMove}
          oct={octMap ? octMap[btn.id] : null}
        />
      ))}
    </div>
  );

  if(!mobile) return <div style={{ overflowX: "auto", paddingBottom: 4 }}>{canvas}</div>;
  return <div style={{ width: "100%", overflow: "hidden" }}>{canvas}</div>;
}
