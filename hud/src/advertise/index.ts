/**
 * HUD Advertise - Entry Point
 *
 * Rotating one-line skill advertisements sourced from enabled plugins that
 * opt in with an `.advertisable` marker. See collect.ts (scan), queue.ts
 * (cache + rotation state), render.ts (formatting).
 */

import { getNextAd, type AdvertiseDeps } from "./queue.js";
import { renderAdLine } from "./render.js";

export type { AdvertiseDeps } from "./queue.js";
export type { AdItem } from "./collect.js";

export interface AdvertiseOptions extends AdvertiseDeps {
  /** Display language for ad text (default "en"); resolved at render time. */
  lang?: string;
}

/**
 * Return the colored ad line to append to the statusline, or null when
 * there is nothing to show. Never throws — the statusline must not break
 * because of advertising.
 */
export function getAdvertiseLine(opts: AdvertiseOptions = {}): string | null {
  try {
    const ad = getNextAd(opts);
    return ad ? renderAdLine(ad, opts.lang ?? "en") : null;
  } catch {
    return null;
  }
}
