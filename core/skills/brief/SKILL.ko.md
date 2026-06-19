---
name: brief
description: 현재 세션의 목표·상태·다음 할 일을 짧게 복기
disable-model-invocation: true
---

<brief_instruction>
# brief

사용자는 모종의 사유(이전 대화 이후 장기간 자리비움 등)로 현재 작업의 맥락을 이해하지 못한다고 가정하고, 지금 진행 중인 세션을 짧게 복기해 준다.
복기 내용은 추가 지침이 없는 한, 지금 대화 컨텍스트 안에 있는 것에서만 끌어온다.

알려줘야 할 것:
- 목표 / 현재 상태 / 다음 할 일

복기할 세션 맥락이 없다면 "이어받을 활성 맥락이 없다"고 답변 후 종료
</brief_instruction>

$ARGUMENTS
