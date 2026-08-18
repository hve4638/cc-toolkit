// @ts-check
/**
 * addonlib — 애드온이 공유하는 조립 시점 패턴 모음.
 *
 * corelib 과 반대 계약: 여기 함수들은 형식 오류에 던진다. 애드온의 import
 * 시점 조립에서 터지면 build-manifest·테스트가 죽어 개발 시점에 드러나고,
 * 런타임에는 collect 의 fail-open 이 잡아 그 애드온만 조용히 빠진다.
 */

/**
 * md 원문에서 frontmatter 를 떼어 { fields, body } 로 나눈다.
 *
 * fields 는 allowedFields 의 키 전부를 갖고, frontmatter 에 없던 키는 null 이다.
 * 형식 오류 — 닫는 `---` 부재, 허용 밖 필드 줄 (오타 포함), 같은 필드 두 번 —
 * 는 던진다: 조용히 넘기면 조각이 저자 의도와 다른 조건으로 주입된다.
 * CRLF 원문은 LF 로 통일해 판정하고 body 도 그쪽에서 자른다.
 *
 * 필드 값은 공백 없는 한 토큰이다. 값의 의미 검증 (문자셋·예약어) 은
 * 호출자 몫이다.
 *
 * @template {string} K
 * @param {string} label 에러 메시지 접두어 (예: 'instructions/a.md')
 * @param {string} raw
 * @param {readonly K[]} allowedFields
 * @returns {{fields: Record<K, string | null>, body: string}}
 */
export function parseFrontmatter(label, raw, allowedFields) {
  const text = raw.replace(/\r\n/g, '\n');
  /** @type {Record<K, string | null>} */
  const fields = Object.fromEntries(allowedFields.map((key) => [key, null]));
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) {
    // 여는 --- 만 있고 닫는 --- 가 없으면 frontmatter 를 쓰려던 실수다 —
    // body 로 흘리면 --- 원문이 그대로 새 나간다.
    if (/^---\n/.test(text) || text.trimEnd() === '---') {
      throw new Error(`${label}: frontmatter 의 닫는 '---' 가 없다`);
    }
    return { fields, body: text.trim() };
  }
  for (const line of m[1].split('\n')) {
    if (line.trim() === '') continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(\S+)\s*$/);
    if (!field || !allowedFields.includes(field[1])) {
      const allowed = allowedFields.map((key) => `'${key}: <값>'`).join('·');
      throw new Error(`${label}: frontmatter 는 ${allowed} 만 허용한다 — '${line}'`);
    }
    const [, key, value] = field;
    if (fields[key] !== null) {
      throw new Error(`${label}: '${key}:' 줄이 두 번이다`);
    }
    fields[key] = value;
  }
  return { fields, body: text.slice(m[0].length).trim() };
}
