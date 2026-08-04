#!/usr/bin/env node
/**
 * Relocate Claude Code auto memory to a stable location.
 *
 * Usage: node relocate-memory.mjs [target-path]
 *
 * Moves the legacy per-slug memory (~/.claude/projects/<slug>/memory/) and,
 * when settings already point somewhere else, that previous location to the
 * target directory, then points `autoMemoryDirectory` at it in the project's
 * .claude/settings.local.json — the main checkout's inside a git repo, so every
 * worktree of that repo reads it.
 *
 * Default target: in a git repo, ~/.agent-memory/<key>/memory where
 * <key> = <repo basename>-<root commit[:12]> — location-independent, so every
 * worktree/clone of the same history converges there and a repo move/rename
 * cannot orphan it. Outside git, <cwd>/.agent-memory/memory (the harness
 * treats the cwd as the project root outside a repo).
 * Rerunning after the project moved/renamed heals the stale absolute path.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync,
  renameSync, rmdirSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { ensureDir } from '../../../scripts/lib/agent-memory.mjs';

function git(...args) {
  const r = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf-8' });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

// 1. Project root — the main checkout root inside a git repo (--git-common-dir
//    converges on it even from a linked worktree, matching how auto memory is
//    shared per repo), else the cwd (official docs: "Outside a git repo, the
//    project root is used instead.").
const commonDir = git('rev-parse', '--git-common-dir');
const inGit = commonDir !== null;
let projectRoot;
if (inGit) {
  const commonDirAbs = resolve(process.cwd(), commonDir);
  projectRoot = basename(commonDirAbs) === '.git' ? dirname(commonDirAbs) : commonDirAbs;
  // The derived root must itself be a checkout — it is where the settings file
  // goes. Bare repos (including their worktrees), submodules and
  // --separate-git-dir all derive a git-internal or checkout-less path, and a
  // settings file there is one nobody reads. Refused rather than guessed at: in
  // a bare repo's worktree Claude Code was observed reading that worktree's own
  // settings, so there is no single file that would serve every worktree.
  if (git('-C', projectRoot, 'rev-parse', '--is-inside-work-tree') !== 'true') {
    console.error(`Cannot derive the main checkout root from ${commonDirAbs}.`);
    console.error('Bare repos, submodules and separate git dirs are not supported; run from a plain checkout or one of its worktrees.');
    process.exit(1);
  }
  // Refuses a cwd inside `.git`, which the removed --show-toplevel call used to
  // catch on its way to the settings path.
  if (git('rev-parse', '--is-inside-work-tree') !== 'true') {
    console.error('Not inside a git work tree; run from a checkout or worktree.');
    process.exit(1);
  }
} else {
  projectRoot = resolve(process.cwd());
}

// 2. Settings go to the project root — inside git that is the main checkout,
//    not the checkout you run in.
// WHY: Claude Code resolves `.claude/settings.local.json` at the canonical git
//      root even when the session runs in a linked worktree (the worktree's own
//      file is only a fallback the root value overrides), and the auto memory
//      directory is shared per repo. Writing at the root is what makes one run
//      cover every worktree — and survives destroying the worktree it ran in.
const settingsPath = join(projectRoot, '.claude', 'settings.local.json');

// 3. Target. For `~/` values the settings entry keeps the literal `~/` form
//    (autoMemoryDirectory accepts it); file operations use the expanded path.
const arg = process.argv[2];
let settingsValue;
let target;
if (arg) {
  if (arg === '~') {
    settingsValue = '~/';
    target = homedir();
  } else if (arg.startsWith('~/')) {
    settingsValue = arg;
    target = join(homedir(), arg.slice(2));
  } else if (arg.startsWith('~')) {
    console.error(`Unsupported path argument: ${arg} (~user expansion is not supported).`);
    process.exit(1);
  } else if (isAbsolute(arg)) {
    settingsValue = arg;
    target = arg;
  } else {
    target = resolve(projectRoot, arg);
    settingsValue = target;
  }
} else if (!inGit) {
  target = join(projectRoot, '.agent-memory', 'memory');
  settingsValue = target;
} else {
  // Default in a git repo: a key from the repo basename and the root commit —
  // location-independent, so every worktree/clone of the same history
  // converges on it. Accepted limits: a shallow clone's grafted root and an
  // orphan-branch HEAD yield a different key — rerunning heals via the
  // previous-source migration below.
  const roots = git('rev-list', '--max-parents=0', 'HEAD');
  if (roots === null) {
    console.error('Cannot derive the default target: HEAD has no commits yet.');
    console.error('Commit once, or pass an explicit target path argument.');
    process.exit(1);
  }
  const rootCommit = roots.split('\n').sort()[0]; // multiple root commits: deterministic pick
  const key = `${basename(projectRoot).replace(/[^A-Za-z0-9-]/g, '-')}-${rootCommit.slice(0, 12)}`;
  settingsValue = `~/.agent-memory/${key}/memory`;
  target = join(homedir(), '.agent-memory', key, 'memory');
}

// 4. Settings — read before any file moves so the previous autoMemoryDirectory
//    can serve as a migration source. Writing still happens only after all
//    moves succeed, so an aborted migration leaves settings pristine.
//    Never overwrite a file we cannot parse.
let settings = {};
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    settings = undefined;
  }
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    console.error(`Cannot use ${settingsPath} (not a JSON object); leaving it untouched.`);
    console.error(`Fix the JSON, then rerun. Intended value: "autoMemoryDirectory": "${settingsValue}"`);
    process.exit(1);
  }
}
const previous = settings.autoMemoryDirectory;

const slug = projectRoot.replace(/[^A-Za-z0-9-]/g, '-');
const legacyDir = join(homedir(), '.claude', 'projects', slug, 'memory');

// 5. Previous location as a second migration source — this is what heals a
//    stale absolute path after the project moved. Only `~/`-prefixed and
//    absolute forms are usable; anything else is skipped with a warning, not
//    guessed at.
const warnings = [];
let prevDir = null;
function containsOrEquals(ancestor, path) {
  const rel = relative(ancestor, path);
  return !rel.startsWith('..') && !isAbsolute(rel);
}
// Settings values worth acting on are `~/`-prefixed or absolute; null means a
// form this script will not guess at.
function expandSetting(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('~/')) return join(homedir(), value.slice(2));
  return isAbsolute(value) ? resolve(value) : null;
}
if (previous !== undefined) {
  const expanded = expandSetting(previous);
  if (expanded === null) {
    warnings.push(`previous autoMemoryDirectory has an unsupported form; not migrating from it: ${JSON.stringify(previous)}`);
  } else if (expanded === resolve(target)) {
    // Same as the target — idempotent rerun, nothing to migrate from it.
  } else if (expanded === legacyDir) {
    // Same directory as the legacy source — one source, not two.
  } else if (containsOrEquals(expanded, resolve(target))
    || containsOrEquals(expanded, legacyDir)
    || containsOrEquals(expanded, projectRoot)) {
    // WHY: moving an ancestor wholesale would swallow the target, the legacy
    //      memory, or the project itself along with unrelated files — a `~/`
    //      previous (written by `relocate-memory.mjs ~`) would move the entire
    //      home directory. The legacyDir check transitively covers homedir
    //      and ~/.claude. Refused, not resolved.
    warnings.push(`previous autoMemoryDirectory contains the target, the legacy memory, or the project root; not migrating from it: ${previous}`);
  } else if (containsOrEquals(resolve(target), expanded)) {
    // A descendant would churn files already inside the target.
    warnings.push(`previous autoMemoryDirectory is inside the target; not migrating from it: ${previous}`);
  } else if (existsSync(expanded) && !statSync(expanded).isDirectory()) {
    warnings.push(`previous autoMemoryDirectory is not a directory; not migrating from it: ${previous}`);
  } else {
    prevDir = expanded;
  }
}

// 5b. Worktree-local leftovers. Versions up to core 0.56.0 wrote the setting
//     into the checkout they ran in; the value written here overrides those, so
//     they are inert from now on. Only one pointing at memory this run leaves
//     behind is worth saying out loud — reported, not touched.
if (inGit) {
  const list = git('worktree', 'list', '--porcelain');
  for (const line of (list ?? '').split('\n')) {
    if (!line.startsWith('worktree ')) continue;
    const wtSettings = join(line.slice('worktree '.length), '.claude', 'settings.local.json');
    if (resolve(wtSettings) === resolve(settingsPath) || !existsSync(wtSettings)) continue;
    let wtValue;
    try {
      wtValue = JSON.parse(readFileSync(wtSettings, 'utf-8'))?.autoMemoryDirectory;
    } catch {
      continue;
    }
    const wtDir = expandSetting(wtValue);
    // Silent when it names the target or a source this run empties — nothing is
    // left there — and when the directory does not exist. Also silent on forms
    // this script will not expand: unlike `previous`, an inert leftover in an
    // odd form gives the user nothing to act on.
    if (wtDir === null || wtDir === resolve(target) || wtDir === prevDir
      || wtDir === legacyDir || !existsSync(wtDir)) continue;
    warnings.push(`a worktree keeps its own autoMemoryDirectory, now overridden; the memory there stays where it is: ${wtSettings} (${wtValue})`);
  }
}

function listFilesRecursive(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p, base));
    else out.push(relative(base, p));
  }
  return out;
}

function makeTarget() {
  const rel = relative(join(projectRoot, '.agent-memory'), target);
  if (!rel.startsWith('..') && !isAbsolute(rel)) {
    // Under the project's .agent-memory: creation must go through the lib so
    // the dead-workspace guard stays enforced in one place.
    return ensureDir(projectRoot, rel || '.');
  }
  try {
    // WHY: targets outside the project (e.g. the global ~/.agent-memory) are
    //      not project-scoped state, so the dead-workspace guard does not
    //      apply — plain mkdir suffices.
    mkdirSync(target, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// 6. Migration sources and all-or-nothing conflict check — any relative path
//    that collides across source↔target or source↔source aborts the whole run
//    before a single file moves, so no partial merge can happen.
const legacyFiles = existsSync(legacyDir) ? listFilesRecursive(legacyDir) : [];
const prevFiles = prevDir !== null && existsSync(prevDir) ? listFilesRecursive(prevDir) : [];
const targetFiles = existsSync(target) ? listFilesRecursive(target) : [];

const targetSet = new Set(targetFiles);
const legacySet = new Set(legacyFiles);
const conflicts = [];
for (const f of legacyFiles) {
  if (targetSet.has(f)) conflicts.push(`${f} (legacy vs target)`);
}
for (const f of prevFiles) {
  if (targetSet.has(f)) conflicts.push(`${f} (previous vs target)`);
  if (legacySet.has(f)) conflicts.push(`${f} (legacy vs previous)`);
}
if (conflicts.length > 0) {
  for (const w of warnings) console.error(`Warning: ${w}`);
  console.error('Conflicting file paths across memory locations; refusing to move anything.');
  console.error(`  legacy: ${legacyDir} (${legacyFiles.length} files)`);
  if (prevDir !== null) console.error(`  previous: ${prevDir} (${prevFiles.length} files)`);
  console.error(`  target: ${target} (${targetFiles.length} files)`);
  for (const c of conflicts) console.error(`  conflict: ${c}`);
  console.error('Resolve manually, then rerun. Settings were not modified.');
  process.exit(1);
}

if (!makeTarget()) {
  console.error(`Failed to create target directory: ${target}`);
  process.exit(1);
}

// 7. Move — cross-device safe (copy + unlink), recursing into subdirectories.
let movedCount = 0;
function moveTree(srcDir, dstDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      // WHY: the target root already passed the guard in makeTarget earlier
      // in this run, so subdirectories under it need no re-guard.
      mkdirSync(dst, { recursive: true });
      moveTree(src, dst);
      try { rmdirSync(src); } catch { /* best-effort */ }
    } else {
      copyFileSync(src, dst);
      unlinkSync(src);
      movedCount += 1;
    }
  }
}

function moveSource(label, srcDir, fileCount) {
  const before = movedCount;
  try {
    moveTree(srcDir, target);
    try { rmdirSync(srcDir); } catch { /* best-effort */ }
  } catch (err) {
    for (const w of warnings) console.error(`Warning: ${w}`);
    console.error(`Failed while moving ${label} memory: ${err.message}`);
    console.error(`  moved so far: ${movedCount - before} of ${fileCount} files`);
    console.error(`  source: ${srcDir}`);
    console.error(`  target: ${target}`);
    console.error('Settings were not modified.');
    process.exit(1);
  }
  return movedCount - before;
}

let legacyMoved = 0;
let prevMoved = 0;
if (legacyFiles.length > 0) legacyMoved = moveSource('legacy', legacyDir, legacyFiles.length);
if (prevFiles.length > 0) prevMoved = moveSource('previous', prevDir, prevFiles.length);

// 8. Settings write — only reached after every move succeeded.
let settingsReport;
if (previous === settingsValue) {
  settingsReport = `already set to ${settingsValue} (no change)`;
} else {
  settings.autoMemoryDirectory = settingsValue;
  mkdirSync(dirname(settingsPath), { recursive: true });
  const tmp = `${settingsPath}.tmp.${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(tmp, settingsPath);
  settingsReport = previous === undefined
    ? `autoMemoryDirectory set to ${settingsValue}`
    : `autoMemoryDirectory changed: ${previous} -> ${settingsValue}`;
}

// 9. Summary
console.log(`Memory target: ${target}`);
console.log(`Files migrated from legacy: ${legacyMoved}${legacyMoved > 0 ? ` (from ${legacyDir})` : ''}`);
if (prevDir !== null) {
  console.log(`Files migrated from previous location: ${prevMoved}${prevMoved > 0 ? ` (from ${prevDir})` : ''}`);
}
for (const w of warnings) console.log(`Warning: ${w}`);
console.log(`Settings: ${settingsPath} — ${settingsReport}`);
console.log('Takes effect from the next session; you may need to accept the project settings trust dialog.');
if (inGit) {
  console.log('Settings live at the main checkout, so every worktree of this repo reads this location.');
}
