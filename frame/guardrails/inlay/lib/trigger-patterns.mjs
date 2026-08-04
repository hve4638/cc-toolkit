// .inlay 마커 파일의 트리거 패턴 매칭 — 어떤 파일이 inlay 주입·추적을
// 트리거하는지 gitignore 스타일 패턴으로 선언한다.
//
// 지원 서브셋 (gitignore 관례 준수):
// - 줄 단위, trim. 빈 줄과 `#` 주석은 스킵.
// - `!` 접두는 부정 (트리거에서 제외).
// - `/` 없는 패턴은 basename 에 매치 (`*.md` 가 `docs/a.md` 도 잡음).
// - `/` 포함 패턴은 ceiling 상대 경로에 anchored (선행 `/` 는 strip).
// - `*` = `/` 제외 임의 문자열, `?` = `/` 제외 한 글자.
// - `**` 는 슬래시로 구분된 위치 (문자열 시작 또는 `/` 뒤, 그리고 `/` 또는
//   문자열 끝 앞) 에서만 깊이 무관. 그 외 위치 (`a**b`) 는 일반 `*` 취급.
// - trailing `/` 는 그 디렉터리 아래 전부 (`src/` ≡ `src/**`).
// - last-match-wins: 매치되는 줄 중 마지막 줄의 부정 여부가 결론.
//   아무 줄도 매치 안 되면 비트리거 (gitignore 의 unmatched 와 동일).
// 미지원: 문자 클래스 ([abc]), 이스케이프.

import { readFileSync } from 'fs';
import { basename, join, relative, resolve, sep } from 'path';

function escapeRegExp(c) {
  return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      // WHY: gitignore 는 슬래시로 구분된 `**` 만 깊이 무관으로 본다 —
      //      `a**b` 류 비구분 위치의 `**` 는 일반 `*` 취급이라 `/` 를 못 넘는다.
      //      비구분이면 아래 폴백으로 흘러 별 하나당 [^/]* 로 컴파일된다.
      const delimited = (i === 0 || glob[i - 1] === '/')
        && (glob[i + 2] === '/' || glob[i + 2] === undefined);
      if (glob[i + 1] === '*' && delimited) {
        i++;
        // WHY: `**/` 는 "0개 이상의 디렉터리" — `**/a.md` 가 최상위 `a.md` 도
        //      잡아야 하므로 그룹 전체를 optional 로 만든다.
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += escapeRegExp(c);
    }
  }
  return new RegExp(`^${re}$`);
}

// `.inlay` 내용을 패턴 목록으로 파싱. 유효 패턴이 0개면 null (기본 `*` 취급).
function parsePatterns(content) {
  const patterns = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const negated = line.startsWith('!');
    const body = negated ? line.slice(1) : line;
    if (body === '') continue;
    // WHY: anchored 여부는 strip 전 기준 — `/a.md` 는 선행 `/` 만으로 anchored.
    const anchored = body.includes('/');
    let source = body.startsWith('/') ? body.slice(1) : body;
    // WHY: trailing `/` 는 gitignore 의 디렉터리 패턴 — 그 아래 전부로 확장해야
    //      `src/` 한 줄이 "유효 패턴인데 아무것도 안 잡는" 무음 비활성이 안 된다.
    if (source.endsWith('/')) source += '**';
    patterns.push({ negated, anchored, regex: globToRegExp(source) });
  }
  return patterns.length === 0 ? null : patterns;
}

// (파일 절대경로, ceiling 디렉터리) → 이 파일이 inlay 주입·추적을 트리거하는가.
export function isTriggerFile(filePath, ceiling) {
  // WHY: INLAY.md 는 inlay 의 문서 자체라 패턴과 무관하게 항상 비트리거 —
  //      주입하면 자기 본문이 prompt 에 또 들어가 의미상 순환이 생기고,
  //      codeTouched 로 추적하면 문서 수정이 자기 잔소리를 유발한다.
  if (basename(filePath) === 'INLAY.md') return false;

  let content;
  try {
    // WHY: 마커가 디렉터리면 readFileSync 가 throw → 기본 `*` (전부 트리거).
    content = readFileSync(join(ceiling, '.inlay'), 'utf-8');
  } catch {
    return true;
  }
  const patterns = parsePatterns(content);
  if (patterns === null) return true;

  const rel = relative(resolve(ceiling), resolve(filePath)).split(sep).join('/');
  const base = basename(filePath);
  // last-match-wins: 매치할 때마다 결론을 덮어쓴다. 초기값 false = unmatched 비트리거.
  let triggered = false;
  for (const p of patterns) {
    if (p.regex.test(p.anchored ? rel : base)) triggered = !p.negated;
  }
  return triggered;
}
