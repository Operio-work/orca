// The ORCA comparison: /compare and /es/compare, plus the "ORCA vs" phone cards.
// Every cell matches a source listed on the page, checked on CHECKED. A cell the source
// does not cover says "not listed" or "unclear"; something announced but not shipped says
// "in progress". Re-check Buzz (mobile, push) and Hyperagent before each publish.

export const CHECKED = '2026-11-17';

/**
 * Cell states. `yes`/`no`/`partial`/`progress`/`unclear` draw an icon and a short word;
 * `text` is a plain value (where it runs, setup). `note` adds a qualifier under the word.
 * @typedef {{ en: string, es: string }} L
 * @typedef {{ s: 'yes'|'no'|'partial'|'progress'|'unclear'|'text', note?: L }} Cell
 */

/** @param {string} en @param {string} es @returns {L} */
const l = (en, es) => ({ en, es });
/** @param {Cell['s']} s @param {L} [note] @returns {Cell} */
const c = (s, note) => (note ? { s, note } : { s });

export const TOOLS = [
  {
    id: 'orca',
    name: 'ORCA',
    by: l('by Operio', 'por Operio'),
    sources: [{ label: 'github.com/operio-work/orca', url: 'https://github.com/operio-work/orca' }]
  },
  {
    id: 'herdr',
    name: 'herdr',
    by: l('on its own', 'por sí solo'),
    sources: [
      { label: 'github.com/herdrdev/herdr', url: 'https://github.com/herdrdev/herdr' },
      { label: 'herdr.dev', url: 'https://herdr.dev' }
    ],
    pick: l(
      'Pick herdr on its own if you work at the terminal and want a fast workspace for your agents, with plugins and an API that lets agents start and steer other agents, and you don’t need the phone.',
      'Elige herdr por sí solo si trabajas en la terminal y quieres un espacio rápido para tus agentes, con plugins y una API para que un agente arranque y dirija a otros, y no necesitas el celular.'
    )
  },
  {
    id: 'remote-control',
    name: 'Claude Code Remote Control',
    by: l('Anthropic', 'Anthropic'),
    sources: [
      { label: 'code.claude.com/docs/en/remote-control', url: 'https://code.claude.com/docs/en/remote-control' },
      { label: 'code.claude.com/docs/llms.txt (subagents, agent teams, MCP)', url: 'https://code.claude.com/docs/llms.txt' }
    ],
    pick: l(
      'Pick Claude Code Remote Control if you only use Claude Code and already have a paid Claude plan: the official app gives you alerts and replies with nothing extra to install.',
      'Elige Claude Code Remote Control si solo usas Claude Code y ya tienes un plan de pago de Claude: la app oficial te da avisos y respuestas sin instalar nada más.'
    )
  },
  {
    id: 'buzz',
    name: 'Buzz',
    by: l('Block', 'Block'),
    sources: [
      { label: 'github.com/block/buzz', url: 'https://github.com/block/buzz' },
      { label: 'The New Stack, Buzz (ACP agents, MCP tools)', url: 'https://thenewstack.io/block-buzz-agent-workspace' },
      {
        label: 'TechCrunch, 2026-07-21',
        url: 'https://techcrunch.com/2026/07/21/jack-dorsey-is-taking-on-slack-with-buzz-a-group-chat-platform-for-teams-and-their-ai-agents/'
      }
    ],
    pick: l(
      'Pick Buzz if your team wants to talk with its agents in shared channels, on a relay you host yourself.',
      'Elige Buzz si tu equipo quiere platicar con sus agentes en canales compartidos, en un servidor que tú mismo hospedas.'
    )
  },
  {
    id: 'hyperagent',
    name: 'Hyperagent',
    by: l('hosted service', 'servicio en la nube'),
    sources: [{ label: 'hyperagent.com', url: 'https://hyperagent.com' }, { label: 'Hyperagent 101 (integrations, MCP)', url: 'https://sidsaladi.substack.com/p/hyperagent-101-the-complete-guide' }],
    pick: l(
      'Pick Hyperagent if you want its own agents to take a task in a hosted environment and deliver the result to Slack or your inbox.',
      'Elige Hyperagent si quieres que sus propios agentes tomen una tarea en un entorno en la nube y te entreguen el resultado en Slack o en tu correo.'
    )
  },
  {
    id: 'claude-squad',
    name: 'Claude Squad',
    by: l('open source', 'código abierto'),
    sources: [{ label: 'github.com/smtg-ai/claude-squad', url: 'https://github.com/smtg-ai/claude-squad' }],
    pick: l(
      'Pick Claude Squad if you want several agents in one terminal app, each working in its own git worktree.',
      'Elige Claude Squad si quieres varios agentes en una sola app de terminal, cada uno en su propio git worktree.'
    )
  }
];

export const ORCA_PICK = l(
  'Pick ORCA if your agents run on your own computer and you want one board, a phone alert when one needs you, one-tap answers and scheduled drafts that wait for your OK, free. Or have Operio run it for you.',
  'Elige ORCA si tus agentes corren en tu propia computadora y quieres un solo tablero, un aviso al celular cuando uno te necesita, respuestas con un toque y borradores programados que esperan tu visto bueno, gratis. O deja que Operio lo opere por ti.'
);

/** Rows in display order. `cells` follow TOOLS order. */
export const ROWS = [
  {
    id: 'open',
    label: l('Free and open source', 'Gratis y de código abierto'),
    cells: [
      c('yes', l('MIT', 'MIT')),
      c('yes', l('Apache-2.0', 'Apache-2.0')),
      c('text', l('Paid Claude plan', 'Plan de pago de Claude')),
      c('yes', l('Apache-2.0', 'Apache-2.0')),
      c('text', l('Commercial', 'Comercial')),
      c('yes', l('AGPL-3.0', 'AGPL-3.0'))
    ]
  },
  {
    id: 'where',
    label: l('Where it runs', 'Dónde corre'),
    cells: [
      c('text', l('Your computer, free. Or hosted by Operio', 'Tu computadora, gratis. O en la nube con Operio')),
      c('text', l('Your computer', 'Tu computadora')),
      c('text', l('Your computer, linked through Anthropic', 'Tu computadora, enlazada por Anthropic')),
      c('text', l('A relay you host, plus a desktop app', 'Un servidor que tú hospedas, más una app de escritorio')),
      c('text', l('Hosted, in the cloud', 'En la nube del servicio')),
      c('text', l('Your computer', 'Tu computadora'))
    ]
  },
  {
    id: 'board',
    label: l('Every agent on one board', 'Todos tus agentes en un tablero'),
    cells: [
      c('yes'),
      c('yes', l('In the terminal', 'En la terminal')),
      c('partial', l('Session list', 'Lista de sesiones')),
      c('partial', l('Channels', 'Canales')),
      c('unclear'),
      c('yes', l('In the terminal', 'En la terminal'))
    ]
  },
  {
    id: 'alert',
    label: l('Phone alert when an agent needs you', 'Aviso al celular cuando un agente te necesita'),
    cells: [
      c('yes'),
      c('no'),
      c('yes'),
      c('progress', l('Push notifications', 'Notificaciones push')),
      c('partial', l('Results to Slack or email', 'Resultados a Slack o correo')),
      c('no')
    ]
  },
  {
    id: 'answer',
    label: l('Answer from your phone', 'Responder desde el celular'),
    cells: [
      c('yes', l('One tap', 'Con un toque')),
      c('no'),
      c('yes', l('Official app', 'App oficial')),
      c('progress', l('Mobile apps', 'Apps móviles')),
      c('yes', l('Through Slack', 'Por Slack')),
      c('no')
    ]
  },
  {
    id: 'start',
    label: l('Start an agent from your phone', 'Iniciar un agente desde el celular'),
    cells: [
      c('yes'),
      c('no'),
      c('yes', l('Server mode', 'Modo servidor')),
      c('no'),
      c('yes', l('Through Slack', 'Por Slack')),
      c('no')
    ]
  },
  {
    id: 'schedule',
    label: l('Tasks on a schedule', 'Tareas programadas'),
    cells: [c('yes'), c('no'), c('yes'), c('yes'), c('yes'), c('no')]
  },
  {
    id: 'drafts',
    label: l('Drafts wait for your OK', 'Los borradores esperan tu visto bueno'),
    cells: [
      c('yes'),
      c('no'),
      c('no'),
      c('progress', l('Approval gates', 'Pasos de aprobación')),
      c('no'),
      c('no')
    ]
  },
  {
    id: 'brands',
    label: l('Works with several AI agents', 'Funciona con varios agentes de IA'),
    cells: [
      c('yes', l('Claude Code, Codex, Gemini, opencode, local models and more', 'Claude Code, Codex, Gemini, opencode, modelos locales y más')),
      c('yes'),
      c('text', l('Claude Code only', 'Solo Claude Code')),
      c('yes', l('goose, Codex, Claude Code', 'goose, Codex, Claude Code')),
      c('text', l('Its own agents', 'Sus propios agentes')),
      c('yes')
    ]
  },
  {
    id: 'team',
    label: l('Agents hand work to other agents', 'Un agente le pasa trabajo a otros'),
    cells: [
      c('yes', l('A lead and workers; you approve', 'Un líder y trabajadores; tú apruebas')),
      c('partial', l('Through its API', 'Con su API')),
      c('yes', l('Subagents and agent teams', 'Subagentes y equipos de agentes')),
      c('yes', l('In shared channels', 'En canales compartidos')),
      c('unclear'),
      c('no')
    ]
  },
  {
    id: 'mcp',
    label: l('Connect business tools (MCP)', 'Conectar herramientas del negocio (MCP)'),
    cells: [
      c('yes', l('Per agent; keys never shown again', 'Por agente; las claves no se vuelven a mostrar')),
      c('partial', l('Through each agent', 'A través de cada agente')),
      c('yes'),
      c('yes', l('Tools through MCP', 'Herramientas por MCP')),
      c('yes', l('Connected apps and MCP', 'Apps conectadas y MCP')),
      c('partial', l('Through each agent', 'A través de cada agente'))
    ]
  },
  {
    id: 'setup',
    label: l('Setup', 'Instalación'),
    cells: [
      c('text', l('One line', 'Una línea')),
      c('text', l('One line', 'Una línea')),
      c('text', l('Built in, sign in', 'Ya incluido, inicias sesión')),
      c('text', l('Run a relay, then the app', 'Montas un servidor y luego la app')),
      c('text', l('Sign up', 'Te registras')),
      c('text', l('One line, plus tmux', 'Una línea, más tmux'))
    ]
  }
];

export const copy = {
  en: {
    metaTitle: 'ORCA compared: herdr, Claude Code Remote Control, Buzz, Hyperagent, Claude Squad',
    description:
      'How ORCA compares with herdr on its own, Claude Code Remote Control, Buzz, Hyperagent and Claude Squad: board, phone alerts, answers, schedules and approvals, checked against each product’s own documentation.',
    title: 'How ORCA compares',
    lead: 'Many good tools run AI agents. Here is where ORCA fits, checked against each product’s own documentation on November 9, 2026.',
    herdr: 'ORCA runs on herdr. herdr gives you the terminal workspace; ORCA adds the phone, the alerts, the routines and the approvals.',
    tableCaption: 'ORCA compared with five other tools, checked on 2026-11-17',
    need: 'What you need',
    states: {
      yes: 'Yes',
      no: 'No',
      partial: 'Partial',
      progress: 'In progress',
      unclear: 'Unclear'
    },
    legend: [
      ['yes', 'Yes, per the product’s documentation'],
      ['partial', 'Some of it'],
      ['progress', 'Announced, in progress'],
      ['no', 'Not offered or not listed'],
      ['unclear', 'The sources don’t say']
    ],
    vs: 'vs',
    checked: 'checked',
    source: 'Source',
    sourcesTitle: 'Sources',
    sourcesBody: 'Each claim comes from the product’s own site, repository or documentation. Products change: if something here is out of date,',
    sourcesIssue: 'tell us on GitHub.',
    legendLabel: 'How to read the table',
    checkedCap: 'Checked',
    pickTitle: 'Which one fits',
    choiceTitle: 'Local and free, or hosted and managed',
    choiceBody: 'You choose where ORCA runs.',
    local: {
      title: 'ORCA, on your computer',
      body: 'Free and open source. It runs on your own computer, on Linux, macOS and Windows (WSL2), and works while that computer is on.',
      cta: 'Install free'
    },
    managed: {
      title: 'ORCA Managed by Operio',
      body: 'Want it always on, without your computer? Operio runs it for you in the cloud, set up with you and watched so it keeps working. Your team signs in with roles and talks to the agents in a team chat.',
      cta: 'Have Operio run it for you'
    }
  },
  es: {
    metaTitle: 'ORCA comparado: herdr, Claude Code Remote Control, Buzz, Hyperagent, Claude Squad',
    description:
      'Cómo se compara ORCA con herdr por sí solo, Claude Code Remote Control, Buzz, Hyperagent y Claude Squad: tablero, avisos al celular, respuestas, tareas programadas y aprobaciones, revisado contra la documentación de cada producto.',
    title: 'Cómo se compara ORCA',
    lead: 'Hay muchas buenas herramientas para trabajar con agentes de IA. Aquí ves dónde encaja ORCA, revisado contra la documentación de cada producto el 9 de noviembre de 2026.',
    herdr: 'ORCA funciona sobre herdr. herdr te da el espacio de trabajo en la terminal; ORCA le suma el celular, los avisos, las rutinas y las aprobaciones.',
    tableCaption: 'ORCA comparado con otras cinco herramientas, revisado el 2026-11-17',
    need: 'Lo que necesitas',
    states: {
      yes: 'Sí',
      no: 'No',
      partial: 'Parcial',
      progress: 'En desarrollo',
      unclear: 'No está claro'
    },
    legend: [
      ['yes', 'Sí, según la documentación del producto'],
      ['partial', 'Una parte'],
      ['progress', 'Anunciado, en desarrollo'],
      ['no', 'No se ofrece o no aparece'],
      ['unclear', 'Las fuentes no lo dicen']
    ],
    vs: 'vs',
    checked: 'revisado el',
    source: 'Fuente',
    sourcesTitle: 'Fuentes',
    sourcesBody: 'Cada dato viene del sitio, el repositorio o la documentación del propio producto. Los productos cambian: si algo ya no está al día,',
    sourcesIssue: 'avísanos en GitHub.',
    legendLabel: 'Cómo leer la tabla',
    checkedCap: 'Revisado el',
    pickTitle: 'Cuál te conviene',
    choiceTitle: 'Local y gratis, o en la nube y gestionado',
    choiceBody: 'Tú eliges dónde corre ORCA.',
    local: {
      title: 'ORCA, en tu computadora',
      body: 'Gratis y de código abierto. Corre en tu propia computadora, con Linux, macOS y Windows (WSL2), y trabaja mientras esa computadora está prendida.',
      cta: 'Instala gratis'
    },
    managed: {
      title: 'ORCA Gestionado por Operio',
      body: '¿Lo quieres siempre prendido, sin tu computadora? Operio lo opera por ti en la nube, configurado contigo y vigilado para que siga funcionando. Tu equipo entra con roles y les habla a los agentes en un chat de equipo.',
      cta: 'Que Operio lo opere por ti'
    }
  }
};
