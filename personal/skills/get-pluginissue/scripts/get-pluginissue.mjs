#!/usr/bin/env node
// get-pluginissue — query the global plugin-issue store that add-pluginissue
// publishes (~/.agent-memory/global/pluginissue/). Subcommands: list | show.
// Read-only over the store; show also verifies the archive sha256 and unpacks
// it. Deterministic; no dependency on core.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// downstream pipes (head, wc) may close early; exit quietly instead of crashing
process.stdout.on('error', err => { if (err.code === 'EPIPE') process.exit(0); throw err; });

const STORE = path.join(os.homedir(), '.agent-memory', 'global', 'pluginissue');
const INDEX = path.join(STORE, 'index.jsonl');

function die(msg) {
  process.stderr.write(`get-pluginissue: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const a = { cmd: '', pos: [], plugin: '', skill: '', type: '', severity: '', confidence: '', match: '', since: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--plugin') a.plugin = argv[++i] || '';
    else if (v === '--skill') a.skill = argv[++i] || '';
    else if (v === '--type') a.type = argv[++i] || '';
    else if (v === '--severity') a.severity = argv[++i] || '';
    else if (v === '--confidence') a.confidence = argv[++i] || '';
    else if (v === '--match') a.match = argv[++i] || '';
    else if (v === '--since') a.since = argv[++i] || '';
    else if (v === '--out') a.out = argv[++i] || '';
    else if (v.startsWith('--')) die(`unknown option: ${v}`);
    else if (!a.cmd) a.cmd = v;
    else a.pos.push(v);
  }
  return a;
}

// One record per index.jsonl line; malformed lines are skipped and counted.
function readIndex() {
  if (!fs.existsSync(INDEX)) return { records: [], skipped: 0 };
  const records = [];
  let skipped = 0;
  for (const line of fs.readFileSync(INDEX, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { records.push(JSON.parse(s)); } catch { skipped++; }
  }
  return { records, skipped };
}

const eqi = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function makeFilter(a) {
  const match = a.match.toLowerCase();
  return r => {
    if (a.plugin && !eqi(r.plugin, a.plugin)) return false;
    if (a.skill && !eqi(r.skill_or_hook, a.skill)) return false;
    if (a.type && !eqi(r.failure_type, a.type)) return false;
    if (a.severity && !eqi(r.severity, a.severity)) return false;
    if (a.confidence && !eqi(r.confidence, a.confidence)) return false;
    if (match && !String(r.summary || '').toLowerCase().includes(match)) return false;
    if (a.since && String(r.created_at || '') < a.since) return false;
    return true;
  };
}

function cmdList(a) {
  const { records, skipped } = readIndex();
  if (skipped) process.stderr.write(`get-pluginissue: skipped ${skipped} malformed index line(s)\n`);
  if (records.length === 0) { process.stdout.write('no issues found\n'); return; }

  const rows = records.filter(makeFilter(a))
    .sort((x, y) => String(x.created_at || '').localeCompare(String(y.created_at || '')));

  const cols = [
    ['SHA', r => String(r.sha256 || '').slice(0, 8)],
    ['DATE', r => String(r.created_at || '').slice(0, 10)],
    ['PLUGIN/SKILL', r => `${r.plugin || ''}/${r.skill_or_hook || ''}`],
    ['TYPE', r => String(r.failure_type || '')],
    ['SEV', r => String(r.severity || '')],
    ['CONF', r => String(r.confidence || '')],
    ['SUMMARY', r => String(r.summary || '')],
  ];
  const cells = rows.map(r => cols.map(([, f]) => f(r)));
  const width = cols.map(([h], i) => Math.max(h.length, ...cells.map(c => c[i].length), 0));
  const last = cols.length - 1;
  const fmt = c => c.map((v, i) => (i === last ? v : v.padEnd(width[i]))).join('  ');

  process.stdout.write(fmt(cols.map(([h]) => h)) + '\n');
  for (const c of cells) process.stdout.write(fmt(c) + '\n');
  process.stdout.write(`\n${rows.length} issue(s)\n`);
}

function resolve(records, selector) {
  const hits = records.filter(r => (r.sha256 && r.sha256.startsWith(selector)) || r.id === selector);
  const seen = new Set();
  return hits.filter(r => { const k = r.sha256 || r.id; if (seen.has(k)) return false; seen.add(k); return true; });
}

function findReport(root) {
  const direct = path.join(root, 'report.md');
  if (fs.existsSync(direct)) return { stagingDir: root, reportMd: direct };
  for (const name of fs.readdirSync(root)) {
    const sub = path.join(root, name);
    if (fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'report.md'))) {
      return { stagingDir: sub, reportMd: path.join(sub, 'report.md') };
    }
  }
  return null;
}

function cmdShow(a) {
  const selector = a.pos[0];
  if (!selector) die('show needs a selector (sha256 prefix or issue id)');

  const { records } = readIndex();
  const cands = resolve(records, selector);
  if (cands.length === 0) die(`no issue matches "${selector}"`);
  if (cands.length > 1) {
    process.stderr.write(`get-pluginissue: "${selector}" is ambiguous — ${cands.length} matches:\n`);
    for (const c of cands) process.stderr.write(`  ${String(c.sha256 || '').slice(0, 12)}  ${c.id || ''}  ${c.summary || ''}\n`);
    process.exit(1);
  }

  const rec = cands[0];
  if (!/^[0-9a-f]{64}$/.test(rec.sha256 || '')) die(`invalid sha256 in index for "${selector}"`);
  const archiveName = rec.archive || `${rec.sha256}.tar.gz`;
  if (path.basename(archiveName) !== archiveName) die(`unsafe archive name in index: ${archiveName}`);
  const tarball = path.join(STORE, archiveName);
  if (!fs.existsSync(tarball)) die(`archive missing (in index but not on disk): ${tarball}`);

  const actual = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
  if (actual !== rec.sha256) {
    die(`integrity check failed for ${rec.sha256.slice(0, 12)}: recomputed ${actual.slice(0, 12)} — archive corrupt or tampered`);
  }

  const base = a.out ? path.resolve(a.out) : path.join(STORE, '.unpacked');
  const outDir = path.join(base, rec.sha256.slice(0, 12));
  fs.rmSync(outDir, { recursive: true, force: true });   // only the tool-created <sha12> leaf, never the user's --out dir
  fs.mkdirSync(outDir, { recursive: true });
  try {
    execFileSync('tar', ['-xzf', tarball, '-C', outDir], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    die(`tar failed: ${(e.stderr && e.stderr.toString().trim()) || e.message}`);
  }

  const found = findReport(outDir);
  if (!found) die(`report.md not found under ${outDir}`);
  const report = fs.readFileSync(found.reportMd, 'utf8');
  process.stdout.write(report.endsWith('\n') ? report : report + '\n');

  const sessionPath = path.join(found.stagingDir, 'session.jsonl');
  const attachDir = path.join(found.stagingDir, 'attachments');
  let attachments = [];
  if (fs.existsSync(attachDir) && fs.statSync(attachDir).isDirectory()) {
    attachments = fs.readdirSync(attachDir).map(n => path.join(attachDir, n));
  }

  process.stdout.write('\n--- issue files ---\n');
  process.stdout.write(`extracted to:  ${found.stagingDir}\n`);
  process.stdout.write(`session.jsonl: ${fs.existsSync(sessionPath) ? sessionPath : '(missing)'}\n`);
  process.stdout.write(`attachments:   ${attachments.length ? attachments.join('\n               ') : '(none)'}\n`);
}

const commands = { list: cmdList, show: cmdShow };
const args = parseArgs(process.argv.slice(2));
const run = commands[args.cmd];
if (!run) die(`usage: get-pluginissue list [filters] | show <selector> [--out <dir>]  (got: ${args.cmd || '(none)'})`);
run(args);
