/**
 * addon — core/event/ 의 이벤트 모듈이 쓰는 등록 도구.
 *
 *     // @ts-check
 *     import { create } from '../../lib/index.mjs';
 *
 *     const a = create();
 *
 *     a.register('PreToolUse', { priority: 'high' }, (api, payload) => {
 *       if (payload.tool_name === 'Bash') api.permission.deny('bash 는 막혀 있다');
 *     });
 *
 *     export default a;
 *
 * 합침 규칙, 이벤트별 주의사항, 열지 않은 필드는 core/event/README.md.
 */

// ---------------------------------------------------------------------------
// payload
// ---------------------------------------------------------------------------

/** 모든 이벤트에 공통으로 온다. */
export interface BasePayload {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}

export interface SessionStartPayload extends BasePayload {
  source: 'startup' | 'resume' | 'clear' | 'compact' | 'fork';
  /** 오지 않을 수 있다. */
  model?: unknown;
}

export interface PreToolUsePayload extends BasePayload {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  /** 서브에이전트 안에서 난 호출일 때만 온다. */
  agent_id?: string;
  agent_type?: string;
}

export interface PostToolUsePayload extends PreToolUsePayload {
  tool_output: unknown;
}

export interface StopPayload extends BasePayload {
  last_assistant_message?: string;
  /** 이미 훅이 막아서 이어진 턴이면 true. */
  stop_hook_active: boolean;
}

// ---------------------------------------------------------------------------
// api
// ---------------------------------------------------------------------------

/** 실행 순서 밴드. 생략하면 medium. */
export type Band = 'high' | 'medium' | 'low';

/** aiaddon 항목에 붙은 인자. `feat:x@mode=strict,quiet` → `{ mode: 'strict', quiet: true }` */
export type Args = Readonly<Record<string, string | true>>;

/** 어느 이벤트에서나 쓸 수 있다. */
export interface BaseApi {
  /** 이 항목을 켠 aiaddon 줄의 인자. */
  readonly args: Args;
  /** 사용자에게만 보이는 한 줄. → `systemMessage` */
  notify(message: string): void;
}

/** 모델 컨텍스트에 텍스트를 붙일 수 있는 이벤트가 갖는다. */
export interface ContextApi {
  /** 모델에게 텍스트를 붙인다. → `additionalContext` */
  injectContext(text: string): void;
}

/** 세션 설정을 건드리는 층. */
export interface SessionApi {
  /** 세션 제목을 정한다. → `sessionTitle` */
  setTitle(title: string): void;
  /** 감시할 파일을 등록한다. 절대경로. → `watchPaths` */
  watchPaths(...paths: string[]): void;
  /** 스킬·커맨드 디렉터리를 다시 훑게 한다. → `reloadSkills` */
  reloadSkills(): void;
}

/** 권한 판정 층. 한 슬롯이다. */
export interface PermissionApi {
  // 사용자 권한 설정을 무력화하는 쪽이고 그 사실이 화면에 안 뜬다. 쓸 데가
  // 생기면 연다. → `permissionDecision: "allow"`
  // allow(reason?: string): void;
  /** 실행을 막는다. → `permissionDecision: "deny"` */
  deny(reason: string): void;
  /** 사용자에게 묻는다. → `permissionDecision: "ask"` */
  ask(reason: string): void;
}

/** 도구 호출을 건드리는 층 — 실행 전. */
export interface ToolInputApi {
  /** 도구가 받을 인자를 교체한다. → `updatedInput` */
  rewrite(input: Record<string, unknown>): void;
}

/** 도구 호출을 건드리는 층 — 실행 후. */
export interface ToolOutputApi {
  /** 모델이 볼 도구 출력을 교체한다. → `updatedToolOutput` */
  rewriteOutput(output: unknown): void;
}

/** 턴을 건드리는 층 — SessionStart·PreToolUse. */
export interface TurnApi {
  /** 턴을 여기서 끝낸다. → `continue: false` + `stopReason` */
  halt(reason: string): void;
}

/** 턴을 건드리는 층 — PostToolUse. */
export interface PostTurnApi {
  /** 도구 결과에 대한 지적을 모델에게 보낸다. → `decision: "block"` */
  feedback(reason: string): void;
  /** 턴을 여기서 끝낸다. → `continue: false` + `stopReason` */
  halt(reason: string): void;
}

/** 턴을 건드리는 층 — Stop. */
export interface StopTurnApi {
  /** 턴을 못 끝내게 하고 reason 을 마저 시킨다. → `decision: "block"` */
  keepGoing(reason: string): void;
  /** 턴을 여기서 끝낸다. → `continue: false` + `stopReason` */
  halt(reason: string): void;
}

/** SessionStart. 세션이 열릴 때 한 번. matcher 는 payload.source. */
export interface SessionStartApi extends BaseApi, ContextApi {
  /** 세션의 첫 사용자 발화를 만들어 넣는다. → `initialUserMessage` */
  injectUserMessage(text: string): void;
  session: SessionApi;
  turn: TurnApi;
}

/** PreToolUse. 도구가 실행되기 전. matcher 는 도구 이름. */
export interface PreToolUseApi extends BaseApi, ContextApi {
  permission: PermissionApi;
  tool: ToolInputApi;
  turn: TurnApi;
}

/** PostToolUse. 도구가 끝난 뒤. matcher 는 도구 이름. */
export interface PostToolUseApi extends BaseApi, ContextApi {
  tool: ToolOutputApi;
  turn: PostTurnApi;
}

/** Stop. 모델이 턴을 끝내려 할 때. matcher 가 없어 언제나 발화한다. */
export interface StopApi extends BaseApi, ContextApi {
  turn: StopTurnApi;
}

// ---------------------------------------------------------------------------
// 등록
// ---------------------------------------------------------------------------

/** 잡을 수 있는 이벤트와 그 짝. 여기 없는 이름은 register() 가 거부한다. */
export interface EventMap {
  SessionStart: { api: SessionStartApi; payload: SessionStartPayload };
  PreToolUse: { api: PreToolUseApi; payload: PreToolUsePayload };
  PostToolUse: { api: PostToolUseApi; payload: PostToolUsePayload };
  Stop: { api: StopApi; payload: StopPayload };
}

export type EventName = keyof EventMap;

// EventMap 에 이벤트가 늘면 이 객체가 컴파일에서 막혀 갱신을 강제한다.
const EVENT_SET: Record<EventName, true> = {
  SessionStart: true,
  PreToolUse: true,
  PostToolUse: true,
  Stop: true,
};

/** 호스트가 argv 로 받은 이름을 거를 때. */
export function isEventName(name: string): name is EventName {
  return Object.hasOwn(EVENT_SET, name);
}

export type Handler<E extends EventName> = (
  api: EventMap[E]['api'],
  payload: EventMap[E]['payload'],
) => void | Promise<void>;

export interface RegisterOptions {
  priority?: Band;
}

interface Registration {
  event: EventName;
  priority: Band;
  handler: Handler<EventName>;
}

export interface Addon {
  /** 한 모듈이 여러 이벤트를 잡아도 되고, 같은 이벤트를 두 번 잡아도 된다. */
  register<E extends EventName>(event: E, options: RegisterOptions, handler: Handler<E>): void;
  /** 호스트가 읽는다. */
  readonly registrations: readonly Registration[];
}

/** 모듈마다 하나씩 만들어 default 로 내보낸다. */
export function create(): Addon {
  const registrations: Registration[] = [];
  return {
    register(event, options, handler) {
      registrations.push({
        event,
        priority: options.priority ?? 'medium',
        handler: handler as Handler<EventName>,
      });
    },
    registrations,
  };
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

type PermissionKind = 'allow' | 'deny' | 'ask';
type TurnKind = 'block' | 'halt';

/** 한 슬롯. 이긴 종류 하나와 그 종류로 들어온 사유 전부. */
interface Slot<K extends string> {
  kind: K;
  reasons: string[];
}

/** 치환 슬롯. */
type Patch =
  | { kind: 'input'; value: Record<string, unknown> }
  | { kind: 'output'; value: unknown };

/** 핸들러들이 적어 넣는 자리. 이벤트마다 쓰는 칸이 다르다. */
interface Draft {
  context: string[];
  notify: string[];
  permission: Slot<PermissionKind> | null;
  turn: Slot<TurnKind> | null;
  patch: Patch | null;
  userMessage: string | null;
  title: string | null;
  watchPaths: string[];
  reloadSkills: boolean;
}

/** 빈 Draft. */
export function emptyDraft(): Draft {
  return {
    context: [],
    notify: [],
    permission: null,
    turn: null,
    patch: null,
    userMessage: null,
    title: null,
    watchPaths: [],
    reloadSkills: false,
  };
}

// 제한적인 쪽이 이긴다. 진 종류의 사유는 버린다 — allow 를 원한 모듈의 사유는
// deny 앞에서 의미가 없다.
const PERMISSION_RANK: Record<PermissionKind, number> = { deny: 3, ask: 2, allow: 1 };
const TURN_RANK: Record<TurnKind, number> = { halt: 2, block: 1 };

/**
 * 슬롯 하나를 겨룬다.
 *
 * 한 핸들러가 두 번 부른 것과 두 핸들러가 각각 부른 것이 같은 결과가 되도록
 * apiFor 와 mergeDraft 가 같이 쓴다.
 */
function pickSlot<K extends string>(
  rank: Record<K, number>,
  current: Slot<K> | null,
  next: Slot<K>,
): Slot<K> {
  if (!current) return next;
  const a = rank[current.kind];
  const b = rank[next.kind];
  if (b > a) return next;
  if (b < a) return current;
  return { kind: current.kind, reasons: [...current.reasons, ...next.reasons] };
}

/** 사유가 하나면 그대로, 둘 이상이면 번호를 붙여 감싼다. */
function joinReasons(reasons: readonly string[]): string {
  if (reasons.length === 1) return reasons[0]!;
  return reasons.map((reason, i) => `<reason_${i + 1}>${reason}</reason_${i + 1}>`).join('\n');
}

/**
 * Draft 를 훅 출력 JSON 으로 바꾼다. 테스트 때문에 내보낸다.
 *
 * WHY 이벤트별 분기가 없나: 어느 칸이 채워졌는지가 곧 이벤트를 말해 준다.
 * api 가 그 이벤트의 칸만 건드리게 돼 있어서 patch.kind === 'input' 은
 * PreToolUse 에서만, userMessage 는 SessionStart 에서만 채워진다. 여기서 또
 * 이벤트를 보면 같은 보장을 두 곳에서 하게 된다. event 는 hookEventName 을
 * 적는 데만 쓴다.
 */
export function toHookOutput(event: EventName, draft: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const specific: Record<string, unknown> = { hookEventName: event };
  let hasSpecific = false;

  if (draft.notify.length) out.systemMessage = draft.notify.join('\n');

  if (draft.context.length) {
    specific.additionalContext = draft.context.join('\n');
    hasSpecific = true;
  }

  if (draft.permission) {
    specific.permissionDecision = draft.permission.kind;
    if (draft.permission.reasons.length) {
      specific.permissionDecisionReason = joinReasons(draft.permission.reasons);
    }
    hasSpecific = true;
  }

  // 권한과 턴은 다른 슬롯이고 나가는 자리도 달라 같이 실린다.
  if (draft.turn) {
    const reason = joinReasons(draft.turn.reasons);
    if (draft.turn.kind === 'halt') {
      out.continue = false;
      out.stopReason = reason;
    } else {
      out.decision = 'block';
      out.reason = reason;
    }
  }

  const patch = draft.patch;
  if (patch) {
    if (patch.kind === 'input') specific.updatedInput = patch.value;
    else specific.updatedToolOutput = patch.value;
    hasSpecific = true;
  }

  if (draft.userMessage !== null) {
    specific.initialUserMessage = draft.userMessage;
    hasSpecific = true;
  }
  if (draft.title !== null) {
    specific.sessionTitle = draft.title;
    hasSpecific = true;
  }
  if (draft.watchPaths.length) {
    specific.watchPaths = draft.watchPaths;
    hasSpecific = true;
  }
  if (draft.reloadSkills) {
    specific.reloadSkills = true;
    hasSpecific = true;
  }

  if (hasSpecific) out.hookSpecificOutput = specific;
  return out;
}

// ---------------------------------------------------------------------------
// api 만들기
// ---------------------------------------------------------------------------

function setPermission(draft: Draft, kind: PermissionKind, reason?: string): void {
  draft.permission = pickSlot(PERMISSION_RANK, draft.permission, {
    kind,
    reasons: reason === undefined ? [] : [reason],
  });
}

function setTurn(draft: Draft, kind: TurnKind, reason: string): void {
  draft.turn = pickSlot(TURN_RANK, draft.turn, { kind, reasons: [reason] });
}

function baseParts(args: Args, draft: Draft): BaseApi & ContextApi {
  return {
    args,
    notify(message) {
      draft.notify.push(message);
    },
    injectContext(text) {
      draft.context.push(text);
    },
  };
}

function haltOnly(draft: Draft): TurnApi {
  return {
    halt(reason) {
      setTurn(draft, 'halt', reason);
    },
  };
}

function sessionStartApi(args: Args, draft: Draft): SessionStartApi {
  return {
    ...baseParts(args, draft),
    injectUserMessage(text) {
      draft.userMessage ??= text;
    },
    session: {
      setTitle(title) {
        draft.title ??= title;
      },
      watchPaths(...paths) {
        draft.watchPaths.push(...paths);
      },
      reloadSkills() {
        draft.reloadSkills = true;
      },
    },
    turn: haltOnly(draft),
  };
}

function preToolUseApi(args: Args, draft: Draft): PreToolUseApi {
  return {
    ...baseParts(args, draft),
    permission: {
      deny(reason) {
        setPermission(draft, 'deny', reason);
      },
      ask(reason) {
        setPermission(draft, 'ask', reason);
      },
    },
    tool: {
      rewrite(input) {
        draft.patch ??= { kind: 'input', value: input };
      },
    },
    turn: haltOnly(draft),
  };
}

function postToolUseApi(args: Args, draft: Draft): PostToolUseApi {
  return {
    ...baseParts(args, draft),
    tool: {
      rewriteOutput(output) {
        draft.patch ??= { kind: 'output', value: output };
      },
    },
    turn: {
      feedback(reason) {
        setTurn(draft, 'block', reason);
      },
      halt(reason) {
        setTurn(draft, 'halt', reason);
      },
    },
  };
}

function stopApi(args: Args, draft: Draft, payload: StopPayload): StopApi {
  return {
    ...baseParts(args, draft),
    turn: {
      keepGoing(reason) {
        // 이미 훅이 막아서 이어진 턴이다. 또 막으면 무한 루프가 되므로
        // 핸들러 대신 여기서 걸러낸다.
        if (payload.stop_hook_active) return;
        setTurn(draft, 'block', reason);
      },
      halt(reason) {
        setTurn(draft, 'halt', reason);
      },
    },
  };
}

// 제네릭 안에서 switch 는 반환 타입을 안 좁혀준다. 콘크리트 타입으로 만드는
// 빌더에서 검사를 다 받고, 캐스팅은 apiFor 한 곳에만 둔다.
function buildApi(event: EventName, args: Args, draft: Draft, payload: BasePayload) {
  switch (event) {
    case 'SessionStart':
      return sessionStartApi(args, draft);
    case 'PreToolUse':
      return preToolUseApi(args, draft);
    case 'PostToolUse':
      return postToolUseApi(args, draft);
    case 'Stop':
      return stopApi(args, draft, payload as StopPayload);
  }
}

/** 이벤트별 api 를 만든다. 테스트 때문에 내보낸다. */
export function apiFor<E extends EventName>(
  event: E,
  args: Args,
  draft: Draft,
  payload: EventMap[E]['payload'],
): EventMap[E]['api'] {
  return buildApi(event, args, draft, payload) as EventMap[E]['api'];
}

// ---------------------------------------------------------------------------
// 실행 순서와 통합
// ---------------------------------------------------------------------------

/** 켜진 모듈 하나. */
export interface LoadedModule {
  addon: Addon;
  args: Args;
}

const BANDS: readonly Band[] = ['high', 'medium', 'low'];

/** 성공한 핸들러의 Draft 를 옮겨 적는다. 겨루는 규칙은 apiFor 안과 같다. */
function mergeDraft(into: Draft, from: Draft): void {
  into.context.push(...from.context);
  into.notify.push(...from.notify);
  into.watchPaths.push(...from.watchPaths);
  into.reloadSkills ||= from.reloadSkills;
  if (from.permission) into.permission = pickSlot(PERMISSION_RANK, into.permission, from.permission);
  if (from.turn) into.turn = pickSlot(TURN_RANK, into.turn, from.turn);
  into.patch ??= from.patch;
  into.userMessage ??= from.userMessage;
  into.title ??= from.title;
}

/**
 * 켜진 모듈을 밴드 순으로 세워 차례로 돌린다. 테스트 때문에 내보낸다.
 *
 * 모듈마다 새 Draft 를 주고 무사히 끝났을 때만 옮겨 적는다. 종이 한 장을
 * 같이 쓰면 도중에 던진 모듈이 이미 채운 슬롯 때문에 뒤 모듈의 판정이
 * 조용히 무시된다 — 고장난 모듈이 멀쩡한 모듈을 덮는 것을 막는다.
 *
 * 순차 실행이다. 한꺼번에 돌리면 순서가 시간에 좌우돼 결과가 실행마다 달라진다.
 */
export async function dispatch<E extends EventName>(
  event: E,
  payload: EventMap[E]['payload'],
  modules: readonly LoadedModule[],
): Promise<Draft> {
  const ordered = modules
    .flatMap(({ addon, args }) =>
      addon.registrations.filter((r) => r.event === event).map((r) => ({ ...r, args })),
    )
    .sort((a, b) => BANDS.indexOf(a.priority) - BANDS.indexOf(b.priority));

  const merged = emptyDraft();
  for (const reg of ordered) {
    const local = emptyDraft();
    try {
      // Registration 은 이벤트를 잊은 채 보관되므로 여기서 되살린다.
      await (reg.handler as Handler<E>)(apiFor(event, reg.args, local, payload), payload);
    } catch {
      continue;
    }
    mergeDraft(merged, local);
  }
  return merged;
}
