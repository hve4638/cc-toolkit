/**
 * HUD Advertise - Entry Point
 *
 * Rotating one-line skill advertisements sourced from enabled plugins that
 * opt in with an `.advertisable` marker. See collect.ts (scan), queue.ts
 * (cache + rotation state), render.ts (formatting).
 */
import { getNextAd } from "./queue.js";
import { renderAdLine } from "./render.js";
/**
 * Return the colored ad line to append to the statusline, or null when
 * there is nothing to show. Never throws — the statusline must not break
 * because of advertising.
 */
export function getAdvertiseLine(opts = {}) {
    try {
        const ad = getNextAd(opts);
        return ad ? renderAdLine(ad, opts.lang ?? "en") : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=index.js.map