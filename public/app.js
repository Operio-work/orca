'use strict';

// ORCA by Operio — the workspace drawn as a live map (or as the 8-bit office, office.js, or the islands, island.js). Every tab is a block, every pane a
// tile at its real position and size, painted by status. Selecting a tile opens the
// sheet (bottom on phones, side panel on desktop) to read, answer and reply.
// Nodes are kept and updated in place, so typing is never wiped by the 3 s refresh.

const POLL_MS = 3000;
const $ = sel => document.querySelector(sel);
const enc = encodeURIComponent;
const mapEl = $('#map');
const sheet = $('#sheet');
const scrim = $('#scrim'); // desktop: blurred workspace behind the agent window; a click on it closes

// ─── i18n (EN / ES) ───────────────────────────────────────────────────────────
const T = {
  en: {
    journal: 'Journal — activity and daily review', journalN: 'Journal — {0} days to review',
    stop: 'Stop', stopHint: 'interrupts the job, the agent stays', stopped: '{0} stopped', stopExited: '{0} stopped — and exited', stopStill: '{0} is still working — try Esc or ⌃C',
    endAgent: 'End agent', endTitle: 'End {0}?', endConfirm: 'End agent', ending: 'Ending…', endChecking: 'Checking what it would lose…',
    endHint: 'It is asked to quit, then its pane closes. Its last output is saved in the Journal. Its folder, files and worktree are not touched.',
    endWorking: 'It is working right now — the job stops halfway.', endBlocked: 'It is waiting for an answer.',
    endDirty: '{0} changed files not committed in its folder (they stay there).', endWorktree: 'Worktree {0} stays — remove it later with git worktree remove.',
    endLinked: 'Linked with {0}: the links are removed and they get a note.', endLastWs: 'It is the last pane of {0}, so that workspace closes too.',
    endHolder: '{0} is on it — they get an alert.', endMem: 'Frees about {0} of memory.', endRan: 'Running for {0}.', endNothing: 'Nothing else is lost.',
    endedClean: '{0} ended', endedForced: '{0} ended — it did not quit by itself, its pane was closed', e_end_failed: 'It could not be ended. Check the desktop.', e_not_final: 'Today is not over yet — review it tomorrow.',
    histTitle: 'History', histEmpty: 'Nothing recorded for this agent yet.', histOpen: 'Open in the Journal', histN: '{0} in 7 days',
    chatTeam: 'Team chat', chatAgent: 'Chat about this agent', chatTeamTitle: 'Team', chatRoomSub: 'Everyone on this ORCA',
    chatAgentSub: 'Comments on {0}', chatOpenAgent: 'Open agent', chatPlaceholder: 'Write — @ a person or an agent',
    chatEmptyRoom: 'No messages yet. Say hi to the team.', chatEmptyAgent: 'No comments on this agent yet.',
    chatEnded: 'This agent has ended. Its thread is read-only.', chatDelete: 'Delete', chatDeleted: 'message deleted',
    chatYou: 'you', chatYesterday: 'yesterday', chatShort: '{0} chat', tChat: '{0} unread comments', chatMentioned: '{0} mentioned you',
    chatFollowOn: 'Alerts on — tap to mute this thread', chatFollowOff: 'Alerts off — tap to get alerts for this thread', chatRoomOn: 'Alerts on for every team message — tap to turn off', chatRoomOff: 'Room alerts off (mentions still alert you) — tap to turn on', chatNowOn: 'You’ll get alerts for this thread', chatNowOff: 'Alerts off for this thread — mentions still reach you', chatNeedBell: 'Turn on alerts first: the bell at the top.',
    chatPickAgent: 'agent — gets your message as work',
    chatAskQueued: 'Waiting — {0} is busy', chatAskQueuedN: 'Waiting — {0} is busy ({1} ahead)', chatAskSent: 'Sent to {0} — working…', chatAskDone: '{0} answered',
    chatAsk_gone: '{0} ended before answering', chatAsk_expired: 'Not sent — {0} stayed busy for 2 hours', chatAsk_no_answer: '{0} gave no text answer — see its output', chatAsk_send_failed: 'Could not send to {0}',
    chatAskNo_no_access: 'You can’t send work to {0}.', chatAskNo_limit_person: 'Not sent to {0}: 5 agent requests an hour each.', chatAskNo_limit_agent: 'Not sent: {0} already got 5 requests this hour.', chatAskNo_queue_full: 'Not sent: {0} already has 5 waiting.',
    chatTranslate: 'Translate', chatTranslating: 'Translating…', chatTranslated: 'Translated from {0}', chatShowOriginal: 'Show original', chatShowTranslation: 'Show translation', chatTrFailed: 'Translation failed — try again', chatTrKey: 'Translation needs a working Anthropic API key (Model access)',
    chatAutoTr: 'Auto-translate', chatAutoTrOn: 'Messages in other languages are translated into English', chatAutoTrOff: 'Translate messages in other languages automatically', langName_en: 'English', langName_es: 'Spanish',
    chatAnswerTook: 'answered in {0}', chatSeeOutput: 'See full output', chatNoText: 'Finished without a text reply.', chatAgentTag: 'agent', chatA2aTo: '→ {0}', chatA2aHand: '→ {0} · hand-off',
    e_slow_down: 'Too many messages — wait a moment.', e_too_long: 'Too long — 2,000 characters at most.', e_too_late: 'Messages can be deleted only in the first 5 minutes.', e_ended: 'This agent has ended.',
    byOperio: 'by Operio', new: 'New', save: 'Save', close: 'Close', send: 'Send', focus: 'Show on desktop', clear: 'Clear name',
    needsYou: 'Needs you — answer with a key',
    placeholder: 'name this agent', unnamed: 'unnamed', shell: 'shell',
    kindClaude: 'Claude', kindShell: 'Shell', kindHermes: 'Hermes', kindOpencode: 'opencode', kindAgy: 'Antigravity', kindCodex: 'Codex',
    openShell: 'Open shell', newShell: 'New shell', shellTile: 'shell', lockNow: 'Lock', termFoot: 'Mirrors the pane — keys you type go straight to the shell.', termOpen: 'Open terminal', 
    
    e_shell_locked: 'Confirm opening a shell first.', e_confirm_needed: 'Confirm opening a shell first.', e_not_ready: 'That draft isn’t ready to approve.', e_bad_schedule: 'That schedule isn’t a valid cron line (5 fields).', shellConfirmTitle: 'Open a real shell?', shellConfirmSub: 'A shell types straight into this computer as you. Anyone who can reach this page can use it. Shells stay open for {0} min after you confirm.', shellConfirmGo: 'Open shell', shellConfirmed: 'Shells open for {0} min', 
    memTitle: 'Memory', memAgents: 'Agents {0}', memMachine: 'Machine {0} / {1}', memSwap: 'Swap {0} / {1}', memProcs: '{0} processes', memSwapped: '+{0} swapped', memNone: 'not measured', memEmpty: 'No agents running', memOpen: 'Open {0}',
    linksTitle: 'Links', relWaitsOn: 'Depends on', relFeeds: 'Feeds', relTalk: 'Talks with', linkAdd: 'Link', linkRemove: 'Remove link with {0}', linkPick: 'Pick an agent', linkNone: 'No links yet', linkAdded: 'Linked with {0}', linkRemoved: 'Link removed', linksN: '{0} linked',
    linkHint: 'Linked agents can message each other (orca-send). When an agent it depends on finishes, you approve the hand-off — nothing is sent without you.',
    handTitle: '{0} finished', handTo: 'Hand its result to {0}?', handNote: 'Note for {0} (optional)', handSend: 'Send to {0}', handDismiss: 'Not now', handSent: 'Handed to {0}', handQueued: 'Queued for {0} — it gets it when idle', handBadge: 'Hand-off', tHand: 'hand off', tWaits: 'waits on {0}', tMsgs: '{0} messages in 24h',
    msgsTitle: 'Messages', msgNone: 'No messages yet', msgIntro: 'ORCA note', msgHandoff: 'Hand-off', msgQueued: 'queued', msgFailed: 'not delivered', tTalk: '{0} ↔ {1} · {2} messages in 24h · last {3} ago', tTalkQueued: ' · {0} waiting', tTalkOpen: 'Open the messages',
    e_link_exists: 'Those two are already linked that way.', e_link_cycle: 'That would make them wait on each other.', e_link_self: 'Pick another agent.',
    memHint: 'RAM each agent uses, counting everything it started (tools, MCP servers, dev servers). Shared memory is split fairly, so the rows add up to the agents total. Updates every 15 s.',
    replyPlaceholder: 'Message this agent…', suggest: 'Name it “{0}”',
    st_working: 'working', st_idle: 'idle', st_blocked: 'needs you', st_done: 'done', st_unknown: 'starting',
    c_blocked: 'needs you', c_working: 'working', c_idle: 'idle', all: 'All', unnamedOnly: 'Unnamed', mineOnly: 'Mine', claimBtn: 'Claim', claimYou: 'You', claimRelease: 'Release', claimTake: 'Take over', claimTakeSure: 'Take from {0}?', claimTip: '{0} is on it (since {1} ago). Anyone can still act on it.', claimFree: 'Nobody is on it — tap to claim it', claimMine: 'You are on it — tap to release', claimedToast: 'You’re on {0}', releasedToast: 'Released {0}', takenToast: '{1} took over {0}', claimedBy: 'with {0}', claimMe: 'Claim it (me)', claimTakeMe: 'Take it over (me)', assignTo: 'Assign to {0}', assignTeam: 'Assign to {0} (everyone)', teamAssigned: '{1} made {0} an {2} task — it’s with everyone', assignedToast: '{0} is now with {1}', assignedYou: '{1} assigned you {0}', reassigned: '{2} gave {0} to {1}',
    tab: 'Tab {0}', none: 'No agents in the workspace yet. Start one with New.',
    offline: 'Can’t reach ORCA — retrying…', focused: '{0} is now in front on the desktop', saved: 'Named {0}',
    cleared: 'Name cleared', empty: '(no output yet)', sent: 'Sent to {0}', keySent: '{0} sent',
    armCtrlC: 'Tap ⌃C again to stop {0}', addTag: '+ tag', tagPrompt: 'tag, tag', removeTag: 'Remove tag {0}',
    newTitle: 'Start a new agent', name: 'Name', kind: 'Agent', folder: 'Folder', where: 'Where',
    rnTitle: 'Rename', rnWs: 'Workspace', rnTab: 'Tab', rnSave: 'Save', rnSaving: 'Saving…', rnHint: 'Changes the names on the desktop too.', rnFor: 'Rename {0}', rnDone: 'Renamed to {0}', e_not_admin: 'Only an admin can rename workspaces and tabs.',
    orderSaved: 'Map order saved', orderTip: 'Drag to reorder the map',
    dndHint: 'Drop on a card to place it beside it, on a tab to add it there, or:', dndNewTab: 'New tab in {0}', dndNewWs: 'New workspace', dndSwap: 'Swap', dndRight: 'Right', dndBelow: 'Below', dndInto: 'Add here', dndSwapped: '{0} swapped with {1}',
    namePh: 'e.g. invoices', loadingOut: 'Reading the conversation…', modelDefault: 'Default', modelDefaultHint: 'its usual model',
    kd_claude: 'Anthropic · Claude Code', kd_hermes: 'Hermes Agent', kd_opencode: 'Open source · any model', kd_agy: 'Google · Antigravity', kd_codex: 'OpenAI · Codex CLI', kd_shell: 'Plain terminal',
    md_fable: 'frontier', md_opus: 'deep work', md_sonnet: 'balanced', md_haiku: 'fastest',
    pk_kind: 'Agent', pk_model: 'Model', pk_folder: 'Folder', pk_place: 'Place', pk_task: 'Task', pk_last: 'Last reply', pk_jobs: 'Jobs (24 h)', pk_ctx: 'Context', pk_with: 'With', pk_open: 'Click to open · drag to move', pk_openScene: 'Click to open', pk_shell: 'Shell pane — click to open, drag to move',
    newTab: 'New tab', inTab: 'Split into {0}', newHint: 'Opens a pane in the workspace and starts the agent there. Takes up to a minute.',
    cancel: 'Cancel', start: 'Start', starting: 'Starting…', started: 'Started {0}',
    startedBlocked: 'Started {0} — it’s asking something first. Answer it in the panel.',
    alerts: 'Phone alerts', alertsOn: 'Alerts on — a test alert is on its way', alertsOff: 'Alerts off on this device',
    alertsNeedHttps: 'Alerts need the installed app over HTTPS (for example through tailscale serve).', alertsDenied: 'Notifications are blocked for this site in the browser settings.',
    llmKeys: 'LLM keys', llmTitle: 'LLM keys', llmIntro: 'API keys your agents use, kept in {0} (owner-only) and loaded into herdr. Signed in with a subscription? Nothing to add here: log in inside the agent’s own terminal.',
    llmNone: 'No keys set', llmName: 'Name', llmValue: 'Value', llmAdd: 'Add key', llmRemove: 'Remove', llmRemoveOf: 'Remove {0}', llmSaved: 'Saved {0} — press Apply so agents get it', llmRemoved: 'Removed {0}',
    llmApply: 'Apply', llmApplying: 'Applying…', llmApplyHint: 'Apply restarts herdr so running agents get the keys. It closes every agent pane, so it waits until none is working or asking you.',
    llmApplied: 'herdr restarted — agents started from now on see the keys', llmNotRunning: 'herdr is not running; the keys load when it starts', llmNotManaged: 'herdr was not started by ORCA, so it was not restarted — restart it yourself (herdr server stop, then operio-orca start)',
    llmBusy: 'Not now: {0} still working or waiting on you. Apply when they are idle.', llmDemo: 'Not available in the demo.',
    e_llm_bad_name: 'Name: upper case letters, digits and _, starting with a letter (ANTHROPIC_API_KEY).', e_llm_empty: 'Paste the key first.', e_llm_bad_value: 'That value has a character that cannot go in llm.env (no spaces or quotes; one line).',
    e_demo: 'Not available in the demo.', e_apply_failed: 'The restart did not finish. Check: operio-orca logs herdr',
    themeToggle: 'Light / dark', agentsIn: '{0} agents', paneOf: 'pane {0}',
    details: 'Details', asks: 'Asks: {0}', shellTabs: '{0} shell tabs, no agent',
    k_enter: 'Enter', k_esc: 'Esc', 'k_ctrl+c': 'Ctrl C', k_up: 'Up', k_down: 'Down', k_tab: 'Tab',
    e_blocked: 'It’s waiting on a question — answer it with a key first.',
    modelTitle: 'Model', modelSet: '{0} now runs on {1}', modelWait: 'You can switch once it stops working.', modelAsk: 'Answer its question first, then switch.', modelUnknown: 'Not set from here yet — it runs on its starting model.',
    e_busy: 'It’s working — switch the model when it stops.', e_no_models: 'This kind of agent can’t switch models from here.',
    e_gone: 'That agent is gone — the map will catch up in a moment.',
    e_question_gone: 'The question changed on screen — nothing was sent. Look again.',
    e_claimed_by_other: 'Someone else is on it — use Take over.',
    e_not_asking: 'It isn’t asking anymore — nothing was sent.',
    ansOther: 'Other…', ansOtherPh: 'Type your answer', ansSend: 'Send', ansNext: 'Next', ansKeys: 'Keys', ansSure: 'Sure? {0}', ansSent: 'Answer sent', ansOf: '{0} of {1}', ansMulti: 'Pick one or more', ansBack: 'Back',
    e_tab_gone: 'That tab was closed. Pick another place.',
    e_stalled: 'The agent didn’t start on it. Check the output and try again.',
    e_timeout: 'The workspace took too long to answer. Try again.',
    e_workspace: 'The workspace refused that. Check the output, then try again.',
    e_unreachable: 'Can’t reach the workspace on the desktop. Is it running?',
    e_start_failed: 'The new pane didn’t open. Try again, or pick another tab.',
    e_folder_outside: 'Pick a folder inside your home folder.',
    e_folder_missing: 'That folder doesn’t exist. Check the path.',
    e_not_folder: 'That path is a file, not a folder.',
    e_bad_kind: 'Pick an agent from the list.',
    e_bad_name: 'Names: 1–40 letters, numbers, spaces or . _ : -',
    e_bad_agent_name: 'Agent names: start with a lowercase letter, then lowercase letters, digits, - or _ (32 max).',
    crewTitle: 'Name it', crewMore: 'Crew', pin: 'Pin {0} to the crew', unpin: 'Unpin {0}', hideName: 'Remove {0} from the list',
    taken: '{0} is already in use', nameAsk: 'name?', crewKey: 'Press {0} for {1}', pinned: '{0} pinned', unpinned: '{0} unpinned', hidden: '{0} removed from the list',
    tagSaved: 'Saved tags', tagNoneYet: 'No saved tags yet — type one and press Enter', tagNoMatch: 'No saved tag matches', tagNew: '+ new “{0}”', tagForget: 'Forget tag {0} (not on any agent)', tagForgotten: 'Forgot {0}', tagDone: 'Done', tagMax: 'Up to 6 tags per agent', tagUsedBy: 'on {0} agents', e_tag_in_use: 'That tag is still on an agent.',
    e_bad_tags: 'Tags: up to 6, letters, numbers, _ or -, 20 characters each.',
    e_empty: 'Type a message first.', e_too_long: 'That message is too long (4,000 characters max).',
    e_generic: 'Something went wrong. Try again.',
    ws: 'Workspace {0}', move: 'Move', moveTitle: 'Move {0}', moveTo: 'To', moveNewTab: 'New tab',
    moveBeside: 'Beside {0}', moveNewWs: 'New workspace', wsName: 'Workspace name', moving: 'Moving…', moved: '{0} moved to {1}',
    moveHint: 'The agent keeps running — only its place on the desktop changes.',
    moveLast: 'This is the last pane in {0}, so {0} closes after the move.',
    e_same_place: 'It’s already there. Pick another place.',
    e_ws_gone: 'That workspace was closed. Pick another place.',
    e_move_failed: 'The move didn’t finish. Check the desktop and try again.',
    officeView: 'Office view (8-bit)', kNew: 'new', kNeeds: 'needs you', kNext: 'next', kPrev: 'previous', kShow: 'show on desktop', kReply: 'reply', kRename: 'rename', kMap: 'map', kOffice: 'office', kIslands: 'islands', kHolo: '3D', holoView: 'Holo table (3D)', zoom: 'Zoom', zoomed: 'Zoomed!', kZoom: 'zoom on desktop', zoomKey: 'Show on desktop, zoomed (Z)', zoomedToast: '{0} is in front, zoomed', ctxWord: 'context', ctxLabel: 'Context used: {0}%{1}', recapLabel: 'Recap', recapNext: 'Next', rdReader: 'Reader', rdTerm: 'Terminal', rdYou: 'You', rdSteps: '{0} steps', rdCopied: 'Copied {0}', freshTag: 'New', freshAria: 'just finished', finHead: '{0} finished', finTook: 'took {0}', finOpen: 'Open', finDismiss: 'Dismiss', finAll: 'Dismiss all', termLight: 'Terminal: light', termDark: 'Terminal: dark', queueLabel: 'Agents by priority: needs you, finished, working, idle', jobsTitle: 'Latest jobs', jobsN: '{0} done in 24h', jobNow: 'Working now', jobAgo: '{0} ago', jobTook: 'took {0}', jobsTile: '{0} jobs done in 24h', jobAsked: 'You asked', kOpen: 'open (3D)', kSound: 'sound', soundOn: 'Sound on', soundOff: 'Sound off', sounds: 'Sounds', kHide: 'hide keys', kClose: 'close', showKeys: 'Keys', nobodyNeeds: 'Nobody needs you right now', views: 'View', mapView: 'Map', islandView: 'Islands (90s sim)', show: 'Show', shown: 'On screen!', focusKey: 'Show on desktop (D)', more: 'More: links, history, name, tags, move',
  },
  es: {
    journal: 'Bitácora — actividad y revisión diaria', journalN: 'Bitácora — {0} días por revisar',
    stop: 'Detener', stopHint: 'interrumpe el trabajo, el agente sigue', stopped: '{0} detenido', stopExited: '{0} detenido — y se cerró', stopStill: '{0} sigue trabajando — prueba Esc o ⌃C',
    endAgent: 'Terminar agente', endTitle: '¿Terminar {0}?', endConfirm: 'Terminar agente', ending: 'Terminando…', endChecking: 'Revisando qué se perdería…',
    endHint: 'Se le pide que salga y luego se cierra su panel. Su última salida queda guardada en la Bitácora. Su carpeta, archivos y worktree no se tocan.',
    endWorking: 'Está trabajando ahora — el trabajo se corta a la mitad.', endBlocked: 'Está esperando una respuesta.',
    endDirty: '{0} archivos cambiados sin commit en su carpeta (se quedan ahí).', endWorktree: 'El worktree {0} se queda — quítalo después con git worktree remove.',
    endLinked: 'Enlazado con {0}: se quitan los enlaces y reciben un aviso.', endLastWs: 'Es el último panel de {0}, así que ese espacio también se cierra.',
    endHolder: '{0} lo tiene — recibirá una alerta.', endMem: 'Libera cerca de {0} de memoria.', endRan: 'Lleva {0} corriendo.', endNothing: 'No se pierde nada más.',
    endedClean: '{0} terminado', endedForced: '{0} terminado — no salió solo, se cerró su panel', e_end_failed: 'No se pudo terminar. Revisa el escritorio.', e_not_final: 'El día aún no termina — revísalo mañana.',
    histTitle: 'Historial', histEmpty: 'Aún no hay nada registrado de este agente.', histOpen: 'Abrir en la Bitácora', histN: '{0} en 7 días',
    chatTeam: 'Chat del equipo', chatAgent: 'Chat sobre este agente', chatTeamTitle: 'Equipo', chatRoomSub: 'Todos en este ORCA',
    chatAgentSub: 'Comentarios sobre {0}', chatOpenAgent: 'Abrir agente', chatPlaceholder: 'Escribe — @ persona o agente',
    chatEmptyRoom: 'Aún no hay mensajes. Saluda al equipo.', chatEmptyAgent: 'Aún no hay comentarios sobre este agente.',
    chatEnded: 'Este agente terminó. Su conversación es solo de lectura.', chatDelete: 'Borrar', chatDeleted: 'mensaje borrado',
    chatYou: 'tú', chatYesterday: 'ayer', chatShort: '{0} chat', tChat: '{0} comentarios sin leer', chatMentioned: '{0} te mencionó',
    chatFollowOn: 'Alertas activas — toca para silenciar esta conversación', chatFollowOff: 'Alertas apagadas — toca para recibir alertas de esta conversación', chatRoomOn: 'Alertas de cada mensaje del equipo — toca para apagarlas', chatRoomOff: 'Alertas del equipo apagadas (las menciones sí te avisan) — toca para activarlas', chatNowOn: 'Recibirás alertas de esta conversación', chatNowOff: 'Alertas apagadas en esta conversación — las menciones sí te llegan', chatNeedBell: 'Primero activa las alertas: la campana de arriba.',
    chatPickAgent: 'agente — recibe tu mensaje como trabajo',
    chatAskQueued: 'En espera — {0} está ocupado', chatAskQueuedN: 'En espera — {0} está ocupado ({1} antes)', chatAskSent: 'Enviado a {0} — trabajando…', chatAskDone: '{0} respondió',
    chatAsk_gone: '{0} terminó antes de responder', chatAsk_expired: 'No enviado — {0} estuvo ocupado 2 horas', chatAsk_no_answer: '{0} no dejó respuesta en texto — mira su salida', chatAsk_send_failed: 'No se pudo enviar a {0}',
    chatAskNo_no_access: 'No puedes enviar trabajo a {0}.', chatAskNo_limit_person: 'No enviado a {0}: máximo 5 pedidos a agentes por hora.', chatAskNo_limit_agent: 'No enviado: {0} ya recibió 5 pedidos esta hora.', chatAskNo_queue_full: 'No enviado: {0} ya tiene 5 en espera.',
    chatTranslate: 'Traducir', chatTranslating: 'Traduciendo…', chatTranslated: 'Traducido del {0}', chatShowOriginal: 'Ver original', chatShowTranslation: 'Ver traducción', chatTrFailed: 'No se pudo traducir — inténtalo de nuevo', chatTrKey: 'Para traducir hace falta una clave de API de Anthropic válida (Acceso al modelo)',
    chatAutoTr: 'Traducir todo', chatAutoTrOn: 'Los mensajes en otros idiomas se traducen al español', chatAutoTrOff: 'Traducir automáticamente los mensajes en otros idiomas', langName_en: 'inglés', langName_es: 'español',
    chatAnswerTook: 'respondió en {0}', chatSeeOutput: 'Ver salida completa', chatNoText: 'Terminó sin respuesta en texto.', chatAgentTag: 'agente', chatA2aTo: '→ {0}', chatA2aHand: '→ {0} · relevo',
    e_slow_down: 'Demasiados mensajes — espera un momento.', e_too_long: 'Demasiado largo — máximo 2.000 caracteres.', e_too_late: 'Solo puedes borrar un mensaje en los primeros 5 minutos.', e_ended: 'Este agente terminó.',
    byOperio: 'por Operio', new: 'Nuevo', save: 'Guardar', close: 'Cerrar', send: 'Enviar', focus: 'Mostrar en el escritorio', clear: 'Quitar nombre',
    needsYou: 'Te necesita — responde con una tecla',
    placeholder: 'nombra este agente', unnamed: 'sin nombre', shell: 'terminal',
    kindClaude: 'Claude', kindShell: 'Terminal', kindHermes: 'Hermes', kindOpencode: 'opencode', kindAgy: 'Antigravity', kindCodex: 'Codex',
    openShell: 'Abrir terminal', newShell: 'Nueva terminal', shellTile: 'terminal', lockNow: 'Bloquear', termFoot: 'Refleja el panel — lo que escribes va directo a la terminal.', termOpen: 'Abrir terminal', 
    
    e_shell_locked: 'Primero confirma que quieres abrir una terminal.', e_confirm_needed: 'Primero confirma que quieres abrir una terminal.', e_not_ready: 'Ese borrador aún no está listo para aprobar.', e_bad_schedule: 'Ese horario no es una línea cron válida (5 campos).', shellConfirmTitle: '¿Abrir una terminal real?', shellConfirmSub: 'Una terminal escribe directo en esta computadora con tu usuario. Cualquiera que llegue a esta página puede usarla. Las terminales quedan abiertas {0} min después de confirmar.', shellConfirmGo: 'Abrir terminal', shellConfirmed: 'Terminales abiertas por {0} min', 
    memTitle: 'Memoria', memAgents: 'Agentes {0}', memMachine: 'Equipo {0} / {1}', memSwap: 'Swap {0} / {1}', memProcs: '{0} procesos', memSwapped: '+{0} en swap', memNone: 'sin medir', memEmpty: 'No hay agentes', memOpen: 'Abrir {0}',
    linksTitle: 'Enlaces', relWaitsOn: 'Depende de', relFeeds: 'Alimenta a', relTalk: 'Habla con', linkAdd: 'Enlazar', linkRemove: 'Quitar enlace con {0}', linkPick: 'Elige un agente', linkNone: 'Sin enlaces', linkAdded: 'Enlazado con {0}', linkRemoved: 'Enlace quitado', linksN: '{0} enlazados',
    linkHint: 'Los agentes enlazados pueden escribirse (orca-send). Cuando termina un agente del que depende, tú apruebas el relevo — nada se envía sin ti.',
    handTitle: '{0} terminó', handTo: '¿Pasar su resultado a {0}?', handNote: 'Nota para {0} (opcional)', handSend: 'Enviar a {0}', handDismiss: 'Ahora no', handSent: 'Pasado a {0}', handQueued: 'En cola para {0} — lo recibe al quedar libre', handBadge: 'Relevo', tHand: 'relevo', tWaits: 'espera a {0}', tMsgs: '{0} mensajes en 24 h',
    msgsTitle: 'Mensajes', msgNone: 'Sin mensajes', msgIntro: 'Nota de ORCA', msgHandoff: 'Relevo', msgQueued: 'en cola', msgFailed: 'no entregado', tTalk: '{0} ↔ {1} · {2} mensajes en 24 h · último hace {3}', tTalkQueued: ' · {0} en espera', tTalkOpen: 'Abrir los mensajes',
    e_link_exists: 'Esos dos ya están enlazados así.', e_link_cycle: 'Así se esperarían el uno al otro.', e_link_self: 'Elige otro agente.',
    memHint: 'RAM que usa cada agente, contando todo lo que inició (herramientas, servidores MCP, servidores de desarrollo). La memoria compartida se reparte, así que las filas suman el total de agentes. Se actualiza cada 15 s.',
    replyPlaceholder: 'Mensaje para este agente…', suggest: 'Nombrar “{0}”',
    st_working: 'trabajando', st_idle: 'inactivo', st_blocked: 'te necesita', st_done: 'terminado', st_unknown: 'iniciando',
    c_blocked: 'te necesitan', c_working: 'trabajando', c_idle: 'inactivos', all: 'Todos', unnamedOnly: 'Sin nombre', mineOnly: 'Míos', claimBtn: 'Tomar', claimYou: 'Tú', claimRelease: 'Soltar', claimTake: 'Tomar control', claimTakeSure: '¿Quitárselo a {0}?', claimTip: '{0} está en esto (desde hace {1}). Cualquiera puede actuar igual.', claimFree: 'Nadie lo lleva — toca para tomarlo', claimMine: 'Lo llevas tú — toca para soltarlo', claimedToast: 'Llevas {0}', releasedToast: 'Soltaste {0}', takenToast: '{1} tomó {0}', claimedBy: 'con {0}', claimMe: 'Tomarlo (yo)', claimTakeMe: 'Quitárselo (yo)', assignTo: 'Asignar a {0}', assignTeam: 'Asignar a {0} (todos)', teamAssigned: '{1} hizo de {0} una tarea de {2} — la llevan todos', assignedToast: '{0} ahora lo lleva {1}', assignedYou: '{1} te asignó {0}', reassigned: '{2} le dio {0} a {1}',
    tab: 'Pestaña {0}', none: 'Aún no hay agentes en el espacio de trabajo. Inicia uno con Nuevo.',
    offline: 'No se puede contactar ORCA — reintentando…', focused: '{0} está al frente en el escritorio', saved: 'Nombrado {0}',
    cleared: 'Nombre quitado', empty: '(aún sin salida)', sent: 'Enviado a {0}', keySent: '{0} enviado',
    armCtrlC: 'Toca ⌃C otra vez para detener {0}', addTag: '+ etiqueta', tagPrompt: 'etiqueta, etiqueta', removeTag: 'Quitar etiqueta {0}',
    newTitle: 'Iniciar un agente', name: 'Nombre', kind: 'Agente', folder: 'Carpeta', where: 'Dónde',
    rnTitle: 'Renombrar', rnWs: 'Espacio de trabajo', rnTab: 'Pestaña', rnSave: 'Guardar', rnSaving: 'Guardando…', rnHint: 'También cambia los nombres en el escritorio.', rnFor: 'Renombrar {0}', rnDone: 'Renombrado a {0}', e_not_admin: 'Solo un administrador puede renombrar espacios y pestañas.',
    orderSaved: 'Orden del mapa guardado', orderTip: 'Arrastra para reordenar el mapa',
    dndHint: 'Suéltalo sobre una tarjeta para ponerlo al lado, sobre una pestaña para añadirlo ahí, o:', dndNewTab: 'Pestaña nueva en {0}', dndNewWs: 'Espacio de trabajo nuevo', dndSwap: 'Intercambiar', dndRight: 'Derecha', dndBelow: 'Abajo', dndInto: 'Añadir aquí', dndSwapped: '{0} intercambiado con {1}',
    namePh: 'p. ej. facturas', loadingOut: 'Leyendo la conversación…', modelDefault: 'Predeterminado', modelDefaultHint: 'su modelo habitual',
    kd_claude: 'Anthropic · Claude Code', kd_hermes: 'Hermes Agent', kd_opencode: 'Código abierto · cualquier modelo', kd_agy: 'Google · Antigravity', kd_codex: 'OpenAI · Codex CLI', kd_shell: 'Terminal simple',
    md_fable: 'frontera', md_opus: 'trabajo profundo', md_sonnet: 'equilibrado', md_haiku: 'el más rápido',
    pk_kind: 'Agente', pk_model: 'Modelo', pk_folder: 'Carpeta', pk_place: 'Lugar', pk_task: 'Tarea', pk_last: 'Última respuesta', pk_jobs: 'Trabajos (24 h)', pk_ctx: 'Contexto', pk_with: 'Con', pk_open: 'Clic para abrir · arrastra para mover', pk_openScene: 'Clic para abrir', pk_shell: 'Terminal — clic para abrir, arrastra para mover',
    newTab: 'Pestaña nueva', inTab: 'Dividir en {0}', newHint: 'Abre un panel en el espacio de trabajo e inicia el agente ahí. Tarda hasta un minuto.',
    cancel: 'Cancelar', start: 'Iniciar', starting: 'Iniciando…', started: 'Iniciado {0}',
    startedBlocked: 'Iniciado {0} — primero pregunta algo. Contéstale en el panel.',
    alerts: 'Alertas al teléfono', alertsOn: 'Alertas activas — va una alerta de prueba', alertsOff: 'Alertas desactivadas en este dispositivo',
    alertsNeedHttps: 'Las alertas requieren la app instalada por HTTPS (por ejemplo con tailscale serve).', alertsDenied: 'Las notificaciones están bloqueadas para este sitio en el navegador.',
    llmKeys: 'Claves LLM', llmTitle: 'Claves LLM', llmIntro: 'Claves de API que usan tus agentes, guardadas en {0} (solo tu usuario) y cargadas en herdr. ¿Entras con suscripción? No hay nada que agregar aquí: inicia sesión en la terminal del propio agente.',
    llmNone: 'Sin claves', llmName: 'Nombre', llmValue: 'Valor', llmAdd: 'Agregar clave', llmRemove: 'Quitar', llmRemoveOf: 'Quitar {0}', llmSaved: 'Guardada {0} — pulsa Aplicar para que los agentes la reciban', llmRemoved: 'Quitada {0}',
    llmApply: 'Aplicar', llmApplying: 'Aplicando…', llmApplyHint: 'Aplicar reinicia herdr para que los agentes en marcha reciban las claves. Cierra todos los paneles de agentes, así que espera a que ninguno esté trabajando o preguntándote.',
    llmApplied: 'herdr reiniciado — los agentes que inicies desde ahora ven las claves', llmNotRunning: 'herdr no está corriendo; las claves se cargan cuando arranque', llmNotManaged: 'ORCA no inició herdr, así que no lo reinició — reinícialo tú (herdr server stop y luego operio-orca start)',
    llmBusy: 'Ahora no: {0} sigue trabajando o esperándote. Aplica cuando estén libres.', llmDemo: 'No disponible en la demo.',
    e_llm_bad_name: 'Nombre: mayúsculas, dígitos y _, empezando con letra (ANTHROPIC_API_KEY).', e_llm_empty: 'Pega primero la clave.', e_llm_bad_value: 'Ese valor tiene un carácter que no puede ir en llm.env (sin espacios ni comillas; una sola línea).',
    e_demo: 'No disponible en la demo.', e_apply_failed: 'El reinicio no terminó. Revisa: operio-orca logs herdr',
    themeToggle: 'Claro / oscuro', agentsIn: '{0} agentes', paneOf: 'panel {0}',
    details: 'Detalles', asks: 'Pregunta: {0}', shellTabs: '{0} pestañas de terminal sin agente',
    k_enter: 'Enter', k_esc: 'Esc', 'k_ctrl+c': 'Ctrl C', k_up: 'Arriba', k_down: 'Abajo', k_tab: 'Tab',
    e_blocked: 'Está esperando una respuesta — contéstale primero con una tecla.',
    modelTitle: 'Modelo', modelSet: '{0} ahora usa {1}', modelWait: 'Podrás cambiarlo cuando termine de trabajar.', modelAsk: 'Contesta primero su pregunta y luego cámbialo.', modelUnknown: 'Aún no se eligió aquí — usa el modelo con el que inició.',
    e_busy: 'Está trabajando — cambia el modelo cuando termine.', e_no_models: 'Este tipo de agente no puede cambiar de modelo desde aquí.',
    e_gone: 'Ese agente ya no está — el mapa se actualiza en un momento.',
    e_question_gone: 'La pregunta cambió en pantalla — no se envió nada. Vuelve a mirar.',
    e_claimed_by_other: 'Otra persona lo lleva — usa Tomar control.',
    e_not_asking: 'Ya no está preguntando — no se envió nada.',
    ansOther: 'Otra…', ansOtherPh: 'Escribe tu respuesta', ansSend: 'Enviar', ansNext: 'Siguiente', ansKeys: 'Teclas', ansSure: '¿Seguro? {0}', ansSent: 'Respuesta enviada', ansOf: '{0} de {1}', ansMulti: 'Elige una o varias', ansBack: 'Atrás',
    e_tab_gone: 'Esa pestaña se cerró. Elige otro lugar.',
    e_stalled: 'El agente no empezó. Revisa la salida e inténtalo de nuevo.',
    e_timeout: 'El espacio de trabajo tardó demasiado. Inténtalo de nuevo.',
    e_workspace: 'El espacio de trabajo lo rechazó. Revisa la salida e inténtalo de nuevo.',
    e_unreachable: 'No se puede contactar el espacio de trabajo del escritorio. ¿Está abierto?',
    e_start_failed: 'No se abrió el nuevo panel. Inténtalo de nuevo o elige otra pestaña.',
    e_folder_outside: 'Elige una carpeta dentro de tu carpeta personal.',
    e_folder_missing: 'Esa carpeta no existe. Revisa la ruta.',
    e_not_folder: 'Esa ruta es un archivo, no una carpeta.',
    e_bad_kind: 'Elige un agente de la lista.',
    e_bad_name: 'Nombres: 1–40 letras, números, espacios o . _ : -',
    e_bad_agent_name: 'Nombres de agente: empieza con minúscula; luego minúsculas, dígitos, - o _ (máx. 32).',
    crewTitle: 'Nómbralo', crewMore: 'Equipo', pin: 'Fijar {0} en el equipo', unpin: 'Quitar fijado de {0}', hideName: 'Quitar {0} de la lista',
    taken: '{0} ya está en uso', nameAsk: '¿nombre?', crewKey: 'Pulsa {0} para {1}', pinned: '{0} fijado', unpinned: '{0} sin fijar', hidden: '{0} quitado de la lista',
    tagSaved: 'Etiquetas guardadas', tagNoneYet: 'Aún no hay etiquetas — escribe una y pulsa Enter', tagNoMatch: 'Ninguna etiqueta coincide', tagNew: '+ nueva «{0}»', tagForget: 'Olvidar etiqueta {0} (no está en ningún agente)', tagForgotten: 'Olvidada {0}', tagDone: 'Listo', tagMax: 'Hasta 6 etiquetas por agente', tagUsedBy: 'en {0} agentes', e_tag_in_use: 'Esa etiqueta sigue en un agente.',
    e_bad_tags: 'Etiquetas: hasta 6, letras, números, _ o -, 20 caracteres cada una.',
    e_empty: 'Escribe un mensaje primero.', e_too_long: 'El mensaje es demasiado largo (máximo 4.000 caracteres).',
    e_generic: 'Algo salió mal. Inténtalo de nuevo.',
    ws: 'Espacio {0}', move: 'Mover', moveTitle: 'Mover {0}', moveTo: 'A', moveNewTab: 'Pestaña nueva',
    moveBeside: 'Junto a {0}', moveNewWs: 'Espacio de trabajo nuevo', wsName: 'Nombre del espacio', moving: 'Moviendo…', moved: '{0} movido a {1}',
    moveHint: 'El agente sigue trabajando — solo cambia su lugar en el escritorio.',
    moveLast: 'Es el último panel de {0}, así que {0} se cierra al moverlo.',
    e_same_place: 'Ya está ahí. Elige otro lugar.',
    e_ws_gone: 'Ese espacio de trabajo se cerró. Elige otro lugar.',
    e_move_failed: 'No se completó el movimiento. Revisa el escritorio e inténtalo de nuevo.',
    officeView: 'Vista oficina (8 bits)', kNew: 'nuevo', kNeeds: 'te necesita', kNext: 'siguiente', kPrev: 'anterior', kShow: 'mostrar', kReply: 'responder', kRename: 'renombrar', kMap: 'mapa', kOffice: 'oficina', kIslands: 'islas', kHolo: '3D', holoView: 'Mesa holo (3D)', zoom: 'Ampliar', zoomed: '¡Ampliado!', kZoom: 'ampliar en escritorio', zoomKey: 'Mostrar en el escritorio, ampliado (Z)', zoomedToast: '{0} al frente, ampliado', ctxWord: 'contexto', ctxLabel: 'Contexto usado: {0}%{1}', recapLabel: 'Resumen', recapNext: 'Siguiente', rdReader: 'Lectura', rdTerm: 'Terminal', rdYou: 'Tú', rdSteps: '{0} pasos', rdCopied: 'Copiado {0}', freshTag: 'Nuevo', freshAria: 'acaba de terminar', finHead: '{0} terminó', finTook: 'duró {0}', finOpen: 'Abrir', finDismiss: 'Descartar', finAll: 'Descartar todo', termLight: 'Terminal: claro', termDark: 'Terminal: oscuro', queueLabel: 'Agentes por prioridad: te necesita, terminado, trabajando, inactivo', jobsTitle: 'Últimos trabajos', jobsN: '{0} hechos en 24 h', jobNow: 'Trabajando ahora', jobAgo: 'hace {0}', jobTook: 'duró {0}', jobsTile: '{0} trabajos hechos en 24 h', jobAsked: 'Pediste', kOpen: 'abrir (3D)', kSound: 'sonido', soundOn: 'Sonido activado', soundOff: 'Sonido desactivado', sounds: 'Sonidos', kHide: 'ocultar', kClose: 'cerrar', showKeys: 'Teclas', nobodyNeeds: 'Nadie te necesita ahora', views: 'Vista', mapView: 'Mapa', islandView: 'Islas (simulador de los 90)', show: 'Mostrar', shown: '¡En pantalla!', focusKey: 'Mostrar en el escritorio (D)', more: 'Más: enlaces, historial, nombre, etiquetas, mover',
  },
};
// Server errors arrive as short codes; this turns them into the visitor's language.
const errText = err => T[lang]['e_' + err.message] || T.en['e_' + err.message] || t('e_generic');
// Keys: drawn icons from the sprite where a symbol helps, words otherwise.
const KEY_ICONS = { enter: 'i-enter', up: 'i-up', down: 'i-down' };
const keyText = key => (/^\d$/.test(key) ? key : t('k_' + key));
// Operio v3 token hues for tags; brand orange stays for state and the primary action.
const TAG_COLORS = ['var(--color-blue)', 'var(--color-info)', 'var(--color-green)', 'var(--color-yellow)', 'var(--color-orange-strong)'];

const safeGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

let lang = safeGet('herdr-lang') || (navigator.language || 'en').slice(0, 2);
if (!T[lang]) lang = 'en';
let lastData = null; // first /api/agents answer; null = still loading (skeletons show)
let view = ['office', 'island', 'holo'].includes(safeGet('orca-view')) ? safeGet('orca-view') : 'map'; // map | office | island | holo
let offline = false;
let highlight = safeGet('orca-highlight') || 'all'; // all | blocked | working | idle | unnamed | tag:<x>
let agents = [];            // latest /api/agents
let me = null;              // who is looking: { id, name, initial, slot }
let people = [];            // everyone who can hold an agent
// Person colours by slot (Operio tokens, away from the status colours); ink = text on it.
const WHO_COLORS = [['var(--color-blue)', '#FFFFFF'], ['var(--color-yellow)', '#0A0A0A'], ['var(--color-info)', '#0A0A0A'], ['var(--text-primary)', 'var(--color-bg)']];
const whoColor = c => (c?.team ? [TEAM_BG, '#0A0A0A'] : WHO_COLORS[(c?.slot ?? 0) % WHO_COLORS.length]);
const isMine = a => !!(a?.claim && me && (a.claim.team || a.claim.id === me.id));
// The team claim (Operio) is everyone's: drawn in both people's colours.
const TEAM_BG = 'linear-gradient(90deg, var(--color-blue) 0 50%, var(--color-yellow) 50% 100%)';
let tabs = [];              // latest workspace layout
let workspaces = [];        // [{ id, number, label }]
let byPane = new Map();     // pane -> agent
let tagSlots = {};
let tagLib = [];              // every saved tag: { tag, n (agents using it), last }
let access = { admin: true, folders: null, shell: { confirmed: false, unlockedUntil: 0, unlockMs: 900000 } };
let mapOrder = [], orderPending = false; // the order of the tab boxes on the map (tab ids)
let chatCounts = { room: null, byPane: {} }; // team chat unread counts (chat.js)
let links = [], handoffs = [], msgCounts = {}, talk = []; // agent links (by pane), open hand-offs, message counts
let clockSkew = 0;          // server now - client now
let selected = null;        // pane id shown in the sheet
const dismissed = new Map(); // pane -> since; a "needs you" the user closed stays closed until it changes
const drafts = new Map();    // pane -> unsent reply
const lastStatus = new Map(); // pane -> status at the previous render
let meta = { tabs: [], workspaces: [], folders: [], kinds: ['claude'], keys: [], vapidKey: '' };
let pendingPane = decodeURIComponent(location.hash.slice(1)) || null;

const t = (key, ...args) => (T[lang][key] ?? T.en[key] ?? key).replace(/\{(\d)\}/g, (_, i) => args[i]);
const tagColor = tag => TAG_COLORS[(tagSlots[tag] ?? 0) % TAG_COLORS.length];
const statusText = s => t('st_' + (['working', 'idle', 'blocked', 'done'].includes(s) ? s : 'unknown'));
const label = a => a?.name || a?.pane || '';
const shortPane = id => (id || '').replace(/^w[A-Za-z0-9]+:p/, '');
const tabName = id => { const x = tabs.find(tb => tb.id === id); return x?.label || t('tab', x?.number ?? id.replace(/^w[A-Za-z0-9]+:t/, '')); };
const wsOf = tabId => (tabId || '').split(':')[0];
const wsName = (id, list = workspaces) => { const w = list.find(x => x.id === id); return w?.label || t('ws', w?.number ?? id.replace(/^w/, '')); };
// With more than one workspace, a tab is named with its workspace ("Operio / MCP").
const placeName = (tabId, wsList = workspaces) => (wsList.length > 1 ? `${wsName(wsOf(tabId), wsList)} / ` : '') + tabName(tabId);

function ago(since) {
  if (!since) return '';
  const s = Math.max(0, Math.round((Date.now() + clockSkew - since) / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : Math.floor(h / 24) + 'd';
}

function dur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 10) return s % 60 ? `${m}m ${s % 60}s` : m + 'm';
  return m < 60 ? m + 'm' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

function suggestName(title) {
  const words = (title || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/)
    .filter(w => w && !['the', 'a', 'an', 'and', 'for', 'of', 'to', 'claude', 'code', 'todo', 'step'].includes(w));
  return words.slice(0, 2).join('-').slice(0, 24);
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function call(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}
const post = (path, body = {}) => call(path, { method: 'POST', body: JSON.stringify(body) });

let toastTimer;
function toast(msg, isError = false, ms) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms || (isError ? 5000 : 2200));
}

// ─── Status bar: counts double as highlights; tags and Unnamed too ───────────
function setHighlight(v) {
  highlight = highlight === v ? 'all' : v;
  safeSet('orca-highlight', highlight);
  render();
}

function renderStatusBar() {
  const n = s => agents.filter(a => a.status === s).length;
  // Status counts, then the two quick filters (Mine, Unnamed) in the same row, with their numbers.
  const counts = [['blocked', n('blocked')], ['working', n('working')], ['idle', n('idle') + n('done')], ['mine', agents.filter(isMine).length], ['unnamed', agents.filter(a => !a.name).length]];
  const box = $('#counts');
  const key = counts.map(c => c.join(':')).join('|') + highlight + lang;
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.replaceChildren(...counts.map(([s, count]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `count ${s}` + (count ? '' : ' zero') + (s === 'mine' ? ' quick first-quick' : s === 'unnamed' ? ' quick' : '');
      b.setAttribute('aria-pressed', String(highlight === s));
      b.innerHTML = '<b></b><span></span>';
      b.querySelector('b').textContent = count;
      b.querySelector('span').textContent = s === 'mine' ? t('mineOnly') : s === 'unnamed' ? t('unnamedOnly') : t('c_' + s);
      b.addEventListener('click', () => {
        if (s === 'blocked' && count) {
          const first = agents.find(a => a.status === 'blocked');
          if (first) select(first.pane);
        }
        setHighlight(s);
      });
      return b;
    }));
  }

  const tags = [...new Set(agents.flatMap(a => a.tags))].sort();
  if (highlight.startsWith('tag:') && !tags.includes(highlight.slice(4))) highlight = 'all';
  const opts = tags.map(x => ['tag:' + x, '#' + x]);
  const fbox = $('#filters');
  const fkey = opts.map(o => o.join('=')).join('|') + highlight + tags.map(x => tagSlots[x]).join(',') + lang;
  if (fbox.dataset.key === fkey) return;
  fbox.dataset.key = fkey;
  fbox.replaceChildren(...opts.map(([v, text]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip small';
    b.textContent = text;
    b.setAttribute('aria-pressed', String(highlight === v));
    if (v.startsWith('tag:')) { b.classList.add('tagged'); b.style.setProperty('--tag', tagColor(v.slice(4))); }
    b.addEventListener('click', () => setHighlight(v));
    return b;
  }));
}

function matches(a) {
  if (highlight === 'all') return true;
  if (highlight === 'unnamed') return !a.name;
  if (highlight === 'mine') return isMine(a);
  if (highlight === 'idle') return a.status === 'idle' || a.status === 'done';
  if (highlight.startsWith('tag:')) return a.tags.includes(highlight.slice(4));
  return a.status === highlight;
}

// ─── Map ──────────────────────────────────────────────────────────────────────
const blocks = new Map(); // tab id -> block element
const tiles = new Map();  // pane id -> tile element
const vacantRow = Object.assign(document.createElement('p'), { className: 'vacant-row' });

function tabGeometry(tab) {
  if (tab.area && tab.panes.length) return tab;
  // Layout unavailable: stack the tab's agents as equal rows.
  const own = agents.filter(a => a.tab === tab.id);
  return { ...tab, area: { width: 100, height: own.length * 10 || 10 }, panes: own.map((a, i) => ({ pane: a.pane, x: 0, y: i * 10, w: 100, h: 10, agent: a.agent })) };
}

function makeTile(pane) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tile';
  b.dataset.pane = pane;
  b.innerHTML = '<span class="face"><span class="tdots"></span><span class="tname"></span><span class="ttitle"></span><span class="tstat"><span class="tword"></span><span class="ttime"></span><span class="tjobs"></span><span class="tlinks"></span></span><span class="tbar"></span><span class="tnew"></span><span class="tclaim"></span></span>';
  b.addEventListener('click', () => pick(pane));
  return b;
}

// Fit the whole map in the window: shrink the tile height cap until it fits (or hits a
// tappable floor). Runs when the layout's shape or the window changes, not on every poll.
// The per-tab --min-h floor wins over the cap, so a busy map scrolls instead of clipping.
const TILE_MIN_H = 54, TILE_MIN_W = 96;
let fitKey = '';
// A tab whose narrowest pane would be thinner than TILE_MIN_W in one grid column takes a full row.
function widenNarrow() {
  const cols = Math.max(1, getComputedStyle(mapEl).gridTemplateColumns.split(' ').length);
  const gap = parseFloat(getComputedStyle(mapEl).columnGap) || 0;
  const col = (mapEl.clientWidth - gap * (cols - 1)) / cols;
  for (const b of mapEl.children) {
    if (!b.classList.contains('tabblock') || b.classList.contains('wide')) { b.classList?.remove('roomy'); continue; }
    const w = parseFloat(b.dataset.minW || '1');
    b.classList.toggle('roomy', cols > 1 && w * (col - 18) < TILE_MIN_W);
  }
}
function fitMap(force) {
  if (view !== 'map' || mapEl.hidden || !mapEl.children.length) return;
  const key = [...mapEl.children].map(n => n.className + (n.querySelector?.('.panes')?.childElementCount ?? '')).join('|') + innerWidth + 'x' + innerHeight;
  if (!force && key === fitKey) return;
  widenNarrow();
  fitKey = [...mapEl.children].map(n => n.className + (n.querySelector?.('.panes')?.childElementCount ?? '')).join('|') + innerWidth + 'x' + innerHeight;
  const top = mapEl.getBoundingClientRect().top + window.scrollY;
  const avail = innerHeight - top - (isPhone() ? 12 : 20);
  let cap = isPhone() ? 130 : 124;
  mapEl.style.setProperty('--pane-max', cap + 'px');
  for (let i = 0; i < 6 && mapEl.offsetHeight > avail && cap > 56; i++) {
    const over = mapEl.offsetHeight - avail;
    const rows = Math.max(1, mapEl.querySelectorAll('.panes').length / Math.max(1, getComputedStyle(mapEl).gridTemplateColumns.split(' ').length));
    cap = Math.max(56, Math.floor(cap - over / rows - 2));
    mapEl.style.setProperty('--pane-max', cap + 'px');
  }
}
let fitTimer;
addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => fitMap(true), 120); });

function renderMap() {
  if (!lastData) return; // the skeleton in #map stays until the first answer
  mapEl.removeAttribute('aria-busy');
  // Tabs with agents first (workspace order), shell-only tabs after.
  const hasAgents = tb => tb.panes.some(p => byPane.has(p.pane)) || agents.some(a => a.tab === tb.id);
  const base = [...tabs].sort((a, b) => (hasAgents(b) - hasAgents(a)) || ((a.number ?? 0) - (b.number ?? 0)));
  // The saved map order wins; tabs it doesn't know yet follow in the default order.
  const pos = new Map(mapOrder.map((id, i) => [id, i]));
  const rank = (tb, i) => (pos.has(tb.id) ? pos.get(tb.id) : 1e6 + i);
  const order = base.map((tb, i) => [tb, rank(tb, i)]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
  const frag = [];
  const vacant = [];
  for (const raw of order) {
    const tab = tabGeometry(raw);
    const agentPanes = tab.panes.filter(p => byPane.has(p.pane));
    let block = blocks.get(tab.id);
    if (!block) {
      block = document.createElement('section');
      block.className = 'tabblock';
      block.innerHTML = '<h2 class="tabhead"><span class="tlabel"></span><button type="button" class="trename" hidden><svg class="ic" aria-hidden="true"><use href="#i-pencil"/></svg></button><span class="tcount"></span></h2><div class="panes"></div>';
      const tabId = tab.id;
      block.querySelector('.trename').addEventListener('click', e => { e.stopPropagation(); openRename(tabId); });
      blocks.set(tab.id, block);
    }
    block.dataset.tab = tab.id;
    block.querySelector('.tabhead').title = access.admin ? t('orderTip') : '';
    block.classList.toggle('wide', tab.panes.length >= 3 && agentPanes.length > 0);
    block.classList.toggle('vacant', agentPanes.length === 0);
    block.querySelector('.tlabel').textContent = placeName(tab.id);
    const rb = block.querySelector('.trename');
    rb.hidden = !access.admin;
    rb.title = t('rnFor', placeName(tab.id)); rb.setAttribute('aria-label', rb.title);
    block.querySelector('.tcount').textContent = agentPanes.length;
    block.querySelector('.tcount').title = t('agentsIn', agentPanes.length);
    const panesEl = block.querySelector('.panes');
    // Terminal cells are about twice as tall as wide; keep the tab's real proportions.
    panesEl.style.setProperty('--ar', (tab.area.width / (tab.area.height * 2.1)).toFixed(3));
    // Floor: the shortest pane still gets TILE_MIN_H px, so its name and status always show.
    // The narrowest pane's share is kept for fitMap, which gives the tab a full row when needed.
    const minH = Math.min(...tab.panes.map(p => p.h / tab.area.height));
    const minW = Math.min(...tab.panes.map(p => p.w / tab.area.width));
    panesEl.style.setProperty('--min-h', Math.ceil(TILE_MIN_H / Math.max(0.05, minH)) + 'px');
    block.dataset.minW = minW.toFixed(3);

    const kids = [];
    for (const p of tab.panes) {
      const a = byPane.get(p.pane);
      let el = tiles.get(p.pane);
      if (a) {
        if (!el || el.tagName !== 'BUTTON' || el.classList.contains('empty')) { el = makeTile(p.pane); tiles.set(p.pane, el); }
        updateTile(el, a);
      } else {
        // A shell pane: a button that opens its terminal (mirror).
        if (!el || el.tagName !== 'BUTTON' || !el.classList.contains('empty')) {
          el = document.createElement('button');
          el.type = 'button';
          el.className = 'tile empty';
          el.dataset.pane = p.pane;
          el.innerHTML = '<span class="face"><span class="tname"></span><span class="tstat"><span class="tword"></span></span></span>';
          el.addEventListener('click', () => openTerminal(p.pane));
          tiles.set(p.pane, el);
        }
        el.querySelector('.tname').textContent = t('shellTile');
        el.querySelector('.tword').textContent = t('openShell');
        el.setAttribute('aria-label', `${t('shellTile')} · ${p.cwd || ''}`);
      }
      Object.assign(el.style, {
        left: (p.x / tab.area.width * 100) + '%', top: (p.y / tab.area.height * 100) + '%',
        width: (p.w / tab.area.width * 100) + '%', height: (p.h / tab.area.height * 100) + '%',
      });
      kids.push(el);
    }
    const cur = [...panesEl.children];
    if (kids.length !== cur.length || kids.some((n, i) => n !== cur[i])) panesEl.replaceChildren(...kids);
    // Agent tabs first; shell-only tabs (now that shells are interactive) follow, marked quiet.
    block.classList.toggle('shell-only', agentPanes.length === 0);
    frag.push(block);
  }
  for (const id of tiles.keys()) if (!tabs.some(tb => tb.panes.some(p => p.pane === id)) && !byPane.has(id)) tiles.delete(id);

  if (!frag.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = t('none');
    mapEl.replaceChildren(p);
    return;
  }
  const cur = [...mapEl.children];
  if (frag.length !== cur.length || frag.some((n, i) => n !== cur[i])) mapEl.replaceChildren(...frag);
  fitMap();
}

// Names break only after - _ . : (never mid-word).
function setBreakable(node, text) {
  if (node.dataset.text === text) return;
  node.dataset.text = text;
  const parts = text.split(/(?<=[-_.:])/);
  node.replaceChildren(...parts.flatMap((part, i) => (i ? [document.createElement('wbr'), part] : [part])));
}

function updateTile(el, a) {
  const prevStatus = lastStatus.get(a.pane);
  el.className = `tile ${a.status}` + (a.name ? '' : ' unnamed') + (selected === a.pane ? ' selected' : '') + (matches(a) ? '' : ' dim') + (el.classList.contains('changed') ? ' changed' : '') + dndCls(a.pane);
  if (prevStatus && prevStatus !== a.status) {
    el.classList.add('changed');
    setTimeout(() => el.classList.remove('changed'), 1400);
  }
  lastStatus.set(a.pane, a.status);
  const shown = a.name || suggestName(a.title) || t('unnamed');
  setBreakable(el.querySelector('.tname'), shown);
  el.classList.toggle('solid-name', !/[-_.: ]/.test(shown)); // no break point: ellipsis when it can't fit
  if (!a.name) el.dataset.ask = t('nameAsk'); else delete el.dataset.ask;
  const fresh = showFresh(a);
  el.classList.toggle('fresh', fresh);
  // Claim ribbon: who is on it (name; initial on small tiles).
  const cl = el.querySelector('.tclaim');
  el.classList.toggle('claimed', !!a.claim);
  if (a.claim) {
    const [bg, ink] = whoColor(a.claim);
    cl.textContent = a.claim.name; cl.dataset.initial = a.claim.initial;
    el.style.setProperty('--who', bg); el.style.setProperty('--who-ink', ink);
    el.style.setProperty('--who-line', a.claim.team ? 'var(--color-yellow)' : bg);
  } else cl.textContent = '';
  el.querySelector('.tnew').textContent = fresh ? t('freshTag') + ' ✓' : '';
  // Fresh: big tiles show what it just did instead of the tab title.
  const reply = fresh && a.jobs?.said;
  el.querySelector('.ttitle').textContent = reply ? '✓ ' + reply : a.title || '';
  el.querySelector('.ttitle').classList.toggle('reply', !!reply);
  const time = ago(a.since);
  el.querySelector('.tword').textContent = statusText(a.status);
  el.querySelector('.ttime').textContent = time ? ' · ' + time : '';
  const jn = a.jobs?.n || 0;
  el.querySelector('.tjobs').textContent = jn ? '✓' + jn : '';
  const lb = tileLinkBadge(a);
  el.querySelector('.tlinks').textContent = lb.text;
  el.classList.toggle('handoff', lb.hand);
  // Working: a solid bar grows with elapsed time (full at 30 min).
  const elapsed = a.since ? (Date.now() + clockSkew - a.since) / 1800000 : 0;
  el.style.setProperty('--elapsed', Math.max(0.12, Math.min(1, elapsed)).toFixed(3));
  el.classList.toggle('timed', !!a.since); // unknown start: no bar (never imply 'just started')
  const dots = el.querySelector('.tdots');
  const dkey = a.tags.map(x => x + (tagSlots[x] ?? '')).join(',');
  if (dots.dataset.key !== dkey) {
    dots.dataset.key = dkey;
    dots.replaceChildren(...a.tags.slice(0, 3).map(x => { const d = document.createElement('i'); d.style.setProperty('--tag', tagColor(x)); return d; }));
  }
  el.setAttribute('aria-label', `${label(a)} — ${statusText(a.status)}${a.claim ? ' — ' + t('claimedBy', a.claim.name) : ''}${fresh ? ' — ' + t('freshAria') : ''}${a.title ? ' — ' + a.title : ''}${jn ? ' — ' + t('jobsTile', jn) : ''}${lb.aria}`);
  el.setAttribute('aria-pressed', String(selected === a.pane));
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
const nameInput = $('#sheet-name');
const saveBtn = $('#name-form .save');
const promptEl = $('#prompt');
const outEl = $('#sheet-output');

// Fresh = finished a job nobody has opened yet. Opening the agent clears it everywhere.
const showFresh = a => !!a?.fresh && a.status !== 'working' && a.status !== 'blocked' && selected !== a.pane;
function markSeen(pane) {
  const a = byPane.get(pane);
  if (!a?.fresh) return;
  a.fresh = false; a.showFresh = false;
  post(`/api/agents/${enc(pane)}/seen`).catch(() => {});
}

function select(pane) {
  markSeen(pane);
  if (selected && selected !== pane) drafts.set(selected, promptEl.value);
  const changed = selected !== pane;
  if (changed || !sheetOpen) outToBottom();
  selected = pane;
  if (changed) {
    sfx('select');
    loadCrew();
    promptEl.value = drafts.get(pane) || '';
    autoGrow();
    nameInput.value = byPane.get(pane)?.name || '';
    saveBtn.hidden = true;
    outEl.textContent = '';
    outEl.dataset.pane = '';
    readerEl.replaceChildren();
    outLoading(true);
  }
  // Phone: the agent page is a full screen, so the system Back closes it.
  if (!sheetOpen && isPhone()) { history.pushState({ orcaSheet: true }, '', '#' + enc(pane)); pushed = true; }
  else if (location.hash.slice(1) !== pane) history.replaceState(history.state, '', '#' + enc(pane));
  sheetOpen = true;
  sheet.hidden = false;
  scrim.hidden = false;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => { sheet.classList.add('in'); scrim.classList.add('in'); });
  stickBottom = true;
  render();
  loadOutput(true);
  // After the page has risen: output at its end.
  setTimeout(() => {
    if (stickBottom) outEl.scrollTop = outEl.scrollHeight;
    placePanel();
    fadeKeys();
  }, 320);
}

const isPhone = () => !matchMedia('(min-width: 960px)').matches;
let sheetOpen = false;
let pushed = false;   // the phone page added a history entry that Back should consume
addEventListener('popstate', () => { if (sheetOpen && pushed) { pushed = false; closeSheet(true); } });

function closeSheet(fromBack = false) {
  const a = byPane.get(selected);
  if (a?.status === 'blocked') dismissed.set(a.pane, a.since);
  if (selected) drafts.set(selected, promptEl.value);
  selected = null;
  sheetOpen = false;
  setExtra(false);
  sheet.classList.remove('in');
  scrim.classList.remove('in');
  document.body.classList.remove('sheet-open');
  if (pushed && !fromBack) { pushed = false; history.back(); }
  else if (!fromBack) history.replaceState(null, '', location.pathname + location.search);
  setTimeout(() => { if (!selected) { sheet.hidden = true; scrim.hidden = true; } }, 220);
  render();
}

function renderSheet() {
  if (!selected) return;
  const a = byPane.get(selected);
  if (!a) { closeSheet(); return; }
  sheet.className = `sheet ${a.status === 'done' ? 'idle' : a.status}` + (sheet.classList.contains('in') ? ' in' : '');
  const st = ['working', 'idle', 'blocked', 'done'].includes(a.status) ? a.status : 'unknown';
  const badge = $('#sheet-badge');
  if (badge.dataset.st !== st) {
    badge.dataset.st = st;
    badge.className = 'badge ' + st;
    badge.querySelector('use').setAttribute('href', '#b-' + st);
  }
  badge.title = statusText(a.status);
  if (document.activeElement !== nameInput && saveBtn.hidden) nameInput.value = a.name || '';
  nameInput.placeholder = t('placeholder');
  const since = ago(a.since);
  $('#sheet-state').textContent = statusText(a.status) + (since ? ' ' + since : '');
  $('#sheet-where').textContent = placeName(a.tab);
  renderClaim(a);
  // Tags at the top of the card (tap: open the panel where they are edited).
  const tl = $('#sheet-tagline');
  const tkey = a.tags.join(',') + a.tags.map(x => tagSlots[x]).join(',');
  if (tl.dataset.key !== tkey) {
    tl.dataset.key = tkey;
    tl.replaceChildren(...a.tags.slice(0, 3).map(x => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tagmini'; b.textContent = '#' + x;
      b.style.setProperty('--tag', tagColor(x));
      b.addEventListener('click', () => setExtra(true));
      return b;
    }));
  }
  $('#sheet-where').title = `${placeName(a.tab)} · ${t('paneOf', shortPane(a.pane))}`;
  $('#sheet-needs').hidden = a.status !== 'blocked';
  $('#sheet-title').textContent = a.title || '';
  $('#sheet-meta').textContent = `${a.agent} · ${t('paneOf', shortPane(a.pane))} · ${a.cwd}`;
  promptEl.placeholder = t('replyPlaceholder');
  const sug = suggestName(a.title);
  const sBtn = $('#sheet-suggest');
  sBtn.hidden = !!a.name || !sug;
  sBtn.dataset.value = sug;
  sBtn.textContent = t('suggest', sug);
  $('#sheet-clear').hidden = !a.name;
  renderTags(a);
  renderModel(a);
  renderCtx();
  renderCrew();
  renderLinks(a);
  $('#sheet-stop').hidden = a.status !== 'working';
  if (histFor.terminal !== a.terminal || (a.jobs?.last || 0) !== histFor.last) loadHistory(a);
  if ((a.jobs?.last || 0) !== jobsFor.last || jobsFor.pane !== a.pane || (a.status === 'working') !== !!jobsFor.running) loadJobs();
  else renderJobs();
}

// ─── Claim: who is on this agent (anyone can still act on it) ─────────────────
let claimArmed = null;
function renderClaim(a) {
  const b = $('#sheet-claim');
  const c = a.claim;
  const mine = isMine(a);
  b.className = 'claim' + (c ? ' held' : ' free') + (mine ? ' mine' : '') + (claimArmed === a.pane ? ' armed' : '');
  if (c) { const [bg, ink] = whoColor(c); b.style.setProperty('--who', bg); b.style.setProperty('--who-ink', ink); }
  b.textContent = !c ? '+ ' + t('claimBtn') : claimArmed === a.pane ? t('claimTakeSure', c.name) : (mine && !c.team ? t('claimYou') : c.name);
  b.title = !c ? t('claimFree') : t('claimTip', mine ? t('claimYou') : c.name, ago(c.at));
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-label', b.title);
}
// The chip opens a small menu: claim it, assign it to someone, or release it.
const claimMenu = $('#claim-menu');
function closeClaimMenu() { claimMenu.hidden = true; $('#sheet-claim').setAttribute('aria-expanded', 'false'); }
async function doClaim(a, mode, to) {
  closeClaimMenu();
  try {
    const r = await post(`/api/agents/${enc(a.pane)}/claim`, { mode, to });
    a.claim = r.claim; renderClaim(a); render();
    sfx(mode === 'release' ? 'key' : 'focus');
    if (mode === 'release') toast(t('releasedToast', label(a)));
    else if (mode === 'assign' && r.claim && r.claim.id !== me?.id) toast(t('assignedToast', label(a), r.claim.name));
    else toast(t('claimedToast', label(a)));
    refresh();
  } catch (err) { toast(errText(err), true); }
}
$('#sheet-claim').addEventListener('click', e => {
  e.stopPropagation();
  const a = byPane.get(selected);
  if (!a) return;
  if (!claimMenu.hidden) { closeClaimMenu(); return; }
  const mine = isMine(a);
  const items = [];
  if (!mine || a.claim?.team) items.push([a.claim && !a.claim.team ? t('claimTakeMe') : t('claimMe'), () => doClaim(a, a.claim ? 'take' : 'claim'), me]);
  for (const p of people) if (p.id !== me?.id && p.id !== a.claim?.id) items.push([t(p.team ? 'assignTeam' : 'assignTo', p.name), () => doClaim(a, 'assign', p.id), p]);
  if (mine) items.push([t('claimRelease'), () => doClaim(a, 'release'), null]);
  claimMenu.replaceChildren(...items.map(([text, go, p]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    const dot = document.createElement('i');
    if (p) { const [bg, ink] = whoColor(p); dot.style.setProperty('--who', bg); dot.style.setProperty('--who-ink', ink); dot.textContent = p.initial; }
    else dot.className = 'none';
    b.append(dot, text);
    b.addEventListener('click', go);
    return b;
  }));
  const chip = $('#sheet-claim').getBoundingClientRect(), box = sheet.getBoundingClientRect();
  claimMenu.style.left = Math.round(chip.left - box.left) + 'px';
  claimMenu.style.top = Math.round(chip.bottom - box.top + 6) + 'px';
  claimMenu.hidden = false;
  $('#sheet-claim').setAttribute('aria-expanded', 'true');
  claimMenu.querySelector('button')?.focus();
});
document.addEventListener('click', e => { if (!claimMenu.hidden && !claimMenu.contains(e.target)) closeClaimMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !claimMenu.hidden) { e.stopImmediatePropagation(); closeClaimMenu(); } }, true);
// Heads-up when someone takes over an agent you were on.
let prevClaims = new Map();
function noticeTakeovers(list) {
  if (me) for (const a of list) {
    const was = prevClaims.get(a.terminal);
    if (was === undefined) continue;
    if (a.claim?.team && was !== a.claim.id) { if (a.claim.by && a.claim.by.id !== me.id) toast(t('teamAssigned', label(a), a.claim.by.name, a.claim.name), false, 6000); continue; }
    if (was === me.id && a.claim && a.claim.id !== me.id && !a.claim.team) {
      const by = a.claim.by;
      toast(by && by.id !== a.claim.id ? t('reassigned', label(a), a.claim.name, by.name) : t('takenToast', label(a), a.claim.name), true, 6000);
    } else if (a.claim?.id === me.id && was !== me.id && a.claim.by && a.claim.by.id !== me.id) {
      toast(t('assignedYou', label(a), a.claim.by.name), false, 6000); sfx('done');
    }
  }
  prevClaims = new Map(list.map(a => [a.terminal, a.claim?.id || null]));
}

// ─── Latest jobs: each finished turn (what you asked → the agent's last reply) ──
// ─── Stop / End ───────────────────────────────────────────────────────────────
// Stop interrupts the job (the agent stays). End shows what would be lost, then asks the
// agent to quit and closes its pane; the server saves its last output to the Journal.
$('#sheet-stop').addEventListener('click', async () => {
  const pane = selected, a = byPane.get(pane);
  if (!a) return;
  const btn = $('#sheet-stop');
  btn.disabled = true;
  try {
    const r = await post(`/api/agents/${enc(pane)}/stop`);
    toast(t(r.status === 'exited' ? 'stopExited' : r.status === 'working' ? 'stopStill' : 'stopped', label(a)), r.status === 'working');
    setTimeout(() => loadOutput(true), 400);
    refresh();
  } catch (err) { toast(errText(err), true); }
  finally { btn.disabled = false; }
});

const endDialog = $('#end-dialog');
const endForm = $('#end-form');
let endPane = null;
function endLine(text, warn) { const li = document.createElement('li'); li.textContent = text; if (warn) li.className = 'warn'; return li; }
$('#sheet-end').addEventListener('click', async () => {
  const a = byPane.get(selected);
  if (!a) return;
  endPane = a.pane;
  $('#end-title').textContent = t('endTitle', label(a));
  const list = $('#end-warn');
  list.replaceChildren(endLine(t('endChecking')));
  const go = endForm.querySelector('.end-go');
  go.disabled = true;
  go.textContent = t('endConfirm');
  endDialog.showModal();
  endForm.querySelector('[value="cancel"]').focus();
  try {
    const c = await call(`/api/agents/${enc(a.pane)}/endcheck`);
    if (endPane !== a.pane) return;
    const rows = [];
    if (c.status === 'working') rows.push(endLine(t('endWorking'), true));
    if (c.status === 'blocked') rows.push(endLine(t('endBlocked'), true));
    if (c.dirty) rows.push(endLine(t('endDirty', c.dirty), true));
    if (c.worktree) rows.push(endLine(t('endWorktree', c.worktree)));
    if (c.linked?.length) rows.push(endLine(t('endLinked', c.linked.join(', ')), true));
    if (c.lastInWs) rows.push(endLine(t('endLastWs', c.wsLabel || wsName(wsOf(a.tab))), true));
    if (c.holder) rows.push(endLine(t('endHolder', c.holder), true));
    if (c.memKB) rows.push(endLine(t('endMem', fmtKB(c.memKB))));
    if (c.ranFor) rows.push(endLine(t('endRan', dur(c.ranFor))));
    if (!rows.some(r => r.className === 'warn')) rows.push(endLine(t('endNothing')));
    list.replaceChildren(...rows);
  } catch (err) { list.replaceChildren(endLine(errText(err), true)); }
  go.disabled = false;
});
endForm.querySelector('[value="cancel"]').addEventListener('click', () => endDialog.close());
endForm.addEventListener('submit', async e => {
  e.preventDefault();
  const pane = endPane, a = byPane.get(pane);
  if (!pane || !a) return endDialog.close();
  const go = endForm.querySelector('.end-go');
  go.disabled = true;
  go.textContent = t('ending');
  try {
    const r = await post(`/api/agents/${enc(pane)}/end`);
    endDialog.close();
    drafts.delete(pane);
    if (selected === pane) closeSheet();
    toast(t(r.mode === 'forced' ? 'endedForced' : 'endedClean', label(a)), false, 4000);
    sfx('sent');
    await refresh();
  } catch (err) { toast(errText(err), true); }
  finally { endPane = null; go.disabled = false; go.textContent = t('endConfirm'); }
});

// ─── History: this agent in the Journal (7 days) ─────────────────────────────
const histEl = $('#sheet-history');
let histFor = { terminal: null, last: -1, entries: [] };
const HIST_SKIP = new Set(['agent.keys']); // the panel shows what matters; the Journal has all
histEl.addEventListener('toggle', () => {
  try { localStorage.setItem('orca-hist-open', histEl.open ? '1' : '0'); } catch { /* private mode */ }
  const a = byPane.get(selected);
  if (histEl.open && a) loadHistory(a); // fresh on every open
});
try { histEl.open = localStorage.getItem('orca-hist-open') === '1'; } catch { /* private mode */ }
async function loadHistory(a) {
  const key = a.terminal;
  histFor = { terminal: key, last: a.jobs?.last || 0, entries: histFor.terminal === key ? histFor.entries : [] };
  renderHistory(a);
  try {
    const r = await call(`/api/journal?terminal=${enc(key)}&days=7&limit=60`);
    if (histFor.terminal !== key) return;
    histFor.entries = r.entries.filter(x => !HIST_SKIP.has(x.event));
  } catch { /* journal unreachable: keep what we had */ }
  if (byPane.get(selected)?.terminal === key) renderHistory(byPane.get(selected));
}
function hhmm(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function renderHistory(a) {
  const list = histFor.entries;
  histEl.querySelector('.hsum').textContent = list.length ? t('histN', list.length) : '';
  histEl.querySelector('.hall').href = '/journal.html?agent=' + enc(a.terminal) + '&name=' + enc(label(a));
  const ol = histEl.querySelector('.hlist');
  if (!list.length) { ol.replaceChildren(Object.assign(document.createElement('li'), { className: 'hempty', textContent: t('histEmpty') })); return; }
  const J = window.OrcaJText;
  ol.replaceChildren(...list.slice(0, 25).map(x => {
    const li = document.createElement('li');
    li.className = 'h-' + (x.group || 'other');
    const when = document.createElement('time');
    when.dateTime = new Date(x.ts).toISOString();
    when.textContent = new Date(x.ts).toDateString() === new Date().toDateString() ? hhmm(x.ts) : `${new Date(x.ts).toLocaleDateString(lang, { weekday: 'short' })} ${hhmm(x.ts)}`;
    const p = document.createElement('p');
    p.textContent = J ? J.describe(x, lang, me) : x.event;
    li.append(when, p);
    const d = J?.detail(x);
    if (d) { const q = document.createElement('p'); q.className = 'hdet'; q.textContent = d; li.append(q); }
    return li;
  }));
}

// Journal button: how many finished days nobody has reviewed yet.
function renderJournalBadge(j) {
  const n = j?.toReview || 0;
  const b = $('#journal-badge');
  b.hidden = !n;
  b.textContent = n > 9 ? '9+' : String(n);
  const btn = $('#journal-btn');
  btn.title = n ? t('journalN', n) : t('journal');
  btn.setAttribute('aria-label', btn.title);
}

let jobsFor = { pane: null, last: 0, running: null, jobs: [], at: 0, skew: 0 };
const jobsEl = $('#sheet-jobs');
async function loadJobs() {
  const pane = selected;
  if (!pane) return;
  const a = byPane.get(pane);
  jobsFor = { ...jobsFor, pane, last: a?.jobs?.last || 0, running: a?.status === 'working' ? (jobsFor.running || {}) : null };
  try {
    const r = await call(`/api/agents/${enc(pane)}/jobs`);
    if (selected !== pane) return;
    jobsFor = { pane, last: r.jobs[0]?.end || 0, running: r.running, jobs: r.jobs, skew: r.now - Date.now() };
  } catch { if (selected === pane && jobsFor.pane !== pane) jobsFor.jobs = []; }
  renderJobs();
}
function jobRow(j, now) {
  const li = document.createElement('li');
  const when = document.createElement('span');
  when.className = 'jwhen';
  const said = document.createElement('p');
  said.className = 'jsaid';
  if (j) {
    when.textContent = t('jobAgo', ago(j.end));
    if (j.start) { const d = document.createElement('small'); d.textContent = t('jobTook', dur(j.end - j.start)); when.append(d); }
    said.textContent = j.said || j.title || '—';
    li.append(when, said);
    if (j.ask) {
      const ask = document.createElement('p');
      ask.className = 'jask';
      ask.title = t('jobAsked');
      ask.textContent = j.ask;
      li.append(ask);
    }
  } else {
    li.className = 'now';
    when.textContent = t('jobNow');
    const st = jobsFor.running?.start;
    if (st) { const d = document.createElement('small'); d.textContent = dur(now - st); when.append(d); }
    said.textContent = byPane.get(selected)?.title || '';
    li.append(when, said);
  }
  return li;
}
function renderJobs() {
  const a = byPane.get(selected);
  const list = jobsFor.pane === selected ? jobsFor.jobs : [];
  const running = a?.status === 'working' || a?.status === 'blocked';
  jobsEl.hidden = !list.length;
  if (!list.length) return;
  const now = Date.now() + jobsFor.skew;
  const n = a?.jobs?.n || 0;
  jobsEl.querySelector('.jcount').textContent = n ? t('jobsN', n) : '';
  const last = list[0];
  jobsEl.querySelector('.jlast').textContent = `${ago(last.end)} · ${last.said || last.title || ''}`;
  const ol = jobsEl.querySelector('ol');
  ol.replaceChildren(...(running ? [jobRow(null, now)] : []), ...list.map(j => jobRow(j, now)));
}
jobsEl.addEventListener('toggle', () => { try { localStorage.setItem('orca-jobs-open', jobsEl.open ? '1' : '0'); } catch { /* private mode */ } });
try { jobsEl.open = localStorage.getItem('orca-jobs-open') === '1'; } catch { /* private mode */ }

// ─── Context size: read from the agent's own status line ─────────────────────
// Claude prints "ctx 65% (654k/1.0M)" (context-gauge) and "ctx ███ 26% 260k/1.0M" (status bar);
// Codex prints "N% context left". The last mention in the output wins; the last good reading
// per agent is kept, so a read that misses the line doesn't blank the badge.
const ctxSeen = new Map(); // pane -> { pct, used, total }
function parseCtx(text) {
  let best = null;
  for (const m of text.matchAll(/\bctx\b[^%\n]{0,48}?(\d{1,3})%(?:[^\d\n]{0,4}(\d+(?:\.\d+)?[kKmM])(?:\s*\/\s*(\d+(?:\.\d+)?[kKmM]))?)?/g)) {
    best = { pct: +m[1], used: m[2] || '', total: m[3] || '' };
  }
  if (!best) {
    const c = [...text.matchAll(/(\d{1,3})% context left/gi)].pop();
    if (c) best = { pct: 100 - +c[1], used: '', total: '' };
  }
  return best && best.pct <= 100 ? best : null;
}
function renderCtx() {
  const el = $('#sheet-ctx');
  const c = selected && ctxSeen.get(selected);
  el.hidden = !c;
  if (!c) return;
  el.className = 'ctx ' + (c.pct >= 80 ? 'high' : c.pct >= 50 ? 'warn' : 'ok');
  el.querySelector('.ctx-fill').setAttribute('stroke-dasharray', `${Math.max(2, c.pct)} 100`);
  el.querySelector('.ctx-pct').textContent = c.pct + '%';
  const of = c.used ? (c.total ? `${c.used} / ${c.total}` : c.used) : t('ctxWord');
  el.querySelector('.ctx-of').textContent = of;
  const label = t('ctxLabel', c.pct, c.used && c.total ? ` (${c.used} / ${c.total})` : '');
  el.title = label;
  el.setAttribute('aria-label', label);
}

// The output follows its end unless you scrolled up to read.
let stickBottom = true;
outEl.addEventListener('scroll', () => { stickBottom = outEl.scrollHeight - outEl.scrollTop - outEl.clientHeight < 24; });

// Read the question and the first numbered option from the end of the output.
function readAsk(text) {
  const tail = text.split('\n').slice(-24);
  let question = '', option = '';
  for (const line of tail) {
    const q = line.replace(/^[\s│|●❯›>*-]+/, '').trim();
    if (/\?\s*$/.test(q) && q.length > 3) question = q;
    const m = line.match(/^[\s│|]*(?:[❯›>]\s*)?1[.)]\s+(.+?)\s*[│|]?\s*$/);
    if (m) option = m[1].trim();
  }
  return { question, option };
}

function renderAsk() {
  const a = byPane.get(selected);
  const blocked = a?.status === 'blocked';
  const { question, option } = blocked ? readAsk(outEl.textContent) : {};
  const needs = $('#sheet-needs');
  needs.textContent = question ? t('asks', question) : t('needsYou');
  const ans = $('#answer-key');
  ans.parentElement.hidden = !(blocked && option);
  ans.hidden = false;
  if (option) ans.textContent = `1 · ${option.slice(0, 60)}`;
  $('#sheet-keys .key[data-key="enter"]')?.classList.toggle('primary', ans.parentElement.hidden);
  fadeKeys();
}

// The output is always shown (Reader or Terminal); opening an agent starts at the latest line.
const termBox = $('#term-box');
function outToBottom() { stickBottom = true; outEl.scrollTop = outEl.scrollHeight; renderReader(true); }

// Reader | Terminal. Reader is the agent's conversation laid out to read (reader.js); Terminal is
// the raw mirror. The choice is remembered on this device.
const readerEl = $('#sheet-reader');
let outMode = safeGet('orca-out-mode') === 'term' ? 'term' : 'reader';
let readerStick = true;
let readerSrc = null;
const readerOpen = new Set();
function applyOutMode() {
  const reader = outMode === 'reader';
  outEl.hidden = reader;
  readerEl.hidden = !reader;
  document.querySelectorAll('.term-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === outMode)));
  if (reader) renderReader(true); else { outEl.scrollTop = outEl.scrollHeight; stickBottom = true; }
}
function renderReader(toBottom = false) {
  if (outMode !== 'reader' || termBox.hidden || !window.OrcaReader) return;
  const text = outEl.textContent;
  const key = (outEl.dataset.pane || '') + '\u0000' + text;
  if (key === readerSrc && !toBottom) return;
  const sameAgent = readerSrc != null && readerSrc.split('\u0000')[0] === (outEl.dataset.pane || '');
  if (!sameAgent) readerOpen.clear();
  readerSrc = key;
  readerEl.querySelectorAll('details[open]').forEach(d => readerOpen.add(d.dataset.key));
  const fromEnd = readerEl.scrollHeight - readerEl.scrollTop;
  try {
    readerEl.replaceChildren(OrcaReader.render(OrcaReader.parse(text), document, readerOpen, t));
  } catch { readerEl.textContent = text; }
  if (toBottom || readerStick || !sameAgent) { readerEl.scrollTop = readerEl.scrollHeight; readerStick = true; }
  else readerEl.scrollTop = readerEl.scrollHeight - fromEnd;
}
readerEl.addEventListener('scroll', () => { readerStick = readerEl.scrollHeight - readerEl.scrollTop - readerEl.clientHeight < 24; });
readerEl.addEventListener('toggle', e => { const d = e.target; if (d.dataset?.key) d.open ? readerOpen.add(d.dataset.key) : readerOpen.delete(d.dataset.key); }, true);
function copyPath(elm) {
  const v = elm.dataset.copy;
  (navigator.clipboard?.writeText(v) || Promise.reject()).then(() => toast(t('rdCopied', v)), () => {
    const r = document.createRange(); r.selectNodeContents(elm); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  });
}
readerEl.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) copyPath(c); });
readerEl.addEventListener('keydown', e => { const c = e.target.closest?.('[data-copy]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); copyPath(c); } });
document.querySelectorAll('.term-mode button').forEach(b => b.addEventListener('click', () => {
  outMode = b.dataset.mode; safeSet('orca-out-mode', outMode); applyOutMode();
}));
applyOutMode();

// ─── Answers + reply chips (from the agent's own question, else its screen) ───
// Blocked: one big button per option. Idle: the reply chips under its last answer.
const RISKY_RE = /don.t ask again|always allow|\bno\b|reject|deny|delete|remove|deploy|force/i;
let reply = { pane: null, data: {} };
let ans = { sig: '', qi: 0, picks: [], multi: new Set(), other: false, armed: null, busy: false };
let chipsSent = '';
async function loadReply() {
  const pane = selected;
  if (!pane) return;
  try {
    const r = await call(`/api/agents/${enc(pane)}/reply`);
    if (selected !== pane) return;
    reply = { pane, data: r || {} };
  } catch { /* keep the last one */ }
  renderReply();
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function renderReply() {
  const a = byPane.get(selected);
  const d = reply.pane === selected ? reply.data : {};
  const box = $('#answers');
  const dock = $('.dock');
  const qs = a?.status === 'blocked' ? d.ask?.questions || null : null;
  const menu = a?.status === 'blocked' && !qs ? d.screen : null;
  const showing = !!(qs?.length || menu?.options?.length);
  dock.classList.toggle('asking', showing);
  box.hidden = !showing;
  if (!showing) { ans.sig = ''; box.replaceChildren(); }
  else {
    const sig = selected + JSON.stringify(qs || menu);
    if (sig !== ans.sig) { ans = { sig, qi: 0, picks: [], multi: new Set(), other: false, armed: null, busy: false }; }
    drawAnswers(box, qs, menu);
  }
  renderChips(a, d);
}
async function sendAnswer(body) {
  const pane = selected;
  ans.busy = true;
  try {
    await post(`/api/agents/${enc(pane)}/answer`, body);
    sfx('sent');
    toast(t('ansSent'));
    ans.sig = 'sent:' + ans.sig;
    reply.data = {};
    renderReply();
    setTimeout(() => { loadOutput(true); refresh(); }, 900);
  } catch (err) {
    toast(errText(err), true);
    loadReply();
  } finally { ans.busy = false; }
}
// Risky labels take a second tap ("Sure? …") within 4 s.
function armedTap(key, go) {
  if (ans.armed !== key) { ans.armed = key; setTimeout(() => { if (ans.armed === key) { ans.armed = null; renderReply(); } }, 4000); renderReply(); return; }
  ans.armed = null; go();
}
function optButton(n, label, desc, { on = false, risky = false, key, onTap }) {
  const b = el('button', 'opt' + (on ? ' on' : '') + (risky ? ' risky' : '') + (ans.armed === key ? ' armed' : ''));
  b.type = 'button';
  b.append(el('b', 'opt-n', String(n)));
  const txt = el('span', 'opt-t');
  txt.append(el('span', 'opt-l', ans.armed === key ? t('ansSure', label) : label));
  if (desc) txt.append(el('small', 'opt-d', desc));
  b.append(txt);
  b.disabled = ans.busy;
  b.addEventListener('click', () => (risky ? armedTap(key, onTap) : onTap()));
  return b;
}
function drawAnswers(box, qs, menu) {
  // Redraw only when something changed: the panel refreshes every few seconds, and a rebuilt
  // "other" field loses the cursor (on a phone, the keyboard) in the middle of a word.
  const drawn = JSON.stringify([ans.sig, ans.qi, [...ans.multi], ans.other, ans.armed, ans.busy, lang, $('.dock').classList.contains('keys-open')]);
  if (box.dataset.drawn === drawn && box.childElementCount) return;
  box.dataset.drawn = drawn;
  const parts = [];
  if (menu) {
    if (menu.question) parts.push(el('p', 'ans-q', menu.question));
    for (const o of menu.options) parts.push(optButton(o.n, o.label, '', { risky: o.risky, key: 's' + o.n, onTap: () => sendAnswer({ screen: o.n }) }));
  } else {
    const q = qs[ans.qi];
    const head = el('p', 'ans-h');
    head.append(el('span', '', q.header || ''), el('span', 'ans-step', qs.length > 1 ? t('ansOf', ans.qi + 1, qs.length) : ''));
    parts.push(head, el('p', 'ans-q', q.question));
    const finish = () => {
      if (ans.qi + 1 < qs.length) { ans.qi += 1; ans.multi = new Set(); ans.other = false; renderReply(); }
      else sendAnswer({ answers: ans.picks });
    };
    q.options.forEach((o, i) => {
      const n = i + 1;
      parts.push(optButton(n, o.label, o.description, {
        on: q.multiSelect && ans.multi.has(n), risky: RISKY_RE.test(o.label), key: `q${ans.qi}o${n}`,
        onTap: () => {
          if (q.multiSelect) { ans.multi.has(n) ? ans.multi.delete(n) : ans.multi.add(n); renderReply(); return; }
          ans.picks[ans.qi] = { pick: [n] }; finish();
        },
      }));
    });
    const foot = el('div', 'ans-foot');
    if (ans.qi > 0) { const back = el('button', 'btn small', t('ansBack')); back.type = 'button'; back.addEventListener('click', () => { ans.qi -= 1; ans.multi = new Set(); ans.other = false; renderReply(); }); foot.append(back); }
    if (q.multiSelect) {
      const go = el('button', 'btn primary small', ans.qi + 1 < qs.length ? t('ansNext') : t('ansSend'));
      go.type = 'button';
      go.disabled = !ans.multi.size || ans.busy;
      go.title = t('ansMulti');
      go.addEventListener('click', () => { ans.picks[ans.qi] = { pick: [...ans.multi].sort() }; finish(); });
      foot.append(go);
    } else if (!ans.other) {
      const other = el('button', 'btn small', t('ansOther'));
      other.type = 'button';
      other.addEventListener('click', () => { ans.other = true; renderReply(); box.querySelector('.ans-other input')?.focus(); });
      foot.append(other);
    }
    if (!q.multiSelect && ans.other) {
      const f = el('form', 'ans-other');
      const input = el('input');
      input.placeholder = t('ansOtherPh'); input.maxLength = 500; input.enterKeyHint = 'send';
      const go = el('button', 'btn primary small', t('ansSend')); go.type = 'submit';
      f.append(input, go);
      f.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (!v) return; ans.picks[ans.qi] = { other: v }; finish(); });
      parts.push(f);
    }
    parts.push(foot);
  }
  const keysBtn = el('button', 'ans-keys', '⌨ ' + t('ansKeys'));
  keysBtn.type = 'button';
  keysBtn.setAttribute('aria-pressed', String($('.dock').classList.contains('keys-open')));
  keysBtn.addEventListener('click', () => { $('.dock').classList.toggle('keys-open'); renderReply(); });
  (parts.at(-1)?.classList?.contains('ans-foot') ? parts.at(-1) : (parts.push(el('div', 'ans-foot')), parts.at(-1))).append(keysBtn);
  // Keep a typed "other" answer while redrawing.
  const typed = box.querySelector('.ans-other input')?.value;
  box.replaceChildren(...parts);
  if (typed) { const i = box.querySelector('.ans-other input'); if (i) i.value = typed; }
}
function renderChips(a, d) {
  const box = $('#chips');
  const list = (a?.status === 'idle' || a?.status === 'done') ? d.chips || [] : [];
  const sig = selected + JSON.stringify(list);
  const show = list.length && sig !== chipsSent;
  box.hidden = !show;
  if (!show) return;
  if (box.dataset.sig === sig + ans.armed) return;
  box.dataset.sig = sig + ans.armed;
  box.replaceChildren(...list.map(c => {
    const b = el('button', 'chip small' + (c.isPrimary ? ' primary' : '') + (ans.armed === 'c' + c.key ? ' armed' : ''), ans.armed === 'c' + c.key ? t('ansSure', c.label) : c.label);
    b.type = 'button';
    b.title = c.text || '';
    const go = async () => {
      const pane = selected;
      try {
        await post(`/api/agents/${enc(pane)}/prompt`, { text: c.text || c.label });
        chipsSent = sig; box.hidden = true;
        sfx('sent'); toast(t('sent', label(byPane.get(pane))));
        setTimeout(() => { loadOutput(true); refresh(); }, 700);
      } catch (err) { toast(errText(err), true); }
    };
    b.addEventListener('click', () => (c.isRisky ? armedTap('c' + c.key, go) : go()));
    return b;
  }));
}

// The terminal's own footer (turn timer, status bar, input box, mode line, mod notices)
// only matters in the CLI: strip it from the bottom of the card's output. Only a run of
// such lines at the very end goes, so a question dialog (which ends in its own hint) stays.
const CHROME = [
  /^\s*$/, /^─{3,}/, /^\s*[❯›>]( .*)?$/, /^ctx\s/, /^\s*\[-\]\s*$/, /✘ Auto-update failed/, /^\s*⚠ /, /^\s*⏵⏵|^\s*⏸/,
  /^✻ .*· done /, /^✻ \w+ for \d/, /^\s*\/remote-control is active/, /^\s*new task\? \/clear/, /^\s*\? for shortcuts/, /^\s+◐ .*\/effort/,
  /^\[ [^\]]+ \]( \[ [^\]]+ \])*\s*$/, // the CLI's reply-chip row (the card has its own)
];
// CLI-only lines dropped anywhere in the output.
const CLI_ONLY = /^\s*▸ plugin panel hidden ·|^\s*\d+ new messages? \(ctrl\+End\)/;

// Claude's "※ recap: …" (what was done, and "Next, …" what it suggests): the latest one is
// shown above the output, split into the summary and the suggested next step.
const recapSeen = new Map(); // pane -> { sum, next }
function parseRecap(text) {
  const lines = text.split('\n');
  let i = -1;
  for (let k = lines.length - 1; k >= 0; k--) if (/^※ recap:/.test(lines[k])) { i = k; break; }
  if (i < 0) return null;
  const parts = [lines[i].replace(/^※ recap:\s*/, '')];
  for (let k = i + 1; k < lines.length && /^ {2}\S/.test(lines[k]) && !/^\s*⎿/.test(lines[k]); k++) parts.push(lines[k].trim());
  const all = parts.join(' ').replace(/\s*\(disable recaps in \/config\)\s*$/, '').replace(/\s+/g, ' ').trim();
  const m = all.match(/^(.*?)\s*\bNext(?:,|:)\s*(.+)$/);
  return m ? { sum: m[1], next: m[2].replace(/^./, c => c.toUpperCase()) } : { sum: all, next: '' };
}
function renderRecap() {
  const box = $('#sheet-recap');
  const r = selected && recapSeen.get(selected);
  box.hidden = !r;
  if (!r) return;
  box.querySelector('.r-sum .r-text').textContent = r.sum;
  box.querySelector('.r-next').hidden = !r.next;
  box.querySelector('.r-next .r-text').textContent = r.next;
}

// CLI bookkeeping anywhere in the output (the CLI still shows all of it): mod notices, the
// turn timer, the recap (shown in its own panel), remote-control, the CLI's chip row.
// Each drops with its indented continuation lines; runs of blank lines collapse to one.
const NOISE = [
  /^● [\w.-]+: its [\w.]+ hook was skipped/, /^● Compacted while idle/, /^※ recap:/,
  /^\s*\/remote-control is active/, /^✻ \S+ for .*· done/, /^✓ Done in /, /^\s*new task\? \/clear/,
  /✘ Auto-update failed/, /^\[ [^\]]+ \]( \[ [^\]]+ \])*\s*$/,
];
function cleanOutput(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (CLI_ONLY.test(lines[i])) continue;
    if (NOISE.some(re => re.test(lines[i]))) {
      while (i + 1 < lines.length && /^ {2,}\S/.test(lines[i + 1]) && !/^\s*⎿/.test(lines[i + 1])) i++;
      continue;
    }
    if (!lines[i].trim() && !(out.at(-1) ?? '').trim()) continue;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function trimChrome(text) {
  const lines = text.split('\n');
  let end = lines.length;
  while (end > 0 && CHROME.some(re => re.test(lines[end - 1]))) end--;
  return end === 0 ? text : lines.slice(0, end).join('\n'); // never blank a screen that is all chrome
}

// History kept per agent. herdr sometimes answers with only the visible screen (Claude is
// repainting); a short read must not wipe the history the card already shows.
const OUT_KEEP = 3000;
const outSeen = new Map();
function mergeOutput(pane, next) {
  const prev = outSeen.get(pane);
  let merged = next;
  if (prev) {
    const a = prev.split('\n'), b = next.split('\n');
    if (b.length < a.length) {
      // Anchor: the first three non-blank lines of the new read, found in the old one.
      const idx = b.findIndex(l => l.trim());
      const anchor = idx < 0 ? '' : b.slice(idx, idx + 3).join('\n');
      const at = anchor.length >= 30 ? prev.lastIndexOf(anchor) : -1;
      if (at >= 0) merged = prev.slice(0, at) + b.slice(idx).join('\n');
    }
  }
  const lines = merged.split('\n');
  if (lines.length > OUT_KEEP) merged = lines.slice(-OUT_KEEP).join('\n');
  outSeen.set(pane, merged);
  return merged;
}

async function loadOutput(toBottom = false) {
  if (!selected) return;
  loadReply();
  const pane = selected;
  const atBottom = stickBottom;
  try {
    const { text } = await call(`/api/agents/${enc(pane)}/read?lines=1000${outSeen.has(pane) ? '&have=1' : ''}`);
    if (selected !== pane) return;
    const rc = parseRecap(text);
    if (rc) recapSeen.set(pane, rc);
    renderRecap();
    const clean = trimChrome(cleanOutput(text).trimEnd()).trimEnd();
    const next = clean ? mergeOutput(pane, clean) : (outSeen.get(pane) || t('empty'));
    const c = parseCtx(text);
    if (c) { const prev = ctxSeen.get(pane); if (!c.total && prev?.total) c.total = prev.total; ctxSeen.set(pane, c); }
    renderCtx();
    if (outEl.textContent !== next) {
      // Reading back: keep the same lines in view while new ones arrive at the end.
      const fromEnd = outEl.scrollHeight - outEl.scrollTop;
      outEl.textContent = next;
      if (!toBottom && !atBottom && outEl.dataset.pane === pane) outEl.scrollTop = outEl.scrollHeight - fromEnd;
    }
  } catch (err) { if (selected === pane) outEl.textContent = errText(err); }
  if (selected === pane) outLoading(false);
  if (toBottom || atBottom || outEl.dataset.pane !== pane) { outEl.scrollTop = outEl.scrollHeight; stickBottom = true; }
  outEl.dataset.pane = pane;
  renderReader();
  renderAsk();
}

// Loader over the output while the first read of an agent's conversation is on its way.
// Shown only if the read takes longer than a blink, so a fast answer never flashes it.
let outLoadTimer;
function outLoading(on) {
  const el = $('#out-loading');
  clearTimeout(outLoadTimer);
  if (!on) { el.hidden = true; termBox.classList.remove('loading'); return; }
  outLoadTimer = setTimeout(() => { el.hidden = false; termBox.classList.add('loading'); }, 120);
}

// Desktop: the panel fits what is left of the window below where it starts.
function placePanel() {
  if (sheet.hidden) return;
  const top = Math.max(72, sheet.getBoundingClientRect().top);
  document.documentElement.style.setProperty('--panel-top', Math.round(top) + 'px');
}
addEventListener('scroll', placePanel, { passive: true });
addEventListener('resize', placePanel);

// Name
nameInput.addEventListener('input', () => { saveBtn.hidden = nameInput.value.trim() === (byPane.get(selected)?.name || ''); });
nameInput.addEventListener('keydown', e => { if (e.key === 'Escape') { nameInput.value = byPane.get(selected)?.name || ''; saveBtn.hidden = true; } }); // then Esc closes the card
$('#name-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (name && name !== byPane.get(selected)?.name) rename({ name });
});
$('#sheet-suggest').addEventListener('click', e => rename({ name: e.currentTarget.dataset.value }));
$('#sheet-clear').addEventListener('click', () => rename({ clear: true }));

// ─── Crew: the names you reuse, one tap (or 1–9 while renaming) ──────────────
let crewList = [];
async function loadCrew() {
  try { crewList = (await call('/api/names')).crew || []; } catch { /* keep the last list */ }
  renderCrew();
}
// Free names first; names in use stay listed (greyed) so the crew is recognisable.
const crewOrder = () => [...crewList.filter(c => !c.inUse), ...crewList.filter(c => c.inUse)];
function crewChip(c, i, onPick, withKey) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'crew-chip' + (c.inUse ? ' taken' : '') + (c.pinned ? ' pinned' : '');
  b.disabled = c.inUse;
  b.title = c.inUse ? t('taken', c.name) : withKey && i < 9 ? t('crewKey', i + 1, c.name) : c.name;
  if (withKey && i < 9 && !c.inUse) { const k = document.createElement('kbd'); k.textContent = i + 1; b.append(k); }
  b.append(c.name);
  if (c.tags.length) { const d = document.createElement('i'); d.style.setProperty('--tag', tagColor(c.tags[0])); b.append(d); }
  b.addEventListener('click', () => onPick(c.name));
  return b;
}
function renderCrew() {
  const a = byPane.get(selected);
  const box = $('#crew');
  const naming = document.activeElement === nameInput;
  box.hidden = !a || (!!a.name && !naming) || !crewList.length;
  if (!box.hidden) {
    box.querySelector('.crew-label').textContent = t('crewTitle');
    box.querySelector('.crew-chips').replaceChildren(...crewOrder().map((c, i) => crewChip(c, i, name => rename({ name }), naming)));
  }
  // Crew management (⋯ More): pin / unpin, remove from the list.
  $('#crew-manage').replaceChildren(...crewList.map(c => {
    const row = document.createElement('span');
    row.className = 'crew-item' + (c.pinned ? ' pinned' : '');
    const nm = document.createElement('span'); nm.textContent = c.name;
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'crew-pin';
    pin.setAttribute('aria-pressed', String(c.pinned));
    pin.title = t(c.pinned ? 'unpin' : 'pin', c.name); pin.setAttribute('aria-label', pin.title);
    pin.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg>';
    pin.addEventListener('click', () => crewAction(c.pinned ? 'unpin' : 'pin', c.name));
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'crew-x'; x.textContent = '×';
    x.title = t('hideName', c.name); x.setAttribute('aria-label', x.title);
    x.addEventListener('click', () => crewAction('hide', c.name));
    row.append(pin, nm, x);
    return row;
  }));
  // New-agent dialog: tap a name to fill the field.
  const nc = $('#new-crew');
  nc.replaceChildren(...crewOrder().slice(0, 10).map((c, i) => crewChip(c, i, name => { form.elements.name.value = name; form.elements.name.focus(); }, false)));
}
async function crewAction(action, name) {
  try { crewList = (await post('/api/names', { action, name })).crew || []; toast(t({ pin: 'pinned', unpin: 'unpinned', hide: 'hidden' }[action], name)); }
  catch (err) { toast(errText(err), true); }
  renderCrew();
}
nameInput.addEventListener('focus', () => { renderCrew(); });
nameInput.addEventListener('blur', () => setTimeout(renderCrew, 150)); // after a chip click lands
nameInput.addEventListener('keydown', e => {
  // 1–9 picks a crew name while the field is empty or fully selected (a name can't start with a digit).
  if (!/^[1-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
  const all = nameInput.selectionStart === 0 && nameInput.selectionEnd === nameInput.value.length;
  if (nameInput.value && !all) return;
  const c = crewOrder()[+e.key - 1];
  if (!c || c.inUse) return;
  e.preventDefault();
  rename({ name: c.name });
});

async function rename(body) {
  const pane = selected;
  try {
    const r = await post(`/api/agents/${enc(pane)}/rename`, body);
    nameInput.value = r.name || '';
    saveBtn.hidden = true;
    nameInput.blur();
    toast(r.name ? t('saved', r.name) : t('cleared'));
    await refresh();
    loadCrew();
  } catch (err) { toast(errText(err), true); }
}

// Show on desktop: the most-used action. One tap in the header (or D on a keyboard);
// the button beams, the monitor lights up and, in the office, the worker cheers.
// Zoom does the same, then the pane fills its tab on the desktop.
const focusBtn = $('#sheet-focus');
const zoomBtn = $('#sheet-zoom');
const deskTimers = new Map();
async function showOnDesktop(target, zoom = false) {
  const pane = typeof target === 'string' ? target : selected;
  if (!pane) return;
  const path = `/api/agents/${enc(pane)}/${zoom ? 'zoom' : 'focus'}`;
  if (pane !== selected) { // from the 3D command card: no header button to animate
    try {
      await post(path); sfx('show'); toast(t(zoom ? 'zoomedToast' : 'focused', label(byPane.get(pane))));
      if (scene()) scene().wave(pane);
      if (view === 'holo') window.OrcaHolo?.clearFocus(); // job done: close the command card, back to the table
      refresh();
    }
    catch (err) { toast(errText(err), true); }
    return;
  }
  const btn = zoom ? zoomBtn : focusBtn;
  if (btn.classList.contains('busy')) return;
  clearTimeout(deskTimers.get(btn));
  btn.classList.remove('sent');
  btn.classList.add('busy');
  try {
    await post(path);
    sfx('show');
    btn.classList.remove('busy');
    void btn.offsetWidth; // restart the beam if pressed again
    btn.classList.add('sent');
    btn.querySelector('.bl').textContent = t(zoom ? 'zoomed' : 'shown');
    navigator.vibrate?.(18);
    // The button itself says it (no toast over the header); screen readers hear the label.
    if (scene()) scene().wave(pane);
    else { const tile = tiles.get(pane); tile?.classList.add('changed'); setTimeout(() => tile?.classList.remove('changed'), 1400); }
    deskTimers.set(btn, setTimeout(() => { btn.classList.remove('sent'); btn.querySelector('.bl').textContent = t(zoom ? 'zoom' : 'show'); }, 1800));
    // Job done: close the agent page once the confirmation has been seen (the worker cheers behind it).
    setTimeout(() => { if (selected === pane) closeSheet(); }, 650);
    refresh();
  } catch (err) { btn.classList.remove('busy'); toast(errText(err), true); }
}
focusBtn.addEventListener('click', () => showOnDesktop());
zoomBtn.addEventListener('click', () => showOnDesktop(undefined, true));

// ─── One-key shortcuts + the cheat sheet under the header ────────────────────
// Navigation only: no shortcut ever types into an agent (keys to agents stay explicit).
// In 3D with no agent page open, moving between agents flies the camera instead of opening.
const holoAim = () => view === 'holo' && !selected;
const goTo = pane => (holoAim() ? window.OrcaHolo?.focus(pane) : select(pane));
const current = () => (holoAim() ? window.OrcaHolo?.focused() : selected);
function stepAgent(dir) {
  if (!agents.length) return;
  const i = agents.findIndex(a => a.pane === current());
  goTo(agents[(i + dir + agents.length) % agents.length].pane);
}
function nextNeeding() {
  const need = agents.filter(a => a.status === 'blocked');
  if (!need.length) return toast(t('nobodyNeeds'));
  const i = need.findIndex(a => a.pane === current());
  goTo(need[(i + 1) % need.length].pane);
}
const SHORTCUTS = [
  ['n', 'kNew', () => $('#new').click()],
  ['b', 'kNeeds', nextNeeding],
  ['j', 'kNext', () => stepAgent(1)],
  ['k', 'kPrev', () => stepAgent(-1)],
  ['d', 'kShow', () => { const p = selected || (view === 'holo' && window.OrcaHolo?.focused()); if (p) showOnDesktop(p); }],
  ['z', 'kZoom', () => { const p = selected || (view === 'holo' && window.OrcaHolo?.focused()); if (p) showOnDesktop(p, true); }],
  ['enter', 'kOpen', () => { const p = holoAim() && window.OrcaHolo?.focused(); if (p) select(p); }],
  ['r', 'kReply', () => { if (selected) promptEl.focus(); }],
  ['e', 'kRename', () => { if (selected) { nameInput.focus(); nameInput.select(); } }],
  ['m', 'kMap', () => setView('map')],
  ['o', 'kOffice', () => setView('office')],
  ['i', 'kIslands', () => setView('island')],
  ['3', 'kHolo', () => setView('holo')],
  ['s', 'kSound', () => toggleSound()],
  ['?', 'kHide', () => toggleCheats()],
];
const cheatsEl = $('#cheats');
let cheatsHidden = safeGet('orca-cheats') === 'off';
function renderCheats() {
  cheatsEl.hidden = cheatsHidden;
  $('#cheats-show').hidden = !cheatsHidden;
  const items = [...SHORTCUTS.map(([k, label]) => [k.toUpperCase(), t(label)]), ['Esc', t('kClose')]];
  cheatsEl.replaceChildren(...items.map(([k, label]) => {
    const s = document.createElement('span');
    s.className = 'cheat';
    s.dataset.key = k.toLowerCase();
    const kb = document.createElement('kbd');
    kb.textContent = k;
    s.append(kb, label);
    return s;
  }));
}
function toggleCheats() { cheatsHidden = !cheatsHidden; safeSet('orca-cheats', cheatsHidden ? 'off' : 'on'); renderCheats(); }
$('#cheats-show').addEventListener('click', toggleCheats);
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
  const hit = SHORTCUTS.find(([k]) => k === e.key.toLowerCase() || k === e.key);
  if (!hit) return;
  e.preventDefault();
  hit[2]();
  const chip = cheatsEl.querySelector(`[data-key="${CSS.escape(hit[0])}"]`);
  if (chip) { chip.classList.remove('hit'); void chip.offsetWidth; chip.classList.add('hit'); }
});
$('#sheet-close').addEventListener('click', () => closeSheet());
scrim.addEventListener('click', () => closeSheet());

// ⋯ More: links, history, name ideas, tags, move, clear name, end
function setExtra(open) {
  $('#sheet-extra').hidden = !open;
  $('#sheet-more').setAttribute('aria-expanded', String(open));
}
$('#sheet-more').addEventListener('click', () => setExtra($('#sheet-extra').hidden));

// Keys row: fade the right edge while more keys hide off-screen.
const keysEl = $('#sheet-keys');
function fadeKeys() { keysEl.classList.toggle('scrolls', keysEl.scrollWidth - keysEl.scrollLeft - keysEl.clientWidth > 4); }
keysEl.addEventListener('scroll', fadeKeys, { passive: true });
addEventListener('resize', fadeKeys);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !selected && view === 'holo' && !document.querySelector('dialog[open]')) window.OrcaHolo?.clearFocus();
  if (e.key === 'Escape' && !selected && view === 'island' && !document.querySelector('dialog[open]')) window.OrcaIsland?.clearFocus();
  // Esc always closes the card, even mid-message (the draft is kept for next time).
  if (e.key === 'Escape' && selected && !$('#new-dialog').open && !$('#move-dialog').open && !$('#rename-dialog').open && !$('#end-dialog').open) { document.activeElement?.blur?.(); closeSheet(); }
});

// Reply
function autoGrow() { promptEl.style.height = 'auto'; promptEl.style.height = Math.min(promptEl.scrollHeight, 160) + 'px'; }
promptEl.addEventListener('input', () => { drafts.set(selected, promptEl.value); autoGrow(); });
promptEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#prompt-form').requestSubmit(); }
});
$('#prompt-form').addEventListener('submit', async e => {
  e.preventDefault();
  const text = promptEl.value.trim();
  if (!text || !selected) return;
  const pane = selected;
  const btn = $('#prompt-form .send');
  btn.disabled = true;
  try {
    await post(`/api/agents/${enc(pane)}/prompt`, { text });
    sfx('sent');
    if (selected === pane) { promptEl.value = ''; autoGrow(); }
    drafts.delete(pane);
    toast(t('sent', label(byPane.get(pane))));
    setTimeout(() => loadOutput(true), 700);
    refresh();
  } catch (err) { toast(errText(err), true); }
  finally { btn.disabled = false; }
});

// Keys — Enter is the big one; ⌃C needs a second tap within 3 s
function buildKeys() {
  const box = $('#sheet-keys');
  const ans = document.createElement('button');
  ans.type = 'button';
  ans.id = 'answer-key';
  ans.className = 'key primary answer';
  let row = $('.answer-row');
  if (!row) { row = document.createElement('div'); row.className = 'answer-row'; box.before(row); }
  row.hidden = true;
  row.replaceChildren(ans);
  ans.addEventListener('click', async () => {
    const pane = selected;
    try { await post(`/api/agents/${enc(pane)}/keys`, { key: '1' }); sfx('key'); toast(t('keySent', ans.textContent)); setTimeout(() => { loadOutput(true); refresh(); }, 600); }
    catch (err) { toast(errText(err), true); }
  });
  box.replaceChildren(...meta.keys.map(key => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key' + (key === 'enter' ? ' primary' : '') + (key === 'ctrl+c' ? ' danger' : '');
    b.dataset.key = key;
    if (KEY_ICONS[key]) {
      b.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${KEY_ICONS[key]}"/></svg>`;
      if (key === 'enter') { const kt = document.createElement('span'); kt.className = 'kt'; kt.textContent = keyText(key); b.append(kt); }
      b.setAttribute('aria-label', keyText(key));
    } else b.textContent = keyText(key);
    b.addEventListener('click', async () => {
      const pane = selected;
      if (key === 'ctrl+c' && !b.classList.contains('armed')) {
        b.classList.add('armed');
        toast(t('armCtrlC', label(byPane.get(pane))), true, 3000);
        setTimeout(() => b.classList.remove('armed'), 3000);
        return;
      }
      b.classList.remove('armed');
      try {
        await post(`/api/agents/${enc(pane)}/keys`, { key });
        sfx('key');
        toast(t('keySent', keyText(key)));
        setTimeout(() => { loadOutput(true); refresh(); }, 600);
      } catch (err) { toast(errText(err), true); }
    });
    return b;
  }));
}

// ─── Tags (in the sheet) ──────────────────────────────────────────────────────
async function saveTags(pane, list) {
  try { await post(`/api/agents/${enc(pane)}/tags`, { tags: list }); await refresh(); }
  catch (err) { toast(errText(err), true); }
}

// Tags: the agent's chips, then "+ tag" opens a picker over the saved tags (most used and most
// recent first). Tap one to add it; type to filter, Enter adds what you typed (new tags are saved
// for next time). A saved tag no agent uses can be forgotten with its ×.
const TAG_MAX = 6;
const TAG_OK = /^[\p{L}\p{N}_-]{1,20}$/u;
let tagEditing = null; // pane whose picker is open
const splitTags = v => v.split(/[,\s]+/).map(x => x.trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
async function addTags(a, list) {
  const next = [...new Set([...a.tags, ...list])];
  if (next.length > TAG_MAX) { toast(t('tagMax'), true); return; }
  if (next.length !== a.tags.length) await saveTags(a.pane, next);
}
async function forgetTag(tag) {
  try { tagLib = (await post('/api/tags', { action: 'forget', tag })).tagLib || tagLib; toast(t('tagForgotten', tag)); $('#sheet-tags').dataset.key = ''; render(); }
  catch (e) { toast(errText(e), true); }
}
function closeTagPicker(a, commit) {
  const inp = $('#sheet-tags .tag-input');
  const typed = commit && inp ? splitTags(inp.value) : [];
  tagEditing = null;
  $('#sheet-tags').dataset.key = '';
  if (typed.length) addTags(a, typed); else render();
}

// Model (⋯ More): one chip per model this kind of agent can switch to. The lit one is the last
// choice made from a card; an agent started on another model shows none until someone picks.
let modelBusy = false;
function renderModel(a) {
  const box = $('#sheet-model');
  const list = meta.models?.[a.agent] || [];
  box.hidden = !list.length;
  if (!list.length) return;
  const locked = a.status === 'working' || a.status === 'blocked';
  const key = [a.pane, a.model, a.status, modelBusy, lang, list].join('|');
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.querySelector('.model-hint').textContent = a.status === 'working' ? t('modelWait') : a.status === 'blocked' ? t('modelAsk') : a.model ? '' : t('modelUnknown');
  box.querySelector('.crew-chips').replaceChildren(...list.map(m => {
    const b = el('button', 'chip small', m);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(a.model === m));
    b.disabled = locked || modelBusy;
    b.addEventListener('click', async () => {
      const pane = a.pane;
      modelBusy = true; renderModel(a);
      try {
        await post(`/api/agents/${enc(pane)}/model`, { model: m });
        const now = byPane.get(pane);
        if (now) now.model = m;
        sfx('sent');
        toast(t('modelSet', label(now || a), m[0].toUpperCase() + m.slice(1)));
        setTimeout(() => { loadOutput(true); refresh(); }, 900);
      } catch (err) { toast(errText(err), true); }
      finally { modelBusy = false; if (selected === pane && byPane.get(pane)) renderModel(byPane.get(pane)); }
    });
    return b;
  }));
}
function renderTags(a) {
  const box = $('#sheet-tags');
  const editing = tagEditing === a.pane;
  const oldInp = box.querySelector('.tag-input');
  const typed = editing && oldInp ? oldInp.value : '';
  const focused = !!oldInp && document.activeElement === oldInp;
  const key = [a.pane, a.tags.map(x => x + (tagSlots[x] ?? '')).join(','), lang, editing, editing ? tagLib.map(x => x.tag + ':' + x.n).join(',') : ''].join('|');
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  const chips = a.tags.map(tag => {
    const chip = el('span', 'tag', tag);
    chip.style.setProperty('--tag', tagColor(tag));
    const x = el('button', null, '×');
    x.type = 'button';
    x.setAttribute('aria-label', t('removeTag', tag));
    x.addEventListener('click', () => saveTags(a.pane, a.tags.filter(v => v !== tag)));
    chip.append(x);
    return chip;
  });
  if (!editing) {
    const add = el('button', 'tag-add', t('addTag'));
    add.type = 'button';
    add.addEventListener('click', () => {
      tagEditing = a.pane; box.dataset.key = ''; renderTags(a);
      box.querySelector('.tag-input')?.focus();
    });
    box.replaceChildren(...chips, add);
    return;
  }

  const full = a.tags.length >= TAG_MAX;
  const picker = el('div', 'tag-picker');
  const row = el('div', 'tag-row');
  const inp = el('input', 'tag-input');
  inp.placeholder = t('tagPrompt'); inp.maxLength = 60; inp.enterKeyHint = 'done'; inp.value = typed; inp.disabled = full;
  inp.setAttribute('aria-label', t('addTag'));
  const done = el('button', 'btn small', t('tagDone'));
  done.type = 'button';
  done.addEventListener('click', () => closeTagPicker(a, true));
  row.append(inp, done);
  const head = el('p', 'tag-sughead', full ? t('tagMax') : t('tagSaved'));
  const sugs = el('div', 'tag-sugs');
  sugs.setAttribute('role', 'group'); sugs.setAttribute('aria-label', t('tagSaved'));
  const fill = () => {
    const q = splitTags(inp.value).pop() || '';
    const list = tagLib.filter(x => !a.tags.includes(x.tag) && (!q || x.tag.includes(q)))
      .sort((x, y) => (y.n - x.n) || (y.last - x.last) || x.tag.localeCompare(y.tag)).slice(0, 18);
    const items = list.map(x => {
      const wrap = el('span', 'tag sug' + (x.n ? '' : ' unused'));
      wrap.style.setProperty('--tag', tagColor(x.tag));
      const b = el('button', 'sug-add', '#' + x.tag);
      b.type = 'button'; b.disabled = full;
      b.title = x.n ? t('tagUsedBy', x.n) : '';
      b.addEventListener('pointerdown', e => e.preventDefault()); // keep the keyboard up
      b.addEventListener('click', () => { inp.value = ''; addTags(a, [x.tag]); });
      wrap.append(b);
      if (!x.n) {
        const f = el('button', 'sug-x', '×');
        f.type = 'button';
        f.setAttribute('aria-label', t('tagForget', x.tag)); f.title = f.getAttribute('aria-label');
        f.addEventListener('click', () => forgetTag(x.tag));
        wrap.append(f);
      }
      return wrap;
    });
    if (q && TAG_OK.test(q) && !tagLib.some(x => x.tag === q) && !a.tags.includes(q) && !full) {
      const nb = el('button', 'tag-add sug-new', t('tagNew', q));
      nb.type = 'button';
      nb.addEventListener('pointerdown', e => e.preventDefault());
      nb.addEventListener('click', () => { inp.value = ''; addTags(a, [q]); });
      items.push(nb);
    }
    if (!items.length) items.push(el('span', 'tag-empty', tagLib.length ? t('tagNoMatch') : t('tagNoneYet')));
    sugs.replaceChildren(...items);
  };
  inp.addEventListener('input', fill);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const list = splitTags(inp.value);
      if (!list.length) return closeTagPicker(a, false);
      inp.value = '';
      addTags(a, list);
    }
    if (e.key === 'Escape') { e.stopPropagation(); closeTagPicker(a, false); }
  });
  fill();
  picker.append(row, head, sugs);
  box.replaceChildren(...chips, picker);
  if (focused) inp.focus();
}

// ─── Render + attention ───────────────────────────────────────────────────────
// ─── Priority strip: every agent on one line, ordered like herdr's own list ───
// Needs you → just finished (unseen) → working → idle; inside each, the latest change first.
const RANK = { blocked: 0, done: 1, working: 2, idle: 3 };
function renderQueue() {
  const box = $('#queue');
  box.setAttribute('aria-label', t('queueLabel'));
  const order = [...agents].sort((a, b) => (RANK[a.status] ?? 4) - (RANK[b.status] ?? 4) || (b.seq || 0) - (a.seq || 0));
  const key = order.map(a => `${a.pane}:${a.status}:${a.name}:${a.claim?.id || ''}`).join('|') + lang;
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.replaceChildren(...order.map(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.pane = a.pane;
      b.innerHTML = '<i class="qdot"></i><span class="qn"></span><small class="qt"></small><b class="qwho"></b>';
      b.querySelector('.qn').textContent = a.name || suggestName(a.title) || t('unnamed');
      b.addEventListener('click', () => pick(a.pane));
      return b;
    }));
  }
  for (const b of box.children) {
    const a = byPane.get(b.dataset.pane);
    if (!a) continue;
    b.className = `q ${a.status}` + (a.name ? '' : ' unnamed') + (selected === a.pane ? ' on' : '');
    b.querySelector('.qt').textContent = ago(a.since);
    const qw = b.querySelector('.qwho');
    qw.textContent = a.claim ? a.claim.initial : '';
    if (a.claim) { const [bg, ink] = whoColor(a.claim); qw.style.setProperty('--who', bg); qw.style.setProperty('--who-ink', ink); }
    b.title = `${label(a)} — ${statusText(a.status)}${a.title ? ' — ' + a.title : ''}`;
  }
}

// ─── Finished: a notice card per newly finished job, until you open or dismiss it ──
// A job counts when the server logs it (a real turn, not a blip). The first load only
// remembers what is there, so old jobs never pop up.
const lastJobSeen = new Map(); // terminal -> last job end
const notices = new Map();     // terminal -> { pane, end }
let jobsPrimed = false;
function noticeFinished(list) {
  for (const a of list) {
    const end = a.jobs?.last || 0;
    const seen = lastJobSeen.get(a.terminal);
    lastJobSeen.set(a.terminal, end);
    if (!jobsPrimed || !end || end === seen) continue;
    if (selected === a.pane) continue; // already looking at it
    if (a.claim && !isMine(a)) continue; // someone else is on it: their notice, not yours
    notices.set(a.terminal, { pane: a.pane, end });
  }
  jobsPrimed = true;
  // Notices follow the agent if it moved; drop ones whose agent is gone or open.
  for (const [term, n] of notices) {
    const a = list.find(x => x.terminal === term);
    if (!a || selected === a.pane) notices.delete(term); else n.pane = a.pane;
  }
  while (notices.size > 4) notices.delete(notices.keys().next().value);
  renderNotices();
}
function renderNotices() {
  const box = $('#finished');
  const items = [...notices.entries()].reverse(); // newest on top
  const key = items.map(([term, n]) => term + n.end).join('|') + lang;
  if (box.dataset.key === key) { for (const el of box.querySelectorAll('.fin-ago')) el.textContent = ago(+el.dataset.end); return; }
  box.dataset.key = key;
  const cards = items.map(([term, n]) => {
    const a = byPane.get(n.pane) || {};
    const card = document.createElement('article');
    card.className = 'fin';
    card.innerHTML = '<button class="fin-main" type="button"><span class="fin-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4 4 10-10"/></svg></span><span class="fin-body"><b class="fin-head"></b><small class="fin-meta"><span class="fin-ago"></span><span class="fin-took"></span></small><span class="fin-said"></span></span><span class="fin-open"></span></button><button class="fin-x" type="button"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>';
    card.querySelector('.fin-head').textContent = t('finHead', a.name || suggestName(a.title) || t('unnamed'));
    const agoEl = card.querySelector('.fin-ago');
    agoEl.dataset.end = n.end;
    agoEl.textContent = ago(n.end);
    card.querySelector('.fin-took').textContent = a.jobs?.took ? ' · ' + t('finTook', dur(a.jobs.took)) : '';
    card.querySelector('.fin-said').textContent = a.jobs?.said || a.title || '';
    card.querySelector('.fin-open').textContent = t('finOpen');
    const x = card.querySelector('.fin-x');
    x.title = t('finDismiss'); x.setAttribute('aria-label', t('finDismiss'));
    card.querySelector('.fin-main').addEventListener('click', () => { notices.delete(term); renderNotices(); if (selected !== n.pane) select(n.pane); });
    x.addEventListener('click', () => { notices.delete(term); renderNotices(); });
    return card;
  });
  if (items.length > 1) {
    const all = document.createElement('button');
    all.type = 'button'; all.className = 'fin-all'; all.textContent = t('finAll');
    all.addEventListener('click', () => { notices.clear(); renderNotices(); });
    cards.push(all);
  }
  box.replaceChildren(...cards);
}

function render() {
  renderStatusBar();
  renderQueue();
  if (scene()) scene().update(null, { selected, lang, offline, matches });
  else renderMap();
  renderSheet();
  queueDrawLinks();
}

// ─── Sound (off by default; sound.js) ────────────────────────────────────────
let prevStatus = new Map();
const sfx = name => window.OrcaSound?.play(name);
function syncSound() {
  const on = window.OrcaSound?.enabled();
  const b = $('#sound');
  b.setAttribute('aria-pressed', String(!!on));
  b.querySelector('use').setAttribute('href', on ? '#i-sound' : '#i-mute');
}
function toggleSound() {
  const on = !window.OrcaSound.enabled();
  window.OrcaSound.set(on);
  toast(t(on ? 'soundOn' : 'soundOff'));
  syncSound();
}
$('#sound').addEventListener('click', toggleSound);

// ─── View: map, 8-bit office or 90s islands (same data, same agent page) ─────
// Each scene's code loads only when its view is first opened (the map needs none of it);
// the 3D view also pulls three.js, and only then.
const SCENE_SRC = { office: ['/office.js', 'OrcaOffice'], island: ['/island.js', 'OrcaIsland'], holo: ['/holo.js', 'OrcaHolo'] };
const sceneLoads = {};
const scene = () => (SCENE_SRC[view] && window[SCENE_SRC[view][1]]) || null;
const pick = pane => {
  if (selected === pane) return closeSheet();
  select(pane);
};
function loadScene(name) {
  const [src, global] = SCENE_SRC[name];
  if (window[global]) return Promise.resolve(window[global]);
  return (sceneLoads[name] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => {
      const m = window[global];
      m.onPick(pick);
      if (name === 'holo') m.onShow((pane, zoom) => showOnDesktop(pane, zoom));
      // Office tower: hovering a desk opens the same card as the map (rect = the desk on screen).
      if (name === 'office' && m.onHover) m.onHover((pane, rect) => { if (pane && rect) showPeek({ dataset: { pane }, getBoundingClientRect: () => rect, isConnected: true }); else hidePeek(); });
      resolve(m);
    };
    s.onerror = () => { delete sceneLoads[name]; reject(new Error('unreachable')); };
    document.head.append(s);
  }));
}
const viewBtn = $('#view-btn');
const VIEW_SHORT = { map: 'kMap', office: 'kOffice', island: 'kIslands', holo: 'kHolo' };
function labelView() { const w = t(VIEW_SHORT[view] || 'kMap'); $('#view-cur').textContent = w.charAt(0).toUpperCase() + w.slice(1); }
async function setView(v) {
  view = v;
  safeSet('orca-view', v);
  if (lastData) sfx('switch');
  document.querySelectorAll('#views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  const vb = document.querySelector(`#views [data-view="${v}"]`);
  viewBtn.querySelector('.cur use').setAttribute('href', vb.querySelector('use').getAttribute('href'));
  viewBtn.title = t('views') + ': ' + vb.querySelector('span').textContent; viewBtn.setAttribute('aria-label', viewBtn.title);
  labelView();
  mapEl.hidden = v !== 'map';
  for (const [k, [, g]] of Object.entries(SCENE_SRC)) if (k !== v) window[g]?.show(false);
  if (v !== 'map') {
    let m;
    try { m = await loadScene(v); } catch (err) { toast(errText(err), true); return; }
    if (view !== v) return; // switched again while loading
    m.show(true);
    m.update(lastData, { selected, lang, offline, matches });
  }
  render();
  if (v === 'map') fitMap(true);
}
// View picker: a dropdown in the header (current view's icon; menu lists all with their keys).
function viewMenu(open) {
  $('#views').hidden = !open;
  viewBtn.setAttribute('aria-expanded', String(open));
  if (open) $('#views [aria-pressed="true"]')?.focus();
}
viewBtn.addEventListener('click', e => { e.stopPropagation(); viewMenu($('#views').hidden); });
document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => { viewMenu(false); setView(b.dataset.view); viewBtn.focus(); }));
document.addEventListener('click', e => { if (!$('#views').hidden && !e.target.closest('.viewpick')) viewMenu(false); });
document.addEventListener('keydown', e => {
  if ($('#views').hidden) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); viewMenu(false); viewBtn.focus(); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = [...document.querySelectorAll('#views button')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  }
}, true);
// Warm the 3D view while the pointer heads for its button.
const holoBtn = document.querySelector('#views [data-view="holo"]');
const warmHolo = () => loadScene('holo').then(() => import('/vendor/three/three.module.min.js')).catch(() => {});
holoBtn.addEventListener('pointerenter', warmHolo, { once: true });
holoBtn.addEventListener('focus', warmHolo, { once: true });

// An agent that needs you opens its panel by itself — unless a panel or the Routines tab
// is already open, or you closed this very question already.
function attend() {
  if (pendingPane && byPane.has(pendingPane)) { const p = pendingPane; pendingPane = null; select(p); return; }
  if (selected || !$('#routines-view').hidden) return; // never cover the Routines tab
  const a = agents.find(x => x.status === 'blocked' && dismissed.get(x.pane) !== x.since);
  if (a) select(a.pane);
}

let polling = false;
async function refresh() {
  if (polling) return;
  polling = true;
  try {
    const r = await call('/api/agents');
    lastData = r;
    offline = false;
    for (const a of r.agents) { if (a.pane === selected && a.fresh) { a.fresh = false; post(`/api/agents/${enc(a.pane)}/seen`).catch(() => {}); } a.showFresh = !!a.fresh && a.status !== 'working' && a.status !== 'blocked'; }
    if (scene()) scene().update(r, { selected, lang, offline, matches });
    // Sounds for what changed since the last look: a chime when someone needs you, a flourish when one finishes.
    if (lastData) for (const a of r.agents) {
      const was = prevStatus.get(a.pane);
      if (was && was !== a.status) { if (a.status === 'blocked') sfx('needs'); else if (a.status === 'done' || (was === 'working' && a.status === 'idle')) sfx('done'); }
    }
    prevStatus = new Map(r.agents.map(a => [a.pane, a.status]));
    if (r.me) me = r.me;
    if (r.people) people = r.people;
    noticeTakeovers(r.agents);
    noticeFinished(r.agents);
    agents = r.agents;
    tabs = r.tabs || [];
    workspaces = r.workspaces || [];
    tagSlots = r.tagColors || {};
    tagLib = r.tagLib || [];
    if (r.access) { access = r.access; syncShellLock(); }
    renderJournalBadge(r.journal);
    chatCounts = r.chat || { room: null, byPane: {} };
    if (!orderPending) mapOrder = r.mapOrder || [];
    links = r.links || []; handoffs = r.handoffs || []; msgCounts = r.msgs || {}; talk = r.talk || [];
    if (r.now) clockSkew = r.now - Date.now();
    byPane = new Map(agents.map(a => [a.pane, a]));
    for (const [pane, since] of dismissed) if (byPane.get(pane)?.since !== since) dismissed.delete(pane);
    render();
    attend();
    window.OrcaChat?.update();
    if (selected) loadOutput();
    if ($('#toast').textContent === t('offline')) $('#toast').hidden = true;
  } catch {
    offline = true;
    if (scene()) scene().update(null, { offline });
    toast(t('offline'), true);
  }
  finally { polling = false; }
}

window.addEventListener('hashchange', () => {
  const p = decodeURIComponent(location.hash.slice(1));
  if (p.startsWith('chat-')) return; // chat.js opens those
  if (p && p !== selected) { pendingPane = p; attend(); }
});
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type === 'open' && !String(e.data.pane || '').startsWith('chat-')) { pendingPane = e.data.pane; attend(); }
});

// ─── Links: who depends on whom, who talks to whom, and the hand-offs you approve ──
// The server keeps links by terminal and sends them by pane. depends: `to` waits on `from`.
// A hand-off is offered when `from` finishes; nothing reaches `to` until someone taps Send.
const linksOf = pane => links.filter(l => l.from === pane || l.to === pane);
const relationOf = (l, pane) => (l.kind === 'talk' ? 'talk' : l.to === pane ? 'waitsOn' : 'feeds');
const otherOf = (l, pane) => (l.from === pane ? l.to : l.from);
const handoffsFor = pane => handoffs.filter(h => h.to === pane || h.from === pane);

function tileLinkBadge(a) {
  const hand = handoffs.some(h => h.to === a.pane);
  const ups = links.filter(l => l.kind === 'depends' && l.to === a.pane).map(l => byPane.get(l.from)).filter(u => u && (u.status === 'working' || u.status === 'blocked'));
  const n = msgCounts[a.pane]?.n || 0;
  const parts = [];
  let aria = '';
  if (hand) { parts.push('↪'); aria += ' — ' + t('handBadge'); }
  else if (ups.length) { parts.push('⧗ ' + label(ups[0])); aria += ' — ' + t('tWaits', label(ups[0])); }
  if (n) { parts.push('✉' + n); aria += ' — ' + t('tMsgs', n); }
  const c = chatCounts.byPane?.[a.pane]?.unread || 0;
  if (c) { parts.push(t('chatShort', c)); aria += ' — ' + t('tChat', c); }
  return { text: parts.length ? ' · ' + parts.join(' ') : '', hand, aria };
}

// Map lines: an arrow from the agent that feeds to the one that waits (depends), a dotted
// line between agents that talk. Orange while a hand-off waits. Drawn over the map only.
const SVGNS = 'http://www.w3.org/2000/svg';
const linkSvg = $('#link-lines');
const workEl = $('.work');
let drawQueued = false;
function queueDrawLinks() { if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; drawLinks(); }); }
addEventListener('resize', queueDrawLinks);
// Where the line from a rect's centre towards (tx, ty) leaves the rect.
function edgePoint(r, tx, ty) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const s = Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
  return [cx + dx * s, cy + dy * s];
}
function drawLinks() {
  const g = linkSvg.querySelector('g');
  if (view !== 'map' || mapEl.hidden || !links.length) { g.replaceChildren(); linkSvg.hidden = true; return; }
  linkSvg.hidden = false;
  const base = workEl.getBoundingClientRect();
  const rectOf = pane => {
    const el = tiles.get(pane);
    if (!el || !el.isConnected) return null;
    const b = el.getBoundingClientRect();
    return b.width ? { x: b.left - base.left, y: b.top - base.top, w: b.width, h: b.height } : null;
  };
  const paths = [];
  const talkOf = talkByLink();
  const now = Date.now() + clockSkew;
  for (const l of links) {
    const A = rectOf(l.from), B = rectOf(l.to);
    if (!A || !B) continue;
    let [x1, y1] = edgePoint(A, B.x + B.w / 2, B.y + B.h / 2);
    let [x2, y2] = edgePoint(B, A.x + A.w / 2, A.y + A.h / 2);
    let cx, cy;
    if (Math.hypot(x2 - x1, y2 - y1) < 48) {
      // Neighbours: an arc between them — depends over the top, talk underneath — so both show.
      const top = l.kind === 'depends';
      const [L, R] = A.x <= B.x ? [A, B] : [B, A];
      const pL = [L.x + L.w * 0.72, top ? L.y : L.y + L.h], pR = [R.x + R.w * 0.28, top ? R.y : R.y + R.h];
      [[x1, y1], [x2, y2]] = L === A ? [pL, pR] : [pR, pL];
      cx = (x1 + x2) / 2; cy = top ? Math.min(y1, y2) - 34 : Math.max(y1, y2) + 34;
    } else {
      // A gentle curve (talk bends the other way, so a pair with both links shows two lines).
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const bend = Math.min(40, len * 0.18) * (l.kind === 'talk' ? -1 : 1);
      cx = mx - ((y2 - y1) / len) * bend; cy = my + ((x2 - x1) / len) * bend;
    }
    const hand = l.kind === 'depends' && handoffs.some(h => h.from === l.from && h.to === l.to);
    const hot = selected && (l.from === selected || l.to === selected);
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    p.setAttribute('class', `lk ${l.kind}` + (hand ? ' hand' : '') + (hot ? ' hot' : '') + (selected && !hot ? ' faint' : ''));
    if (l.kind === 'depends') p.setAttribute('marker-end', hand ? 'url(#arrow-hand)' : 'url(#arrow)');
    paths.push(p);
    const tk = talkOf.get(l.id);
    if (tk) {
      // Talking: the line flows from the last sender for a while, a count sits on the curve,
      // and a dot travels the line when a new message passes (once per message).
      const fwd = tk.lastFrom === l.from;
      if (now - tk.lastAt < TALK_LIVE_MS) p.classList.add('live', fwd ? 'fwd' : 'rev');
      const mx = 0.25 * x1 + 0.5 * cx + 0.25 * x2, my = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
      paths.push(talkBadge(tk, mx, my, hot, selected && !hot));
      const key = tk.a + '|' + tk.b;
      const seen = talkSeen.get(key);
      if (seen !== undefined && tk.lastAt > seen && !reduceMotion.matches) talkDot(p.getAttribute('d'), fwd);
      talkSeen.set(key, tk.lastAt);
    }
  }
  linkSvg.setAttribute('width', base.width); linkSvg.setAttribute('height', base.height);
  g.replaceChildren(...paths);
}

// ─── Agents talking: live line, count badge, a dot per new message ─────────────
const TALK_LIVE_MS = 90e3;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const talkSeen = new Map(); // pair -> lastAt already shown (first sight seeds it, no dot)
const dotLayer = document.createElementNS(SVGNS, 'g');
dotLayer.setAttribute('class', 'lk-dots');
linkSvg.appendChild(dotLayer);
// One line per pair carries the talk: the talk link if there is one, else the first.
function talkByLink() {
  const out = new Map();
  if (!talk.length) return out;
  const byPair = new Map(talk.map(x => [x.a + '|' + x.b, x]));
  const taken = new Set();
  for (const pass of ['talk', 'depends']) {
    for (const l of links) {
      if (l.kind !== pass) continue;
      const key = [l.from, l.to].sort().join('|');
      if (taken.has(key) || !byPair.has(key)) continue;
      taken.add(key);
      out.set(l.id, byPair.get(key));
    }
  }
  return out;
}
function talkBadge(tk, x, y, hot, faint) {
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'lk-badge' + (tk.queued ? ' queued' : '') + (hot ? ' hot' : '') + (faint ? ' faint' : ''));
  g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  g.setAttribute('role', 'button');
  g.setAttribute('tabindex', '0');
  const tip = t('tTalk', label(byPane.get(tk.lastFrom)), label(byPane.get(tk.lastTo)), tk.n, ago(tk.lastAt)) + (tk.queued ? t('tTalkQueued', tk.queued) : '');
  g.setAttribute('aria-label', tip + ' — ' + t('tTalkOpen'));
  const title = document.createElementNS(SVGNS, 'title');
  title.textContent = tip;
  const txt = String(tk.n > 99 ? '99+' : tk.n);
  const w = 14 + txt.length * 7;
  const r = document.createElementNS(SVGNS, 'rect');
  r.setAttribute('x', -w / 2); r.setAttribute('y', -10); r.setAttribute('width', w); r.setAttribute('height', 20); r.setAttribute('rx', 10);
  const tx = document.createElementNS(SVGNS, 'text');
  tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('dy', '0.35em');
  tx.textContent = txt;
  g.append(title, r, tx);
  // Opens the receiver of the last message; its sheet lists the messages (when you may act on it).
  const open = () => { location.hash = encodeURIComponent(tk.lastTo); };
  g.addEventListener('click', open);
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return g;
}
function talkDot(d, fwd) {
  const c = document.createElementNS(SVGNS, 'circle');
  c.setAttribute('r', 4.5);
  c.setAttribute('class', 'lk-dot');
  const m = document.createElementNS(SVGNS, 'animateMotion');
  m.setAttribute('path', d);
  m.setAttribute('dur', '1.4s');
  m.setAttribute('fill', 'freeze');
  m.setAttribute('calcMode', 'linear');
  m.setAttribute('keyPoints', fwd ? '0;1' : '1;0');
  m.setAttribute('keyTimes', '0;1');
  m.setAttribute('begin', 'indefinite');
  c.appendChild(m);
  dotLayer.appendChild(c);
  try { m.beginElement(); } catch {}
  setTimeout(() => c.remove(), 1600);
}

// Panel: hand-off cards, the agent's links, add a link, recent messages.
const linksEl = $('#sheet-links');
const linkForm = $('#link-add');
const handNotes = new Map(); // hand-off id -> draft note (kept across refreshes)
let linksAutoOpened = null;
function renderLinks(a) {
  const mine = linksOf(a.pane);
  const hands = handoffsFor(a.pane);
  const key = JSON.stringify([a.pane, lang, mine, hands.map(h => [h.id, h.end]), mine.map(l => { const o = byPane.get(otherOf(l, a.pane)); return [label(o), o?.status]; }), agents.map(x => x.pane + label(x)).join(), msgCounts[a.pane]]);
  if (linksEl.dataset.key === key) return;
  linksEl.dataset.key = key;
  // A waiting hand-off opens the section by itself (once per offer).
  if (hands.length && linksAutoOpened !== hands[0].id + hands[0].end) { linksAutoOpened = hands[0].id + hands[0].end; linksEl.open = true; setExtra(true); }
  linksEl.querySelector('.lsum').textContent = mine.length ? t('linksN', mine.length) : '';
  const lh = linksEl.querySelector('.lhand');
  lh.hidden = !hands.length; lh.textContent = t('handBadge');
  $('#sheet-more').classList.toggle('dot', hands.length > 0); // the hand-off badge sits inside ⋯

  // Hand-off cards
  $('#handoff-box').replaceChildren(...hands.map(h => {
    const up = byPane.get(h.from), down = byPane.get(h.to);
    const card = el('div', 'handoff');
    card.append(el('p', 'h-title', t('handTitle', label(up))));
    if (h.said) card.append(el('p', 'h-said', h.said));
    card.append(el('p', 'h-q', t('handTo', label(down))));
    const note = el('textarea', 'h-note');
    note.rows = 1; note.maxLength = 1000; note.placeholder = t('handNote', label(down));
    note.value = handNotes.get(h.id) || '';
    note.addEventListener('input', () => handNotes.set(h.id, note.value));
    const row = el('div', 'h-row');
    const sendB = el('button', 'btn small primary', t('handSend', label(down)));
    sendB.type = 'button';
    sendB.addEventListener('click', () => handoffAction(h, 'send', note.value, sendB));
    const skip = el('button', 'btn small ghost', t('handDismiss'));
    skip.type = 'button';
    skip.addEventListener('click', () => handoffAction(h, 'dismiss', '', skip));
    row.append(sendB, skip);
    card.append(note, row);
    return card;
  }));

  // Link rows
  const list = $('#link-list');
  if (!mine.length) list.replaceChildren(el('li', 'link-none', t('linkNone')));
  else list.replaceChildren(...mine.map(l => {
    const o = byPane.get(otherOf(l, a.pane));
    const rel = relationOf(l, a.pane);
    const li = el('li', 'link-row ' + rel);
    li.append(el('span', 'l-rel', t(rel === 'waitsOn' ? 'relWaitsOn' : rel === 'feeds' ? 'relFeeds' : 'relTalk')));
    const go = el('button', 'l-name ' + (o?.status || ''), label(o));
    go.type = 'button';
    go.addEventListener('click', () => o && select(o.pane));
    li.append(go);
    const x = el('button', 'icon-btn l-x');
    x.type = 'button';
    x.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>';
    x.title = t('linkRemove', label(o)); x.setAttribute('aria-label', x.title);
    x.addEventListener('click', () => removeLink(l));
    li.append(x);
    return li;
  }));

  // Agent picker (keeps the current choice across refreshes)
  const sel = linkForm.elements.other;
  const keep = sel.value;
  sel.replaceChildren(new Option(t('linkPick'), ''), ...agents.filter(x => x.pane !== a.pane).map(x => new Option(label(x) + (x.name ? '' : ` (${shortPane(x.pane)})`), x.pane)));
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;

  const n = msgCounts[a.pane]?.n || 0;
  $('#link-msgs .mcount').textContent = n ? ` · ${n}` : '';
  if ($('#link-msgs').open) loadMessages(a.pane);
}

async function handoffAction(h, action, note, btn) {
  btn.disabled = true;
  try {
    const r = await post('/api/handoffs', { id: h.id, action, note });
    handNotes.delete(h.id);
    const down = byPane.get(h.to);
    if (action === 'send') toast(r.queued ? t('handQueued', label(down)) : t('handSent', label(down)));
    handoffs = handoffs.filter(x => x.id !== h.id);
    render();
  } catch (e) { toast(errText(e), true); btn.disabled = false; }
}

async function removeLink(l) {
  try { await post('/api/links/delete', { id: l.id }); links = links.filter(x => x.id !== l.id); handoffs = handoffs.filter(x => x.id !== l.id); toast(t('linkRemoved')); render(); }
  catch (e) { toast(errText(e), true); }
}

linkForm.addEventListener('submit', async e => {
  e.preventDefault();
  const a = byPane.get(selected);
  const other = linkForm.elements.other.value;
  if (!a || !other) { linkForm.elements.other.focus(); return; }
  const rel = linkForm.elements.rel.value;
  const body = rel === 'talk' ? { kind: 'talk', from: a.pane, to: other } : rel === 'waitsOn' ? { kind: 'depends', from: other, to: a.pane } : { kind: 'depends', from: a.pane, to: other };
  const btn = linkForm.querySelector('button');
  btn.disabled = true;
  try {
    const r = await post('/api/links', body);
    links = [...links, { id: r.id, ...body }];
    linkForm.elements.other.value = '';
    toast(t('linkAdded', label(byPane.get(other))));
    render();
  } catch (err) { toast(errText(err), true); }
  finally { btn.disabled = false; }
});

let msgsFor = { pane: null, key: '' };
async function loadMessages(pane) {
  const key = pane + ':' + (msgCounts[pane]?.n || 0) + ':' + (msgCounts[pane]?.queued || 0) + lang;
  if (msgsFor.key === key) return;
  msgsFor = { pane, key };
  let list = [];
  try { list = (await call(`/api/agents/${enc(pane)}/messages`)).messages || []; } catch { msgsFor.key = ''; return; }
  if (selected !== pane) return;
  const ol = $('#link-msgs .mlist');
  if (!list.length) { ol.replaceChildren(el('li', 'm-none', t('msgNone'))); return; }
  ol.replaceChildren(...list.slice().reverse().map(m => {
    const li = el('li', 'm-row ' + (m.out ? 'out' : 'in') + ' ' + m.via + ' ' + m.state);
    const who = m.via === 'intro' ? t('msgIntro') : (m.via === 'handoff' ? t('msgHandoff') + ' · ' : '') + (m.out ? '→ ' : '← ') + (m.other ? label(m.other) : '?');
    const head = el('p', 'm-head');
    head.append(el('b', null, who), el('span', 'm-ago', ago(m.at)));
    if (m.state !== 'sent') head.append(el('span', 'm-state', t(m.state === 'queued' ? 'msgQueued' : 'msgFailed')));
    li.append(head, el('p', 'm-text', m.text));
    return li;
  }));
}
$('#link-msgs').addEventListener('toggle', () => { if ($('#link-msgs').open && selected) { msgsFor.key = ''; loadMessages(selected); } });

// ─── Shells, terminal and the shell confirmation ──────────────────────────────
const shellUnlocked = () => (access.shell?.unlockedUntil || 0) > Date.now();
function syncShellLock() { /* hook for future countdown chrome; access already carries the state */ }

// ── Confirmation before any shell: a real shell types into this computer as you. ──
const shellDialog = $('#shell-dialog');
let shellAfter = null;
async function openShellConfirm(after = null) {
  try { access.shell = await call('/api/shell/state'); } catch { /* use cached */ }
  if (shellUnlocked()) { if (after) after(); return; }
  shellAfter = after;
  const mins = Math.round((access.shell.unlockMs || 900000) / 60000);
  $('#shell-title').textContent = t('shellConfirmTitle');
  $('#shell-sub').textContent = t('shellConfirmSub', mins);
  $('#shell-go').textContent = t('shellConfirmGo');
  $('#shell-msg').textContent = '';
  if (!shellDialog.open) shellDialog.showModal();
  $('#shell-cancel').focus(); // the safe choice has focus
}
$('#shell-go').addEventListener('click', async () => {
  try {
    access.shell = await post('/api/shell/unlock', { confirm: true });
    toast(t('shellConfirmed', Math.round((access.shell.unlockMs || 900000) / 60000)));
    shellDialog.close();
    const a = shellAfter; shellAfter = null; if (a) a();
  } catch (e) { $('#shell-msg').textContent = errText(e); }
});
$('#shell-cancel').addEventListener('click', () => { shellAfter = null; shellDialog.close(); });

// ── Terminal (xterm mirror of a shell pane) ──
const termView = $('#term-view');
let term = null, termPane = null, termPoll = null, termLast = '', termBusy = false;
function ensureTerm() {
  if (term) return term;
  term = new window.Terminal({
    fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, cursorBlink: true, scrollback: 0,
    theme: termTheme(),
  });
  term.open($('#term-host'));
  term.onData(d => { if (termPane) post(`/api/term/${enc(termPane)}/input`, { text: d }).catch(() => {}); });
  return term;
}
function termTheme() {
  const dark = termScheme() === 'dark';
  return dark
    ? { background: '#0b0e14', foreground: '#e6e6e6', cursor: '#ff8a3d' }
    : { background: '#f7f8fa', foreground: '#1a1a1a', cursor: '#d2691e' };
}
async function openTerminal(pane) {
  if (!shellUnlocked()) { openShellConfirm(() => openTerminal(pane)); return; }
  termPane = pane; termLast = '';
  ensureTerm();
  try { term.options.theme = termTheme(); } catch { /* older xterm */ }
  term.reset();
  const where = (tabs.flatMap(tb => tb.panes).find(p => p.pane === pane) || {});
  $('#term-name').textContent = t('shellTile') + ' · ' + shortPane(pane);
  $('#term-where').textContent = where.cwd || '';
  termView.hidden = false;
  document.body.classList.add('term-open');
  // Zoom the pane to the full window so the mirror is wide/readable (splits are ~40 cols).
  await post(`/api/term/${enc(pane)}/zoom`, { on: true }).catch(() => {});
  await new Promise(r => setTimeout(r, 400)); // let the shell reflow to the new size
  await pollTerm();
  if (termPoll) clearInterval(termPoll);
  termPoll = setInterval(() => { if (!document.hidden && !termView.hidden) pollTerm(); }, 450);
  setTimeout(() => term.focus(), 50);
}
async function pollTerm() {
  if (termBusy || !termPane) return;
  termBusy = true;
  try {
    const r = await call(`/api/term/${enc(termPane)}`);
    const cols = Math.max(20, r.cols || 80), rows = Math.max(10, r.rows || 40);
    if (term.cols !== cols || term.rows !== rows) { try { term.resize(cols, rows); } catch { /* */ } }
    if (typeof r.text === 'string' && r.text !== termLast) {
      termLast = r.text;
      term.write('\x1b[2J\x1b[3J\x1b[H' + r.text.replace(/\r?\n/g, '\r\n'));
    }
  } catch (e) {
    if (e.message === 'shell_locked') { closeTerminal(); openShellConfirm(() => openTerminal(termPane)); }
    else if (e.message === 'not_yours' || e.message === 'gone') { closeTerminal(); toast(errText(e), true); }
  } finally { termBusy = false; }
}
function closeTerminal() {
  if (termPoll) { clearInterval(termPoll); termPoll = null; }
  if (termPane) post(`/api/term/${enc(termPane)}/zoom`, { on: false }).catch(() => {}); // restore the split
  termView.hidden = true;
  document.body.classList.remove('term-open');
  termPane = null;
}
$('#term-back').addEventListener('click', closeTerminal);
$('#term-lock').addEventListener('click', async () => { try { await post('/api/shell/lock'); access.shell.unlockedUntil = 0; } catch { /* */ } closeTerminal(); toast(t('lockNow')); });
$('#term-show').hidden = true;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !termView.hidden) { e.stopImmediatePropagation(); closeTerminal(); } }, true);

// ─── Memory: RAM per agent and in total, collapsible at the bottom of the page ──
// The summary (agents total, machine, swap, meter) stays visible when closed, so it
// polls either way; the server caches 10 s. Numbers arrive in kB.
const MEM_POLL_MS = 15000;
const memEl = $('#mem');
let memData = null, memBusy = false;
const fmtKB = kb => kb == null ? '—' : kb >= 1048576 ? `${(kb / 1048576).toFixed(1)} GB` : `${Math.round(kb / 1024)} MB`;
const memLevel = frac => frac >= 0.9 ? 'crit' : frac >= 0.8 ? 'warn' : '';

function renderMemory() {
  if (!memData) return;
  const { agents: rows, total, machine } = memData;
  const used = machine.memTotal ? machine.memUsed / machine.memTotal : 0;
  const swap = machine.swapTotal ? machine.swapUsed / machine.swapTotal : 0;
  const fig = (text, level) => { const s = document.createElement('span'); s.className = 'mem-fig' + (level ? ' ' + level : ''); s.textContent = text; return s; };
  $('#mem-figs').replaceChildren(
    fig(t('memAgents', fmtKB(total.pss)), ''),
    fig(t('memMachine', fmtKB(machine.memUsed), fmtKB(machine.memTotal)), memLevel(used)),
    ...(machine.swapTotal ? [fig(t('memSwap', fmtKB(machine.swapUsed), fmtKB(machine.swapTotal)), memLevel(swap))] : []),
  );
  const pct = kb => machine.memTotal ? `${Math.min(100, (kb / machine.memTotal) * 100).toFixed(1)}%` : '0%';
  $('#mem-agents-bar').style.width = pct(Math.min(total.pss, machine.memUsed));
  $('#mem-other-bar').style.width = pct(Math.max(0, machine.memUsed - total.pss));
  memEl.classList.toggle('warn', memLevel(used) === 'warn');
  memEl.classList.toggle('crit', memLevel(used) === 'crit');

  const max = Math.max(1, ...rows.map(r => r.pss || 0));
  const list = $('#mem-list');
  if (!rows.length) { const li = document.createElement('li'); li.className = 'mem-empty'; li.textContent = t('memEmpty'); list.replaceChildren(li); return; }
  list.replaceChildren(...rows.map(r => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mem-row';
    const label = r.name || t('unnamed');
    b.setAttribute('aria-label', t('memOpen', label) + ' — ' + (r.pss == null ? t('memNone') : fmtKB(r.pss)));
    const name = document.createElement('span'); name.className = 'mem-name'; name.textContent = label;
    const kind = document.createElement('span'); kind.className = 'mem-kind'; kind.textContent = r.agent + (r.procs ? ' · ' + t('memProcs', r.procs) : '');
    const bar = document.createElement('span'); bar.className = 'mem-bar';
    const fill = document.createElement('i'); fill.style.width = `${((r.pss || 0) / max) * 100}%`; bar.append(fill);
    const val = document.createElement('span'); val.className = 'mem-val'; val.textContent = r.pss == null ? t('memNone') : fmtKB(r.pss);
    b.append(name, kind, bar, val);
    if (r.swap >= 51200) { const sw = document.createElement('span'); sw.className = 'mem-swap'; sw.textContent = t('memSwapped', fmtKB(r.swap)); b.append(sw); }
    b.addEventListener('click', () => select(r.pane));
    li.append(b);
    return li;
  }));
}

async function loadMemory() {
  if (memBusy) return;
  memBusy = true;
  try { memData = await call('/api/memory'); renderMemory(); } catch { /* offline: keep the last numbers */ }
  finally { memBusy = false; }
}
memEl.open = safeGet('orca-mem') === 'open';
memEl.addEventListener('toggle', () => { safeSet('orca-mem', memEl.open ? 'open' : 'closed'); if (memEl.open) loadMemory(); });
loadMemory();
setInterval(() => { if (!document.hidden) loadMemory(); }, MEM_POLL_MS);

// ─── i18n apply, theme ────────────────────────────────────────────────────────
function applyLang() {
  if (typeof labelTermBtn === 'function' && $('#term-theme')) labelTermBtn();
  document.documentElement.lang = lang;
  $('#lang').textContent = lang === 'en' ? 'ES' : 'EN';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  fillDialog();
  labelView();
  renderCheats();
  renderMemory();
  render();
  document.dispatchEvent(new Event('operio-orca:lang'));
}
$('#lang').addEventListener('click', async () => {
  lang = lang === 'en' ? 'es' : 'en';
  safeSet('herdr-lang', lang);
  applyLang();
  buildKeys();
  // Alerts follow the app's language.
  if (pushSupported() && Notification.permission === 'granted') {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) post('/api/push/subscribe', { subscription: sub.toJSON(), lang }).catch(() => {});
  }
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#F4F4F5' : '#0A0A0A';
}
applyTheme(document.documentElement.dataset.theme || 'dark');
// Card terminal: its own light/dark, so it can be read in either app theme.
const termScheme = () => document.documentElement.dataset.term || document.documentElement.dataset.theme || 'dark';
function labelTermBtn() {
  const b = $('#term-theme');
  const l = t(termScheme() === 'light' ? 'termDark' : 'termLight');
  b.title = l; b.setAttribute('aria-label', l);
}
$('#term-theme').addEventListener('click', () => {
  const next = termScheme() === 'light' ? 'dark' : 'light';
  // Matching the app theme again = follow it from now on.
  if (next === document.documentElement.dataset.theme) { delete document.documentElement.dataset.term; safeSet('orca-term', ''); }
  else { document.documentElement.dataset.term = next; safeSet('orca-term', next); }
  labelTermBtn();
});
labelTermBtn();
$('#theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  safeSet('herdr-theme', next);
  applyTheme(next);
  labelTermBtn();
});

// ─── New agent dialog ────────────────────────────────────────────────────────
const dialog = $('#new-dialog');
const form = $('#new-form');

const KIND_LABEL = k => t('kind' + k.charAt(0).toUpperCase() + k.slice(1)) || k;
const KIND_MARK = { claude: 'C', hermes: 'H', opencode: 'O', agy: 'A', codex: 'X', shell: '$' };
function radio(name, value, checked, inner, cls) {
  const l = document.createElement('label');
  l.className = cls;
  l.innerHTML = `<input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}>${inner}`;
  return l;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function fillModels() {
  const kind = form.querySelector('input[name="kind"]:checked')?.value || 'claude';
  const list = meta.models?.[kind] || [];
  const group = $('#model-group');
  group.hidden = !list.length;
  const prev = form.querySelector('input[name="model"]:checked')?.value ?? safeGet('orca-new-model') ?? '';
  const pick = list.includes(prev) ? prev : '';
  $('#model-seg').replaceChildren(
    radio('model', '', pick === '', `<span class="sg-name">${esc(t('modelDefault'))}</span><small>${esc(t('modelDefaultHint'))}</small>`, 'sg'),
    ...list.map(m => radio('model', m, pick === m, `<span class="sg-name">${esc(m.charAt(0).toUpperCase() + m.slice(1))}</span><small>${esc(t('md_' + m))}</small>`, 'sg')));
}
function fillDialog() {
  const prevKind = form.querySelector('input[name="kind"]:checked')?.value || safeGet('orca-new-kind') || 'claude';
  const kinds = meta.kinds || [];
  const pickKind = kinds.includes(prevKind) ? prevKind : kinds[0];
  $('#kind-grid').replaceChildren(...kinds.map(k => radio('kind', k, k === pickKind,
    `<span class="kc-mark" data-k="${k}" aria-hidden="true">${KIND_MARK[k] || k[0].toUpperCase()}</span><span class="kc-text"><span class="kc-name">${esc(KIND_LABEL(k))}</span><small>${esc(t('kd_' + k))}</small></span>`, 'kc')));
  fillModels();
  $('#folders').replaceChildren(...meta.folders.map(f => new Option(f, f)));
  const cur = form.elements.folder.value;
  $('#folder-chips').replaceChildren(...meta.folders.map(f => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fchip'; b.textContent = f.replace(/^~\/?/, '~/').replace(/^~\/$/, '~');
    b.setAttribute('aria-pressed', String(f === cur));
    b.addEventListener('click', () => { form.elements.folder.value = f; syncFolderChips(); });
    return b;
  }));
  const tab = form.elements.tab;
  const prevTab = tab.value || 'new';
  tab.replaceChildren(new Option(t('newTab'), 'new'),
    ...meta.tabs.map(x => new Option(t('inTab', (meta.workspaces.length > 1 ? wsName(x.ws, meta.workspaces) + ' / ' : '') + (x.label || t('tab', x.number))), x.id, false, x.id === prevTab)));
}
function syncFolderChips() {
  const v = form.elements.folder.value.trim();
  [...$('#folder-chips').children].forEach((b, i) => b.setAttribute('aria-pressed', String(meta.folders[i] === v)));
}
form.elements.folder.addEventListener('input', syncFolderChips);
form.addEventListener('change', e => {
  if (e.target.name === 'kind') { safeSet('orca-new-kind', e.target.value); fillModels(); }
  if (e.target.name === 'model') safeSet('orca-new-model', e.target.value);
});

$('#new').addEventListener('click', async () => {
  try { meta = { ...meta, ...(await call('/api/meta')) }; } catch { /* keep last meta */ }
  form.reset();
  form.elements.folder.value = meta.folders[0] || '~';
  fillDialog();
  dialog.showModal();
  form.elements.name.focus();
  loadCrew();
});
form.querySelectorAll('[value="cancel"]').forEach(b => b.addEventListener('click', () => dialog.close()));
form.addEventListener('submit', async e => {
  e.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const body = Object.fromEntries(new FormData(form));
  // A shell needs a fresh confirmation first, then submit.
  if (body.kind === 'shell' && !shellUnlocked()) { dialog.close(); openShellConfirm(() => { dialog.showModal(); form.requestSubmit(); }); return; }
  submit.disabled = true;
  submit.textContent = t('starting');
  try {
    const r = await post('/api/agents/new', body);
    dialog.close();
    if (r.shell) { await refresh(); openTerminal(r.pane); return; }
    toast(r.blocked ? t('startedBlocked', body.name) : t('started', body.name), false, r.blocked ? 6000 : 2500);
    meta = { ...meta, ...(await call('/api/meta').catch(() => ({}))) };
    pendingPane = r.pane;
    await refresh();
  } catch (err) {
    if (err.message === 'shell_locked') { dialog.close(); openShellConfirm(() => { dialog.showModal(); form.requestSubmit(); }); }
    else toast(errText(err), true);
  }
  finally { submit.disabled = false; submit.textContent = t('start'); }
});

// ─── Peek: hover card on a map tile (desktop pointer only) ───────────────────
// Everything the tile is too small to say: kind and model, folder, place, the task, the last
// reply, jobs, context and who is on it. Opens after a short rest, never on touch.
const peekEl = $('#peek');
const canHover = matchMedia('(hover: hover) and (pointer: fine)');
let peekPane = null, peekTimer = 0, peekAnchor = null;
function peekRow(k, v, cls = '') {
  if (!v) return null;
  const r = document.createElement('div');
  r.className = 'pk-row ' + cls;
  const dt = document.createElement('span'); dt.className = 'pk-k'; dt.textContent = t(k);
  const dd = document.createElement('span'); dd.className = 'pk-v'; dd.textContent = v;
  r.append(dt, dd);
  return r;
}
function fillPeek(tile) {
  const pane = tile.dataset.pane;
  const a = byPane.get(pane);
  const kids = [];
  const head = document.createElement('div');
  head.className = 'pk-head';
  const nm = document.createElement('strong'); nm.className = 'pk-name';
  const st = document.createElement('span');
  if (a) {
    nm.textContent = a.name || suggestName(a.title) || t('unnamed');
    st.className = 'pk-st ' + a.status;
    const time = ago(a.since);
    st.textContent = statusText(a.status) + (time ? ' · ' + time : '');
  } else {
    nm.textContent = t('shellTile'); st.className = 'pk-st'; st.textContent = '';
  }
  head.append(nm, st);
  kids.push(head);
  if (a) {
    const ctx = ctxSeen.get(pane);
    kids.push(
      peekRow('pk_task', a.title, 'wrap'),
      peekRow('pk_last', a.jobs?.said ? '✓ ' + a.jobs.said : '', 'wrap clamp'),
      peekRow('pk_kind', KIND_LABEL(a.agent || '') + (a.model ? ' · ' + a.model.charAt(0).toUpperCase() + a.model.slice(1) : '')),
      peekRow('pk_folder', a.cwd, 'mono'),
      peekRow('pk_place', placeName(a.tab)),
      peekRow('pk_jobs', a.jobs?.n ? String(a.jobs.n) + (a.jobs.took ? ' · ' + t('jobTook', dur(a.jobs.took)) : '') : ''),
      peekRow('pk_ctx', ctx ? ctx.pct + '%' + (ctx.used && ctx.total ? ` (${ctx.used} / ${ctx.total})` : '') : ''),
      peekRow('pk_with', a.claim?.name || ''),
    );
    if (a.tags?.length) {
      const tg = document.createElement('div'); tg.className = 'pk-tags';
      for (const x of a.tags) { const i = document.createElement('span'); i.textContent = x; i.style.setProperty('--tag', tagColor(x)); tg.append(i); }
      kids.push(tg);
    }
  }
  const foot = document.createElement('p'); foot.className = 'pk-foot';
  foot.textContent = a ? (tile.nodeType ? t('pk_open') : t('pk_openScene')) + ' · D ' + t('kShow') : t('pk_shell');
  kids.push(foot);
  peekEl.replaceChildren(...kids.filter(Boolean));
  peekEl.className = 'peek' + (a ? ' ' + a.status : '') + (peekEl.classList.contains('in') ? ' in' : '');
}
function placePeek(tile) {
  const r = tile.getBoundingClientRect();
  const w = peekEl.offsetWidth, h = peekEl.offsetHeight, m = 10;
  const clampY = y => Math.min(Math.max(m, y), innerHeight - h - m);
  let x, y;
  if (r.right + m + w <= innerWidth - m) { x = r.right + m; y = clampY(r.top); }        // right of the tile
  else if (r.left - m - w >= m) { x = r.left - m - w; y = clampY(r.top); }              // left of it
  else {                                                                                  // below, else above
    x = Math.min(Math.max(m, r.left), innerWidth - w - m);
    y = r.bottom + m + h <= innerHeight - m ? r.bottom + m : clampY(r.top - m - h);
  }
  peekEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
function showPeek(tile) {
  if (sheetOpen && isPhone()) return;
  peekPane = tile.dataset.pane;
  peekAnchor = tile;
  fillPeek(tile);
  peekEl.hidden = false;
  placePeek(tile);
  requestAnimationFrame(() => peekEl.classList.add('in'));
}
function hidePeek() {
  clearTimeout(peekTimer);
  peekPane = null;
  peekEl.classList.remove('in');
  peekEl.hidden = true;
}
mapEl.addEventListener('pointerover', e => {
  if (!canHover.matches || e.pointerType !== 'mouse') return;
  const tile = e.target.closest('.tile[data-pane]');
  if (!tile || tile.dataset.pane === peekPane) return;
  clearTimeout(peekTimer);
  // Moving between tiles while one is open: switch at once; from rest: wait a beat.
  peekTimer = setTimeout(() => showPeek(tile), peekPane ? 0 : 380);
});
mapEl.addEventListener('pointerout', e => {
  const to = e.relatedTarget?.closest?.('.tile[data-pane]');
  if (to && mapEl.contains(to)) return;
  hidePeek();
});
mapEl.addEventListener('pointerdown', hidePeek);
addEventListener('scroll', hidePeek, { passive: true });
addEventListener('keydown', hidePeek);
// Keep an open card current as the poll brings news.
setInterval(() => {
  if (!peekPane || peekEl.hidden) return;
  // A map tile is looked up again (it can be rebuilt); a scene's anchor object is kept as is.
  const tile = peekAnchor?.nodeType ? mapEl.querySelector(`.tile[data-pane="${CSS.escape(peekPane)}"]`) : peekAnchor;
  if (tile && byPane.has(peekPane)) { fillPeek(tile); placePeek(tile); } else hidePeek();
}, 1000);

// ─── Drag and drop on the map: move agents and shells between tabs/workspaces ──
// Mouse: drag after a few pixels. Touch: long-press, then drag (a quick swipe still scrolls).
// Drop on a card of another tab → beside it (right or below, by where you drop);
// on a card of the same tab → swap places; on a tab → added to it; on the dock → new tab
// in a workspace, or a new workspace. herdr keeps the process running; the id may change.
var drag = null;          // var: render() may read it before this line runs. { pane, tile, x0, y0, pointerId, touch, armed, ghost, timer, target }
let dragClickBlock = false;
const DND_SLOP = 6, DND_HOLD = 380;
const dockEl = (() => {
  const d = document.createElement('div');
  d.id = 'dnd-dock'; d.className = 'dnd-dock'; d.hidden = true;
  document.body.append(d);
  return d;
})();
function dndCls(pane) {
  if (!drag?.armed) return '';
  if (drag.pane === pane) return ' dragging';
  const tg = drag.target;
  return tg?.kind === 'pane' && tg.pane === pane ? ' drop-' + tg.how : '';
}
const tabOfPane = pane => tabs.find(tb => tb.panes.some(p => p.pane === pane));
function paneLabel(pane) { const a = byPane.get(pane); return a ? label(a) : t('shellTile'); }
function fillDock() {
  const own = tabOfPane(drag.pane);
  const ws = [...workspaces].sort((a, b) => (a.id === own?.ws) - (b.id === own?.ws)); // other workspaces first
  const chip = (drop, text, icon) => `<button type="button" class="dnd-chip" data-drop="${drop}"><svg class="ic" aria-hidden="true"><use href="#${icon}"/></svg><span>${esc(text)}</span></button>`;
  dockEl.innerHTML = `<p class="dnd-hint">${esc(t('dndHint'))}</p><div class="dnd-chips">` +
    ws.map(w => chip('tab:' + w.id, t('dndNewTab', wsName(w.id)), 'i-plus')).join('') +
    chip('workspace', t('dndNewWs'), 'i-map') + '</div>';
}
function startDrag() {
  drag.armed = true;
  hidePeek();
  if (drag.touch && navigator.vibrate) navigator.vibrate(12);
  const r = drag.tile.getBoundingClientRect();
  const g = drag.tile.cloneNode(true);
  g.className = drag.tile.className + ' dnd-ghost';
  g.removeAttribute('id'); g.setAttribute('aria-hidden', 'true');
  Object.assign(g.style, { left: '0', top: '0', width: Math.min(r.width, 240) + 'px', height: Math.min(r.height, 110) + 'px' });
  drag.dx = Math.min(drag.x0 - r.left, Math.min(r.width, 240) - 12);
  drag.dy = Math.min(drag.y0 - r.top, Math.min(r.height, 110) - 12);
  document.body.append(g);
  drag.ghost = g;
  drag.tile.classList.add('dragging');
  document.body.classList.add('dnd-on');
  fillDock();
  dockEl.hidden = false;
  requestAnimationFrame(() => dockEl.classList.add('in'));
  moveGhost(drag.x, drag.y);
  autoScroll();
}
function moveGhost(x, y) { drag.ghost.style.transform = `translate(${Math.round(x - drag.dx)}px, ${Math.round(y - drag.dy)}px) rotate(-1.5deg)`; }
function findTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const chip = el.closest('.dnd-chip');
  if (chip) return { kind: 'dock', drop: chip.dataset.drop, el: chip };
  const own = tabOfPane(drag.pane);
  const tile = el.closest('.tile[data-pane]');
  if (tile && mapEl.contains(tile) && tile.dataset.pane !== drag.pane && !tile.classList.contains('locked')) {
    const other = tabOfPane(tile.dataset.pane);
    if (other && own && other.id === own.id) return { kind: 'pane', pane: tile.dataset.pane, how: 'swap', el: tile };
    const r = tile.getBoundingClientRect();
    const rx = (x - r.left) / r.width, ry = (y - r.top) / r.height;
    return { kind: 'pane', pane: tile.dataset.pane, how: rx - 0.5 > ry - 0.5 ? 'right' : 'down', el: tile };
  }
  const block = el.closest('.tabblock[data-tab]');
  if (block && mapEl.contains(block) && block.dataset.tab !== own?.id) return { kind: 'tab', tab: block.dataset.tab, el: block };
  return null;
}
function paintTarget(tg) {
  const old = drag.target;
  if (old?.el === tg?.el && old?.how === tg?.how) return;
  if (old?.el) { old.el.classList.remove('drop-swap', 'drop-right', 'drop-down', 'drop-into', 'drop-on'); delete old.el.dataset.dropLabel; }
  drag.target = tg;
  if (!tg) return;
  if (tg.kind === 'pane') { tg.el.classList.add('drop-' + tg.how); tg.el.dataset.dropLabel = t(tg.how === 'swap' ? 'dndSwap' : tg.how === 'right' ? 'dndRight' : 'dndBelow'); }
  else if (tg.kind === 'tab') { tg.el.classList.add('drop-into'); tg.el.dataset.dropLabel = t('dndInto'); }
  else tg.el.classList.add('drop-on');
}
// Near the top of the window, or just above the dock, the page scrolls. Never while the finger
// is on the dock itself, so the page can't slide a dock button under a resting finger.
function autoScroll() {
  if (!drag?.armed) return;
  const edge = 56, y = drag.y;
  const dockTop = dockEl.hidden ? innerHeight : dockEl.getBoundingClientRect().top;
  let v = 0;
  if (y < edge) v = -(edge - y) / 5;
  else if (y < dockTop && y > dockTop - edge) v = (y - (dockTop - edge)) / 5;
  if (v) { scrollBy(0, Math.max(-12, Math.min(12, v))); paintTarget(findTarget(drag.x, drag.y)); }
  requestAnimationFrame(autoScroll);
}
function endDrag(drop) {
  if (!drag) return;
  clearTimeout(drag.timer);
  const d = drag;
  if (d.armed) {
    const tg = d.target;
    paintTarget(null);
    d.ghost?.remove();
    d.tile.classList.remove('dragging');
    document.body.classList.remove('dnd-on');
    dockEl.classList.remove('in');
    dockEl.hidden = true;
    dragClickBlock = true;
    setTimeout(() => { dragClickBlock = false; }, 0);
    drag = null;
    if (drop && tg) dropOn(d.pane, tg);
    return;
  }
  drag = null;
}
async function dropOn(pane, tg) {
  let body, where;
  if (tg.kind === 'pane') {
    body = tg.how === 'swap' ? { mode: 'swap', target: tg.pane } : { mode: 'beside', target: tg.pane, dir: tg.how };
    where = paneLabel(tg.pane);
  } else if (tg.kind === 'tab') { body = { mode: 'split', tab: tg.tab }; where = placeName(tg.tab); }
  else if (tg.drop === 'workspace') { body = { mode: 'workspace' }; where = t('dndNewWs'); }
  else { const ws = tg.drop.slice(4); body = { mode: 'tab', workspace: ws }; where = t('dndNewTab', wsName(ws)); }
  const name = paneLabel(pane);
  const tile = tiles.get(pane);
  tile?.classList.add('moving');
  try {
    const r = await post(`/api/agents/${enc(pane)}/move`, body);
    if (r.pane !== pane) {
      if (drafts.has(pane)) { drafts.set(r.pane, drafts.get(pane)); drafts.delete(pane); }
      if (dismissed.has(pane)) { dismissed.set(r.pane, dismissed.get(pane)); dismissed.delete(pane); }
      if (selected === pane) { selected = r.pane; history.replaceState(null, '', '#' + enc(r.pane)); }
    }
    sfx('switch');
    toast(body.mode === 'swap' ? t('dndSwapped', name, where) : t('moved', name, where));
    meta = { ...meta, ...(await call('/api/meta').catch(() => ({}))) };
    await refresh();
  } catch (err) { toast(errText(err), true); }
  finally { tile?.classList.remove('moving'); }
}
mapEl.addEventListener('pointerdown', e => {
  if (e.button !== 0 || drag) return;
  const tile = e.target.closest('.tile[data-pane]');
  if (!tile || tile.classList.contains('locked')) return;
  const touch = e.pointerType !== 'mouse';
  drag = { pane: tile.dataset.pane, tile, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pointerId: e.pointerId, touch, armed: false, target: null };
  if (touch) drag.timer = setTimeout(() => { if (drag && !drag.armed) startDrag(); }, DND_HOLD);
});
addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.armed) {
    const far = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > (drag.touch ? 10 : DND_SLOP);
    if (!far) return;
    if (drag.touch) { endDrag(false); return; } // moved before the hold: it's a scroll
    startDrag();
  }
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);
  paintTarget(findTarget(e.clientX, e.clientY));
});
addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pointerId) endDrag(true); });
addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pointerId) endDrag(false); });
// While dragging on a touch screen the page must not scroll under the finger.
addEventListener('touchmove', e => { if (drag?.armed || bdrag?.armed) e.preventDefault(); }, { passive: false });
mapEl.addEventListener('contextmenu', e => { if (drag) e.preventDefault(); });
mapEl.addEventListener('click', e => { if (dragClickBlock) { e.stopPropagation(); e.preventDefault(); } }, true);
addEventListener('keydown', e => { if (e.key === 'Escape' && drag?.armed) { e.stopPropagation(); endDrag(false); } }, true);
mapEl.addEventListener('dragstart', e => e.preventDefault()); // no native image/link drag

// ─── Reorder the map: drag a tab box by its header ────────────────────────────
// Mouse: drag after a few pixels. Touch: long-press the header. Drop on another box: before it
// (left half) or after it (right half). The order is ORCA's own (herdr can't reorder), saved
// on the server so every device shows the same map. Admins only.
var bdrag = null; // { block, tab, x0, y0, x, y, pointerId, touch, armed, ghost, timer, target }
function bTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  const b = el?.closest?.('.tabblock[data-tab]');
  if (!b || b === bdrag.block || !mapEl.contains(b)) return null;
  const r = b.getBoundingClientRect();
  return { el: b, side: x - r.left < r.width / 2 ? 'before' : 'after' };
}
function bPaint(tg) {
  const old = bdrag.target;
  if (old?.el === tg?.el && old?.side === tg?.side) return;
  old?.el.classList.remove('bdrop-before', 'bdrop-after');
  bdrag.target = tg;
  tg?.el.classList.add('bdrop-' + tg.side);
}
function bStart() {
  bdrag.armed = true;
  hidePeek();
  if (bdrag.touch && navigator.vibrate) navigator.vibrate(12);
  const r = bdrag.block.getBoundingClientRect();
  const w = Math.min(r.width, 300), h = Math.min(r.height, 150);
  const g = bdrag.block.cloneNode(true);
  g.classList.add('bdnd-ghost'); g.setAttribute('aria-hidden', 'true');
  Object.assign(g.style, { width: w + 'px', height: h + 'px' });
  bdrag.dx = Math.min(bdrag.x0 - r.left, w - 16); bdrag.dy = Math.min(bdrag.y0 - r.top, 24);
  document.body.append(g);
  bdrag.ghost = g;
  bdrag.block.classList.add('bdragging');
  document.body.classList.add('dnd-on');
  bMove();
  bScroll();
}
function bMove() { bdrag.ghost.style.transform = `translate(${Math.round(bdrag.x - bdrag.dx)}px, ${Math.round(bdrag.y - bdrag.dy)}px) rotate(-1deg)`; }
function bScroll() {
  if (!bdrag?.armed) return;
  const edge = 56, y = bdrag.y;
  const v = y < edge ? -(edge - y) / 5 : y > innerHeight - edge ? (y - (innerHeight - edge)) / 5 : 0;
  if (v) { scrollBy(0, Math.max(-12, Math.min(12, v))); bPaint(bTarget(bdrag.x, bdrag.y)); }
  requestAnimationFrame(bScroll);
}
function bEnd(drop) {
  if (!bdrag) return;
  clearTimeout(bdrag.timer);
  const d = bdrag;
  if (d.armed) {
    const tg = d.target;
    bPaint(null);
    d.ghost?.remove();
    d.block.classList.remove('bdragging');
    document.body.classList.remove('dnd-on');
    bdrag = null;
    if (drop && tg) saveOrder(d.tab, tg.el.dataset.tab, tg.side);
    return;
  }
  bdrag = null;
}
async function saveOrder(tab, target, side) {
  const ids = [...mapEl.children].map(b => b.dataset?.tab).filter(Boolean).filter(id => id !== tab);
  const at = ids.indexOf(target);
  if (at < 0) return;
  ids.splice(side === 'after' ? at + 1 : at, 0, tab);
  const before = mapOrder;
  mapOrder = ids; orderPending = true;
  renderMap(); fitMap(true);
  try {
    const r = await post('/api/map/order', { order: ids });
    mapOrder = r.mapOrder || ids;
    sfx('switch');
    toast(t('orderSaved'));
  } catch (err) { mapOrder = before; renderMap(); toast(errText(err), true); }
  finally { orderPending = false; }
}
mapEl.addEventListener('pointerdown', e => {
  if (e.button !== 0 || bdrag || drag || !access.admin) return;
  const head = e.target.closest('.tabhead');
  if (!head || e.target.closest('.trename')) return;
  const block = head.closest('.tabblock[data-tab]');
  if (!block) return;
  const touch = e.pointerType !== 'mouse';
  bdrag = { block, tab: block.dataset.tab, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pointerId: e.pointerId, touch, armed: false, target: null };
  if (touch) bdrag.timer = setTimeout(() => { if (bdrag && !bdrag.armed) bStart(); }, DND_HOLD);
});
addEventListener('pointermove', e => {
  if (!bdrag || e.pointerId !== bdrag.pointerId) return;
  bdrag.x = e.clientX; bdrag.y = e.clientY;
  if (!bdrag.armed) {
    if (Math.hypot(e.clientX - bdrag.x0, e.clientY - bdrag.y0) <= (bdrag.touch ? 10 : DND_SLOP)) return;
    if (bdrag.touch) { bEnd(false); return; }
    bStart();
  }
  e.preventDefault();
  bMove();
  bPaint(bTarget(e.clientX, e.clientY));
});
addEventListener('pointerup', e => { if (bdrag && e.pointerId === bdrag.pointerId) bEnd(true); });
addEventListener('pointercancel', e => { if (bdrag && e.pointerId === bdrag.pointerId) bEnd(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && bdrag?.armed) { e.stopPropagation(); bEnd(false); } }, true);

// ─── Rename a workspace and/or a tab (pencil on a tab's header, admins only) ──
const renameDialog = $('#rename-dialog');
const renameForm = $('#rename-form');
let renameTab = null;
function openRename(tabId) {
  const tb = tabs.find(x => x.id === tabId);
  if (!tb) return;
  renameTab = tabId;
  const w = workspaces.find(x => x.id === tb.ws);
  renameForm.elements.ws.value = w?.label || '';
  renameForm.elements.ws.placeholder = wsName(tb.ws);
  renameForm.elements.tab.value = tb.label || '';
  renameForm.elements.tab.placeholder = tabName(tabId);
  renameDialog.showModal();
  renameForm.elements.ws.select();
}
renameForm.querySelector('[value="cancel"]').addEventListener('click', () => renameDialog.close());
renameForm.addEventListener('submit', async e => {
  e.preventDefault();
  const tb = tabs.find(x => x.id === renameTab);
  if (!tb) return renameDialog.close();
  const wsNew = renameForm.elements.ws.value.trim(), tabNew = renameForm.elements.tab.value.trim();
  const w = workspaces.find(x => x.id === tb.ws);
  const jobs = [];
  if (wsNew && wsNew !== (w?.label || '')) jobs.push(post(`/api/workspaces/${enc(tb.ws)}/rename`, { label: wsNew }));
  if (tabNew && tabNew !== (tb.label || '')) jobs.push(post(`/api/tabs/${enc(tb.id)}/rename`, { label: tabNew }));
  if (!jobs.length) return renameDialog.close();
  const submit = renameForm.querySelector('[type="submit"]');
  submit.disabled = true; submit.textContent = t('rnSaving');
  try {
    await Promise.all(jobs);
    renameDialog.close();
    toast(t('rnDone', `${wsNew || wsName(tb.ws)} / ${tabNew || tabName(tb.id)}`));
    meta = { ...meta, ...(await call('/api/meta').catch(() => ({}))) };
    await refresh();
  } catch (err) { toast(errText(err), true); }
  finally { submit.disabled = false; submit.textContent = t('rnSave'); }
});

// ─── Move dialog ──────────────────────────────────────────────────────────────
// Destinations grouped by workspace: a new tab there, or beside an existing tab's panes;
// last, a new workspace. The agent keeps running; it comes back with a new pane id.
const moveDialog = $('#move-dialog');
const moveForm = $('#move-form');

function fillMove(a) {
  const sel = moveForm.elements.to;
  const groups = meta.workspaces.map(w => {
    const g = document.createElement('optgroup');
    g.label = wsName(w.id, meta.workspaces);
    // Each option names its workspace: a closed phone select shows only the option text.
    g.append(new Option(`${g.label} / ${t('moveNewTab')}`, 'tab:' + w.id));
    for (const x of meta.tabs.filter(tb => tb.ws === w.id && tb.id !== a.tab)) {
      g.append(new Option(`${g.label} / ${t('moveBeside', x.label || t('tab', x.number))}`, 'split:' + x.id));
    }
    return g;
  });
  sel.replaceChildren(...groups, new Option(t('moveNewWs'), 'workspace'));
  // Default: a new tab in the first other workspace (the usual reason to move).
  const ws = wsOf(a.tab);
  const other = meta.workspaces.find(w => w.id !== ws);
  sel.value = other ? 'tab:' + other.id : 'workspace';
  moveForm.elements.label.value = a.name || '';
  // Moving the only pane of the only tab closes that workspace: say so before it happens.
  const own = tabs.find(tb => tb.id === a.tab);
  const last = (own?.panes.length ?? 1) <= 1 && tabs.filter(tb => tb.ws === ws).length <= 1;
  const warn = $('#move-last');
  warn.hidden = !last;
  if (last) warn.textContent = t('moveLast', wsName(ws));
  syncMoveLabel();
}
function syncMoveLabel() { $('#move-label').hidden = moveForm.elements.to.value !== 'workspace'; }
moveForm.elements.to.addEventListener('change', syncMoveLabel);

$('#sheet-move').addEventListener('click', async () => {
  const a = byPane.get(selected);
  if (!a) return;
  try { meta = { ...meta, ...(await call('/api/meta')) }; } catch { /* keep last meta */ }
  $('#move-title').textContent = t('moveTitle', label(a));
  fillMove(a);
  moveDialog.showModal();
  moveForm.elements.to.focus();
});
moveForm.querySelector('[value="cancel"]').addEventListener('click', () => moveDialog.close());
moveForm.addEventListener('submit', async e => {
  e.preventDefault();
  const from = selected;
  const a = byPane.get(from);
  if (!a) return moveDialog.close();
  const to = moveForm.elements.to.value;
  const opt = moveForm.elements.to.selectedOptions[0];
  const [mode, ...rest] = to.split(':');
  const target = rest.join(':');
  const body = mode === 'split' ? { mode, tab: target } : mode === 'tab' ? { mode, workspace: target } : { mode, label: moveForm.elements.label.value.trim() };
  const where = mode === 'workspace' ? (body.label || label(a)) : opt.textContent;
  const submit = moveForm.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = t('moving');
  try {
    const r = await post(`/api/agents/${enc(from)}/move`, body);
    moveDialog.close();
    // Same agent, new pane id: carry the draft and keep its panel open.
    if (drafts.has(from)) { drafts.set(r.pane, drafts.get(from)); drafts.delete(from); }
    if (dismissed.has(from)) { dismissed.set(r.pane, dismissed.get(from)); dismissed.delete(from); }
    if (selected === from) { selected = r.pane; history.replaceState(null, '', '#' + enc(r.pane)); }
    toast(t('moved', label(a), where));
    meta = { ...meta, ...(await call('/api/meta').catch(() => ({}))) };
    await refresh();
  } catch (err) { toast(errText(err), true); }
  finally { submit.disabled = false; submit.textContent = t('move'); }
});

// ─── LLM keys (header): API keys for the agents in ~/.config/operio-orca/llm.env ─────
// The server only ever returns names and the last 4 characters. Apply = `operio-orca llm
// apply`: a herdr restart, refused (409 with the names) while any agent works or asks.
const llmDlg = $('#llm-dialog');
let llmKeys = [], llmDemo = false, llmFile = '~/.config/operio-orca/llm.env';
function renderLlm() {
  const ul = $('#llm-list');
  $('#llm-intro').textContent = t('llmIntro', llmFile);
  ul.replaceChildren(...(llmKeys.length ? llmKeys.map(k => {
    const li = el('li', 'llm-row');
    li.append(el('code', null, k.name), el('span', 'llm-hint', k.hint));
    const rm = el('button', 'btn small', t('llmRemove'));
    rm.type = 'button';
    rm.setAttribute('aria-label', t('llmRemoveOf', k.name));
    rm.addEventListener('click', async () => {
      rm.disabled = true;
      try { llmKeys = (await post('/api/llm/unset', { name: k.name })).keys || []; toast(t('llmRemoved', k.name)); renderLlm(); }
      catch (err) { rm.disabled = false; toast(errText(err), true); }
    });
    li.append(rm);
    return li;
  }) : [el('li', 'llm-empty', t(llmDemo ? 'llmDemo' : 'llmNone'))]));
  for (const x of llmDlg.querySelectorAll('input, .primary, #llm-apply')) x.disabled = llmDemo;
}
async function openLlm() {
  try { const r = await call('/api/llm'); llmKeys = r.keys || []; llmDemo = !!r.demo; if (r.file) llmFile = r.file; }
  catch (err) { toast(errText(err), true); return; }
  $('#llm-form').reset();
  renderLlm();
  llmDlg.showModal();
}
$('#llm-btn').addEventListener('click', openLlm);
$('#llm-form [value=cancel]').addEventListener('click', () => llmDlg.close());
document.addEventListener('operio-orca:lang', () => { if (llmDlg.open) renderLlm(); }); // the intro and list are drawn here, not by data-i18n
$('#llm-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const name = String(fd.get('name') || '').trim().toUpperCase();
  const value = String(fd.get('value') || '');
  const btn = f.querySelector('.primary');
  btn.disabled = true;
  try {
    llmKeys = (await post('/api/llm/set', { name, value })).keys || [];
    f.reset();
    toast(t('llmSaved', name));
    renderLlm();
  } catch (err) { toast(errText(err), true); }
  finally { btn.disabled = llmDemo; }
});
$('#llm-apply').addEventListener('click', async () => {
  const b = $('#llm-apply');
  b.disabled = true;
  b.textContent = t('llmApplying');
  try {
    const res = await fetch('/api/llm/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && j.error === 'busy') toast(t('llmBusy', (j.agents || []).join(', ')), true, 7000);
    else if (!res.ok) toast(errText(new Error(j.error || 'generic')), true);
    else {
      const key = { restarted: 'llmApplied', not_running: 'llmNotRunning', not_managed: 'llmNotManaged' }[j.result] || 'llmApplied';
      toast(t(key), j.result === 'not_managed', 7000);
      if (j.result === 'restarted') { sfx('sent'); setTimeout(refresh, 1500); }
    }
  } catch { toast(t('offline'), true); }
  finally { b.disabled = llmDemo; b.textContent = t('llmApply'); }
});

// ─── Phone alerts (Web Push) ─────────────────────────────────────────────────
function b64ToBytes(b64) {
  const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
const pushSupported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function syncBell() {
  let on = false;
  if (pushSupported()) {
    const reg = await navigator.serviceWorker.ready;
    on = !!(await reg.pushManager.getSubscription()) && Notification.permission === 'granted';
  }
  $('#bell').setAttribute('aria-pressed', String(on));
}

$('#bell').addEventListener('click', async () => {
  if (!pushSupported()) return toast(t('alertsNeedHttps'), true, 6000);
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  try {
    if (existing && Notification.permission === 'granted') {
      await post('/api/push/unsubscribe', { endpoint: existing.endpoint }).catch(() => {});
      await existing.unsubscribe();
      toast(t('alertsOff'));
    } else {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return toast(t('alertsDenied'), true, 6000);
      if (!meta.vapidKey) meta = { ...meta, ...(await call('/api/meta')) };
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(meta.vapidKey) });
      await post('/api/push/subscribe', { subscription: sub.toJSON(), lang });
      await post('/api/push/test');
      toast(t('alertsOn'));
    }
  } catch (err) { toast(errText(err), true); }
  syncBell();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  try { meta = { ...meta, ...(await call('/api/meta')) }; } catch { /* offline: map still renders */ }
  buildKeys();
  setView(view);
  syncSound();
  applyLang();
  await refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(syncBell).catch(() => {});
})();
