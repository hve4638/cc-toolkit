import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '..', '..', 'skills', 'memhome', 'scripts', 'relocate-memory.mjs');

function runGit(cwd, env, ...args) {
  return spawnSync('git', args, { cwd, env, encoding: 'utf-8' });
}

// 통합 테스트: 임시 HOME과 임시 프로젝트 디렉터리에서 스크립트를 실제 프로세스로
// 실행한다.
// WHY: 스크립트는 process.cwd() 기준으로 git을 부르고 homedir()(= $HOME)로
//      legacy slug와 기본 타깃을 찾는다 — cwd와 HOME을 둘 다 임시 경로로
//      돌려야 실제 동작을 본다.
function setup({ git: useGit = true, commit = true } = {}) {
  // realpath: mkdtemp 경로에 symlink가 섞이면 git이 돌려주는 경로와 어긋나
  //           slug·key 계산이 틀어진다.
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'relocate-memory-test-')));
  const home = join(base, 'home');
  const repo = join(base, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  const env = { ...process.env, HOME: home };
  if (useGit) {
    const init = runGit(repo, env, 'init', '-q');
    assert.equal(init.status, 0, init.stderr);
    if (commit) {
      const c = runGit(repo, env, '-c', 'user.email=t@t', '-c', 'user.name=t',
        'commit', '--allow-empty', '-q', '-m', 'init');
      assert.equal(c.status, 0, c.stderr);
    }
  }
  // 스크립트와 같은 규칙으로 legacy slug 디렉터리를 계산한다 (프로젝트 루트 경로 기반).
  const legacyDir = join(home, '.claude', 'projects', repo.replace(/[^A-Za-z0-9-]/g, '-'), 'memory');
  const settingsPath = join(repo, '.claude', 'settings.local.json');
  // 스크립트와 같은 규칙으로 기본 타깃을 계산한다: git repo면
  // ~/.agent-memory/<basename>-<루트커밋 12자>/memory, non-git이면
  // <프로젝트 루트>/.agent-memory/memory.
  let target;
  let settingsValue;
  if (useGit && commit) {
    const rootCommit = runGit(repo, env, 'rev-list', '--max-parents=0', 'HEAD').stdout.trim();
    const key = `${basename(repo).replace(/[^A-Za-z0-9-]/g, '-')}-${rootCommit.slice(0, 12)}`;
    settingsValue = `~/.agent-memory/${key}/memory`;
    target = join(home, '.agent-memory', key, 'memory');
  } else if (!useGit) {
    target = join(repo, '.agent-memory', 'memory');
    settingsValue = target;
  }
  return { base, home, repo, env, legacyDir, settingsPath, target, settingsValue };
}

function withSetup(fn, opts) {
  const ctx = setup(opts);
  return Promise.resolve(fn(ctx)).finally(() => rmSync(ctx.base, { recursive: true, force: true }));
}

function run(ctx, args = [], cwd = ctx.repo) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf-8',
    env: ctx.env,
  });
}

function writeFileP(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function readSettings(ctx) {
  return JSON.parse(readFileSync(ctx.settingsPath, 'utf-8'));
}

test('first run migrates legacy slug memory and writes settings', async () => {
  await withSetup(async (ctx) => {
    writeFileP(join(ctx.legacyDir, 'a.md'), 'A');
    writeFileP(join(ctx.legacyDir, 'sub', 'b.md'), 'B');
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(ctx.target, 'a.md'), 'utf-8'), 'A');
    assert.equal(readFileSync(join(ctx.target, 'sub', 'b.md'), 'utf-8'), 'B');
    assert.equal(existsSync(ctx.legacyDir), false);
    assert.match(r.stdout, /Files migrated from legacy: 2/);
    // settings에는 리터럴 `~/` 형태로 저장된다.
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

test('rerun is idempotent and reports no change', async () => {
  await withSetup(async (ctx) => {
    writeFileP(join(ctx.legacyDir, 'a.md'), 'A');
    assert.equal(run(ctx).status, 0);
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Files migrated from legacy: 0/);
    assert.match(r.stdout, /no change/);
    assert.equal(readFileSync(join(ctx.target, 'a.md'), 'utf-8'), 'A');
  });
});

// 치유 시나리오: settings의 절대경로가 낡았을 때 재실행이 그 위치의 파일을
// 새 타깃으로 옮기고 settings를 갱신한다.
test('rerun heals a stale previous path: files move and settings update', async () => {
  await withSetup(async (ctx) => {
    const old = join(ctx.base, 'old-memory');
    writeFileP(join(old, 'c.md'), 'C');
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: old, other: 'kept' }, null, 2));
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(ctx.target, 'c.md'), 'utf-8'), 'C');
    assert.equal(existsSync(join(old, 'c.md')), false);
    assert.match(r.stdout, /Files migrated from previous location: 1/);
    const settings = readSettings(ctx);
    assert.equal(settings.autoMemoryDirectory, ctx.settingsValue);
    // 키 보존 merge — 다른 설정을 지우지 않는다.
    assert.equal(settings.other, 'kept');
  });
});

// 전환 치유: 구 in-repo 기본(<repo>/.agent-memory/memory)을 쓰던 사용자가
// 재실행하면 previous 소스 치유로 새 고정경로로 이전된다.
test('transition: old in-repo default heals to the new home target', async () => {
  await withSetup(async (ctx) => {
    const oldTarget = join(ctx.repo, '.agent-memory', 'memory');
    writeFileP(join(oldTarget, 'm.md'), 'M');
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: oldTarget }, null, 2));
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(ctx.target, 'm.md'), 'utf-8'), 'M');
    assert.equal(existsSync(join(oldTarget, 'm.md')), false);
    assert.match(r.stdout, /Files migrated from previous location: 1/);
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

test('conflicting file paths abort with nothing moved and settings untouched', async () => {
  await withSetup(async (ctx) => {
    writeFileP(join(ctx.legacyDir, 'a.md'), 'legacy');
    writeFileP(join(ctx.target, 'a.md'), 'target');
    const r = run(ctx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /refusing to move anything/);
    assert.match(r.stderr, /a\.md \(legacy vs target\)/);
    assert.match(r.stderr, /Settings were not modified/);
    // 전부-아니면-전무: 양쪽 다 그대로다.
    assert.equal(readFileSync(join(ctx.legacyDir, 'a.md'), 'utf-8'), 'legacy');
    assert.equal(readFileSync(join(ctx.target, 'a.md'), 'utf-8'), 'target');
    assert.equal(existsSync(ctx.settingsPath), false);
  });
});

test('conflict abort leaves an existing settings file byte-identical', async () => {
  await withSetup(async (ctx) => {
    const old = join(ctx.base, 'old-memory');
    writeFileP(join(old, 'c.md'), 'C');
    const settingsRaw = `${JSON.stringify({ autoMemoryDirectory: old, other: 'kept' }, null, 2)}\n`;
    writeFileP(ctx.settingsPath, settingsRaw);
    writeFileP(join(ctx.legacyDir, 'a.md'), 'legacy');
    writeFileP(join(ctx.target, 'a.md'), 'target');
    const r = run(ctx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Settings were not modified/);
    assert.equal(readFileSync(ctx.settingsPath, 'utf-8'), settingsRaw);
    // previous 소스도 그대로다.
    assert.equal(readFileSync(join(old, 'c.md'), 'utf-8'), 'C');
  });
});

// 디렉터리 전체 이동 참사 방지: previous가 프로젝트 루트를 포함하면 소스에서 제외한다.
test('previous that contains the project root is skipped with a warning; the rest proceeds', async () => {
  await withSetup(async (ctx) => {
    writeFileP(join(ctx.legacyDir, 'a.md'), 'A');
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: ctx.repo }, null, 2));
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Warning: previous autoMemoryDirectory contains the target, the legacy memory, or the project root/);
    assert.equal(readFileSync(join(ctx.target, 'a.md'), 'utf-8'), 'A');
    // repo 내용물은 소스로 취급되지 않아 그대로다.
    assert.equal(existsSync(join(ctx.repo, '.git')), true);
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

// `relocate-memory.mjs ~` 실행이 써넣는 값 — 조상 가드가 잡아 홈 디렉터리
// 전체가 이동되는 참사를 막는다.
test('previous of ~/ is skipped with a warning instead of moving the home directory', async () => {
  await withSetup(async (ctx) => {
    writeFileP(join(ctx.home, '.bashrc'), 'rc');
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: '~/' }, null, 2));
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Warning: previous autoMemoryDirectory contains the target, the legacy memory, or the project root/);
    assert.equal(readFileSync(join(ctx.home, '.bashrc'), 'utf-8'), 'rc');
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

test('previous with an unsupported form is skipped with a warning', async () => {
  await withSetup(async (ctx) => {
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: 'relative/path' }, null, 2));
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Warning: previous autoMemoryDirectory has an unsupported form/);
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

test('previous pointing at a regular file is skipped with a warning', async () => {
  await withSetup(async (ctx) => {
    const old = join(ctx.base, 'old-memory');
    writeFileP(old, 'not a directory');
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: old }, null, 2));
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Warning: previous autoMemoryDirectory is not a directory/);
    assert.equal(readFileSync(old, 'utf-8'), 'not a directory');
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

// linked worktree에서 실행해도 타깃(루트 커밋 기반 key)과 settings 위치(메인
// 체크아웃)가 같은 곳으로 수렴한다 — Claude Code가 워크트리 세션에서도 메인
// 체크아웃의 settings.local.json을 읽기 때문에 한 번 실행이 전 워크트리를 덮는다.
test('linked worktree run writes settings to the main checkout, not the worktree', async () => {
  await withSetup(async (ctx) => {
    const wt = join(ctx.base, 'wt');
    const add = runGit(ctx.repo, ctx.env, 'worktree', 'add', '-q', wt);
    assert.equal(add.status, 0, add.stderr);
    writeFileP(join(ctx.legacyDir, 'a.md'), 'A');
    const r = run(ctx, [], wt);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(join(wt, '.claude', 'settings.local.json')), false);
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
    // legacy slug도 메인 체크아웃 기준이라 워크트리에서 실행해도 같은 소스를 옮긴다.
    assert.equal(readFileSync(join(ctx.target, 'a.md'), 'utf-8'), 'A');
  });
});

// 메인 체크아웃 settings를 읽으므로, 워크트리에서만 실행해도 이전 위치 치유가 된다.
test('linked worktree run heals a stale previous path from the main checkout settings', async () => {
  await withSetup(async (ctx) => {
    const wt = join(ctx.base, 'wt');
    assert.equal(runGit(ctx.repo, ctx.env, 'worktree', 'add', '-q', wt).status, 0);
    const old = join(ctx.base, 'old-memory');
    writeFileP(join(old, 'c.md'), 'C');
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: old }, null, 2));
    const r = run(ctx, [], wt);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(ctx.target, 'c.md'), 'utf-8'), 'C');
    assert.match(r.stdout, /Files migrated from previous location: 1/);
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

// 구 버전(≤ 0.56.0)이 워크트리에 써둔 값은 이제 메인 체크아웃 값에 덮이므로,
// 다른 경로를 가리키고 있으면 이전되지 않은 채 남는다는 경고만 낸다.
test('a worktree keeping its own autoMemoryDirectory is reported, not touched', async () => {
  await withSetup(async (ctx) => {
    const wt = join(ctx.base, 'wt');
    assert.equal(runGit(ctx.repo, ctx.env, 'worktree', 'add', '-q', wt).status, 0);
    const stale = join(ctx.base, 'stale-memory');
    const wtSettingsPath = join(wt, '.claude', 'settings.local.json');
    writeFileP(wtSettingsPath, JSON.stringify({ autoMemoryDirectory: stale }, null, 2));
    writeFileP(join(stale, 's.md'), 'S');
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Warning: a worktree keeps its own autoMemoryDirectory/);
    assert.match(r.stdout, new RegExp(stale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    // 경고만 한다 — 워크트리 파일도 그쪽 메모리도 건드리지 않는다.
    assert.equal(JSON.parse(readFileSync(wtSettingsPath, 'utf-8')).autoMemoryDirectory, stale);
    assert.equal(readFileSync(join(stale, 's.md'), 'utf-8'), 'S');
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

// 같은 타깃을 가리키는 잔재는 남길 메모리가 없으므로 조용히 지나간다 —
// `~/` 리터럴과 확장된 절대경로 양쪽 다.
test('a worktree leftover naming the target produces no warning', async () => {
  await withSetup(async (ctx) => {
    const wt = join(ctx.base, 'wt');
    assert.equal(runGit(ctx.repo, ctx.env, 'worktree', 'add', '-q', wt).status, 0);
    writeFileP(join(wt, '.claude', 'settings.local.json'),
      JSON.stringify({ autoMemoryDirectory: ctx.settingsValue }, null, 2));
    const r1 = run(ctx);
    assert.equal(r1.status, 0, r1.stderr);
    assert.doesNotMatch(r1.stdout, /a worktree keeps its own/);
    // 확장된 형태로 적혀 있어도 같은 디렉터리다.
    writeFileP(join(wt, '.claude', 'settings.local.json'),
      JSON.stringify({ autoMemoryDirectory: ctx.target }, null, 2));
    const r2 = run(ctx);
    assert.equal(r2.status, 0, r2.stderr);
    assert.doesNotMatch(r2.stdout, /a worktree keeps its own/);
  });
});

// 나머지 침묵 조건 둘: legacy 소스를 가리키는 잔재와, 존재하지 않는 디렉터리.
test('a worktree leftover naming the legacy source or a missing directory produces no warning', async () => {
  await withSetup(async (ctx) => {
    const wt = join(ctx.base, 'wt');
    assert.equal(runGit(ctx.repo, ctx.env, 'worktree', 'add', '-q', wt).status, 0);
    const wtSettingsPath = join(wt, '.claude', 'settings.local.json');
    writeFileP(join(ctx.legacyDir, 'a.md'), 'A');
    writeFileP(wtSettingsPath, JSON.stringify({ autoMemoryDirectory: ctx.legacyDir }, null, 2));
    const r1 = run(ctx);
    assert.equal(r1.status, 0, r1.stderr);
    assert.match(r1.stdout, /Files migrated from legacy: 1/);
    assert.doesNotMatch(r1.stdout, /a worktree keeps its own/);

    writeFileP(wtSettingsPath, JSON.stringify({ autoMemoryDirectory: join(ctx.base, 'gone') }, null, 2));
    const r2 = run(ctx);
    assert.equal(r2.status, 0, r2.stderr);
    assert.doesNotMatch(r2.stdout, /a worktree keeps its own/);
  });
});

// 하위 디렉터리에서 실행하면 --git-common-dir가 상대경로(../../.git)로 나온다 —
// cwd 기준 resolve가 그걸 메인 체크아웃으로 되돌리는지 본다.
test('run from a subdirectory still resolves the main checkout', async () => {
  await withSetup(async (ctx) => {
    const sub = join(ctx.repo, 'a', 'b');
    mkdirSync(sub, { recursive: true });
    writeFileP(join(ctx.legacyDir, 'a.md'), 'A');
    const r = run(ctx, [], sub);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(ctx.target, 'a.md'), 'utf-8'), 'A');
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.settingsValue);
  });
});

// 잔재가 이번 실행이 비우는 previous를 가리키면 그 자리에 남는 게 없다.
test('a worktree leftover naming the previous location produces no warning', async () => {
  await withSetup(async (ctx) => {
    const wt = join(ctx.base, 'wt');
    assert.equal(runGit(ctx.repo, ctx.env, 'worktree', 'add', '-q', wt).status, 0);
    const old = join(ctx.base, 'old-memory');
    writeFileP(join(old, 'c.md'), 'C');
    writeFileP(ctx.settingsPath, JSON.stringify({ autoMemoryDirectory: old }, null, 2));
    writeFileP(join(wt, '.claude', 'settings.local.json'), JSON.stringify({ autoMemoryDirectory: old }, null, 2));
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Files migrated from previous location: 1/);
    assert.doesNotMatch(r.stdout, /a worktree keeps its own/);
  });
});

// 메인 체크아웃이 없는 레이아웃은 거부한다: bare repo의 워크트리는 Claude Code가
// 워크트리 자기 settings를 읽고 legacy slug도 이 스크립트 계산과 어긋난다.
test('bare repo worktree is refused instead of writing settings into the git dir', async () => {
  await withSetup(async (ctx) => {
    const bare = join(ctx.base, 'bare.git');
    assert.equal(runGit(ctx.base, ctx.env, 'clone', '--bare', '-q', ctx.repo, bare).status, 0);
    const wt = join(ctx.base, 'bare-wt');
    assert.equal(runGit(bare, ctx.env, 'worktree', 'add', '-q', wt).status, 0);
    const r = run(ctx, [], wt);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Bare repos, submodules and separate git dirs are not supported/);
    assert.equal(existsSync(join(bare, '.claude')), false);
    assert.equal(existsSync(join(wt, '.claude')), false);
  });
});

// 같은 가드의 다른 갈래: git 디렉터리가 체크아웃 밖에 있으면 거기에 settings를
// 쓸 수 없다. `.git`이라는 이름의 bare repo도 basename만으로는 구분되지 않아
// 같은 가드가 잡아야 한다.
test('separate git dir and a bare repo named .git are refused', async () => {
  await withSetup(async (ctx) => {
    const sg = join(ctx.base, 'sg');
    mkdirSync(sg);
    assert.equal(runGit(sg, ctx.env, 'init', '-q', `--separate-git-dir=${join(ctx.base, 'sgdir')}`, '.').status, 0);
    const r1 = run(ctx, [], sg);
    assert.equal(r1.status, 1);
    assert.match(r1.stderr, /not supported/);

    const dotRoot = join(ctx.base, 'dotroot');
    mkdirSync(dotRoot);
    assert.equal(runGit(ctx.base, ctx.env, 'clone', '--bare', '-q', ctx.repo, join(dotRoot, '.git')).status, 0);
    const wt = join(ctx.base, 'dot-wt');
    assert.equal(runGit(join(dotRoot, '.git'), ctx.env, 'worktree', 'add', '-q', wt).status, 0);
    const r2 = run(ctx, [], wt);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /not supported/);
    assert.equal(existsSync(join(dotRoot, '.claude')), false);
  });
});

test('cwd inside .git is refused', async () => {
  await withSetup(async (ctx) => {
    const r = run(ctx, [], join(ctx.repo, '.git'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Not inside a git work tree/);
    assert.equal(existsSync(ctx.settingsPath), false);
  });
});

test('unborn HEAD: no-arg run is refused, explicit target proceeds', async () => {
  await withSetup(async (ctx) => {
    const r1 = run(ctx);
    assert.equal(r1.status, 1);
    assert.match(r1.stderr, /HEAD has no commits yet/);
    const custom = join(ctx.base, 'mem');
    const r2 = run(ctx, [custom]);
    assert.equal(r2.status, 0, r2.stderr);
    assert.equal(readSettings(ctx).autoMemoryDirectory, custom);
  }, { commit: false });
});

test('non-git directory: cwd becomes the project root', async () => {
  await withSetup(async (ctx) => {
    writeFileP(join(ctx.legacyDir, 'a.md'), 'A');
    const r = run(ctx);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(ctx.target, 'a.md'), 'utf-8'), 'A');
    assert.equal(readSettings(ctx).autoMemoryDirectory, ctx.target);
  }, { git: false });
});
