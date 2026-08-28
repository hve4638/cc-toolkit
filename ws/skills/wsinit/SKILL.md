---
name: wsinit
description: "대상 폴더를 워크스페이스로 지정 — 문서·기록 전용 git repo 초기화"
disable-model-invocation: true
argument-hint: "[대상 폴더 (생략 시 현재 폴더)]"
---

<wsinit_instruction>
# wsinit

이 스킬 폴더의 `WORKSPACE.md` (워크스페이스 정의) 를 읽고 `assets/workspace.tar.gz` (정본 템플릿) 를 임시 디렉터리에 풀어 실물 트리를 확인하고 사용자의 지시에 따른다.

지시가 없다면 상황에 따라 다음을 제시한다.
- 현 디렉토리를 workspace 정의에 맞게 구성
- 현 디렉토리가 workspace와 유사하다면 확인한 구조에 맞게 전환할지 제안

작업 전 확인한다.
- 대상이 상위 repo 의 내부면 거부한다 — 워크스페이스는 독립 repo 이거나 repo가 아니어야 한다.
- 대상 폴더명이 정의의 이름 관례에 맞는지 검사하고, 어긋나면 그 관례를 따를 의도인지 사용자에게 확인한다.
- 대상이 git repo 가 아니면 `git init` 해둘지 사용자에게 확인한다.

작업할 때 기존 파일은 최대한 보존한다 — 간단한 rename 과 소규모 이동까지만 허용된다.
</wsinit_instruction>

Task: $ARGUMENTS
