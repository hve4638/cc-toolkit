import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DISPATCHER_SRC = join(__dirname, '..', '..', 'hooks', 'hooks.mjs');

// 실스킬의 hooks.mjs 는 전부 애드온으로 이관돼 없다. 디스패처 자체는 남아
// 있으므로, 합성 스킬을 심은 복제 트리에서 디스패처의 보장을 계속 검증한다.
function withTree(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hooks-dispatcher-test-'));
  mkdirSync(join(dir, 'core', 'hooks'), { recursive: true });
  copyFileSync(DISPATCHER_SRC, join(dir, 'core', 'hooks', 'hooks.mjs'));

  const tree = {
    dir,
    /** 합성 스킬을 심는다. 핸들러는 payload.cwd 의 marks 파일에 한 줄 추가. */
    installSkill: (name, { alias } = {}) => {
      const skillDir = join(dir, 'core', 'skills', name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'hooks.mjs'), `
        import { appendFileSync } from 'node:fs';
        import { join } from 'node:path';
        export function PostToolUse(payload) {
          appendFileSync(join(payload.cwd, 'marks'), '${name}\\n');
        }
      `);
      if (alias) writeFileSync(join(skillDir, '.alias'), alias);
    },
    run: (event, payload) => new Promise((resolve, reject) => {
      const child = spawn('node', [join(dir, 'core', 'hooks', 'hooks.mjs'), event], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      child.stdout.on('data', (c) => { stdout += c.toString(); });
      child.on('error', reject);
      child.on('close', () => resolve(stdout));
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    }),
  };

  return Promise.resolve(fn(tree)).finally(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

// WHY: .alias 스킬은 원본의 verbatim 사본이라 hooks.mjs 까지 딸려온다. 스킵이
//      없으면 같은 핸들러가 이벤트마다 두 번 돌아 부수효과가 중복된다.
test('dispatcher skips .alias skill copies — no duplicate handler runs', async () => {
  await withTree(async (tree) => {
    tree.installSkill('original');
    tree.installSkill('copy', { alias: 'original' });

    await tree.run('PostToolUse', { hook_event_name: 'PostToolUse', cwd: tree.dir });

    const lines = readFileSync(join(tree.dir, 'marks'), 'utf-8').trim().split('\n');
    assert.deepEqual(lines, ['original']);
  });
});

test('스킬이 하나도 없어도 기본 JSON 으로 침묵한다', async () => {
  await withTree(async (tree) => {
    const stdout = await tree.run('PostToolUse', { hook_event_name: 'PostToolUse', cwd: tree.dir });
    assert.deepEqual(JSON.parse(stdout), { continue: true, suppressOutput: true });
    assert.equal(existsSync(join(tree.dir, 'marks')), false);
  });
});
