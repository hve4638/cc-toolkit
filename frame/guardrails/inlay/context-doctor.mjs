#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const BODY_LIMIT = 300;
const REQUIRED_SCALARS = ['name', 'purpose', 'entry'];

function findInlayFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        stack.push(join(dir, e.name));
      } else if (e.isFile() && e.name === 'INLAY.md') {
        out.push(join(dir, e.name));
      }
    }
  }
  return out.sort();
}

function check(path) {
  const content = readFileSync(path, 'utf8');
  const lines = content.split(/\r?\n/);
  const violations = [];

  if (lines[0] !== '---') {
    violations.push('frontmatter 미존재');
    return violations;
  }

  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      close = i;
      break;
    }
  }
  if (close === -1) {
    violations.push('frontmatter 닫힘 없음 (파싱 실패)');
    return violations;
  }

  // WHY: 외부 yaml 파서 의존을 피하려고 frontmatter 의 부분집합만 지원.
  //      scalar `key: value` 와 list (`key:` 다음 들여쓴 `- item`) 두 형태.
  const fm = {};
  for (let i = 1; i < close; i++) {
    const line = lines[i];
    const scalar = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
    if (scalar) {
      fm[scalar[1]] = scalar[2].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    const listKey = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*$/);
    if (listKey) {
      const items = [];
      let j = i + 1;
      while (j < close) {
        const item = lines[j].match(/^\s+-\s*(.*)$/);
        if (!item) break;
        items.push(item[1].trim());
        j++;
      }
      fm[listKey[1]] = items;
      i = j - 1;
    }
  }

  const missingScalars = REQUIRED_SCALARS.filter((k) => !fm[k]);
  if (missingScalars.length) {
    violations.push(`frontmatter 필드 누락: ${missingScalars.join(', ')}`);
  }
  if (!Array.isArray(fm.when) || fm.when.length === 0) {
    // WHY: 빈 `when:` 만 박아 회피하는 경로를 차단해야 사용 시점 명시
    //      강제가 의미를 갖는다.
    violations.push('frontmatter `when` 필드 누락 또는 빈 list');
  }

  let body = lines.slice(close + 1);
  while (body.length && body[body.length - 1] === '') body.pop();
  if (body.length > BODY_LIMIT) {
    violations.push(`본문 ${body.length}줄 (>${BODY_LIMIT})`);
  }

  return violations;
}

const FRONTMATTER_INSTRUCTION = [
  '## frontmatter 오류',
  '',
  '해당 inlay 의 작업을 중단하고 먼저 복구한다. INLAY.md frontmatter 는 4 필드 고정:',
  '',
  '```',
  '---',
  'name: <inlay 이름>',
  'purpose: <한 줄 요약>',
  'entry: <진입점 경로>            # 단일 파일',
  'entry: [<경로>, <경로>, ...]    # 다중 파일',
  'when:',
  '  - <호출 맥락 1>',
  '  - <호출 맥락 2>',
  '---',
  '```',
  '',
  '`when` 은 1~3 bullet 권유 — 더 많이 써야 한다면 inlay 책임이 비대하다는 신호로 분할 검토.',
  '',
  '복구 후 doctor 를 다시 돌려 위반이 사라진 것을 확인하고 본 작업을 시작.',
].join('\n');

const SPLIT_INSTRUCTION = [
  '## 본문 300줄 초과 — 분할 트리거',
  '',
  '해당 inlay 는 **자식 inlay 로 분할** 한다. 일부 영역을 자식 디렉토리로 떼어내고, 그 영역에 새 INLAY.md 를 만들어 그 영역의 도메인 용어를 자식이 가져가게 한다. 부모는 자식의 진입점만 남으므로 가벼워진다.',
  '',
  '단 **변경과 분할을 한 번에 섞지 않는다** — 현재 작업이 진행 중이면 그대로 끝내고, 분할은 별 작업으로 처리. 작업 종료 시 사용자에게 분할 필요를 알리는 것으로 충분.',
].join('\n');

const root = resolve(process.argv[2] || '.');
const files = findInlayFiles(root);
const issues = [];
let hasFrontmatter = false;
let hasOversize = false;
for (const f of files) {
  for (const msg of check(f)) {
    issues.push(`${relative(root, f) || f}: ${msg}`);
    if (msg.startsWith('frontmatter ')) hasFrontmatter = true;
    if (msg.startsWith('본문 ')) hasOversize = true;
  }
}

if (issues.length === 0) {
  console.log('No INLAY.md violations found.');
} else {
  for (const line of issues) console.log(line);
  console.log('');
  console.log('<inlay-instruction>');
  const blocks = [];
  if (hasFrontmatter) blocks.push(FRONTMATTER_INSTRUCTION);
  if (hasOversize) blocks.push(SPLIT_INSTRUCTION);
  console.log(blocks.join('\n\n'));
  console.log('</inlay-instruction>');
}
process.exit(0);
