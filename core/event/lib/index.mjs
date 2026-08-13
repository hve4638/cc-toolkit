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
/** 모듈마다 하나씩 만들어 default 로 내보낸다. */
export function create() {
    const registrations = [];
    return {
        register(event, options, handler) {
            registrations.push({
                event,
                priority: options.priority ?? 'medium',
                handler: handler,
            });
        },
        registrations,
    };
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
// 제한적인 쪽이 이긴다. 진 종류의 사유는 버린다 — allow 를 원한 모듈의 사유는
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
function baseParts(args, draft) {
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
function haltOnly(draft) {
    return {
        halt(reason) {
            setTurn(draft, 'halt', reason);
        },
    };
}
function sessionStartApi(args, draft) {
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
function preToolUseApi(args, draft) {
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
function postToolUseApi(args, draft) {
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
function stopApi(args, draft, payload) {
    return {
        ...baseParts(args, draft),
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
function buildApi(event, args, draft, payload) {
    switch (event) {
        case 'SessionStart':
            return sessionStartApi(args, draft);
        case 'PreToolUse':
            return preToolUseApi(args, draft);
        case 'PostToolUse':
            return postToolUseApi(args, draft);
        case 'Stop':
            return stopApi(args, draft, payload);
    }
}
/** 이벤트별 api 를 만든다. 테스트 때문에 내보낸다. */
export function apiFor(event, args, draft, payload) {
    return buildApi(event, args, draft, payload);
}
const BANDS = ['high', 'medium', 'low'];
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
 * 켜진 모듈을 밴드 순으로 세워 차례로 돌린다. 테스트 때문에 내보낸다.
 *
 * 모듈마다 새 Draft 를 주고 무사히 끝났을 때만 옮겨 적는다. 종이 한 장을
 * 같이 쓰면 도중에 던진 모듈이 이미 채운 슬롯 때문에 뒤 모듈의 판정이
 * 조용히 무시된다 — 고장난 모듈이 멀쩡한 모듈을 덮는 것을 막는다.
 *
 * 순차 실행이다. 한꺼번에 돌리면 순서가 시간에 좌우돼 결과가 실행마다 달라진다.
 */
export async function dispatch(event, payload, modules) {
    const ordered = modules
        .flatMap(({ addon, args }) => addon.registrations.filter((r) => r.event === event).map((r) => ({ ...r, args })))
        .sort((a, b) => BANDS.indexOf(a.priority) - BANDS.indexOf(b.priority));
    const merged = emptyDraft();
    for (const reg of ordered) {
        const local = emptyDraft();
        try {
            // Registration 은 이벤트를 잊은 채 보관되므로 여기서 되살린다.
            await reg.handler(apiFor(event, reg.args, local, payload), payload);
        }
        catch {
            continue;
        }
        mergeDraft(merged, local);
    }
    return merged;
}
