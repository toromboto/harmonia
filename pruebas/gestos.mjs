// ─────────────────────────────────────────────────────────────────────────────
// pruebas/gestos.mjs — Banco de pruebas del instrumento de gestos
//
//   node pruebas/gestos.mjs
//
// Sin dependencias y sin navegador: corre la lógica que se puede correr — la
// teoría musical del instrumento. Lo que necesita cámara o Web Audio no se
// prueba acá, se prueba con la mano.
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";

let pasadas = 0, fallidas = 0;
async function prueba(nombre, fn) {
  try { await fn(); pasadas++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallidas++; console.log(`  ✗ ${nombre}\n      ${e.message}`); }
}
const titulo = (t) => console.log(`\n${t}`);

// ═══ Teoría musical ══════════════════════════════════════════════════════════
const M = await import("../public/gestos/musica.js");

titulo("musica.js — la rejilla y las notas");

await prueba("DO central es MIDI 60", () => {
  assert.equal(M.midiDe("C", 4), 60);
  assert.equal(M.nombreDe(60), "C");
  assert.equal(M.octavaDe(60), 4);
});

await prueba("LA 440 cae en 440 Hz, y la afinación es un parámetro", () => {
  assert.equal(Math.round(M.frecuenciaDe(69)), 440);
  assert.equal(Math.round(M.frecuenciaDe(69, 432)), 432);
  // Una octava arriba es exactamente el doble, no «casi».
  assert.equal(M.frecuenciaDe(81) / M.frecuenciaDe(69), 2);
});

await prueba("la rejilla cubre las octavas pedidas y cierra en la tónica", () => {
  const r = M.rejilla({ tonica: "A", octava: 3, escala: "pentaMenor", octavas: 2 });
  assert.equal(r.length, 5 * 2 + 1, "5 notas por octava, dos octavas, más el cierre");
  assert.equal(r[0], M.midiDe("A", 3));
  assert.equal(r[r.length - 1], M.midiDe("A", 3) + 24);
  // Estrictamente creciente: si dos zonas dan la misma nota, o si baja, el
  // teclado deja de ser un teclado.
  for (let i = 1; i < r.length; i++) assert.ok(r[i] > r[i - 1], `no crece en ${i}`);
});

await prueba("todas las escalas producen rejillas crecientes", () => {
  for (const clave of Object.keys(M.ESCALAS)) {
    const r = M.rejilla({ tonica: "C", octava: 3, escala: clave, octavas: 2 });
    for (let i = 1; i < r.length; i++) {
      assert.ok(r[i] > r[i - 1], `${clave} no crece en ${i}`);
    }
  }
});

await prueba("las zonas cubren la pantalla entera, sin huecos ni desbordes", () => {
  const n = 11;
  assert.equal(M.zonaDe(0, n).indice, 0);
  assert.equal(M.zonaDe(0.999, n).indice, n - 1);
  // El borde exacto no puede salirse del arreglo: la mano llega a x=1.
  assert.equal(M.zonaDe(1, n).indice, n - 1);
  assert.equal(M.zonaDe(-0.2, n).indice, 0);
  // Cada zona tiene el mismo ancho y son contiguas.
  const vistos = new Set();
  for (let i = 0; i < 400; i++) vistos.add(M.zonaDe(i / 400, n).indice);
  assert.equal(vistos.size, n, "alguna zona quedó sin poder alcanzarse");
});

await prueba("el acorde de un grado sube, y el de arriba pasa a la octava siguiente", () => {
  const a = M.acordeDeGrado("mayor", "C", 3, 0);
  assert.deepEqual(a, [M.midiDe("C",3), M.midiDe("E",3), M.midiDe("G",3)]);
  const ultimo = M.acordeDeGrado("mayor", "C", 3, 6);   // séptimo grado
  for (let i = 1; i < ultimo.length; i++) assert.ok(ultimo[i] > ultimo[i-1], "el acorde no está ordenado");
});

await prueba("cada nota tiene color, incluidas las alteradas", () => {
  for (let m = 60; m < 72; m++) {
    assert.notEqual(M.colorDe(m), "#888", `${M.nombreDe(m)} sin color`);
  }
});

await prueba("la etiqueta latina no se olvida de la octava", () => {
  assert.equal(M.etiquetaDe(60, false), "C4");
  assert.equal(M.etiquetaDe(60, true), "DO4");
});

console.log(`\n${pasadas} pasadas, ${fallidas} fallidas\n`);
process.exit(fallidas ? 1 : 0);
