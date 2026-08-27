// /wtree 셋업 공통부: 경로 상수, 언어 선택, 템플릿 열거, 외부 명령 실행.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_DIR = resolve(SCRIPTS_DIR, '..');

export const isFile = (p) => existsSync(p) && statSync(p).isFile();
export const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

// ---- 언어 ------------------------------------------------------------------
// --ko 를 받으면 <이름>.ko.md 를 먼저 찾고, 없으면 영문 <이름>.md 로 폴백한다.
let ko = false;
export const isKo = () => ko;
export function setKo(on) {
  ko = Boolean(on);
}
const localized = (dir, base) => {
  const k = join(dir, base + '.ko.md');
  return ko && existsSync(k) ? k : join(dir, base + '.md');
};

// ---- 템플릿 열거 ----------------------------------------------------------
// templates/hooks/<기능>/<변형>/ 2단 구조 — 변형 폴더가 곧 완성품 훅 세트다.
// 같은 기능의 변형들은 목록에서 배타 선택된다(feature 가 배타 그룹 키).
// 각 변형의 INFO.md 첫 줄이 목록용 한 줄 요약이다.
export function listHookVariants() {
  const root = join(SKILL_DIR, 'templates', 'hooks');
  const out = [];
  const dirs = (p) => readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()).sort();
  for (const feature of dirs(root)) {
    const fdir = join(root, feature);
    const variants = dirs(fdir);
    for (const variant of variants)
      out.push({
        feature,
        variant,
        name: variants.length > 1 ? `${feature} · ${variant}` : feature,
        dir: join(fdir, variant),
        summary: readFileSync(localized(join(fdir, variant), 'INFO'), 'utf8').split('\n')[0].trim(),
      });
  }
  return out;
}

// ---- 외부 명령 ------------------------------------------------------------
export function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return {
    ok: r.status === 0 && !r.error,
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    all: ((r.stdout || '') + (r.stderr || '')).trim(),
  };
}

export function git(args, opts) {
  return sh('git', args, opts);
}
