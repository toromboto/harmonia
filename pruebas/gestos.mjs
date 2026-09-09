// ─────────────────────────────────────────────────────────────────────────────
// pruebas/gestos.mjs — Banco de pruebas del instrumento de gestos
//
//   node pruebas/gestos.mjs
//
// Sin dependencias y sin navegador: corre la lógica que se puede correr —
// la teoría musical y la función de Tuya, con la nube de Tuya simulada. Lo
// que necesita cámara o Web Audio no se prueba acá, se prueba con la mano.
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import crypto from "node:crypto";

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

// ═══ La función de Tuya ══════════════════════════════════════════════════════
titulo("api/tuya.js — la puerta al mundo físico");

const CLAVE = "clave-de-prueba-no-real";
process.env.TUYA_CLIENT_ID = "id-de-prueba";
process.env.TUYA_CLIENT_SECRET = "secreto-de-prueba";
process.env.HARMONIA_CLAVE = CLAVE;
process.env.TUYA_REGION = "us";
process.env.TUYA_DISPOSITIVOS = JSON.stringify({
  luz:  { id: "vdevo-luz",  comando: "switch_1" },
  atenuador: { id: "vdevo-dim", comando: "bright_value", comandos: ["bright_value","switch_1"], min: 10, max: 1000 },
  rele: "vdevo-rele",
});

const { default: manejador } = await import("../api/tuya.js");

// Nube de Tuya simulada: guarda lo que se le pidió para poder revisarlo.
let pedidos = [];
let respondeToken = true;
globalThis.fetch = async (url, opciones) => {
  pedidos.push({ url, opciones });
  if (String(url).includes("/v1.0/token")) {
    return { json: async () => (respondeToken
      ? { success: true, result: { access_token: "token-simulado", expire_time: 7200 } }
      : { success: false, msg: "sign invalid", code: 1004 }) };
  }
  return { json: async () => ({ success: true, result: true }) };
};

function pedido({ metodo = "POST", clave = CLAVE, cuerpo = {} } = {}) {
  const res = {
    codigo: null, cuerpo: null, cabeceras: {},
    setHeader(k, v) { this.cabeceras[k] = v; },
    status(c) { this.codigo = c; return this; },
    json(o) { this.cuerpo = o; return this; },
  };
  const req = { method: metodo, headers: clave === null ? {} : { "x-harmonia-clave": clave }, body: cuerpo };
  return { req, res };
}

await prueba("sin clave no pasa nada, ni siquiera el diagnóstico", async () => {
  const { req, res } = pedido({ metodo: "GET", clave: null });
  await manejador(req, res);
  assert.equal(res.codigo, 401);
  assert.equal(res.cuerpo.ok, false);
});

await prueba("con la clave equivocada tampoco", async () => {
  const { req, res } = pedido({ clave: "otra-cosa", cuerpo: { dispositivo: "luz", valor: true } });
  await manejador(req, res);
  assert.equal(res.codigo, 401);
});

await prueba("una clave del largo justo pero distinta no se cuela", async () => {
  const casi = CLAVE.slice(0, -1) + "X";
  const { req, res } = pedido({ clave: casi, cuerpo: { dispositivo: "luz", valor: true } });
  await manejador(req, res);
  assert.equal(res.codigo, 401);
});

await prueba("el diagnóstico dice qué hay, nunca cuánto vale", async () => {
  const { req, res } = pedido({ metodo: "GET" });
  await manejador(req, res);
  assert.equal(res.codigo, 200);
  const texto = JSON.stringify(res.cuerpo);
  assert.ok(!texto.includes("secreto-de-prueba"), "se filtró el secreto");
  assert.ok(!texto.includes("id-de-prueba"), "se filtró el client id");
  assert.ok(!texto.includes("vdevo-luz"), "se filtró el identificador del dispositivo");
  assert.ok(!texto.includes(CLAVE), "se filtró la clave");
  assert.deepEqual(Object.keys(res.cuerpo.dispositivos).sort(), ["atenuador","luz","rele"]);
  // La forma corta ("alias": "id") tiene que quedar con su comando por defecto.
  assert.deepEqual(res.cuerpo.dispositivos.rele.comandos, ["switch_1"]);
});

await prueba("un dispositivo que no está en la lista se rechaza", async () => {
  const { req, res } = pedido({ cuerpo: { dispositivo: "el-horno", valor: true } });
  await manejador(req, res);
  assert.equal(res.codigo, 400);
  assert.match(res.cuerpo.motivo, /desconocido/);
});

await prueba("un alias no habilita mandarle cualquier comando", async () => {
  const { req, res } = pedido({ cuerpo: { dispositivo: "luz", comando: "factory_reset", valor: true } });
  await manejador(req, res);
  assert.equal(res.codigo, 400);
  assert.deepEqual(res.cuerpo.permitidos, ["switch_1"]);
});

await prueba("un comando de la lista declarada sí pasa", async () => {
  pedidos = [];
  const { req, res } = pedido({ cuerpo: { dispositivo: "atenuador", comando: "bright_value", valor: 500 } });
  await manejador(req, res);
  assert.equal(res.codigo, 200, JSON.stringify(res.cuerpo));
  const orden = pedidos.find(p => String(p.url).includes("/commands"));
  assert.ok(orden, "no se mandó la orden");
  assert.deepEqual(JSON.parse(orden.opciones.body), { commands: [{ code: "bright_value", value: 500 }] });
  assert.ok(String(orden.url).includes("vdevo-dim"), "fue al dispositivo equivocado");
});

await prueba("los límites del dispositivo se respetan", async () => {
  const { req, res } = pedido({ cuerpo: { dispositivo: "atenuador", comando: "bright_value", valor: 99999 } });
  await manejador(req, res);
  assert.equal(res.codigo, 400);
  assert.match(res.cuerpo.motivo, /por encima/);
});

await prueba("la firma va en las cabeceras, en el formato que Tuya espera", async () => {
  const token = pedidos.find(p => String(p.url).includes("/v1.0/token"));
  assert.ok(token, "nunca se pidió el token");
  const h = token.opciones.headers;
  assert.equal(h.sign_method, "HMAC-SHA256");
  assert.equal(h.client_id, "id-de-prueba");
  assert.match(h.sign, /^[0-9A-F]{64}$/, "la firma no es HMAC-SHA256 en mayúsculas");
  assert.match(h.t, /^\d{13}$/, "el sello de tiempo no está en milisegundos");
  assert.ok(h.nonce && h.nonce.length >= 16);
  // Al pedir el token todavía no hay access_token que mandar.
  assert.ok(!("access_token" in h), "mandó un access_token al pedir el token");
});

await prueba("la firma es la que dice la especificación de Tuya", async () => {
  // Se rehace a mano la cuenta que hace la función y se compara con lo que
  // efectivamente viajó: si alguien cambia el orden de las partes, esto cae.
  const token = pedidos.find(p => String(p.url).includes("/v1.0/token"));
  const h = token.opciones.headers;
  const hashVacio = crypto.createHash("sha256").update("").digest("hex");
  const stringToSign = ["GET", hashVacio, "", "/v1.0/token?grant_type=1"].join("\n");
  const str = "id-de-prueba" + "" + h.t + h.nonce + stringToSign;
  const esperada = crypto.createHmac("sha256", "secreto-de-prueba").update(str, "utf8").digest("hex").toUpperCase();
  assert.equal(h.sign, esperada);
});

await prueba("la orden viaja con el access_token, la de token no", async () => {
  const orden = pedidos.find(p => String(p.url).includes("/commands"));
  assert.equal(orden.opciones.headers.access_token, "token-simulado");
});

await prueba("dos órdenes seguidas al mismo aparato: la segunda se frena", async () => {
  const a = pedido({ cuerpo: { dispositivo: "luz", valor: true } });
  await manejador(a.req, a.res);
  assert.equal(a.res.codigo, 200, JSON.stringify(a.res.cuerpo));
  const b = pedido({ cuerpo: { dispositivo: "luz", valor: false } });
  await manejador(b.req, b.res);
  assert.equal(b.res.codigo, 429);
});

await prueba("el token se reusa: no se pide uno por cada gesto", async () => {
  const antes = pedidos.filter(p => String(p.url).includes("/v1.0/token")).length;
  const { req, res } = pedido({ cuerpo: { dispositivo: "atenuador", comando: "switch_1", valor: true } });
  await manejador(req, res);
  const despues = pedidos.filter(p => String(p.url).includes("/v1.0/token")).length;
  assert.equal(antes, despues, "pidió un token de más");
});

await prueba("si Tuya rechaza las credenciales, se dice, sin repetir el secreto", async () => {
  respondeToken = false;
  // Se vacía la caché forzando otra región, que es lo que la invalida.
  process.env.TUYA_REGION = "eu";
  const { req, res } = pedido({ cuerpo: { dispositivo: "rele", comando: "switch_1", valor: false } });
  await manejador(req, res);
  assert.equal(res.codigo, 502, JSON.stringify(res.cuerpo));
  assert.ok(!JSON.stringify(res.cuerpo).includes("secreto-de-prueba"));
  respondeToken = true;
  process.env.TUYA_REGION = "us";
});

await prueba("sin variables cargadas se cierra, no se abre", async () => {
  const guardado = process.env.TUYA_DISPOSITIVOS;
  delete process.env.TUYA_DISPOSITIVOS;
  const { req, res } = pedido({ cuerpo: { dispositivo: "luz", valor: true } });
  await manejador(req, res);
  assert.equal(res.codigo, 503);
  assert.match(res.cuerpo.motivo, /TUYA_DISPOSITIVOS/);
  process.env.TUYA_DISPOSITIVOS = guardado;
});

await prueba("un método que no es GET ni POST no pasa", async () => {
  const { req, res } = pedido({ metodo: "DELETE" });
  await manejador(req, res);
  assert.equal(res.codigo, 405);
});

console.log(`\n${pasadas} pasadas, ${fallidas} fallidas\n`);
process.exit(fallidas ? 1 : 0);
