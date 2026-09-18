# Prompt para Claude Code

> Pega esto tal cual en Claude Code, con `guion.json` en la raíz del proyecto.

---

Construye una aplicación web para llevar el seguimiento en vivo de un ejercicio
de control aéreo en DCS. Tres personas hacen de controlador (C1, C2 y C3) y van
marcando las transmisiones de radio conforme las realizan. Es un smoke test
interno para cuatro o cinco compañeros: sin usuarios, sin contraseñas, sin
analítica.

## Stack obligatorio

- Next.js 15, App Router, TypeScript.
- Tailwind CSS. Sin librería de componentes.
- Neon Postgres a través de `@neondatabase/serverless`, con Drizzle ORM para el
  esquema y las migraciones.
- Despliegue en Vercel con una única variable de entorno: `DATABASE_URL`.
- Sin dependencias de tiempo real. La sincronización es por sondeo.

## Modelo de datos

Cuatro tablas. Cada sesión es autónoma: al crearla se copia el guion completo
dentro de ella, de modo que editar un texto en una sesión no afecta a las demás.

**sessions** — `id` uuid, `code` text único de 6 caracteres en mayúsculas,
`name` text, `vars` jsonb (variables globales: pista, QNH, viento, canales…),
`created_at`, `reset_at`.

**flights** — `id` uuid, `session_id`, `callsign` text, `idx` int,
`vars` jsonb (todas las variables propias del vuelo).

**steps** — `id` uuid, `session_id`, `idx` int, `phase` int, `agency` text,
`controller` text (`C1`/`C2`/`C3`), `scope` text (`vuelo` o `todos`),
`initiator` text (`piloto`, `atc` o `coord`), `pilot_text` text nullable,
`atc_text` text, `readback_text` text nullable, `eta` text, `alt` boolean,
`note` text.

**marks** — `id` uuid, `session_id`, `step_id`, `flight_id` uuid nullable
(nulo cuando `scope = 'todos'`), `done_at` timestamptz, `done_by` text.
Índice único sobre (`step_id`, `flight_id`).

## Sustitución de variables

Los textos llevan marcadores entre llaves: `{cs}`, `{parking}`, `{eor}`,
`{squawk}`, `{nivel}`, `{entrada_bs}`, `{ramrod}`, `{push}`, `{ataque}`,
`{radial_espera}`, `{pista}`, `{qnh}`, `{canal_twr}`…

Al renderizar un paso para un vuelo concreto se resuelven primero contra
`flights.vars` y después contra `sessions.vars`. Un marcador sin valor se
muestra tal cual, resaltado en ámbar, para que se vea que falta configurarlo.

Dos marcadores necesitan lógica propia:

- `{precede_sufijo}` → cadena vacía si `vars.precede` está vacío; en otro caso
  `", tras " + vars.precede`.
- `{salida_bs_corto}` → los primeros seis términos de `vars.salida_bs`, para la
  colación abreviada.

Los corchetes como `[pies]` o `[X.X]` son huecos que el controlador rellena de
viva voz. Muéstralos en gris, no los toques.

## Pantallas

### `/` — entrada

Dos acciones: crear sesión nueva (pide un nombre, genera el código, siembra el
guion desde `guion.json` y redirige) o entrar con un código existente.

### `/s/[code]/setup` — configuración

Dos bloques. Arriba las variables globales de la sesión. Abajo una tabla con los
cuatro vuelos y todas sus variables, editable celda a celda. Guardado con
`onBlur`, sin botón. Enlace visible al guion para retocar textos.

### `/s/[code]/guion` — edición de plantillas

Lista de los 44 pasos agrupados por fase. Cada uno con su agencia, controlador,
ámbito y los tres textos editables: llamada del piloto, transmisión del
controlador y colación esperada. Al guardar, el cambio se refleja de inmediato
en los cuatro vuelos, porque el texto es una plantilla única.

### `/s/[code]` — vista del controlador

Si no hay rol guardado en `localStorage`, primero muestra tres botones grandes:
C1, C2 y C3, con el número de transmisiones de cada uno. El rol se guarda y se
puede cambiar desde la cabecera.

Una vez elegido, se muestran **solo los pasos de ese controlador**, en orden de
`idx`, agrupados por agencia con una cabecera que indica el canal. Cada paso con
`scope = 'vuelo'` se despliega en cuatro filas, una por vuelo.

Cada fila muestra:

- La casilla de marcado, grande, cómoda de pulsar en tableta.
- El indicativo del vuelo y la hora indicativa.
- La llamada del piloto en rojo apagado, cuando exista, como contexto.
- La transmisión del controlador en verde y en cuerpo mayor: es lo que hay que
  leer en voz alta.
- La colación esperada en gris pequeño, debajo.
- Cuando está marcada: quién la marcó y a qué hora, y la fila atenuada.

Los pasos marcados como `alt` llevan un distintivo de «alternativa» y su nota,
y no cuentan para el progreso.

Los pasos con `initiator = 'coord'` se muestran en un estilo aparte: son
llamadas al resto de controladores, no al piloto.

Arriba, fijo: el código de la sesión, el rol activo, una barra de progreso con
las transmisiones hechas sobre el total del controlador, y un botón para saltar
a la primera sin marcar.

### Barra lateral o pie: estado de los otros

Progreso de los otros dos controladores, actualizado con el mismo sondeo. Basta
con el porcentaje y la agencia en la que van.

## Comportamiento

**Sondeo.** `GET /api/s/[code]/state` devuelve todas las marcas y un
`updated_at`. El cliente lo consulta cada 2,5 segundos, y solo mientras la
pestaña está visible (`document.visibilityState`). Si el `updated_at` no ha
cambiado, no re-renderiza.

**Marcado.** Cualquiera de los tres puede marcar o desmarcar cualquier
transmisión, también las de otra agencia. El marcado es optimista en el cliente
y se confirma con el siguiente sondeo. Se guarda el rol de quien marcó.

**Reset.** Botón en la cabecera, con confirmación, que borra todas las marcas de
la sesión y actualiza `reset_at`. No toca variables ni textos.

**Sin bloqueo de roles.** Dos personas pueden elegir C1 a la vez; no lo impidas,
solo muéstralo.

## API

```
POST   /api/sessions              crea sesión y siembra el guion
GET    /api/s/[code]              sesión, vuelos y pasos
GET    /api/s/[code]/state        marcas + updated_at   (sondeo)
POST   /api/s/[code]/marks        { stepId, flightId, done, role }
PATCH  /api/s/[code]/steps/[id]   textos de la plantilla
PATCH  /api/s/[code]/flights/[id] variables del vuelo
PATCH  /api/s/[code]              variables de la sesión
POST   /api/s/[code]/reset        borra marcas
```

Todas las respuestas en JSON. Sin autenticación: quien tenga el código, entra.

## Semilla

`guion.json` en la raíz contiene `sesion`, `vuelos`, `pasos` y `agencias`. Los
nombres de campo del JSON están en español y hay que mapearlos al esquema:
`fase`→`phase`, `agencia`→`agency`, `controlador`→`controller`,
`ambito`→`scope`, `inicia`→`initiator`, `texto_piloto`→`pilot_text`,
`texto_atc`→`atc_text`, `colacion`→`readback_text`, `hora`→`eta`,
`alternativa`→`alt`, `nota`→`note`, `orden`→`idx`.

Incluye un script `npm run db:seed` que crea el esquema y una sesión de ejemplo
con código `DEMO01`.

## Diseño

Fondo oscuro, alto contraste, pensado para leerse de un vistazo mientras se
habla por radio. Tipografía grande en la transmisión del controlador: es el
texto que se lee en voz alta y tiene que distinguirse de todo lo demás sin
esfuerzo. Números y horas con cifras tabulares.

Funciona en móvil y tableta a una columna. En escritorio, máximo 70rem de ancho.

Nada de animaciones más allá de una transición de opacidad al marcar.

## Fuera de alcance

Usuarios, roles persistentes, historial, exportación, audio, notificaciones,
modo offline, tests. Es un smoke test.

## Entregables

- Proyecto completo listo para `vercel deploy`.
- `README.md` con los pasos exactos: crear la base en Neon, copiar la cadena de
  conexión, ejecutar las migraciones, desplegar.
- `.env.example` con `DATABASE_URL`.
