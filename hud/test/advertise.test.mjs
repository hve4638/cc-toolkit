import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getAdvertiseLine } from "../dist/advertise/index.js";
import { getNextAd } from "../dist/advertise/queue.js";
import {
  collectAds,
  compareSemverDesc,
  parseAdvertiseTexts,
} from "../dist/advertise/collect.js";
import { pickAdText } from "../dist/advertise/render.js";

// ── fixtures ────────────────────────────────────────────────────────────

/** Build a fake Claude config dir with a plugin cache. */
function makeConfigDir(root, plugins) {
  const configDir = join(root, "claude-config");
  const enabledPlugins = {};
  for (const p of plugins) {
    enabledPlugins[`${p.name}@${p.marketplace ?? "mkt"}`] = p.enabled ?? true;
    for (const version of p.versions ?? ["1.0.0"]) {
      const versionRoot = join(
        configDir, "plugins", "cache", p.marketplace ?? "mkt", p.name, version,
      );
      mkdirSync(versionRoot, { recursive: true });
      if (p.advertisable ?? true) {
        writeFileSync(join(versionRoot, ".advertisable"), "");
      }
      for (const [skill, ad] of Object.entries(p.skills ?? {})) {
        const skillDir = join(versionRoot, "skills", skill);
        mkdirSync(skillDir, { recursive: true });
        if (ad !== null) writeFileSync(join(skillDir, ".advertise"), ad);
      }
    }
  }
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, "settings.json"), JSON.stringify({ enabledPlugins }));
  return configDir;
}

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "hud-advertise-test-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

/** Deps for getNextAd/getAdvertiseLine pointing inside the tmp dir. */
function makeDeps(root, configDir, nowMs) {
  return {
    configDir,
    globalDir: join(root, "agent-memory-global"),
    now: () => nowMs,
  };
}

const DAY1_NOON = new Date(2026, 0, 1, 12, 0, 0).getTime();
const DAY2_NOON = new Date(2026, 0, 2, 12, 0, 0).getTime();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ── collect ─────────────────────────────────────────────────────────────

test("collectAds: first scan gathers ads from enabled advertisable plugins", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief", vt: "Drive terminals" } },
    ]);
    const ads = collectAds(configDir);
    assert.deepEqual(
      ads.map((a) => a.skill).sort(),
      ["core:brief", "core:vt"],
    );
    assert.deepEqual(
      ads.find((a) => a.skill === "core:brief").texts,
      { _: "One-line brief" },
    );
  });
});

test("collectAds: plugins without .advertisable marker are skipped", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "Yes" } },
      { name: "quiet", advertisable: false, skills: { loud: "Should not appear" } },
      { name: "disabled", enabled: false, skills: { x: "Also hidden" } },
    ]);
    const ads = collectAds(configDir);
    assert.deepEqual(ads.map((a) => a.skill), ["core:brief"]);
  });
});

test("collectAds: parses per line, first untagged line becomes the fallback", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      {
        name: "core",
        skills: {
          multi: "\n\n  First line here\nsecond line ignored\n",
          blank: "   \n\t\n",
        },
      },
    ]);
    const ads = collectAds(configDir);
    assert.deepEqual(ads, [{ skill: "core:multi", texts: { _: "First line here" } }]);
  });
});

test("parseAdvertiseTexts: language tags, fallback, and false-positive guard", () => {
  // Tagged lines fill their language; first untagged line is the fallback.
  assert.deepEqual(
    parseAdvertiseTexts("en: English ad\nko: 한국어 광고\nNeutral line\nSecond neutral"),
    { en: "English ad", ko: "한국어 광고", _: "Neutral line" },
  );
  // First occurrence wins per language.
  assert.deepEqual(
    parseAdvertiseTexts("en: First\nen: Second"),
    { en: "First" },
  );
  // Ordinary sentences with colons are not tags: uppercase start, mid-line
  // colon, over-long word, single letter.
  assert.deepEqual(parseAdvertiseTexts("Note: not a tag"), { _: "Note: not a tag" });
  assert.deepEqual(parseAdvertiseTexts("Use vt: it is fast"), { _: "Use vt: it is fast" });
  assert.deepEqual(
    parseAdvertiseTexts("verylongword: not a tag"),
    { _: "verylongword: not a tag" },
  );
  assert.deepEqual(parseAdvertiseTexts("x: not a tag"), { _: "x: not a tag" });
  // Tag requires whitespace after the colon.
  assert.deepEqual(parseAdvertiseTexts("en:no space"), { _: "en:no space" });
  // C0 control chars are stripped inside tagged text too.
  assert.deepEqual(
    parseAdvertiseTexts("en: \x1b[31mRed\x1b[0m alert\x07 text"),
    { en: "[31mRed[0m alert text" },
  );
  // Strip runs before tag matching: a stray control char cannot demote a
  // tagged line into fallback text with the tag visible.
  assert.deepEqual(parseAdvertiseTexts("\x00en: clean tag"), { en: "clean tag" });
  // And stripping does not turn a non-tag sentence into a tag.
  assert.deepEqual(
    parseAdvertiseTexts("\x07Note: still not a tag"),
    { _: "Note: still not a tag" },
  );
});

test("pickAdText: prototype keys in advertiseLang resolve nothing inherited", () => {
  const texts = { en: "english" };
  assert.equal(pickAdText({ skill: "s", texts }, "constructor"), "english");
  assert.equal(pickAdText({ skill: "s", texts }, "__proto__"), "english");
  assert.equal(pickAdText({ skill: "s", texts }, "toString"), "english");
});

test("pickAdText: selection order lang → fallback → en → first entry", () => {
  const texts = { fr: "français", en: "english", _: "neutral", ko: "한국어" };
  assert.equal(pickAdText({ skill: "s", texts }, "ko"), "한국어");
  assert.equal(
    pickAdText({ skill: "s", texts: { fr: "français", en: "english", _: "neutral" } }, "ko"),
    "neutral",
  );
  assert.equal(
    pickAdText({ skill: "s", texts: { fr: "français", en: "english" } }, "ko"),
    "english",
  );
  assert.equal(pickAdText({ skill: "s", texts: { fr: "français" } }, "ko"), "français");
  assert.equal(pickAdText({ skill: "s", texts: {} }, "ko"), null);
});

test("collectAds: control characters are stripped from ad text", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      {
        name: "core",
        skills: {
          sneaky: "\x1b[31mRed\x1b[0m alert\x07 text\r",
          onlyctl: "\x07\x1b\x00 \x08",
        },
      },
    ]);
    const ads = collectAds(configDir);
    assert.deepEqual(ads, [
      { skill: "core:sneaky", texts: { _: "[31mRed[0m alert text" } },
    ]);
  });
});

test("collectAds: only the latest semver version dir is scanned", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", versions: ["0.9.0"], skills: { old: "Old ad" } },
    ]);
    // Newer version with a different skill set (no fixture helper: build by hand)
    const newRoot = join(configDir, "plugins", "cache", "mkt", "core", "0.10.0");
    mkdirSync(join(newRoot, "skills", "fresh"), { recursive: true });
    writeFileSync(join(newRoot, ".advertisable"), "");
    writeFileSync(join(newRoot, "skills", "fresh", ".advertise"), "New ad");
    const ads = collectAds(configDir);
    assert.deepEqual(ads, [{ skill: "core:fresh", texts: { _: "New ad" } }]);
  });
});

test("compareSemverDesc: numeric ordering and prerelease handling", () => {
  const sorted = ["1.0.1-alpha", "0.9.0", "1.0.1", "0.10.0"].sort(compareSemverDesc);
  assert.deepEqual(sorted, ["1.0.1", "1.0.1-alpha", "0.10.0", "0.9.0"]);
});

// ── queue / cache ───────────────────────────────────────────────────────

test("first call scans, writes cache and queue, returns an ad", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    const ad = getNextAd(deps);
    assert.deepEqual(ad, { skill: "core:brief", texts: { _: "One-line brief" } });

    const cache = readJson(join(deps.globalDir, "advertise-cache.json"));
    assert.equal(cache.version, 2);
    assert.equal(cache.date, "2026-01-01");
    assert.equal(cache.ads.length, 1);

    const queue = readJson(join(deps.globalDir, "advertise-queue.json"));
    assert.deepEqual(queue.current, ad);
    assert.equal(queue.consumedAt, DAY1_NOON);
  });
});

test("same date: no rescan even when plugins changed on disk", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    getNextAd(deps);

    // Change the ad on disk; same-day calls must keep serving the cached one.
    writeFileSync(
      join(configDir, "plugins", "cache", "mkt", "core", "1.0.0", "skills", "brief", ".advertise"),
      "Changed text",
    );
    const later = { ...deps, now: () => DAY1_NOON + 2 * 60_000 };
    assert.deepEqual(getNextAd(later).texts, { _: "One-line brief" });
  });
});

test("date change: rescans and rebuilds the queue", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    getNextAd(makeDeps(root, configDir, DAY1_NOON));

    writeFileSync(
      join(configDir, "plugins", "cache", "mkt", "core", "1.0.0", "skills", "brief", ".advertise"),
      "Next-day text",
    );
    const deps2 = makeDeps(root, configDir, DAY2_NOON);
    assert.deepEqual(getNextAd(deps2).texts, { _: "Next-day text" });
    assert.equal(
      readJson(join(deps2.globalDir, "advertise-cache.json")).date,
      "2026-01-02",
    );
  });
});

test("throttle: within 1 minute the current ad is returned without a write", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { a: "Ad A", b: "Ad B" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    const first = getNextAd(deps);
    const queuePath = join(deps.globalDir, "advertise-queue.json");
    const before = readFileSync(queuePath, "utf-8");

    const within = { ...deps, now: () => DAY1_NOON + 59_000 };
    assert.deepEqual(getNextAd(within), first);
    assert.equal(readFileSync(queuePath, "utf-8"), before);

    const after = { ...deps, now: () => DAY1_NOON + 61_000 };
    assert.notDeepEqual(getNextAd(after), first);
  });
});

test("exhausted queue refills by reshuffling cached ads (no rescan)", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { a: "Ad A", b: "Ad B" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      const ad = getNextAd({ ...deps, now: () => DAY1_NOON + i * 2 * 60_000 });
      assert.ok(ad, `pop ${i} returned an ad`);
      seen.add(ad.skill);
    }
    assert.deepEqual([...seen].sort(), ["core:a", "core:b"]);
  });
});

test("zero ads: cache is still written (no same-day rescan), returns null", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "quiet", advertisable: false, skills: { x: "Hidden" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    assert.equal(getNextAd(deps), null);
    const cache = readJson(join(deps.globalDir, "advertise-cache.json"));
    assert.deepEqual(cache.ads, []);
    assert.equal(existsSync(join(deps.globalDir, "advertise-queue.json")), false);
  });
});

test("future consumedAt does not lock the throttle forever", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { a: "Ad A", b: "Ad B" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    getNextAd(deps);
    const queuePath = join(deps.globalDir, "advertise-queue.json");
    // Simulate clock skew: consumedAt an hour in the future.
    const state = readJson(queuePath);
    state.consumedAt = DAY1_NOON + 60 * 60_000;
    writeFileSync(queuePath, JSON.stringify(state));

    // now < consumedAt → negative age must fall through to normal consumption.
    const skewed = { ...deps, now: () => DAY1_NOON + 1000 };
    const ad = getNextAd(skewed);
    assert.ok(ad);
    assert.equal(readJson(queuePath).consumedAt, DAY1_NOON + 1000);
  });
});

test("corrupt queue file is silently rebuilt from the cache", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    getNextAd(deps);
    const queuePath = join(deps.globalDir, "advertise-queue.json");
    writeFileSync(queuePath, "{ not json !!");
    const later = { ...deps, now: () => DAY1_NOON + 2 * 60_000 };
    assert.deepEqual(getNextAd(later), {
      skill: "core:brief",
      texts: { _: "One-line brief" },
    });
    assert.equal(readJson(queuePath).current.skill, "core:brief");
  });
});

test("old-schema cache (v1 {skill,text}) rescans once even on the same date", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    mkdirSync(deps.globalDir, { recursive: true });
    const cachePath = join(deps.globalDir, "advertise-cache.json");
    writeFileSync(
      cachePath,
      JSON.stringify({
        date: "2026-01-01",
        ads: [{ skill: "core:old", text: "Old schema ad" }],
      }),
    );
    assert.deepEqual(getNextAd(deps), {
      skill: "core:brief",
      texts: { _: "One-line brief" },
    });
    // Cache is rewritten in the current schema — no repeat rescan later.
    const cache = readJson(cachePath);
    assert.equal(cache.version, 2);
    assert.deepEqual(cache.ads[0].texts, { _: "One-line brief" });
  });
});

test("old-schema queue items are dropped and the queue rebuilds from the cache", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    getNextAd(deps);
    const queuePath = join(deps.globalDir, "advertise-queue.json");
    writeFileSync(
      queuePath,
      JSON.stringify({
        queue: [{ skill: "core:old", text: "Old schema ad" }],
        current: { skill: "core:old", text: "Old schema ad" },
        consumedAt: DAY1_NOON,
      }),
    );
    const later = { ...deps, now: () => DAY1_NOON + 1000 };
    assert.deepEqual(getNextAd(later), {
      skill: "core:brief",
      texts: { _: "One-line brief" },
    });
  });
});

test("corrupt cache file triggers a rescan instead of an error", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    const deps = makeDeps(root, configDir, DAY1_NOON);
    mkdirSync(deps.globalDir, { recursive: true });
    writeFileSync(join(deps.globalDir, "advertise-cache.json"), "broken");
    assert.deepEqual(getNextAd(deps), {
      skill: "core:brief",
      texts: { _: "One-line brief" },
    });
  });
});

// ── entry point ─────────────────────────────────────────────────────────

test("getAdvertiseLine: renders colored line and never throws", async () => {
  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, [
      { name: "core", skills: { brief: "One-line brief" } },
    ]);
    const line = getAdvertiseLine(makeDeps(root, configDir, DAY1_NOON));
    assert.equal(
      line,
      "\x1b[2mtry \x1b[0m\x1b[94m/core:brief\x1b[0m\x1b[2m [One-line brief]\x1b[0m",
    );
    // Missing config dir entirely (fresh state dir) — silently null.
    assert.equal(
      getAdvertiseLine({
        configDir: join(root, "nope"),
        globalDir: join(root, "fresh-global"),
        now: () => DAY1_NOON,
      }),
      null,
    );
  });
});
