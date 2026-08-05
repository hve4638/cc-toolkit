/**
 * HUD Advertise - Rendering
 *
 * Formats an ad as `try /<plugin>:<skill> [<text>]` with the skill
 * reference highlighted and the framing text dimmed. Language is resolved
 * here, at render time, so an advertiseLang config change takes effect
 * immediately without waiting for a cache rescan.
 */
import { type AdItem } from "./collect.js";
/**
 * Pick the ad text for the configured language.
 * Order: requested lang → untagged fallback → "en" → first available text.
 */
export declare function pickAdText(ad: AdItem, lang: string): string | null;
/**
 * Render a single ad line with ANSI colors, or null when the item has no
 * text at all (the ad line is omitted for this render; the queue rotation
 * surfaces a different ad on the next consumption).
 */
export declare function renderAdLine(ad: AdItem, lang: string): string | null;
