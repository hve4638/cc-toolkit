/**
 * advertise — cache and consumption queue.
 *
 * Two files under `~/.agent-memory/global/`:
 *
 *   advertise-cache.json — { version, date, ads }
 *     Rescanned only when the local calendar date changes. An empty ads list is
 *     still cached so the same day is never rescanned. A version mismatch reads
 *     as corrupt and triggers a one-time same-day rescan.
 *
 *   advertise-queue.json — { queue, current, consumedAt }
 *     Ads rotate at most once per minute; an exhausted queue is refilled by
 *     reshuffling the cached ads, never by rescanning.
 *
 * No locking: writes are atomic (temp + rename), last writer wins. The base is
 * the home directory, which always exists, so this sits outside the project
 * `.agent-memory` guard in scripts/lib/agent-memory.mjs.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { getClaudeConfigDir } from '../../../scripts/lib/config-dir.mjs';
import { collectAds } from './collect.mjs';

const THROTTLE_MS = 60_000;

/** Bump when the ad shape changes; old caches then rescan once. */
const CACHE_SCHEMA_VERSION = 2;

/** Local calendar date as YYYY-MM-DD (midnight is the rescan boundary). */
function localDate(epochMs) {
  const date = new Date(epochMs);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function writeJsonAtomic(path, data) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    renameSync(tmp, path);
  } catch {
    // Losing the write costs a rescan next render, not the ad line.
  }
}

function isAdItem(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.skill !== 'string') return false;
  const { texts } = value;
  if (!texts || typeof texts !== 'object' || Array.isArray(texts)) return false;
  const entries = Object.values(texts);
  // Non-empty strings only: an empty text would render as `try /skill []`.
  return entries.length > 0 && entries.every((t) => typeof t === 'string' && t.length > 0);
}

function readCacheFile(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (!data
      || data.version !== CACHE_SCHEMA_VERSION
      || typeof data.date !== 'string'
      || !Array.isArray(data.ads)) {
      return null;
    }
    return { version: data.version, date: data.date, ads: data.ads.filter(isAdItem) };
  } catch {
    return null;
  }
}

function readQueueFile(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (!data || !Array.isArray(data.queue)) return null;
    if (data.current !== null && !isAdItem(data.current)) return null;
    if (typeof data.consumedAt !== 'number') return null;
    return { queue: data.queue.filter(isAdItem), current: data.current, consumedAt: data.consumedAt };
  } catch {
    return null;
  }
}

/** Fisher-Yates shuffle into a new array. */
function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The ad to display now, advancing the rotation state on disk.
 *
 * - Date changed (or no cache): rescan plugins, rewrite the cache, rebuild the
 *   queue from a fresh shuffle.
 * - Missing or corrupt queue: rebuild from the cached ads, no rescan.
 * - Within the one-minute throttle: return `current` without writing.
 * - Otherwise pop the next ad, reshuffling the cached ads when the queue runs
 *   out, and persist the new state.
 *
 * Returns null when no ads exist. The `deps` argument exists for tests.
 */
export function getNextAd(deps = {}) {
  const configDir = deps.configDir ?? getClaudeConfigDir();
  const globalDir = deps.globalDir ?? join(homedir(), '.agent-memory', 'global');
  const nowMs = (deps.now ?? Date.now)();
  const today = localDate(nowMs);

  const cachePath = join(globalDir, 'advertise-cache.json');
  const queuePath = join(globalDir, 'advertise-queue.json');

  let cache = readCacheFile(cachePath);
  let queue;

  if (!cache || cache.date !== today) {
    const ads = collectAds(configDir);
    cache = { version: CACHE_SCHEMA_VERSION, date: today, ads };
    writeJsonAtomic(cachePath, cache);
    queue = { queue: shuffle(ads), current: null, consumedAt: 0 };
  } else {
    queue = readQueueFile(queuePath) ?? { queue: shuffle(cache.ads), current: null, consumedAt: 0 };
  }

  if (cache.ads.length === 0) return null;

  // WHY: a future consumedAt (clock skew, corrupt state) would otherwise
  //      satisfy the throttle forever; treat negative age as expired.
  const age = nowMs - queue.consumedAt;
  if (queue.current && age >= 0 && age < THROTTLE_MS) return queue.current;

  if (queue.queue.length === 0) queue.queue = shuffle(cache.ads);
  const next = queue.queue.pop() ?? null;
  queue.current = next;
  queue.consumedAt = nowMs;
  writeJsonAtomic(queuePath, queue);
  return next;
}
