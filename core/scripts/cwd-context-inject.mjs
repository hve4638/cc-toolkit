#!/usr/bin/env node
/**
 * SessionStart Hook: inject <cwd>/AGENTS.cwd.md and <cwd>/CLAUDE.cwd.md
 * as additionalContext.
 *
 * cwd-only context: unlike CLAUDE.md, these files are read only from the
 * exact directory the session started in — sessions opened in subdirectories
 * do not inherit them (that inheritance is what these files exist to avoid).
 *
 * Fires on startup / compact / clear (resume excluded — transcript restore
 * already brings the prior injection back, so re-inject would duplicate).
 *
 * Fail-open: no files or any error → no injection, hook returns OK.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readHookPayload } from './lib/corelib.mjs';

// AGENTS first, CLAUDE second — tool-specific content is read last,
// mirroring the general→specific order of CLAUDE.md loading.
const FILES = ['AGENTS.cwd.md', 'CLAUDE.cwd.md'];

try {
  // empty/invalid stdin → null — fall back below
  const data = await readHookPayload() ?? {};
  const cwd = typeof data.cwd === 'string' && data.cwd ? data.cwd : process.cwd();

  const parts = [];
  for (const name of FILES) {
    const path = join(cwd, name);
    try {
      const body = readFileSync(path, 'utf8');
      // Label each file the way the CLAUDE.md chain does ("Contents of <path>:"),
      // so the model can tell where the text came from — hook outputs are
      // concatenated without separators, leaving unlabeled text
      // indistinguishable from the neighboring injection.
      parts.push(`Contents of ${path}:\n\n${body}`);
    } catch { /* absent — skip */ }
  }

  if (parts.length === 0) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
  } else {
    process.stdout.write(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: parts.join('\n\n'),
      },
    }));
  }
} catch {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}
