// /wtree 셋업 스크립트 공통부: 메시지 치환, 에러 계약, 템플릿 열거, 외부 명령 실행.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_DIR = resolve(SCRIPTS_DIR, '..');
const MESSAGES_DIR = join(SCRIPTS_DIR, 'messages');

// ---- 에러 계약 ------------------------------------------------------------
// 내부 에러(스크립트 자체의 결함)는 어떤 메시지 파일보다 우선한다 — 메시지
// 시스템이 고장난 경우에도 나가야 하므로 하드코딩이다.
export function internalError(hint) {
  process.stderr.write(
    [
      '[setup-script internal error]',
      'The script itself failed. Do not continue the setup.',
      'Report to the user that the setup script hit an internal error, and relay the hint below as-is.',
      'hint: ' + hint,
      '',
    ].join('\n'),
  );
  process.exit(2);
}

export function run(fn) {
  try {
    fn();
  } catch (e) {
    internalError(e && e.stack ? e.stack : String(e));
  }
}

// ---- 메시지 치환 ----------------------------------------------------------
// {KEY} 는 대문자 키. 메시지에 있는데 값이 없어도, 값을 줬는데 메시지에 없어도
// 내부 에러다 — md 와 스크립트가 어긋난 순간을 조용히 넘기지 않는다.
const PLACEHOLDER = /\{([A-Z][A-Z0-9_]*)\}/g;

// --ko 를 받으면 <이름>.ko.md 를 먼저 찾고, 없으면 영문 <이름>.md 로 폴백한다.
let ko = false;
export const isKo = () => ko;
const localized = (dir, base) => {
  const k = join(dir, base + '.ko.md');
  return ko && existsSync(k) ? k : join(dir, base + '.md');
};

export function render(name, values = {}) {
  const file = localized(MESSAGES_DIR, name);
  const text = readFileSync(file, 'utf8');
  const found = new Set();
  for (const m of text.matchAll(PLACEHOLDER)) found.add(m[1]);

  const lineOf = (key) => {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) if (lines[i].includes('{' + key + '}')) return i + 1;
    return '?';
  };
  for (const key of found)
    if (!(key in values)) internalError(`${file}:${lineOf(key)} — no value was passed for {${key}}`);
  for (const key of Object.keys(values))
    if (!found.has(key)) internalError(`${file} — the script passed a {${key}} value but the message has no such slot`);

  return text.replace(PLACEHOLDER, (_, key) => String(values[key]));
}

export function say(name, values) {
  process.stdout.write(render(name, values));
}

export function fail(name, values) {
  process.stdout.write(render(name, values));
  process.exit(1);
}

// ---- answer 파싱 ----------------------------------------------------------
// 스텝은 `--answer '<JSON 객체>'` 하나만 받는다. 그 외 인자·비객체·모르는 키는
// onBad 로 넘긴다. --answer 가 없으면 빈 객체 — 순수 조회 모드다.
export function parseAnswer(allowed, onBad) {
  const argv = process.argv.slice(2);
  let raw = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ko') ko = true;
    else if (argv[i] === '--answer') raw = argv[++i];
    else onBad(`unknown argument: ${argv[i]}`);
  }
  if (raw == null) return {};
  let a;
  try {
    a = JSON.parse(raw);
  } catch (e) {
    onBad(`--answer is not JSON (${e.message})`);
  }
  if (typeof a !== 'object' || a === null || Array.isArray(a)) onBad('--answer must be a JSON object');
  for (const k of Object.keys(a)) if (!allowed.includes(k)) onBad(`unknown key in --answer: ${k}`);
  return a;
}

// ---- 템플릿 열거 ----------------------------------------------------------
// templates/<kind>/<이름>/INFO.md 첫 줄이 목록용 한 줄 요약이다.
export function listTemplates(kind) {
  const dir = join(SKILL_DIR, 'templates', kind);
  return readdirSync(dir)
    .filter((d) => statSync(join(dir, d)).isDirectory())
    .sort()
    .map((name) => ({
      name,
      dir: join(dir, name),
      summary: readFileSync(localized(join(dir, name), 'INFO'), 'utf8').split('\n')[0].trim(),
    }));
}

export function templateList(kind) {
  return listTemplates(kind)
    .map((t) => `- "${t.name}": ${t.summary}`)
    .join('\n');
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
