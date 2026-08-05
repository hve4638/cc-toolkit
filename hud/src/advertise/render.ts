/**
 * HUD Advertise - Rendering
 *
 * Formats an ad as `try /<plugin>:<skill> [<text>]` with the skill
 * reference highlighted and the framing text dimmed. Language is resolved
 * here, at render time, so an advertiseLang config change takes effect
 * immediately without waiting for a cache rescan.
 */

import { dim, brightBlue } from "../hud/colors.js";
import { FALLBACK_LANG, type AdItem } from "./collect.js";

/**
 * Own-property string lookup. Guards against a lang value like
 * "constructor" or "__proto__" resolving an inherited property.
 */
function ownText(texts: Record<string, string>, key: string): string | null {
  if (!Object.hasOwn(texts, key)) return null;
  const value = texts[key];
  return typeof value === "string" ? value : null;
}

/**
 * Pick the ad text for the configured language.
 * Order: requested lang → untagged fallback → "en" → first available text.
 */
export function pickAdText(ad: AdItem, lang: string): string | null {
  const first = Object.values(ad.texts).find((t) => typeof t === "string");
  return (
    ownText(ad.texts, lang) ??
    ownText(ad.texts, FALLBACK_LANG) ??
    ownText(ad.texts, "en") ??
    first ??
    null
  );
}

/**
 * Render a single ad line with ANSI colors, or null when the item has no
 * text at all (the ad line is omitted for this render; the queue rotation
 * surfaces a different ad on the next consumption).
 */
export function renderAdLine(ad: AdItem, lang: string): string | null {
  const text = pickAdText(ad, lang);
  if (text === null) return null;
  return dim("try ") + brightBlue(`/${ad.skill}`) + dim(` [${text}]`);
}
