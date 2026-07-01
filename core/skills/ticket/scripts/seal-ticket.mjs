#!/usr/bin/env node
// seal-ticket — archive a staged feedback ticket into the global, immutable
// ticket store. Builds a tar.gz, keys it by its own sha256, moves it to
// ~/.agent-memory/global/ticket/, and appends one metadata line to index.jsonl.
// Deterministic; refuses to seal a directory missing report.md or session.jsonl.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

function die(msg) {
  process.stderr.write(`seal-ticket: ${msg}\n`);
  process.exit(1);
}

// Trim a frontmatter value: drop a trailing "# comment" on unquoted values,
// then strip surrounding quotes.
function stripValue(raw) {
  let v = raw.trim();
  const quoted = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
  if (!quoted) {
    if (v.startsWith('#')) return '';        // whole value is a comment
    const c = v.indexOf(' #');
    if (c >= 0) v = v.slice(0, c).trim();
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

// Parse the leading --- … --- block as simple "key: value" lines (no YAML lib).
function parseFrontmatter(md) {
  const m = md.match(/^\s*---\r?\n([\s\S]*?)\r?\n[ \t]*---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (key) out[key] = stripValue(line.slice(i + 1));
  }
  return out;
}

const arg = process.argv[2];
if (!arg) {
  process.stderr.write('usage: seal-ticket <report-dir>\n');
  process.exit(1);
}

const reportDir = path.resolve(arg);
const reportMd = path.join(reportDir, 'report.md');
const sessionJsonl = path.join(reportDir, 'session.jsonl');
const missing = [];
if (!fs.existsSync(reportMd)) missing.push('report.md');
if (!fs.existsSync(sessionJsonl)) missing.push('session.jsonl');
if (missing.length) die(`cannot seal — missing required file(s): ${missing.join(', ')} (in ${reportDir})`);

const meta = parseFrontmatter(fs.readFileSync(reportMd, 'utf8'));

const needMeta = ['id', 'plugin', 'created_at'].filter(k => !meta[k]);
if (needMeta.length) die(`report.md frontmatter missing/empty: ${needMeta.join(', ')} — cannot seal`);

// Destination first, so the tar.gz is built on the same filesystem and the
// final rename to <sha256>.tar.gz is atomic (no cross-device move).
const destDir = path.join(os.homedir(), '.agent-memory', 'global', 'ticket');
fs.mkdirSync(destDir, { recursive: true });

// Archive paths are relative to the staging folder name (-C parent dirname).
const parent = path.dirname(reportDir);
const dirname = path.basename(reportDir);
const tmpTar = path.join(destDir, `.tmp-${process.pid}-${Date.now()}.tar.gz`);
try {
  execFileSync('tar', ['-czf', tmpTar, '-C', parent, '--', dirname], { stdio: ['ignore', 'ignore', 'pipe'] });
} catch (e) {
  try { fs.unlinkSync(tmpTar); } catch {}
  die(`tar failed: ${(e.stderr && e.stderr.toString().trim()) || e.message}`);
}

let destPath;
try {
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tmpTar)).digest('hex');
  const archive = `${sha256}.tar.gz`;
  destPath = path.join(destDir, archive);
  fs.renameSync(tmpTar, destPath);

  const record = {
    sha256,
    archive,
    created_at: meta.created_at || '',
    id: meta.id || '',
    plugin: meta.plugin || '',
    skill_or_hook: meta.skill_or_hook || '',
    plugin_version: meta.plugin_version || '',
    failure_type: meta.failure_type || '',
    severity: meta.severity || '',
    confidence: meta.confidence || '',
    summary: meta.summary || '',
  };

  // Append is idempotent: the archive is content-addressed, so re-sealing the
  // same content overwrites one archive and must not add a second index line.
  const indexPath = path.join(destDir, 'index.jsonl');
  const dup = fs.existsSync(indexPath) &&
    fs.readFileSync(indexPath, 'utf8').split('\n')
      .some(l => { try { return JSON.parse(l).sha256 === sha256; } catch { return false; } });
  if (!dup) fs.appendFileSync(indexPath, JSON.stringify(record) + '\n');

  process.stdout.write(`sealed ticket\n  archive: ${destPath}\n  sha256:  ${sha256}\n`);
} catch (e) {
  try { fs.unlinkSync(tmpTar); } catch {}
  if (destPath) { try { fs.unlinkSync(destPath); } catch {} }
  die(`seal failed after archiving: ${e.message}`);
}
