---
name: domain-modeling
description: 프로젝트의 도메인 모델을 세우고 벼린다. 사용자가 도메인 용어나 ubiquitous language 를 확정하려 할 때, 아키텍처 결정을 기록하려 할 때, 또는 다른 스킬이 도메인 모델을 유지해야 할 때 쓴다.
---

<!-- Imported from mattpocock-skills / domain-modeling (MIT, © 2026 Matt Pocock) -->

# Domain Modeling

설계하면서 프로젝트의 도메인 모델을 능동적으로 세우고 벼린다. 이것은 *능동적인* 규율이다 — 용어에 반문하고, 엣지 케이스 시나리오를 지어내고, 글로서리와 결정을 확정되는 순간 적는다. (어휘를 얻으려고 `CONTEXT.md` 를 단지 *읽는* 것은 이 스킬이 아니다 — 그건 어느 스킬이나 하는 한 줄짜리 습관이다. 이 스킬은 모델을 소비할 때가 아니라 바꿀 때 쓴다.)

## 파일 구조

대부분의 repo 는 컨텍스트가 하나다:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

루트에 `CONTEXT-MAP.md` 가 있으면 그 repo 는 컨텍스트가 여럿이다. 맵이 각 컨텍스트의 위치를 가리킨다:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

파일은 lazy 하게 만든다 — 쓸 내용이 생겼을 때만. `CONTEXT.md` 가 없으면 첫 용어가 확정될 때 만든다. `docs/adr/` 가 없으면 첫 ADR 이 필요할 때 만든다.

## 세션 중에

### 글로서리에 비추어 반문한다

사용자가 `CONTEXT.md` 의 기존 언어와 충돌하는 용어를 쓰면 즉시 지적한다. "당신의 글로서리는 'cancellation' 을 X 로 정의하는데, Y 를 뜻하는 것 같다 — 어느 쪽인가?"

### 흐린 언어를 벼린다

사용자가 모호하거나 과부하된 용어를 쓰면 정확한 정규 용어를 제안한다. "'account' 라고 하는데 — Customer 를 말하는가, User 를 말하는가? 둘은 다른 것이다."

### 구체적인 시나리오로 논한다

도메인 관계를 논할 때는 구체적인 시나리오로 압박 시험한다. 엣지 케이스를 찌르는 시나리오를 지어내 개념 사이의 경계에 대해 사용자가 정확해지도록 강제한다.

### 코드와 교차 확인한다

사용자가 무언가의 동작을 진술하면 코드가 동의하는지 확인한다. 모순을 찾으면 드러낸다. "당신의 코드는 Order 전체를 취소하는데, 방금 부분 취소가 가능하다고 했다 — 어느 쪽이 맞나?"

### CONTEXT.md 를 즉시 갱신한다

용어가 확정되면 `CONTEXT.md` 를 그 자리에서 갱신한다. 모아두지 않는다 — 일어나는 대로 붙잡는다. 형식은 [CONTEXT-FORMAT.ko.md](./CONTEXT-FORMAT.ko.md) 를 따른다.

`CONTEXT.md` 에는 구현 세부가 전혀 없어야 한다. `CONTEXT.md` 를 스펙이나 스크래치패드나 구현 결정 저장소로 다루지 않는다. 글로서리이고 그뿐이다.

### ADR 은 아껴서 제안한다

다음 셋이 모두 참일 때만 ADR 생성을 제안한다:

1. **되돌리기 어렵다** — 나중에 마음을 바꾸는 비용이 유의미하다
2. **맥락 없이는 의아하다** — 나중의 독자가 "왜 이렇게 했지?" 하고 궁금해할 것이다
3. **진짜 트레이드오프의 결과다** — 실제 대안들이 있었고 구체적인 이유로 하나를 골랐다

셋 중 하나라도 빠지면 ADR 은 건너뛴다. 형식은 [ADR-FORMAT.ko.md](./ADR-FORMAT.ko.md) 를 따른다.
