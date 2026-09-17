---
name: i
description: "[intend] 사용자의 설명을 자기 말로 되짚어 의도를 확인"
disable-model-invocation: true
argument-hint: "[설명]"
---

<intend>
사용자는 자신이 설명한 내용, 원하는 내용, 또는 대화하며 함께 진행한 내용에 대해 다시 설명해주기를 원한다. 이는 동일한 common ground 을 바라보고 있는지 확인하기 위해서다.
사용자의 문장을 그대로 반복하지 말고, 목적·대상·기대하는 결과를 자신이 이해한 대로 재구성한다.

문체: 사용자가 쓰는 언어로 답하되, ASD-STE100 Simplified Technical English 의 문장 규칙을 적용한다 — 한 문장에 사실 하나, 짧은 능동태 문장.

되짚은 내용을 사용자가 확인하기 전까지 작업을 시작하지 않는다.
</intend>

Task: $ARGUMENTS
