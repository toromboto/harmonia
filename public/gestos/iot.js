// ─────────────────────────────────────────────────────────────────────────────
// iot.js — El puente al mundo físico, del lado del navegador
//
// Esta página NUNCA ve una credencial de Tuya. Habla con /api/tuya, que corre
// en Vercel, y esa función es la única que conoce el Access ID y el Access
// Secret — leídos de las variables de entorno del proyecto, cargadas a mano.
// Ver GESTOS.md y PROTOCOLO-SECRETOS.md del repo `datos`.
//
// Lo único que viaja desde acá es la clave de la sala: una frase que Mauro
// escribe una vez en el teléfono y queda en el localStorage de ESE teléfono.
// No está en el repositorio, no está en el código, y sin ella la función no
// hace nada — si no, cualquiera que descubra la dirección le prende la luz.
// ─────────────────────────────────────────────────────────────────────────────

export const VERSION = "gestos-iot 1.0";

const LLAVERO = "harmonia_gestos_clave_v1";
const RUTA = "/api/tuya";

export const guardarClave = (clave) => {
  try { localStorage.setItem(LLAVERO, clave || ""); } catch (e) {}
};
export const leerClave = () => {
  try { return localStorage.getItem(LLAVERO) || ""; } catch (e) { return ""; }
};
export const hayClave = () => leerClave().length > 0;

// Cada dispositivo tiene su propio reloj: dos gestos seguidos sobre la misma
// luz se descartan, pero prender la luz no bloquea el relé.
const ultimoEnvio = new Map();

export function crearPuente({ cooldown = 1200, alRegistrar = null } = {}) {
  let habilitado = true;
  let enVuelo = 0;

  const registrar = (nivel, texto) => { if (alRegistrar) alRegistrar(nivel, texto); };

  async function enviar(dispositivo, comando, valor) {
    if (!habilitado) return { ok: false, motivo: "apagado" };
    const clave = leerClave();
    if (!clave) { registrar("aviso", "Falta la clave de la sala"); return { ok: false, motivo: "sin-clave" }; }

    const ahora = performance.now();
    const previo = ultimoEnvio.get(dispositivo) || 0;
    if (ahora - previo < cooldown) return { ok: false, motivo: "muy-seguido" };
    ultimoEnvio.set(dispositivo, ahora);

    // El gesto no espera a la red: el corte del pedido es corto a propósito.
    // Si la nube de Tuya tarda tres segundos, el instrumento sigue tocando.
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 4000);
    enVuelo++;
    try {
      const r = await fetch(RUTA, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-harmonia-clave": clave },
        body: JSON.stringify({ dispositivo, comando, valor }),
        signal: corte.signal,
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok || cuerpo.ok === false) {
        registrar("error", cuerpo.motivo || `Tuya respondió ${r.status}`);
        return { ok: false, motivo: cuerpo.motivo || String(r.status), estado: r.status };
      }
      registrar("ok", `${dispositivo} → ${comando}=${valor}`);
      return { ok: true, ...cuerpo };
    } catch (e) {
      const motivo = e.name === "AbortError" ? "la nube no contestó a tiempo" : e.message;
      registrar("error", motivo);
      return { ok: false, motivo };
    } finally {
      clearTimeout(reloj);
      enVuelo--;
    }
  }

  async function diagnostico() {
    const clave = leerClave();
    try {
      const r = await fetch(RUTA, { headers: { "x-harmonia-clave": clave } });
      return await r.json();
    } catch (e) {
      return { ok: false, motivo: e.message };
    }
  }

  return {
    VERSION,
    enviar,
    diagnostico,
    set encendido(v) { habilitado = !!v; },
    get encendido() { return habilitado; },
    get pendientes() { return enVuelo; },
  };
}
