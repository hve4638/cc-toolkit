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
// EventMap 에 이벤트가 늘면 이 객체가 컴파일에서 막혀 갱신을 강제한다.
const EVENT_SET = {
    SessionStart: true,
    PreToolUse: true,
    PostToolUse: true,
    Stop: true,
};
/** 호스트가 argv 로 받은 이름을 거를 때. */
export function isEventName(name) {
    return Object.hasOwn(EVENT_SET, name);
}
/**
 * default export 가 애드온 선언인지 거른다. 호스트와 manifest 생성기가 쓴다.
 * priority 와 alwaysEvents 는 여기서 검사하지 않는다 — 값이 이상해도 각각
 * medium·없음으로 떨어질 뿐, 선언 전체를 버릴 이유가 아니다 (alwaysEvents 의
 * 형식 검증은 build-manifest 가 개발 시점에 한다).
 */
export function isAddonDecl(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const decl = value;
    // rules 는 생략 가능 (상시 애드온). 있으면 형태를 검사한다.
    if (decl.rules !== undefined) {
        if (typeof decl.rules !== 'object' || decl.rules === null)
            return false;
        for (const rule of Object.values(decl.rules)) {
            const events = rule?.events;
            if (!Array.isArray(events))
                return false;
            if (!events.every((e) => typeof e === 'string' && isEventName(e)))
                return false;
        }
    }
    if (typeof decl.handlers !== 'object' || decl.handlers === null)
        return false;
    for (const handler of Object.values(decl.handlers)) {
        if (typeof handler !== 'function')
            return false;
    }
    return true;
}
/** 빈 Draft. */
export function emptyDraft() {
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
// 제한적인 쪽이 이긴다. 진 종류의 사유는 버린다 — allow 를 원한 애드온의 사유는
// deny 앞에서 의미가 없다.
const PERMISSION_RANK = { deny: 3, ask: 2, allow: 1 };
const TURN_RANK = { halt: 2, block: 1 };
/**
 * 슬롯 하나를 겨룬다.
 *
 * 한 핸들러가 두 번 부른 것과 두 핸들러가 각각 부른 것이 같은 결과가 되도록
 * apiFor 와 mergeDraft 가 같이 쓴다.
 */
function pickSlot(rank, current, next) {
    if (!current)
        return next;
    const a = rank[current.kind];
    const b = rank[next.kind];
    if (b > a)
        return next;
    if (b < a)
        return current;
    return { kind: current.kind, reasons: [...current.reasons, ...next.reasons] };
}
/** 사유가 하나면 그대로, 둘 이상이면 번호를 붙여 감싼다. */
function joinReasons(reasons) {
    if (reasons.length === 1)
        return reasons[0];
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
export function toHookOutput(event, draft) {
    const out = {};
    const specific = { hookEventName: event };
    let hasSpecific = false;
    if (draft.notify.length)
        out.systemMessage = draft.notify.join('\n');
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
        }
        else {
            out.decision = 'block';
            out.reason = reason;
        }
    }
    const patch = draft.patch;
    if (patch) {
        if (patch.kind === 'input')
            specific.updatedInput = patch.value;
        else
            specific.updatedToolOutput = patch.value;
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
    if (hasSpecific)
        out.hookSpecificOutput = specific;
    return out;
}
// ---------------------------------------------------------------------------
// api 만들기
// ---------------------------------------------------------------------------
function setPermission(draft, kind, reason) {
    draft.permission = pickSlot(PERMISSION_RANK, draft.permission, {
        kind,
        reasons: reason === undefined ? [] : [reason],
    });
}
function setTurn(draft, kind, reason) {
    draft.turn = pickSlot(TURN_RANK, draft.turn, { kind, reasons: [reason] });
}
function baseParts(draft) {
    return {
        notify(message) {
            draft.notify.push(message);
        },
        injectContext(text) {
            draft.context.push(text);
        },
    };
}
function haltOnly(draft) {
    return {
        halt(reason) {
            setTurn(draft, 'halt', reason);
        },
    };
}
function sessionStartApi(draft) {
    return {
        ...baseParts(draft),
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
function preToolUseApi(draft) {
    return {
        ...baseParts(draft),
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
                // WHY: JSON 왕복으로 직렬화 가능을 여기서 강제한다. 직렬화 불가 값
                //      (순환·BigInt) 을 호스트의 최종 stringify 까지 끌고 가면 그 시점의
                //      실패가 다른 애드온의 판정까지 같이 지우므로, 이 핸들러의 try
                //      안에서 터뜨려 per-addon 격리에 맡긴다.
                const value = JSON.parse(JSON.stringify(input));
                draft.patch ??= { kind: 'input', value };
            },
        },
        turn: haltOnly(draft),
    };
}
function postToolUseApi(draft) {
    return {
        ...baseParts(draft),
        tool: {
            rewriteOutput(output) {
                // WHY: rewrite 와 같다 — 직렬화 실패는 이 애드온의 몫이어야 한다.
                const value = JSON.parse(JSON.stringify(output));
                draft.patch ??= { kind: 'output', value };
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
function stopApi(draft, payload) {
    return {
        ...baseParts(draft),
        turn: {
            keepGoing(reason) {
                // 이미 훅이 막아서 이어진 턴이다. 또 막으면 무한 루프가 되므로
                // 핸들러 대신 여기서 걸러낸다.
                if (payload.stop_hook_active)
                    return;
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
function buildApi(event, draft, payload) {
    switch (event) {
        case 'SessionStart':
            return sessionStartApi(draft);
        case 'PreToolUse':
            return preToolUseApi(draft);
        case 'PostToolUse':
            return postToolUseApi(draft);
        case 'Stop':
            return stopApi(draft, payload);
    }
}
/** 이벤트별 api 를 만든다. 테스트 때문에 내보낸다. */
export function apiFor(event, draft, payload) {
    return buildApi(event, draft, payload);
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
export function selectRules(decl, event, enabled) {
    const declared = Object.entries(decl.rules ?? {});
    // 규칙도 alwaysEvents 도 없는 선언만 상시다 — alwaysEvents 가 있으면 규칙
    // 0개여도 (instruction 의 데이터 조립 형태) 아래의 always 판정을 타야
    // 목록 밖 이벤트가 새지 않는다. manifestSelects 와 같은 판정이다.
    if (declared.length === 0 && decl.alwaysEvents === undefined) {
        return decl.handlers[event] ? {} : null;
    }
    const rules = {};
    let triggered = false;
    for (const [name, rule] of declared) {
        if (!rule.events.includes(event))
            continue;
        const args = enabled.get(name);
        const trigger = args !== undefined;
        triggered ||= trigger;
        // WHY: trigger 는 예약 키 — 인자에 같은 이름이 와도 여기서 덮여 조용히
        //      무시된다. 훅에는 사람에게 경고를 띄울 마땅한 경로가 없다.
        rules[name] = { ...args, trigger };
    }
    // isAddonDecl 이 alwaysEvents 를 검증하지 않으므로 배열이 아니면 없음으로 본다.
    const always = Array.isArray(decl.alwaysEvents) && decl.alwaysEvents.includes(event);
    return triggered || always ? rules : null;
}
const BANDS = ['high', 'medium', 'low'];
// 모르는 밴드 값은 medium 으로. indexOf 의 -1 을 그대로 쓰면 high 보다 앞선다.
function bandIndex(band) {
    const i = BANDS.indexOf(band);
    return i === -1 ? 1 : i;
}
/** 성공한 핸들러의 Draft 를 옮겨 적는다. 겨루는 규칙은 apiFor 안과 같다. */
function mergeDraft(into, from) {
    into.context.push(...from.context);
    into.notify.push(...from.notify);
    into.watchPaths.push(...from.watchPaths);
    into.reloadSkills ||= from.reloadSkills;
    if (from.permission)
        into.permission = pickSlot(PERMISSION_RANK, into.permission, from.permission);
    if (from.turn)
        into.turn = pickSlot(TURN_RANK, into.turn, from.turn);
    into.patch ??= from.patch;
    into.userMessage ??= from.userMessage;
    into.title ??= from.title;
}
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
export async function dispatch(event, payload, addons) {
    const ordered = [...addons].sort((a, b) => bandIndex(a.decl.priority?.[event]) - bandIndex(b.decl.priority?.[event]));
    const merged = emptyDraft();
    for (const { decl, rules } of ordered) {
        const handler = decl.handlers[event];
        if (!handler)
            continue;
        const local = emptyDraft();
        try {
            await handler(apiFor(event, local, payload), payload, rules);
        }
        catch {
            continue;
        }
        mergeDraft(merged, local);
    }
    return merged;
}
