import { nc } from '../../theory/notes.js';
import { playTone } from '../../audio/engine.js';

// Píldora de nota con punto de color tonal. Tocable al click.
export default function Nota({ note, size = "md" }) {
  const color = nc(note);
  const sz = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold border-2 cursor-pointer ${sz[size]}`}
      style={{ backgroundColor: color + "18", borderColor: color, color }}
      onClick={() => playTone(note, 4, 0.7)}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {note}
    </span>
  );
}
