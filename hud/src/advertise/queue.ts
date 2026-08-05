/**
 * HUD Advertise - Cache & Consumption Queue
 *
 * Two-tier state under `~/.agent-memory/global/`:
 *
 *   advertise-cache.json — collection cache:
 *     { version: 2, date: "YYYY-MM-DD", ads: [...] }
 *     Rescanned only when the local calendar date changes. An empty ads list
 *     is still cached so the same day is never rescanned. A version mismatch
 *     (e.g. a pre-multilingual {skill, text} cache) reads as corrupt and
 *     triggers a one-time same-day rescan that rewrites the current schema.
 *
 *   advertise-queue.json — consumption queue:
 *     { queue: [...], current: AdItem|null, consumedAt: epoch ms }
 *     Ads rotate at most once per minute; an exhausted queue is refilled by
 *     reshuffling the cached ads (never by rescanning).
 *
 * No locking: writes are atomic (temp + rename), last writer wins.
 */

import { homedir } from "os";
import { join } from "path";
import { readFileSync } from "fs";
import { atomicWriteJsonSync } from "../lib/atomic-write.js";
import { getClaudeConfigDir } from "../utils/config-dir.js";
import { collectAds, type AdItem } from "./collect.js";

/** Injectable dependencies (defaults are the real environment). */
export interface AdvertiseDeps {
  /** Claude config dir (default: getClaudeConfigDir()). */
  configDir?: string;
  /** State dir for cache/queue files (default: ~/.agent-memory/global). */
  globalDir?: string;
  /** Clock (default: Date.now). */
  now?: () => number;
}

const THROTTLE_MS = 60_000;

/** Bump when the AdItem/cache shape changes; old caches then rescan once. */
const CACHE_SCHEMA_VERSION = 2;

interface CacheFile {
  version: number;
  date: string;
  ads: AdItem[];
}

interface QueueFile {
  queue: AdItem[];
  current: AdItem | null;
  consumedAt: number;
}

/** Local calendar date as YYYY-MM-DD (midnight is the rescan boundary). */
function localDate(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isAdItem(v: unknown): v is AdItem {
  if (!v || typeof v !== "object") return false;
  const item = v as AdItem;
  if (typeof item.skill !== "string") return false;
  if (!item.texts || typeof item.texts !== "object" || Array.isArray(item.texts)) {
    return false;
  }
  const entries = Object.values(item.texts);
  // Non-empty strings only: an empty text would render as `try /skill []`.
  return (
    entries.length > 0 &&
    entries.every((t) => typeof t === "string" && t.length > 0)
  );
}

function readCacheFile(path: string): CacheFile | null {
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    if (
      !data ||
      data.version !== CACHE_SCHEMA_VERSION ||
      typeof data.date !== "string" ||
      !Array.isArray(data.ads)
    ) {
      return null;
    }
    return { version: data.version, date: data.date, ads: data.ads.filter(isAdItem) };
  } catch {
    return null;
  }
}

function readQueueFile(path: string): QueueFile | null {
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    if (!data || !Array.isArray(data.queue)) return null;
    if (data.current !== null && !isAdItem(data.current)) return null;
    if (typeof data.consumedAt !== "number") return null;
    return {
      queue: data.queue.filter(isAdItem),
      current: data.current,
      consumedAt: data.consumedAt,
    };
  } catch {
    return null;
  }
}

/** Fisher-Yates shuffle into a new array. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Return the ad to display now, advancing the rotation state on disk.
 *
 * - Date changed (or no cache): rescan plugins, rewrite the cache, rebuild
 *   the queue from a fresh shuffle.
 * - Missing/corrupt queue: rebuild from the cached ads (no rescan).
 * - Within the 1-minute throttle: return `current` without writing.
 * - Otherwise pop the next ad (reshuffling the cached ads when the queue is
 *   exhausted) and persist the new state.
 *
 * Returns null when no ads exist. Throws are allowed; the caller silences.
 */
export function getNextAd(deps: AdvertiseDeps = {}): AdItem | null {
  const configDir = deps.configDir ?? getClaudeConfigDir();
  const globalDir =
    deps.globalDir ?? join(homedir(), ".agent-memory", "global");
  const nowMs = (deps.now ?? Date.now)();
  const today = localDate(nowMs);

  const cachePath = join(globalDir, "advertise-cache.json");
  const queuePath = join(globalDir, "advertise-queue.json");

  let cache = readCacheFile(cachePath);
  let queue: QueueFile | null = null;

  if (!cache || cache.date !== today) {
    const ads = collectAds(configDir);
    cache = { version: CACHE_SCHEMA_VERSION, date: today, ads };
    atomicWriteJsonSync(cachePath, cache);
    queue = { queue: shuffle(ads), current: null, consumedAt: 0 };
  } else {
    queue = readQueueFile(queuePath);
    if (!queue) {
      queue = { queue: shuffle(cache.ads), current: null, consumedAt: 0 };
    }
  }

  if (cache.ads.length === 0) return null;

  // WHY: a future consumedAt (clock skew, corrupt state) would otherwise
  //      satisfy the throttle forever; treat negative age as expired.
  const age = nowMs - queue.consumedAt;
  if (queue.current && age >= 0 && age < THROTTLE_MS) {
    return queue.current;
  }

  if (queue.queue.length === 0) {
    queue.queue = shuffle(cache.ads);
  }
  const next = queue.queue.pop() ?? null;
  queue.current = next;
  queue.consumedAt = nowMs;
  atomicWriteJsonSync(queuePath, queue);
  return next;
}
