'use strict';

// Free-ORCA configuration: everything comes from FREE_ORCA_* environment variables, with
// safe defaults. Nothing here is secret; secrets (VAPID keys) are generated into CONFIG_DIR.

const os = require('os');
const path = require('path');

// Unix socket paths are limited (~104 bytes on macOS, 108 on Linux). When the config folder
// is too deep for one, the agent socket goes in a private folder under the temp dir instead.
function agentSock(env, configDir) {
  if (env.FREE_ORCA_AGENT_SOCK) return env.FREE_ORCA_AGENT_SOCK;
  const inConfig = path.join(configDir, 'agents.sock');
  if (Buffer.byteLength(inConfig) <= 100) return inConfig;
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  return path.join(os.tmpdir(), `free-orca-${uid}`, 'agents.sock');
}

function load(env = process.env) {
  const HOME = env.HOME || os.homedir();
  const CONFIG_DIR = env.FREE_ORCA_CONFIG_DIR || path.join(HOME, '.config', 'free-orca');
  const host = (env.FREE_ORCA_HOST || '127.0.0.1').trim();
  const port = Number(env.FREE_ORCA_PORT || 7171);
  // Extra Host names the page may be reached by (e.g. a `tailscale serve` or reverse-proxy name).
  // Comma separated, host only or host:port. localhost/127.0.0.1/[::1] are always allowed.
  const allowedHosts = (env.FREE_ORCA_ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return {
    HOME,
    CONFIG_DIR,
    HOST: host,
    PORT: port,
    ALLOWED_HOSTS: allowedHosts,
    HERDR: env.FREE_ORCA_HERDR_BIN || path.join(HOME, '.local', 'share', 'free-orca', 'bin', 'herdr'),
    HERDR_FALLBACK: env.FREE_ORCA_HERDR_BIN ? null : path.join(HOME, '.local', 'bin', 'herdr'),
    AGENT_SOCK: agentSock(env, CONFIG_DIR),
    STATE_FILE: path.join(CONFIG_DIR, 'state.json'),
    VAPID_FILE: path.join(CONFIG_DIR, 'vapid.json'),
    ROUTINES_DIR: env.FREE_ORCA_ROUTINES_DIR || path.join(CONFIG_DIR, 'routines'),
    ROUTINES_STATE: path.join(CONFIG_DIR, 'routines-state.json'),
    DRAFTS_DIR: path.join(CONFIG_DIR, 'drafts'),
    REPORTS_DIR: path.join(CONFIG_DIR, 'reports'),
    LOGS_DIR: path.join(CONFIG_DIR, 'logs'),
    POLL_MS: Number(env.FREE_ORCA_POLL_MS || 4000),
    MIN_WORK_MS: Number(env.FREE_ORCA_MIN_WORK_SEC || 15) * 1000,
    FOLDERS: (env.FREE_ORCA_FOLDERS || '~').split(',').map(s => s.trim()).filter(Boolean),
    SHELL_UNLOCK_MS: Number(env.FREE_ORCA_SHELL_CONFIRM_MIN || 15) * 60e3,
    LINK_HOURLY: Number(env.FREE_ORCA_LINK_HOURLY || 30),
    VAPID_SUBJECT: env.FREE_ORCA_VAPID_SUBJECT || 'https://make.operio.work',
    ROUTINE_TICK_MS: Number(env.FREE_ORCA_ROUTINE_TICK_MS || 30000),
  };
}

module.exports = { load };
