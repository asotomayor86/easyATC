# easyATC

Seguimiento en vivo de un ejercicio de control aéreo en DCS. Tres controladores
(C1, C2, C3) marcan sus transmisiones de radio y ven el progreso de los demás.

Next.js 15 · Tailwind · Neon Postgres · Drizzle. Sin cuentas: quien tenga el
código de sesión, entra.

Historia, arquitectura y operación: [docs/SESION-2026-09-18.md](docs/SESION-2026-09-18.md).

## Puesta en marcha

Necesitas Node 20.12 o posterior y una cuenta en [Neon](https://neon.tech) y en
[Vercel](https://vercel.com).

### 1. Crear la base de datos en Neon

1. Entra en <https://console.neon.tech> y pulsa **New Project**.
2. Ponle un nombre (por ejemplo `easyatc`), elige Postgres 16 o 17 y la región
   más cercana (`AWS Europe Central 1 (Frankfurt)`, por ejemplo). Crea el proyecto.

### 2. Copiar la cadena de conexión

1. En el panel del proyecto, pulsa **Connect**.
2. Deja la rama `main`, la base `neondb` y el rol que viene por defecto.
3. Copia la cadena que empieza por `postgresql://…` y termina en
   `?sslmode=require`.
4. En la raíz del proyecto:

   ```bash
   cp .env.example .env.local
   ```

   y pega la cadena en `.env.local`:

   ```
   DATABASE_URL=postgresql://usuario:contraseña@ep-xxxxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

### 3. Instalar y ejecutar las migraciones

```bash
npm install
npm run db:seed
```

`db:seed` aplica las migraciones de `drizzle/` (crea las cuatro tablas) y crea
la sesión de ejemplo **DEMO01** a partir de `guion.json`. Se puede repetir: si
DEMO01 ya existe, la borra y la vuelve a crear desde cero.

Si solo quieres aplicar las migraciones, sin tocar DEMO01:

```bash
npm run db:migrate
```

Para probar en local:

```bash
npm run dev
```

y abre <http://localhost:3000>.

### 4. Desplegar en Vercel

```bash
npm i -g vercel
vercel link                         # crea o enlaza el proyecto
vercel env add DATABASE_URL production   # pega la misma cadena de Neon
vercel deploy --prod
```

Si prefieres la web: importa el repositorio en Vercel, añade la variable
`DATABASE_URL` en **Settings → Environment Variables** y despliega. No hace
falta ninguna otra variable.

Cada build de Vercel ejecuta el script `vercel-build`, que aplica las
migraciones pendientes y crea DEMO01 si no existe (no borra nada). Por eso
también funciona con la integración de Neon de Vercel, cuyas variables no se
pueden descargar en local: el paso 3 es opcional en ese caso.

## Uso

- **`/`** — crea una sesión nueva (copia el guion completo) o entra con un código.
- **`/s/CODIGO/setup`** — variables globales y tabla **Plan de vuelo** (las
  variables de cada vuelo). Se guarda al salir de cada campo. Cada variable se
  arrastra por su asa `⠿` para colocarla donde quieras, con una línea dorada en
  el hueco donde va a caer; el orden se guarda en la sesión. En la tabla, la
  casilla **Plan** marca las variables que salen en el plan de vuelo impreso:
  el número es su posición entre las marcadas, de arriba a abajo. El botón `×`
  de cada fila borra la variable y su valor en todos los vuelos.
- **`/s/CODIGO/guion`** — textos de las transmisiones. Son plantillas: un
  cambio se aplica a los cuatro vuelos de esa sesión, y solo a esa sesión.
  Cada comunicación tiene «+ Añadir debajo» (crea una nueva con la misma
  agencia, controlador y hora, y textos vacíos) y «Quitar».
  Cada una tiene además un nombre resumen para la checklist y la casilla
  «Cuenta para rieles y estadísticas»: si se desmarca, desaparece de los
  rieles y de todos los recuentos (sigue en su agencia y se puede marcar).
- **`/s/CODIGO/tablero`** — zonas de cada agencia para seguir los vuelos
  durante el ejercicio: entradas, stacks (rejilla de puntos × bloques, p. ej.
  Norte/Este × FL080/FL090/FL100, con celdas que se pueden desactivar),
  secuencias (posiciones 1.º, 2.º…) y salidas. Una salida se enlaza con la
  entrada de otra agencia («ROD.sal» → «TWR.ent»). Es **solo seguimiento
  visual**: los textos de las comunicaciones salen siempre del plan publicado
  (guion + variables). Se guarda solo, por agencia, e incluye el color de cada
  vuelo. Se importa y exporta con el formato de `zonas.json`.
  - En la vista del controlador, el tablero aparece bajo la cabecera de cada
    agencia; los vuelos son pastillas que se arrastran (o se tocan y luego se
    toca el destino). Las entradas enlazadas muestran, en el mismo orden, los
    vuelos que la agencia anterior ha puesto en su salida, y no son editables.
  - Cada vuelo está en un único sitio: al sacarlo de una entrada enlazada
    desaparece de la agencia anterior.
  - Botón derecho (o pulsación larga en táctil) sobre una pastilla:
    **dividir** el vuelo (nace sin plan, con el color del original rayado, en
    la entrada de esa agencia), **combinar** con otro vuelo de la agencia (el
    elegido sobrevive y hereda las marcas del absorbido) o **enviar a** la
    entrada de cualquier agencia. El menú ⋯ de la cabecera tiene «Restaurar
    vuelos», que deshace divisiones y combinaciones; el reset no las toca.
- **Exportar / Importar JSON** (en Guion y en Variables) — descarga o carga la
  misión completa (variables, vuelos y guion) en el formato de `guion.json`,
  con los campos `checklist` y `cuenta` en cada paso.
  Importar sustituye todo eso en la sesión y borra sus marcas, el estado de
  las agencias y la hora de inicio; si el archivo no es válido, no se toca nada.
- **`/s/CODIGO`** — vista del controlador. Elige C1, C2 o C3; el rol se
  recuerda en ese navegador y se cambia pulsando el rol en la cabecera.
  Las nueve agencias van una al lado de otra: la de trabajo en el centro y
  las vecinas asomando a los lados. Se cambia con los botones laterales,
  deslizando, con las flechas ← → del teclado o pulsando su ficha arriba.
  - En la cabecera de cada agencia, COMPLETAS / CHECKLIST: con CHECKLIST cada
    fila muestra solo el nombre resumen de la comunicación.
  - Dentro de cada agencia, las transmisiones van agrupadas por vuelo (y las
    dirigidas a todos, en su propio grupo). Los grupos salen siempre plegados
    al abrir la página; se despliegan pulsando su cabecera, y los botones + y −
    de la agencia despliegan o pliegan todos a la vez.
  - Cada transmisión se marca como correcta (✓), con aviso (!), con error (✕)
    o no aplica (NA); pulsar el botón activo la devuelve a pendiente. Tocar algo de otro controlador pide
    confirmación.
  - Cada agencia se abre, cierra o finaliza desde su propia cabecera.
  - **Inicio**: se pulsa justo al quitar la pausa en DCS. A partir de ahí el
    botón muestra el reloj de misión y cada marca guarda su hora de misión.
    La hora de partida es la variable global `inicio_mision` (por ejemplo
    `09:00`); sin ella se muestra el tiempo transcurrido (T+00:12:34).
    Pulsando el reloj en marcha se puede **pausar** (el reloj se congela,
    en ámbar), **reanudar** o **reiniciar**. Las pausas no cuentan en las
    horas de misión. El reset borra también la hora de inicio y las pausas.
  - Los rieles (uno por vuelo) resumen toda la misión; pulsar un punto lleva
    a esa transmisión. Se pliegan desde el menú ⋯.

En los textos, `{variable}` se sustituye por su valor (primero la del vuelo,
luego la global). Si falta, aparece en ámbar. Los `[huecos]` en gris se rellenan
de viva voz.

El estado se sincroniza consultando el servidor cada 2,5 s mientras la pestaña
está visible.

## Cambios en el esquema

Si modificas `src/db/schema.ts`:

```bash
npm run db:generate   # genera una nueva migración en drizzle/
npm run db:migrate    # la aplica en Neon
```
