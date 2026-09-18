# easyATC

Seguimiento en vivo de un ejercicio de control aéreo en DCS. Tres controladores
(C1, C2, C3) marcan sus transmisiones de radio y ven el progreso de los demás.

Next.js 15 · Tailwind · Neon Postgres · Drizzle. Sin cuentas: quien tenga el
código de sesión, entra.

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
- **`/s/CODIGO/setup`** — variables globales y de cada vuelo. Se guarda al salir
  de cada campo.
- **`/s/CODIGO/guion`** — textos de las transmisiones. Son plantillas: un
  cambio se aplica a los cuatro vuelos de esa sesión, y solo a esa sesión.
- **`/s/CODIGO`** — vista del controlador. Elige C1, C2 o C3; el rol se
  recuerda en ese navegador y se cambia pulsando el rol en la cabecera.
  Las nueve agencias van una al lado de otra: la de trabajo en el centro y
  las vecinas asomando a los lados. Se cambia con los botones laterales,
  deslizando, con las flechas ← → del teclado o pulsando su ficha arriba.
  - Cada transmisión se marca como correcta (✓) o con error (✕); pulsar el
    botón activo la devuelve a pendiente. Tocar algo de otro controlador pide
    confirmación.
  - Cada agencia se abre, cierra o finaliza desde su propia cabecera.
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
