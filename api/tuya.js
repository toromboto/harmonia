// ─────────────────────────────────────────────────────────────────────────────
// api/tuya.js — Función serverless (Vercel) · el único lugar que ve las
// credenciales de Tuya
//
// REGLA DE ORO DEL ECOSISTEMA: ningún valor real de una credencial entra a
// este repositorio, a ningún otro, ni a ningún chat. Acá sólo están los
// NOMBRES de las variables; los valores los carga Mauro a mano en
// Vercel → Project → Settings → Environment Variables. Ver `.env.example`,
// `GESTOS.md`, y `PROTOCOLO-SECRETOS.md` del repo privado `datos`.
//
// Variables que lee (ninguna tiene valor por defecto que dé acceso):
//   TUYA_CLIENT_ID       Access ID de la app en Tuya IoT Platform
//   TUYA_CLIENT_SECRET   Access Secret de esa misma app
//   TUYA_REGION          us | eu | cn | in     (por defecto: us)
//   TUYA_DISPOSITIVOS    JSON: alias → { id, comando, comandos[], min, max }
//   HARMONIA_CLAVE       frase compartida con la página; sin ella no se hace nada
//
// Por qué existe la clave: esta dirección es pública, como todo lo que
// publica Vercel. Sin un secreto compartido, cualquiera que la descubra le
// prende la luz a Mauro desde el otro lado del mundo. No es autenticación
// seria —quien tenga el teléfono la tiene—, es la diferencia entre una puerta
// cerrada y una puerta que no está.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";

const VERSION = "api-tuya 1.0";

const ENDPOINTS = {
  us: "https://openapi.tuyaus.com",
  eu: "https://openapi.tuyaeu.com",
  cn: "https://openapi.tuyacn.com",
  in: "https://openapi.tuyain.com",
};

const SHA256_VACIO = crypto.createHash("sha256").update("").digest("hex");

// ─── Configuración leída del entorno (nunca del cuerpo del pedido) ───────────
function configuracion() {
  const faltan = [];
  const clientId = process.env.TUYA_CLIENT_ID || "";
  const secret   = process.env.TUYA_CLIENT_SECRET || "";
  const clave    = process.env.HARMONIA_CLAVE || "";
  if (!clientId) faltan.push("TUYA_CLIENT_ID");
  if (!secret)   faltan.push("TUYA_CLIENT_SECRET");
  if (!clave)    faltan.push("HARMONIA_CLAVE");

  const region = (process.env.TUYA_REGION || "us").toLowerCase();
  const base = ENDPOINTS[region] || ENDPOINTS.us;

  let dispositivos = {};
  const crudo = process.env.TUYA_DISPOSITIVOS;
  let errorDispositivos = null;
  if (crudo) {
    try {
      const parseado = JSON.parse(crudo);
      for (const [alias, v] of Object.entries(parseado)) {
        const d = typeof v === "string" ? { id: v } : (v || {});
        if (!d.id) continue;
        const porDefecto = d.comando || "switch_1";
        dispositivos[alias] = {
          id: d.id,
          comando: porDefecto,
          // Sin lista explícita, el único comando permitido es el declarado.
          // Un alias no habilita mandarle cualquier cosa al dispositivo.
          comandos: Array.isArray(d.comandos) && d.comandos.length ? d.comandos : [porDefecto],
          min: typeof d.min === "number" ? d.min : null,
          max: typeof d.max === "number" ? d.max : null,
        };
      }
    } catch (e) {
      errorDispositivos = "TUYA_DISPOSITIVOS no es JSON válido";
    }
  } else {
    faltan.push("TUYA_DISPOSITIVOS");
  }

  return { clientId, secret, clave, region, base, dispositivos, faltan, errorDispositivos };
}

// ─── Firma de Tuya ───────────────────────────────────────────────────────────
// str = client_id + access_token + t + nonce + stringToSign
// stringToSign = MÉTODO \n sha256(cuerpo) \n cabecerasFirmadas \n url
// La url incluye la query, ordenada. No firmamos cabeceras propias, así que
// esa línea va vacía — pero el "\n" tiene que estar igual.
function firmar({ metodo, url, cuerpo, clientId, secret, token, t, nonce }) {
  const hash = cuerpo ? crypto.createHash("sha256").update(cuerpo, "utf8").digest("hex") : SHA256_VACIO;
  const stringToSign = [metodo, hash, "", url].join("\n");
  const str = clientId + (token || "") + t + nonce + stringToSign;
  return crypto.createHmac("sha256", secret).update(str, "utf8").digest("hex").toUpperCase();
}

async function llamarTuya({ cfg, metodo, url, cuerpo = "", token = "" }) {
  const t = Date.now().toString();
  const nonce = crypto.randomUUID();
  const sign = firmar({ metodo, url, cuerpo, clientId: cfg.clientId, secret: cfg.secret, token, t, nonce });

  const cabeceras = {
    client_id: cfg.clientId,
    sign,
    t,
    nonce,
    sign_method: "HMAC-SHA256",
    "Content-Type": "application/json",
  };
  if (token) cabeceras.access_token = token;

  const corte = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
  const r = await fetch(cfg.base + url, {
    method: metodo,
    headers: cabeceras,
    body: metodo === "GET" ? undefined : cuerpo,
    signal: corte,
  });
  return r.json();
}

// ─── Token, con caché ────────────────────────────────────────────────────────
// La instancia serverless sobrevive entre pedidos mientras esté tibia; pedir
// un token por gesto sería duplicar la latencia de cada nota que prende algo.
let tokenGuardado = { valor: null, vence: 0, region: null };

async function obtenerToken(cfg) {
  const ahora = Date.now();
  if (tokenGuardado.valor && tokenGuardado.region === cfg.region && ahora < tokenGuardado.vence) {
    return tokenGuardado.valor;
  }
  const res = await llamarTuya({ cfg, metodo: "GET", url: "/v1.0/token?grant_type=1" });
  if (!res || res.success !== true || !res.result?.access_token) {
    tokenGuardado = { valor: null, vence: 0, region: null };
    throw new Error(res?.msg ? `Tuya rechazó las credenciales: ${res.msg}` : "Tuya no entregó token");
  }
  const segundos = Number(res.result.expire_time || 7200);
  tokenGuardado = {
    valor: res.result.access_token,
    // Un minuto de margen: un token que vence en vuelo devuelve un error feo
    // y difícil de leer del otro lado.
    vence: ahora + Math.max(60, segundos - 60) * 1000,
    region: cfg.region,
  };
  return tokenGuardado.valor;
}

// ─── Freno ───────────────────────────────────────────────────────────────────
// El instrumento manda gestos, y un gesto puede repetirse sin querer. El freno
// del navegador ya filtra la mayoría; éste es el que no se puede saltear
// abriendo las herramientas de desarrollo.
const ultimoPorDispositivo = new Map();
const MINIMO_MS = 700;

function claveIgual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function validarValor(valor, d) {
  if (typeof valor === "boolean") return { ok: true, valor };
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return { ok: false, motivo: "valor numérico inválido" };
    if (d.min !== null && valor < d.min) return { ok: false, motivo: `valor por debajo de ${d.min}` };
    if (d.max !== null && valor > d.max) return { ok: false, motivo: `valor por encima de ${d.max}` };
    return { ok: true, valor };
  }
  if (typeof valor === "string") {
    if (valor.length > 64) return { ok: false, motivo: "valor de texto demasiado largo" };
    return { ok: true, valor };
  }
  return { ok: false, motivo: "el valor tiene que ser booleano, número o texto" };
}

// ─── Manejador ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const cfg = configuracion();
  const claveRecibida = req.headers["x-harmonia-clave"] || "";

  // Puerta única: sin clave configurada en Vercel, esto no funciona para
  // nadie. Cerrado por defecto, nunca abierto por falta de configuración.
  if (!cfg.clave || !claveRecibida || !claveIgual(claveRecibida, cfg.clave)) {
    return res.status(401).json({ ok: false, motivo: "clave de la sala incorrecta o ausente" });
  }

  // ── Diagnóstico: qué está configurado, nunca con qué valor ────────────────
  if (req.method === "GET") {
    return res.status(200).json({
      ok: cfg.faltan.length === 0 && !cfg.errorDispositivos,
      version: VERSION,
      region: cfg.region,
      faltan: cfg.faltan,
      errorDispositivos: cfg.errorDispositivos,
      // Alias y comandos permitidos. Los identificadores de dispositivo no
      // salen de acá: no son secretos, pero tampoco tienen por qué viajar.
      dispositivos: Object.fromEntries(
        Object.entries(cfg.dispositivos).map(([a, d]) => [a, { comandos: d.comandos }])
      ),
      tokenEnCache: Boolean(tokenGuardado.valor && Date.now() < tokenGuardado.vence),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, motivo: "método no permitido" });
  }

  if (cfg.faltan.length || cfg.errorDispositivos) {
    return res.status(503).json({
      ok: false,
      motivo: cfg.errorDispositivos || `faltan variables de entorno: ${cfg.faltan.join(", ")}`,
    });
  }

  let cuerpo = req.body;
  if (typeof cuerpo === "string") { try { cuerpo = JSON.parse(cuerpo); } catch (e) { cuerpo = null; } }
  if (!cuerpo || typeof cuerpo !== "object") {
    return res.status(400).json({ ok: false, motivo: "cuerpo JSON inválido" });
  }

  const alias = String(cuerpo.dispositivo || "");
  const d = cfg.dispositivos[alias];
  if (!d) {
    return res.status(400).json({
      ok: false,
      motivo: `dispositivo desconocido: ${alias || "(vacío)"}`,
      conocidos: Object.keys(cfg.dispositivos),
    });
  }

  const comando = String(cuerpo.comando || d.comando);
  if (!d.comandos.includes(comando)) {
    return res.status(400).json({ ok: false, motivo: `comando no habilitado para ${alias}`, permitidos: d.comandos });
  }

  const v = validarValor(cuerpo.valor === undefined ? true : cuerpo.valor, d);
  if (!v.ok) return res.status(400).json({ ok: false, motivo: v.motivo });

  const ahora = Date.now();
  const previo = ultimoPorDispositivo.get(alias) || 0;
  if (ahora - previo < MINIMO_MS) {
    return res.status(429).json({ ok: false, motivo: "demasiado seguido", esperar: MINIMO_MS - (ahora - previo) });
  }
  ultimoPorDispositivo.set(alias, ahora);

  try {
    const token = await obtenerToken(cfg);
    const url = `/v1.0/iot-03/devices/${encodeURIComponent(d.id)}/commands`;
    const payload = JSON.stringify({ commands: [{ code: comando, value: v.valor }] });
    let resultado = await llamarTuya({ cfg, metodo: "POST", url, cuerpo: payload, token });

    // 1010 = token vencido o inválido. Pasa cuando la instancia estuvo tibia
    // más de lo que duró el token; se pide uno nuevo y se reintenta una vez.
    if (resultado && resultado.success !== true && String(resultado.code) === "1010") {
      tokenGuardado = { valor: null, vence: 0, region: null };
      const nuevo = await obtenerToken(cfg);
      resultado = await llamarTuya({ cfg, metodo: "POST", url, cuerpo: payload, token: nuevo });
    }

    if (!resultado || resultado.success !== true) {
      return res.status(502).json({
        ok: false,
        motivo: resultado?.msg || "Tuya rechazó el comando",
        codigo: resultado?.code ?? null,
      });
    }

    return res.status(200).json({ ok: true, dispositivo: alias, comando, valor: v.valor });
  } catch (e) {
    return res.status(502).json({ ok: false, motivo: e.message || "error hablando con Tuya" });
  }
}
