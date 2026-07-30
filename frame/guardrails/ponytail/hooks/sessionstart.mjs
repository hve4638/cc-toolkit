// frame ponytail guardrail — SessionStart handler.
//
// The dispatcher has already confirmed a .ponytail marker in cwd→root before
// calling this, so the only job here is to inject the ponytail ruleset as
// session context. The marker's presence/absence is the per-project on/off, and
// there is no intensity switch — the skill body is injected as written.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = join(HERE, '..', '..', '..', 'skills', 'ponytail', 'SKILL.md');

export default async function sessionstart() {
  let raw;
  try {
    raw = readFileSync(SKILL_PATH, 'utf8');
  } catch {
    // SKILL.md missing/unreadable → nothing to inject, stay silent (fail-open).
    return null;
  }
  // Frontmatter is metadata for the skill loader, not instructions — drop it.
  const body = raw.replace(/^---[\s\S]*?---\s*/, '');
  return { context: `PONYTAIL MODE ACTIVE\n\n${body}` };
}
