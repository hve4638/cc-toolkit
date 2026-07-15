#!/usr/bin/env node
// usechrome — 경량 네이티브 브라우저 코어.
// openclaw 전체 대신 playwright-core + 시스템 chrome(CDP) 만으로 같은 액션을 낸다.
//
// 상태 유지 모델: chrome 를 데몬으로 한 번 띄워두고, 매 호출은 CDP 로 붙었다 뗀다.
// snapshot 으로 받은 ref 가 다음 click 호출까지 유효하려면 브라우저가 호출 사이에
// 살아있어야 하기 때문. (chrome 프로세스는 stop 전까지 유지, CDP 연결만 매번 끊음.)

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

// fetch 없는 구버전 Node 에서는 cdpUp 의 catch 가 ReferenceError 를 연결 실패로
// 오인해 "CDP 타임아웃" 으로 위장되므로, 진짜 원인을 먼저 말하고 죽는다.
if (typeof fetch !== 'function') {
  console.error('usechrome: Node 18+ 필요 (이 런타임에는 fetch 가 없음)');
  process.exit(1);
}

const PORT = Number(process.env.UC_PORT || 19222);
const STATE = process.env.UC_HOME || join(homedir(), '.usechrome');
const PROFILE = join(STATE, 'profile');
const CDP = `http://127.0.0.1:${PORT}`;

mkdirSync(STATE, { recursive: true });

function findChrome() {
  const cands = [
    process.env.UC_CHROME,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = cands.find((p) => existsSync(p));
  if (!hit) throw new Error('chrome 바이너리를 못 찾음 (UC_CHROME 로 지정 가능)');
  return hit;
}

async function cdpUp() {
  try {
    // 타임아웃 없이는 포트를 잡고 응답 않는 프로세스에 undici 기본값(5분)까지 매달린다.
    const r = await fetch(`${CDP}/json/version`, { signal: AbortSignal.timeout(1000) });
    return r.ok;
  } catch {
    return false;
  }
}

function resolveHostDisplay() {
  // oc host: 모드와 동일한 해석 — $DISPLAY 사용, 없으면 X0 소켓이 있을 때 :0 폴백.
  // 해석된 디스플레이의 X 소켓이 실제로 있어야 통과. 없으면 안내하며 실패한다.
  let disp = process.env.DISPLAY || '';
  if (!disp) {
    if (existsSync('/tmp/.X11-unix/X0')) disp = ':0';
    else
      throw new Error(
        '호스트 X 디스플레이를 못 찾음 (DISPLAY 미설정, /tmp/.X11-unix/X0 없음)\n' +
          '  - 그래픽 세션에 로그인해 :0 을 띄우거나\n' +
          '  - 기존 X 서버를 가리키도록 DISPLAY=:N 을 export 하거나\n' +
          '  - 화면 없이 돌리려면 UC_HEADLESS=1 을 지정',
      );
  }
  const n = disp.replace(/^:/, '').replace(/\..*$/, '');
  if (!existsSync(`/tmp/.X11-unix/X${n}`))
    throw new Error(`DISPLAY=${disp} 이지만 /tmp/.X11-unix/X${n} 소켓이 없음`);
  return disp;
}

async function ensureChrome() {
  if (await cdpUp()) return;
  const bin = findChrome();
  // 기본은 호스트 화면에 보이는 헤드드(oc host: 경험). UC_HEADLESS=1 로만 화면 없이.
  const headless = process.env.UC_HEADLESS === '1';
  const display = headless ? null : resolveHostDisplay(); // 디스플레이 없으면 여기서 안내하며 중단
  const args = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-features=Translate,MediaRouter',
    '--disable-dev-shm-usage',
  ];
  if (headless) args.push('--headless=new');
  if (process.env.UC_NO_SANDBOX !== '0') args.push('--no-sandbox');
  args.push('about:blank');

  const env = display ? { ...process.env, DISPLAY: display } : process.env;
  const child = spawn(bin, args, { detached: true, stdio: 'ignore', env });
  child.unref();

  for (let i = 0; i < 100; i++) {
    if (await cdpUp()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('CDP 엔드포인트 대기 타임아웃');
}

async function withPage(fn) {
  await ensureChrome();
  const browser = await chromium.connectOverCDP(CDP);
  try {
    const ctx = browser.contexts()[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    return await fn(page, ctx, browser);
  } finally {
    await browser.close(); // CDP 연결만 끊음. chrome 프로세스는 유지된다.
  }
}

async function snapshot(page) {
  // playwright-core 의 AI 모드 aria 스냅샷 — 각 상호작용 노드에 [ref=eN] 을 부여한다.
  // ref 번호는 DOM 순서로 결정적이라, 다음 usechrome 호출에서 같은 DOM 이면 같은 ref 로 되짚힌다.
  return await page.ariaSnapshot({ mode: 'ai' });
}

async function byRef(page, ref, expect) {
  // aria-ref 매핑은 연결(connection) 단위라, 매 호출 새 연결에서 먼저 스냅샷을 떠
  // 이 연결의 ref 매핑을 채운 뒤 aria-ref 로 되짚는다. (DOM 이 안 바뀌었으면 ref 동일.)
  //
  // ref 는 요소의 이름표가 아니라 DOM 순회 순번이라, snapshot 과 이 호출 사이에
  // 노드가 끼거나 빠지면 같은 번호가 다른 요소를 가리킨 채 조용히 성공한다.
  // 그래서 스냅샷에서 ref 의 실제 줄을 찾아 (1) 존재를 즉시 확인하고
  // (2) --expect 서술이 있으면 대조해, 오클릭을 시끄러운 실패로 바꾼다.
  if (!ref) throw new Error('ref 인자가 필요함');
  const snap = await page.ariaSnapshot({ mode: 'ai' });
  const line = snap.split('\n').find((l) => l.includes(`[ref=${ref}]`));
  if (!line) throw new Error(`ref ${ref} 가 현재 페이지에 없음 — usechrome snapshot 으로 다시 확인`);
  if (expect && !line.includes(expect)) {
    throw new Error(
      `ref ${ref} 불일치 — 기대: ${expect} / 실제: ${line.trim()}\n페이지가 변한 듯. usechrome snapshot 재실행 후 새 ref 사용`,
    );
  }
  return page.locator(`aria-ref=${ref}`);
}

function takeExpect(args) {
  // args 에서 `--expect <서술>` 쌍을 뽑아 [나머지 args, 서술] 로 돌려준다.
  const i = args.indexOf('--expect');
  if (i === -1) return [args, undefined];
  const val = args[i + 1];
  if (!val) throw new Error('--expect 뒤에 기대 서술이 필요함 (예: --expect \'button "삭제"\')');
  return [[...args.slice(0, i), ...args.slice(i + 2)], val];
}

async function stop() {
  if (!(await cdpUp())) {
    console.log('usechrome: 실행 중 아님');
    return;
  }
  const browser = await chromium.connectOverCDP(CDP);
  const session = await browser.newBrowserCDPSession();
  try {
    await session.send('Browser.close');
  } catch {}
  console.log('usechrome: 종료됨');
}

const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'start':
      await ensureChrome();
      console.log(`usechrome: chrome up on ${CDP}`);
      break;
    case 'open':
    case 'goto':
      await withPage(async (p) => {
        if (!rest[0]) throw new Error('usage: usechrome open <url>');
        await p.goto(rest[0], { waitUntil: 'load' });
        console.log(await p.title());
      });
      break;
    case 'shot':
      await withPage(async (p) => {
        const out = rest[0] || join(STATE, 'shot.png');
        await p.screenshot({ path: out });
        console.log(out);
      });
      break;
    case 'snapshot':
    case 'snap':
      await withPage(async (p) => {
        console.log(await snapshot(p));
      });
      break;
    case 'click':
      await withPage(async (p) => {
        const [a, expect] = takeExpect(rest);
        if (!a[0]) throw new Error('usage: usechrome click <ref> [--expect <서술>]');
        await (await byRef(p, a[0], expect)).click();
        console.log('clicked', a[0]);
      });
      break;
    case 'fill':
      await withPage(async (p) => {
        const [a, expect] = takeExpect(rest);
        if (!a[0]) throw new Error('usage: usechrome fill <ref> <text> [--expect <서술>]');
        await (await byRef(p, a[0], expect)).fill(a.slice(1).join(' '));
        console.log('filled', a[0]);
      });
      break;
    case 'stop':
      await stop();
      break;
    default:
      console.error(
        'usage: usechrome start | open <url> | shot [path] | snapshot | click <ref> [--expect <서술>] | fill <ref> <text> [--expect <서술>] | stop',
      );
      process.exit(1);
  }
} catch (e) {
  console.error('usechrome: ' + (e?.message || e));
  process.exit(1);
}
