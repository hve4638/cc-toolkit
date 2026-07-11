---
name: man
description: "스킬의 MAN.md 를 읽고 설명·질의응답. 인자 없이 호출하면 문서화된 스킬 색인"
disable-model-invocation: true
argument-hint: "[스킬명 | 비우면 색인]"
---

<man_instruction>
# man

지정된 스킬의 `MAN.md` 를 읽고 그 스킬의 용도와 동작을 사용자에게 설명하고, 후속 질문에 답한다. 대상 스킬을 실행하지는 않는다.

---

## 탐색

- 작업 repo 의 `*/skills/<스킬명>/MAN.md` 를 먼저 찾는다.
- repo 에 없으면 플러그인 캐시에서 찾는다: `~/.claude/plugins/installed_plugins.json` 에 기록된 각 플러그인의 `installPath` 아래 `skills/<스킬명>/MAN.md`. 거기 속하지 않는 캐시 버전 폴더는 과거 잔재이므로 매칭하지 않는다.
- `플러그인:스킬` 형태로 지정되면 플러그인 세그먼트를 함께 매칭한다.
- 서로 다른 스킬이 2곳 이상 매칭되면 → 목록을 제시하고 사용자에게 선택을 요청한다.
- `MAN.md` 는 없지만 스킬 폴더는 있으면 → 해당 스킬에 `MAN.md` 가 없음을 먼저 알린 뒤, `/mkman <스킬명>` 으로 생성할 수 있음을 안내한다. 사용자가 원하면 `SKILL.md` 를 근거로 즉석 설명한다.
- 스킬 자체가 없으면 → 없음을 보고하고 종료.

## 색인 모드 (인자 없음)

작업 repo 의 `*/skills/*/MAN.md` 와, `installed_plugins.json` 의 각 `installPath` 아래 `skills/*/MAN.md` 를 수집해 `스킬명 (플러그인) — description` 표로 출력한다. 같은 `플러그인:스킬` 이 repo 와 캐시 양쪽에 있으면 repo 쪽 한 줄만 남긴다 (탐색 순서와 동일). frontmatter 의 description 만 읽고, description 이 없는 `MAN.md` 는 본문 첫 문장으로 대신한다.

## 설명 모드

`MAN.md` 를 읽고 요약 우선으로 설명한다: 용도 → 호출법 → 동작 → 주의. 이후 질문은 `MAN.md` 를 근거로 답하고, 문서에 없는 내용은 `SKILL.md` 를 확인한 뒤 답한다.
</man_instruction>

$ARGUMENTS
