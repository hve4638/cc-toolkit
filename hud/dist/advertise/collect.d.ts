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
/** Reserved texts key for the language-neutral fallback line. */
export declare const FALLBACK_LANG = "_";
/** A single skill advertisement. */
export interface AdItem {
    /** Skill reference in `<plugin>:<skill-folder>` form, e.g. `core:brief`. */
    skill: string;
    /** One-line ad text per language tag; FALLBACK_LANG holds the untagged line. */
    texts: Record<string, string>;
}
/**
 * Sort comparator: newest version first. A stable release with the same
 * [major.minor.patch] beats any prerelease so `1.0.1` sorts above `1.0.1-alpha`.
 * Mirrors the hud.mjs wrapper's compareSemverDesc (keep behaviour in sync).
 */
export declare function compareSemverDesc(a: string, b: string): number;
/**
 * Parse `.advertise` content into per-language ad texts.
 *
 * Tagged lines fill their language (first occurrence wins); the first
 * untagged non-empty line becomes the FALLBACK_LANG entry. Each text is
 * trimmed and stripped of C0 control chars + DEL so ad text can never
 * smuggle ANSI escapes into the terminal in non-safe mode; lines left
 * empty by that cleanup are skipped.
 */
export declare function parseAdvertiseTexts(raw: string): Record<string, string>;
/**
 * Scan all enabled plugins under the Claude config dir for skill ads.
 *
 * Reads `settings.json` `enabledPlugins` (keys `<plugin>@<marketplace>`,
 * value `true`), then for each plugin looks at the latest version under
 * `<configDir>/plugins/cache/<marketplace>/<plugin>/`. Per-plugin errors
 * are swallowed so one broken plugin cannot block the rest.
 */
export declare function collectAds(configDir: string): AdItem[];
