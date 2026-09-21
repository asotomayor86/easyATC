import Image from "next/image";
import { Nav } from "@/components/Nav";

/**
 * Hoja de formación para el controlador: qué es cada cosa de la pantalla,
 * cómo se trabaja durante el ejercicio, qué hace cada botón del ratón y, al
 * final, qué se prepara antes en Variables, Guion y Tablero.
 */
export default async function FormacionPage({ params }: { params: Promise<{ code: string }> }) {
  const code = String((await params).code).toUpperCase();
  return (
    <main className="mx-auto max-w-[62rem] px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker text-gold">{code}</p>
          <h1 className="font-cond text-[30px] leading-tight font-extrabold uppercase">Formación</h1>
        </div>
        <Nav code={code} current="formacion" />
      </header>

      <p className="mb-10 rounded-[2px] border border-zinc-800 border-l-4 border-l-gold bg-zinc-900/60 px-4 py-3 text-[15px] text-zinc-300">
        easyATC lleva la cuenta de un ejercicio de control aéreo en DCS. Tres controladores —C1, C2 y C3— se reparten
        nueve agencias y van marcando cada transmisión de radio según ocurre, además de seguir en un tablero por dónde
        va cada vuelo. Todos ven lo mismo y a la vez: no hace falta cantar por el canal de coordinación lo que ya está
        en pantalla. No hay usuarios ni contraseñas: con el código de sesión <span className="text-gold">{code}</span>{" "}
        y elegir tu puesto, dentro.
      </p>

      <p className="mb-10 rounded-[2px] border border-zinc-800 border-l-4 border-l-zinc-500 bg-zinc-900/60 px-4 py-3 text-[15px] text-zinc-300">
        <b className="text-zinc-100">¿Y si solo vienes a mirar?</b> En la pantalla de entrada, además de C1, C2 y C3,
        está el puesto de <b className="text-zinc-100">Observador</b>. Ve el ejercicio entero y se mueve por él igual
        que un controlador —cambiar de agencia, plegar y desplegar, consultar planes de vuelo—, pero no puede marcar
        transmisiones, ni abrir o cerrar agencias, ni tocar el reloj, ni mover vuelos por los tableros. Los botones se
        ven apagados a propósito: así se sabe de un vistazo que ahí no hay nada que tocar.
      </p>

      <Section n="1" title="Qué es cada cosa de la pantalla">
        <Item title="Barra de sesión (arriba del todo)">
          A la izquierda, el código de la sesión y tu puesto —<Key>C1 ▾</Key>—: se pulsa para cambiarlo. Al lado, el
          avance de los otros dos controladores en porcentaje, para saber si van contigo o retrasados. A la derecha
          están los botones de la misión: <Key>▶ INICIO</Key>, los rieles, <Key>RESET</Key>, el menú <Key>⋯</Key> y la
          pantalla completa.
          <Shot
            src="barra"
            w={2560}
            h={220}
            alt="Barra de sesión con el código, el puesto C1, el reloj de misión y las nueve fichas de agencia"
            pie="Autorizaciones abierta (punto verde) con tres vuelos dentro; el cuarto ya cuenta en Rodadura porque está en la salida."
          />
        </Item>
        <Item title="Fichas de las nueve agencias">
          Una ficha por agencia, siempre en el orden del ejercicio. Cada una dice su canal y qué controlador la lleva;
          las tuyas van con fondo dorado. El punto de la izquierda es su estado: hueco cerrada, verde abierta, ✓
          finalizada. Debajo verás un punto de color por cada vuelo que está en esa agencia ahora mismo, así que de un
          vistazo sabes por dónde va el tráfico sin recorrer los tableros. Un vuelo que la agencia anterior ha dejado
          en su salida ya cuenta como tuyo. Pulsar una ficha te lleva a esa agencia.
        </Item>
        <Item title="Rieles">
          Una fila por vuelo y un punto por transmisión, agrupados por agencia: verde correcta, ámbar con aviso, rojo
          error, gris no aplica. Es el resumen de toda la misión de un golpe de vista; pulsando un punto saltas a esa
          transmisión, aunque esté en otra agencia. Se muestran y se ocultan con su botón de la barra, al lado de
          INICIO: ocúltalos cuando necesites alto en pantalla.
          <Shot
            src="rieles"
            w={2560}
            h={190}
            alt="Rieles: una fila por vuelo con un punto por transmisión, en verde, ámbar, rojo y gris"
            pie="Cada punto es una transmisión. A la derecha, el recuento de cada vuelo."
          />
        </Item>
        <Item title="Columna de la agencia">
          Las agencias van una al lado de otra, con la de trabajo en el centro y las vecinas asomando. Te mueves con
          las flechas de los lados, deslizando, con ← → del teclado o pulsando su ficha arriba. Las agencias que no son
          tuyas se ven atenuadas.
        </Item>
        <Item title="Cabecera de la agencia">
          A la izquierda, el canal, el controlador y el nombre. A la derecha, tres grupos de botones:
          <Group label="Estado">
            <Key>○</Key> cerrada · <Key>●</Key> abierta · <Key>✓</Key> finalizada. Lo marca el controlador que la
            lleva, y lo ven todos.
          </Group>
          <Group label="Comms">
            <Key>☰</Key> transmisiones completas · <Key>☑</Key> solo el nombre resumen de cada una (checklist) ·{" "}
            <Key>+</Key> y <Key>−</Key> despliegan o pliegan todos los vuelos a la vez.
          </Group>
          <Group label="Tab">
            <Key>⊟</Key> pliega el tablero entero y <Key>⊞</Key> lo devuelve. Plegado se queda en una línea con los
            vuelos y dónde están, y las comunicaciones ganan toda esa altura.
          </Group>
          <Shot src="cabecera" w={1468} h={104} alt="Cabecera de la agencia con los grupos Estado, Comms y Tab" />
        </Item>
        <Item title="Tablero de la agencia">
          Va fijo bajo la cabecera: no se desplaza, siempre está a la vista. Cada zona es una caja a todo el ancho:
          <ul className="mt-1.5 ml-4 list-disc space-y-1 text-zinc-400">
            <li>
              <b className="text-zinc-200">Entrada</b>: por donde te llegan los vuelos. Si la hereda de la agencia
              anterior lo dice en su título y no puedes colocar nada en ella: solo sacar vuelos de ahí.
            </li>
            <li>
              <b className="text-zinc-200">Stack</b>: una rejilla de puntos (columnas) por niveles o bloques (filas).
              Cada hueco admite los vuelos que hagan falta.
            </li>
            <li>
              <b className="text-zinc-200">Secuencia</b> y <b className="text-zinc-200">Salida</b>: colas numeradas
              1.º, 2.º, 3.º… por el orden en que los vas dejando. La salida es lo que ve la agencia siguiente.
            </li>
          </ul>
          Cada zona se pliega a una sola línea con el botón de su esquina superior derecha, conservando dentro sus
          vuelos (en los stacks, con el nombre de su celda). Es la forma de quitar altura sin perder de vista nada.
          <Shot
            src="tablero"
            w={1468}
            h={902}
            alt="Tablero de Autorizaciones: entrada, dos stacks y una salida, con los vuelos como pastillas"
            pie="Poker espera en la entrada, Dardo y Ebro están en el stack y Marte ya va el 1.º en la salida."
          />
          <Shot
            src="plegado"
            w={1468}
            h={78}
            alt="El mismo tablero plegado en una sola línea con los cuatro vuelos"
            pie="El mismo tablero plegado: 39 px en lugar de 451, sin perder de vista dónde está cada vuelo."
          />
        </Item>
        <Item title="Comunicaciones">
          Debajo del tablero, y es lo único que hace scroll. Van agrupadas por vuelo —y las dirigidas a todas las
          estaciones, en su propio grupo—, con su recuento al lado. Los grupos salen plegados al abrir la página.
          Dentro de cada transmisión ves quién inicia, el texto del piloto, el tuyo y la colación, con las{" "}
          <span className="text-gold">{"{variables}"}</span> ya sustituidas; lo que aparece en gris entre corchetes se
          rellena de viva voz. Una etiqueta <b className="text-alt">Alternativa</b> marca las que solo se usan a veces
          y <b className="text-coord">Coordinación</b> las que son entre controladores.
          <Shot
            src="comunicaciones"
            w={1468}
            h={322}
            alt="Grupo de transmisiones de un vuelo, con los botones de marcar y el texto del piloto y del controlador"
            pie="En rojizo lo que dice el piloto y en claro lo que dices tú. A la derecha, la marca y su hora de misión."
          />
        </Item>
      </Section>

      <Section n="2" title="Cómo se trabaja durante el ejercicio">
        <ol className="ml-4 list-decimal space-y-2 text-[15px] text-zinc-300 marker:text-gold">
          <li>Elige tu puesto (C1, C2 o C3). Se recuerda en ese navegador.</li>
          <li>
            Cuando en DCS se quita la pausa, alguien pulsa <Key>▶ INICIO</Key>. Desde ese momento el botón es el reloj
            de misión y cada marca guarda su hora. Pulsándolo se puede pausar, reanudar o reiniciar; las pausas no
            cuentan.
          </li>
          <li>Abre tus agencias cuando entren en juego y ciérralas o finalízalas al terminar.</li>
          <li>
            Marca cada transmisión según ocurre: correcta, con aviso, con error o no aplica. Vuelve a pulsar el botón
            activo para dejarla otra vez pendiente.
          </li>
          <li>
            Mueve los vuelos por tu tablero conforme los vas controlando y déjalos en la salida al entregarlos: en ese
            momento aparecen en la entrada del siguiente y desaparecen de la tuya.
          </li>
        </ol>
        <p className="mt-3 text-[15px] text-zinc-400">
          Todo se guarda solo y se sincroniza cada 2,5 segundos. Puedes tocar cualquier agencia, también las de otro
          controlador: te pedirá confirmación para que no sea sin querer. <Key>RESET</Key> borra las marcas, el estado
          de las agencias y el reloj de toda la sesión, así que pregunta antes de usarlo.
        </p>
      </Section>

      <Section n="3" title="Qué hace cada botón del ratón">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Clic izquierdo">
            <li>
              <b>En una transmisión</b>: marcar ✓ correcta, ! con aviso, ✕ error o NA no aplica. Pulsar el que ya está
              activo la devuelve a pendiente.
            </li>
            <li>
              <b>En la cabecera de un vuelo</b>: despliega o pliega sus transmisiones.
            </li>
            <li>
              <b>En una pastilla del tablero</b>: la selecciona y abre su plan de vuelo. Con la pastilla seleccionada,
              el siguiente clic en una zona la mueve allí. Otro clic en la pastilla la suelta y cierra la ficha.
            </li>
            <li>
              <b>Arrastrando una pastilla</b>: la lleva directamente a la zona donde la sueltes.
            </li>
          </Card>
          <Card title="Clic derecho sobre una pastilla">
            <li>
              <b>Dividir vuelo…</b>: crea un vuelo nuevo a partir de ese, por ejemplo cuando una pareja se separa.
              Nace sin plan de vuelo, con el color del original en rayado y en la entrada de tu agencia.
            </li>
            <li>
              <b>Combinar con ▸</b>: funde dos vuelos de tu agencia. El que eliges sobrevive y se queda con las marcas
              de los dos; el otro desaparece.
            </li>
            <li>
              <b>Enviar a ▸</b>: manda el vuelo a la entrada de cualquier agencia, sin arrastrarlo. Útil para
              corregir un error o saltarse un paso.
            </li>
            <li>
              <b>Poner en standby</b>: deja en pausa la comunicación con ese vuelo. Su pastilla cambia de fondo y
              lleva la marca <b className="text-warn">STBY</b> mientras dure, y su ficha anota desde cuándo y quién
              lo puso. Se quita desde el mismo menú.
            </li>
          </Card>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Shot
            src="plan"
            w={760}
            h={428}
            alt="Ficha con el plan de vuelo de un vuelo, colgando de su pastilla"
            pie="Clic izquierdo en una pastilla: sale su plan de vuelo, con las variables numeradas en Variables → Plan."
          />
          <Shot
            src="menu"
            w={1086}
            h={768}
            alt="Menú del clic derecho sobre una pastilla, con el submenú de Enviar a abierto"
            pie="Clic derecho: dividir, combinar o enviar el vuelo a la entrada de otra agencia."
          />
        </div>
        <p className="mt-4 text-[15px] text-zinc-400">
          <b className="text-zinc-200">En tableta:</b> tocar es el clic izquierdo y mantener el dedo medio segundo
          sobre una pastilla abre el mismo menú del clic derecho. Las divisiones y las combinaciones no se deshacen con
          RESET: para volver al reparto original está <b className="text-zinc-200">Restaurar vuelos…</b> en el menú{" "}
          <Key>⋯</Key>.
        </p>
      </Section>

      <Section n="4" title="Lo que se prepara antes: Variables, Guion y Tablero">
        <p className="mb-3 text-[15px] text-zinc-400">
          Estas tres páginas se tocan antes del ejercicio, no durante. Cada sesión tiene su propia copia: lo que
          cambies aquí no afecta a ninguna otra.
        </p>
        <Item title="Variables">
          Los datos de la misión que rellenan los textos del guion. Arriba las <b>globales</b> —QNH, pista, canales,{" "}
          <span className="text-gold">{"{inicio_mision}"}</span>…— y debajo la tabla <b>Plan de vuelo</b>, con una
          columna por vuelo. Se escribe en la celda y se guarda al salir del campo. Cada variable se arrastra por su
          asa <Key>⠿</Key> para ordenarla, la casilla <b className="text-gold">Plan</b> marca las que salen en el plan
          de vuelo impreso —el número es su posición, de arriba a abajo— y el botón <Key>×</Key> borra la variable de
          todos los vuelos.
        </Item>
        <Item title="Guion">
          Los textos de cada transmisión: piloto, controlador y colación, con su agencia, controlador y hora. Son
          plantillas: escribe <span className="text-gold">{"{variable}"}</span> y se sustituye sola en cada vuelo.
          Cada comunicación lleva además un nombre resumen —el que se ve en la vista de checklist— y dos casillas que
          se pueden marcar y desmarcar cuando quieras: «alternativa», que la señala como opcional, y «cuenta para
          rieles y estadísticas», que si se desmarca la deja fuera de todos los recuentos sin quitarla de la agencia.
          También se pueden añadir y quitar comunicaciones.
        </Item>
        <Item title="Tablero">
          Las zonas de cada agencia: entradas, stacks, secuencias y salidas. Una salida se enlaza con la entrada de
          otra agencia y eso es lo que hace que los vuelos pasen de un controlador al siguiente. Es{" "}
          <b className="text-zinc-200">solo seguimiento visual</b>: nada de lo que se haga en el tablero cambia el
          texto de una comunicación, que siempre sale del plan publicado. Aquí se eligen también los colores de cada
          vuelo, los mismos que verás en las pastillas y en los puntos de las fichas.
        </Item>
        <Item title="Guardar y cargar versiones">
          En Variables y en Guion, los botones de exportar e importar JSON descargan o cargan la misión completa.
          Ojo: importar sustituye variables, vuelos y guion, y borra las marcas, el estado de las agencias y el reloj.
          El tablero se exporta e importa aparte, desde su propia página.
        </Item>
      </Section>
    </main>
  );
}

/** Captura de pantalla con su pie, al ancho de la tarjeta. */
function Shot({ src, w, h, alt, pie }: { src: string; w: number; h: number; alt: string; pie?: string }) {
  return (
    <figure className="mt-3">
      <Image
        src={`/formacion/${src}.png`}
        width={w}
        height={h}
        alt={alt}
        className="w-full rounded-[2px] border border-zinc-800"
      />
      {pie && <figcaption className="mt-1.5 text-[13px] text-zinc-500">{pie}</figcaption>}
    </figure>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 font-cond text-[22px] leading-none font-bold tracking-wide uppercase">
        <span className="kicker rounded-[2px] border border-gold/60 px-1.5 py-[3px] text-[11px] text-gold">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mb-3 rounded-[2px] border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <h3 className="kicker mb-1.5 text-[11px] text-gold">{title}</h3>
      <div className="text-[15px] leading-relaxed text-zinc-300">{children}</div>
    </article>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="mt-1.5 border-l-2 border-zinc-700 pl-2.5 text-zinc-400">
      <span className="kicker mr-1.5 text-[10px] text-zinc-300">{label}</span>
      {children}
    </p>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2px] border border-zinc-800 border-l-4 border-l-gold bg-zinc-900/40 px-4 py-3">
      <h3 className="kicker mb-2 text-[11px] text-gold">{title}</h3>
      <ul className="ml-4 list-disc space-y-1.5 text-[15px] leading-relaxed text-zinc-300 marker:text-zinc-600">
        {children}
      </ul>
    </div>
  );
}

/** Tecla o botón, tal y como se ve en la aplicación. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-[1px] inline-block rounded-[2px] border border-zinc-600 bg-zinc-900 px-1.5 py-[1px] font-cond text-[13px] leading-[17px] font-semibold text-zinc-100">
      {children}
    </span>
  );
}
