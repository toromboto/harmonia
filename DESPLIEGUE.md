# El despliegue y la cuenta de Vercel

Cómo averiguar **qué cuenta de Vercel** está publicando Harmonía, qué hacer si
no se recupera, y cómo dejarlo anotado para no volver a preguntárselo.

---

## 1. Lo que se sabe, y lo que no

Revisado leyendo el repositorio el **2026-09-09**:

| | |
|---|---|
| ¿El repositorio dice qué cuenta de Vercel se usa? | **No.** No hay `vercel.json`, no hay carpeta `.vercel/`, no hay ningún archivo de configuración de Vercel. Lo único que existe es una línea del `README.md` diciendo que el deploy es automático desde GitHub |
| ¿Se puede deducir del repositorio? | **De la cuenta de Vercel, no.** De la de **GitHub, sí**: los 50 commits del historial están firmados por el usuario `toromboto`, y hechos desde la web de GitHub |

**Y no es un descuido del proyecto: Vercel no escribe nada en el repositorio.**
La conexión vive del lado de Vercel y de la instalación de su GitHub App. Por
eso el repositorio no puede contestar esta pregunta ni ahora ni nunca — la
contesta GitHub.

> Que la cuenta de GitHub sea `toromboto` **no dice cuál es la cuenta de
> Vercel**. Dice cuál es la que hay que mirar: la de Vercel se creó
> autorizando alguna cuenta de GitHub, y esa autorización sí está registrada
> en GitHub, del lado que vos controlás.

---

## 2. La respuesta de Mauro, que cambia el problema

**2026-09-09, respondiendo `harmonia:H1` en el panel:**

> «No tengo acceso a ese repositorio, soy colaborador. Debo desarrollar éste
> tipo de apps en paralelo en encubadora dentro de repositorio en la cuenta de
> github de maurogasta@gmail.com.»

Eso cierra la pregunta, aunque no con la respuesta que se buscaba. **Los dos
caminos más seguros dependían de ser dueño del repositorio** —
`Settings → Integrations → GitHub Apps` y
`github.com/settings/installations` — y un colaborador no ve ninguno de los
dos. La cuenta de Vercel de `toromboto/harmonia` no es averiguable desde acá, y
no porque falte mirar en el lugar correcto: no hay lugar donde mirar.

Y explica por qué apareció: los 50 commits son del usuario `toromboto`, que es
el dueño. Mauro trabaja adentro del repositorio de otra persona.

### La decisión: la incubadora

Este tipo de aplicación se desarrolla **en paralelo, en un repositorio propio
de la cuenta `maurogasta@gmail.com`**, y no dentro del repositorio ajeno. No es
un rodeo administrativo:

- **Lo que no se puede ver, no se puede administrar.** Un proyecto cuyo
  despliegue vive en una cuenta a la que no se entra no se puede arreglar
  cuando falla, ni migrar, ni apagar.
- **Los secretos no se pueden ubicar.** El § «Titularidad» de
  `PROTOCOLO-SECRETOS.md` pide anotar de quién es cada consola. Acá la
  respuesta sería «de alguien más», que no es una respuesta operativa: no dice
  a qué dirección se pide una recuperación.
- **Y ya costó algo concreto.** `harmonia:H1` existe por esto, y `harmonia:H2`
  —completar la titularidad— no se puede cerrar mientras siga así.

Lo que sigue de esta sección quedaba escrito para el caso de ser dueño del
repositorio. **Se conserva porque sirve para la incubadora**, donde Mauro sí lo
va a ser, y para `rematetaller/remate`, que también es suyo.

### Los caminos, para un repositorio propio

`Settings → Integrations → GitHub Apps` del repositorio, y
`github.com/settings/installations` de la cuenta: el primero dice si Vercel
está conectado a ese repositorio y **nombra la cuenta o el equipo de Vercel**;
el segundo muestra todas las instalaciones de Vercel de esa cuenta de GitHub,
aunque el repositorio no esté entre las suyas. Los dos se hacen desde el
teléfono, en la web de GitHub, sin saber ninguna contraseña de Vercel.

Si Vercel no aparece en ninguno de los dos, no hay nada que recuperar: se va
derecho al punto 3.

---

## 3. Si no aparece: crear la cuenta y seguir

**No hace falta recuperar la vieja para seguir trabajando.** Un repositorio
puede estar conectado a un proyecto de Vercel nuevo sin tocar el anterior.

1. `vercel.com/signup` → **Continue with GitHub**, con la cuenta que de verdad
   vas a usar. Conviene que sea la misma que ya usás para el repositorio
   (`toromboto`): una cuenta menos que recordar, y la autorización ya existe.
2. **Add New… → Project → Import** `toromboto/harmonia`.
3. Vercel detecta Vite solo. No hay que tocar el *build command* ni el
   *output directory*: `npm run build` y `dist`, que es lo que el proyecto ya
   hace.
4. **Settings → Environment Variables**: cargar los nombres de
   [`.env.example`](.env.example). Los valores los pegás vos, a mano.
5. **Redeploy.** Vercel no aplica variables nuevas a un despliegue ya hecho.

El proyecto queda en `https://<algo>.vercel.app`. Ese nombre lo elegís vos al
importar y se puede cambiar después en **Settings → General → Project Name**.

### Y después, apagar el viejo

Si más adelante aparece el proyecto anterior, **desconectarlo o borrarlo**. Dos
proyectos de Vercel publicando el mismo repositorio no dan error: dan **dos
direcciones que funcionan**, una de ellas vieja, y la que alguien tenga
guardada en el teléfono va a ser la equivocada justo el día que importe.

En el proyecto viejo: **Settings → Git → Disconnect**, o **Settings → Advanced
→ Delete Project**.

---

## 4. Una sola cuenta de Vercel para todo

Desde el 2026-09-09 hay **dos** proyectos del ecosistema que necesitan Vercel:

| Proyecto | Qué despliega | Dueño del repo |
|---|---|---|
| `toromboto/harmonia` | el sitio entero (build de Vite). Ya **no** despliega ninguna función: el puente a Tuya se retiró el 2026-09-09 (`harmonia:H3`) | `toromboto` — Mauro es colaborador |
| `rematetaller/remate` | **sólo** `api/tuya`, el puente a las luces del depósito. El sitio lo sigue publicando GitHub Pages | de Mauro |
| la incubadora (§ 2) | lo que se desarrolle en paralelo, en la cuenta `maurogasta@gmail.com` | de Mauro |

**El único que necesita una función de servidor hoy es `remate`.** Harmonía
volvió a ser un build estático, así que su despliegue puede seguir como está
sin que nadie sepa en qué cuenta vive: no hay variables que cargar ahí.

Y donde sí hay que decidir es en `remate` (`remate:L2`, sin responder). Conviene
que la cuenta de Vercel sea **una sola** para todo lo que venga: dos cuentas de
Vercel es el mismo problema que dos proyectos, un nivel más arriba. Con lo
respondido en `harmonia:H1`, la candidata natural es una atada a
`maurogasta@gmail.com`, que es la cuenta de GitHub donde Mauro es dueño.

---

## 5. Anotarlo, que es el punto

Esta pregunta ya se hizo una vez. Para que no se vuelva a hacer, la respuesta
va al índice del ecosistema:

**Repo privado `casaverdecanas-blip/datos` → `secretos/harmonia.md` → sección
«Titularidad de las cuentas».**

Ahí va el **titular** de la cuenta de Vercel: con qué dirección de correo se
entra y de quién es. (La consola de Tuya salió de la lista el 2026-09-09, con
el puente.) **La contraseña no** — ésa vive
en el gestor de contraseñas y en ningún documento. Y no va en este repositorio,
que es público, aunque no sea un secreto: es un dato de contacto.

Es exactamente lo que dice `PROTOCOLO-SECRETOS.md` § «Titularidad», y el motivo
por el que existe esa sección es éste.

---

## 6. Lo que no hay que hacer

- **No pongas ninguna credencial en el repositorio**, ni en un `.env`, ni
  "temporalmente". El `.gitignore` bloquea `.env` y la carpeta `.vercel/`, pero
  el historial de git es permanente: borrarlo después no alcanza.
- **No le pidas a un chat que cargue las variables por API.** Para hacerlo
  tendría que recibir el valor en texto plano acá dentro, y ese momento ya es
  la exposición. El entregable de un chat es el nombre exacto de la variable y
  dónde pegarla.
- **No agregues `vercel.json` a Harmonía sin necesidad.** La detección
  automática de Vite anda; un archivo de configuración de más es una forma de
  que el día que Vercel cambie algo, el proyecto quede pegado a lo viejo.
  (En `remate` sí hay uno, y ahí sirve para algo concreto: que de Vercel salga
  únicamente `/api`.)

---

*Primera versión: 2026-09-09.*
