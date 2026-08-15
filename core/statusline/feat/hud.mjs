/**
 * hud — the session at a glance, on one line:
 *
 *   📁 repo | 🌿 repo(branch) | ⏳ 5h:19%(3h42m) wk:41%(2d5h) | 📦 context:37% | 💻 Opus 5
 *
 * Turned on by `feat:hud` in the agentaddon statusline namespace. Everything comes
 * from the payload Claude Code hands the statusline plus a couple of git
 * lookups, so a render costs no network call.
 *
 * The line leads, so the band is high.
 */

import { existsSync } from 'node:fs';
import { renderGit, worktreeRootOf } from '../lib/hud/git.mjs';
import {
  renderContext,
  renderCwd,
  renderCwdMissing,
  renderLimits,
  renderModel,
} from '../lib/hud/elements.mjs';
import { contextPercentOf, modelNameOf, rateLimitsOf } from '../lib/hud/stdin.mjs';

const SEPARATOR = ' | ';

export const priority = 'high';

export function render(context) {
  const { stdin } = context;
  const launchDir = stdin?.cwd || undefined;

  // The launch directory outliving its worktree makes both the name and the
  // branch misleading — git would answer from wherever the process fell back
  // to — so one "missing" marker replaces the pair.
  const missing = !!launchDir && !existsSync(launchDir);
  const cwd = missing ? null : worktreeRootOf(launchDir);

  const parts = missing
    ? [renderCwdMissing()]
    : [renderCwd(cwd), renderGit(cwd)];

  parts.push(
    renderLimits(rateLimitsOf(stdin)),
    renderContext(contextPercentOf(stdin)),
    renderModel(modelNameOf(stdin)),
  );

  const line = parts.filter((part) => typeof part === 'string' && part).join(SEPARATOR);
  return line || null;
}
