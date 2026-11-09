// UI copy for make.operio.work, EN + ES (Mexican Spanish, tú).
// Routine copy is NOT here: it comes from catalog/catalog.json only.

const en = {
  htmlLang: 'en',
  ogLocale: 'en_US',
  skip: 'Skip to content',
  nav: { catalog: 'Catalog', install: 'Install', compare: 'Compare', github: 'ORCA on GitHub', home: 'ORCA home' },
  langSwitch: { label: 'Español', short: 'ES', aria: 'Ver esta página en español' },
  theme: { toDark: 'Switch to dark theme', toLight: 'Switch to light theme' },
  byOperio: 'by Operio',

  copy: { copy: 'Copy', copied: 'Copied', label: 'Copy the command', done: 'Command copied' },

  home: {
    title: 'ORCA by Operio: one board for all your AI agents',
    description:
      'ORCA is a free, open-source control panel for the AI agents on your own computer: one live board, phone alerts when an agent needs you, one-tap answers, and scheduled routines whose drafts wait for your OK.',
    headline: 'All your AI agents on one board, and\u00a0in your pocket.',
    lead:
      'ORCA shows what every agent is doing at a glance, alerts your phone when one needs you, and lets you answer with a tap. Free, open source, on your own computer.',
    acronymLabel: 'What ORCA stands for',
    acronym: [
      ['Orchestrate', 'your agents on one board'],
      ['Reply', 'from your phone'],
      ['Check', 'every status at a glance'],
      ['Approve', 'drafts before they go out']
    ],
    proofLead: 'Built by Operio.',
    proofBody: 'Our own team runs its agents on it every day: from the desk and from the phone.',
    installLabel: 'Install on Linux, macOS or Windows (WSL2)',
    installNote: 'Node.js 20 or newer. No account, no sudo.',
    installMore: 'Install guide',
    secondary: 'Have Operio run it for you',

    video: {
      play: 'Watch the demo',
      length: '0:50',
      playLabel: 'Play the ORCA demo video, 50 seconds, music only with no narration',
      label: 'ORCA demo video. Music only, no narration. Captions repeat the text shown on screen.',
      close: 'Close the video',
      captions: 'English',
      posterAlt:
        'ORCA demo: an agent stops to ask how to seat a party of eight, with three answers to tap.'
    },

    painsTitle: 'Several agents should not mean babysitting them',
    painsLead: 'Four things that slow you down once more than one agent is running, and what ORCA does about each.',
    painLabel: 'The problem',
    fixLabel: 'With ORCA',
    pains: [
      {
        id: 'needs-you',
        pain: 'Agents stall while you are in another window',
        painBody: 'An agent asks a question, then sits idle for an hour because you never saw it.',
        fix: 'Your phone tells you, and one tap answers',
        fixBody:
          'When an agent needs a decision, its tile turns red and your phone gets a “needs you” alert. Pick an answer and it gets back to work.',
        alt: 'An agent on a phone asking “How should I answer the Morgan party?”, with three answers to tap.'
      },
      {
        id: 'board',
        pain: 'Five agents, five tabs, no idea who is stuck',
        painBody: 'You click through terminals to find out who is working, who is done and who is waiting on you.',
        fix: 'One live board for every agent',
        fixBody:
          'Each agent is a tile painted by its status: working, needs you, done. You read the whole team at a glance.',
        alt: 'The live board: counts for needs you, working and idle, and four agent tiles in two groups, two of them red.'
      },
      {
        id: 'phone',
        pain: 'You can’t leave the desk while they run',
        painBody: 'Step away and the work stops, because the next question waits until you are back.',
        fix: 'Run them from your phone',
        fixBody:
          'Read the output, reply, and start new agents from anywhere, over a private connection to your own computer.',
        alt: 'ORCA on a phone: the New button, the status counts and the agent tiles.'
      },
      {
        id: 'approve',
        pain: 'The same instructions every morning, and drafts that go out unchecked',
        painBody: 'You retype the same tasks every day, and nothing stops a draft from leaving before you read it.',
        fix: 'Scheduled routines whose drafts wait for your OK',
        fixBody:
          'Save a task once and pick when it runs. What it writes waits in the Routines tab until you approve it.',
        alt: 'The Routines tab on a phone: a review-reply draft marked “needs approval”, with Approve and Reject buttons.'
      }
    ],

    vsTitle: 'How ORCA compares',
    vsLines: [
      'herdr runs the terminals. ORCA adds the phone, the alerts, the routines and the approvals.',
      'Claude Code, Codex and opencode on one board, with a phone alert and one-tap answers, free on your own computer.',
      'Want it always on, without your computer? ORCA Managed by Operio runs it for you.'
    ],
    vsMore: 'Compare ORCA with five other tools',

    howTitle: 'How it works',
    steps: [
      {
        title: 'Install it',
        body: 'One line in the terminal. It starts with your computer and opens in your browser at 127.0.0.1:7171.'
      },
      {
        title: 'Start your agents',
        body: 'Open Claude Code, Codex or opencode with the New button. Each one gets a tile on the board.'
      },
      {
        title: 'Answer from anywhere',
        body: 'Turn on phone alerts over a private connection. When an agent needs you, answer with a tap and carry on with your day.'
      }
    ],

    bizTitle: 'Run a business?',
    bizBody:
      'ORCA also runs office routines on a schedule: a morning brief, review replies, a weekly report. They read the files you give them and write a report or a draft. Nothing reaches your customers until you send it.',
    freeTitle: 'Five routines, free',
    freeOutput: { report: 'Report', draft: 'Draft you send' },
    managedTitle: 'Want it to run on its own?',
    managedBody:
      'ORCA Managed by Operio runs 18 more routines for you. They connect to WhatsApp, your Google Business Profile and your booking tools, and send with the approvals you set.',
    managedAll: 'See the full catalog',
    partnerBody: 'Agencies and consultants: offer managed routines to your clients and earn 25%.',
    partnerCta: 'Partner program',

    compareTitle: 'Free or managed',
    compareHead: { topic: 'What you get', free: 'ORCA', managed: 'ORCA Managed by Operio' },
    compareRows: [
      ['Where it runs', 'Your own computer', 'Operio runs it for you'],
      ['Sending to customers', 'Never. You copy, paste and send', 'Yes, behind the approvals you set'],
      ['Setup', 'You install it with one line', 'Operio sets it up with you'],
      ['When something breaks', 'You check the log', 'Operio is watching and fixes it']
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

    faqTitle: 'Questions',
    faq: [
      {
        q: 'What does ORCA stand for?',
        a: 'Orchestrate, Reply, Check, Approve. Orchestrate your agents on one board, reply to them from your phone, check every status at a glance, and approve drafts before they go out.'
      },
      {
        q: 'Is it really free?',
        a: 'Yes. ORCA is open source under the MIT license, with no account and no trial period. The only cost is the AI assistant you already use.'
      },
      {
        q: 'Which AI agents does it work with?',
        a: 'Claude Code, Codex, opencode and other agents that run in a terminal. Install and sign in to them as usual; ORCA shows them, starts them and passes on your answers.'
      },
      {
        q: 'What do I need?',
        a: 'A computer with Linux, macOS or Windows (WSL2), Node.js 20 or newer, and at least one AI agent installed and signed in. For routines, the computer has to be on when they are scheduled.'
      },
      {
        q: 'Can I use it from my phone?',
        a: 'Yes, through a private network (Tailscale) or an SSH tunnel. The install guide shows both, step by step.'
      },
      {
        q: 'Will it message my customers?',
        a: 'No. Free routines only write reports and drafts, and you send them yourself. Sending on its own, with approvals, is what ORCA Managed by Operio does.'
      },
      {
        q: 'How can I see it before I set anything up?',
        a: 'Run operio-orca demo. It opens a second panel with two fictional businesses whose agents work, ask you questions and finish, with no real data and no cost.'
      }
    ],

    finalTitle: 'Put every agent on one board',
    finalBody: 'One line to install. No account and no sudo.'
  },

  catalog: {
    title: 'Routine catalog',
    metaTitle: 'Routine catalog: 23 routines for local businesses | ORCA',
    description:
      '23 routines for restaurants, clinics, real estate, tourism and local shops. Five run free in ORCA on your computer; Operio runs the rest for you.',
    lead:
      'Routines for restaurants, clinics, real estate, tourism and local shops. Free ones run in ORCA on your computer. Managed ones run in ORCA Managed by Operio.',
    filterVertical: 'Business type',
    filterTier: 'Who runs it',
    all: 'All',
    showing: (n, total) => `${n} of ${total} routines`,
    none: 'No routines match. Try another business type.',
    reset: 'Show all'
  },

  tier: { free: 'Free', managed: 'Managed', freeLong: 'Free in ORCA', managedLong: 'ORCA Managed by Operio' },
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
    metaSuffix: 'ORCA routine',
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
      'Install ORCA with this line:',
      'Open 127.0.0.1:7171, go to Routines and turn on',
      'Drop your files in'
    ],
    installStepNoFolder: 'Press Run now, or let the schedule start it.',
    installGuide: 'Full install guide',
    managedTitle: 'Operio runs this one for you',
    managedBody:
      'This routine sends on your behalf or connects several of your tools, so it runs in ORCA Managed by Operio: Operio sets it up with you, runs it and keeps an eye on it.',
    managedFree: 'Or start with a free routine',
    related: 'Related routines'
  },

  install: {
    title: 'Install ORCA',
    metaTitle: 'Install ORCA: one line, Linux, macOS or Windows (WSL2)',
    description:
      'Install ORCA with one line on Linux, macOS or Windows (WSL2). Phone access, updates, the demo and uninstalling.',
    lead: 'One line on Linux, macOS or Windows (WSL2). It is safe to run again, and it never needs sudo.',
    toc: 'On this page',
    reqTitle: 'What you need',
    req: [
      'Linux (x86_64 or arm64), macOS (Apple silicon or Intel), or Windows through WSL2.',
      'Node.js 20 or newer.',
      'An AI assistant installed and signed in: Claude Code, Codex or opencode.',
      'A computer that is on when your routines are scheduled.'
    ],
    installTitle: 'Install',
    installAfter: 'Then open',
    installWhat: 'What the installer does',
    installSteps: [
      'Downloads the panel and herdr 0.9.5, the open-source terminal workspace it runs on, and checks the download against a fixed checksum.',
      'Installs to ~/.local/share/operio-orca and puts the operio-orca command in ~/.local/bin.',
      'Starts it with your computer: a systemd user service on Linux, a launchd agent on macOS. Add --no-service to skip that.',
      'Adds the five free routines, turned off until you switch them on.'
    ],
    sourceTitle: 'Prefer to read it first?',
    sourceBody: 'Download the script, read it, then run it. Or clone the repository and run it from there.',
    wslTitle: 'Windows (WSL2)',
    wslBody: 'On Windows, ORCA runs inside WSL2, the Linux system built into Windows. Set it up once, then use the same one-line install.',
    wslSteps: [
      'Open PowerShell as administrator, install WSL2 with Ubuntu, and restart if Windows asks:',
      'Open Ubuntu from the Start menu and create your user. Inside Ubuntu, install Node.js 20 or newer and your AI assistant.',
      'Run the same one-line install inside Ubuntu:'
    ],
    wslNote: 'WSL2 support is new. If something does not work,',
    wslIssue: 'tell us on GitHub.',
    phoneTitle: 'Use it from your phone',
    phoneBody: 'ORCA listens on 127.0.0.1 only. Keep it that way and reach it through one of these.',
    tailscaleTitle: 'Tailscale (private network, HTTPS)',
    tailscaleSteps: [
      'Share the panel inside your private network:',
      'Add the name it prints to ~/.config/operio-orca/env:',
      'Restart, then open that name on your phone:'
    ],
    tailscaleNote: 'Phone alerts need HTTPS, so this is the way to get them.',
    sshTitle: 'SSH tunnel',
    sshBody: 'From the device you want to use, then open http://127.0.0.1:7171 on it:',
    phoneWarn: 'Never expose it to the internet: no port forwarding, no public links. There is no login, so anyone who can reach it can use it.',
    commandsTitle: 'Everyday commands',
    commands: [
      ['operio-orca status', 'Is it running, and where'],
      ['operio-orca restart', 'Restart after changing settings'],
      ['operio-orca stop', 'Stop it until you start it again'],
      ['operio-orca start', 'Start it again']
    ],
    commandsWhyQ: 'Why operio-orca and not just orca?',
    commandsWhyA: 'Ubuntu and many Linux desktops already ship a program called orca: the GNOME screen reader. A distinct name keeps the two apart.',
    updateTitle: 'Update',
    updateBody: 'Updates the panel and herdr together, to versions that are tested with each other. Use this instead of updating herdr on its own.',
    demoTitle: 'Try the demo',
    demoBody: 'A second panel on port 7172 with two fictional businesses, Harbor Street Bistro and Brightside Dental. No real data, no cost, and it never touches your own setup.',
    demoCmds: [
      ['operio-orca demo', 'Start it'],
      ['operio-orca demo --lang es', 'Play it in Spanish'],
      ['operio-orca demo --reset', 'Start over'],
      ['operio-orca demo --stop', 'Stop it']
    ],
    uninstallTitle: 'Uninstall',
    uninstallBody: 'Removes the panel and its service. Add --purge to also delete your settings, drafts and logs in ~/.config/operio-orca. Your AI assistants and their work are left alone.',
    helpTitle: 'Rather not run it yourself?',
    helpBody: 'Operio runs the routines for you, connected to your real tools and watched so they keep working.'
  },

  footer: {
    tagline: 'One board for all your AI agents, on your own computer. Free and open source.',
    product: 'ORCA',
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
  nav: { catalog: 'Catálogo', install: 'Instalar', compare: 'Comparar', github: 'ORCA en GitHub', home: 'Inicio de ORCA' },
  langSwitch: { label: 'English', short: 'EN', aria: 'View this page in English' },
  theme: { toDark: 'Cambiar a tema oscuro', toLight: 'Cambiar a tema claro' },
  byOperio: 'por Operio',

  copy: { copy: 'Copiar', copied: 'Copiado', label: 'Copiar el comando', done: 'Comando copiado' },

  home: {
    title: 'ORCA por Operio: un tablero para todos tus agentes de IA',
    description:
      'ORCA es un panel gratuito y de código abierto para los agentes de IA de tu propia computadora: un tablero en vivo, avisos en el celular cuando un agente te necesita, respuestas con un toque y rutinas programadas cuyos borradores esperan tu visto bueno.',
    headline: 'Todos tus agentes de IA en un tablero, y en tu bolsillo.',
    lead:
      'ORCA te muestra de un vistazo qué hace cada agente, te avisa en el celular cuando uno te necesita y lo respondes con un toque. Gratis, de código abierto y en tu propia computadora.',
    acronymLabel: 'Qué significa ORCA',
    acronym: [
      ['Orquesta', 'tus agentes en un tablero'],
      ['Responde', 'desde tu celular'],
      ['Controla', 'cada estado de un vistazo'],
      ['Aprueba', 'los borradores antes de salir']
    ],
    proofLead: 'Hecho por Operio.',
    proofBody: 'Nuestro equipo maneja sus propios agentes con esto todos los días: desde el escritorio y desde el celular.',
    installLabel: 'Instala en Linux, macOS o Windows (WSL2)',
    installNote: 'Node.js 20 o más reciente. Sin cuenta, sin sudo.',
    installMore: 'Guía de instalación',
    secondary: 'Que Operio lo opere por ti',

    video: {
      play: 'Ver la demo',
      length: '0:50',
      playLabel: 'Reproducir el video de la demo de ORCA, 50 segundos, solo música y sin narración',
      label: 'Video de la demo de ORCA. Solo música, sin narración. Los subtítulos repiten el texto que aparece en pantalla.',
      close: 'Cerrar el video',
      captions: 'Español',
      posterAlt:
        'Demo de ORCA: un agente se detiene a preguntar dónde sentar a un grupo de ocho, con tres respuestas para tocar.'
    },

    painsTitle: 'Tener varios agentes no debería significar cuidarlos todo el día',
    painsLead: 'Cuatro cosas que te frenan en cuanto corre más de un agente, y lo que ORCA hace con cada una.',
    painLabel: 'El problema',
    fixLabel: 'Con ORCA',
    pains: [
      {
        id: 'needs-you',
        pain: 'Tus agentes se quedan esperando mientras estás en otra ventana',
        painBody: 'Un agente te hace una pregunta y se queda parado una hora porque no la viste.',
        fix: 'Te avisa en el celular y respondes con un toque',
        fixBody:
          'Cuando un agente necesita una decisión, su recuadro se pone rojo y te llega un aviso de “te necesita”. Eliges una respuesta y vuelve a trabajar.',
        alt: 'Un agente en el celular pregunta “¿Cómo le respondo al grupo de Morgan?”, con tres respuestas para tocar.'
      },
      {
        id: 'board',
        pain: 'Cinco agentes, cinco pestañas y no sabes quién está atorado',
        painBody: 'Saltas de terminal en terminal para ver quién trabaja, quién terminó y quién te está esperando.',
        fix: 'Un tablero en vivo con todos tus agentes',
        fixBody:
          'Cada agente es un recuadro pintado según su estado: trabajando, te necesita, terminado. Ves a todo el equipo de un vistazo.',
        alt: 'El tablero en vivo: cuántos te necesitan, trabajan o están inactivos, y cuatro recuadros de agentes en dos grupos, dos en rojo.'
      },
      {
        id: 'phone',
        pain: 'No puedes despegarte del escritorio mientras corren',
        painBody: 'Te alejas y el trabajo se detiene, porque la siguiente pregunta espera a que regreses.',
        fix: 'Manéjalos desde tu celular',
        fixBody:
          'Lee lo que hacen, respóndeles y arranca agentes nuevos desde donde estés, con una conexión privada a tu propia computadora.',
        alt: 'ORCA en un celular: el botón Nuevo, los contadores de estado y los recuadros de los agentes.'
      },
      {
        id: 'approve',
        pain: 'Las mismas instrucciones cada mañana y borradores que salen sin revisar',
        painBody: 'Repites las mismas tareas todos los días y nada impide que un borrador salga antes de que lo leas.',
        fix: 'Rutinas programadas cuyos borradores esperan tu visto bueno',
        fixBody:
          'Guarda una tarea una vez y elige cuándo corre. Lo que escribe te espera en la pestaña Rutinas hasta que lo apruebas.',
        alt: 'La pestaña Rutinas en un celular: un borrador de respuestas a reseñas marcado “por aprobar”, con los botones Aprobar y Rechazar.'
      }
    ],

vsTitle: 'Cómo se compara ORCA',
    vsLines: [
      'herdr corre las terminales. ORCA le suma el celular, los avisos, las rutinas y las aprobaciones.',
      'Claude Code, Codex y opencode en un tablero, con aviso al celular y respuestas con un toque, gratis en tu propia computadora.',
      '¿Lo quieres siempre prendido, sin tu computadora? ORCA Gestionado por Operio lo opera por ti.'
    ],
    vsMore: 'Compara ORCA con otras cinco herramientas',

    howTitle: 'Cómo funciona',
    steps: [
      {
        title: 'Instálalo',
        body: 'Una línea en la terminal. Arranca con tu computadora y se abre en tu navegador en 127.0.0.1:7171.'
      },
      {
        title: 'Arranca tus agentes',
        body: 'Abre Claude Code, Codex u opencode con el botón Nuevo. Cada uno aparece como un recuadro en el tablero.'
      },
      {
        title: 'Responde desde donde estés',
        body: 'Activa los avisos en tu celular con una conexión privada. Cuando un agente te necesita, respondes con un toque y sigues con tu día.'
      }
    ],

    bizTitle: '¿Tienes un negocio?',
    bizBody:
      'ORCA también corre rutinas de oficina a la hora que elijas: un resumen matutino, respuestas a reseñas, un reporte semanal. Leen los archivos que les das y escriben un reporte o un borrador. Nada les llega a tus clientes hasta que tú lo envías.',
    freeTitle: 'Cinco rutinas, gratis',
    freeOutput: { report: 'Reporte', draft: 'Borrador que tú envías' },
    managedTitle: '¿Quieres que corra sola?',
    managedBody:
      'ORCA Gestionado por Operio opera 18 rutinas más por ti. Se conectan a WhatsApp, a tu Perfil de Negocio de Google y a tus herramientas de reservas, y envían con las aprobaciones que tú pones.',
    managedAll: 'Ver el catálogo completo',
    partnerBody: 'Agencias y consultores: ofrece rutinas gestionadas a tus clientes y gana el 25%.',
    partnerCta: 'Programa de socios',

    compareTitle: 'Gratis o gestionado',
    compareHead: { topic: 'Qué obtienes', free: 'ORCA', managed: 'ORCA Gestionado por Operio' },
    compareRows: [
      ['Dónde corre', 'En tu propia computadora', 'Operio lo opera por ti'],
      ['Envíos a clientes', 'Nunca. Tú copias, pegas y envías', 'Sí, con las aprobaciones que tú pones'],
      ['Instalación', 'La instalas tú con una línea', 'Operio la configura contigo'],
      ['Si algo falla', 'Revisas el registro', 'Operio lo vigila y lo arregla']
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

    faqTitle: 'Preguntas',
    faq: [
      {
        q: '¿Qué significa ORCA?',
        a: 'Orquesta, Responde, Controla, Aprueba. Orquesta tus agentes en un solo tablero, respóndeles desde tu celular, controla cada estado de un vistazo y aprueba los borradores antes de que salgan.'
      },
      {
        q: '¿De verdad es gratis?',
        a: 'Sí. ORCA es de código abierto con licencia MIT, sin cuenta y sin periodo de prueba. Lo único que pagas es el asistente de IA que ya usas.'
      },
      {
        q: '¿Con qué agentes de IA funciona?',
        a: 'Con Claude Code, Codex, opencode y otros agentes que corren en una terminal. Los instalas e inicias sesión como siempre; ORCA los muestra, los arranca y les pasa tus respuestas.'
      },
      {
        q: '¿Qué necesito?',
        a: 'Una computadora con Linux, macOS o Windows (WSL2), Node.js 20 o más reciente y al menos un agente de IA instalado y con sesión iniciada. Para las rutinas, la computadora tiene que estar prendida a la hora programada.'
      },
      {
        q: '¿Lo puedo usar desde mi celular?',
        a: 'Sí, con una red privada (Tailscale) o un túnel SSH. La guía de instalación muestra las dos formas, paso a paso.'
      },
      {
        q: '¿Les va a escribir a mis clientes?',
        a: 'No. Las rutinas gratis solo escriben reportes y borradores, y tú los envías. Enviar por su cuenta, con aprobaciones, es lo que hace ORCA Gestionado por Operio.'
      },
      {
        q: '¿Cómo lo veo antes de configurar algo?',
        a: 'Corre operio-orca demo. Abre un segundo panel con dos negocios ficticios cuyos agentes trabajan, te hacen preguntas y terminan, sin datos reales y sin costo.'
      }
    ],

    finalTitle: 'Pon a todos tus agentes en un solo tablero',
    finalBody: 'Una línea para instalar. Sin cuenta y sin sudo.'
  },

  catalog: {
    title: 'Catálogo de rutinas',
    metaTitle: 'Catálogo de rutinas: 23 rutinas para negocios locales | ORCA',
    description:
      '23 rutinas para restaurantes, clínicas, bienes raíces, turismo y tiendas. Cinco corren gratis en ORCA en tu computadora; Operio opera las demás por ti.',
    lead:
      'Rutinas para restaurantes, clínicas, bienes raíces, turismo y tiendas. Las gratis corren en ORCA en tu computadora. Las gestionadas corren en ORCA Gestionado por Operio.',
    filterVertical: 'Tipo de negocio',
    filterTier: 'Quién la opera',
    all: 'Todas',
    showing: (n, total) => `${n} de ${total} rutinas`,
    none: 'Ninguna rutina coincide. Prueba otro tipo de negocio.',
    reset: 'Ver todas'
  },

  tier: { free: 'Gratis', managed: 'Gestionada', freeLong: 'Gratis en ORCA', managedLong: 'ORCA Gestionado por Operio' },
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
    metaSuffix: 'rutina de ORCA',
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
      'Instala ORCA con esta línea:',
      'Abre 127.0.0.1:7171, ve a Rutinas y activa',
      'Deja tus archivos en'
    ],
    installStepNoFolder: 'Pulsa Ejecutar ahora, o deja que el horario la inicie.',
    installGuide: 'Guía de instalación completa',
    managedTitle: 'Esta la opera Operio por ti',
    managedBody:
      'Esta rutina envía en tu nombre o conecta varias de tus herramientas, así que corre en ORCA Gestionado por Operio: Operio la configura contigo, la corre y la vigila.',
    managedFree: 'O empieza con una rutina gratis',
    related: 'Rutinas relacionadas'
  },

  install: {
    title: 'Instala ORCA',
    metaTitle: 'Instala ORCA: una línea, Linux, macOS o Windows (WSL2)',
    description:
      'Instala ORCA con una línea en Linux, macOS o Windows (WSL2). Acceso desde el celular, actualizaciones, la demo y cómo desinstalar.',
    lead: 'Una línea en Linux, macOS o Windows (WSL2). Puedes correrla de nuevo sin problema y nunca necesita sudo.',
    toc: 'En esta página',
    reqTitle: 'Qué necesitas',
    req: [
      'Linux (x86_64 o arm64), macOS (Apple silicon o Intel), o Windows con WSL2.',
      'Node.js 20 o más reciente.',
      'Un asistente de IA instalado y con sesión iniciada: Claude Code, Codex u opencode.',
      'Una computadora que esté prendida a la hora de tus rutinas.'
    ],
    installTitle: 'Instalación',
    installAfter: 'Luego abre',
    installWhat: 'Qué hace el instalador',
    installSteps: [
      'Descarga el panel y herdr 0.9.5, el espacio de trabajo de terminal de código abierto sobre el que corre, y revisa la descarga contra una suma de verificación fija.',
      'Instala en ~/.local/share/operio-orca y deja el comando operio-orca en ~/.local/bin.',
      'Lo arranca con tu computadora: un servicio de usuario de systemd en Linux, un agente de launchd en macOS. Agrega --no-service para omitirlo.',
      'Agrega las cinco rutinas gratis, apagadas hasta que las actives.'
    ],
    sourceTitle: '¿Prefieres leerlo antes?',
    sourceBody: 'Descarga el script, léelo y luego córrelo. O clona el repositorio y córrelo desde ahí.',
    wslTitle: 'Windows (WSL2)',
    wslBody: 'En Windows, ORCA corre dentro de WSL2, el sistema Linux que viene con Windows. Lo configuras una vez y luego usas la misma instalación de una línea.',
    wslSteps: [
      'Abre PowerShell como administrador, instala WSL2 con Ubuntu y reinicia si Windows te lo pide:',
      'Abre Ubuntu desde el menú Inicio y crea tu usuario. Dentro de Ubuntu, instala Node.js 20 o más reciente y tu asistente de IA.',
      'Corre la misma instalación de una línea dentro de Ubuntu:'
    ],
    wslNote: 'El soporte para WSL2 es nuevo. Si algo no funciona,',
    wslIssue: 'cuéntanos en GitHub.',
    phoneTitle: 'Úsalo desde tu celular',
    phoneBody: 'ORCA escucha solo en 127.0.0.1. Déjalo así y entra con una de estas opciones.',
    tailscaleTitle: 'Tailscale (red privada, HTTPS)',
    tailscaleSteps: [
      'Comparte el panel dentro de tu red privada:',
      'Agrega el nombre que muestra a ~/.config/operio-orca/env:',
      'Reinicia y abre ese nombre en tu celular:'
    ],
    tailscaleNote: 'Las alertas en el celular necesitan HTTPS, así que esta es la forma de tenerlas.',
    sshTitle: 'Túnel SSH',
    sshBody: 'Desde el dispositivo que quieres usar; luego abre http://127.0.0.1:7171 en él:',
    phoneWarn: 'Nunca lo expongas a internet: sin reenvío de puertos, sin enlaces públicos. No tiene inicio de sesión, así que quien lo alcance lo puede usar.',
    commandsTitle: 'Comandos del día a día',
    commands: [
      ['operio-orca status', 'Si está corriendo, y dónde'],
      ['operio-orca restart', 'Reinicia después de cambiar la configuración'],
      ['operio-orca stop', 'Lo detiene hasta que lo inicies de nuevo'],
      ['operio-orca start', 'Lo inicia de nuevo']
    ],
    commandsWhyQ: '¿Por qué operio-orca y no solo orca?',
    commandsWhyA: 'Ubuntu y muchos escritorios Linux ya traen un programa llamado orca: el lector de pantalla de GNOME. Un nombre distinto evita que se confundan.',
    updateTitle: 'Actualizar',
    updateBody: 'Actualiza el panel y herdr juntos, a versiones probadas entre sí. Úsalo en lugar de actualizar herdr por separado.',
    demoTitle: 'Prueba la demo',
    demoBody: 'Un segundo panel en el puerto 7172 con dos negocios ficticios, Harbor Street Bistro y Brightside Dental. Sin datos reales, sin costo, y nunca toca tu propia configuración.',
    demoCmds: [
      ['operio-orca demo', 'La inicia'],
      ['operio-orca demo --lang es', 'La reproduce en español'],
      ['operio-orca demo --reset', 'Empieza desde cero'],
      ['operio-orca demo --stop', 'La detiene']
    ],
    uninstallTitle: 'Desinstalar',
    uninstallBody: 'Quita el panel y su servicio. Agrega --purge para borrar también tu configuración, borradores y registros en ~/.config/operio-orca. Tus asistentes de IA y su trabajo no se tocan.',
    helpTitle: '¿Prefieres no correrlo tú?',
    helpBody: 'Operio opera las rutinas por ti, conectadas a tus herramientas reales y vigiladas para que sigan funcionando.'
  },

  footer: {
    tagline: 'Un tablero para todos tus agentes de IA, en tu propia computadora. Gratis y de código abierto.',
    product: 'ORCA',
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
