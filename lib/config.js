'use strict';

// ORCA configuration: everything comes from OPERIO_ORCA_* environment variables, with
// safe defaults. Nothing here is secret; secrets (VAPID keys) are generated into CONFIG_DIR.

const os = require('os');
const path = require('path');

// Unix socket paths are limited (~104 bytes on macOS, 108 on Linux). When the config folder
// is too deep for one, the agent socket goes in a private folder under the temp dir instead.
function agentSock(env, configDir) {
  if (env.OPERIO_ORCA_AGENT_SOCK) return env.OPERIO_ORCA_AGENT_SOCK;
  const inConfig = path.join(configDir, 'agents.sock');
  if (Buffer.byteLength(inConfig) <= 100) return inConfig;
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  return path.join(os.tmpdir(), `operio-orca-${uid}`, 'agents.sock');
}

function load(env = process.env) {
  const HOME = env.HOME || os.homedir();
  const CONFIG_DIR = env.OPERIO_ORCA_CONFIG_DIR || path.join(HOME, '.config', 'operio-orca');
  const host = (env.OPERIO_ORCA_HOST || '127.0.0.1').trim();
  const port = Number(env.OPERIO_ORCA_PORT || 7171);
  // Extra Host names the page may be reached by (e.g. a `tailscale serve` or reverse-proxy name).
  // Comma separated, host only or host:port. localhost/127.0.0.1/[::1] are always allowed.
  const allowedHosts = (env.OPERIO_ORCA_ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return {
    HOME,
    CONFIG_DIR,
    HOST: host,
    PORT: port,
    ALLOWED_HOSTS: allowedHosts,
    HERDR: env.OPERIO_ORCA_HERDR_BIN || path.join(HOME, '.local', 'share', 'operio-orca', 'bin', 'herdr'),
    HERDR_FALLBACK: env.OPERIO_ORCA_HERDR_BIN ? null : path.join(HOME, '.local', 'bin', 'herdr'),
    AGENT_SOCK: agentSock(env, CONFIG_DIR),
    STATE_FILE: path.join(CONFIG_DIR, 'state.json'),
    VAPID_FILE: path.join(CONFIG_DIR, 'vapid.json'),
    LLM_FILE: path.join(CONFIG_DIR, 'llm.env'), // API keys for the agents, loaded into herdr (lib/llm.js)
    ROUTINES_DIR: env.OPERIO_ORCA_ROUTINES_DIR || path.join(CONFIG_DIR, 'routines'),
    ROUTINES_STATE: path.join(CONFIG_DIR, 'routines-state.json'),
    DRAFTS_DIR: path.join(CONFIG_DIR, 'drafts'),
    REPORTS_DIR: path.join(CONFIG_DIR, 'reports'),
    LOGS_DIR: path.join(CONFIG_DIR, 'logs'),
    JOURNAL_DIR: path.join(CONFIG_DIR, 'journal'),
    JOURNAL_DAYS: Number(env.OPERIO_ORCA_JOURNAL_DAYS || 90),
    POLL_MS: Number(env.OPERIO_ORCA_POLL_MS || 4000),
    MIN_WORK_MS: Number(env.OPERIO_ORCA_MIN_WORK_SEC || 15) * 1000,
    FOLDERS: (env.OPERIO_ORCA_FOLDERS || '~').split(',').map(s => s.trim()).filter(Boolean),
    SHELL_UNLOCK_MS: Number(env.OPERIO_ORCA_SHELL_CONFIRM_MIN || 15) * 60e3,
    LINK_HOURLY: Number(env.OPERIO_ORCA_LINK_HOURLY || 30),
    VAPID_SUBJECT: env.OPERIO_ORCA_VAPID_SUBJECT || 'https://make.operio.work',
    ROUTINE_TICK_MS: Number(env.OPERIO_ORCA_ROUTINE_TICK_MS || 30000),
    // ORCA Host only: team chat (threads, the team room, @agent, translation). Set by ORCA Host
    // on the instances it runs; the free panel has no chat UI or API.
    HOSTED: env.OPERIO_ORCA_HOSTED === '1',
    CHAT_DIR: path.join(CONFIG_DIR, 'chat'),
    CHAT_ASKS_PERSON: Number(env.OPERIO_ORCA_CHAT_ASKS_PERSON || 5), // @agent requests per person per hour
    CHAT_ASKS_AGENT: Number(env.OPERIO_ORCA_CHAT_ASKS_AGENT || 5),   // … per agent per hour
    CHAT_QUEUE: Number(env.OPERIO_ORCA_CHAT_QUEUE || 5),             // waiting per agent
    // ORCA Host signs who is using the panel with this secret (lib/identity.js). Unset: single user.
    IDENTITY_SECRET: (env.OPERIO_ORCA_IDENTITY_SECRET || '').trim(),
    // Chat translation EN <-> ES: relay (ORCA Host translates; TRANSLATE_URL + the identity secret),
    // anthropic (Claude Haiku 5.5 with OPERIO_ORCA_TRANSLATE_KEY or ANTHROPIC_API_KEY),
    // ollama (a local model) | off. Default: relay when a relay URL is set, else anthropic.
    TRANSLATE: (env.OPERIO_ORCA_TRANSLATE || (env.OPERIO_ORCA_TRANSLATE_URL && env.OPERIO_ORCA_IDENTITY_SECRET ? 'relay' : 'anthropic')).trim(),
    TRANSLATE_KEY: (env.OPERIO_ORCA_TRANSLATE_KEY || '').trim(),
    TRANSLATE_MODEL: (env.OPERIO_ORCA_TRANSLATE_MODEL || '').trim(),
    TRANSLATE_URL: (env.OPERIO_ORCA_TRANSLATE_URL || '').trim(),
  };
}

module.exports = { load };
