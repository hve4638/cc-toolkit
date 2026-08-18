/**
 * addon — core/addon/ 과 core/skills/ 의 addon.mjs 가 쓰는 선언 도구.
 *
 *     // @ts-check
 *     export default {
 *       rules: {
 *         'showcase-light': { events: ['SessionStart'] },
 *         'showcase-heavy': { events: ['SessionStart', 'PreToolUse'] },
 *       },
 *       priority: { PreToolUse: 'high' },
 *       handlers: {
 *         SessionStart(api, payload, rules) {
 *           if (rules['showcase-heavy'].trigger) api.injectContext('무거운 안내');
 *         },
 *       },
 *     };
 *
 * 규칙 이름은 agentaddon `event` 파일의 항목 이름과 문자열로만 이어진다 — 애드온의
 * 위치·폴더 이름과는 무관하다. 이벤트 E 의 핸들러는 E 를 선언한 자기 규칙 중
 * 하나라도 켜져 있거나 E 가 `alwaysEvents` 에 있을 때 불리고, E 를 선언한 규칙
 * 전부를 (꺼진 것은 `trigger: false` 로) 셋째 인자로 받는다 — 규칙이 다 꺼진 채
 * alwaysEvents 로 불렸다면 기본 동작을 핸들러 코드가 정한다.
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
/** agentaddon 항목에 붙은 인자. `showcase-light@mode=strict,quiet` → `{ mode: 'strict', quiet: true }` */
export type Args = Readonly<Record<string, string | true>>;
/**
 * 핸들러가 받는 규칙 하나의 상태. `trigger` 는 호스트가 채우는 예약 키고
 * (그 규칙이 agentaddon 에 켜져 있는가), 나머지는 그 항목의 인자다.
 */
export interface RuleState {
    readonly trigger: boolean;
    readonly [arg: string]: string | boolean;
}
/** 규칙 이름 → 상태. 이번 이벤트를 선언한 자기 규칙만 실린다. */
export type Rules = Readonly<Record<string, RuleState>>;
/** 어느 이벤트에서나 쓸 수 있다. */
export interface BaseApi {
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
/** 잡을 수 있는 이벤트와 그 짝. 여기 없는 이름은 선언할 수 없다. */
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
export type Handler<E extends EventName> = (api: EventMap[E]['api'], payload: EventMap[E]['payload'], rules: Rules) => void | Promise<void>;
/** 규칙 하나의 선언 — 어느 이벤트에서 트리거되는가. */
export interface RuleDecl {
    events: readonly EventName[];
}
/**
 * addon.mjs 가 default 로 내보내는 선언.
 *
 * 이벤트당 핸들러는 하나다. 여러 규칙이 같은 이벤트를 선언해도 핸들러는 한 번
 * 불리고, 규칙별 분기는 핸들러가 셋째 인자를 보고 한다.
 */
export interface AddonDecl {
    /**
     * 구독하는 규칙들. 이름은 agentaddon 항목 이름과 문자열로 이어진다.
     *
     * 규칙이 하나도 없으면 (생략 또는 빈 객체) 상시 애드온이다 — handlers 가
     * 잡는 이벤트에 무조건 발화하고, 이름이 없으니 agentaddon 으로 끌 수도
     * 없다 (`!*` 도 닿지 않는다). 켜고 끌 일이 없는 배관성 훅용.
     */
    rules?: Readonly<Record<string, RuleDecl>>;
    /**
     * 여기 적힌 이벤트는 자기 규칙이 다 꺼져 있어도 핸들러가 불린다 — 규칙은
     * 순수 플래그가 되고, 기본 동작은 핸들러 코드가 정한다. 규칙 게이트를
     * 이벤트 단위로 빼는 스위치라 규칙을 선언한 애드온에만 의미가 있다 (규칙
     * 없는 선언은 어차피 상시).
     */
    alwaysEvents?: readonly EventName[];
    /** 이벤트별 실행 밴드. 생략·모르는 값은 medium. */
    priority?: Readonly<Partial<Record<EventName, Band>>>;
    handlers: {
        readonly [E in EventName]?: Handler<E>;
    };
}
/**
 * default export 가 애드온 선언인지 거른다. 호스트와 manifest 생성기가 쓴다.
 * priority 와 alwaysEvents 는 여기서 검사하지 않는다 — 값이 이상해도 각각
 * medium·없음으로 떨어질 뿐, 선언 전체를 버릴 이유가 아니다 (alwaysEvents 의
 * 형식 검증은 build-manifest 가 개발 시점에 한다).
 */
export declare function isAddonDecl(value: unknown): value is AddonDecl;
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
export declare function apiFor<E extends EventName>(event: E, draft: Draft, payload: EventMap[E]['payload']): EventMap[E]['api'];
/** 불러온 애드온 하나 — 선언과, 이번 이벤트에 해당하는 규칙 상태. */
export interface LoadedAddon {
    decl: AddonDecl;
    rules: Rules;
}
/**
 * 이번 이벤트에 핸들러가 받을 규칙 상태를 고른다. 호스트가 쓴다.
 *
 * 이벤트를 선언한 규칙 전부가 실리고 (꺼진 것은 trigger:false), 하나도 켜져
 * 있지 않으면 null — 그 애드온은 이번 이벤트에서 불리지 않는다. 단 이벤트가
 * `alwaysEvents` 에 있으면 규칙이 다 꺼져 있어도 (전부 trigger:false 인 채,
 * 이벤트를 선언한 규칙이 없으면 빈 상태로) 발화한다.
 *
 * 규칙이 하나도 없는 선언 (상시 애드온) 은 설정과 무관하다 — 이 이벤트의
 * 핸들러가 있으면 빈 규칙 상태로 발화한다.
 */
export declare function selectRules(decl: AddonDecl, event: EventName, enabled: ReadonlyMap<string, Args>): Rules | null;
/**
 * 불러온 애드온을 밴드 순 (high → medium → low) 으로 세워 차례로 돌린다.
 * 같은 밴드 안의 순서는 정의하지 않는다. 테스트 때문에 내보낸다.
 *
 * 애드온마다 새 Draft 를 주고 무사히 끝났을 때만 옮겨 적는다. 종이 한 장을
 * 같이 쓰면 도중에 던진 애드온이 이미 채운 슬롯 때문에 뒤 애드온의 판정이
 * 조용히 무시된다 — 고장난 애드온이 멀쩡한 애드온을 덮는 것을 막는다.
 *
 * 순차 실행이다. 한꺼번에 돌리면 순서가 시간에 좌우돼 결과가 실행마다 달라진다.
 */
export declare function dispatch<E extends EventName>(event: E, payload: EventMap[E]['payload'], addons: readonly LoadedAddon[]): Promise<Draft>;
export {};
