---
name: wt
description: "프로젝트에 ./mkwt.sh 를 생성해, 사용자가 명령 한 줄로 git worktree(HEAD에서 분기)를 띄우게 한다"
disable-model-invocation: true
---

<wt_instruction>
# wt — ./mkwt.sh 셋업

`/wt` 는 1회 셋업이다. 자체 포함된 `./mkwt.sh` 와 그 `.wtrc` 를 프로젝트에 생성하고 git 에서 숨긴다.

`mkwt.sh` 는 `.wtrc` 만 채워져 있으면 혼자 돈다. 그 한 쌍을 적당한 위치에 놓고, 사람이 답해야 정해지는 부분을 채운다.

## 1. repo 위치를 정하고, 조립한다

`<repo-rel>` 을 정한다 — `mkwt.sh` 를 둘 디렉터리에서 그 repo 까지의 경로다. 프로젝트 모양을 보고 둘 위치와 `<repo-rel>` 을 고른다:

- 프로젝트 루트가 그 자체로 repo → 거기 생성하고, `<repo-rel>` 은 `.`
- 프로젝트 루트가 repo 를 하위폴더로 담은 컨테이너 → 컨테이너에 생성하고, `<repo-rel>` 은 그 하위폴더 이름
- 사용자가 특정 repo/위치를 지정 → 그걸 쓴다

애매하면(repo 여러 개, 루트가 불분명) 추측하지 말고 사용자에게 묻는다.

정한 디렉터리에서 조립기를 실행한다:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-init.sh" <repo-rel>
```

`wt-init.sh` 는 기계적이다: 워크트리용 `wt` 헬퍼(base64)를 self-contained `mkwt.sh` 에 써넣고, `mkwt.sh init <repo-rel>` 을 실행해 초기 `.wtrc` 생성과 git exclude 등록을 시키고, 그 `.wtrc` 가 가리키는 워크트리 폴더에 공용 `CLAUDE.md` 를 떨군다. 아무것도 판단하지 않는다 — `<repo-rel>` 이 repo 루트를 안 가리키면 에러. 출력을 사용자에게 보고한다. 템플릿이 바뀐 뒤 다시 만들려면 `mkwt.sh` 를 지우고 재실행한다.

## 2. 새 워크트리가 무엇을 열지 묻고, 훅을 작성한다

`wt-init.sh` 는 `.wtrc` 의 `post_create` 를 주석 처리된 채로 둔다. 새 워크트리가 무엇을 열어야 하는지는 사용자만 답할 수 있고, 그 답을 여기서 한 번 받는다. 그 뒤로 훅은 매 `mkwt.sh` 실행에서 똑같이 동작한다.

사용자에게 묻는다:

1. 새 워크트리마다 tmux 윈도우를 열까? (아니면 `post_create` 를 두지 않는다)
2. 그 윈도우에서 `claude` 를 띄울까?
3. 에이전트나 스크립트가 `mkwt.sh` 를 실행할 때도 열까, 사용자가 터미널에서 실행할 때만 열까?
4. 윈도우명 접두어는? (비면 브랜치명 그대로)

받은 답으로 `.wtrc` 를 편집한다:

```sh
# Window-name prefix; empty = branch name as-is (win_prefix=wt: opens "wt:fix/x")
win_prefix=

post_create() {
  [ -n "${TMUX:-}" ] || return 0          # windows only exist inside tmux
  [ "$WT_INTERACTIVE" = 1 ] || return 0   # (3) terminal runs only; drop the line to open in every run
  win=$(tmux new-window -P -F '#{window_id}' -c "$WT_PATH" -n "${win_prefix}${WT_BRANCH}") || return 0
  tmux send-keys -t "$win" 'claude' Enter # (2) drop if claude should not start
}
```

`tmux new-window <cmd>` 가 아니라 `send-keys` 를 쓴다 — 전자는 비대화형 셸이라 사용자 alias·함수가 무시된다.

전혀 다른 것(다른 멀티플렉서, 에디터, 알림)을 원하면 그걸 쓴다. 훅은 그냥 셸이고 `.wtrc` 가 넘어오는 변수를 문서화해 둔다. 알림은 창과 달리 캡처된 실행에서도 대개 울려야 한다.

어떤 훅이든 규칙 하나는 지킨다: 워크트리 경로 출력은 `mkwt.sh` 에 맡긴다 — 경로는 `mkwt.sh` 가 출력하고, 호출자가 그걸 캡처한다.

## 조립 후

`mkwt.sh` 는 사용자의 명령이다 — 시키지 않은 한 직접 실행하지 말고 전달한다(실행하면 브랜치+워크트리가 생긴다). 실행하더라도 `$(...)` 로 캡처하면 워크트리 경로를 받고 `WT_INTERACTIVE=0` 이 되므로, 터미널 실행 전용으로 구운 훅이면 사용자 터미널을 건드리지 않는다.

wt-init 출력이 이미 `mkwt.sh` 실행법을 안내하므로 그대로 전달한다. mkwt·`.wtrc`·`wt merge`/`wt land`/`wt destroy` 의 메커니즘은 README.md(유지보수자)와 각 워크트리에 생성되는 `CLAUDE.md`(거기서 작업하는 세션)로 안내한다.
</wt_instruction>
