# Gestos — el instrumento que se toca con las manos

Una página de Harmonía que usa la cámara frontal para convertir el movimiento
de las manos en notas, y ciertos gestos en órdenes a dispositivos Tuya.

| | |
|---|---|
| La página | `/gestos.html` |
| Código del cliente | `public/gestos/` |
| Función de servidor | `api/tuya.js` |
| Banco de pruebas | `pruebas/gestos.mjs` — `npm run prueba` |

---

## 1. Qué es, y qué no

**Es** un instrumento: la mano derecha elige y hace sonar una nota, la
izquierda acompaña con un acorde y dispara una acción física.

**No es** parte de la aplicación React. `gestos.html` vive en `public/`, así
que Vite **lo copia tal cual**, sin compilar. Se abre sola, sin `npm install`,
y se puede editar desde el teléfono como cualquier archivo del repositorio.
Esa fue la decisión de fondo: el resto de Harmonía es un monolito de 3268
líneas en `src/App.jsx`, y meter la cámara ahí adentro habría atado dos cosas
que no tienen por qué moverse juntas.

El costo de esa decisión, dicho de frente: **la paleta de colores tonales está
copiada**, no importada. Vive en `src/App.jsx` (fuente canónica) y en
`public/gestos/musica.js` (copia). Si cambia una, hay que cambiar la otra a
mano. Es el mismo caso que el `PROTOCOLO-SECRETOS.md` del repo `datos`
describe para los identificadores públicos repetidos: no es un descuido, es
lo que se paga por no tener build en esta página, y por eso está anotado.

---

## 2. Cómo se toca

### Mano derecha — la melodía

| Gesto | Qué hace |
|---|---|
| Mover de izquierda a derecha | Elige la nota. Las franjas de color en pantalla son el teclado. |
| Juntar pulgar e índice | La nota suena. Separarlos la calla. |
| Apretar más el pellizco | Más vibrato. El instrumento responde a la presión, no sólo a la posición. |
| Subir o bajar la mano | Abre o cierra el brillo (el filtro). |
| Acercarse a la cámara | Sube el volumen. |

### Mano izquierda — el acompañamiento y la luz

| Gesto | Qué hace |
|---|---|
| Mano abierta | Suena un acorde del grado donde esté la mano. |
| Puño cerrado, **sostenido** | Manda la orden al dispositivo Tuya. Un anillo naranja muestra cuánto falta. |

### Tres decisiones que se sienten al tocar

**El pellizco tiene dos umbrales, no uno.** Abre en 0,55 palmos y cierra en
0,78. Con un solo umbral la nota parpadea justo en el borde — que es
exactamente donde queda la mano de alguien tocando despacio.

**El puño hay que sostenerlo 700 ms.** Un puño instantáneo aparece solo cada
vez que la mano sale del cuadro o se cierra para rascarse la nariz. Setecientos
milisegundos es lo que separa un gesto de un accidente.

**La nota se lee del nudillo del medio, no de la punta del índice.** El nudillo
casi no se mueve cuando los dedos se abren y se cierran, así que la nota no
salta al pellizcar. Con la punta del índice, cada ataque cambiaba de nota.

### Si las manos salen cambiadas

Tocá **«Cambiar mano»**. MediaPipe etiqueta las manos como si la imagen
estuviera espejada; con la cámara frontal y el cuadro sin espejar, sale al
revés. Por eso es un botón y no una constante: se comprueba mirando la
pantalla, no leyendo la documentación.

---

## 3. Las cuatro piezas, y por qué están separadas

```
public/gestos/
  musica.js       escalas, colores, MIDI → Hz.   No sabe que existe una cámara.
  audio.js        Web Audio.                     No sabe que existe una mano.
  manos.js        cámara + MediaPipe.            No sabe que existe el sonido.
  iot.js          cliente de /api/tuya.          No sabe nada de música.
  instrumento.js  el único que los conoce a todos: gesto → nota → orden.
  pagina.js       cableado de los controles de gestos.html.
```

Se puede cambiar el motor de audio sin tocar la cámara, y probar la cámara sin
que suene nada. Lo que sale de `manos.js` no son 21 puntos por mano: son cinco
números con sentido musical (dónde está, qué tan cerca, si pellizca, si cierra
el puño). El resto de la aplicación no debería saber qué es un *landmark*.

### Dos decisiones técnicas que vale la pena no deshacer

**Los osciladores se crean una sola vez y quedan sonando siempre, en
silencio.** Tocar una nota mueve una ganancia y una frecuencia; no crea nodos.
Crear osciladores por nota es la causa más común de latencia irregular y de
clics en el celular — justo lo que un instrumento no se puede permitir, porque
para cuando el sonido llega la mano ya se movió.

**El suavizado es un filtro de una euro, no un promedio.** Cuanto más rápido se
mueve la mano, menos se la suaviza. Un promedio fijo o tiembla en reposo o
llega tarde al ataque; esto no hace ni una cosa ni la otra.

**MediaPipe se carga al encender la cámara, no al abrir la página.** Con un
`import` estático arriba de todo, un CDN que no contesta —un ascensor, un tren,
una red que filtra— dejaba la página entera muerta y en blanco: ni los ajustes,
ni la clave de la sala, ni un mensaje que dijera por qué. Se descubrió cargando
la página compilada en un navegador de verdad, no leyendo el código. Ahora lo
que falla es el botón de encendido, y lo dice con todas las letras; y el modelo
se pide **antes** que la cámara, así que si el CDN no está, la luz de la cámara
ni siquiera llega a encenderse.

---

## 4. Las luces: cómo se conecta Tuya

### El circuito

```
gestos.html  ──►  /api/tuya  ──►  nube de Tuya  ──►  el dispositivo
(teléfono)        (Vercel)
   │                  │
   │                  └── acá viven TUYA_CLIENT_ID y TUYA_CLIENT_SECRET
   └── acá vive sólo la clave de la sala, en localStorage
```

**El navegador nunca ve una credencial de Tuya.** Manda un alias
(`{"dispositivo":"luz"}`) y la función traduce ese alias a un identificador
real que sólo ella conoce.

### La clave de la sala

`/api/tuya` es una dirección pública, como todo lo que publica Vercel. Sin un
secreto compartido, cualquiera que la descubra le prende la luz a Mauro desde
el otro lado del mundo.

`HARMONIA_CLAVE` es esa frase. Se carga en Vercel y se escribe **una vez** en
la propia página, donde queda en el `localStorage` de ese teléfono. No está en
el repositorio, no está en el código.

No es autenticación seria —quien tenga el teléfono la tiene— y conviene
decirlo así en vez de fingir lo contrario: es la diferencia entre una puerta
cerrada y una puerta que no está. Si algún día esto pasa de prototipo a algo
que la gente usa, el reemplazo es Firebase Auth, como en los otros proyectos.

### Qué protege la función, además de la clave

- **Cerrado por defecto.** Sin `HARMONIA_CLAVE` cargada, no funciona para
  nadie. La falta de configuración nunca abre la puerta.
- **Lista blanca de dispositivos.** Un alias que no está en
  `TUYA_DISPOSITIVOS` se rechaza.
- **Lista blanca de comandos.** Sin una lista `comandos` explícita, el único
  comando permitido es el declarado: tener un alias no habilita mandarle
  cualquier cosa al aparato.
- **Límites de valor** por dispositivo (`min` / `max`).
- **Freno de 700 ms por dispositivo**, del lado del servidor — el del
  navegador se saltea abriendo las herramientas de desarrollo.
- **Comparación de la clave en tiempo constante**, y nada de secretos en las
  respuestas de error. El banco de pruebas lo verifica explícitamente.

---

## 5. Puesta en marcha

### En Tuya

1. `iot.tuya.com` → Cloud → Development → **Create Cloud Project**. Anotar el
   *Access ID* y el *Access Secret*. Elegir el centro de datos que corresponda
   (para Uruguay, normalmente *Western America*, o sea `us`).
2. En el proyecto: **Devices → Link App Account**, y vincular la cuenta de la
   app Smart Life / Tuya Smart donde ya están los dispositivos.
3. **Service API → Go to Authorize**: habilitar *IoT Core* y *Authorization*.
4. En Devices, copiar el **Device ID** de cada aparato que se quiera manejar.

### En Vercel

Project → Settings → Environment Variables. Los nombres están en
`.env.example`. **Los valores los carga Mauro a mano, en la web.** Ningún chat
los pide ni los carga por API — ver `PROTOCOLO-SECRETOS.md`.

```
TUYA_CLIENT_ID        el Access ID
TUYA_CLIENT_SECRET    el Access Secret
TUYA_REGION           us
TUYA_DISPOSITIVOS     {"luz":{"id":"...","comando":"switch_1"}}
HARMONIA_CLAVE        una frase larga, inventada para esto
```

Después hay que **volver a desplegar**: Vercel no aplica variables nuevas a un
despliegue ya hecho.

### En el teléfono

Abrir `https://…/gestos.html` → «Las luces» → escribir la clave → **Guardar
clave** → **Ver qué falta**. Si algo no está cargado, esa respuesta lo dice por
su nombre exacto, sin decir ningún valor.

### Probar sin Vercel

`npm run dev` sirve la página en `http://localhost:5173/gestos.html` y la
cámara anda (los navegadores aceptan `localhost` sin https). **Pero `/api/` no
existe en el servidor de Vite**: las luces sólo funcionan con `vercel dev` o
ya desplegado.

---

## 6. Lo que todavía no está

- **No hay control local.** Todo pasa por la nube de Tuya, así que hay entre
  200 y 600 ms de ida y vuelta. Para prender una luz al final de una frase
  está bien; para que la luz siga el ritmo, no. El camino sería `tuyapi` por
  red local, y necesita la *local key* de cada dispositivo.
- **Un solo gesto de disparo.** El puño. Cruzar una zona de la pantalla y los
  gestos de dos manos combinados quedaron para después.
- **La melodía es monofónica.** Una nota por vez, con ligado. Un acorde con la
  mano derecha necesitaría varias voces, y el pellizco ya no alcanzaría como
  disparador.
- **No hay MIDI.** `Web MIDI API` permitiría manejar un sintetizador de
  verdad en vez del motor interno.
- **Sin registro de lo que se toca.** No graba nada, ni en el teléfono ni
  afuera.

---

## 7. Al tocar este código

- **Los cuatro módulos no se conocen entre sí.** Si una función se necesita en
  dos, sube a `musica.js` o se pasa como parámetro; no se copia.
- **Nada de credenciales del lado del cliente**, nunca, por ninguna razón. La
  página manda un alias; la función traduce.
- **Se corre el banco de pruebas antes de subir**: `npm run prueba`. Cubre la
  teoría musical y la función de Tuya entera con la nube simulada — 24 casos.
  Lo que necesita cámara o Web Audio no se prueba ahí: se prueba con la mano.
- **Que el JavaScript parsee antes de entregar** (`node --check`): un error de
  sintaxis en un módulo ES deja la página en blanco, sin nada que explique por
  qué.
- **Si cambia la paleta de `src/App.jsx`, cambia también la de
  `public/gestos/musica.js`.** Son copias a propósito, y no hay nada que avise.

---

*Primera versión: 2026-09-09.*
