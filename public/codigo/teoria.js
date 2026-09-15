// ─────────────────────────────────────────────────────────────────────────────
// teoria.js — La teoría musical de «El Código», con los números reales
// Sin dependencias, sin build: se sirve tal cual desde public/.
//
// QUÉ HACE DISTINTO A ESTE ARCHIVO. Todo lo que acá se afirma sobre física se
// CALCULA, no se copia de una tabla escrita a mano. La serie de armónicos, los
// cents de cada intervalo, la desviación contra el temperamento igual y las
// longitudes de onda del capítulo 7 salen de sus fórmulas cada vez que se
// abre la página. Si un número está mal, está mal la fórmula y se ve.
//
// El motivo es el pedido que dio origen a esta mitad: que un desarrollo
// pedagógico no pueda llevar a una comprensión equivocada de la teoría. La
// mejor defensa contra eso no es revisar una tabla: es no tener tabla.
//
// LOS ÁNGULOS SON DE LUGAR, NO DE COLOR. `anguloDePosicion` devuelve dónde cae
// una nota en la rueda de doce casilleros (30° por semitono). Eso es lo que el
// capítulo 8 usa de verdad, y es cierto siempre. Lo que NO es cierto sobre la
// paleta de estudio es leer esos ángulos como relaciones de color: el matiz de
// los doce colores no avanza parejo, a propósito. Para medir eso está
// `separacionDeMatiz` en color.js, y la página muestra las dos cosas juntas.
// ─────────────────────────────────────────────────────────────────────────────

import { CROMATICA, LATINO } from "../gestos/musica.js";

export const VERSION = "codigo-teoria 1.0";
export { CROMATICA, LATINO };

// ─── Notas ───────────────────────────────────────────────────────────────────
const BEMOLES = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

export const indiceDe = (nota) => {
  const n = String(nota).replace(/[0-9]/g, "").trim();
  const i = CROMATICA.indexOf(BEMOLES[n] || n);
  return i;
};

export const desde = (raiz, semitonos) =>
  CROMATICA[(indiceDe(raiz) + semitonos + 1200) % 12];

export const enLatino = (nota) => LATINO[String(nota).trim()] || nota;

/**
 * Dónde cae una nota en la rueda de doce casilleros, en grados desde Do.
 * Doce lugares, 360 grados: 30 grados por semitono. Esto es geometría de
 * posición y no depende de ningún color.
 */
export const anguloDePosicion = (nota) => indiceDe(nota) * 30;

/** El giro que hay que dar para ir de una nota a otra, en grados. */
export const giroEntre = (desdeNota, hastaNota) =>
  ((anguloDePosicion(hastaNota) - anguloDePosicion(desdeNota)) % 360 + 360) % 360;

// ─── Frecuencias ─────────────────────────────────────────────────────────────
// El La del diapasón son 440 Hz por la norma ISO 16, y es el único anclaje
// físico real que tiene todo el sistema. La afinación va como parámetro porque
// un bandoneón de tango rara vez está en 440 clavado.

/** Frecuencia de una nota en la octava 4 (la del Do central). */
export const frecuencia = (nota, la = 440) =>
  la * Math.pow(2, (indiceDe(nota) - 9) / 12);

// ─── Intervalos y la serie de armónicos ──────────────────────────────────────
// Un intervalo se mide en CENTS: la centésima parte de un semitono temperado,
// 1200 por octava. Es la unidad que permite comparar una proporción natural
// con el temperamento igual sin hablar de fracciones.

export const enCents = (razon) => 1200 * Math.log2(razon);

/**
 * La serie de armónicos: lo que suena de verdad cuando suena UNA nota.
 * El armónico n vibra n veces más rápido que la fundamental. Reducido a una
 * octava, cada uno cae cerca —nunca encima— de una nota del piano.
 *
 * Esto es lo que sostiene el orden que el capítulo 10 usa para el modelo
 * armónico: primero la quinta (armónico 3), después la tercera (5), después
 * la séptima (7) y la novena (9). Ese orden es correcto, y acá se ve por qué.
 */
export const armonico = (n, raiz = "C") => {
  const cents = enCents(n);
  const dentroDeOctava = ((cents % 1200) + 1200) % 1200;
  const semitonos = Math.round(dentroDeOctava / 100) % 12;
  return {
    n,
    cents,
    dentroDeOctava,
    nota: desde(raiz, semitonos),
    semitonos,
    // Cuánto se corre del piano. El signo importa: + es más agudo que la tecla.
    desviacion: dentroDeOctava - semitonos * 100 > 600
      ? dentroDeOctava - (semitonos + 12) * 100
      : dentroDeOctava - semitonos * 100,
  };
};

export const serieDeArmonicos = (hasta = 13, raiz = "C") =>
  Array.from({ length: hasta }, (_, i) => armonico(i + 1, raiz));

/**
 * Los intervalos de la tríada, con su proporción natural y lo que el piano
 * hace con ella. `razon` es la proporción simple de la serie de armónicos.
 */
export const INTERVALOS = [
  { nombre: "Unísono",        semitonos: 0,  razon: 1 / 1,  criollo: "la misma nota" },
  { nombre: "Segunda mayor",  semitonos: 2,  razon: 9 / 8,  criollo: "un tono" },
  { nombre: "Tercera menor",  semitonos: 3,  razon: 6 / 5,  criollo: "la que hace el acorde triste" },
  { nombre: "Tercera mayor",  semitonos: 4,  razon: 5 / 4,  criollo: "la que hace el acorde alegre" },
  { nombre: "Cuarta justa",   semitonos: 5,  razon: 4 / 3,  criollo: "suena a que falta algo" },
  { nombre: "Tritono",        semitonos: 6,  razon: 45 / 32, criollo: "el que suena a peligro" },
  { nombre: "Quinta justa",   semitonos: 7,  razon: 3 / 2,  criollo: "el más firme de todos" },
  { nombre: "Sexta mayor",    semitonos: 9,  razon: 5 / 3,  criollo: "abierto, luminoso" },
  { nombre: "Séptima menor",  semitonos: 10, razon: 16 / 9, criollo: "el que pide seguir" },
  { nombre: "Séptima mayor",  semitonos: 11, razon: 15 / 8, criollo: "roza la octava" },
  { nombre: "Octava",         semitonos: 12, razon: 2 / 1,  criollo: "la misma nota, más arriba" },
];

/** Cuánto se aparta el piano de la proporción natural, en cents. */
export const desviacionTemperada = (iv) => iv.semitonos * 100 - enCents(iv.razon);

// ─── Acordes ─────────────────────────────────────────────────────────────────
// El orden de la lista NO es decorativo: la primera nota es la fundamental, y
// el criterio «raíz dominante» de la mezcla depende de que lo sea.

export const TIPOS = {
  mayor:   { nombre: "mayor",            cifrado: "",      ivs: [0, 4, 7],          criollo: "el acorde alegre de toda la vida" },
  menor:   { nombre: "menor",            cifrado: "m",     ivs: [0, 3, 7],          criollo: "el mismo, con la tercera un escalón más abajo" },
  dism:    { nombre: "disminuido",       cifrado: "dim",   ivs: [0, 3, 6],          criollo: "inestable: pide resolverse" },
  aum:     { nombre: "aumentado",        cifrado: "aug",   ivs: [0, 4, 8],          criollo: "flotante, sin piso" },
  sus4:    { nombre: "con cuarta",       cifrado: "sus4",  ivs: [0, 5, 7],          criollo: "sin tercera: ni alegre ni triste" },
  maj7:    { nombre: "séptima mayor",    cifrado: "maj7",  ivs: [0, 4, 7, 11],      criollo: "alegre y con perfume" },
  dom7:    { nombre: "séptima",          cifrado: "7",     ivs: [0, 4, 7, 10],      criollo: "el que empuja hacia el siguiente" },
  m7:      { nombre: "menor séptima",    cifrado: "m7",    ivs: [0, 3, 7, 10],      criollo: "triste y cómodo" },
  m7b5:    { nombre: "semidisminuido",   cifrado: "m7b5",  ivs: [0, 3, 6, 10],      criollo: "la antesala del menor" },
  novena:  { nombre: "novena",           cifrado: "9",     ivs: [0, 4, 7, 10, 14],  criollo: "el de séptima, con una nota más arriba" },
  trecena: { nombre: "trecena",          cifrado: "13",    ivs: [0, 4, 7, 10, 14, 21], criollo: "el del ejemplo del capítulo 1" },
};

/** Las notas de un acorde, con la fundamental primero. */
export const notasDe = (raiz, tipo) => {
  const t = TIPOS[tipo];
  if (!t) return [];
  // Sin repetir: una novena y una segunda son la misma nota de la rueda, y
  // contarla dos veces le daría el doble de peso en la mezcla sin querer.
  const vistas = [];
  t.ivs.forEach((iv) => {
    const n = desde(raiz, iv);
    if (!vistas.includes(n)) vistas.push(n);
  });
  return vistas;
};

export const nombreDeAcorde = (raiz, tipo, latino = false) =>
  (latino ? enLatino(raiz) : raiz) + (TIPOS[tipo] ? TIPOS[tipo].cifrado : "");

// ─── Capítulo 7: las tres correspondencias que no cierran ────────────────────
// Calculadas, no copiadas. Son el mejor argumento del manual justamente
// porque dan que no.

export const VELOCIDAD_LUZ = 299792458; // m/s, valor exacto por definición

/**
 * Subir una nota 40 octavas para llevarla al rango de la luz, y ver dónde cae.
 * Es la técnica que el capítulo 7 pone a prueba — y que falla.
 */
export const subirOctavas = (nota, octavas = 40, la = 440) => {
  const hz = frecuencia(nota, la) * Math.pow(2, octavas);
  const nm = (VELOCIDAD_LUZ / hz) * 1e9;
  return {
    nota,
    hz: frecuencia(nota, la),
    hzSubida: hz,
    nm,
    // Límites habituales del visible. Fuera de ellos no hay color que valga.
    visible: nm >= 380 && nm <= 750,
    zona: nm > 750 ? "infrarrojo" : nm < 380 ? "ultravioleta" : "visible",
  };
};

/** Coeficiente de Pearson. Se usa para la dureza de las piedras del cap. 7. */
export const correlacion = (xs, ys) => {
  const n = xs.length;
  if (!n || ys.length !== n) return 0;
  const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = media(xs), my = media(ys);
  const num = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((s, v) => s + (v - mx) ** 2, 0) * ys.reduce((s, v) => s + (v - my) ** 2, 0)
  );
  return den === 0 ? 0 : num / den;
};

/**
 * Dureza Mohs de las doce piedras de la Parte IV, en su valor medio publicado.
 * Son datos gemológicos de referencia, ajenos a este sistema — que es lo que
 * hace que la prueba valga.
 *
 * OJO: la tabla del manual tiene ONCE filas para doce notas —Fa y Fa♯ comparten
 * una, con dos piedras sin decir cuál es cuál—. Acá se separan, que es lo que
 * el resto del libro pide.
 */
export const PIEDRAS = [
  { nota: "C",  piedra: "Zafiro",              mohs: 9    },
  { nota: "C#", piedra: "Aguamarina",          mohs: 7.75 },
  { nota: "D",  piedra: "Esmeralda",           mohs: 7.75 },
  { nota: "D#", piedra: "Peridoto",            mohs: 6.75 },
  { nota: "E",  piedra: "Cuarzo ahumado",      mohs: 7    },
  { nota: "F",  piedra: "Cuarzo champán",      mohs: 7    },
  { nota: "F#", piedra: "Citrino pálido",      mohs: 7    },
  { nota: "G",  piedra: "Citrino",             mohs: 7    },
  { nota: "G#", piedra: "Granate espesartina", mohs: 7.25 },
  { nota: "A",  piedra: "Rubí",                mohs: 9    },
  { nota: "A#", piedra: "Morganita",           mohs: 7.75 },
  { nota: "B",  piedra: "Amatista",            mohs: 7    },
];

/** El espectro visible medido en octavas. Da menos de una, y ése es el punto. */
export const octavasDelVisible = (desdeNm = 380, hastaNm = 750) =>
  Math.log2(hastaNm / desdeNm);
