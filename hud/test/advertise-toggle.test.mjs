import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_HUD_CONFIG } from "../dist/hud/types.js";
import { readHudConfig } from "../dist/hud/state.js";

const HUD_ENTRY = fileURLToPath(new URL("../dist/hud/index.js", import.meta.url));

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "hud-adtoggle-test-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

/** Config dir with one advertisable plugin/skill and optional hveHud settings. */
function makeConfigDir(root, hveHud, adContent = "One-line brief") {
  const configDir = join(root, "claude-config");
  const skillDir = join(
    configDir, "plugins", "cache", "mkt", "core", "1.0.0", "skills", "brief",
  );
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(configDir, "plugins", "cache", "mkt", "core", "1.0.0", ".advertisable"),
    "",
  );
  writeFileSync(join(skillDir, ".advertise"), adContent);
  const settings = { enabledPlugins: { "core@mkt": true } };
  if (hveHud) settings.hveHud = hveHud;
  writeFileSync(join(configDir, "settings.json"), JSON.stringify(settings));
  return configDir;
}

function runHud(root, configDir) {
  const home = join(root, "home");
  mkdirSync(home, { recursive: true });
  const stdout = execFileSync(process.execPath, [HUD_ENTRY], {
    input: JSON.stringify({ cwd: root, model: { display_name: "Opus" } }),
    env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: configDir },
    encoding: "utf-8",
  });
  return stdout.replace(/\n$/, "").split("\n");
}

test("default config merge includes advertise: true", async () => {
  assert.equal(DEFAULT_HUD_CONFIG.elements.advertise, true);

  await withTmpDir((root) => {
    const configDir = makeConfigDir(root, { elements: { gitBranch: false } });
    const prev = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = configDir;
    try {
      // hveHud present without advertise → default true survives the merge.
      assert.equal(readHudConfig().elements.advertise, true);
      writeFileSync(
        join(configDir, "settings.json"),
        JSON.stringify({ hveHud: { elements: { advertise: false } } }),
      );
      assert.equal(readHudConfig().elements.advertise, false);
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = prev;
    }
  });
});

test("elements.advertise: false drops the ad line from hud output", async () => {
  await withTmpDir((root) => {
    const onLines = runHud(root, makeConfigDir(root, undefined));
    assert.equal(onLines.length, 2, "default output has hud line + ad line");
    assert.match(onLines[1], /try .*\/core:brief/);

    const offLines = runHud(
      root,
      makeConfigDir(root, { elements: { advertise: false } }),
    );
    assert.equal(offLines.length, 1, "opt-out output has only the hud line");
    // Rest of the output is byte-identical to the default run's hud line.
    assert.equal(offLines[0], onLines[0]);
  });
});

test("elements.advertiseLang: 'ko' selects the Korean ad text", async () => {
  await withTmpDir((root) => {
    const tagged = "en: English ad\nko: 한국어 광고";
    const koLines = runHud(
      root,
      makeConfigDir(root, { elements: { advertiseLang: "ko" } }, tagged),
    );
    assert.equal(koLines.length, 2);
    assert.match(koLines[1], /한국어 광고/);
    assert.doesNotMatch(koLines[1], /English ad/);
  });
});
