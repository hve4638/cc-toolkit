---
name: idea
description: 외부 GPT 리뷰어와 함께 연구 아이디어를 생성하고 점검하고 다듬고 검토하고 계획한다.
disable-model-invocation: true
argument-hint: "[direction, idea, proposal path, or paper directory]"
---

# idea

## 모드

각 모드는 이 스킬 디렉터리 안에 자기 문서를 가진다.

| 모드 | 문서 | 입력 | 출력 | 보통 이어지는 단계 |
|------|------|------|------|---------------------|
| Create | `create.md` | 연구 방향 | `idea-stage/IDEA_REPORT.md` 에 순위를 매긴 아이디어 후보 | Novelty, 이어서 Refine |
| Novelty | `novelty.md` | 아이디어 하나 또는 방법 설명 | 가장 가까운 선행 연구를 함께 제시하는 참신성 판정 | Refine |
| Refine | `refine.md` | 문제와 대략적인 접근 | `refine-logs/FINAL_PROPOSAL.md` 에 담긴 검토된 제안서 | Plan 또는 Review |
| Review | `review.md` | 제안서, 초고, 또는 결과 묶음 | 합의된 주장과 할 일 목록을 담은 리뷰 문서 | Plan |
| Plan | `plan.md` | 제안서 | `refine-logs/EXPERIMENT_PLAN.md` 와 실행 트래커 | 실험 수행 |
| Kill | `kill.md` | 논문 디렉터리 | `KILL_ARGUMENT.md`: 가장 강한 기각 메모와 항목별 판정 | 논문 수정 |

## 모드 고르기

1. 요청이 비어 있거나 이 스킬로 무엇을 할 수 있는지 묻는 것이면, 각 모드를 한 줄씩 (입력과 산출물) 설명하고 어느 것을 원하는지 묻는다. 거기서 멈춘다.
2. 요청이 모드를 지목하거나 위 표의 한 행과 정확히 맞으면 그 모드를 쓴다.
3. 입력이 LaTeX 소스를 담은 논문 디렉터리면 Kill 을 쓴다.
4. 그 밖에는 쓸 모드, 입력 파일, 그리고 사용할 연구 분야와 목표 학회를 한 줄로 밝힌 뒤 멈추고 사용자의 승인을 기다린다. 리뷰어 호출은 승인 이후에 시작한다.

## 모드 실행

고른 문서를 Read 도구로 읽고 그대로 따른다. 경로는 이 스킬 디렉터리에 파일 이름을 붙인 것이다.

## 모든 모드에 적용되는 규칙

- 연구 분야와 목표 학회는 요청이나 프로젝트 `CLAUDE.md` 에서 가져와 모든 리뷰어 프롬프트에 넣는다. 어느 쪽에도 없으면 첫 리뷰어 호출 전에 묻는다.
- 외부 리뷰어는 core 도구 `codex_agent` (이름 붙은 대화 시작) 와 `codex_send` (대화 이어가기) 로 부르는 GPT 다. 긴 입력은 파일에 넣고 프롬프트에는 절대 경로를 싣는다.
- 라운드가 있는 모드는 라운드마다 멈추고 사용자가 다음 라운드를 요청할 때만 이어간다.
- 인용하는 모든 논문은 `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/verify_papers.py` 를 통과한다. 검증되지 않은 논문은 `UNVERIFIED` 태그를 단 채 출력에 남는다.

Request: $ARGUMENTS
