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

## 2. Cómo averiguar cuál es, de lo más seguro a lo menos

Los tres primeros se hacen **desde el teléfono, en la web de GitHub**, sin
saber ninguna contraseña de Vercel.

### 2.1 · La instalación de la GitHub App *(lo definitivo)*

`github.com/toromboto/harmonia` → **Settings** → **Integrations** → **GitHub
Apps**. Si Vercel está conectado, aparece ahí con un botón **Configure**. Ese
botón lleva a la instalación, y la instalación **nombra la cuenta o el equipo
de Vercel** al que está atada.

Si en esa lista **no aparece Vercel**, el proyecto no está conectado a este
repositorio — con lo cual no hay nada que recuperar y se va derecho al punto 3.

### 2.2 · Las aplicaciones autorizadas de tu cuenta

`github.com/settings/installations` → **Installed GitHub Apps**. Muestra
todas las instalaciones de Vercel de esta cuenta de GitHub, aunque el
repositorio no esté entre las suyas.

### 2.3 · Los despliegues que dejó en el repositorio

En la portada del repositorio, al lado de los commits recientes, o en cualquier
Pull Request, Vercel deja un **check de `vercel[bot]`** con un enlace
*Visit Preview* / *Details*. Ese enlace abre el proyecto en Vercel: si estás
logueado con la cuenta correcta, se abre; si no, dice que no tenés acceso —
y eso ya es información, porque significa que la cuenta es otra.

Si no hay ningún check de `vercel[bot]` en los últimos commits, es muy probable
que la conexión no exista o se haya roto hace tiempo.

### 2.4 · Entrar a Vercel con GitHub

`vercel.com/login` → **Continue with GitHub**, con la cuenta `toromboto`. Si
esa es la cuenta que creó el proyecto, ahí está el proyecto. Es el camino
directo — está cuarto sólo porque, si la respuesta es «no aparece nada», no
distingue entre *no es esta cuenta* y *el proyecto ya no existe*.

### 2.5 · El correo

Buscar **`vercel`** en la casilla. Vercel manda un mail al crear la cuenta, y
otro cada vez que un despliegue falla. El destinatario de esos mails es la
dirección de la cuenta.

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

| Proyecto | Qué despliega |
|---|---|
| `toromboto/harmonia` | el sitio entero (build de Vite) y `api/tuya` para el instrumento de gestos |
| `rematetaller/remate` | **sólo** `api/tuya`, el puente a las luces del depósito. El sitio lo sigue publicando GitHub Pages |

Son dos **repositorios de dueños de GitHub distintos**, así que la cuenta de
Vercel va a tener que estar autorizada en los dos. Conviene que sea **una
sola**: dos cuentas de Vercel es el mismo problema que dos proyectos, un nivel
más arriba.

---

## 5. Anotarlo, que es el punto

Esta pregunta ya se hizo una vez. Para que no se vuelva a hacer, la respuesta
va al índice del ecosistema:

**Repo privado `casaverdecanas-blip/datos` → `secretos/harmonia.md` → sección
«Titularidad de las cuentas».**

Ahí van el **titular** de la cuenta de Vercel y el de la consola de Tuya: con
qué dirección de correo se entra y de quién es. **La contraseña no** — ésa vive
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
