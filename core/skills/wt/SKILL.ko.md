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

## 2. post_create 훅을 작성한다

`wt-init.sh` 는 `.wtrc` 의 `post_create` 를 일부러 주석 처리된 채로 둔다. 새 워크트리가 무엇을 열어야 하는지는 사용자만 답할 수 있기 때문이다. 워크트리가 생성될 때 무엇을 할지 묻고, 직접 `.wtrc` 를 편집한다. 흔한 답은 새 tmux 윈도우이고, 거기서 `claude` 를 띄우기도 한다:

```sh
# Window-name prefix; empty = branch name as-is (win_prefix=wt: opens "wt:fix/x")
win_prefix=

post_create() {
  [ -n "${TMUX:-}" ] || return 0   # windows only exist inside tmux
  name="${win_prefix}${WT_BRANCH}"
  case "${WT_WINDOW:-}" in
    1) ;;
    0) return 0 ;;
    *)
      if [ "$WT_INTERACTIVE" = 1 ]; then
        printf 'open a tmux window for %s? [Y/n] ' "$WT_BRANCH" >/dev/tty
        IFS= read -r ans </dev/tty || return 0
        case "$ans" in [nN]*) return 0 ;; esac
      else
        printf 'tmux window NOT opened — the user was not asked. Ask them; if yes, run:\n'
        printf "  win=\$(tmux new-window -P -F '#{window_id}' -c '%s' -n '%s') && tmux send-keys -t \"\$win\" claude Enter\n" "$WT_PATH" "$name"
        printf 'or decide up front next time: WT_WINDOW=1 (open) / WT_WINDOW=0 (skip).\n'
        return 0
      fi ;;
  esac
  win=$(tmux new-window -P -F '#{window_id}' -c "$WT_PATH" -n "$name") || return 0
  tmux send-keys -t "$win" 'claude' Enter
}
```

훅은 명시적 결정이 있을 때만 창을 연다: `WT_WINDOW=1`/`=0` 이 실행 단위로 결정하고, 미지정이면 터미널 사용자에게는 그 자리에서 묻고, 캡처된 실행(에이전트)에는 보류된 질문과 실행할 명령을 stderr 로 내보내 사용자에게 전달하게 한다. `claude` 자동 실행을 원치 않으면 `send-keys` 줄(출력되는 명령 안의 것 포함)을 뺀다. `tmux new-window <cmd>` 가 아니라 `send-keys` 를 쓴다 — 전자는 비대화형 셸이라 사용자 alias·함수가 무시된다.

전혀 다른 것(다른 멀티플렉서, 에디터, 알림)을 원하면 그걸 쓴다. 훅은 그냥 셸이고 `.wtrc` 가 넘어오는 변수를 문서화해 둔다. 아무것도 원치 않으면 `post_create` 를 아예 두지 않는다 — 그러면 `mkwt.sh` 는 경로만 출력한다.

어떤 훅을 쓰든 지킬 규칙 둘:

- **터미널 전용 부수효과는 `WT_INTERACTIVE` 로 가드한다.** 사용자가 터미널 앞에 있으면 `1`, 스크립트나 에이전트가 출력을 캡처하는 중이면 `0` 이다. 캡처된 실행에서 창을 열면 엉뚱한 창이 생긴다 — 그렇다고 조용히 건너뛰면 사용자가 내릴 결정 자체가 사라지니, 예시처럼 보류된 질문을 겉으로 드러낸다. 반대로 알림은 대개 어느 쪽이든 울려야 한다.
- **워크트리 경로 출력은 `mkwt.sh` 에 맡긴다.** 경로는 `mkwt.sh` 가 출력하고, 호출자가 그걸 캡처한다.

## 조립 후

`mkwt.sh` 는 사용자의 명령이다 — 시키지 않은 한 직접 실행하지 말고 전달한다(실행하면 브랜치+워크트리가 생긴다). 실행하더라도 `$(...)` 로 캡처하면 워크트리 경로를 받고 `WT_INTERACTIVE=0` 이 되므로, 제대로 쓴 훅이면 사용자 터미널을 건드리지 않는다. 예시 훅이라면 창 질문이 stderr 로 돌아온다 — 사용자에게 전달해 답을 받아 실행하거나, `WT_WINDOW=1` / `WT_WINDOW=0` 으로 미리 정해 넘긴다.

wt-init 출력이 이미 `mkwt.sh` 실행법을 안내하므로 그대로 전달한다. mkwt·`.wtrc`·`wt merge`/`wt land`/`wt destroy` 의 메커니즘은 README.md(유지보수자)와 각 워크트리에 생성되는 `CLAUDE.md`(거기서 작업하는 세션)로 안내한다.
</wt_instruction>
