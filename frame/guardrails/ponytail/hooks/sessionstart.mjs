// frame ponytail guardrail — SessionStart handler.
//
// The dispatcher has already confirmed a .ponytail marker in cwd→root before
// calling this, so the only job here is to inject the ponytail ruleset as
// session context. Level is fixed at `full`: frame ships no runtime level
// switch, and the marker's presence/absence is the per-project on/off that
// replaces upstream's global `off` mode. Filtering to `full` drops the lite/
// ultra table rows and examples so the injected ruleset is a single, unambiguous
// intensity.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterSkillBodyForMode } from '../lib/filter-skill.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = join(HERE, '..', '..', '..', 'skills', 'ponytail', 'SKILL.md');
const MODE = 'full';

export default async function sessionstart() {
  let body;
  try {
    body = readFileSync(SKILL_PATH, 'utf8');
  } catch {
    // SKILL.md missing/unreadable → nothing to inject, stay silent (fail-open).
    return null;
  }
  const text = `PONYTAIL MODE ACTIVE — level: ${MODE}\n\n${filterSkillBodyForMode(body, MODE)}`;
  return { context: text };
}
