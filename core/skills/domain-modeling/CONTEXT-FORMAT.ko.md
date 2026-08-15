<!-- Imported from mattpocock-skills / domain-modeling (MIT, © 2026 Matt Pocock) -->

# CONTEXT.md 형식

## 구조

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## 규칙

- **의견을 가진다.** 같은 개념에 여러 단어가 있으면 가장 나은 하나를 고르고 나머지를 `_Avoid_` 에 나열한다.
- **정의는 조인다.** 최대 한두 문장. 무엇을 *하는지*가 아니라 무엇*인지*를 정의한다.
- **이 프로젝트 컨텍스트 고유의 용어만 넣는다.** 일반적인 프로그래밍 개념 (타임아웃, 에러 타입, 유틸리티 패턴) 은 프로젝트가 아무리 많이 쓰더라도 여기 속하지 않는다. 용어를 추가하기 전에 묻는다: 이것은 이 컨텍스트에 고유한 개념인가, 일반적인 프로그래밍 개념인가? 전자만 여기 속한다.
- **자연스러운 묶음이 생기면 소제목으로 용어를 묶는다.** 모든 용어가 하나의 응집된 영역에 속하면 평평한 목록으로 둬도 된다.

## 단일 컨텍스트 repo 와 다중 컨텍스트 repo

**단일 컨텍스트 (대부분의 repo):** repo 루트에 `CONTEXT.md` 하나.

**다중 컨텍스트:** repo 루트의 `CONTEXT-MAP.md` 가 컨텍스트 목록, 각각의 위치, 그리고 서로의 관계를 적는다:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md) — manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

스킬은 어느 구조인지 추론한다:

- `CONTEXT-MAP.md` 가 있으면 그것을 읽어 컨텍스트들을 찾는다
- 루트 `CONTEXT.md` 만 있으면 단일 컨텍스트다
- 둘 다 없으면 첫 용어가 확정될 때 루트 `CONTEXT.md` 를 lazy 하게 만든다

컨텍스트가 여럿이면 현재 주제가 어느 것에 해당하는지 추론한다. 불분명하면 묻는다.
