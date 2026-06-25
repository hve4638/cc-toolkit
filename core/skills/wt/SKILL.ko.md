---
name: wt
description: "프로젝트에 ./mkwt.sh 를 떨궈, 사용자가 명령 한 줄로 git worktree(HEAD에서 분기)를 띄우게 한다"
disable-model-invocation: true
---

<wt_instruction>
# wt — ./mkwt.sh 셋업

`/wt` 는 1회 셋업이다. 자체 포함된 `./mkwt.sh` 를 프로젝트 루트에 떨구고 git 에서 숨긴다. 이후 워크트리 생성은 사용자가 직접 `./mkwt.sh <브랜치>` 로 한다.

## repo 위치를 정하고, 조립한다

정하는 건 하나, `<repo-rel>` — `mkwt.sh` 를 떨굴 디렉터리에서 그 repo 까지의 경로다. 프로젝트 모양을 보고 떨굴 위치와 `<repo-rel>` 을 고른다:

- 프로젝트 루트가 그 자체로 repo → 거기 떨구고, `<repo-rel>` 은 `.`
- 프로젝트 루트가 repo 를 하위폴더로 담은 컨테이너 → 컨테이너에 떨구고, `<repo-rel>` 은 그 하위폴더 이름
- 사용자가 특정 repo/위치를 지정 → 그걸 쓴다

애매하면(repo 여러 개, 루트가 불분명) 추측하지 말고 사용자에게 묻는다.

정한 디렉터리에서 그 값으로 조립기를 실행한다:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-init.sh" <repo-rel>
```

`wt-init.sh` 는 기계적이다: `<repo-rel>` 과 `wt-land`·`wt-destroy`(base64)를 self-contained `mkwt.sh` 에 박고, 실행권한을 주고, `<repo-rel>` 이 `.` 일 때 `/mkwt.sh` 를 `.git/info/exclude` 에 등록한다. 아무것도 판단하지 않는다 — `<repo-rel>` 이 repo 루트를 안 가리키면 에러. 출력을 사용자에게 보고한다. 템플릿이 바뀐 뒤 다시 만들려면 `mkwt.sh` 를 지우고 재실행한다.

## 사용자가 실행하는 것

```bash
./mkwt.sh <브랜치명>     # 예: ./mkwt.sh feat/login
```

repo 의 현재 HEAD 에서 새 워크트리를 분기한다. 브랜치는 준 이름을 그대로 쓰고 — `feat/login` 은 `feat/login` 유지 — 워크트리 폴더만 파일시스템용 슬러그로 정리해(`/` → `-`, git 금지문자 제거) 항상 repo 옆 `<repo>.worktrees/<슬러그>` 에 만든다(예: `feat-login`). `wt-land`·`wt-destroy` 를 그 워크트리에 떨군다.
- tmux 안 + 대화형 터미널: 워크트리를 초기 pwd 로 하는 새 tmux 윈도우를 열고, 윈도우명은 브랜치명으로.
- 그 외(비대화형 — 출력이 파이프/캡처): cd 할 워크트리 경로를 출력.

`mkwt.sh` 는 기본적으로 사용자의 명령이다 — 시키지 않은 한 직접 실행하지 말고 전달한다(실행하면 브랜치+워크트리가 생긴다). 실행하더라도 tmux 안전하다: stdout 이 터미널이 아니면(도구 호출이나 `$(...)`) tmux 윈도우를 건너뛰고 워크트리 경로만 출력한다.

## 마무리 / 폐기

각 워크트리는 두 헬퍼를 품는다(`git status` 에서 숨겨짐). 워크트리 밖에서 경로로 부른다:

```bash
<워크트리>/wt-land -m "feat: ..."     # 워크트리 커밋들을 부모 브랜치에 squash 해 올리고 제거
<워크트리>/wt-destroy                 # 워크트리 폐기 (작업이 남아 있으면 confirmation key 출력)
```

`wt-destroy` 가 키를 내며 멈추면, 경고를 사용자에게 전하고 의도를 확인한 뒤에만 그 키로 재실행한다. wt-land / wt-destroy 의 상세 동작은 README.md 참고.
</wt_instruction>
