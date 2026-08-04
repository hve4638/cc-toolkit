---
name: memhome
description: "Claude Code auto memory를 settings.local.json 경유로 안정된 위치로 이전한다"
disable-model-invocation: true
argument-hint: "[커스텀 메모리 경로 (선택)]"
---

<memhome_instruction>
# memhome

Claude Code auto memory를 경로 의존적인 `~/.claude/projects/<slug>/memory/`에서, 프로젝트 `.claude/settings.local.json`의 `autoMemoryDirectory`가 가리키게 하는 방식으로 안정된 위치로 옮긴다.

## 워크플로우

### 1. 타깃 확인

git repo이고 사용자가 경로를 지정하지 않았으면, 실행 전에 어느 쪽으로 옮길지 묻고 답을 기다린다:

- 고정경로 (기본) — `~/.agent-memory/<repo-key>/memory`. 같은 repo의 모든 워크트리·clone이 여기로 수렴하고, repo를 어디로 옮겨도 경로가 유효하다.
- repo 안 — 메인 체크아웃의 `.agent-memory/memory`. repo와 함께 이동한다. 선택 시 `.agent-memory/memory`를 인자로 넘긴다(상대경로 인자는 메인 체크아웃 루트 기준으로 해석된다).

non-git이면 타깃은 `<프로젝트 루트>/.agent-memory/memory`다. 스크립트를 실행한 디렉터리가 프로젝트 루트가 되므로 프로젝트 루트에서 실행한다.

### 2. 스크립트 실행

사용자가 커스텀 메모리 경로를 제공했거나 1단계에서 repo 안을 선택했으면 해당 경로를 인자로 넘기고, 아니면 인자 없이 실행한다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/memhome/scripts/relocate-memory.mjs" [custom-path]
```

### 3. 보고

스크립트의 요약을 빠짐없이 사용자에게 전달한다: 메모리 타깃, 소스별 이전 파일 수, 경고가 있으면 그 내용, settings 변경 내용, 후속 안내.

### 4. 실패 시 멈춘다

스크립트가 non-zero로 끝나면 출력을 그대로 전달하고 사용자의 결정을 기다린다. 출력에 충돌 파일 목록이 있으면 그 목록을 사용자에게 그대로 보여주고, 충돌을 어떻게 해소할지 물은 뒤 결정을 기다린다. 파일 이동과 settings 편집은 끝까지 스크립트만이 하는 일이다.
</memhome_instruction>

$ARGUMENTS
