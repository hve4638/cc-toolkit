---
name: wt
description: "프로젝트에 ./mkwt.sh 를 생성해, 사용자가 명령 한 줄로 git worktree(HEAD에서 분기)를 띄우게 한다"
disable-model-invocation: true
---

<wt_instruction>
# wt — ./mkwt.sh 셋업

`/wt` 는 1회 셋업이다. 자체 포함된 `./mkwt.sh` 를 프로젝트 루트에 생성하고 git 에서 숨긴다.

## repo 위치를 정하고, 조립한다

정하는 건 둘이다. 먼저 `<repo-rel>` — `mkwt.sh` 를 둘 디렉터리에서 그 repo 까지의 경로다. 프로젝트 모양을 보고 둘 위치와 `<repo-rel>` 을 고른다:

- 프로젝트 루트가 그 자체로 repo → 거기 생성하고, `<repo-rel>` 은 `.`
- 프로젝트 루트가 repo 를 하위폴더로 담은 컨테이너 → 컨테이너에 생성하고, `<repo-rel>` 은 그 하위폴더 이름
- 사용자가 특정 repo/위치를 지정 → 그걸 쓴다

애매하면(repo 여러 개, 루트가 불분명) 추측하지 말고 사용자에게 묻는다.

다음으로, mkwt 가 여는 tmux 윈도우에서 `claude` 를 자동 실행할지 사용자에게 묻는다. 그러면 아래 2번째 인자로 `claude` 를 넘기고, 아니면 생략한다.

정한 디렉터리에서 조립기를 실행한다:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-init.sh" <repo-rel> [claude]
```

`wt-init.sh` 는 기계적이다: `<repo-rel>`·claude 선택·`wt-land`·`wt-destroy`(base64)를 self-contained `mkwt.sh` 에 써넣고, 실행권한을 주고, 그룹 폴더 `<repo>.worktrees/` 에 공용 `CLAUDE.md` 를 생성하고(이미 있으면 보존), `<repo-rel>` 이 `.` 일 때 `/mkwt.sh` 를 `.git/info/exclude` 에 등록한다. 아무것도 판단하지 않는다 — `<repo-rel>` 이 repo 루트를 안 가리키면 에러. 출력을 사용자에게 보고한다. 템플릿이 바뀐 뒤 다시 만들려면 `mkwt.sh` 를 지우고 재실행한다.

## 조립 후

`mkwt.sh` 는 사용자의 명령이다 — 시키지 않은 한 직접 실행하지 말고 전달한다(실행하면 브랜치+워크트리가 생긴다). 실행하더라도 tmux 안전하다: stdout 이 터미널이 아니면(도구 호출이나 `$(...)`) tmux 윈도우를 건너뛰고 워크트리 경로만 출력한다.

wt-init 출력이 이미 `mkwt.sh` 실행법을 안내하므로 그대로 전달한다. mkwt / wt-land / wt-destroy 의 메커니즘은 여기가 아니라 다른 곳에 있다: README.md(유지보수자), 그리고 각 워크트리에 생성되는 `CLAUDE.md`(거기서 작업하는 세션).
</wt_instruction>
