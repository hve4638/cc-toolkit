import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sessionstart from '../hooks/sessionstart.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('injects the skill body with the active banner', async () => {
  const out = await sessionstart({}, {});
  assert.ok(out && out.context, 'returns { context }');
  assert.ok(out.context.startsWith('SHOWCASE DISCIPLINE ACTIVE'));
  assert.ok(out.context.includes('## Checkpoint loop'), 'contains the skill body');
});

test('strips frontmatter from the injected body', async () => {
  const out = await sessionstart({}, {});
  assert.ok(!out.context.includes('description:'));
  assert.ok(!out.context.includes('---'));
});

test('returns null when SKILL.md is missing (fail-open)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  try {
    // Recreate the guardrails/<name>/hooks ↔ skills/<name> relative layout
    // the handler resolves against, but with no SKILL.md in it.
    const hooksDir = join(root, 'guardrails', 'showcase', 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    mkdirSync(join(root, 'skills', 'showcase'), { recursive: true });
    const copied = join(hooksDir, 'sessionstart.mjs');
    copyFileSync(join(HERE, '..', 'hooks', 'sessionstart.mjs'), copied);
    const mod = await import(pathToFileURL(copied).href);
    assert.equal(await mod.default({}, {}), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
