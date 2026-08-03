#!/usr/bin/env node
/**
 * Relocate Claude Code auto memory into the repo.
 *
 * Usage: node relocate-memory.mjs [target-path]
 *
 * Moves the legacy per-slug memory (~/.claude/projects/<slug>/memory/) to the
 * target directory (default: <mainRoot>/.agent-memory/memory) and points
 * `autoMemoryDirectory` in <toplevel>/.claude/settings.local.json at it.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync,
  renameSync, rmdirSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { ensureDir } from '../../../scripts/lib/agent-memory.mjs';

function git(...args) {
  const r = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf-8' });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

// 1. Main checkout root — --git-common-dir converges on the main checkout
//    even from a linked worktree, matching how auto memory is shared per repo.
const commonDir = git('rev-parse', '--git-common-dir');
if (commonDir === null) {
  console.error('Not inside a git repository (git rev-parse --git-common-dir failed).');
  process.exit(1);
}
const commonDirAbs = resolve(process.cwd(), commonDir);
const mainRoot = basename(commonDirAbs) === '.git' ? dirname(commonDirAbs) : commonDirAbs;
// Submodules and --separate-git-dir leave a `.git` component in the derived
// root (e.g. <super>/.git/modules/<name>) — that is a git-internal path, not
// a checkout. Only plain checkouts/worktrees are supported.
if (mainRoot.split(sep).includes('.git')) {
  console.error(`Cannot derive the main checkout root from ${commonDirAbs}.`);
  console.error('Submodules and separate git dirs are not supported; run from a plain checkout or worktree.');
  process.exit(1);
}

// 2. Current checkout toplevel — settings live with the checkout you run in.
const toplevel = git('rev-parse', '--show-toplevel');
if (toplevel === null) {
  console.error('Not inside a git work tree (git rev-parse --show-toplevel failed).');
  process.exit(1);
}
const settingsPath = join(toplevel, '.claude', 'settings.local.json');

// 3. Target. For `~/` arguments the settings value keeps the literal `~/` form
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
    target = resolve(mainRoot, arg);
    settingsValue = target;
  }
} else {
  target = join(mainRoot, '.agent-memory', 'memory');
  settingsValue = target;
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function makeTarget() {
  const rel = relative(join(mainRoot, '.agent-memory'), target);
  if (!rel.startsWith('..') && !isAbsolute(rel)) {
    // Under .agent-memory: creation must go through the lib so the
    // dead-workspace guard stays enforced in one place.
    return ensureDir(mainRoot, rel || '.');
  }
  try {
    mkdirSync(target, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// 4. Legacy migration — must happen before settings are touched, so an
//    aborted migration leaves settings pristine.
const slug = mainRoot.replace(/[^A-Za-z0-9-]/g, '-');
const legacyDir = join(homedir(), '.claude', 'projects', slug, 'memory');
const legacyFiles = existsSync(legacyDir) ? listFilesRecursive(legacyDir) : [];
const targetFiles = existsSync(target) ? listFilesRecursive(target) : [];

if (legacyFiles.length > 0 && targetFiles.length > 0) {
  console.error('Both the legacy memory and the target contain files; refusing to merge.');
  console.error(`  legacy: ${legacyDir} (${legacyFiles.length} files)`);
  console.error(`  target: ${target} (${targetFiles.length} files)`);
  console.error('Resolve manually, then rerun. Settings were not modified.');
  process.exit(1);
}

if (!makeTarget()) {
  console.error(`Failed to create target directory: ${target}`);
  process.exit(1);
}

// Cross-device safe move: copy + unlink, recursing into subdirectories.
let movedCount = 0;
function moveTree(srcDir, dstDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      // WHY: the target root already passed the lib guard earlier in this
      // run, so subdirectories under it need no re-guard.
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

if (legacyFiles.length > 0) {
  try {
    moveTree(legacyDir, target);
    try { rmdirSync(legacyDir); } catch { /* best-effort */ }
  } catch (err) {
    console.error(`Failed while moving legacy memory: ${err.message}`);
    console.error(`  moved so far: ${movedCount} of ${legacyFiles.length} files`);
    console.error(`  legacy: ${legacyDir}`);
    console.error(`  target: ${target}`);
    console.error('Settings were not modified.');
    process.exit(1);
  }
}

// 5. Settings — never overwrite a file we cannot parse.
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

// 6. Summary
console.log(`Memory target: ${target}`);
console.log(`Files migrated from legacy: ${movedCount}${movedCount > 0 ? ` (from ${legacyDir})` : ''}`);
console.log(`Settings: ${settingsPath} — ${settingsReport}`);
console.log('Takes effect from the next session; you may need to accept the project settings trust dialog.');
console.log('To use this in another worktree, run this script once from that worktree (idempotent).');
