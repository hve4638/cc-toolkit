# Kill: 가장 강한 기각 메모, 그리고 판정

독립된 리뷰어 대화 두 개를 쓴다. 첫 번째는 이 논문을 기각할 가장 강한 논거 하나를 쓴다. 두 번째는 현재 원고가 그 논거에 답하는지를 항목별로 판정한다.

## 목차

- 기본값
- Step 1: 논문 구성 파악
- Step 2: 공격
- Step 3: 판정
- Step 4: 판정 결과와 보고
- 규칙

## 기본값

- **PAPER_DIR**: 사용자가 지정한 디렉터리.
- **ATTACK_LENGTH**: 약 200 단어, 250 단어는 절대 넘지 않는다.
- **POINTS**: 판정에서 다룰 원자적 기각 항목 3개에서 7개.
- **OUTPUT**: PAPER_DIR 안의 `KILL_ARGUMENT.md`.
- **CONVERSATIONS**: `idea-attack` 과 `idea-adjudicate`, 둘 다 `codex_agent` 로 새로 시작한다. 이전 리뷰, 수정 목록, 이번 세션의 요약 중 무엇도 두 프롬프트에 들어가지 않는다.

## Step 1: 논문 구성 파악

```bash
cd "PAPER_DIR"
grep -lE '^\\documentclass' *.tex | head -1        # entry point
find . -name "*.tex" -not -path "./.git/*"
find . -name "*.bib" -not -path "./.git/*"
ls *.pdf 2>/dev/null                               # compiled PDF, if any
```

컴파일된 PDF 가 없으면 프롬프트에 그렇게 적고, 리뷰어는 소스로 작업한다.

## Step 2: 공격

```text
codex_agent:
  name: idea-attack
  message: |
    You are simulating a hostile reviewer for <VENUE> in <FIELD>. Your task is not a balanced review but the single strongest argument for rejecting this paper.

    Files: entry <ENTRY>, all section files, macro files, compiled PDF <main.pdf or "none">. Read the sources yourself. Use no prior reviews or summaries.

    Write the worst-case rejection memo a senior area chair would produce, about 200 words, at most 250. One argument, not a list: pick the most damaging line and develop it. Choose from these axes, combining at most two:
    1. Claim-vs-evidence gap: is the evidence too narrow for the stated result?
    2. Scope overclaim: does the title or abstract sell more than the body proves?
    3. Assumption-vs-claim mismatch: does the body retreat to a narrower object than advertised?
    4. Missing obligation: is a lemma, bound, or condition the headline depends on invoked but not established?
    5. Theorem validity (theory papers): are central results proved as stated?
    6. Limit-order or regime ambiguity: are limits or operating regimes composed in a way the paper does not commit to?
    Cite file:line or equation numbers when accusing. Dispassionate, uncompromising, no hedging, no acknowledging mitigations elsewhere in the paper.
    Output the memo only.
```

메모를 `PAPER_DIR/KILL_ATTACK.md` 에 그대로 저장한다.

## Step 3: 판정

```text
codex_agent:
  name: idea-adjudicate
  message: |
    You are an independent area-chair adjudicator. Read the paper sources (same file list as above) and the rejection memo below. Rule, from the current sources alone, whether each point stands. Use no prior reviews or fix lists.

    Rejection memo:
    > <memo verbatim>

    Decompose the memo into 3-7 atomic rejection points. For each:
    ### Point P_n: <short label>
    **Attack claim**: <about 30 words>
    **Verdict**: answered_by_current_text | partially_answered | still_unresolved
    **Evidence (or lack of)**: <file:line, about 50 words>
    **Severity if unresolved**: critical | major | minor
    **If unresolved, recommended fix**: <one actionable sentence>

    Then:
    ## Summary: counts per verdict
    ## Net assessment: one paragraph. Would this paper survive a senior area chair reading the memo, given only the current sources?
    ## Top action items: at most 3, in priority order

    An author-chosen position (for example a deliberate title scope) is partially_answered with a note that it is intentional, plus whether it is sustainable under the attack. Keep severity honest; do not rationalize on the paper's behalf.
```

판정을 `PAPER_DIR/KILL_ADJUDICATION.md` 에 그대로 저장한다.

## Step 4: 판정 결과와 보고

최종 판정은 판정자가 말해 주는 것이 아니라 판정의 집계에서 계산한다:

| 판정 | 조건 |
|---------|-----------|
| FAIL | critical 인 `still_unresolved` 가 하나라도 있음 |
| WARN | major 나 minor 인 `still_unresolved` 가 있거나, critical 이나 major 인 `partially_answered` 가 있음 |
| PASS | 그 외 전부 |

`PAPER_DIR/KILL_ARGUMENT.md` 를 쓴다:

```markdown
# Kill Argument Report - <paper title>

**Date**: <YYYY-MM-DD>
**Reviewer**: GPT via codex_agent, two fresh conversations
**Verdict**: PASS / WARN / FAIL

## Net assessment
<from the ruling>

## Attack memo (verbatim)
> <memo>

## Ruling (per point)
<verbatim from the ruling>

## Top action items
<from the ruling>
```

판정 결과, 집계, 아직 해결되지 않은 항목과 그 심각도, 액션 아이템, 보고서 경로를 출력한다.

## 규칙

- 이 모드는 보고만 한다. 논문 파일은 수정하지 않는다.
