import { nc } from '../../theory/notes.js';
import { playTone } from '../../audio/engine.js';

// Voicing real de piano: botones tocables con nota y octava.
// MI (mano izquierda) en azul, MD (mano derecha) en color tonal.
// Separados por una barra vertical.
export default function VoicingDisplay({ leftVoice = [], rightVoice = [] }) {
  if(!leftVoice.length && !rightVoice.length) return null;

  const Btn = ({ v, hand }) => {
    const color = hand === "L" ? "#4488ff" : nc(v.note);
    return (
      <button
        onClick={() => playTone(v.note, v.oct, 0.8)}
        className="flex flex-col items-center px-3 py-2 rounded-xl border-2 font-bold"
        style={{ backgroundColor: color + "18", borderColor: color, minWidth: "44px" }}
      >
        <span className="text-base" style={{ color }}>{v.note}</span>
        <span className="text-xs font-mono" style={{ color: color + "bb" }}>oct.{v.oct}</span>
        <span className="text-xs mt-0.5" style={{ color: color + "66", fontSize: "9px" }}>{v.role}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {leftVoice.map((v, i) => <Btn key={"L" + i} v={v} hand="L" />)}
      {leftVoice.length > 0 && rightVoice.length > 0 && (
        <span className="text-gray-700 text-lg mb-2">|</span>
      )}
      {rightVoice.map((v, i) => <Btn key={"R" + i} v={v} hand="R" />)}
    </div>
  );
}
