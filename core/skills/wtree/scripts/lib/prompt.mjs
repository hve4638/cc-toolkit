// 인라인 프롬프트 프리미티브 — npm/yarn init 류. 흐르는 출력 속에 질문이 끼고,
// 선택은 그 자리에서 방향키로 움직여 Enter 로 고른다. 전체 화면(대체 스크린)을
// 잡지 않고, 의존성도 없다 (raw mode + ANSI).
//
// 취소 계약: Esc 는 그 질문에서 물러난다(null 반환 — 호출자가 취소 흐름을 잇는다).
// Ctrl-C 는 어디서든 프로세스를 끝낸다 — wtree CLI prompt.rs 의 선례를 따라
// 숨긴 커서를 복원하고 130 으로 나가며, 나가기 직전 onCancel 훅(있으면)을 부른다.
import { emitKeypressEvents } from 'node:readline';

const out = process.stdout;

const wrap = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
export const paint = {
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  cyan: wrap('36'),
  dim: wrap('2'),
  bold: wrap('1'),
  redBold: wrap('1;31'),
};

const hideCursor = () => out.write('\x1b[?25l');
const showCursor = () => out.write('\x1b[?25h');

let cancelHook = null;
let sigintInstalled = false;
export function onCancel(fn) {
  cancelHook = fn;
  // raw mode 밖(프롬프트 사이)에서는 Ctrl-C 가 진짜 SIGINT 로 온다 — 기본
  // 처리로 죽으면 취소 훅이 못 돌므로 같은 경로로 모은다.
  if (!sigintInstalled) {
    sigintInstalled = true;
    process.on('SIGINT', die130);
  }
}

function die130() {
  showCursor();
  try {
    if (cancelHook) cancelHook();
  } catch {
    // 취소 훅의 실패가 취소 자체를 막으면 안 된다
  }
  process.exit(130);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 키는 상주 리스너가 큐에 쌓고 nextKey 가 꺼낸다 — 그리기가 진행되는 동안
// 도착한 키(빠른 연타, 방향키 자동 반복)가 리스너 공백에 유실되지 않게 한다.
let keyQueue = [];
let keyWaiter = null;
const onKeypress = (str, key) => {
  const k = key ?? { name: str, sequence: str };
  if (keyWaiter) {
    const w = keyWaiter;
    keyWaiter = null;
    w(k);
  } else keyQueue.push(k);
};

// raw mode 를 켠 채 fn 을 돌리고 반드시 돌려놓는다.
async function withRaw(fn) {
  const stdin = process.stdin;
  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('keypress', onKeypress);
  try {
    return await fn();
  } finally {
    stdin.off('keypress', onKeypress);
    keyQueue = [];
    keyWaiter = null;
    stdin.setRawMode(wasRaw ?? false);
    stdin.pause();
  }
}

function nextKey() {
  if (keyQueue.length) return Promise.resolve(keyQueue.shift());
  return new Promise((res) => {
    keyWaiter = res;
  });
}

const isCtrlC = (k) => k.ctrl && k.name === 'c';

// delayMs 동안 도착한 키를 버린다 — 지연 전에 커널 tty 버퍼에 쌓여 있던
// 입력(반사적인 Enter)도 큐로 흘러들어와 함께 비워진다. Ctrl-C 만은 남긴다.
async function dropKeysFor(ms) {
  await sleep(ms);
  if (keyQueue.some(isCtrlC)) die130();
  keyQueue = [];
}

// 순환 이동 — 테스트를 위해 순수 함수로 분리
export const moveIndex = (index, delta, len) => (index + delta + len) % len;

// 항목 줄이 터미널 폭을 넘어 줄바꿈되면 "N 줄 위로" 커서 산수가 전부 깨지므로,
// 그리기 전에 표시 폭으로 자른다. 한글·CJK 는 터미널에서 2칸이다.
const wideChar =
  /[ᄀ-ᇿ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]/;
const chWidth = (ch) => (wideChar.test(ch) ? 2 : 1);
export const displayWidth = (s) => [...s].reduce((w, ch) => w + chWidth(ch), 0);

// 색이 다른 조각들을 폭 예산 안으로 자른 뒤에야 칠한다 — ANSI 바이트가 폭
// 계산에 섞이지 않게 하는 순서다.
export function fitSegments(segs, max) {
  let used = 0;
  const kept = [];
  for (const seg of segs) {
    let text = '';
    for (const ch of seg.text) {
      if (used + chWidth(ch) > max - 1) {
        kept.push({ ...seg, text: text + '…' });
        return kept;
      }
      text += ch;
      used += chWidth(ch);
    }
    kept.push({ ...seg, text });
  }
  return kept;
}

const cols = () => process.stdout.columns || 80;

function itemLine(it, active, marker) {
  const label = typeof it === 'string' ? it : it.label;
  const note = typeof it === 'string' || !it.note ? '' : ` ${it.note}`;
  const head = active ? `  ❯ ${marker}` : `    ${marker}`;
  const segs = fitSegments(
    [
      { text: `${head}${label}`, tint: active ? paint.cyan : null },
      { text: note, tint: paint.dim },
    ],
    cols(),
  );
  return segs.map((s) => (s.tint ? s.tint(s.text) : s.text)).join('');
}

const labelOf = (it) => (typeof it === 'string' ? it : it.label);

// 질문 줄은 자르지 않는다(경로가 잘리면 판단을 못 한다) — 대신 몇 줄로
// 감기는지를 세서 접기(collapse)의 "N 줄 위로" 산수에 넣는다.
const rowsOf = (plain) => Math.max(1, Math.ceil(displayWidth(plain) / cols()));

function writeHeader(message, hint, danger) {
  const q = danger ? paint.redBold(message) : paint.bold(message);
  out.write(`${paint.green('?')} ${q}${hint ? ` ${paint.dim(hint)}` : ''}\n`);
  return { q, rows: rowsOf(`? ${message}${hint ? ` ${hint}` : ''}`) };
}

/**
 * 단일 선택. 반환은 고른 인덱스, Esc 는 null.
 * danger 는 질문을 붉게 칠하고, delayMs 동안 선택지를 숨긴 채 그 사이 눌린
 * 키를 버린다 — 경고를 읽기 전에 반사적으로 Enter 가 닿지 않게 한다.
 */
export async function select({ message, items, initial = 0, hint = '', danger = false, delayMs = 0 }) {
  if (!items.length) throw new Error('select: empty items');
  const { q, rows } = writeHeader(message, hint, danger);

  return withRaw(async () => {
    if (delayMs) await dropKeysFor(delayMs);
    hideCursor();
    let idx = initial;
    let drawn = false;
    const draw = () => {
      if (drawn) out.write(`\x1b[${items.length}A`);
      for (let i = 0; i < items.length; i++) out.write(`\x1b[2K${itemLine(items[i], i === idx, '')}\n`);
      drawn = true;
    };
    draw();
    for (;;) {
      const k = await nextKey();
      if (isCtrlC(k)) die130();
      if (k.name === 'up' || k.name === 'k') idx = moveIndex(idx, -1, items.length);
      else if (k.name === 'down' || k.name === 'j') idx = moveIndex(idx, 1, items.length);
      else if (k.name === 'return' || k.name === 'enter') {
        out.write(`\x1b[${items.length + rows}A\x1b[0J`);
        out.write(`${paint.green('✔')} ${q} ${paint.cyan(labelOf(items[idx]))}\n`);
        showCursor();
        return idx;
      } else if (k.name === 'escape') {
        out.write(`\x1b[${items.length + rows}A\x1b[0J`);
        out.write(`${paint.red('✘')} ${q}\n`);
        showCursor();
        return null;
      }
      draw();
    }
  });
}

/**
 * 다중 선택 — Enter/space 가 항목을 켜고 끄고, 맨 아래 submit 행에서 Enter 로
 * 확정한다. 항목 위의 Enter 가 확정이 아니라 토글인 것은 의도다: 다른 질문들과
 * 달리 Enter 연타가 "아무것도 안 고름"으로 확정되는 함정을 없앤다.
 * 반환은 켠 인덱스 배열(없으면 빈 배열), Esc 는 null.
 */
export async function multiselect({ message, items, hint = '', submitLabel = 'submit' }) {
  if (!items.length) throw new Error('multiselect: empty items');
  const { q, rows } = writeHeader(message, hint, false);
  const total = items.length + 1; // 마지막 행이 submit
  const isSubmit = (i) => i === items.length;

  return withRaw(async () => {
    hideCursor();
    let idx = 0;
    const on = new Set();
    let drawn = false;
    const draw = () => {
      if (drawn) out.write(`\x1b[${total}A`);
      for (let i = 0; i < items.length; i++) {
        const mark = on.has(i) ? '[x] ' : '[ ] ';
        out.write(`\x1b[2K${itemLine(items[i], i === idx, mark)}\n`);
      }
      out.write(`\x1b[2K${itemLine({ label: submitLabel }, isSubmit(idx), '')}\n`);
      drawn = true;
    };
    draw();
    for (;;) {
      const k = await nextKey();
      if (isCtrlC(k)) die130();
      const toggle = () => (on.has(idx) ? on.delete(idx) : on.add(idx));
      if (k.name === 'up' || k.name === 'k') idx = moveIndex(idx, -1, total);
      else if (k.name === 'down' || k.name === 'j') idx = moveIndex(idx, 1, total);
      else if (k.name === 'space') {
        if (!isSubmit(idx)) toggle();
      } else if (k.name === 'return' || k.name === 'enter') {
        if (!isSubmit(idx)) toggle();
        else {
          const picked = [...on].sort((a, b) => a - b);
          out.write(`\x1b[${total + rows}A\x1b[0J`);
          const shown = picked.length ? picked.map((i) => labelOf(items[i])).join(', ') : '-';
          out.write(`${paint.green('✔')} ${q} ${paint.cyan(shown)}\n`);
          showCursor();
          return picked;
        }
      } else if (k.name === 'escape') {
        out.write(`\x1b[${total + rows}A\x1b[0J`);
        out.write(`${paint.red('✘')} ${q}\n`);
        showCursor();
        return null;
      }
      draw();
    }
  });
}

/**
 * 한 줄 입력 — 빈 입력은 기본값, Esc 는 null (select 류와 같은 취소 계약).
 * npm init 의 `name: (dir)` 모양이되, readline 이 아니라 raw 키로 받는다 —
 * readline 은 Esc 를 구분해 주지 않는다.
 */
export function input({ message, def = '' }) {
  const suffix = def ? ` ${paint.dim(`(${def})`)}` : '';
  const plainHead = `? ${message}${def ? ` (${def})` : ''} `;
  out.write(`${paint.green('?')} ${paint.bold(message)}${suffix} `);

  return withRaw(async () => {
    let buf = '';
    const collapse = (tail) => {
      const rows = rowsOf(plainHead + buf);
      if (rows > 1) out.write(`\x1b[${rows - 1}A`);
      out.write(`\x1b[G\x1b[0J${tail}\n`);
    };
    for (;;) {
      const k = await nextKey();
      if (isCtrlC(k)) die130();
      if (k.name === 'return' || k.name === 'enter') {
        const v = buf.trim() || def;
        collapse(`${paint.green('✔')} ${paint.bold(message)} ${paint.cyan(v)}`);
        return v;
      }
      if (k.name === 'escape') {
        collapse(`${paint.red('✘')} ${paint.bold(message)}`);
        return null;
      }
      if (k.name === 'backspace') {
        if (buf) {
          const w = chWidth(buf.at(-1));
          buf = buf.slice(0, -1);
          out.write('\b \b'.repeat(w === 2 ? 2 : 1));
        }
        continue;
      }
      const ch = k.sequence ?? '';
      if (!k.ctrl && !k.meta && ch && ![...ch].some((c) => c < ' ' || c === '\x7f')) {
        buf += ch;
        out.write(ch);
      }
    }
  });
}

/** 아무 키나 기다린다 — exec pane 은 종료 즉시 사라지므로 마지막 화면을 붙잡는 용도. */
export async function pause(message) {
  out.write(`\n${paint.dim(message)}`);
  await withRaw(async () => {
    const k = await nextKey();
    if (isCtrlC(k)) die130();
  });
  out.write('\n');
}
