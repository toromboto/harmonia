export const NC_DEFAULT = {
  C:"#1E50DC",  D:"#28A03C",  E:"#82501E",  F:"#C8B98C",
  G:"#E6C814",  A:"#D22828",  B:"#7828B4",
  "C#":"#2378B4","Db":"#2378B4",
  "D#":"#28B464","Eb":"#28B464",
  "F#":"#D7C050","Gb":"#D7C050",
  "G#":"#DC781E","Ab":"#DC781E",
  "A#":"#A5286E","Bb":"#A5286E",
};

export const PALETTE_KEY = "harmonia_palette_v1";
export const EDIT_HASH   = "murcielago";

export function loadPalette() {
  try {
    const saved = localStorage.getItem(PALETTE_KEY);
    if(!saved) return {...NC_DEFAULT};
    const parsed = JSON.parse(saved);
    const merged = {...NC_DEFAULT, ...parsed};
    const ENH = {"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
    Object.keys(ENH).forEach(s=>{ if(merged[s]) merged[ENH[s]]=merged[s]; });
    return merged;
  } catch { return {...NC_DEFAULT}; }
}

export let NC = {...NC_DEFAULT};

export const nc = (n) => {
  const key = n?.replace(/[0-9]/g,"").trim();
  if(!key) return "#888";
  if(NC[key]) return NC[key];
  const ENH_EXT = {"E#":"F","B#":"C","Cb":"B","Fb":"E","A#":"Bb","D#":"Eb","G#":"Ab","C#":"Db","F#":"Gb"};
  const mapped = ENH_EXT[key];
  if(mapped && NC[mapped]) return NC[mapped];
  return "#888";
};

export const CHROMATIC  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
export const ENHARMONIC = {"C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"};
export const enh = n => ENHARMONIC[n] || n;

export const noteIdx = n => {
  const i = CHROMATIC.indexOf(n);
  if(i >= 0) return i;
  const e = Object.entries(ENHARMONIC).find(([,v]) => v === n);
  return e ? CHROMATIC.indexOf(e[0]) : -1;
};

export const fromRoot = (root, semi) =>
  CHROMATIC[(noteIdx(root) + semi + 120) % 12];

export const SPELL_TABLE = {
  "C":  {0:"C", 1:"Db",2:"D", 3:"Eb",4:"E", 5:"F", 6:"F#",7:"G", 8:"Ab",9:"A", 10:"Bb",11:"B"},
  "C#": {0:"C#",1:"D", 2:"D#",3:"E", 4:"E#",5:"F#",6:"G", 7:"G#",8:"A", 9:"A#",10:"B", 11:"B#"},
  "Db": {0:"Db",1:"D", 2:"Eb",3:"Fb",4:"F", 5:"Gb",6:"G", 7:"Ab",8:"A", 9:"Bb",10:"Cb",11:"C"},
  "D":  {0:"D", 1:"Eb",2:"E", 3:"F", 4:"F#",5:"G", 6:"Ab",7:"A", 8:"Bb",9:"B", 10:"C", 11:"C#"},
  "D#": {0:"D#",1:"E", 2:"E#",3:"F#",4:"G", 5:"G#",6:"A", 7:"A#",8:"B", 9:"B#",10:"C#",11:"D"},
  "Eb": {0:"Eb",1:"E", 2:"F", 3:"Gb",4:"G", 5:"Ab",6:"A", 7:"Bb",8:"Cb",9:"C", 10:"Db",11:"D"},
  "E":  {0:"E", 1:"F", 2:"F#",3:"G", 4:"G#",5:"A", 6:"Bb",7:"B", 8:"C", 9:"C#",10:"D", 11:"D#"},
  "F":  {0:"F", 1:"Gb",2:"G", 3:"Ab",4:"A", 5:"Bb",6:"B", 7:"C", 8:"Db",9:"D", 10:"Eb",11:"E"},
  "F#": {0:"F#",1:"G", 2:"G#",3:"A", 4:"A#",5:"B", 6:"C", 7:"C#",8:"D", 9:"D#",10:"E", 11:"E#"},
  "Gb": {0:"Gb",1:"G", 2:"Ab",3:"A", 4:"Bb",5:"Cb",6:"C", 7:"Db",8:"D", 9:"Eb",10:"Fb",11:"F"},
  "G":  {0:"G", 1:"Ab",2:"A", 3:"Bb",4:"B", 5:"C", 6:"C#",7:"D", 8:"Eb",9:"E", 10:"F", 11:"F#"},
  "G#": {0:"G#",1:"A", 2:"A#",3:"B", 4:"B#",5:"C#",6:"D", 7:"D#",8:"E", 9:"E#",10:"F#",11:"G"},
  "Ab": {0:"Ab",1:"A", 2:"Bb",3:"Cb",4:"C", 5:"Db",6:"D", 7:"Eb",8:"Fb",9:"F", 10:"Gb",11:"G"},
  "A":  {0:"A", 1:"Bb",2:"B", 3:"C", 4:"C#",5:"D", 6:"Eb",7:"E", 8:"F", 9:"F#",10:"G", 11:"G#"},
  "A#": {0:"A#",1:"B", 2:"B#",3:"C#",4:"D", 5:"D#",6:"E", 7:"E#",8:"F#",9:"G", 10:"G#",11:"A"},
  "Bb": {0:"Bb",1:"B", 2:"C", 3:"Db",4:"D", 5:"Eb",6:"Fb",7:"F", 8:"Gb",9:"G", 10:"Ab",11:"A"},
  "B":  {0:"B", 1:"C", 2:"C#",3:"D", 4:"D#",5:"E", 6:"F", 7:"F#",8:"G", 9:"G#",10:"A", 11:"A#"},
};

export function spellInterval(root, semi) {
  const t = SPELL_TABLE[root];
  if(t && t[semi % 12] !== undefined) return t[semi % 12];
  const ri = CHROMATIC.indexOf(root);
  if(ri < 0) return root;
  return CHROMATIC[(ri + semi + 120) % 12];
}

export const buildScale = (root, ivs) => {
  const SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  const FLAT_KEYS = new Set(["F","Bb","Eb","Ab","Db","Gb"]);
  const useFlat = FLAT_KEYS.has(root);
  const SCALE = useFlat ? FLAT : SHARP;
  const ri = SHARP.indexOf(root) !== -1 ? SHARP.indexOf(root) : FLAT.indexOf(root);
  return ivs.map(i => SCALE[(ri + i + 120) % 12]);
};

export const LAT = {
  "DO":"C","DO#":"C#","RE":"D","RE#":"D#","MI":"E","FA":"F",
  "FA#":"F#","SOL":"G","SOL#":"G#","LA":"A","LA#":"A#","SI":"B",
};
export const ENG_LAT = Object.fromEntries(Object.entries(LAT).map(([k,v])=>[v,k]));
