---
name: wsbrief
description: "워커 세션의 현 작업 상태 보고 — 맡은 ticket·손본 곳·진행 상태"
disable-model-invocation: true
---

<wsbrief>
이 세션이 맡은 작업의 현 상태를 보고한다. 근거는 대화 기억이 아니라 지금 관측한 것에 둔다 — `wsticket <맡은 ticket명>` 으로 ticket 상태를, `git log` 로 분기 이후 커밋을, `git status` 로 미커밋 변경을 확인한 뒤 답한다.

보고 항목:

1. 맡은 ticket — 이름과 한 줄 설명. 맡은 ticket 이 없으면 없다고 말한다.
2. 손본 곳 — 분기 이후 커밋한 것과 미커밋 변경의 파일·요지.
3. 지금 상태 — 다음 중 하나로 명시한다: 수행 중 / 막힘 (사유) / 완료·merge 대기 / 사용자 확인 대기.
4. 남은 것 — 완료까지 남은 일과 확인받을 사항.

문체: 사용자가 쓰는 언어로 답하되, ASD-STE100 Simplified Technical English 의 문장 규칙을 적용한다 — 한 문장에 사실 하나, 짧은 능동태 문장.
</wsbrief>

Task: $ARGUMENTS
