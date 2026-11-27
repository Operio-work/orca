// What's new: one entry per release, newest first, in English and Spanish.
// Versions and dates come from CHANGELOG.md (see changelog.js). The build stops when the newest version
// in CHANGELOG.md has no entry here, so the What's new page and the home section can't fall behind.
// Pictures: static/shots/<id>-<lang>.webp, 1820x1120, light theme, from `operio-orca demo` (fictional data).

/** @typedef {{ en: string, es: string }} T */
/** @typedef {{ id: string, caption: T, alt: T }} Shot */
/** @typedef {{ title: T, body: T }} Item */
/** @typedef {{ version: string, title: T, items: Item[], shots?: Shot[], video?: string, also?: T }} Release */

/** @type {Release[]} */
export const RELEASES = [
  {
    version: '0.11.3',
    title: { en: 'A bigger Map on your phone', es: 'Un Mapa más grande en tu celular' },
    items: [
      {
        title: { en: 'A larger Map on phones', es: 'Un Mapa más grande en el celular' },
        body: {
          en: 'Agents show as two big cards per row with readable names and status. Anyone who needs you comes first in each team, and nothing scrolls sideways.',
          es: 'Los agentes aparecen como dos tarjetas grandes por fila, con nombre y estado legibles. Quien te necesita va primero en cada equipo, y nada se desplaza de lado.',
        },
      },
      {
        title: { en: 'Admin keeps your edits safe', es: 'Admin cuida tus cambios' },
        body: {
          en: 'Leaving a section with unsaved changes asks before discarding them. Saved agents, Accounts, Tools, Skills and Knowledge scroll down to the last item, on laptops and phones.',
          es: 'Salir de una sección con cambios sin guardar pregunta antes de descartarlos. Agentes guardados, Cuentas, Herramientas, Habilidades y Conocimiento se desplazan hasta el último elemento, en laptop y celular.',
        },
      },
    ],
    shots: [
      { id: 'wn-map-phone', caption: { en: 'The Map on a phone', es: 'El Mapa en el celular' }, alt: { en: 'ORCA on a phone in the light theme: two big agent cards per row, the ones that need you in red at the top of each team.', es: 'ORCA en un celular en tema claro: dos tarjetas grandes de agentes por fila, las que te necesitan en rojo arriba de cada equipo.' } },
    ],
  },
  {
    version: '0.11.2',
    title: { en: 'Calmer notices, a clearer Admin', es: 'Avisos más discretos, un Admin más claro' },
    items: [
      {
        title: { en: 'Notices that stay out of the way', es: 'Avisos que no estorban' },
        body: {
          en: 'Short messages stack in a corner instead of covering your agents: at most three, each with a timer and a close button. The same message no longer piles up, and “offline” clears itself when ORCA is back.',
          es: 'Los mensajes cortos se apilan en una esquina en vez de tapar a tus agentes: tres como máximo, cada uno con su tiempo y un botón para cerrar. El mismo mensaje ya no se repite, y «sin conexión» se quita solo cuando ORCA vuelve.',
        },
      },
      {
        title: { en: 'A clearer Admin', es: 'Un Admin más claro' },
        body: {
          en: 'Every Admin area now shares the same navigation, buttons, fields and switches. On a phone the navigation stays compact and nothing gets cut off.',
          es: 'Todas las áreas de Admin comparten ahora la misma navegación, botones, campos e interruptores. En el celular la navegación queda compacta y nada se corta.',
        },
      },
    ],
    shots: [
      { id: 'wn-toasts', caption: { en: 'Notices stack in a corner', es: 'Los avisos se apilan en una esquina' }, alt: { en: 'The ORCA board with three short notices stacked in the bottom corner, each with a close button.', es: 'El tablero de ORCA con tres avisos cortos apilados en la esquina inferior, cada uno con un botón para cerrar.' } },
      { id: 'wn-admin', caption: { en: 'Admin, one clear workspace', es: 'Admin, un solo espacio claro' }, alt: { en: 'ORCA Admin overview in the light theme: a sidebar with Team, What agents use and Settings, and a card for each area.', es: 'El resumen de Admin de ORCA en tema claro: una barra lateral con Equipo, Lo que usan los agentes y Ajustes, y una tarjeta por área.' } },
    ],
  },
  {
    version: '0.11.1',
    title: { en: 'A tidier top bar', es: 'Una barra superior más ordenada' },
    items: [
      {
        title: { en: 'The five agents that matter most', es: 'Los cinco agentes que más importan' },
        body: {
          en: 'The bar under the header shows the five agents that matter most on one line: anyone who needs you first, then the latest activity. “+N” opens the Map with the rest.',
          es: 'La barra bajo el encabezado muestra en una línea los cinco agentes que más importan: primero quien te necesita, luego la actividad más reciente. «+N» abre el Mapa con el resto.',
        },
      },
      {
        title: { en: 'Shortcuts live in Admin', es: 'Los atajos viven en Admin' },
        body: {
          en: 'The row of keys under the header is gone. The keys still work everywhere, and ? opens the list in Admin → Shortcuts.',
          es: 'La fila de teclas bajo el encabezado ya no está. Las teclas siguen funcionando en todas partes, y ? abre la lista en Admin → Atajos.',
        },
      },
    ],
    shots: [
      { id: 'wn-topbar', caption: { en: 'Who needs you, on one line', es: 'Quién te necesita, en una línea' }, alt: { en: 'The ORCA board: agents that need you shown in red in the bar under the header, and their tiles below.', es: 'El tablero de ORCA: los agentes que te necesitan aparecen en rojo en la barra bajo el encabezado, con sus recuadros abajo.' } },
      { id: 'wn-shortcuts', caption: { en: 'Admin → Shortcuts', es: 'Admin → Atajos' }, alt: { en: 'The Shortcuts page in ORCA Admin: one key per move, such as N for new, B for needs you and M for the map.', es: 'La página de Atajos en Admin de ORCA: una tecla por acción, como N para nuevo, B para te necesita y M para el mapa.' } },
    ],
  },
  {
    version: '0.11.0',
    title: { en: 'One sign-in with ORCA Artifacts', es: 'Un solo inicio de sesión con ORCA Artifacts' },
    items: [
      {
        title: { en: 'Open Artifacts already signed in', es: 'Abre Artifacts con la sesión iniciada' },
        body: {
          en: 'When ORCA Artifacts signs people in through ORCA, the Artifacts button in the panel opens it already signed in. ORCA notices this on its own; there is nothing else to set up.',
          es: 'Cuando ORCA Artifacts inicia sesión a través de ORCA, el botón Artifacts del panel la abre con la sesión ya iniciada. ORCA lo detecta solo; no hay nada más que configurar.',
        },
      },
      {
        title: { en: 'A safer setup', es: 'Una configuración más segura' },
        body: {
          en: 'operio-orca artifact setup keeps the app’s full address and saves nothing when the app refuses the token, so a typo never replaces a working setup.',
          es: 'operio-orca artifact setup conserva la dirección completa de la app y no guarda nada si la app rechaza el token, así un error de dedo nunca reemplaza una configuración que funciona.',
        },
      },
    ],
    also: {
      en: 'Also new in ORCA Artifacts 0.3: alerts on your phone when a draft waits or a number crosses your line, and on Android, share a link or photo straight into the app.',
      es: 'También nuevo en ORCA Artifacts 0.3: alertas en tu celular cuando un borrador espera o una cifra cruza tu límite, y en Android, comparte un enlace o una foto directo a la app.',
    },
    shots: [
      { id: 'wn-artifacts-alerts', caption: { en: 'Tap the bell for phone alerts', es: 'Toca la campana para recibir alertas' }, alt: { en: 'ORCA Artifacts in the light theme with two drafts to approve and the alerts bell marked in orange.', es: 'ORCA Artifacts en tema claro con dos borradores por aprobar y la campana de alertas marcada en naranja.' } },
      { id: 'wn-artifacts-share', caption: { en: 'Shared from another app, saved as a draft', es: 'Compartido desde otra app, guardado como borrador' }, alt: { en: 'The ORCA Artifacts share screen: a supplier’s seasonal menu link, ready to save as a draft.', es: 'La pantalla para compartir de ORCA Artifacts: un enlace al menú de temporada de un proveedor, listo para guardarse como borrador.' } },
    ],
  },
  {
    version: '0.10.0',
    title: { en: 'ORCA Artifacts', es: 'ORCA Artifacts' },
    items: [
      {
        title: { en: 'Your agents publish to ORCA Artifacts', es: 'Tus agentes publican en ORCA Artifacts' },
        body: {
          en: 'Reports, trackers and dashboards go to ORCA Artifacts, the free app for your team’s pages and dashboards. Everything arrives as a draft: you approve it before anyone sees it. Numbers on approved dashboards refresh on their own.',
          es: 'Reportes, registros y tableros van a ORCA Artifacts, la app gratuita para las páginas y tableros de tu equipo. Todo llega como borrador: tú lo apruebas antes de que alguien lo vea. Las cifras de los tableros aprobados se actualizan solas.',
        },
      },
      {
        title: { en: 'A skill that teaches agents how', es: 'Una habilidad que enseña a los agentes' },
        body: {
          en: 'The Publish to ORCA Artifacts skill shows agents how to send a page or a dashboard, and an Artifacts button in the panel opens the app once it is set up.',
          es: 'La habilidad Publicar en ORCA Artifacts enseña a los agentes a enviar una página o un tablero, y un botón Artifacts en el panel abre la app una vez configurada.',
        },
      },
    ],
    video: 'operio-orca-artifacts',
    shots: [
      { id: 'artifacts-drafts', caption: { en: 'Drafts waiting for you', es: 'Borradores que esperan tu aprobación' }, alt: { en: 'The ORCA Artifacts app with To approve open: a weekly owner summary and a dental recall list sent by agents, each marked Draft with Approve and Reject buttons.', es: 'La app ORCA Artifacts con Por aprobar abierto: un resumen semanal para el dueño y una lista de pacientes por llamar enviados por agentes, cada uno marcado Borrador con botones Aprobar y Rechazar.' } },
      { id: 'artifacts-dashboard', caption: { en: 'A dashboard your agents keep up to date', es: 'Un tablero que tus agentes mantienen al día' }, alt: { en: 'An ORCA Artifacts dashboard of reviews and replies: 140 reviews, 4.11 average stars, 22 drafts to approve and 787 minutes saved.', es: 'Un tablero de ORCA Artifacts de reseñas y respuestas: 140 reseñas, 4.11 estrellas promedio, 22 borradores por aprobar y 787 minutos ahorrados.' } },
    ],
  },
  {
    version: '0.9.0',
    title: { en: 'Industry packs', es: 'Paquetes por industria' },
    items: [
      {
        title: { en: 'A ready team for one kind of business', es: 'Un equipo listo para un tipo de negocio' },
        body: {
          en: 'An industry pack brings ready agents, document templates with examples, and routines. One tap adds it all; the routines arrive switched off, so nothing runs until you turn it on.',
          es: 'Un paquete por industria trae agentes listos, plantillas de documentos con ejemplos y rutinas. Un toque agrega todo; las rutinas llegan apagadas, así que nada corre hasta que tú lo enciendas.',
        },
      },
      {
        title: { en: 'Saved agents scroll as one', es: 'Agentes guardados se desplaza completo' },
        body: {
          en: 'The list is no longer squeezed above the starters, and on phones each Add button sits under its text.',
          es: 'La lista ya no queda apretada arriba de los agentes listos, y en el celular cada botón Agregar queda bajo su texto.',
        },
      },
    ],
  },
  {
    version: '0.8.0',
    title: { en: 'Starter agents', es: 'Agentes listos' },
    items: [
      {
        title: { en: 'Five agents for office work', es: 'Cinco agentes para la oficina' },
        body: {
          en: 'Communicator, Writer, Researcher, Reporter and Chaser. One tap adds the agent with the skills it needs, and you can change everything after. They only draft: nothing is sent.',
          es: 'Comunicador, Redactor, Investigador, Reportero y Seguimiento. Un toque agrega el agente con las habilidades que necesita, y después puedes cambiarlo todo. Solo hacen borradores: nada se envía.',
        },
      },
      {
        title: { en: 'Two new skills', es: 'Dos habilidades nuevas' },
        body: {
          en: 'Template fill completes your own templates and marks what is missing instead of making it up. Follow-up tracker keeps one list of what you are waiting for and drafts the nudges.',
          es: 'Llenar plantillas completa tus propias plantillas y marca lo que falta en vez de inventarlo. Seguimiento de pendientes lleva una lista de lo que esperas y redacta los recordatorios.',
        },
      },
    ],
    shots: [
      { id: 'wn-starters', caption: { en: 'Starter agents, one tap each', es: 'Agentes listos, con un toque' }, alt: { en: 'The Saved agents window in the light theme with Communicator, Writer, Researcher and Reporter, each with an Add button.', es: 'La ventana Agentes guardados en tema claro con Comunicador, Redactor, Investigador y Reportero, cada uno con un botón Agregar.' } },
    ],
  },
  {
    version: '0.7.1',
    title: { en: 'A cleaner sleep', es: 'Dormir más limpio' },
    items: [
      {
        title: { en: 'No stray “Stopped” line', es: 'Sin línea «Detenido» de más' },
        body: {
          en: 'Putting an agent to sleep while it runs a command no longer adds a “Stopped” line to that command’s output.',
          es: 'Poner a dormir a un agente mientras corre un comando ya no agrega una línea «Detenido» a la salida de ese comando.',
        },
      },
    ],
  },
  {
    version: '0.7.0',
    title: { en: 'Put an agent to sleep', es: 'Pon a dormir a un agente' },
    items: [
      {
        title: { en: 'Sleep for 15 minutes or an hour', es: 'Duerme 15 minutos o una hora' },
        body: {
          en: 'A sleeping agent is paused: no CPU, no tokens, and its window stays as it was. Sleeping agents get their own zone on the Map, the Office and the Island, with a countdown when a wake time is set.',
          es: 'Un agente dormido queda en pausa: sin CPU, sin tokens, y su ventana se queda como estaba. Los agentes dormidos tienen su propia zona en el Mapa, la Oficina y la Isla, con una cuenta regresiva si hay hora para despertar.',
        },
      },
      {
        title: { en: 'Wake and Finish', es: 'Despertar y Terminar' },
        body: {
          en: 'Wake picks up where the agent stopped. Finish ends the job, with a second tap to confirm. Wake times survive a restart.',
          es: 'Despertar sigue donde el agente se quedó. Terminar cierra el trabajo, con un segundo toque para confirmar. Las horas para despertar sobreviven a un reinicio.',
        },
      },
    ],
  },
  {
    version: '0.6.2',
    title: { en: 'The Reader for more agents', es: 'La Lectura para más agentes' },
    items: [
      {
        title: { en: 'OpenCode and local models', es: 'OpenCode y modelos locales' },
        body: {
          en: 'OpenCode and Ollama agents can use the transcript Reader too: exact replies, open questions, permission choices and token totals.',
          es: 'Los agentes de OpenCode y Ollama también pueden usar la Lectura de la conversación: respuestas exactas, preguntas abiertas, permisos y total de tokens.',
        },
      },
    ],
  },
  {
    version: '0.6.1',
    title: { en: 'An agent opens full screen', es: 'Un agente se abre en pantalla completa' },
    items: [
      {
        title: { en: 'All the room for the work', es: 'Todo el espacio para el trabajo' },
        body: {
          en: 'On a computer an agent’s window fills the screen, so the output, the recap and the reply box get all the room. Phones are unchanged.',
          es: 'En la computadora la ventana de un agente llena la pantalla, así la salida, el resumen y la caja de respuesta tienen todo el espacio. En el celular no cambia.',
        },
      },
    ],
    shots: [
      { id: 'wn-agent', caption: { en: 'An agent asks, you answer with one tap', es: 'Un agente pregunta, respondes con un toque' }, alt: { en: 'An ORCA agent open full screen in the light theme, asking how to answer a party of eight, with three answers to pick from.', es: 'Un agente de ORCA abierto en pantalla completa en tema claro, preguntando cómo responder a un grupo de ocho, con tres respuestas para elegir.' } },
    ],
  },
  {
    version: '0.6.0',
    title: { en: 'Admin is one page', es: 'Admin es una sola página' },
    items: [
      {
        title: { en: 'Every area in one sidebar', es: 'Todas las áreas en una barra lateral' },
        body: {
          en: 'Overview, Team, What agents use and Settings, each opening in place: no more windows on top of windows. On a phone the sidebar is the first screen and Back returns to it.',
          es: 'Resumen, Equipo, Lo que usan los agentes y Ajustes, cada una se abre en su lugar: ya no hay ventanas sobre ventanas. En el celular la barra lateral es la primera pantalla y Atrás regresa a ella.',
        },
      },
    ],
  },
];

/** The release notes for a version, or undefined. @param {string} v */
export const releaseFor = (v) => RELEASES.find((r) => r.version === v);

/** '0.11.2' → '0.11' @param {string} v */
export const minorOf = (v) => v.split('.').slice(0, 2).join('.');

/** Anchor id for a version: '0.11.2' → 'v0-11-2' @param {string} v */
export const anchorOf = (v) => 'v' + v.replace(/\./g, '-');
