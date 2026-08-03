<!-- Imported from mattpocock-skills / writing-great-skills (MIT, © 2026 Matt Pocock) -->

# 용어집 — 훌륭한 스킬 만들기

무엇이 스킬을 훌륭하게 만드는가에 대한 도메인 모델. 스킬은 확률적 시스템에서 결정론을 끌어내기 위해 존재한다; 근본 덕목은 **Predictability**이고, 아래 모든 용어는 그것에 대한 레버다. 이 파일은 [`writing-great-skill`](SKILL.ko.md)의 disclosed reference다.

용어는 축으로 묶인다: **Invocation**(스킬에 어떻게 도달하는가), **Information Hierarchy**(콘텐츠가 어떻게 배열되는가), **Steering**(에이전트의 런타임 행동이 어떻게 빚어지는가), **Pruning**(어떻게 군살 없이 유지되는가). 각 **failure mode**는 그것을 치료하는 레버 옆에 살며 _실패 모드_ 태그가 붙어 있다.

정의 안의 **굵은 용어**는 그 자체로 이 용어집에 정의되어 있다; 표제어로 찾는다.

## Predictability

스킬이 에이전트를 매 실행마다 같은 _방식_ 으로 행동하게 만드는 정도 — 같은 출력이 아니라 같은 과정이다(브레인스토밍 스킬은 _예측 가능하게_ 발산해야 한다; 토큰은 달라져도 행동은 달라지지 않는다). 다른 모든 용어가 봉사하는 근본 덕목 — 비용과 유지보수성은 이것의 증상이지 경쟁자가 아니다.

_Avoid_: consistency, reliability, robustness, output-determinism

## Invocation

스킬에 어떻게 도달하는가 — 그리고 그 선택으로 지불하는 두 가지 load.

### Model-Invoked

**description** 필드를 유지한 스킬로, 에이전트가 그것을 보고 자율적으로 발동할 수 있다 — 그리고 인간도 여전히 이름을 입력할 수 있으므로, model-invocation은 항상 사용자 도달을 _포함한다_. 모델 전용 상태는 없다: description은 에이전트의 발견 가능성을 _더할_ 뿐, 인간의 것을 제거하지 않는다. 그 발견 가능성의 대가로 매 턴 영구적인 **context load**를 지불한다. 다른 스킬이 도달할 수 있다 — 에이전트가 발견할 수 있게 만드는 그 description이 호출 가능하게도 만들기 때문이다. 내용이 전부 **reference**인 model-invoked 스킬은 공유 reference의 한 거처이기도 하다: 다른 스킬이 그것을 호출할 수 있으므로, 여러 스킬이 필요로 하는 reference가 한 곳에 산다. model-invocation은 에이전트가 스스로 그 스킬에 닿아야 할 때만 선택한다; 손으로만 발동되는 스킬이라면 description을 없애고 context load를 지불하지 않는다.

_Avoid_: ability, tool, capability

### User-Invoked

**description**이 제거된 스킬 — 에이전트에게 보이지 않고, 인간이 이름을 입력해야만 도달할 수 있다(**model-invoked**가 사용자-_그리고_-에이전트라면 이쪽은 사용자-_전용_). 에이전트 발견 가능성을 내주고 **context load** 0을 얻는다. description이 없으므로 인간 외에는 아무것도 도달할 수 없다: 다른 어떤 스킬도 이것을 발동시킬 수 없다.

_Avoid_: procedure, workflow, command

### Description

스킬의 기계가 읽는 트리거이며, **model-invoked** 스킬이 항상 로드해 둘 수밖에 없는 단 하나의 **context pointer**다. 그 존재 자체가 호출 축이다: 유지하면 스킬은 model-invoked이고(다른 스킬도 도달 가능), 지우면 **user-invoked**가 되어 인간만 도달할 수 있다. model-invoked 스킬의 **context load**의 원천.

_Avoid_: frontmatter, summary

### Context Pointer

에이전트의 컨텍스트에 들려 있는 참조로, 컨텍스트 밖의 자료를 지명하고 그에 도달할 조건을 부호화한다. **description**은 최상위 context pointer이고(컨텍스트 윈도 → 스킬); disclosed 파일로의 포인터는 같은 물건이 한 단계 아래에 있는 것이다. 대상이 아니라 그 표현이, 에이전트가 _언제_ 도달하는지 — 그리고 _얼마나 확실하게_ 도달하는지를 결정한다. 반드시 봐야 할 대상이 약하게 표현된 포인터 뒤에 있으면 분산 버그다: 표현부터 벼리고, 벼려도 안 될 때만 자료를 인라인으로 되돌린다.

_Avoid_: link, reference, import

### Context Load

**model-invoked** 스킬이 에이전트의 컨텍스트 윈도에 지우는 비용 — 항상 로드되는 **description**이 토큰과 주의를 모두 소모한다. **user-invoked** 스킬이 description을 갖지 않음으로써 피하는 것이며, 더 많은 model-invoked 스킬로 쪼개는 것을 막는 제동장치.

_Avoid_: token cost, context bloat

### Cognitive Load

**user-invoked** 스킬이 인간에게 지우는 비용 — 어떤 스킬이 존재하고 각각 언제 찾아야 하는지를 머릿속에 들고 있어야 한다(인간이 색인이다). **model-invocation**이 에이전트 발견 가능성으로 제거해 주는 것이며, 더 많은 user-invoked 스킬로 쪼개는 것을 막는 제동장치. 최소화할 비용이 아니다: 인간 주체성의 값이고, 일부 스킬이 user-invoked로 남는 이유다. 인간의 판단이 중요한 곳에 지불하고, 그렇지 않은 곳에서 제거한다.

_Avoid_: human index, burden, overhead

### Router Skill

다른 user-invoked 스킬들을 가리키는 것이 일인 **user-invoked** 스킬 — 각각의 이름과 언제 찾아야 하는지를 담아, 인간이 여럿 대신 하나만 기억하면 되게 한다. 힌트만 줄 수 있을 뿐 발동시키지는 못한다: user-invoked 스킬에는 **description**이 없으므로 인간 외에는 아무것도 도달할 수 없다. user-invoked 스킬이 불어났을 때의 **cognitive load** 치료법.

_Avoid_: dispatcher, menu, registry, index, router procedure

### Granularity

스킬을 얼마나 잘게 나누는가. 더 잘게 나눌수록 두 load 중 하나를 지불한다: model-invoked 스킬이 늘면 **context load**(더 많은 description이 윈도를 채우고 주의를 두고 경쟁한다), user-invoked 스킬이 늘면 **cognitive load**(인간이 기억하고 찾아야 할 것이 늘어난다). 두 절단이 분할을 안내한다. 호출 기준(by **invocation**)으로는, 단독으로 트리거할 뚜렷한 **leading word** — 실제로 프롬프트에서 쓰는 트리거 단어 — 가 있는 곳에서 model-invoked 스킬을 분리한다. 시퀀스 기준(by sequence)으로는, step의 **post-completion steps**를 숨겨야 하는 곳에서 **step**의 연속을 나눈다 — 자기만의 컨텍스트로 격리하면 뒤따르는 것이 치워지기 때문이다. 역방향을 조심하라: 시퀀스를 합치면 각 step의 post-completion step들이 뒤따르는 것에 노출되어 premature completion을 부른다.

_Avoid_: chunking, modularity

## Information Hierarchy

스킬의 콘텐츠가 어떻게 배열되는가, 그리고 각 조각이 사다리의 얼마나 아래에 놓이는가.

### Information Hierarchy

스킬의 콘텐츠를 에이전트가 얼마나 즉시 필요로 하는가로 등급 매긴 것 — 두 절단(파일 안이냐 포인터 뒤냐, step이냐 reference냐)이 만들어내는 하나의 사다리. 단은 다음과 같다:

- **Steps** — 파일 안, 1차
- **Reference**, 파일 안 — 2차
- **Reference**, disclosed — **context pointer** 뒤

**step**이 없는 스킬은 아래 두 단만 쓴다 — 종종 정당하게 평평한 동급 집합(예: 리뷰의 모든 규칙이 한 단에)이며, 괜찮은 배치이지 냄새가 아니다. 위계는 호출과 독립이다: 전부 step이든, 전부 reference든, 둘 다든 스킬은 model-invoked일 수도 user-invoked일 수도 있다. 스킬에 step이 있을 때, disclose됐어야 할 파일 안 reference는 step을 파묻고 step에 주의가 가는 일을 동전 던지기로 만든다 — 가독성 레버만이 아니라 분산 레버다. 사다리 꼭대기를 읽기 쉽게 유지하고, 내릴 수 있는 것은 아래로 민다.

_Avoid_: structure, organization, layout

### Steps

에이전트가 수행하는 순서 있는 행동들 — 스킬에 있다면 콘텐츠의 1차 계층이고, SKILL.md에 자리를 얻는 부분이다. 모든 스킬에 step이 있는 것은 아니다: 스킬은 전부 step(`tdd`)일 수도, 전부 **reference**(리뷰)일 수도, 둘 다일 수도 있으며, 호출과는 독립이다. 각 step은 명확하든 모호하든 **completion criterion**으로 끝난다.

_Avoid_: workflow, instructions, choreography

### Reference

에이전트가 필요할 때 참조하는 자료 — 정의, 사실, 매개변수, 예시, 조건부 지시. 스킬에 **step**이 있으면 그에 딸린 2차이고; 없으면 콘텐츠 전체이며; 아예 어떤 스킬 밖에 살 수도 있다 — **External Reference** 참조. **context pointer**로 도달하며, **progressive disclosure**의 제1 후보다.

_Avoid_: supporting material, docs, background

### External Reference

스킬 시스템 밖에 사는 **reference** — **description**도 **step**도 없고 호출도 불가능한 평범한 파일 — 어떤 스킬이든 가리킬 수 있다. 스스로 발동할 필요가 없는 공유 reference의 거처이며, 두 **user-invoked** 스킬이 쓸 수 있는 유일한 공유 거처다 — 둘 다 description이 없어 서로를 발동시킬 수 없기 때문이다.

_Avoid_: doc, resource, knowledge base

### Progressive Disclosure

**reference**를 사다리 아래로 옮기는 것 — SKILL.md 밖 **context pointer** 뒤로 — 그래서 꼭대기가 읽기 쉽게 유지된다. 일차적으로 토큰 최적화가 아니다; **information hierarchy**를 지키는 방법이다. **branching**이 면허를 준다: 일부 branch만 필요로 하는 것을 disclose하고, 모든 경로가 필요로 하는 것은 인라인으로 두며, 반드시 봐야 할 자료에서 포인터가 불확실하게 발동하면 표현을 벼리고, 그래도 안 될 때만 인라인으로 되돌린다.

_Avoid_: lazy loading, chunking

### Co-location

에이전트가 한 번에 필요로 하는 자료를 한 곳에 두는 것 — 개념의 정의·규칙·주의사항을 파일 곳곳에 흩뿌리지 않고 하나의 제목 아래에 — 그래서 한 부분을 읽으면 이웃도 함께 읽힌다. **Information Hierarchy**의 파일 내 동반자: 위계가 조각이 _얼마나 아래에_ 놓이는지를 매긴다면, co-location은 거기 놓인 뒤 _옆에 무엇이 놓이는지_ 를 결정한다. **reference** 본문의 올바른 형식에 공식은 없다; 판정은 스킬이 에이전트를 위해 쓰인 문서처럼 읽히는가이며, 모인 자료는 그렇게 읽히고 흩어진 자료는 그렇지 않다. **Duplication**과 구별된다: 그쪽은 하나의 의미를 두 곳에 반복하고, 흩뿌리기는 하나의 의미를 여러 곳에 파편화한다.

_Avoid_: grouping, clustering, cohesion

### Sprawl

_실패 모드._ 그저 너무 긴 스킬 — SKILL.md의 줄이 너무 많다 — 낡았는지 반복인지와는 무관하게. 전부 살아 있고 전부 고유해도 스킬은 sprawl할 수 있다. 가독성(에이전트가 행동하기 전에 더 많이 헤치고 가야 하고, 주의가 초과분에 얇게 퍼진다), 유지보수성(여분의 줄 하나하나가 **relevant**하게 유지해야 할 한 줄이다), 토큰을 소모한다. 치료는 **information hierarchy**다: **reference**를 **context pointer** 뒤로 내리고, **branch**나 시퀀스로 나누어 각 경로가 필요한 것만 지고 가게 한다. **sediment**(낡은 축적으로 인한 길이), **duplication**(반복된 의미로 인한 길이)과 구별된다 — sprawl은 원인이 무엇이든 길이 그 자체다.

_Avoid_: bloat, length, size, verbosity

## Steering

에이전트의 런타임 행동을 **Predictability**를 향해 빚는 레버들.

### Branch

스킬이 호출될 수 있는 구별되는 방식 — 스킬이 다루는 하나의 경우 — 그래서 실행마다 스킬을 통과하는 경로가 달라진다. step이 많은 스킬은 branch를 많이 질 수 있고; 선형 스킬에는 없다.

_Avoid_: path, case, fork

### Leading Word

모델의 사전학습에 이미 살고 있는 압축된 개념 — _Leitwort_ 라고도 한다 — 으로, 에이전트가 스킬을 실행하는 동안 이것으로 사고한다. 모델이 이미 가진 prior를 불러내 가능한 최소의 토큰으로 행동 원리를 부호화한다(예: _lesson_, _proximal zone of development_, _fog of war_, _tracer bullets_). 문장이 아니라 토큰으로 반복되면서 스킬 전체에 걸쳐 분산된 정의를 축적하고 행동의 한 영역 전체를 고정한다. 직접 만든 단어도 명확히 정의하면 통하지만, 지어낸 단어는 prior를 불러내지 못한다 — 사전학습된 단어가 공짜로 주는 것을 정의 토큰으로 지불하게 된다. 기존 단어부터 찾아라.

leading word는 **predictability**에 두 번 봉사한다. 본문에서는 **실행**을 고정한다 — 그 개념이 나타날 때마다 에이전트가 같은 행동에 손을 뻗고, 평평한 reference 안에서는 찾아야 할 것의 부류에 주의를 모아 매 실행 올바른 점검을 불러온다. **description**에서는 **호출**을 고정한다 — 스킬 안에서만이 아니다: 같은 단어가 프롬프트·문서·코드베이스에 살면, 에이전트가 그 공유된 언어를 스킬과 연결해 더 확실하게 발동한다. 스킬을 원할 때 실제로 쓰는 leading word들로 description을 표현하라.

_Avoid_: keyword, term, motif

### Completion Criterion

작업 단위가 끝났음을 에이전트에게 알려주는 조건 — 에이전트가 대조해 판단하는 표적. 두 속성이 이것을 단순한 품질이 아니라 레버로 만든다. 명료성(에이전트가 완료와 미완료를 구별할 수 있는가?)은 **premature completion**에 저항한다 — 모호한 경계("이해에 도달")는 에이전트가 완료를 선언하고 다음 step으로 미끄러지게 둔다; 이 축은 _step_ 이 있어야 문다. premature completion이 step 사이의 실패이기 때문이다. 요구 수준(얼마나 많이 요구하는가)은 **legwork**를 정한다 — "수정된 모든 모델이 반영됨"은 "변경 목록을 만든다"가 강제하지 못하는 철저한 작업을 강제한다 — 그리고 이 축은 step에 묶이지 _않는다_: 평평한 reference 본문도 구속할 수 있고, 그것이 step 없는 스킬이 여전히 빠짐없음의 기준("모든 규칙 적용")을 지는 방식이다. 가장 강한 기준은 점검 가능하면서 빠짐없다.

_Avoid_: done condition, exit condition, stopping rule

### Legwork

하나의 step 안에서 에이전트가 무대 뒤에서 하는 일 — 파일 읽기, 코드베이스 탐색, 변경 수행, 사용자에게 떠넘기지 않고 필요한 것을 직접 파내기. step 구조 아래에 산다: 결코 자기 step으로 쓰이지 않고, 표현 속에 잠재하며, 스킬이 아니라 에이전트가 통제한다. **post-completion steps**의 step 사이 견인에 대응하는 step 안 상대역. **leading word**(_comprehensive_, _thorough_)나 작업의 빠짐없음을 요구하는 **completion criterion**으로 끌어올린다 — 평평한 reference에 적용된 요구 축을 포함해서. 그것이 평평한 reference로 된 스킬이 제 단을 모두 다루게 몰아가는 것이다. 그 요구가 없거나 **premature completion**이 step을 잘라먹을 때 얇아진다.

_Avoid_: scope, effort, diligence, coverage

### Post-Completion Steps

현재 step 뒤에 오는 **step**들. 보이면 에이전트를 **premature completion**으로 끌어당긴다 — 많이 보일수록 견인이 세다; 방어는 step의 시퀀스를 둘로 나눠 그것들을 숨기는 것이다.

_Avoid_: horizon, fog of war, lookahead

### Premature Completion

_실패 모드._ 현재 step이 진짜로 끝나기 전에 끝내는 것. 에이전트의 주의가 작업이 아니라 끝났다는 상태로 미끄러지기 때문이다. step 사이의 실패다: 일어나려면 **step**이 필요하다 — step 없는 스킬이 일찍 그만두는 것은 premature completion이 아니라 충족되지 않은 요구 아래의 얇은 **legwork**다. 두 힘의 줄다리기: 보이는 **post-completion steps**(앞으로 끄는 힘)와 **completion criterion**의 명료성(저항 — 날카롭고 점검 가능한 경계는 버티고, 모호한 것은 무너진다). 흐릿함이 필요조건이다: 날카로운 경계는 나중 step이 아무리 많이 보여도 견인에 저항하므로, 서두르는 일이 없는 step은 방어가 필요 없다. 서두르는 step은 두 레버가 잡아 주지만, 순서대로 손을 뻗어라: 경계부터 벼려라 — 국소적이고 싸다. 기준이 도저히 더 벼릴 수 없이 흐릿하고 _그리고_ 서두름이 실제로 관찰될 때에만 나중 step들을 숨긴다 — 그리고 숨기기는 진짜 컨텍스트 경계를 가로질러야만 작동한다(user-invoked 인계나 서브에이전트 파견; 인라인 model-invoked 호출은 나중 step들을 컨텍스트에 남겨 아무것도 치우지 않는다). 얇은 legwork의 한 원인이지만 그것과 구별된다: legwork는 step이 완전히 완료돼도 얇을 수 있다.

_Avoid_: premature closure, the rush, rushing, shortcutting

### Negation

_실패 모드._ 금지로 조종하기 — 에이전트에게 하지 _말_ 것을 말하기 — 는 금지된 행동을 컨텍스트로 끌어들여 덜이 아니라 _더_ 가용하게 만든다. _don't think of an elephant_ 하면 코끼리가 전부가 되고; _never write verbose comments_ 하면 장황함이야말로 에이전트가 방금 읽은 패턴이다. 부정은 약한 수식어라 강하게 활성화된 개념이 넘어서고, 그래서 금지는 반쯤 그 일을 하라는 지시로 읽힌다. 그것의 **leading word**는 _코끼리_ 다: 금지가 프레임 안으로 지명해 들인 무엇이든. 치료: **긍정형**으로 프롬프트한다 — 목표 행동을 기술해("한 줄 주석을 쓴다") 금지된 행동이 아예 발화되지 않게 한다. 금지는 긍정형으로 표현할 수 없는 행동에 대한 강한 가드레일로만 자리를 얻는다; 그때조차 긍정 표적과 짝지어 주의가 할 일에 내려앉게 한다.

_Avoid_: ironic rebound, don't-prompting, the pink elephant

## Pruning

스킬을 군살 없이 유지하기 — 각 처방을 그것이 치료하는 실패와 짝지어.

### Single Source of Truth

각 의미가 정확히 하나의 권위 있는 자리에 사는 바람직한 상태로, 스킬의 동작 변경이 한 곳의 변경이 되게 한다. **Duplication**이 그 위반이다.

_Avoid_: home, canonical location

### Duplication

_실패 모드._ 같은 의미에 **single source of truth**가 둘 이상 주어진 것. 유지보수 비용(한 곳을 바꾸면 나머지도 바꿔야 한다)과 토큰 비용이 들고, 위상을 부풀린다 — 의미를 반복하면 사다리에서 그 의미가 실제 등급보다 무겁게 매겨진다. **leading word**의 우발적 역상이다 — leading word는 의미가 아니라 토큰을 반복해 일부러 주의를 끌어올린다.

_Avoid_: repetition, redundancy

### Relevance

한 줄이 여전히 스킬이 하는 일과 관련 있는가 — 무엇을 남길지의 렌즈. 줄은 두 가지로 relevance를 잃는다: 애초에 작업과 무관했거나(단순 해설, 또는 disclose됐어야 할 **branch**), 낡아서: 그것이 기술하는 행동이나 세계가 변하며 시대에 뒤처져서. 짧은 스킬이 relevant하게 유지하기 쉽다 — 각 줄의 점검이 싸기 때문이다. **no-op**과 구별된다: relevance는 줄이 작업과 관련 있는지를 묻지, 행동을 바꾸는지를 묻지 않는다.

_Avoid_: load-bearing, staleness, freshness

### Sediment

_실패 모드._ 스킬에 가라앉아 결코 치워지지 않는 낡은 콘텐츠의 층들. 더하기는 안전해 보이고 빼기는 위험해 보이기 때문이다 — 그래서 낡고 무관한 줄들이 쌓이고, 아직 살아 있는 것을 찾으려면 그 층들을 뚫고 내려가야 한다. 가지치기 규율이 없는 모든 스킬의 기본 운명; **duplication**의 반복된 의미와 달리, **relevance**의 느린 침식이다.

_Avoid_: accretion, bloat, cruft, rot

### No-Op

_실패 모드._ 모델이 기본값으로 이미 하는 것이라 아무것도 바꾸지 않는 지시 — 에이전트가 어차피 할 일을 말하는 데 load를 지불한다. 판정: 그 줄이 기본 동작 대비 행동을 바꾸는가? 줄은 완벽하게 **relevant**하면서도 no-op일 수 있다. **leading word**를 공짜로 만드는 바로 그 prior가 no-op을 무가치하게 만든다.

leading word는 _기법_ 이고 no-op은 줄에 대한 _판결_ 이다 — 그리고 둘은 교차한다. 기본값을 이기지 못할 만큼 약한 leading word는 no-op이고(에이전트가 이미 어느 정도 철저한데 _be thorough_), 그 처방은 판결을 통과하는 더 강한 단어(_relentless_)이지 다른 기법이 아니다. 그래서 no-op 판정 — 기본 동작 대비 행동을 바꾸는가? — 은 leading word가 제 반복값을 하고 있는지 매기는 방법이기도 하다. 이것은 모델 상대적이지 독자 상대적이지 않다: 어떤 줄이 no-op인지를 두고 두 사람이 다투면 기본값에 대해 다투는 것이고, 논쟁이 아니라 스킬을 돌려서 정한다.

_Avoid_: redundant instruction, restating the obvious, belaboring
