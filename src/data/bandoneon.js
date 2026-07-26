// ─── COLORES POR OCTAVA ───────────────────────────────────────────────────────
export const OCT_C = {
  2:{bg:"#7c3aed",border:"#6d28d9"},
  3:{bg:"#ea580c",border:"#c2410c"},
  4:{bg:"#059669",border:"#047857"},
  5:{bg:"#db2777",border:"#be185d"},
  6:{bg:"#2563eb",border:"#1d4ed8"},
};

// ─── NOTAS EN NOTACIÓN LATINA ─────────────────────────────────────────────────
export const ALL_NOTES_LAT = ["DO","DO#","RE","RE#","MI","FA","FA#","SOL","SOL#","LA","LA#","SI"];

// ─── CONSTANTES DE UI ─────────────────────────────────────────────────────────
export const BTN_SIZE = 44;
export const SNAP     = 2;
export const snapV    = v => Math.round(v / SNAP) * SNAP;

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
export const STORAGE_KEY_L = "bandoneon_left_v1";
export const STORAGE_KEY_R = "bandoneon_right_v1";

// ─── LAYOUT RHEINISCHE 71 BOTONES ─────────────────────────────────────────────
// Sistema bisonoro: cada botón produce una nota distinta al abrir y al cerrar.
// Posiciones (x,y) en píxeles, oct_abre/oct_cierra = octava real del instrumento.
export const DEFS_L = [
  { id:"L01", row:0, x:208, y:46,  abre:"SOL#", cierra:"SOL#", color_abre:"#ff6a00", color_cierra:"#ff6a00", oct_abre:0, oct_cierra:2 },
  { id:"L02", row:0, x:308, y:40,  abre:"LA#",  cierra:"LA#",  color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:0, oct_cierra:0 },
  { id:"L03", row:0, x:416, y:42,  abre:"DO#",  cierra:"RE#",  color_abre:"#01c7fc", color_cierra:"#84cc16", oct_abre:1, oct_cierra:0 },
  { id:"L04", row:0, x:526, y:58,  abre:"FA",   cierra:"RE#",  color_abre:"#d38301", color_cierra:"#84cc16", oct_abre:1, oct_cierra:2 },
  { id:"L05", row:0, x:640, y:78,  abre:"SOL#", cierra:"SOL",  color_abre:"#ff6a00", color_cierra:"#fefb41", oct_abre:2, oct_cierra:2 },
  { id:"L06", row:1, x:64,  y:126, abre:"MI",   cierra:"RE",   color_abre:"#583300", color_cierra:"#587934", oct_abre:0, oct_cierra:0 },
  { id:"L07", row:1, x:162, y:106, abre:"LA",   cierra:"RE",   color_abre:"#a62c17", color_cierra:"#587934", oct_abre:2, oct_cierra:1 },
  { id:"L08", row:1, x:258, y:96,  abre:"SOL",  cierra:"LA#",  color_abre:"#fefb41", color_cierra:"#e63b7a", oct_abre:1, oct_cierra:1 },
  { id:"L09", row:1, x:358, y:98,  abre:"RE#",  cierra:"DO",   color_abre:"#84cc16", color_cierra:"#285ff4", oct_abre:1, oct_cierra:2 },
  { id:"L10", row:1, x:472, y:108, abre:"FA",   cierra:"DO#",  color_abre:"#d38301", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:2 },
  { id:"L11", row:1, x:576, y:108, abre:"LA#",  cierra:"DO",   color_abre:"#e63b7a", color_cierra:"#285ff4", oct_abre:1, oct_cierra:1 },
  { id:"L12", row:1, x:680, y:142, abre:"FA",   cierra:"FA#",  color_abre:"#d38301", color_cierra:"#feb43f", oct_abre:0, oct_cierra:2 },
  { id:"L13", row:2, x:110, y:172, abre:"RE",   cierra:"SOL",  color_abre:"#587934", color_cierra:"#fefb41", oct_abre:1, oct_cierra:0 },
  { id:"L14", row:2, x:210, y:156, abre:"LA",   cierra:"SOL",  color_abre:"#a62c17", color_cierra:"#fefb41", oct_abre:1, oct_cierra:1 },
  { id:"L15", row:2, x:302, y:154, abre:"DO",   cierra:"SI",   color_abre:"#285ff4", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:1 },
  { id:"L16", row:2, x:410, y:162, abre:"MI",   cierra:"RE",   color_abre:"#583300", color_cierra:"#587934", oct_abre:2, oct_cierra:2 },
  { id:"L17", row:2, x:528, y:164, abre:"DO",   cierra:"FA",   color_abre:"#285ff4", color_cierra:"#d38301", oct_abre:1, oct_cierra:2 },
  { id:"L18", row:2, x:618, y:170, abre:"SOL",  cierra:"FA#",  color_abre:"#fefb41", color_cierra:"#feb43f", oct_abre:0, oct_cierra:0 },
  { id:"L19", row:3, x:66,  y:252, abre:"MI",   cierra:"LA",   color_abre:"#583300", color_cierra:"#a62c17", oct_abre:1, oct_cierra:1 },
  { id:"L20", row:3, x:158, y:230, abre:"SOL#", cierra:"MI",   color_abre:"#ff6a00", color_cierra:"#583300", oct_abre:1, oct_cierra:1 },
  { id:"L21", row:3, x:254, y:222, abre:"SI",   cierra:"LA",   color_abre:"#5e30eb", color_cierra:"#a62c17", oct_abre:1, oct_cierra:1 },
  { id:"L22", row:3, x:354, y:218, abre:"RE",   cierra:"DO#",  color_abre:"#587934", color_cierra:"#01c7fc", oct_abre:2, oct_cierra:2 },
  { id:"L23", row:3, x:458, y:224, abre:"FA#",  cierra:"MI",   color_abre:"#feb43f", color_cierra:"#583300", oct_abre:2, oct_cierra:2 },
  { id:"L24", row:3, x:560, y:234, abre:"DO#",  cierra:"SOL#", color_abre:"#00a1d8", color_cierra:"#ff6a00", oct_abre:2, oct_cierra:1 },
  { id:"L25", row:3, x:646, y:246, abre:"FA#",  cierra:"SI",   color_abre:"#feb43f", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:0 },
  { id:"L26", row:4, x:26,  y:328, abre:"RE",   cierra:"MI",   color_abre:"#587934", color_cierra:"#754400", oct_abre:0, oct_cierra:0 },
  { id:"L27", row:4, x:110, y:308, abre:"SI",   cierra:"MI",   color_abre:"#5e30eb", color_cierra:"#583300", oct_abre:0, oct_cierra:1 },
  { id:"L28", row:4, x:204, y:294, abre:"SOL",  cierra:"SOL#", color_abre:"#705200", color_cierra:"#ecac22", oct_abre:2, oct_cierra:2 },
  { id:"L29", row:4, x:298, y:288, abre:"LA",   cierra:"LA",   color_abre:"#a62c17", color_cierra:"#a62c17", oct_abre:2, oct_cierra:0 },
  { id:"L30", row:4, x:390, y:286, abre:"RE#",  cierra:"SI",   color_abre:"#84cc16", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:0 },
  { id:"L31", row:4, x:496, y:296, abre:"FA#",  cierra:"FA",   color_abre:"#feb43f", color_cierra:"#d38301", oct_abre:1, oct_cierra:0 },
  { id:"L32", row:4, x:590, y:306, abre:"RE#",  cierra:"DO#",  color_abre:"#84cc16", color_cierra:"#01c7fc", oct_abre:0, oct_cierra:0 },
  { id:"L33", row:4, x:674, y:324, abre:"DO",   cierra:"FA",   color_abre:"#285ff4", color_cierra:"#d38301", oct_abre:0, oct_cierra:0 },
];

export const DEFS_R = [
  { id:"R01", row:0, x:174, y:0,   abre:"SI",   cierra:"SI",   color_abre:"#5e30eb", color_cierra:"#5e30eb", oct_abre:1, oct_cierra:2 },
  { id:"R02", row:0, x:274, y:0,   abre:"SOL#", cierra:"SOL#", color_abre:"#ff6a00", color_cierra:"#ff6a00", oct_abre:4, oct_cierra:4 },
  { id:"R03", row:0, x:376, y:0,   abre:"SOL",  cierra:"FA#",  color_abre:"#fefb41", color_cierra:"#ffc777", oct_abre:1, oct_cierra:4 },
  { id:"R04", row:0, x:484, y:0,   abre:"FA",   cierra:"FA",   color_abre:"#a96800", color_cierra:"#a96800", oct_abre:4, oct_cierra:2 },
  { id:"R05", row:0, x:220, y:38,  abre:"LA",   cierra:"SOL",  color_abre:"#a62c17", color_cierra:"#fefb41", oct_abre:4, oct_cierra:1 },
  { id:"R06", row:0, x:326, y:38,  abre:"FA#",  cierra:"LA#",  color_abre:"#ffc777", color_cierra:"#e63b7a", oct_abre:4, oct_cierra:3 },
  { id:"R07", row:0, x:432, y:40,  abre:"MI",   cierra:"DO",   color_abre:"#583300", color_cierra:"#285ff4", oct_abre:4, oct_cierra:4 },
  { id:"R08", row:1, x:128, y:46,  abre:"DO#",  cierra:"DO",   color_abre:"#01c7fc", color_cierra:"#285ff4", oct_abre:2, oct_cierra:2 },
  { id:"R09", row:1, x:528, y:50,  abre:"RE#",  cierra:"RE#",  color_abre:"#84cc16", color_cierra:"#84cc16", oct_abre:4, oct_cierra:4 },
  { id:"R10", row:1, x:88,  y:104, abre:"DO",   cierra:"RE",   color_abre:"#285ff4", color_cierra:"#587934", oct_abre:2, oct_cierra:2 },
  { id:"R11", row:1, x:178, y:98,  abre:"RE",   cierra:"DO#",  color_abre:"#587934", color_cierra:"#01c7fc", oct_abre:2, oct_cierra:2 },
  { id:"R12", row:1, x:280, y:86,  abre:"SOL",  cierra:"SOL#", color_abre:"#fefb41", color_cierra:"#ff6a00", oct_abre:2, oct_cierra:2 },
  { id:"R13", row:1, x:388, y:86,  abre:"LA#",  cierra:"LA#",  color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:3, oct_cierra:2 },
  { id:"R14", row:1, x:484, y:94,  abre:"DO",   cierra:"MI",   color_abre:"#285ff4", color_cierra:"#583300", oct_abre:4, oct_cierra:3 },
  { id:"R15", row:1, x:572, y:114, abre:"RE",   cierra:"RE",   color_abre:"#587934", color_cierra:"#587934", oct_abre:4, oct_cierra:4 },
  { id:"R16", row:2, x:42,  y:188, abre:"SI",   cierra:"DO",   color_abre:"#5e30eb", color_cierra:"#285ff4", oct_abre:2, oct_cierra:3 },
  { id:"R17", row:2, x:136, y:168, abre:"MI",   cierra:"DO#",  color_abre:"#583300", color_cierra:"#01c7fc", oct_abre:2, oct_cierra:3 },
  { id:"R18", row:2, x:236, y:156, abre:"DO#",  cierra:"FA#",  color_abre:"#01c7fc", color_cierra:"#ffc777", oct_abre:3, oct_cierra:3 },
  { id:"R19", row:2, x:342, y:148, abre:"FA#",  cierra:"SI",   color_abre:"#ffc777", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:1 },
  { id:"R20", row:2, x:436, y:156, abre:"LA",   cierra:"SI",   color_abre:"#a62c17", color_cierra:"#5e30eb", oct_abre:2, oct_cierra:3 },
  { id:"R21", row:2, x:530, y:164, abre:"DO",   cierra:"RE",   color_abre:"#285ff4", color_cierra:"#587934", oct_abre:3, oct_cierra:3 },
  { id:"R22", row:2, x:612, y:184, abre:"MI",   cierra:"SOL",  color_abre:"#583300", color_cierra:"#fefb41", oct_abre:3, oct_cierra:4 },
  { id:"R23", row:2, x:0,   y:262, abre:"LA",   cierra:"RE",   color_abre:"#a62c17", color_cierra:"#587934", oct_abre:1, oct_cierra:3 },
  { id:"R24", row:2, x:94,  y:246, abre:"FA",   cierra:"FA",   color_abre:"#a96800", color_cierra:"#a96800", oct_abre:2, oct_cierra:3 },
  { id:"R25", row:3, x:188, y:232, abre:"LA#",  cierra:"MI",   color_abre:"#e63b7a", color_cierra:"#583300", oct_abre:2, oct_cierra:2 },
  { id:"R26", row:3, x:284, y:224, abre:"SOL#", cierra:"LA",   color_abre:"#ff6a00", color_cierra:"#a62c17", oct_abre:2, oct_cierra:2 },
  { id:"R27", row:3, x:386, y:224, abre:"SI",   cierra:"DO#",  color_abre:"#5e30eb", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:4 },
  { id:"R28", row:3, x:478, y:232, abre:"RE",   cierra:"MI",   color_abre:"#587934", color_cierra:"#583300", oct_abre:3, oct_cierra:4 },
  { id:"R29", row:3, x:570, y:246, abre:"SOL#", cierra:"LA",   color_abre:"#ff6a00", color_cierra:"#a62c17", oct_abre:3, oct_cierra:3 },
  { id:"R30", row:3, x:654, y:266, abre:"SI",   cierra:"DO#",  color_abre:"#5e30eb", color_cierra:"#01c7fc", oct_abre:3, oct_cierra:4 },
  { id:"R31", row:3, x:26,  y:328, abre:"LA#",  cierra:"LA#",  color_abre:"#e63b7a", color_cierra:"#e63b7a", oct_abre:1, oct_cierra:1 },
  { id:"R32", row:3, x:122, y:312, abre:"RE#",  cierra:"RE#",  color_abre:"#84cc16", color_cierra:"#84cc16", oct_abre:2, oct_cierra:3 },
  { id:"R33", row:4, x:220, y:298, abre:"FA",   cierra:"FA",   color_abre:"#a96800", color_cierra:"#a96800", oct_abre:3, oct_cierra:4 },
  { id:"R34", row:4, x:316, y:296, abre:"RE#",  cierra:"MI",   color_abre:"#84cc16", color_cierra:"#583300", oct_abre:3, oct_cierra:4 },
  { id:"R35", row:4, x:412, y:300, abre:"FA#",  cierra:"SOL#", color_abre:"#ffc777", color_cierra:"#ff6a00", oct_abre:3, oct_cierra:3 },
  { id:"R36", row:4, x:500, y:308, abre:"LA",   cierra:"SI",   color_abre:"#a62c17", color_cierra:"#5e30eb", oct_abre:3, oct_cierra:3 },
  { id:"R37", row:4, x:594, y:322, abre:"DO#",  cierra:"MI",   color_abre:"#01c7fc", color_cierra:"#583300", oct_abre:4, oct_cierra:4 },
  { id:"R38", row:4, x:680, y:346, abre:"SOL",  cierra:"RE#",  color_abre:"#fefb41", color_cierra:"#84cc16", oct_abre:3, oct_cierra:2 },
];

// ─── MAPAS DE OCTAVA ─────────────────────────────────────────────────────────
export function buildOctMaps(leftBtns, rightBtns) {
  const OCT_L_OPEN={}, OCT_L_CLOSE={}, OCT_R_OPEN={}, OCT_R_CLOSE={};
  leftBtns.forEach(b  => { OCT_L_OPEN[b.id]=b.oct_abre??2;  OCT_L_CLOSE[b.id]=b.oct_cierra??2; });
  rightBtns.forEach(b => { OCT_R_OPEN[b.id]=b.oct_abre??4;  OCT_R_CLOSE[b.id]=b.oct_cierra??4; });
  return { OCT_L_OPEN, OCT_L_CLOSE, OCT_R_OPEN, OCT_R_CLOSE };
}

// ─── PERSISTENCIA LOCAL ───────────────────────────────────────────────────────
export function loadBtns() {
  try {
    const rawL = localStorage.getItem(STORAGE_KEY_L);
    const rawR = localStorage.getItem(STORAGE_KEY_R);
    const mergeOct = (loaded, defaults) => loaded.map(b => {
      if(b.oct_abre !== undefined) return b;
      const def = defaults.find(d => d.id === b.id);
      return {...b, oct_abre: def?.oct_abre ?? 3, oct_cierra: def?.oct_cierra ?? 3};
    });
    return {
      left:  rawL ? mergeOct(JSON.parse(rawL), DEFS_L) : DEFS_L.map(b=>({...b})),
      right: rawR ? mergeOct(JSON.parse(rawR), DEFS_R) : DEFS_R.map(b=>({...b})),
    };
  } catch { return { left: DEFS_L.map(b=>({...b})), right: DEFS_R.map(b=>({...b})) }; }
}

export function saveBtns(left, right) {
  try {
    localStorage.setItem(STORAGE_KEY_L, JSON.stringify(left));
    localStorage.setItem(STORAGE_KEY_R, JSON.stringify(right));
  } catch(e) {}
}

export function clearBtns() {
  localStorage.removeItem(STORAGE_KEY_L);
  localStorage.removeItem(STORAGE_KEY_R);
}

// ─── CSV / EXPORTACIÓN ────────────────────────────────────────────────────────
export function btnsToCSV(left, right) {
  const h = "id,row,x,y,abre,cierra,color_abre,color_cierra,oct_abre,oct_cierra";
  const rows = [...left,...right].map(b =>
    `${b.id},${b.row},${b.x},${b.y},${b.abre},${b.cierra},${b.color_abre},${b.color_cierra},${b.oct_abre??3},${b.oct_cierra??3}`
  );
  return [h,...rows].join("\n");
}

export function downloadCSV(left, right) {
  const blob = new Blob([btnsToCSV(left,right)], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `bandoneon_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function generateCSS(left, right) {
  return [...left,...right].map(b =>
    `/* ${b.id} */ [data-btn="${b.id}"]{position:absolute;left:${b.x}px;top:${b.y}px;--ca:${b.color_abre};--cc:${b.color_cierra};}`
  ).join("\n");
}

export function parseCSV(text) {
  try {
    const lines = text.trim().split("\n").filter(l=>l.trim());
    const data  = lines[0].toLowerCase().startsWith("id") ? lines.slice(1) : lines;
    const all   = data.map(line => {
      const [id,row,x,y,abre,cierra,color_abre,color_cierra,oct_abre,oct_cierra] = line.split(",").map(s=>s.trim());
      if(!id||!abre) return null;
      return {
        id, row:parseInt(row)||0, x:parseInt(x)||0, y:parseInt(y)||0,
        abre:abre||"DO", cierra:cierra||"DO",
        color_abre:color_abre||"", color_cierra:color_cierra||"",
        oct_abre:  oct_abre  !==undefined&&oct_abre  !=="" ? parseInt(oct_abre)   : 3,
        oct_cierra:oct_cierra!==undefined&&oct_cierra!=="" ? parseInt(oct_cierra) : 3,
      };
    }).filter(Boolean);
    return { left: all.filter(b=>b.id.startsWith("L")), right: all.filter(b=>b.id.startsWith("R")) };
  } catch { return null; }
}
