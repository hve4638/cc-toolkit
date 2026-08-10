/**
 * hud — git lookups.
 *
 * Every statusline render is its own process, so nothing is cached between
 * calls; each function is one short git invocation with a timeout.
 */

import { execSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';

const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';

function git(command, cwd) {
  try {
    const out = execSync(command, {
      cwd,
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32' ? 'cmd.exe' : undefined,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * The worktree root containing the given directory, or the directory itself
 * when it is not in a repository. The cwd element names the checkout, not
 * whichever subdirectory the session happened to start in.
 */
export function worktreeRootOf(directory) {
  const base = directory || process.cwd();
  return git('git rev-parse --show-toplevel', base) ?? base;
}

/**
 * The repository's name: what the origin remote calls it, otherwise the
 * directory holding the common git dir. `--git-common-dir` rather than
 * `--show-toplevel` so a linked worktree reports the main checkout's name
 * instead of repeating what the cwd element already shows.
 */
function repoNameOf(cwd) {
  const url = git('git remote get-url origin', cwd);
  if (url) {
    const match = url.match(/\/([^/]+?)(?:\.git)?$/) || url.match(/:([^/]+?)(?:\.git)?$/);
    if (match) return match[1].replace(/\.git$/, '');
  }

  const commonDir = git('git rev-parse --git-common-dir', cwd);
  if (!commonDir) return null;
  const resolved = resolve(cwd, commonDir);
  const leaf = basename(resolved);
  return (leaf === '.git' ? basename(dirname(resolved)) : leaf) || null;
}

/**
 * `🌿 repo(branch)`, with the short commit hash standing in for the branch on
 * a detached HEAD, and just the ref when the repository has no name to show.
 * Null outside a repository.
 */
export function renderGit(cwd) {
  const ref = git('git branch --show-current', cwd) ?? git('git rev-parse --short=7 HEAD', cwd);
  if (!ref) return null;

  const repo = repoNameOf(cwd);
  return `🌿 ${CYAN}${repo ? `${repo}(${ref})` : ref}${RESET}`;
}
