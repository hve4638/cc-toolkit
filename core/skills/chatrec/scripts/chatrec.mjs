#!/usr/bin/env node
// chatrec — slim, query, and extract the current Claude Code session transcript.
// Subcommands: build | count | search | clip | filter. The engine is
// deterministic; the model drives it via subcommands and consumes only small
// outputs (never loading the whole transcript into context).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// downstream pipes (head, wc) may close early; exit quietly instead of crashing
process.stdout.on('error', err => { if (err.code === 'EPIPE') process.exit(0); throw err; });

function die(msg) {
  process.stderr.write(`chatrec: ${msg}\n`);
  process.exit(1);
}

function usage() {
  process.stdout.write(`usage: chatrec <command> [options]

commands
  build              rebuild the slim cache
  count              total turns + role counts
  search [pat]       matching turns as T<t>  <role>  <snippet>
  clip <from> [to]   records of a turn range (jsonl)
  filter             filtered records (jsonl)

options
  --session <id>     another session (default: $CLAUDE_CODE_SESSION_ID)
  --source <jsonl>   an arbitrary transcript file
  --role <r,...>     user,assistant,tool_call,tool_result
  --tool <n,...>     filter by tool name
  --match <text>     substring match
  --from N --to M    turn range
  --invert           invert the filter
  --out <file>       write to file instead of stdout
`);
  process.exit(0);
}

function num(v, label) {
  const n = Number(v);
  if (!Number.isFinite(n)) die(`${label} must be a number`);
  return n;
}

function parseArgs(argv) {
  const a = {
    session: process.env.CLAUDE_CODE_SESSION_ID || '', source: '',
    cmd: '', pos: [], role: '', tool: '', match: '', from: null, to: null,
    invert: false, out: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--help' || v === '-h') usage();
    else if (v === '--session') a.session = argv[++i] || '';
    else if (v === '--source') a.source = argv[++i] || '';
    else if (v === '--role') a.role = argv[++i] || '';
    else if (v === '--tool') a.tool = argv[++i] || '';
    else if (v === '--match') a.match = argv[++i] || '';
    else if (v === '--from') a.from = num(argv[++i], '--from');
    else if (v === '--to') a.to = num(argv[++i], '--to');
    else if (v === '--invert') a.invert = true;
    else if (v === '--out') a.out = argv[++i] || '';
    else if (v.startsWith('--')) die(`unknown option: ${v}`);
    else if (!a.cmd) a.cmd = v;
    else a.pos.push(v);
  }
  return a;
}

// ---- transcript discovery (cwd-independent: search by filename) ----
function findTranscript({ session, source }) {
  if (source) {
    if (!fs.existsSync(source)) die(`source not found: ${source}`);
    return source;
  }
  if (!session) die('no session id: set CLAUDE_CODE_SESSION_ID or pass --session <id> / --source <jsonl>');
  const projects = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projects)) die(`projects dir not found: ${projects}`);
  for (const d of fs.readdirSync(projects)) {
    const p = path.join(projects, d, `${session}.jsonl`);
    if (fs.existsSync(p)) return p;
  }
  die(`transcript not found for session ${session} under ${projects}`);
}

// ---- raw transcript → flat records ----
// <command-name>/x</command-name><command-args>y</command-args> → "/x y"
function cleanSlashCommand(s) {
  const name = s.match(/<command-name>([^<]*)<\/command-name>/)?.[1]?.trim();
  if (!name) return null;
  const args = s.match(/<command-args>([^<]*)<\/command-args>/)?.[1]?.trim();
  return args ? `${name} ${args}` : name;
}

// Human utterance for a user line, or null if it is not a real turn.
function userText(content) {
  if (typeof content === 'string') {
    const cmd = cleanSlashCommand(content);
    if (cmd) return cmd;
    return content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  }
  if (Array.isArray(content)) {
    const parts = [];
    for (const c of content) {
      if (c && c.type === 'text' && typeof c.text === 'string') {
        const t = c.text.trim();
        if (!t || t.startsWith('<system-reminder>')) continue;
        parts.push(t);
      }
    }
    return parts.length ? parts.join('\n') : null;
  }
  return null;
}

function toolResults(content) {
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const c of content) {
    if (c && c.type === 'tool_result') {
      let body = c.content;
      if (Array.isArray(body)) {
        body = body.map(x => (x && x.type === 'text' ? x.text : `[${x?.type || 'part'}]`)).join('\n');
      }
      out.push({ id: c.tool_use_id, isError: !!c.is_error, body: String(body ?? '') });
    }
  }
  return out;
}

// Flat schema: one record per line, role ∈ user|assistant|tool_call|tool_result.
// t = turn number (user-utterance ordinal). Content preserved in full.
function buildRecords(txPath) {
  const lines = fs.readFileSync(txPath, 'utf8').split('\n');
  const recs = [];
  const toolName = new Map(); // tool_use_id -> name (denormalized onto tool_result)
  let t = 0;
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    let o;
    try { o = JSON.parse(s); } catch { continue; }
    if (o.type === 'user') {
      if (o.isMeta) continue; // skill substitution, injected context, command stdout
      const c = o.message?.content;
      const ut = userText(c);
      if (ut != null) { t += 1; recs.push({ t, role: 'user', text: ut }); }
      for (const r of toolResults(c)) {
        recs.push({ t, role: 'tool_result', name: toolName.get(r.id) || 'tool', tool_use_id: r.id, result: r.body, is_error: r.isError });
      }
    } else if (o.type === 'assistant') {
      const c = o.message?.content;
      if (!Array.isArray(c)) continue;
      for (const b of c) {
        if (b.type === 'text' && b.text?.trim()) recs.push({ t, role: 'assistant', text: b.text });
        else if (b.type === 'tool_use') {
          toolName.set(b.id, b.name);
          recs.push({ t, role: 'tool_call', name: b.name, tool_use_id: b.id, input: b.input });
        }
        // thinking dropped
      }
    }
    // every other type (attachment, system, file-history-snapshot, …) dropped
  }
  return recs;
}

// ---- cache (auto, immutable) ----
function cacheDir() {
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'chatrec');
}
// Explicit --source keys by a hash of its resolved path (collision-resistant,
// and never clashing with a session id); otherwise key by the unique session id.
function cacheKey(src, args) {
  if (args.source) return 'src-' + crypto.createHash('sha1').update(path.resolve(src)).digest('hex').slice(0, 12);
  return args.session;
}
function cachePathFor(src, args) {
  return path.join(cacheDir(), `${cacheKey(src, args)}.slim.jsonl`);
}
function writeJsonl(file, recs) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, recs.map(r => JSON.stringify(r)).join('\n') + (recs.length ? '\n' : ''));
}
function parseRecords(text) {
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l));
}
// Rebuild the cache only when missing or older than the source transcript.
function ensureCache(args) {
  const src = findTranscript(args);
  const cp = cachePathFor(src, args);
  let fresh = false;
  try { fresh = fs.existsSync(cp) && fs.statSync(cp).mtimeMs >= fs.statSync(src).mtimeMs; } catch {}
  if (!fresh) writeJsonl(cp, buildRecords(src));
  return cp;
}
function loadCache(args) {
  return parseRecords(fs.readFileSync(ensureCache(args), 'utf8'));
}
// Read all of stdin synchronously. readFileSync(0) under-reads large pipes, so
// loop readSync to EOF and decode once (multi-byte safe).
function readStdin() {
  const chunks = [];
  const buf = Buffer.alloc(1 << 16);
  for (;;) {
    let n;
    try { n = fs.readSync(0, buf, 0, buf.length, null); }
    catch (e) { if (e.code === 'EAGAIN') continue; break; }
    if (!n) break;
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks).toString('utf8');
}
// Records from stdin (pipe) when present, else from cache.
function getRecords(args) {
  if (!process.stdin.isTTY) {
    const s = readStdin();
    if (s.trim()) return parseRecords(s);
  }
  return loadCache(args);
}

// ---- filtering (shared by search / filter) ----
function bodyOf(r) {
  if (r.role === 'user' || r.role === 'assistant') return r.text || '';
  if (r.role === 'tool_call') return JSON.stringify(r.input ?? {});
  if (r.role === 'tool_result') return r.result || '';
  return '';
}
function makeMatcher(args) {
  const roles = args.role ? new Set(args.role.split(',')) : null;
  const tools = args.tool ? new Set(args.tool.split(',')) : null;
  const m = (args.match || '').toLowerCase();
  const { from, to, invert } = args;
  return r => {
    let ok = true;
    if (roles && !roles.has(r.role)) ok = false;
    if (ok && tools) ok = (r.role === 'tool_call' || r.role === 'tool_result') && tools.has(r.name);
    if (ok && from != null && r.t < from) ok = false;
    if (ok && to != null && r.t > to) ok = false;
    if (ok && m && !bodyOf(r).toLowerCase().includes(m)) ok = false;
    return invert ? !ok : ok;
  };
}

function emit(recs, args) {
  if (args.out) { writeJsonl(args.out, recs); process.stderr.write(`chatrec: wrote ${recs.length} records → ${args.out}\n`); }
  else process.stdout.write(recs.map(r => JSON.stringify(r)).join('\n') + (recs.length ? '\n' : ''));
}

// ---- commands ----
function cmdBuild(args) {
  const src = findTranscript(args);
  const recs = buildRecords(src);
  const cp = cachePathFor(src, args);
  writeJsonl(cp, recs);
  if (args.out) writeJsonl(args.out, recs);
  const turns = recs.reduce((m, r) => Math.max(m, r.t || 0), 0);
  process.stderr.write(`chatrec: built ${recs.length} records, ${turns} turns → ${cp}${args.out ? ` (+ ${args.out})` : ''}\n`);
}

function cmdCount(args) {
  const recs = loadCache(args);
  const turns = recs.reduce((m, r) => Math.max(m, r.t || 0), 0);
  const byRole = {};
  for (const r of recs) byRole[r.role] = (byRole[r.role] || 0) + 1;
  const label = args.source ? `source ${path.basename(args.source)}` : `session ${args.session}`;
  process.stdout.write(`${label} · ${turns} turns · ${recs.length} records\n`);
  process.stdout.write(`  ${Object.entries(byRole).map(([k, v]) => `${k}:${v}`).join(' · ')}\n`);
}

function snippet(body, m, n = 80) {
  body = body.replace(/\s+/g, ' ').trim();
  if (m) {
    const i = body.toLowerCase().indexOf(m.toLowerCase());
    if (i >= 0) {
      const s = Math.max(0, i - 20);
      return (s > 0 ? '…' : '') + body.slice(s, s + n) + (s + n < body.length ? '…' : '');
    }
  }
  return body.length <= n ? body : body.slice(0, n) + '…';
}
function cmdSearch(args) {
  if (!args.match && args.pos[0]) args.match = args.pos[0];
  const recs = getRecords(args).filter(makeMatcher(args));
  const lines = recs.map(r => `T${r.t}\t${r.role}\t${snippet(bodyOf(r), args.match)}`);
  if (lines.length) process.stdout.write(lines.join('\n') + '\n');
  else process.stderr.write('chatrec: no matches\n');
}

function cmdClip(args) {
  const from = num(args.pos[0], 'clip <from>');
  const to = args.pos[1] != null ? num(args.pos[1], 'clip <to>') : from;
  emit(getRecords(args).filter(r => r.t >= from && r.t <= to), args);
}

function cmdFilter(args) {
  emit(getRecords(args).filter(makeMatcher(args)), args);
}

const commands = { build: cmdBuild, count: cmdCount, search: cmdSearch, clip: cmdClip, filter: cmdFilter };
const args = parseArgs(process.argv.slice(2));
const run = commands[args.cmd];
if (!run) die(`unknown command: ${args.cmd || '(none)'} — use build | count | search | clip | filter`);
run(args);
