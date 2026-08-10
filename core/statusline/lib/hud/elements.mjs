/**
 * hud — the pieces of the line.
 *
 * Each function returns its segment or null when it has nothing to say; the
 * producer drops the nulls and joins what is left.
 */

import { homedir } from 'node:os';
import { basename } from 'node:path';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

/** Context usage bands: green below the first, yellow below the second, red at or above it. */
const CONTEXT_WARNING = 20;
const CONTEXT_COMPACT = 50;

/** Quota bands, in percent used. */
const QUOTA_WARNING = 70;
const QUOTA_CRITICAL = 90;

/** `📁 name`, the checkout's own name — `~` at home, `/` at the root. */
export function renderCwd(cwd) {
  if (!cwd) return null;
  if (cwd === homedir()) return '📁 ~';
  if (cwd === '/' || cwd === '\\') return '📁 /';
  return `📁 ${basename(cwd) || cwd}`;
}

/** The launch directory is gone — its worktree was destroyed under the session. */
export function renderCwdMissing() {
  return `📁 ${RED}missing${RESET}`;
}

/** `💻 Opus 5`, straight from the payload's display name. */
export function renderModel(modelName) {
  return modelName ? `💻 ${modelName}` : null;
}

function contextColor(percent) {
  if (percent >= CONTEXT_COMPACT) return RED;
  if (percent >= CONTEXT_WARNING) return YELLOW;
  return GREEN;
}

/** `📦 context:37%`, the percentage colored by band. */
export function renderContext(percent) {
  const safe = Math.min(100, Math.max(0, Math.round(percent)));
  return `📦 context:${contextColor(safe)}${safe}%${RESET}`;
}

function quotaColor(percent) {
  if (percent >= QUOTA_CRITICAL) return RED;
  if (percent >= QUOTA_WARNING) return YELLOW;
  return GREEN;
}

/**
 * Time until a reset, as `3h42m` or `2d5h`. Null once the moment has passed,
 * so a stale reset time simply drops off the line.
 */
export function formatResetTime(date) {
  if (!date) return null;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return null;

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return days > 0 ? `${days}d${hours % 24}h` : `${hours}h${minutes % 60}m`;
}

function quotaPart(label, percent, resetsAt) {
  const safe = Math.min(100, Math.max(0, Math.round(percent)));
  const reset = formatResetTime(resetsAt);
  const value = `${quotaColor(safe)}${safe}%${RESET}`;
  return `${label}${value}${reset ? `${DIM}(${reset})${RESET}` : ''}`;
}

/**
 * `⏳ 5h:19%(3h42m) wk:41%(2d5h)`; the weekly bucket appears only when sent.
 *
 * Claude Code fills the quota buckets from its own API responses, so a session
 * that has not had one yet sends none. That is a wait, not an absence, and it
 * ends on the first reply — hence `loading` rather than a blank stretch of line.
 */
export function renderLimits(limits) {
  if (!limits) return `⏳ ${DIM}loading...${RESET}`;

  const parts = [quotaPart('⏳ 5h:', limits.fiveHourPercent, limits.fiveHourResetsAt)];
  if (limits.weeklyPercent != null) {
    parts.push(quotaPart(`${DIM}wk:${RESET}`, limits.weeklyPercent, limits.weeklyResetsAt));
  }
  return parts.join(' ');
}
