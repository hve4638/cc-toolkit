/**
 * advertise — collection.
 *
 * Scans enabled plugins for skill advertisements.
 *
 * Opt-in model:
 *   - A plugin advertises only if its root contains an `.advertisable` marker.
 *   - Each skill folder may contain an `.advertise` file with one ad text per
 *     line. A line starting with a language tag (`en: ...`, `ko: ...`) fills
 *     that language; the first untagged line becomes the language-neutral
 *     fallback (key "_"). A file without any tags therefore keeps the simple
 *     behaviour: its first line is the ad text.
 *
 * Only the latest installed version of each enabled plugin is scanned, the
 * same selection the statusline wrapper makes.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Reserved texts key for the language-neutral fallback line. */
export const FALLBACK_LANG = '_';

function parseSemver(version) {
  const text = String(version);
  const dash = text.indexOf('-');
  const base = dash === -1 ? text : text.slice(0, dash);
  const pre = dash === -1 ? '' : text.slice(dash + 1);
  const parts = base.split('.').map((part) => {
    const n = Number(part);
    return Number.isFinite(n) && part !== '' ? n : part;
  });
  return { parts, pre };
}

/**
 * Newest version first. A stable release beats a prerelease of the same
 * [major.minor.patch]. Mirrors the statusline wrapper's ordering — the two pick
 * the same version of a plugin.
 */
export function compareSemverDesc(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  const len = Math.max(left.parts.length, right.parts.length);
  for (let i = 0; i < len; i++) {
    const x = left.parts[i];
    const y = right.parts[i];
    if (x === y) continue;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    if (typeof x === 'number' && typeof y === 'number') return y - x;
    return String(y).localeCompare(String(x), undefined, { numeric: true });
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === '') return -1;
  if (right.pre === '') return 1;
  return right.pre.localeCompare(left.pre, undefined, { numeric: true });
}

/**
 * A language-tagged ad line: a 2-8 letter lowercase tag, a colon, then
 * whitespace before the text. Anything else (uppercase start, mid-line colon,
 * over-long word) is an ordinary sentence, not a tag.
 */
const LANG_TAG_RE = /^([a-z]{2,8}):\s+(.*)$/;

/**
 * Parse `.advertise` content into per-language ad texts.
 *
 * Tagged lines fill their language (first occurrence wins); the first untagged
 * non-empty line becomes the FALLBACK_LANG entry. Each text is trimmed and
 * stripped of C0 control chars + DEL so ad text can never smuggle ANSI escapes
 * into the terminal; lines left empty by that cleanup are skipped.
 */
export function parseAdvertiseTexts(raw) {
  // A plain object is safe here: a key is either a LANG_TAG_RE match — two to
  // eight lowercase letters — or FALLBACK_LANG, so `__proto__` never lands in
  // it. Lookups by a user-configured language go through render.mjs, which
  // checks own-property.
  const texts = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    // Strip before tag matching so a stray control char (e.g. "\x00en: x")
    // cannot demote a tagged line to fallback text with the tag visible.
    const line = rawLine.replace(/[\x00-\x1f\x7f]/g, '').trim();
    const tagMatch = line.match(LANG_TAG_RE);
    const lang = tagMatch ? tagMatch[1] : FALLBACK_LANG;
    if (texts[lang] !== undefined) continue;
    const text = (tagMatch ? tagMatch[2] : line).trim();
    if (!text) continue;
    texts[lang] = text;
  }
  return texts;
}

function collectPluginAds(pluginName, versionRoot) {
  const ads = [];
  const skillsDir = join(versionRoot, 'skills');
  let entries;
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return ads;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = readFileSync(join(skillsDir, entry.name, '.advertise'), 'utf-8');
      const texts = parseAdvertiseTexts(raw);
      if (Object.keys(texts).length === 0) continue;
      ads.push({ skill: `${pluginName}:${entry.name}`, texts });
    } catch { /* no .advertise in this skill */ }
  }
  return ads;
}

/**
 * Skill ads from every enabled plugin under the Claude config dir.
 *
 * Reads `settings.json` `enabledPlugins` (keys `<plugin>@<marketplace>`, value
 * `true`), then takes the latest version under
 * `<configDir>/plugins/cache/<marketplace>/<plugin>/`. Per-plugin errors are
 * swallowed so one broken plugin cannot block the rest.
 */
export function collectAds(configDir) {
  const ads = [];

  let enabled;
  try {
    enabled = JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf-8'))?.enabledPlugins;
  } catch {
    return ads;
  }
  if (!enabled || typeof enabled !== 'object' || Array.isArray(enabled)) return ads;

  for (const [key, value] of Object.entries(enabled)) {
    if (value !== true) continue;
    const at = key.lastIndexOf('@');
    if (at <= 0 || at === key.length - 1) continue;
    const plugin = key.slice(0, at);
    const marketplace = key.slice(at + 1);

    try {
      const base = join(configDir, 'plugins', 'cache', marketplace, plugin);
      const versions = readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      if (versions.length === 0) continue;
      const versionRoot = join(base, [...versions].sort(compareSemverDesc)[0]);
      if (!existsSync(join(versionRoot, '.advertisable'))) continue;
      ads.push(...collectPluginAds(plugin, versionRoot));
    } catch { /* plugin missing from cache or unreadable — skip */ }
  }

  return ads;
}
