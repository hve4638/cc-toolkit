// frame marker resolution — gate guardrails on a per-project marker file.
//
// A guardrail is active when its marker (e.g. .inlay, .ponytail) exists in the
// resolved cwd or any ancestor up to the filesystem root. The directory holding
// the marker is returned so a guardrail can use it as its root / upward-walk
// ceiling (e.g. inlay never looks for INLAY.md above its .inlay).

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Walk from startDir up to the filesystem root, returning the first directory
// that contains markerName, or null if none does.
export function findMarkerDir(startDir, markerName) {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, markerName))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

// The directory the gate walks up from. The hook payload's cwd is the session
// cwd; CLAUDE_PROJECT_DIR is the stable session root fallback.
export function resolveCwd(payload) {
  return (payload && payload.cwd) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}
