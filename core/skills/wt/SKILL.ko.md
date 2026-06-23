---
name: wt
description: "현재 브랜치(HEAD)에서 분기한 git worktree를 별도 폴더에 생성"
disable-model-invocation: true
argument-hint: "[이름] [기준-ref]"
---

<wt_instruction>
# wt

현재 브랜치(HEAD)에서 분기한 새 git worktree를 프로젝트 레이아웃에 맞는 위치에 만든다.

## 생성

프로젝트 루트에서 실행한다:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-new.sh" <이름> [기준-ref]
```

- `<이름>` — worktree·브랜치 슬러그. 공백·git 금지문자는 스크립트가 정리하고, 비어 있는 슬러그는 거부한다.
- `[기준-ref]` — 분기 기준. 생략하면 현재 HEAD.

스크립트가 위치를 결정한다:
- 프로젝트 루트가 repo면(git toplevel 존재) → `<repo부모>/<repo>.worktrees/<슬러그>/`
- 프로젝트 루트가 repo 하나만 담은 컨테이너면 → `<프로젝트루트>/<repo>-<슬러그>/`

스크립트는 stdout에 새 worktree의 절대경로 한 줄만 출력한다(진행 메시지는 stderr). 그 경로를 사용자에게 보고하고, 이어서 작업하려면 `cd <경로>`를 제안한다.

생성된 worktree에는 정리용 `wt-destroy` 실행파일이 함께 들어간다(`git status`에는 숨겨짐).

## 정리

각 worktree에는 그 worktree와 브랜치를 제거하는 `wt-destroy`가 들어 있다. 호출 위치와 무관하게 자기가 놓인 worktree를 대상으로 한다. worktree 밖(예: 프로젝트 루트)에서 경로로 호출하면 방금 삭제한 폴더에 셸이 갇히지 않는다.

```bash
<워크트리경로>/wt-destroy
```

- 정리되지 않은 변경이 없고 브랜치가 타 ref에 모두 merge돼 잃을 게 없으면 → 즉시 worktree·브랜치 제거.
- 정리 안 된 변경이나 미merge 커밋이 있으면 → 삭제하지 않고 경고문과 confirmation key(현재 상태로 만든 값)를 출력하고 멈춘다.

`wt-destroy`가 키를 내며 멈췄을 때는 그 키로 곧바로 재실행하지 않는다. 경고문을 사용자에게 그대로 전하고 삭제 의도를 확인한 뒤, 동의한 경우에만 출력된 명령(키 포함) 그대로 재실행한다. 키는 그때의 worktree 상태에 묶여 있어, 상태가 바뀌면 옛 키는 거부되고 새 키가 안내된다.

스크립트가 없을 때의 수동 정리: `git worktree remove <경로>` → `git worktree prune` → `git branch -d <슬러그>`.
</wt_instruction>

$ARGUMENTS
