// UI copy for make.operio.work, EN + ES (Mexican Spanish, tú).
// Routine copy is NOT here: it comes from catalog/catalog.json only.

const en = {
  htmlLang: 'en',
  ogLocale: 'en_US',
  skip: 'Skip to content',
  nav: { catalog: 'Catalog', install: 'Install', github: 'Free-ORCA on GitHub', home: 'Free-ORCA home' },
  langSwitch: { label: 'Español', short: 'ES', aria: 'Ver esta página en español' },
  theme: { toDark: 'Switch to dark theme', toLight: 'Switch to light theme' },
  byOperio: 'by Operio',

  copy: { copy: 'Copy', copied: 'Copied', label: 'Copy the command', done: 'Command copied' },

  home: {
    title: 'Free-ORCA by Operio: office routines that run on your computer',
    description:
      'Free-ORCA is a free, open-source control panel that runs office routines on your own computer: a morning brief, review replies, a weekly report. Every draft waits for your OK.',
    promise: 'Office routines that run on your computer and wait for your OK.',
    lead:
      'Turn on a routine and it writes your morning brief, your review replies or your weekly report on schedule, using the AI assistant you already have. You read it, approve it and send it yourself. Free and open source.',
    installLabel: 'Install on Linux or macOS',
    installNote: 'Node.js 20 or newer. No account, no sudo.',
    installMore: 'Install guide',
    secondary: 'Have Operio run it for you',

    demoTitle: 'One evening at a restaurant',
    demoBody:
      'This is the built-in demo with Harbor Street Bistro, a fictional restaurant. The reservations routine drafted four confirmations and stopped to ask how to seat a party of eight. One tap answers it.',
    demoAltDesktop:
      'Free-ORCA on a laptop: the reservations routine lists four drafted confirmations and asks how to answer a party of eight, with three options to tap.',
    demoAltPhone:
      'Free-ORCA on a phone: the Harbor Street Bistro map, with two routines waiting for an answer, one working and one idle.',
    demoTry: 'Try it yourself with',

    howTitle: 'How it works',
    steps: [
      {
        title: 'Install it',
        body: 'One line in the terminal. It starts with your computer and opens in your browser at 127.0.0.1:7171.'
      },
      {
        title: 'Turn on a routine',
        body: 'Pick when it runs and drop your exports in one folder: WhatsApp chats, the bookings list, new reviews.'
      },
      {
        title: 'Approve and send',
        body: 'The draft waits in the Routines tab. Read it, change what you like, approve it and send it yourself.'
      }
    ],

    freeTitle: 'Five routines, free',
    freeBody:
      'They read the files you give them and write a report or a draft. They never message your customers or post anything.',
    freeOutput: { report: 'Report', draft: 'Draft you send' },

    managedTitle: 'Want it to run on its own?',
    managedBody:
      'Operio runs 18 more routines for you. They connect to WhatsApp, your Google Business Profile and your booking tools, and send with the approvals you set.',
    managedAll: 'See the full catalog',

    compareTitle: 'Free or managed',
    compareHead: { topic: 'What you get', free: 'Free-ORCA', managed: 'Managed by Operio' },
    compareRows: [
      ['Where it runs', 'Your own computer', 'Operio runs it for you'],
      ['Sending to customers', 'Never. You copy, paste and send', 'Yes, behind the approvals you set'],
      ['Where the data comes from', 'Files you drop in a folder', 'Straight from WhatsApp, Google, bookings and your point of sale'],
      ['Setup', 'You install it with one line', 'Operio sets it up with you'],
      ['When something breaks', 'You check the log', 'Operio is watching and fixes it'],
      ['Routines', 'Five free routines, or write your own', 'All 23, in English and Spanish']
    ],
    compareFreeCta: 'Install free',

    securityTitle: 'It stays on your computer',
    security: [
      {
        title: 'Only your computer can open it',
        body: 'It listens on localhost only, so nothing on the internet can reach it. There is no account with us.'
      },
      {
        title: 'Your files stay where they are',
        body: 'Drafts, reports and logs live in your home folder. The only service that reads your files is the AI assistant you signed in to.'
      },
      {
        title: 'Other websites are shut out',
        body: 'It ignores requests from other sites and asks you before it opens a terminal.'
      },
      {
        title: 'Your phone, privately',
        body: 'Reach it from your phone through a private network or an SSH tunnel. Never open it to the internet.'
      }
    ],
    securityMore: 'Phone access and the full security model',

    partnerTitle: 'Agencies and consultants',
    partnerBody:
      'Offer managed routines to your clients and earn 25% through the Operio partner program.',
    partnerCta: 'Partner program',

    faqTitle: 'Questions',
    faq: [
      {
        q: 'Is it really free?',
        a: 'Yes. Free-ORCA is open source under the MIT license, with no account and no trial period. The only cost is the AI assistant you already use.'
      },
      {
        q: 'What do I need?',
        a: 'A Linux or macOS computer that is on when your routines are scheduled, Node.js 20 or newer, and an AI assistant installed and signed in: Claude Code, Codex or opencode.'
      },
      {
        q: 'Will it message my customers?',
        a: 'No. Free routines only write reports and drafts, and you send them yourself. Sending on its own, with approvals, is what the managed version does.'
      },
      {
        q: 'Can I use it from my phone?',
        a: 'Yes, through a private network (Tailscale) or an SSH tunnel. The install guide shows both, step by step.'
      },
      {
        q: 'Can I write my own routines?',
        a: 'Yes. A routine is a small file with a task, a schedule and whether its result needs your approval. The README on GitHub shows the format.'
      },
      {
        q: 'How can I see it before I set anything up?',
        a: 'Run free-orca demo. It opens a second panel with two fictional businesses whose routines work, ask you questions and finish, with no real data and no cost.'
      },
      {
        q: 'What does Operio add?',
        a: 'Operio runs the routines for you: connected to your real tools, sending with your approvals, in English and Spanish, and watched so they keep working.'
      }
    ],

    finalTitle: 'Start with one routine tomorrow morning',
    finalBody: 'Install Free-ORCA tonight and the morning brief is waiting when you open.'
  },

  catalog: {
    title: 'Routine catalog',
    metaTitle: 'Routine catalog: 23 routines for local businesses | Free-ORCA',
    description:
      '23 routines for restaurants, clinics, real estate, tourism and local shops. Five run free in Free-ORCA on your computer; Operio runs the rest for you.',
    lead:
      'Routines for restaurants, clinics, real estate, tourism and local shops. Free ones run in Free-ORCA on your computer. Managed ones Operio runs for you.',
    filterVertical: 'Business type',
    filterTier: 'Who runs it',
    all: 'All',
    showing: (n, total) => `${n} of ${total} routines`,
    none: 'No routines match. Try another business type.',
    reset: 'Show all'
  },

  tier: { free: 'Free', managed: 'Managed', freeLong: 'Free in Free-ORCA', managedLong: 'Managed by Operio' },
  verticals: {
    any: 'Any business',
    restaurant: 'Restaurants',
    clinic: 'Clinics',
    'real-estate': 'Real estate',
    tourism: 'Tourism',
    retail: 'Shops',
    services: 'Services'
  },

  routine: {
    backToCatalog: 'Catalog',
    metaSuffix: 'Free-ORCA routine',
    outcome: 'What you get',
    how: 'How it works',
    when: 'When it runs',
    approval: 'Approval',
    toolsFree: 'Reads exports from',
    toolsManaged: 'Works with',
    verticals: 'For',
    upgradeTitle: 'Want it to run on its own?',
    installTitle: 'Run it free',
    installSteps: [
      'Install Free-ORCA with this line:',
      'Open 127.0.0.1:7171, go to Routines and turn on',
      'Drop your files in'
    ],
    installStepNoFolder: 'Press Run now, or let the schedule start it.',
    installGuide: 'Full install guide',
    managedTitle: 'Operio runs this one for you',
    managedBody:
      'This routine sends on your behalf or connects several of your tools, so Operio sets it up with you, runs it and keeps an eye on it.',
    managedFree: 'Or start with a free routine',
    related: 'Related routines'
  },

  install: {
    title: 'Install Free-ORCA',
    metaTitle: 'Install Free-ORCA: one line, Linux or macOS',
    description:
      'Install Free-ORCA with one line on Linux or macOS. Phone access, updates, the demo and uninstalling.',
    lead: 'One line on Linux or macOS. It is safe to run again, and it never needs sudo.',
    toc: 'On this page',
    reqTitle: 'What you need',
    req: [
      'Linux (x86_64 or arm64) or macOS (Apple silicon or Intel).',
      'Node.js 20 or newer.',
      'An AI assistant installed and signed in: Claude Code, Codex or opencode.',
      'A computer that is on when your routines are scheduled.'
    ],
    installTitle: 'Install',
    installAfter: 'Then open',
    installWhat: 'What the installer does',
    installSteps: [
      'Downloads the panel and herdr 0.9.5, the open-source terminal workspace it runs on, and checks the download against a fixed checksum.',
      'Installs to ~/.local/share/free-orca and puts the free-orca command in ~/.local/bin.',
      'Starts it with your computer: a systemd user service on Linux, a launchd agent on macOS. Add --no-service to skip that.',
      'Adds the five free routines, turned off until you switch them on.'
    ],
    sourceTitle: 'Prefer to read it first?',
    sourceBody: 'Download the script, read it, then run it. Or clone the repository and run it from there.',
    phoneTitle: 'Use it from your phone',
    phoneBody: 'Free-ORCA listens on 127.0.0.1 only. Keep it that way and reach it through one of these.',
    tailscaleTitle: 'Tailscale (private network, HTTPS)',
    tailscaleSteps: [
      'Share the panel inside your private network:',
      'Add the name it prints to ~/.config/free-orca/env:',
      'Restart, then open that name on your phone:'
    ],
    tailscaleNote: 'Phone alerts need HTTPS, so this is the way to get them.',
    sshTitle: 'SSH tunnel',
    sshBody: 'From the device you want to use, then open http://127.0.0.1:7171 on it:',
    phoneWarn: 'Never expose it to the internet: no port forwarding, no public links. There is no login, so anyone who can reach it can use it.',
    commandsTitle: 'Everyday commands',
    commands: [
      ['free-orca status', 'Is it running, and where'],
      ['free-orca restart', 'Restart after changing settings'],
      ['free-orca stop', 'Stop it until you start it again'],
      ['free-orca start', 'Start it again']
    ],
    updateTitle: 'Update',
    updateBody: 'Updates the panel and herdr together, to versions that are tested with each other. Use this instead of updating herdr on its own.',
    demoTitle: 'Try the demo',
    demoBody: 'A second panel on port 7172 with two fictional businesses, Harbor Street Bistro and Brightside Dental. No real data, no cost, and it never touches your own setup.',
    demoCmds: [
      ['free-orca demo', 'Start it'],
      ['free-orca demo --lang es', 'Play it in Spanish'],
      ['free-orca demo --reset', 'Start over'],
      ['free-orca demo --stop', 'Stop it']
    ],
    uninstallTitle: 'Uninstall',
    uninstallBody: 'Removes the panel and its service. Add --purge to also delete your settings, drafts and logs in ~/.config/free-orca. Your AI assistants and their work are left alone.',
    helpTitle: 'Rather not run it yourself?',
    helpBody: 'Operio runs the routines for you, connected to your real tools and watched so they keep working.'
  },

  footer: {
    tagline: 'Office routines on your own computer. Free and open source.',
    product: 'Free-ORCA',
    operio: 'Operio',
    talk: 'Talk to Operio',
    partners: 'Partner program',
    website: 'operio.work',
    license: 'MIT license',
    runsOn: 'Runs on',
    runsOnLicense: '(Apache-2.0)',
    github: 'Source on GitHub'
  },
  notFound: { title: 'Page not found', body: 'That page does not exist. Try the catalog or the home page.' }
};

/** @type {typeof en} */
const es = {
  htmlLang: 'es-MX',
  ogLocale: 'es_MX',
  skip: 'Ir al contenido',
  nav: { catalog: 'Catálogo', install: 'Instalar', github: 'Free-ORCA en GitHub', home: 'Inicio de Free-ORCA' },
  langSwitch: { label: 'English', short: 'EN', aria: 'View this page in English' },
  theme: { toDark: 'Cambiar a tema oscuro', toLight: 'Cambiar a tema claro' },
  byOperio: 'por Operio',

  copy: { copy: 'Copiar', copied: 'Copiado', label: 'Copiar el comando', done: 'Comando copiado' },

  home: {
    title: 'Free-ORCA por Operio: rutinas de oficina que corren en tu computadora',
    description:
      'Free-ORCA es un panel gratuito y de código abierto que corre rutinas de oficina en tu propia computadora: un resumen matutino, respuestas a reseñas, un reporte semanal. Cada borrador espera tu visto bueno.',
    promise: 'Rutinas de oficina que corren en tu computadora y esperan tu visto bueno.',
    lead:
      'Activa una rutina y escribe tu resumen matutino, tus respuestas a reseñas o tu reporte semanal a la hora que elijas, con el asistente de IA que ya tienes. Tú lo lees, lo apruebas y lo envías. Gratis y de código abierto.',
    installLabel: 'Instala en Linux o macOS',
    installNote: 'Node.js 20 o más reciente. Sin cuenta, sin sudo.',
    installMore: 'Guía de instalación',
    secondary: 'Que Operio lo opere por ti',

    demoTitle: 'Una noche en un restaurante',
    demoBody:
      'Es la demo incluida con Harbor Street Bistro, un restaurante ficticio. La rutina de reservas preparó cuatro confirmaciones y se detuvo a preguntar dónde sentar a un grupo de ocho. Lo respondes con un toque.',
    demoAltDesktop:
      'Free-ORCA en una laptop: la rutina de reservas muestra cuatro confirmaciones listas y pregunta cómo responder a un grupo de ocho, con tres opciones para tocar.',
    demoAltPhone:
      'Free-ORCA en un celular: el mapa de Harbor Street Bistro, con dos rutinas esperando respuesta, una trabajando y una inactiva.',
    demoTry: 'Pruébala tú con',

    howTitle: 'Cómo funciona',
    steps: [
      {
        title: 'Instálalo',
        body: 'Una línea en la terminal. Arranca con tu computadora y se abre en tu navegador en 127.0.0.1:7171.'
      },
      {
        title: 'Activa una rutina',
        body: 'Elige cuándo corre y deja tus archivos en una carpeta: chats de WhatsApp, la lista de reservas, las reseñas nuevas.'
      },
      {
        title: 'Aprueba y envía',
        body: 'El borrador te espera en la pestaña Rutinas. Léelo, cambia lo que quieras, apruébalo y envíalo tú.'
      }
    ],

    freeTitle: 'Cinco rutinas, gratis',
    freeBody:
      'Leen los archivos que les das y escriben un reporte o un borrador. Nunca les escriben a tus clientes ni publican nada.',
    freeOutput: { report: 'Reporte', draft: 'Borrador que tú envías' },

    managedTitle: '¿Quieres que corra sola?',
    managedBody:
      'Operio opera 18 rutinas más por ti. Se conectan a WhatsApp, a tu Perfil de Negocio de Google y a tus sistemas de reservas, y envían con las aprobaciones que tú pones.',
    managedAll: 'Ver el catálogo completo',

    compareTitle: 'Gratis u operado',
    compareHead: { topic: 'Qué obtienes', free: 'Free-ORCA', managed: 'Operado por Operio' },
    compareRows: [
      ['Dónde corre', 'En tu propia computadora', 'Operio lo opera por ti'],
      ['Envíos a clientes', 'Nunca. Tú copias, pegas y envías', 'Sí, con las aprobaciones que tú pones'],
      ['De dónde salen los datos', 'Archivos que dejas en una carpeta', 'Directo de WhatsApp, Google, tus reservas y tu punto de venta'],
      ['Instalación', 'La instalas tú con una línea', 'Operio la configura contigo'],
      ['Si algo falla', 'Revisas el registro', 'Operio lo vigila y lo arregla'],
      ['Rutinas', 'Cinco rutinas gratis, o escribe las tuyas', 'Las 23, en español e inglés']
    ],
    compareFreeCta: 'Instalar gratis',

    securityTitle: 'Se queda en tu computadora',
    security: [
      {
        title: 'Solo tu computadora lo abre',
        body: 'Escucha únicamente en localhost, así que nada en internet puede alcanzarlo. No hay cuenta con nosotros.'
      },
      {
        title: 'Tus archivos se quedan donde están',
        body: 'Borradores, reportes y registros viven en tu carpeta personal. El único servicio que lee tus archivos es el asistente de IA con el que iniciaste sesión.'
      },
      {
        title: 'Otros sitios quedan fuera',
        body: 'Ignora las solicitudes de otros sitios web y te pregunta antes de abrir una terminal.'
      },
      {
        title: 'Tu celular, en privado',
        body: 'Ábrelo desde tu celular con una red privada o un túnel SSH. Nunca lo abras a internet.'
      }
    ],
    securityMore: 'Acceso desde el celular y el modelo de seguridad completo',

    partnerTitle: 'Agencias y consultores',
    partnerBody:
      'Ofrece rutinas operadas a tus clientes y gana el 25% con el programa de socios de Operio.',
    partnerCta: 'Programa de socios',

    faqTitle: 'Preguntas',
    faq: [
      {
        q: '¿De verdad es gratis?',
        a: 'Sí. Free-ORCA es de código abierto con licencia MIT, sin cuenta y sin periodo de prueba. Lo único que pagas es el asistente de IA que ya usas.'
      },
      {
        q: '¿Qué necesito?',
        a: 'Una computadora con Linux o macOS que esté prendida a la hora de tus rutinas, Node.js 20 o más reciente y un asistente de IA instalado y con sesión iniciada: Claude Code, Codex u opencode.'
      },
      {
        q: '¿Les va a escribir a mis clientes?',
        a: 'No. Las rutinas gratis solo escriben reportes y borradores, y tú los envías. Enviar por su cuenta, con aprobaciones, es lo que hace la versión operada.'
      },
      {
        q: '¿Lo puedo usar desde mi celular?',
        a: 'Sí, con una red privada (Tailscale) o un túnel SSH. La guía de instalación muestra las dos formas, paso a paso.'
      },
      {
        q: '¿Puedo escribir mis propias rutinas?',
        a: 'Sí. Una rutina es un archivo pequeño con una tarea, un horario y si el resultado necesita tu aprobación. El README en GitHub muestra el formato.'
      },
      {
        q: '¿Cómo lo veo antes de configurar algo?',
        a: 'Corre free-orca demo. Abre un segundo panel con dos negocios ficticios cuyas rutinas trabajan, te hacen preguntas y terminan, sin datos reales y sin costo.'
      },
      {
        q: '¿Qué agrega Operio?',
        a: 'Operio opera las rutinas por ti: conectadas a tus herramientas reales, enviando con tus aprobaciones, en español e inglés, y vigiladas para que sigan funcionando.'
      }
    ],

    finalTitle: 'Empieza con una rutina mañana temprano',
    finalBody: 'Instala Free-ORCA hoy en la noche y el resumen matutino te espera cuando abras.'
  },

  catalog: {
    title: 'Catálogo de rutinas',
    metaTitle: 'Catálogo de rutinas: 23 rutinas para negocios locales | Free-ORCA',
    description:
      '23 rutinas para restaurantes, clínicas, bienes raíces, turismo y tiendas. Cinco corren gratis en Free-ORCA en tu computadora; Operio opera las demás por ti.',
    lead:
      'Rutinas para restaurantes, clínicas, bienes raíces, turismo y tiendas. Las gratis corren en Free-ORCA en tu computadora. Las operadas las corre Operio por ti.',
    filterVertical: 'Tipo de negocio',
    filterTier: 'Quién la opera',
    all: 'Todas',
    showing: (n, total) => `${n} de ${total} rutinas`,
    none: 'Ninguna rutina coincide. Prueba otro tipo de negocio.',
    reset: 'Ver todas'
  },

  tier: { free: 'Gratis', managed: 'Operada', freeLong: 'Gratis en Free-ORCA', managedLong: 'Operada por Operio' },
  verticals: {
    any: 'Cualquier negocio',
    restaurant: 'Restaurantes',
    clinic: 'Clínicas',
    'real-estate': 'Bienes raíces',
    tourism: 'Turismo',
    retail: 'Tiendas',
    services: 'Servicios'
  },

  routine: {
    backToCatalog: 'Catálogo',
    metaSuffix: 'rutina de Free-ORCA',
    outcome: 'Qué obtienes',
    how: 'Cómo funciona',
    when: 'Cuándo corre',
    approval: 'Aprobación',
    toolsFree: 'Lee archivos exportados de',
    toolsManaged: 'Funciona con',
    verticals: 'Para',
    upgradeTitle: '¿Quieres que corra sola?',
    installTitle: 'Córrela gratis',
    installSteps: [
      'Instala Free-ORCA con esta línea:',
      'Abre 127.0.0.1:7171, ve a Rutinas y activa',
      'Deja tus archivos en'
    ],
    installStepNoFolder: 'Pulsa Ejecutar ahora, o deja que el horario la inicie.',
    installGuide: 'Guía de instalación completa',
    managedTitle: 'Esta la opera Operio por ti',
    managedBody:
      'Esta rutina envía en tu nombre o conecta varias de tus herramientas, así que Operio la configura contigo, la corre y la vigila.',
    managedFree: 'O empieza con una rutina gratis',
    related: 'Rutinas relacionadas'
  },

  install: {
    title: 'Instala Free-ORCA',
    metaTitle: 'Instala Free-ORCA: una línea, Linux o macOS',
    description:
      'Instala Free-ORCA con una línea en Linux o macOS. Acceso desde el celular, actualizaciones, la demo y cómo desinstalar.',
    lead: 'Una línea en Linux o macOS. Puedes correrla de nuevo sin problema y nunca necesita sudo.',
    toc: 'En esta página',
    reqTitle: 'Qué necesitas',
    req: [
      'Linux (x86_64 o arm64) o macOS (Apple silicon o Intel).',
      'Node.js 20 o más reciente.',
      'Un asistente de IA instalado y con sesión iniciada: Claude Code, Codex u opencode.',
      'Una computadora que esté prendida a la hora de tus rutinas.'
    ],
    installTitle: 'Instalación',
    installAfter: 'Luego abre',
    installWhat: 'Qué hace el instalador',
    installSteps: [
      'Descarga el panel y herdr 0.9.5, el espacio de trabajo de terminal de código abierto sobre el que corre, y revisa la descarga contra una suma de verificación fija.',
      'Instala en ~/.local/share/free-orca y deja el comando free-orca en ~/.local/bin.',
      'Lo arranca con tu computadora: un servicio de usuario de systemd en Linux, un agente de launchd en macOS. Agrega --no-service para omitirlo.',
      'Agrega las cinco rutinas gratis, apagadas hasta que las actives.'
    ],
    sourceTitle: '¿Prefieres leerlo antes?',
    sourceBody: 'Descarga el script, léelo y luego córrelo. O clona el repositorio y córrelo desde ahí.',
    phoneTitle: 'Úsalo desde tu celular',
    phoneBody: 'Free-ORCA escucha solo en 127.0.0.1. Déjalo así y entra con una de estas opciones.',
    tailscaleTitle: 'Tailscale (red privada, HTTPS)',
    tailscaleSteps: [
      'Comparte el panel dentro de tu red privada:',
      'Agrega el nombre que muestra a ~/.config/free-orca/env:',
      'Reinicia y abre ese nombre en tu celular:'
    ],
    tailscaleNote: 'Las alertas en el celular necesitan HTTPS, así que esta es la forma de tenerlas.',
    sshTitle: 'Túnel SSH',
    sshBody: 'Desde el dispositivo que quieres usar; luego abre http://127.0.0.1:7171 en él:',
    phoneWarn: 'Nunca lo expongas a internet: sin reenvío de puertos, sin enlaces públicos. No tiene inicio de sesión, así que quien lo alcance lo puede usar.',
    commandsTitle: 'Comandos del día a día',
    commands: [
      ['free-orca status', 'Si está corriendo, y dónde'],
      ['free-orca restart', 'Reinicia después de cambiar la configuración'],
      ['free-orca stop', 'Lo detiene hasta que lo inicies de nuevo'],
      ['free-orca start', 'Lo inicia de nuevo']
    ],
    updateTitle: 'Actualizar',
    updateBody: 'Actualiza el panel y herdr juntos, a versiones probadas entre sí. Úsalo en lugar de actualizar herdr por separado.',
    demoTitle: 'Prueba la demo',
    demoBody: 'Un segundo panel en el puerto 7172 con dos negocios ficticios, Harbor Street Bistro y Brightside Dental. Sin datos reales, sin costo, y nunca toca tu propia configuración.',
    demoCmds: [
      ['free-orca demo', 'La inicia'],
      ['free-orca demo --lang es', 'La reproduce en español'],
      ['free-orca demo --reset', 'Empieza desde cero'],
      ['free-orca demo --stop', 'La detiene']
    ],
    uninstallTitle: 'Desinstalar',
    uninstallBody: 'Quita el panel y su servicio. Agrega --purge para borrar también tu configuración, borradores y registros en ~/.config/free-orca. Tus asistentes de IA y su trabajo no se tocan.',
    helpTitle: '¿Prefieres no correrlo tú?',
    helpBody: 'Operio opera las rutinas por ti, conectadas a tus herramientas reales y vigiladas para que sigan funcionando.'
  },

  footer: {
    tagline: 'Rutinas de oficina en tu propia computadora. Gratis y de código abierto.',
    product: 'Free-ORCA',
    operio: 'Operio',
    talk: 'Habla con Operio',
    partners: 'Programa de socios',
    website: 'operio.work',
    license: 'Licencia MIT',
    runsOn: 'Corre sobre',
    runsOnLicense: '(Apache-2.0)',
    github: 'Código en GitHub'
  },
  notFound: { title: 'Página no encontrada', body: 'Esa página no existe. Prueba el catálogo o la página de inicio.' }
};

export const dict = { en, es };

/** @param {string | undefined} lang */
export const t = (lang) => (lang === 'es' ? es : en);
