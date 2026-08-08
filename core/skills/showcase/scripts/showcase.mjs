#!/usr/bin/env node
/**
 * showcase — panes the user watches, inside the tmux window the caller sits in.
 *
 * Everything is derived from tmux on every call and nothing is stored anywhere:
 * the anchor window, the pane keys and the position labels are all recomputed
 * from one `list-panes` read.
 *
 * WHY the narrow reach: this runs against the user's real tmux server, where a
 * stray target can destroy their work. The only panes addressable are the ones
 * `list-panes -t $TMUX_PANE` returns (the caller's own window), the caller's
 * pane is never a target, and no user string ever becomes a tmux subcommand.
 */

import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const USAGE = `showcase — demo panes in the window you are already in

  showcase new [-- command...]             open a pane; prints its key
  showcase ls                              panes in this window (yours excluded)
  showcase send KEY <text...>              type text literally (no Enter)
  showcase key KEY <key...>                press keys: enter esc tab up c-c f5 ...
  showcase read KEY [-n N | --all] [--ansi]  capture the pane's screen
  showcase kill KEY                        close the pane

The first pane opens a column beside the one you sit in; the rest stack at the
bottom of that column, sharing its height evenly. A pane started with a command
disappears when that command ends. Terminal work the user does not need to watch
belongs in vt.
`;

// Key names, kept identical to vt so both tools take the same spelling.
const KEYMAP = {
  enter: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab', space: 'Space',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', bs: 'BSpace',
  backspace: 'BSpace', home: 'Home', end: 'End', pgup: 'PageUp',
  pgdn: 'PageDown', del: 'DC',
};

const COL_NAMES = { 1: [''], 2: ['left', 'right'], 3: ['left', 'center', 'right'] };
const ROW_NAMES = { 1: [''], 2: ['top', 'bottom'], 3: ['top', 'middle', 'bottom'] };

function die(msg) {
  process.stderr.write(`showcase: ${msg}\n`);
  process.exit(1);
}

// --------------------------------------------------------------- pane keys

/**
 * 16-bit permutation: every step is individually invertible (adding a
 * constant, xor-shift-right, odd multiply mod 2^16), so distinct inputs can
 * never share an output. Neighbouring pane IDs come out looking unrelated,
 * which is the point — the agent has to tell them apart.
 */
function mix(x) {
  x = (x + 0x7ed5) & 0xffff;
  x ^= x >> 8;
  x = (x * 0x2545) & 0xffff;
  x ^= x >> 7;
  x = (x * 0x9e37) & 0xffff;
  x ^= x >> 8;
  return x;
}

/** %N -> 4 hex; past 65536 a lap digit is prefixed, which keeps it injective. */
export function paneKey(paneId) {
  const n = Number(paneId.slice(1));
  const lap = Math.floor(n / 65536);
  return (lap ? lap.toString(16) : '') + mix(n % 65536).toString(16).padStart(4, '0');
}

// ------------------------------------------------------------ position hints

/**
 * A hint for talking to the user ("the right-top one"), never an address.
 * Anything that is not a plain grid of full-height columns — a zoomed pane, an
 * odd split, four columns, four bare rows — yields no labels at all: a wrong
 * hint is worse than none.
 */
export function labels(panes, win, zoomed) {
  const none = new Map(panes.map((p) => [p.id, '']));
  if (zoomed) return none;

  const cols = new Map();
  for (const p of panes) {
    if (!cols.has(p.left)) cols.set(p.left, []);
    cols.get(p.left).push(p);
  }
  const lefts = [...cols.keys()].sort((a, b) => a - b);
  const colNames = COL_NAMES[lefts.length];
  if (!colNames) return none;

  let widthSum = 0;
  for (const left of lefts) {
    const col = cols.get(left).sort((a, b) => a.top - b.top);
    if (col.some((p) => p.width !== col[0].width)) return none;
    // +1 per border between stacked panes
    if (col.reduce((s, p) => s + p.height, 0) + col.length - 1 !== win.height) return none;
    widthSum += col[0].width;
  }
  if (widthSum + lefts.length - 1 !== win.width) return none;

  const out = new Map();
  for (const [ci, left] of lefts.entries()) {
    const col = cols.get(left).sort((a, b) => a.top - b.top);
    // Bare "1"/"2" with no side to anchor them tells the user nothing.
    const rowNames = ROW_NAMES[col.length]
      ?? (lefts.length === 1 ? null : col.map((_, i) => String(i + 1)));
    if (!rowNames) return none;
    for (const [ri, p] of col.entries()) {
      out.set(p.id, [colNames[ci], rowNames[ri]].filter(Boolean).join('-'));
    }
  }
  return out;
}

// --------------------------------------------------------------- layout tree

/**
 * tmux describes a window as a tree in `#{window_layout}`:
 *
 *   21d3,209x55,0,0{104x55,0,0[104x27,0,0,257,104x27,0,28,263],104x55,105,0,264}
 *   └csum └root  └cols└ left column, split into rows      ┘└ right column ┘
 *
 * `{}` puts children side by side, `[]` stacks them, and a leaf ends in its
 * pane number. Panes carry no notion of "column", so this tree is the only way
 * to place a pane as a full-width row of the right-hand column rather than
 * inside whatever happens to sit at the bottom of it.
 */
export function parseLayout(layout) {
  const body = layout.slice(layout.indexOf(',') + 1);
  let at = 0;
  const node = () => {
    const head = /^(\d+)x(\d+),(\d+),(\d+)/.exec(body.slice(at));
    if (!head) throw new Error(`bad layout at ${at}`);
    at += head[0].length;
    const box = { width: +head[1], height: +head[2], x: +head[3], y: +head[4] };
    const open = body[at];
    if (open === '{' || open === '[') {
      at++;
      const kids = [node()];
      while (body[at] === ',') { at++; kids.push(node()); }
      at++;
      return { ...box, type: open === '{' ? 'cols' : 'rows', kids };
    }
    if (open !== ',') throw new Error(`bad layout at ${at}`);
    at++;
    const num = /^\d+/.exec(body.slice(at))[0];
    at += num.length;
    return { ...box, type: 'pane', id: `%${num}` };
  };
  return node();
}

export function layoutString(root) {
  const draw = (n) => {
    const head = `${n.width}x${n.height},${n.x},${n.y}`;
    if (n.type === 'pane') return `${head},${n.id.slice(1)}`;
    const [open, close] = n.type === 'cols' ? ['{', '}'] : ['[', ']'];
    return head + open + n.kids.map(draw).join(',') + close;
  };
  const body = draw(root);
  // tmux refuses a layout whose checksum does not match (layout_checksum)
  let sum = 0;
  for (const ch of body) {
    sum = ((sum >> 1) + ((sum & 1) << 15)) & 0xffff;
    sum = (sum + ch.charCodeAt(0)) & 0xffff;
  }
  return `${sum.toString(16).padStart(4, '0')},${body}`;
}

export const columnsOf = (root) => (root.type === 'cols' ? root.kids : [root]);

const holds = (n, id) => (n.type === 'pane' ? n.id === id : n.kids.some((k) => holds(k, id)));
const rowsOf = (col) => (col.type === 'rows' ? col.kids : [col]);
const leaves = (n) => (n.type === 'pane' ? [n] : n.kids.flatMap(leaves));

/** Smallest a subtree can be squeezed to, borders included. */
const minHeight = (n) => (n.type === 'pane' ? 1
  : n.type === 'rows' ? n.kids.reduce((s, k) => s + minHeight(k), 0) + n.kids.length - 1
    : Math.max(...n.kids.map(minHeight)));
const minWidth = (n) => (n.type === 'pane' ? 1
  : n.type === 'cols' ? n.kids.reduce((s, k) => s + minWidth(k), 0) + n.kids.length - 1
    : Math.max(...n.kids.map(minWidth)));

/** Sizes summing to `room`, shaped like `weights`, never below `mins`. */
function shares(room, weights, mins) {
  if (mins.reduce((a, b) => a + b, 0) > room) return null;
  const total = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w, i) => Math.max(mins[i], Math.round((w / total) * room)));
  let off = room - out.reduce((a, b) => a + b, 0);
  while (off !== 0) {
    let pick = -1;
    for (let i = 0; i < out.length; i++) {
      if (off > 0) { if (pick < 0 || out[i] < out[pick]) pick = i; }
      else if (out[i] > mins[i] && (pick < 0 || out[i] - mins[i] > out[pick] - mins[pick])) pick = i;
    }
    if (pick < 0) return null;
    out[pick] += off > 0 ? 1 : -1;
    off += off > 0 ? -1 : 1;
  }
  return out;
}

/** Refits a subtree into a box, keeping its inner proportions and structure. */
function refit(n, width, height, x, y) {
  Object.assign(n, { width, height, x, y });
  if (n.type === 'pane') return true;
  const down = n.type === 'rows';
  const room = (down ? height : width) - (n.kids.length - 1);
  const sizes = shares(
    room,
    n.kids.map((k) => (down ? k.height : k.width)),
    n.kids.map((k) => (down ? minHeight(k) : minWidth(k))),
  );
  if (!sizes) return false;
  let at = down ? y : x;
  for (const [i, kid] of n.kids.entries()) {
    const ok = down ? refit(kid, width, sizes[i], x, at) : refit(kid, sizes[i], height, at, y);
    if (!ok) return false;
    at += sizes[i] + 1;
  }
  return true;
}

/** Gives a column's top-level rows equal heights; their innards keep their shape. */
function levelRows(col) {
  const rows = rowsOf(col);
  const sizes = shares(col.height - (rows.length - 1), rows.map(() => 1), rows.map(minHeight));
  if (!sizes) return false;
  let y = col.y;
  for (const [i, row] of rows.entries()) {
    if (!refit(row, col.width, sizes[i], col.x, y)) return false;
    y += sizes[i] + 1;
  }
  return true;
}

/**
 * Appends `paneId` as the bottom row of top-level column `index`, spanning the
 * column's full width, then levels that column's rows. Returns the new root, or
 * null when the column cannot hold another row.
 */
export function planAppend(root, index, paneId) {
  const next = structuredClone(root);
  const cols = columnsOf(next);
  const col = cols[index];
  const rows = [...rowsOf(col), { type: 'pane', id: paneId, width: col.width, height: 1, x: col.x, y: col.y }];
  const grown = { type: 'rows', kids: rows, width: col.width, height: col.height, x: col.x, y: col.y };
  if (!levelRows(grown)) return null;
  if (next.type !== 'cols') return grown;
  cols[index] = grown;
  return next;
}

/** Levels top-level column `index` in place. Returns the new root, or null. */
export function planLevel(root, index) {
  const next = structuredClone(root);
  const cols = columnsOf(next);
  if (cols[index].type !== 'rows') return null;
  if (!levelRows(cols[index])) return null;
  return next;
}

// ----------------------------------------------------------------- tmux view

const FIELDS = [
  '#{pid}', '#{pane_id}', '#{pane_left}', '#{pane_top}', '#{pane_width}',
  '#{pane_height}', '#{window_width}', '#{window_height}',
  '#{window_zoomed_flag}', '#{pane_current_command}', '#{window_layout}',
  '#{pane_active}',
];

/**
 * tmux ends one command and starts the next at an argument that finishes with
 * an unescaped `;`, before it ever looks at options — so `--` does not hold it
 * back and `key K ';' new-window` would leave the window entirely. Escaping
 * that one character keeps the text literal. A `;` anywhere else is already
 * literal and must be left alone, or the backslash shows up on screen.
 */
const literal = (s) => (s.endsWith(';') ? `${s.slice(0, -1)}\\;` : s);

function tmux(socket, args) {
  const r = spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });
  if (r.error) die('tmux not found');
  if (r.status !== 0) die(r.stderr.trim() || `tmux ${args[0]} failed`);
  return r.stdout;
}

/** Resolves the anchor window and validates that we may act at all. */
function view() {
  const { TMUX, TMUX_PANE: self } = process.env;
  if (!TMUX || !self) die('not inside tmux — use vt for terminal work');
  const [socket, serverPid] = TMUX.split(',');

  // list-panes both errors on a stale pane and yields the whole window, unlike
  // display-message, which answers about the current pane when the target is bogus.
  const r = spawnSync('tmux', ['-S', socket, 'list-panes', '-t', self, '-F', FIELDS.join('\t')], { encoding: 'utf8' });
  if (r.error) die('tmux not found');
  if (r.status !== 0) die('not inside tmux — use vt for terminal work');

  const rows = r.stdout.trim().split('\n').map((l) => l.split('\t'));
  if (rows[0][0] !== serverPid) die('not inside tmux — use vt for terminal work');

  const panes = rows.map(([, id, left, top, width, height, , , , cmd, , active]) => ({
    id, cmd,
    left: Number(left), top: Number(top),
    width: Number(width), height: Number(height),
    active: active === '1',
  }));
  return {
    socket, self, panes,
    win: { width: Number(rows[0][6]), height: Number(rows[0][7]) },
    zoomed: rows[0][8] === '1',
    layout: rows[0][10],
  };
}

/** Best effort: for undo steps, where failing is not worth reporting. */
function quiet(v, args) {
  return spawnSync('tmux', ['-S', v.socket, ...args], { encoding: 'utf8' }).status === 0;
}

/**
 * Applies a rebuilt tree.
 *
 * tmux fills the cells with the window's panes in order and ignores the pane
 * numbers in the string, so a plan is only meaningful while that order holds.
 * It rejects a layout with too few cells, but quietly merges away the surplus
 * when there are too many — a pane dying in between (a `new -- cmd` finishing,
 * the user closing one) therefore shifts every later pane up a cell, across
 * column boundaries, and still reports success.
 *
 * Checking the order beforehand is not enough on its own: the check and the
 * write are two tmux calls with a gap between them, and nothing locks the
 * window. So the result is read back and compared — tmux echoes an honoured
 * layout verbatim, and anything it had to merge comes back different.
 */
function apply(v, root) {
  const live = tmux(v.socket, ['list-panes', '-t', v.self, '-F', '#{pane_id}']).trim().split('\n');
  const want = leaves(root).map((l) => l.id);
  if (live.length !== want.length || want.some((id, at) => id !== live[at])) return false;

  const sent = layoutString(root);
  if (!quiet(v, ['select-layout', '-t', v.self, sent])) return false;
  const got = spawnSync('tmux', ['-S', v.socket, 'display', '-p', '-t', v.self, '#{window_layout}'], { encoding: 'utf8' });
  return got.status === 0 && got.stdout.trim() === sent;
}

/** Puts back a zoom that split-window and select-layout each drop. Returns
 *  whether it did, because a restored zoom hides whatever was just opened. */
function rezoom(v) {
  if (!v.zoomed) return false;
  const pane = v.panes.find((p) => p.active);
  if (!pane) return false;
  const live = spawnSync('tmux', ['-S', v.socket, 'list-panes', '-t', v.self, '-F', '#{window_zoomed_flag} #{pane_id}'], { encoding: 'utf8' });
  if (live.status !== 0) return false;
  const rows = live.stdout.trim().split('\n').map((l) => l.split(' '));
  // already zoomed again, or the pane is gone: -Z toggles, so do not undo it
  if (rows[0][0] !== '0' || !rows.some((r) => r[1] === pane.id)) return false;
  return spawnSync('tmux', ['-S', v.socket, 'resize-pane', '-Z', '-t', pane.id], { encoding: 'utf8' }).status === 0;
}

const ZOOM_NOTE = 'showcase: the window is zoomed, so the new pane is hidden behind it\n';

function ordered(v) {
  return [...v.panes].sort((a, b) => a.left - b.left || a.top - b.top);
}

function resolve(v, key) {
  if (!key) die('missing pane key');
  const hit = v.panes.find((p) => paneKey(p.id) === key);
  if (!hit) die(`no such pane: ${key} (see \`showcase ls\`)`);
  if (hit.id === v.self) die('that is your own pane');
  return hit;
}

// ------------------------------------------------------------------ commands

const ATTEMPTS = 3;

/** One go at opening a pane. Returns its id, or null if the window moved
 *  under us — in which case it leaves things as it found them. */
function place(v, born) {
  const root = parseLayout(v.layout);
  const cols = columnsOf(root);
  const mine = cols.findIndex((c) => holds(c, v.self));
  if (mine < 0) die('cannot find my own pane in this window');
  // my whole column is off limits, not just my pane: panes the user stacked
  // beside me must not pull demos into the column I sit in
  const target = cols.findIndex((_, at) => at !== mine);

  if (target < 0) {
    // -f spans the window, so the existing layout becomes the left column as a
    // whole instead of my own pane being the only thing that splits
    return tmux(v.socket, ['split-window', '-d', '-fh', '-t', v.self, ...born]).trim();
  }

  const col = cols[target];
  const rows = rowsOf(col);
  // a full column stays full however often we try, so this one is not retried
  if (rows.reduce((s, r) => s + minHeight(r), 0) + rows.length + 1 > col.height) {
    die('no room for another pane in that column');
  }

  // the new pane has to be born in the right place in the window's pane order,
  // which is what select-layout goes by: splitting the column's last pane puts
  // it directly after that one
  const last = leaves(col).at(-1);
  const id = tmux(v.socket, ['split-window', '-d', '-v', '-t', last.id, ...born]).trim();
  const next = planAppend(root, target, id);
  if (next && apply(v, next)) return id;

  // the split resized the column before we got here, so putting the pane back
  // is not enough — the layout read before it has to go back too. Both steps
  // are best effort: the pane may already be gone, which is how we got here.
  quiet(v, ['kill-pane', '-t', id]);
  quiet(v, ['select-layout', '-t', v.self, v.layout]);
  return null;
}

function cmdNew(args) {
  let i = 0;
  for (; i < args.length; i++) {
    if (args[i] === '--') { i++; break; }
    die(`new: unexpected argument: ${args[i]}`);
  }
  // each word stays its own argument: joining them would strip the quoting that
  // makes `new -- sh -c 'echo hi; sleep 3'` one command with one argument
  const command = args.slice(i).map(literal);
  const born = ['-c', literal(process.cwd()), '-P', '-F', '#{pane_id}', ...(command.length ? ['--', ...command] : [])];

  // a pane can vanish between the read and the write — a demo command finishing
  // is normal here — and the plan built from the old order no longer fits. That
  // settles by itself, so back out and read the window again.
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const v = view();
    const id = place(v, born);
    if (id) {
      if (rezoom(v)) process.stderr.write(ZOOM_NOTE);
      return void process.stdout.write(`${paneKey(id)}\n`);
    }
    rezoom(v);
  }
  die('the window kept changing while placing the pane — nothing changed');
}

function cmdLs() {
  const v = view();
  const hint = labels(v.panes, v.win, v.zoomed);
  const rows = ordered(v).filter((p) => p.id !== v.self).map((p) => ({
    KEY: paneKey(p.id),
    WHERE: hint.get(p.id),
    SIZE: `${p.width}x${p.height}`,
    CMD: p.cmd,
  }));
  if (!rows.length) return void process.stdout.write('no panes\n');

  const cols = rows.some((r) => r.WHERE) ? ['KEY', 'WHERE', 'SIZE', 'CMD'] : ['KEY', 'SIZE', 'CMD'];
  const width = (c) => Math.max(c.length, ...rows.map((r) => r[c].length)) + 2;
  const line = (get) => cols.map((c, i) => (i === cols.length - 1 ? get(c) : get(c).padEnd(width(c)))).join('');
  process.stdout.write(`${line((c) => c)}\n`);
  for (const r of rows) process.stdout.write(`${line((c) => r[c])}\n`);
}

function cmdSend(args) {
  const v = view();
  const pane = resolve(v, args[0]);
  const text = args.slice(1).join(' ');
  if (!text) die('send: missing text');
  tmux(v.socket, ['send-keys', '-t', pane.id, '-l', '--', literal(text)]);
}

function cmdKey(args) {
  const v = view();
  const pane = resolve(v, args[0]);
  const keys = args.slice(1);
  if (!keys.length) die('key: missing key name');
  const norm = (k) => {
    const lk = k.toLowerCase();
    if (KEYMAP[lk]) return KEYMAP[lk];
    // the key itself keeps its case — c-A is not c-a
    const mod = /^((?:[cms]-)+)(.+)$/.exec(lk);
    if (mod) return mod[1].toUpperCase() + k.slice(mod[1].length);
    if (/^f\d{1,2}$/.test(lk)) return lk.toUpperCase();
    return k;
  };
  tmux(v.socket, ['send-keys', '-t', pane.id, '--', ...keys.map((k) => literal(norm(k)))]);
}

function cmdRead(args) {
  const v = view();
  const pane = resolve(v, args[0]);
  const rest = args.slice(1);
  const cmd = ['capture-pane', '-p', '-J', '-t', pane.id];
  let at = 0;
  for (; at < rest.length; at++) {
    if (rest[at] === '--ansi') cmd.push('-e');
    else if (rest[at] === '--all') cmd.push('-S', '-', '-E', '-');
    else if (rest[at] === '-n') {
      const n = rest[++at];
      if (!/^[1-9]\d*$/.test(n ?? '')) die('read: -n takes a positive number');
      cmd.push('-S', `-${n}`);
    } else die(`read: unexpected argument: ${rest[at]}`);
  }
  process.stdout.write(tmux(v.socket, cmd));
}

function cmdKill(args) {
  const v = view();
  const pane = resolve(v, args[0]);
  const column = columnsOf(parseLayout(v.layout)).find((c) => holds(c, pane.id));
  const survivors = leaves(column).map((l) => l.id).filter((id) => id !== pane.id);

  tmux(v.socket, ['kill-pane', '-t', pane.id]);
  // kill-pane drops a zoom too, and the reading below happens after that, so the
  // zoom to put back is the one from before
  try {
    if (!survivors.length) return;

    // level what is left of that column; panes that die on their own (a command
    // ending, the user closing one) are tmux's business, not ours
    const after = view();
    const root = parseLayout(after.layout);
    const cols = columnsOf(root);
    const at = cols.findIndex((c) => survivors.some((id) => holds(c, id)));
    // resizing my own column is as unwelcome here as it is in new
    if (at < 0 || holds(cols[at], after.self)) return;
    const levelled = planLevel(root, at);
    if (levelled) apply(after, levelled);
  } finally {
    rezoom(v);
  }
}

function main(argv) {
  const [verb, ...args] = argv;
  const run = { new: cmdNew, ls: cmdLs, send: cmdSend, key: cmdKey, read: cmdRead, kill: cmdKill }[verb];
  if (!verb || verb === '-h' || verb === '--help') return void process.stdout.write(USAGE);
  if (!run) die(`unknown command: ${verb}`);
  // one line on stderr is the whole contract; a stack trace would break it
  try {
    run(args);
  } catch (e) {
    die(e?.message ?? String(e));
  }
}

// the launcher reaches this file through a `..` path, so compare real paths.
// argv[1] is not always a path at all (`node -e` puts the first argument there),
// hence the catch: an import must never blow up on it.
const started = () => {
  try {
    return realpathSync(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
};
if (started()) main(process.argv.slice(2));
