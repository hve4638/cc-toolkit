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
/** 잡을 수 있는 이벤트와 그 짝. 여기 없는 이름은 register() 가 거부한다. */
export interface EventMap {
    SessionStart: {
        api: SessionStartApi;
        payload: SessionStartPayload;
    };
    PreToolUse: {
        api: PreToolUseApi;
        payload: PreToolUsePayload;
    };
    PostToolUse: {
        api: PostToolUseApi;
        payload: PostToolUsePayload;
    };
    Stop: {
        api: StopApi;
        payload: StopPayload;
    };
}
export type EventName = keyof EventMap;
/** 호스트가 argv 로 받은 이름을 거를 때. */
export declare function isEventName(name: string): name is EventName;
export type Handler<E extends EventName> = (api: EventMap[E]['api'], payload: EventMap[E]['payload']) => void | Promise<void>;
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
export declare function create(): Addon;
type PermissionKind = 'allow' | 'deny' | 'ask';
type TurnKind = 'block' | 'halt';
/** 한 슬롯. 이긴 종류 하나와 그 종류로 들어온 사유 전부. */
interface Slot<K extends string> {
    kind: K;
    reasons: string[];
}
/** 치환 슬롯. */
type Patch = {
    kind: 'input';
    value: Record<string, unknown>;
} | {
    kind: 'output';
    value: unknown;
};
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
export declare function emptyDraft(): Draft;
/**
 * Draft 를 훅 출력 JSON 으로 바꾼다. 테스트 때문에 내보낸다.
 *
 * WHY 이벤트별 분기가 없나: 어느 칸이 채워졌는지가 곧 이벤트를 말해 준다.
 * api 가 그 이벤트의 칸만 건드리게 돼 있어서 patch.kind === 'input' 은
 * PreToolUse 에서만, userMessage 는 SessionStart 에서만 채워진다. 여기서 또
 * 이벤트를 보면 같은 보장을 두 곳에서 하게 된다. event 는 hookEventName 을
 * 적는 데만 쓴다.
 */
export declare function toHookOutput(event: EventName, draft: Draft): Record<string, unknown>;
/** 이벤트별 api 를 만든다. 테스트 때문에 내보낸다. */
export declare function apiFor<E extends EventName>(event: E, args: Args, draft: Draft, payload: EventMap[E]['payload']): EventMap[E]['api'];
/** 켜진 모듈 하나. */
export interface LoadedModule {
    addon: Addon;
    args: Args;
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
export declare function dispatch<E extends EventName>(event: E, payload: EventMap[E]['payload'], modules: readonly LoadedModule[]): Promise<Draft>;
export {};
