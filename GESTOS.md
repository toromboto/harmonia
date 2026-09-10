# Gestos — el instrumento que se toca con las manos

Una página de Harmonía que usa la cámara frontal para convertir el movimiento
de las manos en notas. Corre entero en el navegador: no le habla a ningún
servidor.

| | |
|---|---|
| La página | `/gestos.html` |
| Código del cliente | `public/gestos/` |
| Banco de pruebas | `pruebas/gestos.mjs` — `npm run prueba` |

---

## 1. Qué es, y qué no

**Es** un instrumento: la mano derecha elige y hace sonar una nota, la
izquierda acompaña con un acorde.

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

### Mano izquierda — el acompañamiento

| Gesto | Qué hace |
|---|---|
| Mano abierta | Suena un acorde del grado donde esté la mano. |
| Puño cerrado | Calla el acorde. El punto se pone naranja para avisar que la mano está cerrada. |

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

## 3. Las cinco piezas, y por qué están separadas

```
public/gestos/
  musica.js       escalas, colores, MIDI → Hz.   No sabe que existe una cámara.
  audio.js        Web Audio.                     No sabe que existe una mano.
  manos.js        cámara + MediaPipe.            No sabe que existe el sonido.
  instrumento.js  el único que los conoce a todos: gesto → nota.
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

## 4. Puesta en marcha

No hay nada que configurar: el instrumento no tiene variables de entorno, ni
función de servidor, ni cuenta de terceros. Alcanza con que la página esté
publicada.

### Dónde puede vivir esta página

**No necesita el build.** `gestos.html` y `public/gestos/*.js` son HTML y módulos
ES servidos tal cual: no importan nada de `src/`, no usan JSX, no dependen de
`npm`. Vite los copia, no los compila. Eso significa que **la página se puede
publicar en cualquier hosting estático con https**, no sólo donde viva Harmonía.

Requisitos reales, que son tres:

1. **https.** `getUserMedia` no existe en http salvo en `localhost`. Cualquier
   GitHub Pages o Vercel lo da solo.
2. **Internet en la primera carga**, para dos CDN: el bundle y el `wasm` de
   MediaPipe (`cdn.jsdelivr.net`) y el modelo de manos
   (`storage.googleapis.com`). Se bajan al **encender la cámara**, no al abrir
   la página — así, si no llegan, falla el encendido y lo dice, en vez de dejar
   la página en blanco.
3. **Un toque.** El navegador no deja sonar audio ni abrir la cámara sin un
   gesto del usuario. Por eso existe el botón «Encender la cámara».

Desde el 2026-09-10 las rutas de `gestos.html` son **relativas** (`./gestos/…`),
así que la página anda igual en la raíz de un dominio y en un GitHub Pages de
proyecto (`usuario.github.io/repo/`). Con rutas absolutas, lo segundo daba 404 y
la página quedaba muda.

> Esto importa por `harmonia:H1`: no se sabe con qué cuenta de Vercel se
> despliega este repositorio, y Mauro es colaborador, no dueño, así que no puede
> averiguarlo. **Para probar el instrumento no hace falta resolver eso**: alcanza
> con publicar estos archivos en un repositorio propio con Pages — que es
> justamente la «incubadora» que decidió el 2026-09-10.

### Probar en la computadora

`npm run dev` sirve la página en `http://localhost:5173/gestos.html` y la
cámara anda: los navegadores aceptan `localhost` sin https. Desde el teléfono
hace falta https, o sea el despliegue de Vercel.

### En el teléfono

Abrir `https://…/gestos.html` → **Encender la cámara**. Hace falta dar permiso
de cámara y un toque para que el navegador deje sonar el audio; los dos son
del navegador, no de la página. Lo que pase con la cámara y el audio se
escribe en «La bitácora».

---

## 5. Lo que todavía no está

- **Ya no enciende luces.** Lo hizo un día. Se retiró el 2026-09-09
  (`harmonia:H3`): el control de luces quedó en **remate**, con Firebase Auth,
  y dos puentes a Tuya en el ecosistema era el mismo trabajo hecho dos veces,
  peor de este lado. Si vuelve, vuelve con autenticación de verdad.
- **Pocos gestos.** El pellizco y la mano abierta. Cruzar una zona de la
  pantalla y los gestos de dos manos combinados quedaron para después.
- **La melodía es monofónica.** Una nota por vez, con ligado. Un acorde con la
  mano derecha necesitaría varias voces, y el pellizco ya no alcanzaría como
  disparador.
- **No hay MIDI.** `Web MIDI API` permitiría manejar un sintetizador de
  verdad en vez del motor interno.
- **Sin registro de lo que se toca.** No graba nada, ni en el teléfono ni
  afuera.

---

## 6. Al tocar este código

- **Los módulos no se conocen entre sí.** Si una función se necesita en dos,
  sube a `musica.js` o se pasa como parámetro; no se copia.
- **Nada de credenciales del lado del cliente**, nunca, por ninguna razón. Hoy
  es fácil: no hay ninguna credencial en el proyecto. Si vuelve a haber una
  función de servidor, la página manda un alias y la función traduce.
- **Se corre el banco de pruebas antes de subir**: `npm run prueba`. Cubre la
  teoría musical del instrumento — 8 casos. Lo que necesita cámara o Web Audio
  no se prueba ahí: se prueba con la mano.
- **Que el JavaScript parsee antes de entregar** (`node --check`): un error de
  sintaxis en un módulo ES deja la página en blanco, sin nada que explique por
  qué.
- **Si cambia la paleta de `src/App.jsx`, cambia también la de
  `public/gestos/musica.js`.** Son copias a propósito, y no hay nada que avise.

---

*Primera versión: 2026-09-09. Sin el puente a Tuya desde el 2026-09-09.*
