/**
 * advertise — rendering.
 *
 * Formats an ad as `try /<plugin>:<skill> [<text>]` with the skill reference
 * highlighted and the framing text dimmed. Language is resolved here, at render
 * time, so changing the configured language takes effect immediately without
 * waiting for a cache rescan.
 */

import { FALLBACK_LANG } from './collect.mjs';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BRIGHT_BLUE = '\x1b[94m';

/**
 * Own-property string lookup. Guards against a lang value like "constructor"
 * or "__proto__" resolving an inherited property.
 */
function ownText(texts, key) {
  if (!Object.hasOwn(texts, key)) return null;
  const value = texts[key];
  return typeof value === 'string' ? value : null;
}

/**
 * The ad text for the configured language.
 * Order: requested lang → untagged fallback → "en" → first available text.
 */
export function pickAdText(ad, lang) {
  const first = Object.values(ad.texts).find((t) => typeof t === 'string');
  return ownText(ad.texts, lang)
    ?? ownText(ad.texts, FALLBACK_LANG)
    ?? ownText(ad.texts, 'en')
    ?? first
    ?? null;
}

/**
 * One ad line with ANSI colors, or null when the item has no text at all — the
 * ad line is then omitted and the rotation surfaces a different ad next time.
 */
export function renderAdLine(ad, lang) {
  const text = pickAdText(ad, lang);
  if (text === null) return null;
  return `${DIM}try ${RESET}${BRIGHT_BLUE}/${ad.skill}${RESET}${DIM} [${text}]${RESET}`;
}
