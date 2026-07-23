#!/usr/bin/env node
// tracetranscript — scan local Claude Code transcripts (~/.claude/projects) and
// aggregate usage statistics: skills, slash commands, subagents, MCP tools,
// models/tokens, session cwd paths.
//
// Two stages:
//   scan   — one JSON line per session (intermediate artifact, filterable)
//   report — aggregate scan lines with date/path filters and period buckets
//
// node-only, no deps. Streams every file; never loads a transcript wholesale.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

// downstream pipes (head, wc) may close early; exit quietly instead of crashing
process.stdout.on('error', err => { if (err.code === 'EPIPE') process.exit(0); throw err; });

function die(msg) {
  process.stderr.write(`tracetranscript: ${msg}\n`);
  process.exit(1);
}

const USAGE = `usage:
  tracetranscript scan   [--root DIR] [--since D] [--until D] [--out FILE]
  tracetranscript report [FILE|-] [--since D] [--until D] [--by day|week|month]
                    [--path SUBSTR] [--top N] [--format md|json] [--out FILE] [--root DIR]

dates: ISO (2026-06-01) or relative (7d, 4w, 1m, 1y)
filters and --by buckets go by each session's LAST activity timestamp
report input: FILE arg, "-" for stdin, or (no arg) a fresh scan of --root`;

const UNITS = { d: 864e5, w: 7 * 864e5, m: 30 * 864e5, y: 365 * 864e5 };
// "1m"-style relative dates or ISO → epoch ms; null when v is empty.
// Relative units are fixed lengths (m = 30d, y = 365d), not calendar-aware.
function parseWhen(v, label) {
  if (!v) return null;
  const m = /^(\d+)([dwmy])$/.exec(v);
  if (m) return Date.now() - Number(m[1]) * UNITS[m[2]];
  const t = Date.parse(v);
  if (Number.isNaN(t)) die(`${label}: unrecognized date "${v}" (ISO date or 7d/4w/1m/1y)`);
  // a bare date parses as midnight UTC; "--until <day>" should include that day
  if (label === '--until' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return t + 864e5 - 1;
  return t;
}

function parseArgs(argv) {
  const a = {
    cmd: argv[0] || '', pos: [], root: '', since: '', until: '', out: '',
    by: '', path: '', top: 30, format: 'md',
  };
  const need = (i, flag) => {
    const v = argv[i];
    if (v === undefined || v.startsWith('--')) die(`${flag} requires a value`);
    return v;
  };
  for (let i = 1; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--root') a.root = need(++i, v);
    else if (v === '--since') a.since = need(++i, v);
    else if (v === '--until') a.until = need(++i, v);
    else if (v === '--out') a.out = need(++i, v);
    else if (v === '--by') a.by = need(++i, v);
    else if (v === '--path') a.path = need(++i, v);
    else if (v === '--top') { const n = Number(need(++i, v)); if (!Number.isFinite(n) || n < 1) die('--top must be a positive number'); a.top = n; }
    else if (v === '--format') a.format = need(++i, v);
    else if (v.startsWith('--')) die(`unknown option: ${v}`);
    else a.pos.push(v);
  }
  if (a.by && !['day', 'week', 'month'].includes(a.by)) die('--by must be day, week, or month');
  if (!['md', 'json'].includes(a.format)) die('--format must be md or json');
  return a;
}

// ---- stage 1: scan ----

// count one occurrence of key: map[key] = {n, last} with last = max timestamp seen
function bump(map, key, ts) {
  if (!key) return;
  const e = map[key] || (map[key] = { n: 0, last: '' });
  e.n++;
  if (ts && ts > e.last) e.last = ts;
}

function newRecord(session, project) {
  const rec = {
    session, project, cwd: '', branch: '', first: '', last: '',
    entries: 0, userTurns: 0, subagentFiles: 0,
    models: {}, tools: {}, skills: {}, commands: {}, agents: {}, mcp: {},
  };
  // one API call (message.id) is written across several entries with the same
  // usage block — dedup here or tokens get counted up to 5x
  Object.defineProperty(rec, '_seen', { value: new Set(), enumerable: false });
  return rec;
}

// Fold one transcript file into rec. sub=true means a subagent transcript:
// its models/tools/skills/agents/mcp and timestamps still count (they are real
// usage of the parent session), but cwd/branch/commands/userTurns stay
// main-session-only — a subagent can't receive slash commands or user turns,
// and its cwd (worktree isolation) must not overwrite the session's.
async function scanTranscript(file, rec, sub) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    rec.entries++;
    const ts = typeof e.timestamp === 'string' ? e.timestamp : '';
    if (ts) {
      if (!rec.first || ts < rec.first) rec.first = ts;
      if (ts > rec.last) rec.last = ts;
    }
    if (!sub && typeof e.cwd === 'string' && e.cwd) rec.cwd = e.cwd;
    if (!sub && typeof e.gitBranch === 'string' && e.gitBranch) rec.branch = e.gitBranch;
    const msg = e.message;
    if (e.type === 'assistant' && msg) {
      const model = msg.model || '';
      const u = msg.usage;
      if (u && model && model !== '<synthetic>') {
        const id = msg.id || e.requestId || '';
        if (!id || !rec._seen.has(id)) {
          if (id) rec._seen.add(id);
          const s = rec.models[model] || (rec.models[model] = { calls: 0, input: 0, output: 0, cacheCreate: 0, cacheRead: 0 });
          s.calls++;
          s.input += u.input_tokens || 0;
          s.output += u.output_tokens || 0;
          s.cacheCreate += u.cache_creation_input_tokens || 0;
          s.cacheRead += u.cache_read_input_tokens || 0;
        }
      }
      const parts = Array.isArray(msg.content) ? msg.content : [];
      for (const p of parts) {
        if (!p || p.type !== 'tool_use' || typeof p.name !== 'string') continue;
        // duplicate entries can repeat content blocks too — dedup by tool_use id
        // (toolu_* and msg_* ids don't collide, so one set serves both)
        if (p.id) {
          if (rec._seen.has(p.id)) continue;
          rec._seen.add(p.id);
        }
        rec.tools[p.name] = (rec.tools[p.name] || 0) + 1;
        const input = p.input || {};
        if (p.name === 'Skill') bump(rec.skills, input.skill || input.command || '', ts);
        else if (p.name === 'Task' || p.name === 'Agent') bump(rec.agents, input.subagent_type || 'general-purpose', ts);
        else if (p.name.startsWith('mcp__')) bump(rec.mcp, p.name.slice(5), ts);
      }
    } else if (e.type === 'user' && msg && !sub && !e.isSidechain) {
      const c = msg.content;
      let text = '';
      if (typeof c === 'string') text = c;
      else if (Array.isArray(c)) {
        let toolResult = false;
        for (const p of c) {
          if (p && p.type === 'tool_result') toolResult = true;
          else if (p && p.type === 'text' && typeof p.text === 'string') text += p.text + '\n';
        }
        if (toolResult) text = '';
      }
      if (text) {
        const re = /<command-name>([^<]+)<\/command-name>/g;
        for (let m; (m = re.exec(text)); ) bump(rec.commands, m[1].trim(), ts);
        if (!e.isMeta && !text.includes('<local-command-stdout>')) rec.userTurns++;
      }
    }
  }
}

// Walk every session under root, emit(record) once per session that survives
// the --since/--until filter (judged on last activity), return the count.
async function scanAll(a, emit) {
  const root = a.root || path.join(os.homedir(), '.claude', 'projects');
  const since = parseWhen(a.since, '--since');
  const until = parseWhen(a.until, '--until');
  let projects;
  try { projects = fs.readdirSync(root, { withFileTypes: true }); } catch (err) { die(`cannot read ${root}: ${err.message}`); }
  let n = 0;
  for (const d of projects) {
    if (!d.isDirectory()) continue;
    const pdir = path.join(root, d.name);
    let files;
    try { files = fs.readdirSync(pdir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const fp = path.join(pdir, f);
      let st;
      try { st = fs.statSync(fp); } catch { continue; }
      if (!st.isFile()) continue;
      // transcripts are append-only, so mtime ≈ last activity: cheap prefilter
      if (since && st.mtimeMs < since) continue;
      const session = f.slice(0, -'.jsonl'.length);
      const rec = newRecord(session, d.name);
      await scanTranscript(fp, rec, false);
      // subagent transcripts live in <session>/subagents/*.jsonl next to the
      // session file — fold them in (their tokens/tool calls are real usage)
      const subdir = path.join(pdir, session, 'subagents');
      let subs = [];
      try { subs = fs.readdirSync(subdir).filter(x => x.endsWith('.jsonl')); } catch {}
      for (const sf of subs) {
        rec.subagentFiles++;
        await scanTranscript(path.join(subdir, sf), rec, true);
      }
      if (!rec.last) continue;
      const lastMs = Date.parse(rec.last);
      if (since && lastMs < since) continue;
      if (until && lastMs > until) continue;
      emit(rec);
      n++;
    }
  }
  return n;
}

async function cmdScan(a) {
  const out = a.out ? fs.createWriteStream(a.out) : process.stdout;
  if (a.out) out.on('error', err => die(`cannot write ${a.out}: ${err.message}`));
  const n = await scanAll(a, rec => out.write(JSON.stringify(rec) + '\n'));
  if (a.out) {
    await new Promise(res => out.end(res));
    process.stderr.write(`tracetranscript: ${n} sessions -> ${a.out}\n`);
  }
}

// ---- stage 2: report ----

// Report input precedence: "-" reads stdin, a FILE arg reads that file,
// no arg runs a fresh scan (stdin is never read implicitly — non-interactive
// shells would hand us an empty pipe and silently yield 0 sessions).
async function readRecords(a) {
  const parseLines = s => s.split('\n').filter(Boolean).map((l, i) => {
    let r;
    try { r = JSON.parse(l); } catch { die(`bad JSON on input line ${i + 1}`); }
    if (!r || typeof r !== 'object' || Array.isArray(r)) die(`input line ${i + 1} is not a scan record`);
    return r;
  });
  if (a.pos[0] === '-') {
    const chunks = [];
    for await (const ch of process.stdin) chunks.push(ch);
    return parseLines(Buffer.concat(chunks).toString('utf8'));
  }
  if (a.pos[0]) {
    let s;
    try { s = fs.readFileSync(a.pos[0], 'utf8'); } catch (err) { die(`cannot read ${a.pos[0]}: ${err.message}`); }
    return parseLines(s);
  }
  const recs = [];
  await scanAll(a, r => recs.push(r));
  return recs;
}

function aggregate(records) {
  const A = {
    sessions: records.length, entries: 0, userTurns: 0, subagentFiles: 0,
    first: '', last: '',
    models: {}, tools: {}, skills: {}, commands: {}, agents: {}, mcp: {}, cwds: {},
  };
  for (const r of records) {
    A.entries += r.entries || 0;
    A.userTurns += r.userTurns || 0;
    A.subagentFiles += r.subagentFiles || 0;
    if (r.first && (!A.first || r.first < A.first)) A.first = r.first;
    if (r.last && r.last > A.last) A.last = r.last;
    for (const [m, s] of Object.entries(r.models || {})) {
      const t = A.models[m] || (A.models[m] = { calls: 0, input: 0, output: 0, cacheCreate: 0, cacheRead: 0 });
      for (const k of Object.keys(t)) t[k] += s[k] || 0;
    }
    for (const [k, n] of Object.entries(r.tools || {})) A.tools[k] = (A.tools[k] || 0) + n;
    for (const key of ['skills', 'commands', 'agents', 'mcp']) {
      for (const [k, v] of Object.entries(r[key] || {})) {
        const t = A[key][k] || (A[key][k] = { n: 0, last: '' });
        t.n += v.n || 0;
        if (v.last && v.last > t.last) t.last = v.last;
      }
    }
    if (r.cwd) {
      const c = A.cwds[r.cwd] || (A.cwds[r.cwd] = { n: 0, last: '' });
      c.n++;
      if (r.last && r.last > c.last) c.last = r.last;
    }
  }
  return A;
}

// prefix-intersection paths: show a node when sessions ended exactly there, or
// when it branches (>=2 children); pure chain nodes are folded into their child.
// Row: {path, total: sessions at-or-under, exact: sessions exactly here,
// depth: number of *shown* ancestors — folded chain nodes add no indent}.
function pathTreeRows(cwds) {
  const root = { children: new Map(), exact: 0, total: 0 };
  for (const [p, info] of Object.entries(cwds)) {
    let node = root;
    node.total += info.n;
    for (const seg of p.split('/').filter(Boolean)) {
      let ch = node.children.get(seg);
      if (!ch) { ch = { children: new Map(), exact: 0, total: 0 }; node.children.set(seg, ch); }
      node = ch;
      node.total += info.n;
    }
    node.exact += info.n;
  }
  const rows = [];
  (function walk(node, prefix, depth) {
    const kids = [...node.children.entries()].sort((x, y) => y[1].total - x[1].total);
    for (const [seg, ch] of kids) {
      const p = prefix + '/' + seg;
      const show = ch.exact > 0 || ch.children.size >= 2;
      if (show) rows.push({ path: p, total: ch.total, exact: ch.exact, depth });
      walk(ch, p, depth + (show ? 1 : 0));
    }
  })(root, '', 0);
  return rows;
}

function fmtTok(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'G';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
const day = ts => (ts || '').slice(0, 10) || '-';

function table(out, headers, rows) {
  if (!rows.length) { out.push('(none)', ''); return; }
  out.push('| ' + headers.join(' | ') + ' |');
  out.push('|' + headers.map(() => '---').join('|') + '|');
  for (const r of rows) out.push('| ' + r.join(' | ') + ' |');
  out.push('');
}

// Build the report's computed views from an aggregate. This is the single
// source every output format serializes — md and json may differ in styling
// (md truncates timestamps to days, humanizes token counts) but never in
// content. --top truncation happens here so it too is format-independent.
function buildViews(A, top) {
  const named = map => Object.entries(map)
    .sort((x, y) => y[1].n - x[1].n || (x[0] < y[0] ? -1 : 1))
    .slice(0, top)
    .map(([name, v]) => ({ name, n: v.n, last: v.last }));

  // merge the two invocation channels by name (commands lose their leading "/"):
  // model = agent-made Skill tool calls, user = user-typed slash commands.
  // Builtin commands (/compact …) have no Skill-call counterpart and simply
  // show as user-only rows — telling them apart from skills is the reader's
  // job, not this table's.
  const merged = {};
  const mergeInto = (name, v, ch) => {
    const e = merged[name] || (merged[name] = { user: 0, model: 0, last: '' });
    e[ch] += v.n;
    if (v.last > e.last) e.last = v.last;
  };
  for (const [k, v] of Object.entries(A.skills)) mergeInto(k, v, 'model');
  for (const [k, v] of Object.entries(A.commands)) mergeInto(k.replace(/^\//, ''), v, 'user');
  const skills = Object.entries(merged)
    .sort((x, y) => (y[1].user + y[1].model) - (x[1].user + x[1].model) || (x[0] < y[0] ? -1 : 1))
    .slice(0, top)
    .map(([name, v]) => ({ name, total: v.user + v.model, user: v.user, model: v.model, last: v.last }));

  const byServer = {};
  for (const [k, v] of Object.entries(A.mcp)) {
    const server = k.split('__')[0];
    const t = byServer[server] || (byServer[server] = { n: 0, last: '' });
    t.n += v.n;
    if (v.last > t.last) t.last = v.last;
  }

  return {
    sessions: A.sessions, entries: A.entries, userTurns: A.userTurns,
    subagentFiles: A.subagentFiles, first: A.first, last: A.last,
    models: Object.entries(A.models).sort((x, y) => y[1].output - x[1].output)
      .map(([name, s]) => ({ name, ...s })),
    skills,
    subagents: named(A.agents),
    mcp: named(A.mcp),
    mcpByServer: named(byServer),
    tools: Object.entries(A.tools).sort((x, y) => y[1] - x[1]).slice(0, top)
      .map(([name, n]) => ({ name, n })),
    paths: named(A.cwds).map(({ name, n, last }) => ({ path: name, sessions: n, last })),
    pathTree: pathTreeRows(A.cwds),
  };
}

function renderMd(v, top) {
  const out = [];
  const named = rows => rows.map(r => [r.name, r.n, day(r.last)]);
  out.push(`# tracetranscript — ${v.sessions} sessions (${day(v.first)} -> ${day(v.last)})`);
  out.push(`entries ${v.entries} · user turns ${v.userTurns} · subagent transcripts ${v.subagentFiles}`);
  out.push('');

  out.push('## Models');
  table(out, ['model', 'calls', 'input', 'output', 'cache write', 'cache read'],
    v.models.map(m => [m.name, m.calls, fmtTok(m.input), fmtTok(m.output), fmtTok(m.cacheCreate), fmtTok(m.cacheRead)]));

  out.push('## Skills & commands');
  table(out, ['name', 'total', 'user', 'model', 'last used'],
    v.skills.map(s => [s.name, s.total, s.user, s.model, day(s.last)]));

  out.push('## Subagents');
  table(out, ['type', 'n', 'last used'], named(v.subagents));

  out.push('## MCP tools');
  table(out, ['server__tool', 'n', 'last used'], named(v.mcp));
  if (v.mcpByServer.length) {
    out.push('### MCP by server');
    table(out, ['server', 'n', 'last used'], named(v.mcpByServer));
  }

  out.push(`## Tool calls (top ${top})`);
  table(out, ['tool', 'n'], v.tools.map(t => [t.name, t.n]));

  out.push(`## Session paths (exact, top ${top})`);
  table(out, ['path', 'sessions', 'last used'], v.paths.map(p => [p.path, p.sessions, day(p.last)]));

  out.push('## Path tree (branch points; sessions at-or-under each node)');
  if (!v.pathTree.length) out.push('(none)');
  else out.push('```', ...v.pathTree.map(r =>
    `${'  '.repeat(r.depth)}${r.path}  ${r.total}${r.exact ? ` (${r.exact} exact)` : ''}`), '```');
  out.push('');
  return out.join('\n');
}

function bucketKey(ms, by) {
  const d = new Date(ms);
  if (by === 'month') return d.toISOString().slice(0, 7);
  if (by === 'week') {
    // weeks start Monday, UTC; (getUTCDay()+6)%7 = days since that Monday
    const monday = new Date(ms - ((d.getUTCDay() + 6) % 7) * 864e5);
    return 'week of ' + monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

async function cmdReport(a) {
  let records = await readRecords(a);
  const invalid = records.filter(r => !Number.isFinite(Date.parse(r.last))).length;
  if (invalid) {
    process.stderr.write(`tracetranscript: skipped ${invalid} record(s) without a valid last timestamp\n`);
    records = records.filter(r => Number.isFinite(Date.parse(r.last)));
  }
  const since = parseWhen(a.since, '--since');
  const until = parseWhen(a.until, '--until');
  if (since) records = records.filter(r => Date.parse(r.last) >= since);
  if (until) records = records.filter(r => Date.parse(r.last) <= until);
  if (a.path) records = records.filter(r => (r.cwd || '').includes(a.path));

  let chunks;
  if (a.by) {
    const buckets = new Map();
    for (const r of records) {
      const k = bucketKey(Date.parse(r.last), a.by);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(r);
    }
    chunks = [...buckets.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))
      .map(([label, recs]) => ({ label, view: buildViews(aggregate(recs), a.top) }));
  } else {
    chunks = [{ label: '', view: buildViews(aggregate(records), a.top) }];
  }

  const doc = a.format === 'json'
    ? JSON.stringify(a.by ? chunks : chunks[0].view, null, 2) + '\n'
    : chunks.map(c => (c.label ? `═══ ${c.label} ═══\n\n` : '') + renderMd(c.view, a.top)).join('\n');
  if (a.out) {
    try { fs.writeFileSync(a.out, doc); } catch (err) { die(`cannot write ${a.out}: ${err.message}`); }
    process.stderr.write(`tracetranscript: report -> ${a.out}\n`);
  } else {
    process.stdout.write(doc);
  }
}

const a = parseArgs(process.argv.slice(2));
if (a.cmd === 'scan') await cmdScan(a);
else if (a.cmd === 'report') await cmdReport(a);
else { process.stderr.write(USAGE + '\n'); process.exit(a.cmd ? 1 : 0); }
