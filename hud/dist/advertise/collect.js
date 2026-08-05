/**
 * HUD Advertise - Collection
 *
 * Scans enabled plugins for skill advertisements.
 *
 * Opt-in model:
 *   - A plugin advertises only if its root contains an `.advertisable` marker.
 *   - Each skill folder may contain an `.advertise` file with one ad text per
 *     line. A line starting with a language tag (`en: ...`, `ko: ...`) fills
 *     that language; the first untagged line becomes the language-neutral
 *     fallback (key "_"). A file without any tags therefore keeps the old
 *     behaviour: its first line is the fallback ad text.
 *
 * Only the latest installed semver version of each enabled plugin is scanned,
 * mirroring the version selection of the hud.mjs wrapper.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
/** Reserved texts key for the language-neutral fallback line. */
export const FALLBACK_LANG = "_";
/**
 * Parse a semver-ish version string into numeric parts and prerelease tag.
 * Mirrors the hud.mjs wrapper's parseSemver (keep behaviour in sync).
 */
function parseSemver(v) {
    const [core, pre = ""] = String(v).split("-", 2);
    const parts = core.split(".").map((p) => {
        const n = Number(p);
        return Number.isFinite(n) ? n : p;
    });
    return { parts, pre };
}
/**
 * Sort comparator: newest version first. A stable release with the same
 * [major.minor.patch] beats any prerelease so `1.0.1` sorts above `1.0.1-alpha`.
 * Mirrors the hud.mjs wrapper's compareSemverDesc (keep behaviour in sync).
 */
export function compareSemverDesc(a, b) {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    const len = Math.max(pa.parts.length, pb.parts.length);
    for (let i = 0; i < len; i++) {
        const ai = pa.parts[i];
        const bi = pb.parts[i];
        if (ai === bi)
            continue;
        if (ai === undefined)
            return 1;
        if (bi === undefined)
            return -1;
        if (typeof ai === "number" && typeof bi === "number")
            return bi - ai;
        return String(bi).localeCompare(String(ai), undefined, { numeric: true });
    }
    if (pa.pre === pb.pre)
        return 0;
    if (pa.pre === "")
        return -1;
    if (pb.pre === "")
        return 1;
    // numeric: true so `rc.10` sorts above `rc.2`.
    return pb.pre.localeCompare(pa.pre, undefined, { numeric: true });
}
/**
 * A language-tagged ad line: a 2-8 letter lowercase tag, a colon, then
 * whitespace before the text. Anything else (uppercase start, mid-line
 * colon, over-long word) is an ordinary sentence, not a tag.
 */
const LANG_TAG_RE = /^([a-z]{2,8}):\s+(.*)$/;
/**
 * Parse `.advertise` content into per-language ad texts.
 *
 * Tagged lines fill their language (first occurrence wins); the first
 * untagged non-empty line becomes the FALLBACK_LANG entry. Each text is
 * trimmed and stripped of C0 control chars + DEL so ad text can never
 * smuggle ANSI escapes into the terminal in non-safe mode; lines left
 * empty by that cleanup are skipped.
 */
export function parseAdvertiseTexts(raw) {
    const texts = {};
    for (const rawLine of raw.split(/\r?\n/)) {
        // Strip before tag matching so a stray control char (e.g. "\x00en: x")
        // cannot demote a tagged line to fallback text with the tag visible.
        const line = rawLine.replace(/[\x00-\x1f\x7f]/g, "").trim();
        const tagMatch = line.match(LANG_TAG_RE);
        const lang = tagMatch ? tagMatch[1] : FALLBACK_LANG;
        if (texts[lang] !== undefined)
            continue;
        const text = (tagMatch ? tagMatch[2] : line).trim();
        if (!text)
            continue;
        texts[lang] = text;
    }
    return texts;
}
/**
 * Collect `.advertise` entries from a single plugin version root.
 */
function collectPluginAds(pluginName, versionRoot) {
    const ads = [];
    const skillsDir = join(versionRoot, "skills");
    let entries;
    try {
        entries = readdirSync(skillsDir, { withFileTypes: true });
    }
    catch {
        return ads;
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        try {
            const raw = readFileSync(join(skillsDir, entry.name, ".advertise"), "utf-8");
            const texts = parseAdvertiseTexts(raw);
            if (Object.keys(texts).length === 0)
                continue;
            ads.push({ skill: `${pluginName}:${entry.name}`, texts });
        }
        catch {
            /* no .advertise in this skill */
        }
    }
    return ads;
}
/**
 * Scan all enabled plugins under the Claude config dir for skill ads.
 *
 * Reads `settings.json` `enabledPlugins` (keys `<plugin>@<marketplace>`,
 * value `true`), then for each plugin looks at the latest version under
 * `<configDir>/plugins/cache/<marketplace>/<plugin>/`. Per-plugin errors
 * are swallowed so one broken plugin cannot block the rest.
 */
export function collectAds(configDir) {
    const ads = [];
    let enabled;
    try {
        const settings = JSON.parse(readFileSync(join(configDir, "settings.json"), "utf-8"));
        enabled = settings?.enabledPlugins;
    }
    catch {
        return ads;
    }
    if (!enabled || typeof enabled !== "object" || Array.isArray(enabled)) {
        return ads;
    }
    for (const [key, value] of Object.entries(enabled)) {
        if (value !== true)
            continue;
        const at = key.lastIndexOf("@");
        if (at <= 0 || at === key.length - 1)
            continue;
        const plugin = key.slice(0, at);
        const marketplace = key.slice(at + 1);
        try {
            const base = join(configDir, "plugins", "cache", marketplace, plugin);
            const versions = readdirSync(base, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
            if (versions.length === 0)
                continue;
            const latest = [...versions].sort(compareSemverDesc)[0];
            const versionRoot = join(base, latest);
            if (!existsSync(join(versionRoot, ".advertisable")))
                continue;
            ads.push(...collectPluginAds(plugin, versionRoot));
        }
        catch {
            /* plugin missing from cache or unreadable — skip */
        }
    }
    return ads;
}
//# sourceMappingURL=collect.js.map