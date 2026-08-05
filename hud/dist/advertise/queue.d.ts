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
import { type AdItem } from "./collect.js";
/** Injectable dependencies (defaults are the real environment). */
export interface AdvertiseDeps {
    /** Claude config dir (default: getClaudeConfigDir()). */
    configDir?: string;
    /** State dir for cache/queue files (default: ~/.agent-memory/global). */
    globalDir?: string;
    /** Clock (default: Date.now). */
    now?: () => number;
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
export declare function getNextAd(deps?: AdvertiseDeps): AdItem | null;
