---
name: memhome
description: "Claude Code auto memory를 settings.local.json 경유로 repo 안으로 이전한다"
disable-model-invocation: true
argument-hint: "[커스텀 메모리 경로 (선택)]"
---

<memhome_instruction>
# memhome

Claude Code auto memory를 `~/.claude/projects/<slug>/memory/`에서, 프로젝트 `.claude/settings.local.json`의 `autoMemoryDirectory`가 가리키게 하는 방식으로 repo와 함께 움직이는 디렉터리로 옮긴다.

## 워크플로우

### 1. 스크립트 실행

사용자가 커스텀 메모리 경로를 제공했으면 인자로 넘기고, 아니면 인자 없이 실행한다(기본값 `<main-checkout>/.agent-memory/memory`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/memhome/scripts/relocate-memory.mjs" [custom-path]
```

### 2. 보고

스크립트의 요약을 빠짐없이 사용자에게 전달한다: 메모리 타깃, 이전한 파일 수, settings 변경 내용, 후속 안내 두 줄.

### 3. 실패 시 멈춘다

스크립트가 non-zero로 끝나면 출력을 그대로 전달하고 사용자의 결정을 기다린다. 파일 이동과 settings 편집은 끝까지 스크립트만이 하는 일이다.
</memhome_instruction>

$ARGUMENTS
