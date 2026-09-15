// ─────────────────────────────────────────────────────────────────────────────
// color.js — Mezcla de color físicamente correcta, para «El Código»
// Sin dependencias, sin build: se sirve tal cual desde public/.
//
// POR QUÉ EXISTE ESTE ARCHIVO, Y POR QUÉ NO TOCA `src/App.jsx`.
// La app compilada mezcla los colores de un acorde promediando los bytes de
// cada hex. Eso tiene DOS problemas distintos, y conviene no confundirlos:
//
//   1 · PROMEDIAR NO ES SUMAR. El manual describe el modelo «luz» como sumar
//       haces de proyector, y dice que al agregar notas el resultado se acerca
//       al blanco. Sumar hace eso; promediar no: mantiene la luminancia media.
//       Medido sobre Do-Mi-Sol-Si-Re-Fa♯-La, de 2 a 7 notas la luminancia del
//       promedio se queda entre 4,3% y 5,5%. No se acerca a nada.
//
//   2 · LOS BYTES DE UN HEX NO SON INTENSIDAD DE LUZ. sRGB guarda los valores
//       con una curva (IEC 61966-2-1): el byte 128 no es media luz, es 21,8%.
//       Promediar los bytes da un resultado sistemáticamente MÁS OSCURO que la
//       mezcla real. En Do mayor la diferencia es del 79% de luminancia — no
//       es un matiz, es otro color.
//
// La forma correcta de mezclar luz es de manual y no la inventa este archivo:
// se pasa cada canal a luz lineal, se promedia ahí, y se vuelve a sRGB.
//
// SE CONSERVAN LAS DOS MEZCLAS A PROPÓSITO. `mezclarEnPantalla` es la de hoy y
// no es un error que haya que borrar: es el término de comparación, y la
// página lo muestra al lado del correcto. Sin las dos, la corrección sería una
// afirmación más.
//
// La paleta NO se copia acá: se importa de `../gestos/musica.js`, que es la
// única copia del lado de `public/`. La canónica sigue siendo la constante
// `NC` de `src/App.jsx` (ver CLAUDE.md).
// ─────────────────────────────────────────────────────────────────────────────

import { NC, CROMATICA, LATINO } from "../gestos/musica.js";

export const VERSION = "codigo-color 1.0";
export { NC, CROMATICA, LATINO };

// ─── sRGB ↔ luz lineal ───────────────────────────────────────────────────────
// Las dos funciones de la norma IEC 61966-2-1. El tramo recto de abajo no es
// un detalle decorativo: sin él la curva tiene pendiente infinita en el cero y
// los colores muy oscuros se rompen.

/** Un canal de 0–255 tal como lo guarda un hex → intensidad de luz 0–1. */
export const aLuz = (byte) => {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** Intensidad de luz 0–1 → canal de 0–255 para escribir en un hex. */
export const aPantalla = (luz) => {
  const c = luz <= 0.0031308 ? 12.92 * luz : 1.055 * Math.pow(luz, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, c * 255)));
};

// ─── Hex ↔ canales ───────────────────────────────────────────────────────────
export const hexABytes = (hex) => {
  const h = String(hex).replace("#", "").trim();
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

export const bytesAHex = (bytes) =>
  "#" + bytes
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("");

export const hexALuz = (hex) => hexABytes(hex).map(aLuz);
export const luzAHex = (luz) => bytesAHex(luz.map(aPantalla));

/**
 * Luminancia relativa (Y de la norma WCAG / Rec. 709): cuánta luz emite el
 * color, con los tres canales pesados como los ve el ojo. Es el número con el
 * que se compara si una mezcla «aclara» o no.
 */
export const luminancia = (hex) => {
  const [r, g, b] = hexALuz(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// ─── Pesos ───────────────────────────────────────────────────────────────────
/**
 * Criterio «raíz dominante» del capítulo 10: la fundamental se queda con
 * `pesoRaiz` del total y el resto reparte lo que queda en partes iguales.
 * Con una sola nota el peso es 1 — no hay entre qué repartir.
 */
export const pesosRaizDominante = (cantidad, pesoRaiz = 0.8) => {
  if (cantidad <= 0) return [];
  if (cantidad === 1) return [1];
  const resto = (1 - pesoRaiz) / (cantidad - 1);
  return Array.from({ length: cantidad }, (_, i) => (i === 0 ? pesoRaiz : resto));
};

const normalizar = (colores, pesos) => {
  const p = pesos && pesos.length === colores.length
    ? pesos.slice()
    : Array.from({ length: colores.length }, () => 1 / colores.length);
  const suma = p.reduce((s, v) => s + v, 0);
  return suma > 0 ? p.map((v) => v / suma) : p;
};

// ─── Las tres mezclas ────────────────────────────────────────────────────────

/**
 * Como mezcla la app compilada HOY: promedio de los bytes del hex.
 * Se conserva para poder mostrar la diferencia, no porque esté bien.
 */
export const mezclarEnPantalla = (colores, pesos) => {
  if (!colores || !colores.length) return "#888888";
  const p = normalizar(colores, pesos);
  const acum = [0, 0, 0];
  colores.forEach((c, i) => hexABytes(c).forEach((v, k) => { acum[k] += v * p[i]; }));
  return bytesAHex(acum);
};

/**
 * Promedio en luz lineal: lo que pasa si se proyectan los colores sobre la
 * misma pared y se mide el promedio. Es la mezcla correcta para el modelo
 * «luz» del capítulo 10.
 */
export const mezclarEnLuz = (colores, pesos) => {
  if (!colores || !colores.length) return "#888888";
  const p = normalizar(colores, pesos);
  const acum = [0, 0, 0];
  colores.forEach((c, i) => hexALuz(c).forEach((v, k) => { acum[k] += v * p[i]; }));
  return luzAHex(acum);
};

/**
 * Suma en luz lineal, sin promediar: los haces de verdad, apilados. ES la
 * operación que el manual describe con palabras, y hace lo que el manual dice
 * —tiende al blanco—, al precio de saturarse enseguida. Se incluye para que
 * eso se pueda ver en vez de discutirlo.
 */
export const sumarLuz = (colores) => {
  if (!colores || !colores.length) return "#000000";
  const acum = [0, 0, 0];
  colores.forEach((c) => hexALuz(c).forEach((v, k) => { acum[k] += v; }));
  return luzAHex(acum.map((v) => Math.min(1, v)));
};

// ─── Medidas sobre los colores ───────────────────────────────────────────────

/** Matiz en grados (0–360). Es el «qué color es», sin claridad ni saturación. */
export const matiz = (hex) => {
  const [r, g, b] = hexABytes(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = ((b - r) / d + 2);
  else h = ((r - g) / d + 4);
  return h * 60;
};

/** Cuánto se separan dos colores en matiz, por el camino corto: 0–180. */
export const separacionDeMatiz = (a, b) => {
  const d = Math.abs(matiz(a) - matiz(b));
  return d > 180 ? 360 - d : d;
};

/** Distancia entre dos colores en el cubo RGB. 0 = el mismo; 441 = el máximo. */
export const distanciaRGB = (a, b) => {
  const x = hexABytes(a), y = hexABytes(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** El color de una nota. Acepta sostenidos y bemoles. */
export const colorDeNota = (nota) => NC[String(nota).replace(/[0-9]/g, "").trim()] || "#888888";
