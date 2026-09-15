// ─────────────────────────────────────────────────────────────────────────────
// pruebas/codigo.mjs — Banco de pruebas de «El Código»
//
//   node pruebas/codigo.mjs
//
// Sin dependencias y sin navegador. Prueba las dos piezas del desarrollo
// paralelo de `public/codigo/`: el motor de color y la teoría musical.
//
// POR QUÉ ESTE BANCO ES MÁS ESTRICTO QUE EL DE GESTOS. Acá no alcanza con que
// el código no reviente: lo que se está entregando es una explicación de
// teoría musical para alguien que no sabe música, y un número mal puesto
// enseña algo falso sin que nadie lo note. Por eso varias pruebas comparan
// contra valores publicados —los cents de la serie de armónicos, la curva de
// sRGB, la longitud de onda del visible— y no contra lo que devuelve el
// propio código.
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";

let pasadas = 0, fallidas = 0;
async function prueba(nombre, fn) {
  try { await fn(); pasadas++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallidas++; console.log(`  ✗ ${nombre}\n      ${e.message}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const cerca = (a, b, tol, msj) =>
  assert.ok(Math.abs(a - b) <= tol, `${msj}: ${a} no está a ${tol} de ${b}`);

const C = await import("../public/codigo/color.js");
const T = await import("../public/codigo/teoria.js");

// ═══ color.js — la curva de sRGB ═════════════════════════════════════════════
titulo("color.js — sRGB y luz lineal");

await prueba("los extremos no se mueven: 0 es cero y 255 es uno", () => {
  assert.equal(C.aLuz(0), 0);
  assert.equal(C.aLuz(255), 1);
  assert.equal(C.aPantalla(0), 0);
  assert.equal(C.aPantalla(1), 255);
});

await prueba("el byte 128 NO es media luz: es ~21,8%", () => {
  // Es el número que explica todo el problema de la mezcla. Publicado.
  cerca(C.aLuz(128), 0.2158, 0.002, "la luz del gris medio");
});

await prueba("media luz se escribe con el byte ~188, no con 128", () => {
  cerca(C.aPantalla(0.5), 188, 1, "el byte de media luz");
});

await prueba("ida y vuelta sin pérdida en los 256 valores", () => {
  for (let b = 0; b <= 255; b++) {
    assert.equal(C.aPantalla(C.aLuz(b)), b, `se rompe en ${b}`);
  }
});

await prueba("el tramo recto de abajo está puesto y se usa", () => {
  // Por debajo de 0.04045 la norma manda dividir por 12.92, no elevar.
  cerca(C.aLuz(10), (10 / 255) / 12.92, 1e-12, "el tramo lineal");
});

titulo("color.js — las tres mezclas");

await prueba("una sola nota devuelve su propio color, sin tocarlo", () => {
  assert.equal(C.mezclarEnLuz(["#002e93"]), "#002e93");
  assert.equal(C.mezclarEnPantalla(["#002e93"]), "#002e93");
});

await prueba("mezclar un color consigo mismo no lo cambia", () => {
  assert.equal(C.mezclarEnLuz(["#357a25", "#357a25"]), "#357a25");
  assert.equal(C.mezclarEnPantalla(["#b8823c", "#b8823c"]), "#b8823c");
});

await prueba("en luz, blanco + negro da el byte 188 y no el 128", () => {
  // La prueba de fuego del gamma: el punto medio de verdad es más claro.
  assert.equal(C.mezclarEnLuz(["#ffffff", "#000000"]), "#bcbcbc");
  assert.equal(C.mezclarEnPantalla(["#ffffff", "#000000"]), "#808080");
});

await prueba("la mezcla en luz es MÁS clara que la de pantalla", () => {
  const notas = ["#002e93", "#845523", "#f1b302"];       // Do mayor
  const pes = C.pesosRaizDominante(3, 0.8);
  const enLuz = C.mezclarEnLuz(notas, pes);
  const enPantalla = C.mezclarEnPantalla(notas, pes);
  assert.ok(
    C.luminancia(enLuz) > C.luminancia(enPantalla),
    `${enLuz} debería tener más luz que ${enPantalla}`
  );
  // Y no por poco: en Do mayor la diferencia medida es del orden del 79%.
  const dif = (C.luminancia(enLuz) - C.luminancia(enPantalla)) / C.luminancia(enPantalla);
  assert.ok(dif > 0.5, `la diferencia es de apenas ${(dif * 100).toFixed(0)}%`);
});

await prueba("promediar NO tiende al blanco; sumar SÍ", () => {
  const ns = ["#002e93", "#845523", "#f1b302", "#672e87", "#357a25"];
  const lumProm = [];
  for (let k = 2; k <= ns.length; k++) lumProm.push(C.luminancia(C.mezclarEnLuz(ns.slice(0, k))));
  // El promedio se queda quieto: ninguna subida sostenida hacia el blanco.
  assert.ok(Math.max(...lumProm) < 0.5, "el promedio no debería acercarse al blanco");
  // La suma, en cambio, sube en cada paso.
  for (let k = 3; k <= ns.length; k++) {
    const antes = C.luminancia(C.sumarLuz(ns.slice(0, k - 1)));
    const ahora = C.luminancia(C.sumarLuz(ns.slice(0, k)));
    assert.ok(ahora >= antes, `la suma bajó al agregar la nota ${k}`);
  }
});

await prueba("los pesos de raíz dominante suman 1 y respetan el 80%", () => {
  const p = C.pesosRaizDominante(4, 0.8);
  cerca(p.reduce((s, v) => s + v, 0), 1, 1e-12, "la suma de los pesos");
  assert.equal(p[0], 0.8);
  p.slice(1).forEach((v) => cerca(v, 0.2 / 3, 1e-12, "el reparto del resto"));
  // Una sola nota no reparte nada.
  assert.deepEqual(C.pesosRaizDominante(1, 0.8), [1]);
});

await prueba("con más peso en la raíz, la mezcla se acerca a la raíz", () => {
  const ns = ["#002e93", "#845523", "#f1b302"];
  const floja = C.mezclarEnLuz(ns, C.pesosRaizDominante(3, 0.4));
  const firme = C.mezclarEnLuz(ns, C.pesosRaizDominante(3, 0.95));
  assert.ok(
    C.distanciaRGB(firme, "#002e93") < C.distanciaRGB(floja, "#002e93"),
    "el 95% debería quedar más cerca del Do que el 40%"
  );
});

titulo("color.js — las medidas");

await prueba("el matiz de los colores de referencia da lo esperado", () => {
  cerca(C.matiz("#ff0000"), 0, 0.01, "rojo puro");
  cerca(C.matiz("#00ff00"), 120, 0.01, "verde puro");
  cerca(C.matiz("#0000ff"), 240, 0.01, "azul puro");
  assert.equal(C.matiz("#808080"), 0, "un gris no tiene matiz");
});

await prueba("la separación de matiz va por el camino corto", () => {
  cerca(C.separacionDeMatiz("#ff0000", "#00ffff"), 180, 0.01, "complementarios");
  // 350° y 10° están a 20°, no a 340°.
  const a = "#ff0040", b = "#ff4000";
  assert.ok(C.separacionDeMatiz(a, b) <= 180);
});

await prueba("el tritono Fa-Si NO es el par de máximo contraste", () => {
  // Es la afirmación del cierre del capítulo 5, y sobre esta paleta no se
  // sostiene. La prueba está para que, si algún día alguien cambia la paleta
  // y pasa a ser cierta, se entere.
  const faSi = C.separacionDeMatiz(C.NC["F"], C.NC["B"]);
  const doFaS = C.separacionDeMatiz(C.NC["C"], C.NC["F#"]);
  cerca(faSi, 115, 2, "la separación real de Fa y Si");
  assert.ok(doFaS > faSi, "Do-Fa♯ contrasta más que Fa-Si");
});

await prueba("ningún tritono llega al complementario exacto salvo Do-Fa♯", () => {
  const pares = [["C", "F#"], ["C#", "G"], ["D", "G#"], ["D#", "A"], ["E", "A#"], ["F", "B"]];
  const seps = pares.map(([a, b]) => C.separacionDeMatiz(C.NC[a], C.NC[b]));
  assert.ok(Math.max(...seps) < 180, "ninguno puede ser exactamente 180°");
  cerca(seps[0], 177, 2, "Do-Fa♯ es el que más se acerca");
  assert.ok(Math.min(...seps) < 60, "y el más flojo son casi el mismo color");
});

// ═══ teoria.js ═══════════════════════════════════════════════════════════════
titulo("teoria.js — notas y posiciones");

await prueba("los bemoles son la misma tecla que los sostenidos", () => {
  assert.equal(T.indiceDe("Db"), T.indiceDe("C#"));
  assert.equal(T.indiceDe("Bb"), T.indiceDe("A#"));
  assert.equal(T.indiceDe("C4"), T.indiceDe("C"));
});

await prueba("la rueda da la vuelta: doce semitonos vuelven al principio", () => {
  assert.equal(T.desde("C", 12), "C");
  assert.equal(T.desde("C", 0), "C");
  assert.equal(T.desde("A", 3), "C");
  assert.equal(T.desde("C", -1), "B");
});

await prueba("cada semitono son 30 grados de POSICIÓN", () => {
  assert.equal(T.anguloDePosicion("C"), 0);
  assert.equal(T.anguloDePosicion("F#"), 180);
  // La quinta justa es el giro de 210° del capítulo 8 — desde cualquier nota.
  for (const n of T.CROMATICA) {
    assert.equal(T.giroEntre(n, T.desde(n, 7)), 210, `la quinta desde ${n}`);
  }
  // Y el tritono, medio giro, también desde cualquiera.
  for (const n of T.CROMATICA) {
    assert.equal(T.giroEntre(n, T.desde(n, 6)), 180, `el tritono desde ${n}`);
  }
});

titulo("teoria.js — frecuencias y serie de armónicos");

await prueba("el La del diapasón son 440 Hz, y es un parámetro", () => {
  assert.equal(T.frecuencia("A"), 440);
  assert.equal(T.frecuencia("A", 432), 432);
  cerca(T.frecuencia("C"), 261.626, 0.001, "el Do central");
});

await prueba("los cents: una octava son 1200 y un semitono 100", () => {
  cerca(T.enCents(2), 1200, 1e-9, "la octava");
  cerca(T.enCents(Math.pow(2, 1 / 12)), 100, 1e-9, "el semitono temperado");
});

await prueba("el orden de la serie es el que usa el capítulo 10", () => {
  // fundamental → quinta → tercera → séptima → novena. Que ese orden sea
  // correcto es lo que sostiene el «modelo armónico» de la mezcla.
  assert.equal(T.armonico(3).nota, "G",  "el armónico 3 es la quinta");
  assert.equal(T.armonico(5).nota, "E",  "el armónico 5 es la tercera mayor");
  assert.equal(T.armonico(7).nota, "A#", "el armónico 7 es la séptima");
  assert.equal(T.armonico(9).nota, "D",  "el armónico 9 es la novena");
});

await prueba("las desviaciones contra el piano son las publicadas", () => {
  cerca(T.armonico(3).desviacion,  +1.955, 0.01, "la quinta natural es más alta");
  cerca(T.armonico(5).desviacion, -13.686, 0.01, "la tercera natural es más baja");
  cerca(T.armonico(7).desviacion, -31.174, 0.01, "la séptima natural es mucho más baja");
  cerca(T.armonico(9).desviacion,  +3.910, 0.01, "la novena");
  // El armónico 11 es el famoso que no cae en ninguna tecla.
  cerca(T.armonico(11).desviacion, -48.682, 0.01, "el onceno queda entre dos teclas");
});

await prueba("las octavas son lo único que el piano no desafina", () => {
  [1, 2, 4, 8].forEach((n) => cerca(T.armonico(n).desviacion, 0, 1e-9, `el armónico ${n}`));
});

await prueba("la serie se calcula sobre la raíz que se le pida", () => {
  assert.equal(T.armonico(3, "A").nota, "E", "la quinta de La es Mi");
  assert.equal(T.serieDeArmonicos(4).length, 4);
});

titulo("teoria.js — acordes");

await prueba("las tríadas dan las notas de toda la vida", () => {
  assert.deepEqual(T.notasDe("C", "mayor"), ["C", "E", "G"]);
  assert.deepEqual(T.notasDe("C", "menor"), ["C", "D#", "G"]);
  assert.deepEqual(T.notasDe("D", "mayor"), ["D", "F#", "A"]);
  assert.deepEqual(T.notasDe("G", "dom7"), ["G", "B", "D", "F"]);
});

await prueba("la fundamental va siempre primera — la mezcla depende de eso", () => {
  Object.keys(T.TIPOS).forEach((t) => {
    T.CROMATICA.forEach((r) => {
      assert.equal(T.notasDe(r, t)[0], r, `${r}${t} no arranca en su raíz`);
    });
  });
});

await prueba("una novena no se cuenta dos veces por ser también una segunda", () => {
  // La 9na de Do es Re, y la 2da también: en la rueda es el mismo lugar.
  // Si apareciera repetida pesaría el doble en la mezcla sin que nadie lo pida.
  const n = T.notasDe("C", "trecena");
  assert.equal(new Set(n).size, n.length, "hay notas repetidas");
});

await prueba("el La13 del capítulo 1 lleva Fa♯, que es de lo que se trata", () => {
  assert.ok(T.notasDe("A", "trecena").includes("F#"));
  assert.equal(T.nombreDeAcorde("A", "trecena"), "A13");
});

titulo("teoria.js — el capítulo 7, que da que NO");

await prueba("subir 40 octavas deja media escala en infrarrojo", () => {
  const todas = T.CROMATICA.map((n) => T.subirOctavas(n));
  const fuera = todas.filter((x) => !x.visible);
  assert.equal(fuera.length, 6, "deberían quedar seis notas fuera del visible");
  const doo = T.subirOctavas("C");
  cerca(doo.nm, 1042, 2, "el Do cae en infrarrojo");
  assert.equal(doo.zona, "infrarrojo");
  const la = T.subirOctavas("A");
  cerca(la.nm, 620, 2, "el La cae en 620 nm — naranja, no rojo");
  assert.equal(la.zona, "visible");
});

await prueba("el espectro visible mide menos de una octava", () => {
  assert.ok(T.octavasDelVisible() < 1, "no puede llegar a una octava");
  cerca(T.octavasDelVisible(), 0.98, 0.01, "con 380–750 nm");
  cerca(T.octavasDelVisible(400, 700), 0.807, 0.01, "con los límites más estrictos");
});

await prueba("la dureza de las piedras no correlaciona con la frecuencia", () => {
  const xs = T.PIEDRAS.map((p) => T.frecuencia(p.nota));
  const ys = T.PIEDRAS.map((p) => p.mohs);
  const r = T.correlacion(xs, ys);
  assert.ok(Math.abs(r) < 0.3, `r = ${r.toFixed(3)} debería ser prácticamente cero`);
  assert.ok(r * r < 0.1, "menos del 10% de la variación explicada");
});

await prueba("hay una piedra por nota: doce, no once", () => {
  assert.equal(T.PIEDRAS.length, 12);
  assert.equal(new Set(T.PIEDRAS.map((p) => p.nota)).size, 12);
  assert.equal(new Set(T.PIEDRAS.map((p) => p.piedra)).size, 12);
});

await prueba("la correlación reconoce una relación cuando la hay", () => {
  // Control: si el coeficiente diera siempre cero, la prueba de arriba no
  // valdría nada.
  cerca(T.correlacion([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-9, "una recta perfecta");
  cerca(T.correlacion([1, 2, 3, 4], [8, 6, 4, 2]), -1, 1e-9, "una recta al revés");
});

titulo("las dos mitades, juntas");

await prueba("cada nota tiene color y cada color vuelve a su nota", () => {
  T.CROMATICA.forEach((n) => {
    const c = C.colorDeNota(n);
    assert.match(c, /^#[0-9a-f]{6}$/i, `${n} no tiene color`);
  });
  assert.equal(new Set(T.CROMATICA.map(C.colorDeNota)).size, 12, "hay colores repetidos");
});

await prueba("Re mayor y Re menor no dan el mismo color", () => {
  const may = T.notasDe("D", "mayor").map(C.colorDeNota);
  const men = T.notasDe("D", "menor").map(C.colorDeNota);
  const p = C.pesosRaizDominante(3, 0.8);
  assert.notEqual(C.mezclarEnLuz(may, p), C.mezclarEnLuz(men, p));
});

await prueba("los sellos están puestos", () => {
  assert.match(C.VERSION, /^codigo-color /);
  assert.match(T.VERSION, /^codigo-teoria /);
});

// ═══ practica.js — los ejercicios del capítulo 0 ═════════════════════════════
// Un ejercicio de memoria falla en silencio: si repitiera siempre las mismas
// tres notas, o si la respuesta correcta cayera siempre en el mismo botón,
// nadie lo nota mirándolo — y el ejercicio deja de servir. Por eso el azar se
// inyecta y acá se cuenta el reparto de verdad.
const P = await import("../public/codigo/practica.js");

// Azar previsible: recorre una lista y vuelve a empezar.
const azarDe = (lista) => { let i = 0; return () => lista[i++ % lista.length]; };

titulo("practica.js — las preguntas");

await prueba("los cuatro modos son los del libro, y se sabe de dónde salen", () => {
  assert.deepEqual(Object.keys(P.MODOS), ["tira", "rueda", "tarjeta", "quinta"]);
  Object.values(P.MODOS).forEach((m) => {
    assert.ok(m.nombre && m.comoVa && m.delLibro, "un modo sin ficha completa");
    assert.ok(["color", "nota"].includes(m.muestra));
    assert.ok(["color", "nota"].includes(m.contesta));
  });
  assert.ok(!P.esModo("cualquiera"));
});

await prueba("un modo inventado no arranca una sesión", () => {
  assert.throws(() => P.crearSesion({ modo: "inventado" }), /modo desconocido/);
});

await prueba("la pregunta trae siempre la correcta entre las alternativas", () => {
  const s = P.crearSesion({ modo: "tira", opciones: 4, azar: Math.random });
  for (let i = 0; i < 200; i++) {
    const q = s.siguiente();
    assert.equal(q.alternativas.length, 4);
    assert.ok(q.alternativas.includes(q.correcta), "la correcta no está");
    assert.equal(new Set(q.alternativas).size, 4, "hay alternativas repetidas");
    s.responder(q.correcta);
  }
});

await prueba("la cantidad de alternativas se acota a lo posible", () => {
  assert.equal(P.crearSesion({ opciones: 1 }).siguiente().alternativas.length, 2);
  assert.equal(P.crearSesion({ opciones: 99 }).siguiente().alternativas.length, 12);
});

await prueba("en el modo de la quinta se pregunta una nota y se contesta otra", () => {
  const s = P.crearSesion({ modo: "quinta", opciones: 4 });
  for (let i = 0; i < 60; i++) {
    const q = s.siguiente();
    assert.equal(q.correcta, T.desde(q.nota, 7), `la quinta de ${q.nota}`);
    assert.notEqual(q.correcta, q.nota);
    // Y el giro que muestra es el del capítulo 8, siempre el mismo.
    assert.equal(q.giro, 210);
    s.responder(q.correcta);
  }
});

await prueba("en los otros tres modos se contesta la misma nota que se muestra", () => {
  ["tira", "rueda", "tarjeta"].forEach((m) => {
    const s = P.crearSesion({ modo: m });
    const q = s.siguiente();
    assert.equal(q.correcta, q.nota);
    assert.equal(q.giro, 0);
  });
});

await prueba("nunca se repite la misma nota dos veces seguidas", () => {
  // Acertar por inercia no es acordarse.
  const s = P.crearSesion({ modo: "tira" });
  let anterior = null;
  for (let i = 0; i < 300; i++) {
    const q = s.siguiente();
    assert.notEqual(q.nota, anterior, `se repitió ${q.nota}`);
    s.responder(q.correcta);
    anterior = q.nota;
  }
});

await prueba("con el tiempo salen las doce notas, no un puñado", () => {
  const s = P.crearSesion({ modo: "rueda" });
  const vistas = new Set();
  for (let i = 0; i < 400; i++) { const q = s.siguiente(); vistas.add(q.nota); s.responder(q.correcta); }
  assert.equal(vistas.size, 12, `sólo aparecieron ${vistas.size} notas`);
});

await prueba("la correcta no cae siempre en el mismo botón", () => {
  // Con 4 opciones y reparto parejo, cada posición debería llevarse ~25%.
  const s = P.crearSesion({ modo: "tira", opciones: 4 });
  const posiciones = [0, 0, 0, 0];
  for (let i = 0; i < 1200; i++) {
    const q = s.siguiente();
    posiciones[q.alternativas.indexOf(q.correcta)]++;
    s.responder(q.correcta);
  }
  posiciones.forEach((v, i) =>
    assert.ok(v > 180 && v < 420, `la posición ${i} salió ${v} veces de 1200`));
});

titulo("practica.js — el marcador y los pesos");

await prueba("acertar suma, fallar corta la racha", () => {
  const s = P.crearSesion({ modo: "tira" });
  let q = s.siguiente(); s.responder(q.correcta);
  q = s.siguiente(); s.responder(q.correcta);
  assert.equal(s.marcador.racha, 2);
  assert.equal(s.marcador.aciertos, 2);
  q = s.siguiente();
  const mal = q.alternativas.find((a) => a !== q.correcta);
  const r = s.responder(mal);
  assert.equal(r.acierto, false);
  assert.equal(r.correcta, q.correcta);
  assert.equal(s.marcador.racha, 0);
  assert.equal(s.marcador.fallos, 1);
  assert.equal(s.marcador.mejorRacha, 2, "la mejor racha no se pierde");
  cerca(s.marcador.puntaje, 2 / 3, 1e-9, "el puntaje");
});

await prueba("responder dos veces la misma pregunta no cuenta dos veces", () => {
  // Si contara, bastaría con tocar todos los botones para tener 100%.
  const s = P.crearSesion({ modo: "tira" });
  const q = s.siguiente();
  s.responder(q.correcta);
  const otra = s.responder(q.correcta);
  assert.equal(otra.yaRespondida, true);
  assert.equal(otra.acierto, null);
  assert.equal(s.marcador.total, 1);
});

await prueba("fallar una nota la hace pesar más; acertarla, menos", () => {
  const s = P.crearSesion({ modo: "tira" });
  const q = s.siguiente();
  const i = T.indiceDe(q.correcta);
  const antes = s.pesos[i];
  s.responder(q.alternativas.find((a) => a !== q.correcta));
  assert.ok(s.pesos[i] > antes, "fallar tendría que subir el peso");
});

await prueba("los pesos no se escapan ni a cero ni al infinito", () => {
  const s = P.crearSesion({ modo: "tira" });
  for (let i = 0; i < 500; i++) {
    const q = s.siguiente();
    // Siempre mal: el peso de todas tendría que subir, pero con techo.
    s.responder(q.alternativas.find((a) => a !== q.correcta));
  }
  s.pesos.forEach((p) => assert.ok(p <= 12 && p >= 0.25, `peso fuera de rango: ${p}`));
  const s2 = P.crearSesion({ modo: "tira" });
  for (let i = 0; i < 500; i++) { const q = s2.siguiente(); s2.responder(q.correcta); }
  s2.pesos.forEach((p) => assert.ok(p >= 0.25, `peso hundido: ${p}`));
});

await prueba("la nota que se falla vuelve a salir más seguido", () => {
  // Es la razón de ser del peso, y es lo que no se ve mirando la pantalla.
  const s = P.crearSesion({ modo: "tira" });
  // Se falla adrede todo lo que sea Do; el resto se acierta.
  let salidasDo = 0;
  for (let i = 0; i < 600; i++) {
    const q = s.siguiente();
    if (q.correcta === "C") {
      salidasDo++;
      s.responder(q.alternativas.find((a) => a !== "C"));
    } else {
      s.responder(q.correcta);
    }
  }
  // Con reparto parejo el Do saldría ~50 de 600. Castigado, muchas más.
  assert.ok(salidasDo > 120, `el Do salió sólo ${salidasDo} veces de 600`);
});

await prueba("«flojas» lista lo que cuesta, y sólo lo ya visto", () => {
  const s = P.crearSesion({ modo: "tira" });
  assert.deepEqual(s.flojas(), [], "sin preguntas no hay nada que listar");
  for (let i = 0; i < 40; i++) {
    const q = s.siguiente();
    if (q.correcta === "E") s.responder(q.alternativas.find((a) => a !== "E"));
    else s.responder(q.correcta);
  }
  const f = s.flojas();
  assert.ok(f.length > 0);
  f.forEach((x) => {
    assert.ok(x.vistas > 0);
    assert.match(x.color, /^#[0-9a-f]{6}$/i);
    assert.ok(x.latino, "falta el nombre en latino");
  });
  assert.equal(f[0].nota, "E", "la más floja tendría que ser la que se falló");
});

await prueba("el azar se puede inyectar, así que el reparto es comprobable", () => {
  // Con un azar que siempre devuelve casi cero, sale siempre la primera
  // candidata disponible — que por la regla de no repetir va alternando.
  const s = P.crearSesion({ modo: "tira", azar: azarDe([0]) });
  const a = s.siguiente(); s.responder(a.correcta);
  const b = s.siguiente(); s.responder(b.correcta);
  assert.notEqual(a.nota, b.nota);
});

await prueba("elegirConPeso respeta el peso, y un peso cero no sale nunca", () => {
  const items = ["a", "b", "c"];
  assert.equal(P.elegirConPeso(items, [1, 0, 0], () => 0.5), "a");
  assert.equal(P.elegirConPeso(items, [0, 1, 0], () => 0.5), "b");
  assert.equal(P.elegirConPeso(items, [0, 0, 1], () => 0.99), "c");
  // Todos en cero no puede romper: devuelve algo.
  assert.ok(items.includes(P.elegirConPeso(items, [0, 0, 0], () => 0.5)));
});

await prueba("responder sin pregunta en curso avisa, no rompe en silencio", () => {
  const s = P.crearSesion({ modo: "tira" });
  assert.throws(() => s.responder("C"), /no hay pregunta/);
});

// ═══ La página ═══════════════════════════════════════════════════════════════
// El módulo que vive adentro de `codigo.html` se corre acá contra un DOM de
// mentira. No es un lujo: la primera vez que se corrió encontró un `NaN°`
// impreso en pantalla —una propiedad que se leía de un objeto que no la
// tenía—. Eso no lo agarra `node --check`, porque el archivo parsea perfecto.
titulo("codigo.html — el módulo de la página");

const { readFile } = await import("node:fs/promises");
const raizRepo = new URL("../", import.meta.url);

// El DOM de mentira. No pretende ser un navegador: alcanza para que el módulo
// arranque, dibuje la primera pantalla y se le pueda disparar un `change`. Lo
// que hay debajo —qué se pregunta, cómo se puntúa, cómo se reparte el azar— ya
// está cubierto arriba, sin pantalla de por medio.
const nodos = new Map();
const nodo = (id) => ({
  id, innerHTML: "", textContent: "", value: "", className: "", hidden: false,
  disabled: false, style: {}, dataset: {},
  setAttribute() {}, getAttribute() { return null; }, focus() {},
  classList: { add() {}, remove() {}, toggle() {} },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  closest() { return null; },
  addEventListener(_ev, fn) { (this._h ||= []).push(fn); },
  disparar(ev = {}) { (this._h || []).forEach((f) => f(ev)); },
});
globalThis.document = {
  _h: [],
  getElementById(id) {
    if (!nodos.has(id)) nodos.set(id, nodo(id));
    return nodos.get(id);
  },
  addEventListener(_ev, fn) { this._h.push(fn); },
};

await prueba("el script de la página corre entero, sin reventar", async () => {
  const html = await readFile(new URL("public/codigo.html", raizRepo), "utf8");
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(m, "no se encontró el módulo dentro del html");
  // Las rutas relativas del navegador se reescriben a file:// — un módulo
  // cargado desde un `data:` no tiene contra qué resolver un "./algo".
  const js = m[1].replace(/\.\/codigo\//g, new URL("public/codigo/", raizRepo).href);
  await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
});

await prueba("ninguna tabla queda vacía al abrir", () => {
  ["tira", "t-blanco", "t-tritonos", "t-mezclas", "t-armonicos", "t-octavas", "notas-ac"]
    .forEach((id) => assert.ok(nodos.get(id)?.innerHTML, `${id} quedó vacío`));
});

await prueba("ningún texto armado por la página imprime NaN ni undefined", () => {
  // La prueba que faltaba. Un número que no existe se imprime igual, y queda
  // un «NaN°» en una explicación de teoría musical.
  nodos.forEach((n, id) => {
    const t = (n.innerHTML || "") + (n.textContent || "");
    assert.ok(!/NaN|undefined|Infinity/.test(t), `${id} imprime un valor roto: ${t.slice(0, 120)}`);
  });
});

await prueba("el script de practica.html también arranca y dibuja", async () => {
  // Cada página se prueba con sus propios nodos: si compartieran el mapa, una
  // podría tapar un fallo de la otra dejando algo ya escrito.
  const antes = new Map(nodos);
  nodos.clear();
  try {
    const html = await readFile(new URL("public/practica.html", raizRepo), "utf8");
    const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    assert.ok(m, "no se encontró el módulo dentro del html");
    const js = m[1]
      .replace(/\.\/codigo\//g, new URL("public/codigo/", raizRepo).href)
      .replace(/\.\/gestos\//g, new URL("public/gestos/", raizRepo).href);
    await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

    // Arrancó: hay ejercicio elegido, hay pregunta en pantalla y hay opciones.
    ["modos", "comoVa", "opciones", "pedido", "flojas", "sellos"]
      .forEach((id) => assert.ok(nodos.get(id)?.innerHTML || nodos.get(id)?.textContent,
        `${id} quedó vacío al abrir`));
    assert.match(nodos.get("sellos").textContent, /codigo-practica /);
    nodos.forEach((n, id) => {
      const t = (n.innerHTML || "") + (n.textContent || "");
      assert.ok(!/NaN|undefined|Infinity/.test(t), `${id} imprime un valor roto`);
    });
  } finally {
    nodos.clear();
    antes.forEach((v, k) => nodos.set(k, v));
  }
});

await prueba("cualquier acorde se puede pintar sin error", () => {
  const raiz = document.getElementById("raiz"), tipo = document.getElementById("tipo");
  T.CROMATICA.forEach((r) => {
    Object.keys(T.TIPOS).forEach((k) => {
      raiz.value = r; tipo.value = k;
      raiz.disparar();
      const fondo = document.getElementById("m-luz").style.background;
      assert.match(fondo || "", /^#[0-9a-f]{6}$/i, `${r} ${k} no pintó`);
    });
  });
});

// ═══ Cierre ══════════════════════════════════════════════════════════════════
console.log(`\n${pasadas} pasadas, ${fallidas} fallidas`);
process.exit(fallidas ? 1 : 0);
