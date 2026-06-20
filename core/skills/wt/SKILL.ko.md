---
name: wt
description: "현재 브랜치(HEAD)에서 분기한 git worktree를 별도 폴더에 생성한다. 메인 브랜치에 고정된 Claude 기본 워크트리 기능을 대체. `/wt <이름> [기준-ref]`로 호출."
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

추적되지 않거나 무시되는 파일(`.env`, `node_modules`, 빌드 산출물)은 worktree로 복사되지 않는다. 필요하면 의존성 설치나 환경파일 복사를 안내한다.

생성된 worktree에는 정리용 `wt-destroy` 실행파일이 함께 들어간다(`git status`에는 숨겨짐).

## 정리

worktree 안에서 `wt-destroy`를 실행해 그 worktree와 브랜치를 제거한다:

```bash
cd <워크트리경로> && ./wt-destroy
```

- 정리되지 않은 변경이 없고 브랜치가 타 ref에 모두 merge돼 잃을 게 없으면 → 즉시 worktree·브랜치 제거.
- 정리 안 된 변경이나 미merge 커밋이 있으면 → 삭제하지 않고 경고문과 `destroy키`(현재 상태로 만든 값)를 출력하고 멈춘다.

`wt-destroy`가 키를 내며 멈췄을 때는 그 키로 곧바로 재실행하지 않는다. 경고문을 사용자에게 그대로 전하고 삭제 의도를 확인한 뒤, 동의한 경우에만 `./wt-destroy <키>`를 실행한다. 키는 그때의 worktree 상태에 묶여 있어, 상태가 바뀌면 옛 키는 거부되고 새 키가 안내된다.

스크립트가 없을 때의 수동 정리: `git worktree remove <경로>` → `git worktree prune` → `git branch -d <슬러그>`.
</wt_instruction>

$ARGUMENTS
