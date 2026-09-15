// ─────────────────────────────────────────────────────────────────────────────
// practica.js — Los ejercicios del capítulo 0, como lógica pura
// Sin dependencias, sin build: se sirve tal cual desde public/.
//
// QUÉ RESUELVE. El manual dice, en su primera página, que antes de que el
// sistema ahorre un solo segundo hay que aprenderse doce colores de memoria, y
// propone tres ejercicios para eso. Son buenos ejercicios y estaban escritos en
// un libro: alguien tenía que mirar la figura, taparla con la mano y acordarse
// de corregirse solo. Acá los corre la máquina.
//
// POR QUÉ ESTE ARCHIVO NO TOCA EL DOM. Todo lo que decide qué preguntar, si la
// respuesta estuvo bien y qué sigue vive acá, sin una línea de pantalla. Así se
// puede probar entero con `node`, que es la única manera de saber que un
// ejercicio de memoria no está, por ejemplo, repitiendo siempre las mismas tres
// notas — un error que a ojo no se ve y que arruina el ejercicio en silencio.
//
// EL AZAR ES UN PARÁMETRO. `crearSesion` recibe la función de azar, así que el
// banco de pruebas le pasa una previsible y comprueba el reparto de verdad. Un
// `Math.random()` escondido adentro es una función que no se puede probar.
//
// LO QUE SE APRENDE MAL, VUELVE MÁS. Cada nota lleva un peso: fallarla lo
// triplica, acertarla lo baja. Sin eso, un ejercicio de doce notas dedica el
// mismo tiempo a la que ya sabés de memoria que a la que nunca te sale, que es
// exactamente al revés de lo que hace falta.
// ─────────────────────────────────────────────────────────────────────────────

import { CROMATICA, LATINO, desde, indiceDe, giroEntre } from "./teoria.js";
import { colorDeNota } from "./color.js";

export const VERSION = "codigo-practica 1.0";

// ─── Los modos ───────────────────────────────────────────────────────────────
// Los tres primeros son, literalmente, los ejercicios 1, 2 y 3 del capítulo 0.
// El cuarto es el nivel 2 del capítulo 9, que es el escalón siguiente.

export const MODOS = {
  tira: {
    nombre: "La tira, a ciegas",
    comoVa: "Se muestra un color. Decí qué nota es.",
    delLibro: "Ejercicio 1 del capítulo 0",
    // Se pregunta con un color y se contesta con un nombre de nota.
    muestra: "color",
    contesta: "nota",
  },
  rueda: {
    nombre: "La rueda, salteada",
    comoVa: "Igual que la anterior, pero los colores no vienen en orden — que es como aparecen leyendo de verdad.",
    delLibro: "Ejercicio 2 del capítulo 0",
    muestra: "color",
    contesta: "nota",
  },
  tarjeta: {
    nombre: "Tarjetas invertidas",
    comoVa: "Se muestra el nombre de la nota. Acordate del color antes de elegir.",
    delLibro: "Ejercicio 3 del capítulo 0",
    muestra: "nota",
    contesta: "color",
  },
  quinta: {
    nombre: "La quinta, sin contar",
    comoVa: "Se muestra una nota. Señalá su quinta sin contar semitonos.",
    delLibro: "Nivel 2 del capítulo 9",
    muestra: "nota",
    contesta: "color",
    // Siete semitonos: el giro de 210° de la rueda de doce.
    intervalo: 7,
  },
};

export const esModo = (m) => Object.prototype.hasOwnProperty.call(MODOS, m);

// ─── Pesos ───────────────────────────────────────────────────────────────────
const PESO_INICIAL = 1;
const PESO_MAX = 12;
const PESO_MIN = 0.25;
const AL_FALLAR = 3;
const AL_ACERTAR = 0.6;

const acotar = (v) => Math.max(PESO_MIN, Math.min(PESO_MAX, v));

/**
 * Elige un elemento con probabilidad proporcional a su peso.
 * `azar` devuelve un número en [0,1) — se recibe de afuera para poder probarlo.
 */
export function elegirConPeso(items, pesos, azar) {
  const total = pesos.reduce((s, v) => s + v, 0);
  if (!(total > 0)) return items[0];
  let r = azar() * total;
  for (let i = 0; i < items.length; i++) {
    r -= pesos[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── La sesión ───────────────────────────────────────────────────────────────

/**
 * Una tanda de ejercicios. No sabe nada de pantalla: se le pide `siguiente()`,
 * se le pasa lo que contestó la persona con `responder()`, y lleva la cuenta.
 *
 * @param {object}   opciones
 * @param {string}   opciones.modo      una clave de MODOS
 * @param {number}   opciones.opciones  cuántas alternativas se ofrecen (2–12)
 * @param {function} opciones.azar      función de azar; por defecto Math.random
 */
export function crearSesion({ modo = "tira", opciones = 4, azar = Math.random } = {}) {
  if (!esModo(modo)) throw new Error(`modo desconocido: ${modo}`);
  const cuantas = Math.max(2, Math.min(12, Math.round(opciones)));
  const def = MODOS[modo];

  const pesos = CROMATICA.map(() => PESO_INICIAL);
  const cuenta = CROMATICA.map(() => ({ vistas: 0, aciertos: 0 }));

  let aciertos = 0, fallos = 0, racha = 0, mejorRacha = 0;
  let actual = null;
  let ultima = null;   // para no repetir la misma nota dos veces seguidas

  function armarPregunta() {
    // El sorteo se hace sobre las notas que NO son la anterior: repetir la
    // misma dos veces seguidas hace que se acierte por inercia y no por
    // memoria, y encima esconde el resto de la rueda.
    const candidatas = CROMATICA.filter((n) => n !== ultima);
    const pesosCand = candidatas.map((n) => pesos[indiceDe(n)]);
    const nota = elegirConPeso(candidatas, pesosCand, azar);

    // La respuesta correcta puede no ser la nota mostrada: en el modo de la
    // quinta se muestra una y se contesta otra.
    const correcta = def.intervalo ? desde(nota, def.intervalo) : nota;

    // Los distractores salen del resto de la rueda, sin repetir.
    const resto = CROMATICA.filter((n) => n !== correcta);
    const distractores = [];
    while (distractores.length < cuantas - 1 && resto.length) {
      const i = Math.min(resto.length - 1, Math.floor(azar() * resto.length));
      distractores.push(resto.splice(i, 1)[0]);
    }

    // Se barajan juntas para que la correcta no caiga siempre en el mismo lugar.
    const alternativas = [correcta, ...distractores];
    for (let i = alternativas.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [alternativas[i], alternativas[j]] = [alternativas[j], alternativas[i]];
    }

    actual = {
      modo,
      nota,                                   // la que se muestra
      correcta,                               // la que hay que contestar
      muestra: def.muestra,                   // "color" | "nota"
      contesta: def.contesta,                 // "color" | "nota"
      colorMostrado: colorDeNota(nota),
      nombreMostrado: LATINO[nota] || nota,
      alternativas,
      giro: def.intervalo ? giroEntre(nota, correcta) : 0,
      respondida: false,
    };
    return actual;
  }

  return {
    VERSION,
    modo,
    get definicion() { return def; },

    siguiente() { return armarPregunta(); },
    get actual() { return actual; },

    /**
     * Registra la respuesta. Devuelve si estuvo bien, cuál era la correcta, y
     * la racha. Responder dos veces la misma pregunta no cuenta dos veces:
     * en un ejercicio de memoria eso inflaría el puntaje sin aprender nada.
     */
    responder(elegida) {
      if (!actual) throw new Error("no hay pregunta en curso");
      if (actual.respondida) {
        return { acierto: null, correcta: actual.correcta, racha, yaRespondida: true };
      }
      actual.respondida = true;
      const acierto = elegida === actual.correcta;
      const i = indiceDe(actual.correcta);

      cuenta[i].vistas++;
      if (acierto) {
        cuenta[i].aciertos++;
        aciertos++;
        racha++;
        mejorRacha = Math.max(mejorRacha, racha);
        pesos[i] = acotar(pesos[i] * AL_ACERTAR);
      } else {
        fallos++;
        racha = 0;
        pesos[i] = acotar(pesos[i] * AL_FALLAR);
      }
      ultima = actual.nota;
      return { acierto, correcta: actual.correcta, racha, yaRespondida: false };
    },

    get marcador() {
      const total = aciertos + fallos;
      return {
        aciertos, fallos, total, racha, mejorRacha,
        puntaje: total ? aciertos / total : 0,
      };
    },

    /** Qué notas están costando. Ordenadas de peor a mejor, sólo las vistas. */
    flojas() {
      return CROMATICA
        .map((n, i) => ({
          nota: n,
          latino: LATINO[n] || n,
          color: colorDeNota(n),
          vistas: cuenta[i].vistas,
          aciertos: cuenta[i].aciertos,
          peso: pesos[i],
        }))
        .filter((x) => x.vistas > 0)
        .sort((a, b) => b.peso - a.peso || a.aciertos / a.vistas - b.aciertos / b.vistas);
    },

    /** Sólo para el banco de pruebas: ver el reparto sin tocar lo de adentro. */
    get pesos() { return pesos.slice(); },
  };
}
