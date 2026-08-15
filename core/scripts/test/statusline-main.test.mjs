import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_MAIN = join(__dirname, '..', '..', 'statusline', 'main.mjs');
const SRC_AIADDON = join(__dirname, '..', 'lib', 'aiaddon.mjs');
const SRC_CORELIB = join(__dirname, '..', 'lib', 'corelib.mjs');
const SRC_SANITIZE = join(__dirname, '..', '..', 'statusline', 'lib', 'sanitize.mjs');

// main.mjs 는 자기 옆의 <종류>/<이름>.mjs 를 생산자로 부르므로, 가짜 생산자를
// 심으려면 core 의 배치를 임시 디렉터리에 그대로 재현해야 한다.
function withTree(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'statusline-main-test-'));
  const statuslineDir = join(dir, 'core', 'statusline');
  const libDir = join(dir, 'core', 'scripts', 'lib');
  mkdirSync(statuslineDir, { recursive: true });
  mkdirSync(libDir, { recursive: true });
  copyFileSync(SRC_MAIN, join(statuslineDir, 'main.mjs'));
  copyFileSync(SRC_AIADDON, join(libDir, 'aiaddon.mjs'));
  copyFileSync(SRC_CORELIB, join(libDir, 'corelib.mjs'));
  mkdirSync(join(statuslineDir, 'lib'), { recursive: true });
  copyFileSync(SRC_SANITIZE, join(statuslineDir, 'lib', 'sanitize.mjs'));

  const project = join(dir, 'project');
  mkdirSync(join(project, '.config', 'aiaddon'), { recursive: true });
  const home = join(dir, 'home');
  mkdirSync(home, { recursive: true });

  const tree = {
    project,
    entries: (text) => writeFileSync(join(project, '.config', 'aiaddon', 'statusline'), text),
    producer: (kind, name, body) => {
      mkdirSync(join(statuslineDir, kind), { recursive: true });
      writeFileSync(join(statuslineDir, kind, `${name}.mjs`), body);
    },
    run: (options = {}) => {
      const result = spawnSync('node', [join(statuslineDir, 'main.mjs')], {
        encoding: 'utf8',
        input: options.stdin === undefined
          ? JSON.stringify({ cwd: project, workspace: { project_dir: project } })
          : options.stdin,
        // 기본 cwd 는 project 가 아닌 상위 — 세션 루트가 stdin 에서 온다는 것을
        // 이 차이가 증명한다.
        cwd: options.cwd ?? dir,
        env: { ...process.env, HOME: home },
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    },
  };

  try {
    return fn(tree);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const emits = (text, priority) =>
  `${priority ? `export const priority = ${JSON.stringify(priority)};\n` : ''}export function render() { return ${JSON.stringify(text)}; }\n`;

test('renders the producers the entries turn on', () => {
  withTree((tree) => {
    tree.producer('feat', 'one', emits('first'));
    tree.entries('feat:one\n');
    assert.equal(tree.run(), 'first\n');
  });
});

test('priority bands order the lines, file order settles ties', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', emits('a', 'low'));
    tree.producer('feat', 'b', emits('b', 'high'));
    tree.producer('feat', 'c', emits('c'));
    tree.producer('feat', 'd', emits('d', 'high'));
    tree.entries('feat:a\nfeat:b\nfeat:c\nfeat:d\n');
    assert.equal(tree.run(), 'b\nd\nc\na\n');
  });
});

test('an unknown priority falls to the middle band', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', emits('a', 'urgent'));
    tree.producer('feat', 'b', emits('b', 'low'));
    tree.entries('feat:a\nfeat:b\n');
    assert.equal(tree.run(), 'a\nb\n');
  });
});

test('an entry with no module is ignored', () => {
  withTree((tree) => {
    tree.producer('feat', 'real', emits('real'));
    tree.entries('feat:real\nfeat:imaginary\nknow:elsewhere\n');
    assert.equal(tree.run(), 'real\n');
  });
});

// aiaddon 이름 문법 완화로 다중 콜론·평평한 항목이 파서를 통과하게 됐다 —
// 앞 두 조각으로 절단 해석하면 오타가 실존 모듈을 켜므로, 통째로 무시돼야 한다.
test('a multi-colon or flat entry is not truncated into a real module', () => {
  withTree((tree) => {
    tree.producer('feat', 'real', emits('real'));
    tree.entries('feat:real\nfeat:real:ko\nplainname\n');
    assert.equal(tree.run(), 'real\n');
  });
});

test('a producer with nothing to say takes no line', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', 'export function render() { return null; }\n');
    tree.producer('feat', 'b', emits('b'));
    tree.entries('feat:a\nfeat:b\n');
    assert.equal(tree.run(), 'b\n');
  });
});

test('a throwing producer costs only its own lines', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', 'export function render() { throw new Error("boom"); }\n');
    tree.producer('feat', 'b', emits('b'));
    tree.entries('feat:a\nfeat:b\n');
    assert.equal(tree.run(), 'b\n');
  });
});

test('a producer may hold several lines', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', emits('one\ntwo'));
    tree.producer('feat', 'b', emits('three'));
    tree.entries('feat:a\nfeat:b\n');
    assert.equal(tree.run(), 'one\ntwo\nthree\n');
  });
});

test('output stops at ten lines', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', emits(Array.from({ length: 15 }, (_, i) => `line${i}`).join('\n')));
    tree.entries('feat:a\n');
    assert.equal(tree.run().trimEnd().split('\n').length, 10);
  });
});

test('args reach the producer', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', 'export function render(context, args) { return `lang=${args.lang}`; }\n');
    tree.entries('feat:a@lang=ko\n');
    assert.equal(tree.run(), 'lang=ko\n');
  });
});

test('an async producer is awaited', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', 'export async function render() { return "later"; }\n');
    tree.entries('feat:a\n');
    assert.equal(tree.run(), 'later\n');
  });
});

test('the session root from stdin selects the local layer', () => {
  withTree((tree) => {
    tree.producer('feat', 'a', 'export function render(context) { return context.projectRoot; }\n');
    tree.entries('feat:a\n');
    assert.match(tree.run(), /project\n$/);
  });
});

// stdin 없이 직접 부르면 설치 확인용 진단이 나온다.
test('a bare run reports which entries reach a module', () => {
  withTree((tree) => {
    tree.producer('feat', 'real', emits('real'));
    tree.entries('feat:real\nfeat:imaginary\n');
    const out = tree.run({ stdin: '', cwd: tree.project });
    assert.match(out, /2 entries in aiaddon statusline/);
    assert.match(out, /feat:real {2}ok/);
    assert.match(out, /feat:imaginary {2}no module at/);
  });
});
