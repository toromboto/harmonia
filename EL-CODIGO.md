# El Código — el sistema de colores, con la física revisada

Desarrollo **paralelo**, entrado el 15-sep-2026. Vive en `public/codigo.html` y
`public/codigo/`, y **no toca `src/App.jsx`**: la app compilada sigue exactamente
como estaba.

| | |
|---|---|
| Páginas | [`/codigo.html`](public/codigo.html) — la teoría · [`/practica.html`](public/practica.html) — los ejercicios |
| Piezas | `public/codigo/color.js` · `teoria.js` · `practica.js` |
| Banco de pruebas | `pruebas/codigo.mjs` — 60 casos, sin dependencias ni navegador |
| Origen | *Manual de teoría musical a través del color*, de toromboto (v14) |

## Por qué está aparte

Porque **corrige** al manual en dos puntos, y esa es una decisión de su autor,
no de quien programa. Mientras no esté tomada, las dos versiones conviven: la
pestaña «El Código» de la app compilada dice lo que dice el manual, y esta
página dice lo que dan los números.

Estar en `public/` no es comodidad. Es la garantía: no comparte una línea con
`src/App.jsx`, así que no puede romper nada de lo que ya funciona. Y se edita
desde el teléfono, como el resto de `public/`.

## La regla de la casa: nada se afirma, todo se calcula

Es lo que separa a esta mitad de un documento. En la página **no hay ninguna
tabla escrita a mano**: la serie de armónicos, los cents de cada desviación, las
longitudes de onda al subir cuarenta octavas, la correlación con la dureza de
las piedras, la distancia entre colores y el puesto de cada par — todo se
calcula al abrir. Si un número estuviera mal, estaría mal la fórmula, y se vería.

El motivo es el encargo: esto es material de estudio para alguien que **no sabe
música**. El peor resultado posible no es que quede feo; es que enseñe algo
falso sin que nadie lo note.

Por eso el banco de pruebas compara contra **valores publicados** y no contra lo
que devuelve el propio código: los 386,3 cents de la tercera natural, los 968,8
de la séptima, el 21,8% de luz del byte 128 de sRGB. Una prueba que sólo
comprueba que el código hace lo que el código hace no defiende de nada.

## Lo que se corrigió

### 1 · Mezclar color es mezclar luz

La app compilada mezcla los colores de un acorde promediando los bytes de cada
hex. Son dos errores distintos, encadenados:

- **Promediar no es sumar.** El capítulo 10 describe el modelo «luz» como sumar
  haces de proyector, y dice que al agregar notas el resultado se acerca al
  blanco. Sumar hace eso; promediar no: mantiene la luminancia media. Medido
  sobre Do-Mi-Sol-Si-Re-Fa♯-La, de dos a siete notas el promedio se queda entre
  4,3% y 5,5% de luz. No se acerca a nada.
- **Los bytes de un hex no son intensidad de luz.** sRGB los guarda con una
  curva (IEC 61966-2-1): el byte 128 no es media luz, es el 21,8%. Promediar los
  bytes da un resultado sistemáticamente más oscuro que la mezcla real.

La diferencia no es cosmética: **en Do mayor la mezcla correcta tiene un 79% más
de luminancia.** La forma correcta es de manual y no la inventa este proyecto —
pasar cada canal a luz lineal, promediar ahí, y volver a sRGB.

`color.js` conserva **las tres** operaciones a propósito: `mezclarEnPantalla`
(la de hoy), `mezclarEnLuz` (la correcta) y `sumarLuz` (los haces de verdad, que
sí tienden al blanco). La página las muestra una al lado de la otra. Sin las
tres, la corrección sería una afirmación más.

> Y conviene decirlo: promediar **no está mal como criterio**. Mantener el color
> cerca de la tónica es justo lo que el capítulo 10 busca, y lo logra. Lo que
> está mal es *describir* un promedio como si fuera una suma de luz.

### 2 · Los ángulos son de lugar, no de color

El cierre del capítulo 5 dice que Fa y Si —el tritono— son «el par de colores de
máximo contraste posible en toda la rueda». El capítulo 8 apoya en eso todo su
vocabulario: complementario, split-complementario, tríada.

Medido sobre la paleta de estudio, no se sostiene:

| | |
|---|---|
| Fa · Si, separación real de matiz | **115°** — puesto 22 entre los 66 pares posibles |
| El tritono que más contrasta | Do · Fa♯, 177° |
| Empatado con él, a 0,05° | **Do · Sol — una quinta justa**, el intervalo más consonante que hay |
| Separación media de matiz, 4 / 5 / 6 semitonos | 104° / 106° / 106° — el tritono no se distingue de nada |

La causa es limpia y **no obliga a tocar la paleta**. El capítulo 8 razona sobre
una rueda donde cada semitono avanza 30° de matiz. Esa rueda existe: es la
*paleta real* del capítulo 5bis. La paleta de estudio rompe el matiz a propósito
—es su mayor acierto, y el libro lo defiende bien—, y al romperlo pierde el
derecho a usar el vocabulario de la teoría del color en sentido literal.

Lo que hay que decir es **sobre cuál de las dos ruedas habla el capítulo 8**. Las
figuras de acorde y la transposición por giro quedan intactas: que el triángulo
de Do mayor, rotado, sea Fa mayor es cierto en las dos ruedas, y es lo mejor que
tiene el capítulo.

### 3 · La mezcla orienta, no determina

El capítulo 5 dice que los siete colores restantes salen «por mezcla directa» de
los cinco de origen. Comparando el promedio literal de cada par con el color
asignado, **sólo uno de los siete coincide** (Sol + La → Sol♯, distancia 5 sobre
441). Do + Re → Do♯ está a 85, y Mi + Sol → Fa♯ a 174: ahí ya es otro color.

El patrón es consistente y tiene sentido — la mezcla da la dirección y después
el color se sube de saturación para que se reconozca rápido —, que es exactamente
el temperamento que el capítulo 7 defiende para todo lo demás. La corrección es
de una frase y **refuerza** el argumento: evita que alguien pruebe el promedio,
vea que no da, y desconfíe del resto.

## Lo que se ratificó, y sale más fuerte

El capítulo 7 es lo mejor del manual y aguanta la comprobación entera.

- **Subir cuarenta octavas no funciona, y falla más de lo que el libro dice.** No
  es que «algo queda afuera»: **seis de las doce notas caen en infrarrojo**. El
  Do se va a 1042 nm, invisible. Y el La cae en 620 nm, que es naranja — no rojo,
  que es el color que el sistema le da. Si hubiera correspondencia física,
  contradiría al propio manual.
- **La dureza de las piedras no correlaciona con la frecuencia:** r = −0,13,
  r² = 0,017. Menos del 2% de la variación explicada. «Prácticamente cero» es
  exacto.
- **El espectro visible mide menos de una octava:** 0,98 con los límites anchos
  (380–750 nm), 0,81 con los estrictos (400–700). Cierto, y más fuerte con los
  estrictos.
- **El orden de la serie de armónicos que usa el capítulo 10 es correcto:**
  fundamental → quinta (armónico 3) → tercera (5) → séptima (7) → novena (9).
  Y las desviaciones contra el piano dan los valores publicados: +1,96 cents la
  quinta, −13,69 la tercera, −31,17 la séptima.
- **El anclaje del La en 440 Hz** y la norma citada (ISO 16) son correctos.

Que los tres intentos de correspondencia física den que no **es el buen
resultado**, y es el mejor argumento del libro entero: si alguno hubiera dado una
correlación fuerte, habría que sospechar que se forzó algo.

## Lo que se arregló de paso

- **La tabla de piedras de la Parte IV tenía once filas para doce notas** — Fa y
  Fa♯ compartían una, con dos piedras sin decir cuál es cuál. En `teoria.js`
  están separadas, que es lo que el resto del libro pide.
- **La tabla de la paleta del `README.md` publicaba siete hexes que no eran los
  del código**, ninguno de los siete. Se corrigió contra `src/App.jsx`.

## Lo que queda abierto

Son decisiones de toromboto, no de quien programa:

1. **Qué pasa con la frase del tritono** en el capítulo 5 y en el 8 (hoy también
   en `src/App.jsx`, líneas 2435 y 2490).
2. **Si el capítulo 8 se acota explícitamente a la paleta real**, o si se
   reescribe en términos de posición.
3. **Si la corrección de la mezcla en luz entra a la app compilada**, o si
   convive como está hoy.
4. **Scriabin, en el capítulo 3.** El manual dice que siguió el orden del
   espectro. Las fuentes dicen que estiró el rojo y el azul sobre varias
   tonalidades y agregó colores no espectrales —«azul acerado», «gris plomizo»—:
   chocó contra el mismo problema de doce contra siete y lo resolvió con la misma
   impureza deliberada que el marrón de este sistema. Contado así, deja de ser el
   contraejemplo del capítulo y pasa a ser su precedente.

## La práctica

`public/practica.html` son los tres ejercicios que el manual propone en su
primera página, corriendo de verdad:

| | Del libro |
|---|---|
| **La tira, a ciegas** — se muestra un color, se nombra la nota | ejercicio 1, capítulo 0 |
| **La rueda, salteada** — igual, pero sin orden cromático | ejercicio 2, capítulo 0 |
| **Tarjetas invertidas** — se muestra el nombre, se elige el color | ejercicio 3, capítulo 0 |
| **La quinta, sin contar** — se muestra una nota, se señala su quinta | nivel 2, capítulo 9 |

Esta parte **no depende de las correcciones**: el libro la especifica y no está
en discusión. Por eso entró en la misma tanda sin esperar a nadie.

Tres decisiones que no son de trámite:

- **Lo que se falla vuelve más seguido.** Cada nota lleva un peso: fallarla lo
  triplica, acertarla lo baja, con techo y con piso. Sin eso, un ejercicio de
  doce notas le dedica el mismo tiempo a la que ya sabés de memoria que a la que
  nunca te sale — que es exactamente al revés de lo que hace falta.
- **Suena la nota correcta, también cuando se erró.** Es el momento en que el
  color, el nombre y el sonido están los tres juntos en la cabeza. El motor es
  el mismo del instrumento de gestos, sin copiarlo.
- **La lógica no vive en el `.html`.** `practica.js` decide todo sin tocar una
  línea de pantalla, y por eso se puede probar lo que a ojo no se ve: que
  salgan las doce notas y no un puñado, que la correcta no caiga siempre en el
  mismo botón, que no se repita la misma nota dos veces seguidas, que responder
  dos veces no cuente dos veces. Un ejercicio de memoria roto no avisa.

## La paleta no se copia acá

`public/codigo/` **no** hace una tercera copia de `NC`: la importa de
`public/gestos/musica.js`, que es la única del lado de `public/`. La fuente sigue
siendo `src/App.jsx`. Al tocar la paleta son dos archivos, no tres.
