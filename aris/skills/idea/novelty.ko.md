# Novelty: 이미 나온 것인가?

아이디어 하나 또는 방법 설명을 문헌과 대조해 보정된 판정을 내린다.

## 기본값

- **CLAIMS**: 핵심 기술 주장 3개에서 5개.
- **QUERIES**: 주장마다 최소 3가지 질의 형태.
- **WINDOW**: 최근 2년, 여기에 최근 6개월치 프리프린트를 따로 확인한다.
- **DOSSIER**: 프로젝트 루트의 `NOVELTY_DOSSIER.md`.

## Step 1: 주장 뽑아내기

설명에서 차이를 만드는 주장을 골라낸다. 방법이 무엇인지, 어떤 문제를 푸는지, 기제가 무엇인지, 뻔한 베이스라인과 무엇이 다른지다.

## Step 2: 주장별 검색

주장마다 lit 스킬의 survey 절차 (`${CLAUDE_PLUGIN_ROOT}/skills/lit/survey.md`, Step 1 과 2) 로 검색한다. arXiv 와 Semantic Scholar 스크립트에 WebSearch 를 더한다. 겹칠 소지가 있는 논문은 초록과 related-work 절을 모두 읽는다.

후보는 전부 `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/verify_papers.py` 로 돌리고 각각 `verified` 또는 `UNVERIFIED` 태그를 단다.

## Step 3: 교차 모델 검증

dossier 에 방법 설명, 주장, 태그가 붙은 후보 논문, 분야, "이것이 참신한가? 가장 가까운 선행 연구는 무엇인가? 델타는 무엇인가?" 라는 질문, 그리고 아래 판정 한계를 그대로 적는다. 그다음:

```text
codex_agent:
  name: idea-novelty
  message: Read <absolute path to NOVELTY_DOSSIER.md> and follow all instructions in it.
```

응답은 `NOVELTY_RESPONSE.md` 에 그대로 저장한다.

## 판정 한계

이 블록을 dossier 에 그대로 복사한다. Step 4 의 보고서도 이 한계 아래에서 판정된다.

```text
=== NOVELTY VERDICT LIMITS (these bound how you judge, never how widely you search) ===
Search exhaustively; judge calibrated. Two failures waste months equally:
passing an idea a published paper already contains, and killing a viable idea
because the territory has neighbors.
1. Proximity is information, not a verdict. Someone working nearby goes in the
   report; it is not by itself a reason to reject.
2. ABANDON has exactly one qualification: a specific published paper already
   contains this result - name that paper. No named paper, no ABANDON.
3. Crowded-but-deltaed is PROCEED: state the delta in one sentence a reviewer
   could verify. Thin or contested delta is PROCEED WITH CAUTION - say what
   would make it carry, not why it should die. CAUTION is not a safe middle:
   if you cannot name the specific thing that makes the delta thin, the
   verdict is PROCEED.
4. Concurrent or competing work is not a veto. That is a race - report it and
   let the user decide whether to run it.
5. A direct attack on a central problem is legitimate novelty when nobody has
   executed it well. "This area is hot" does not mean "this area is taken."
6. This check is an early gate, never the last one. A wrongly passed idea dies
   cheaply later; a wrongly killed idea is never seen again. When torn between
   two verdicts, choose the more permissive one.
Say plainly when an idea clears the check. Do not manufacture overlap.
```

## Step 4: 보고서

```markdown
## Novelty Check Report

### Proposed Method
[1-2 sentences]

### Core Claims
1. [Claim] - Closest: [paper] - What stays unknown or different: [delta]
2. ...

### Closest Prior Work
| Paper | Year | Venue | Overlap | Key Difference | Verified |
|-------|------|-------|---------|----------------|----------|

### Overall Novelty Assessment
- Score: X/10 (5/10 = clear neighbors but a defensible delta worth a pilot; 1-3 only for a result a named published paper already contains)
- Recommendation: PROCEED / PROCEED WITH CAUTION / ABANDON
- Key differentiator: [what makes this unique, if anything]
- Risk: [what a reviewer would cite as prior work]

### Suggested Positioning
[The delta in one sentence a reviewer could verify]
```

## 규칙

- 아이디어는 전체로 판정한다. 알려진 부분들을 엮어 알려지지 않은 것을 드러낸다면, 개별 주장이 낮게 나와도 참신하다.
- 방법과 실험 환경을 둘 다 본다. 방법은 이미 알려졌지만 결과가 새로울 것 같으면 그렇게 적는다.
- 리뷰어의 판정과 검색 결과가 어긋나면 양쪽과 그 이유를 함께 보고한다.
