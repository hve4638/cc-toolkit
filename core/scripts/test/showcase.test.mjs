import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  columnsOf, labels, layoutString, paneKey, parseLayout, planAppend, planLevel,
} from '../../skills/showcase/scripts/showcase.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(__dirname, '..', '..', 'skills', 'showcase', 'scripts', 'showcase.mjs');

// --------------------------------------------------------------- pane keys

test('pane keys never collide — exhaustive over one lap', () => {
  const seen = new Set();
  for (let i = 0; i < 65536; i++) seen.add(paneKey(`%${i}`));
  assert.equal(seen.size, 65536);
});

test('pane keys stay distinct across the 65536 wrap', () => {
  assert.equal(paneKey('%0'), '56c1');
  assert.equal(paneKey('%257'), '0822');
  assert.equal(paneKey('%65536'), '156c1');
  assert.notEqual(paneKey('%65536'), paneKey('%0'));
  assert.equal(paneKey('%131072'), '256c1');
});

// ------------------------------------------------------------ position hints

const pane = (id, left, top, width, height) => ({ id, left, top, width, height, cmd: 'bash' });
const hintsOf = (panes, win, zoomed = false) =>
  [...labels(panes, win, zoomed).values()];

test('the demo layout gets left / right-top / right-bottom', () => {
  const panes = [pane('%1', 0, 0, 40, 24), pane('%2', 41, 0, 39, 12), pane('%3', 41, 13, 39, 11)];
  const hint = labels(panes, { width: 80, height: 24 }, false);
  assert.equal(hint.get('%1'), 'left');
  assert.equal(hint.get('%2'), 'right-top');
  assert.equal(hint.get('%3'), 'right-bottom');
});

test('a 2x2 grid is labelled on both axes', () => {
  const panes = [
    pane('%1', 0, 0, 40, 12), pane('%2', 0, 13, 40, 11),
    pane('%3', 41, 0, 39, 12), pane('%4', 41, 13, 39, 11),
  ];
  const hint = labels(panes, { width: 80, height: 24 }, false);
  assert.equal(hint.get('%1'), 'left-top');
  assert.equal(hint.get('%4'), 'right-bottom');
});

test('a single column is labelled without a side', () => {
  const panes = [pane('%1', 0, 0, 80, 12), pane('%2', 0, 13, 80, 11)];
  const hint = labels(panes, { width: 80, height: 24 }, false);
  assert.deepEqual([...hint.values()], ['top', 'bottom']);
});

test('a stack of four in one column says nothing', () => {
  const panes = [
    pane('%1', 0, 0, 80, 5), pane('%2', 0, 6, 80, 5),
    pane('%3', 0, 12, 80, 5), pane('%4', 0, 18, 80, 5),
  ];
  assert.deepEqual(hintsOf(panes, { width: 80, height: 23 }), ['', '', '', '']);
});

test('a fourth row inside a side column is numbered', () => {
  const panes = [
    pane('%1', 0, 0, 40, 24),
    pane('%2', 41, 0, 39, 6), pane('%3', 41, 7, 39, 5),
    pane('%4', 41, 13, 39, 5), pane('%5', 41, 19, 39, 5),
  ];
  const hint = labels(panes, { width: 80, height: 24 }, false);
  assert.equal(hint.get('%2'), 'right-1');
  assert.equal(hint.get('%5'), 'right-4');
});

test('a layout that is not a grid of columns says nothing', () => {
  // the bottom pane spans both right-hand columns, so "center" would be a lie
  const panes = [
    pane('%1', 0, 0, 40, 24), pane('%2', 41, 0, 19, 12),
    pane('%3', 61, 0, 19, 12), pane('%4', 41, 13, 39, 11),
  ];
  assert.deepEqual(hintsOf(panes, { width: 80, height: 24 }), ['', '', '', '']);
});

test('four columns say nothing', () => {
  const panes = [
    pane('%1', 0, 0, 19, 24), pane('%2', 20, 0, 19, 24),
    pane('%3', 40, 0, 19, 24), pane('%4', 60, 0, 20, 24),
  ];
  assert.deepEqual(hintsOf(panes, { width: 80, height: 24 }), ['', '', '', '']);
});

test('a zoomed window says nothing — its coordinates overlap', () => {
  const panes = [pane('%1', 0, 0, 80, 24), pane('%2', 41, 0, 39, 24)];
  assert.deepEqual(hintsOf(panes, { width: 80, height: 24 }, true), ['', '']);
});

// ------------------------------------------------------------- layout tree

// captured from a live tmux 3.4: left column split in two, right column with a
// nested pair at the bottom — the shape the placement rules are written against
const NESTED = '148b,209x55,0,0{104x55,0,0[104x27,0,0,257,104x27,0,28,263],'
  + '104x55,105,0[104x27,105,0,264,104x27,105,28{52x27,105,28,265,51x27,158,28,266}]}';
const SIMPLE = '21d3,209x55,0,0{104x55,0,0[104x27,0,0,257,104x27,0,28,263],104x55,105,0,264}';

test('layout strings survive a round trip, checksum included', () => {
  assert.equal(layoutString(parseLayout(NESTED)), NESTED);
  assert.equal(layoutString(parseLayout(SIMPLE)), SIMPLE);
});

test('top-level columns are read off the tree, not guessed from coordinates', () => {
  const cols = columnsOf(parseLayout(NESTED));
  assert.equal(cols.length, 2);
  assert.deepEqual(cols.map((c) => c.x), [0, 105]);
  assert.equal(columnsOf(parseLayout('0000,80x24,0,0,1')).length, 1);
});

test('a new pane lands as the column bottom row, never inside a nested one', () => {
  const root = planAppend(parseLayout(NESTED), 1, '%300');
  const col = columnsOf(root)[1];
  assert.equal(col.kids.length, 3);

  const fresh = col.kids[2];
  assert.equal(fresh.id, '%300');
  assert.equal(fresh.width, col.width, 'spans the whole column');
  assert.equal(fresh.y + fresh.height, col.y + col.height, 'sits at the bottom');

  const nested = col.kids[1];
  assert.equal(nested.type, 'cols', 'the nested pair stays nested');
  assert.deepEqual(nested.kids.map((k) => k.id), ['%265', '%266']);
  assert.deepEqual(nested.kids.map((k) => k.width), [52, 51]);
  assert.deepEqual(nested.kids.map((k) => k.height), [nested.height, nested.height]);

  const heights = col.kids.map((k) => k.height);
  assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `rows even: ${heights}`);
  assert.equal(heights.reduce((a, b) => a + b, 0) + 2, col.height);
  assert.deepEqual(columnsOf(root)[0], columnsOf(parseLayout(NESTED))[0], 'the other column is untouched');
});

test('a column with no room for another row refuses', () => {
  const tight = '0000,209x3,0,0{104x3,0,0,257,104x3,105,0[104x1,105,0,264,104x1,105,2,265]}';
  assert.equal(planAppend(parseLayout(tight), 1, '%300'), null);
});

test('levelling evens out a lopsided column and leaves the rest alone', () => {
  const lopsided = '0000,209x55,0,0{104x55,0,0,257,104x55,105,0[104x40,105,0,264,104x14,105,41,265]}';
  const root = planLevel(parseLayout(lopsided), 1);
  const heights = columnsOf(root)[1].kids.map((k) => k.height);
  assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `rows even: ${heights}`);
  assert.equal(columnsOf(root)[0].height, 55);
});

// -------------------------------------------------------------------- CLI

function runCli(args, env) {
  return spawnSync(process.execPath, [ENGINE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, TMUX: '', TMUX_PANE: '', ...env },
  });
}

test('importing the engine works where argv[1] is not a path', () => {
  const r = spawnSync(process.execPath, ['-e', `import(${JSON.stringify(ENGINE)}).then(m => console.log(m.paneKey('%0')))`, 'not-a-path'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '56c1');
});

test('outside tmux it refuses in one line and does nothing else', () => {
  const r = runCli(['ls'], {});
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^showcase: not inside tmux — tell the user .+ and stop\n$/);
});

const haveTmux = spawnSync('tmux', ['-V'], { encoding: 'utf8' }).status === 0;

test('drives panes in its own window only', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '80', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const serverPid = tmux('display', '-p', '#{pid}').stdout.trim();
    const env = { TMUX: `${socket},${serverPid},$0`, TMUX_PANE: self };

    assert.equal(runCli(['ls'], env).stdout, 'no panes\n');

    const key = runCli(['new'], env).stdout.trim();
    assert.match(key, /^[0-9a-f]{4}$/);
    assert.equal(key, paneKey(tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim().split('\n')[1]));

    const listed = runCli(['ls'], env).stdout;
    assert.match(listed, new RegExp(`^KEY.*\n${key}\\s`));
    assert.doesNotMatch(listed, new RegExp(paneKey(self)), 'the caller must not list its own pane');

    runCli(['send', key, 'echo showcase-probe'], env);
    runCli(['key', key, 'enter'], env);
    const screen = runCli(['read', key], env).stdout;
    assert.match(screen, /showcase-probe/);

    const own = runCli(['kill', paneKey(self)], env);
    assert.equal(own.status, 1);
    assert.match(own.stderr, /your own pane/);

    assert.equal(runCli(['kill', key], env).status, 0);
    assert.equal(runCli(['ls'], env).stdout, 'no panes\n');

    // a pane from another window is unreachable: the key does not resolve here
    tmux('new-window', '-t', 'lab');
    const elsewhere = tmux('list-panes', '-t', 'lab:1', '-F', '#{pane_id}').stdout.trim();
    const reach = runCli(['kill', paneKey(elsewhere)], env);
    assert.equal(reach.status, 1);
    assert.match(reach.stderr, /no such pane/);
    assert.equal(tmux('list-panes', '-t', 'lab:1', '-F', '#{pane_id}').stdout.trim(), elsewhere);

    const stale = runCli(['ls'], { ...env, TMUX_PANE: '%9999' });
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /not inside tmux/);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('places panes by the column rules', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });
  const tree = () => parseLayout(tmux('display', '-p', '-t', 'lab', '#{window_layout}').stdout.trim());
  const paneOf = (key) => tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout
    .trim().split('\n').find((id) => paneKey(id) === key);
  const even = (col) => {
    const hs = col.kids.map((k) => k.height);
    assert.ok(Math.max(...hs) - Math.min(...hs) <= 1, `rows even: ${hs}`);
  };

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '200', '-y', '60');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };

    // 1 — the first pane opens a column beside mine, spanning the full height
    tmux('split-window', '-d', '-v', '-t', self); // my column is two rows deep
    runCli(['new'], env);
    let cols = columnsOf(tree());
    assert.equal(cols.length, 2);
    assert.equal(cols[1].height, 60, 'the new column spans the window');
    assert.equal(cols[0].kids.length, 2, 'my column kept its own panes');

    // 2 — the next one stacks in that column, not in mine
    const second = runCli(['new'], env).stdout.trim();
    cols = columnsOf(tree());
    assert.equal(cols[0].kids.length, 2, 'my column is still off limits');
    assert.equal(cols[1].kids.length, 2);
    assert.equal(cols[1].kids[1].id, paneOf(second), 'appended at the bottom');
    even(cols[1]);

    // 3 — with a nested pair at the bottom, the next one goes underneath it whole
    tmux('split-window', '-d', '-h', '-t', paneOf(second));
    const third = runCli(['new'], env).stdout.trim();
    cols = columnsOf(tree());
    assert.equal(cols[1].kids.length, 3);
    assert.equal(cols[1].kids[1].type, 'cols', 'the nested pair survived');
    assert.equal(cols[1].kids[2].id, paneOf(third));
    assert.equal(cols[1].kids[2].width, cols[1].width, 'spans the whole column');
    even(cols[1]);

    // 4 — killing one levels what is left
    assert.equal(runCli(['kill', third], env).status, 0);
    cols = columnsOf(tree());
    assert.equal(cols[1].kids.length, 2);
    even(cols[1]);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('never lets a payload become a tmux command', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    const key = runCli(['new'], env).stdout.trim();
    const windows = () => tmux('list-windows', '-t', 'lab', '-F', '#{window_id}').stdout.trim().split('\n').length;
    const before = windows();

    // tmux ends a command at an argument finishing in `;`, even after `--`
    runCli(['key', key, ';', 'set-option', '-g', '@probe', 'PWNED'], env);
    runCli(['key', key, 'x;', 'set-option', '-g', '@probe', 'PWNED'], env);
    runCli(['send', key, 'y;', 'set-option', '-g', '@probe', 'PWNED'], env);
    runCli(['key', key, ';', 'new-window', '-d'], env);

    assert.equal(tmux('show-options', '-gv', '@probe').status, 1, 'no option was ever set');
    assert.equal(windows(), before, 'no window escaped the caller\'s own');

    // and the semicolons are typed rather than swallowed
    runCli(['send', key, 'echo A;'], env);
    const screen = runCli(['read', key], env).stdout;
    assert.match(screen, /echo A;/);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('types into a pane the user scrolled back', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    const key = runCli(['new'], env).stdout.trim();
    const id = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim().split('\n')[1];
    const inMode = () => tmux('display', '-p', '-t', id, '#{pane_in_mode}').stdout.trim();

    // one flick of the wheel with `mouse on` lands the pane here, and copy mode
    // turns every key into a copy-mode command: `f` alone opens a prompt
    tmux('copy-mode', '-t', id);
    assert.equal(inMode(), '1');

    const sent = runCli(['send', key, 'echo far off'], env);
    assert.equal(sent.status, 0, sent.stderr);
    assert.equal(inMode(), '0', 'the mode is gone rather than eating the text');
    assert.match(runCli(['read', key], env).stdout, /echo far off/);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a read stops at the last line with something on it', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '40');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    const key = runCli(['new'], env).stdout.trim();
    runCli(['send', key, 'clear; echo MARK'], env);
    runCli(['key', key, 'enter'], env);

    let screen = '';
    for (let i = 0; i < 40 && !screen.includes('MARK'); i++) {
      spawnSync('sleep', ['0.05']);
      screen = runCli(['read', key], env).stdout;
    }
    // the pane is 40 rows and a handful are used: the rest must not come along,
    // or `read | tail` reads a screenful of nothing
    assert.ok(screen.split('\n').length < 12, `no blank padding: ${JSON.stringify(screen)}`);
    assert.match(screen.split('\n').filter(Boolean).at(-1), /\S/);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('keeps a demo command intact, quoting and all', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const proof = join(dir, 'proof.txt');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    runCli(['exec', 'sh', '-c', `echo ONE > ${proof}; sleep 30`], env);
    for (let i = 0; i < 40 && !existsSync(proof); i++) spawnSync('sleep', ['0.05']);
    assert.equal(readFileSync(proof, 'utf8').trim(), 'ONE');
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gives back a zoom it had to drop, and leaves my column alone', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });
  const heightOf = (id) => Number(tmux('list-panes', '-t', 'lab', '-F', '#{pane_id} #{pane_height}').stdout
    .trim().split('\n').find((l) => l.startsWith(`${id} `)).split(' ')[1]);

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '60');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };

    // a lopsided column of my own, so levelling it would be obvious
    const mateA = tmux('split-window', '-d', '-v', '-t', self, '-P', '-F', '#{pane_id}').stdout.trim();
    const mateB = tmux('split-window', '-d', '-v', '-t', mateA, '-P', '-F', '#{pane_id}').stdout.trim();
    tmux('resize-pane', '-y', '40', '-t', self);
    const demo = runCli(['new'], env).stdout.trim();
    const mine = heightOf(self);

    // a zoom on someone else is the user deep in that, so it goes back
    tmux('select-pane', '-t', mateA);
    tmux('resize-pane', '-Z', '-t', mateA);
    runCli(['new'], env);
    assert.equal(tmux('display', '-p', '-t', 'lab', '#{window_zoomed_flag}').stdout.trim(), '1',
      'the zoom the user set is put back');
    tmux('resize-pane', '-Z', '-t', mateA);

    // a zoom on my own pane is the user watching me, so the new pane wins
    tmux('select-pane', '-t', self);
    tmux('resize-pane', '-Z', '-t', self);
    const unzoomed = runCli(['new'], env);
    assert.equal(tmux('display', '-p', '-t', 'lab', '#{window_zoomed_flag}').stdout.trim(), '0',
      'my own zoom is dropped so the new pane shows');
    assert.match(unzoomed.stderr, /dropped the zoom/, unzoomed.stderr);

    assert.equal(runCli(['kill', paneKey(mateB)], env).status, 0);
    assert.equal(heightOf(self), mine, 'killing in my column does not resize me');
    assert.equal(runCli(['kill', demo], env).status, 0);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a demo that exits at once never lands in my column', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '160', '-y', '60');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    const mate = tmux('split-window', '-d', '-v', '-t', self, '-P', '-F', '#{pane_id}').stdout.trim();
    const mine = () => {
      const cols = columnsOf(parseLayout(tmux('display', '-p', '-t', 'lab', '#{window_layout}').stdout.trim()));
      const col = cols.find((c) => JSON.stringify(c).includes(`"${self}"`));
      return JSON.stringify(col).match(/"%\d+"/g).sort();
    };
    const before = mine();

    // `true` is gone before showcase can finish placing it, which is the race
    // the retry exists for; whatever the outcome, my column must be untouched
    for (let i = 0; i < 5; i++) {
      const r = runCli(['exec', 'true'], env);
      assert.ok(r.status === 0 || /nothing changed|window kept changing/.test(r.stderr), r.stderr);
      assert.deepEqual(mine(), before, `my column changed on run ${i + 1}`);
    }
    assert.deepEqual(mine(), [`"${self}"`, `"${mate}"`].sort());
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('works from a directory whose name ends in a semicolon', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const odd = join(dir, 'ends-with;');
  mkdirSync(odd);
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const r = spawnSync(process.execPath, [ENGINE, 'new'], {
      encoding: 'utf8',
      cwd: odd,
      env: {
        ...process.env,
        TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
        TMUX_PANE: self,
      },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(tmux('list-panes', '-t', 'lab', '-F', '#{pane_current_path}').stdout.trim().split('\n')[1], odd);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('kill keeps a zoom that tmux drops', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '40');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    // a mate of my own, so the window still holds two panes at the end — tmux
    // has nothing to zoom into once a single pane is left
    tmux('split-window', '-d', '-v', '-t', self);
    const first = runCli(['new'], env).stdout.trim();
    const second = runCli(['new'], env).stdout.trim();
    const zoomFlag = () => tmux('display', '-p', '-t', 'lab', '#{window_zoomed_flag}').stdout.trim();

    tmux('select-pane', '-t', self);
    tmux('resize-pane', '-Z', '-t', self);
    assert.equal(runCli(['kill', second], env).status, 0);
    assert.equal(zoomFlag(), '1', 'levelling a column must not cost the user their zoom');

    // and the same when the column empties out, which returns early
    assert.equal(runCli(['kill', first], env).status, 0);
    assert.equal(zoomFlag(), '1');
  } finally {
    // tmux 3.4 segfaults when kill-session ends a zoomed session, taking every
    // other session on that server with it — unzoom before tearing down
    if (tmux('display', '-p', '-t', 'lab', '#{window_zoomed_flag}').stdout.trim() === '1') {
      tmux('resize-pane', '-Z', '-t', 'lab');
    }
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('read rejects arguments it does not know', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    const key = runCli(['new'], env).stdout.trim();
    assert.equal(runCli(['read', key, '20'], env).status, 1);
    assert.equal(runCli(['read', key, '--tail', '5'], env).status, 1);
    assert.equal(runCli(['read', key, '-n', 'x'], env).status, 1);
    assert.equal(runCli(['read', key, '-n', '5'], env).status, 0);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('new takes no command and exec insists on one', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    assert.equal(runCli(['new', '--', 'true'], env).status, 1);
    assert.equal(runCli(['new', 'true'], env).status, 1);
    assert.equal(runCli(['exec'], env).status, 1);
    // a command that looks like an option still reaches the pane whole
    assert.equal(runCli(['exec', 'sleep', '30'], env).status, 0);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('new hands out the WHERE hint next to the key, and says it does not keep', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '120', '-y', '24');
    const self = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: self,
    };
    const r = runCli(['new'], env);
    assert.match(r.stdout.trim(), /^[0-9a-f]{4}$/, r.stdout);
    assert.match(r.stderr, /the new pane sits at right\n/, r.stderr);
    assert.match(r.stderr, /WHERE shifts/, r.stderr);
    assert.match(runCli(['ls'], env).stderr, /WHERE shifts/);
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stacks in the other column when I sit on the right', { skip: !haveTmux && 'tmux not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-test-'));
  const socket = join(dir, 'sock');
  const tmux = (...args) => spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' });

  try {
    tmux('new-session', '-d', '-s', 'lab', '-x', '200', '-y', '60');
    const left = tmux('list-panes', '-t', 'lab', '-F', '#{pane_id}').stdout.trim();
    const right = tmux('split-window', '-d', '-h', '-t', left, '-P', '-F', '#{pane_id}').stdout.trim();
    const env = {
      TMUX: `${socket},${tmux('display', '-p', '#{pid}').stdout.trim()},$0`,
      TMUX_PANE: right, // the agent sits in the right-hand column
    };

    runCli(['new'], env);
    const cols = columnsOf(parseLayout(tmux('display', '-p', '-t', 'lab', '#{window_layout}').stdout.trim()));
    assert.equal(cols.length, 2, 'no third column appears');
    assert.equal(cols[0].kids.length, 2, 'the demo went into the left column');
    assert.equal(cols[1].id, right, 'my own column is untouched');
  } finally {
    tmux('kill-session', '-t', 'lab');
    rmSync(dir, { recursive: true, force: true });
  }
});
