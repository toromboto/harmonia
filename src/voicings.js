import { noteIdx, spellInterval } from './notes.js';
import { FORMULAS } from './formulas.js';

const MIDI_CHROMA = {
  C:0,"C#":1,"Db":1,D:2,"D#":3,"Eb":3,E:4,"E#":5,"Fb":4,
  F:5,"F#":6,"Gb":6,G:7,"G#":8,"Ab":8,
  A:9,"A#":10,"Bb":10,B:11,"B#":0,"Cb":11,
};

export function buildVoicing(root, quality) {
  const f      = FORMULAS[quality] || FORMULAS["maj"];
  const ivs    = f.intervals;
  const has    = s => ivs.some(i => (i % 12) === s % 12);
  const has7   = has(10) || has(11);
  const sp     = semi => spellInterval(root, semi);
  const rootAbs = noteIdx(root);

  const L = [];
  L.push({ note: root, role: "Tónica", oct: 2 });
  if(!has7 && has(7) && !has(6) && !has(8))
    L.push({ note: sp(7), role: "Quinta", oct: 2 });

  const R = [];
  let prevAbs = -1;
  const push = (semi, role, octHint) => {
    const chroma = (rootAbs + semi + 120) % 12;
    let oct = octHint;
    let abs = oct * 12 + chroma;
    while(abs <= prevAbs) { oct++; abs = oct * 12 + chroma; }
    prevAbs = abs;
    R.push({ note: sp(semi), role, oct });
  };

  if(has(3)) push(3, "3ª menor", 3);
  if(has(4)) push(4, "3ª mayor", 3);

  if(!has7) {
    if(has(7)) push(7, "5ª justa", 3);
    if(has(6)) push(6, "5ª dim.",  3);
    if(has(8)) push(8, "5ª aum.",  3);
  } else {
    if(has(10)) push(10, "7ª menor", 4);
    if(has(11)) push(11, "7ª mayor", 4);
    const EXT = {1:"b9",2:"9ª",3:"#9",5:"11ª",6:"#11",8:"b13",9:"13ª"};
    ivs.filter(i => i > 11).forEach(i => push(i % 12, EXT[i % 12] || "ext.", 4));
  }

  return { L, R };
}

export function verifyVoicing(v) {
  const abs = n => n.oct * 12 + (MIDI_CHROMA[n.note] ?? 0);
  const maxL = Math.max(...v.L.map(abs));
  if(!v.R.length) return true;
  if(abs(v.R[0]) <= maxL) return false;
  for(let i = 1; i < v.R.length; i++)
    if(abs(v.R[i]) <= abs(v.R[i-1])) return false;
  return true;
}
