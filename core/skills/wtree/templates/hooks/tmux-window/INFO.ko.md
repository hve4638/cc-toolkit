새 워크트리마다 tmux 윈도우를 열고 그 안에서 claude 를 시작

`wtree new` 직후 tmux 윈도우를 하나 열어 새 워크트리 디렉터리에서 `claude` 를 시작한다. tmux 밖에서 실행되면 아무것도 하지 않는다.

`wtree destroy`(와 `land`) 때는 짝인 post-destroy 훅이 삭제된 워크트리에 좌초된 윈도우 정리를 제안한다: 작은 pane 이 close/keep 을 묻고, 현재 윈도우의 모든 pane 이 사라진 경로 위에 있을 때만 닫을 수 있다.

조정 지점 세 곳이 있고, 셋업에서 받은 답으로 조립된다:

- 포커스 — 항상 이동, interactive 실행(터미널에서 직접 `wtree new`)일 때만 이동, 이동하지 않음. 기본은 interactive 일 때만.
- 윈도우명 접두어 — 기본은 브랜치명 그대로.
- 실행 명령 — `claude`, 다른 명령, 또는 명령 없이 윈도우만 열기.
