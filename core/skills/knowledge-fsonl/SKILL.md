---
name: knowledge-fsonl
description: "Reference for the FSONL (Function-Styled Object Notation Lines) serialization format: spec, grammar, and Python implementation. Refer to it when fsonl knowledge is needed."
---

# FSONL — Function-Styled Object Notation Lines

JSONL의 대안으로 설계된 라인 기반 직렬화 포맷. 레코드 타입이 줄 선두에 즉시 드러난다.

- 스펙: `reference/fsonl/spec/SPEC.md`
- PEG 문법: `reference/fsonl/spec/GRAMMAR.peg`
- Python 구현: `reference/fsonl/python/` (v0.1.0, Python ≥3.10)

## 핵심 특징

| 특징 | 설명 |
|------|------|
| 타입 선두 노출 | `rm("tmp.log")` — JSONL과 달리 타입이 줄 맨 앞에 보임 |
| 스키마 바인딩 | `@schema` 디렉티브로 positional 인자에 이름 부여, 기본값·타입 검증 |
| 줄 단위 처리 | 한 줄 = 한 엔트리. 스트리밍·append·로그에 최적화 |
| JSON 호환 값 | string, number, bool, null, array, object |
| 2단계 파싱 | 1단계(Syntax Parse → AST) + 2단계(Schema Bind → Typed Object) |

## FSONL vs JSONL

```
// JSONL — 타입이 객체 안에 묻힘
{"type":"rm","target":"tmp.log","force":true}

// FSONL — 타입이 즉시 보임, 스키마로 더 간결
rm("tmp.log", force=true)
```

## 문법

### 엔트리

한 줄에 하나의 엔트리. `type(args)` 형식. 타입 이름과 `(` 사이에 공백 불허.

```fsonl
rm("tmp.log", force=true)
log("info", "started", "port 8080")
event({ "type": "warn", "msg": "hello" })
```

### 인자 규칙

- **Positional**: 순서 기반, 항상 named보다 앞
- **Named**: `key=value` 형식, 순서 무관, 중복 금지
- **가변 인자**: `*name: type[]` — positional 마지막에만 허용
- **예약 키**: `type`은 named arg 키·스키마 파라미터명으로 사용 불가
- **Trailing comma 금지**
- **주석**: `//` (독립 줄 또는 엔트리 뒤 인라인, 인자 목록 내부에서는 불허)
- **공백**: `,` `=` `(` `)` 앞뒤 자유, 단 타입명과 `(` 사이는 불허

### 값 리터럴

JSON 값 문법을 따른다: `"string"`, `123`, `3.14`, `true`, `false`, `null`, `[1,2]`, `{"k":"v"}`

### 스키마 (`@schema`)

타입별 인자 구조 선언. 해당 타입 엔트리보다 앞에 선언해야 하며, 동일 타입 중복 선언 금지.

```fsonl
@schema rm(target: string, --force?: bool = false)
@schema rename(old: string, new: string)
@schema log(level: string, *msg: string[])
@schema call(data: { cmd: string[], env?: string[] })
```

- Positional: `name: type`
- Named: `--name: type` 또는 `--name?: type = default`
- 가변: `*name: type[]`

### 스키마 타입

| 타입 | 설명 |
|------|------|
| `string`, `number`, `bool`, `null` | 기본 타입 |
| `any` | 모든 JSON 값 허용 |
| `type[]` | 배열. 중첩 허용: `string[][]` |
| `{ key: type }` | 고정 구조 객체 |
| `type \| type` | 유니온 |
| `(type \| type)[]` | 유니온 배열 |

### Optional / Nullable

`?`(생략 가능)와 `| null`(null 값 허용)은 직교 개념.

```
--name?: string          // 생략 가능, 값은 string만
--name?: string | null   // 생략 가능, null 허용
--name: string | null    // 생략 불가, null 허용
--name: bool = false     // 기본값 → 생략 가능 암시
```

### 2단계 파싱 모델

1. **Syntax Parse → AST**: 스키마 없이 문법만 해석. `{ type, positional[], named{} }` 반환.
2. **Schema Bind → Typed Object**: positional에 이름 부여, 기본값 적용, 타입 검증. 선택사항.

스키마 출처: 코드 스키마(주) + 파일 스키마(`@schema`, fallback). 둘 다 있으면 교차 검증 후 코드 스키마로 바인딩.

## 파일 형식

- 확장자: `.fsonl`
- MIME: `text/fsonl`
- 인코딩: UTF-8 (BOM 없이)
- 줄 종료: `\n` 또는 `\r\n`

## 비목표

- 멀티라인 지원 없음 (줄 단위 스트리밍 우선)
- 깊은 중첩 데이터에는 JSON이 더 적합
- 실행 가능한 DSL이 아님 (타입 태그가 붙은 레코드 리터럴)
