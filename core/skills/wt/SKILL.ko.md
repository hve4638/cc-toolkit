---
name: wt
description: "현재 브랜치(HEAD)에서 분기한 git worktree를 별도 폴더에 생성"
disable-model-invocation: true
argument-hint: "[이름] [기준-ref]"
---

<wt_instruction>
# wt

현재 브랜치(HEAD)에서 분기한 새 git worktree를 프로젝트 레이아웃에 맞는 위치에 만든다. 작업을 마치면 부모 브랜치에 squash 한 커밋으로 land하거나, 그냥 폐기한다.

## 생성

프로젝트 루트에서 실행한다:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-new.sh" <이름> [기준-ref]
```

- `<이름>` — worktree·브랜치 슬러그. 공백·git 금지문자는 스크립트가 정리하고, 비어 있는 슬러그는 거부한다.
- `[기준-ref]` — 분기 기준. 생략하면 현재 HEAD에서 분기하고 그 현재 브랜치를 land 대상 부모로 기록한다. 명시하면 부모가 모호해져 land 시 `--into`가 필요하다.

스크립트가 위치를 결정한다:
- 프로젝트 루트가 repo면(git toplevel 존재) → `<repo부모>/<repo>.worktrees/<슬러그>/`
- 프로젝트 루트가 repo 하나만 담은 컨테이너면 → `<프로젝트루트>/<repo>-<슬러그>/`

스크립트는 stdout에 새 worktree의 절대경로 한 줄만 출력한다(진행 메시지는 stderr). 그 경로를 사용자에게 보고한다. 별도 지시가 없으면 이후 작업의 기본 공간은 이 새 worktree이므로, `cd <경로>`로 옮겨 거기서 작업한다.

worktree에는 `wt-land`·`wt-destroy` 실행파일이 함께 들어간다(`git status`에는 숨겨짐).

## 작업 마무리 — wt-land

worktree에서 자유롭게 커밋하며 작업한 뒤, 누적 결과를 부모 브랜치에 squash 한 커밋으로 올리고 worktree를 정리한다. 호출 위치와 무관하게 자기가 놓인 worktree를 대상으로 한다.

```bash
<워크트리경로>/wt-land -m "feat: ..."                  # 기록된 부모로 land
<워크트리경로>/wt-land -m "feat: ..." --into=<브랜치>   # 다른 브랜치로 land
```

- `-m`이 없으면 사용법을 출력한다.
- 워크트리의 커밋들을 대상 브랜치에 squash 로 합쳐 `-m` 메시지의 커밋 하나로 올린다. 대상 브랜치 이력에는 중간 WIP 커밋도 merge 커밋도 없이 이 커밋 하나만 추가된다. 성공하면 이 worktree와 브랜치를 제거한다.
- 대상 브랜치는 어딘가 깨끗하게 체크아웃돼 있어야 한다(보통 메인 worktree). dirty거나 체크아웃 안 됐으면 멈춘다.

병합 충돌이 나면 wt-land는 아무것도 건드리지 않고 충돌 파일을 알리며 멈춘다. 이때 그 worktree 안에서 `git merge <대상>`으로 부모를 당겨와 충돌을 해결한다 — 이 worktree의 작업과 그 사이 부모에 들어온 작업, 양쪽 의도를 모두 살린다. 어느 쪽이 맞는지 모호하면 사용자에게 판단을 넘긴다. 해결했으면 무엇을 어떻게 합쳤는지 사용자에게 밝히고, 커밋한 뒤 wt-land를 다시 실행한다.

## 폐기 — wt-destroy

작업을 버리고 worktree를 제거할 때 쓴다.

```bash
<워크트리경로>/wt-destroy          # 점검 후 안전하면 삭제, 아니면 키 발급
<워크트리경로>/wt-destroy <키>     # 키 확인 후 강제 삭제
```

- 분기 이후 새 커밋도 변경도 없으면(아무 작업도 안 한 worktree) → 즉시 제거.
- 그 외에는 아무것도 건드리지 않고 거부 사유와 confirmation key를 출력하고 멈춘다. 키는 그때의 worktree 상태로 만든 값이라, 상태가 바뀌면 옛 키는 거부되고 새 키가 안내된다.

`wt-destroy`가 키를 내며 멈췄을 때는 그 키로 곧바로 재실행하지 않는다. 경고문을 사용자에게 그대로 전하고 삭제 의도를 확인한 뒤, 동의한 경우에만 출력된 명령 그대로 재실행한다.

스크립트가 없을 때의 수동 정리: `git worktree remove <경로>` → `git worktree prune` → `git branch -d <슬러그>`.
</wt_instruction>

$ARGUMENTS
