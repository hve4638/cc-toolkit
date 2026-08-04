#!/usr/bin/env node
/**
 * SessionStart Hook: inject personal/instruction.md as additionalContext.
 *
 * Fires on startup / compact / clear (resume excluded — transcript restore
 * already brings the prior injection back, so re-inject would duplicate).
 *
 * Fail-open: missing file or any error → no injection, hook returns OK.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!root) throw new Error('CLAUDE_PLUGIN_ROOT not set');
  const content = readFileSync(join(root, 'instruction.md'), 'utf8');
  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: content,
    },
  }));
} catch {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}
