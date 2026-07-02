// frame showcase guardrail — SessionStart handler.
//
// The dispatcher has already confirmed a .showcase marker in cwd→root before
// calling this, so the only job here is to inject the showcase discipline as
// session context. The skill body is the single source of truth; frontmatter
// is discovery metadata and is stripped before injection.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = join(HERE, '..', '..', '..', 'skills', 'showcase', 'SKILL.md');

export default async function sessionstart() {
  let body;
  try {
    body = readFileSync(SKILL_PATH, 'utf8');
  } catch {
    // SKILL.md missing/unreadable → nothing to inject, stay silent (fail-open).
    return null;
  }
  const withoutFrontmatter = body.replace(/^---[\s\S]*?---\s*/, '');
  return { context: `SHOWCASE DISCIPLINE ACTIVE\n\n${withoutFrontmatter}` };
}
