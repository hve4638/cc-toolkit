# wtree

repo 에 정책 기반 워크트리 관리를 셋업하는 스킬. `/wtree` 로 호출(1회 셋업). 실제 도구는 별도 저장소의 스탠드얼론 `wtree` CLI(크레이트 `gitwtree`, Rust 단일 바이너리)다.

rules 와 settings 는 CLI 자신의 `wtree init` 이 자체 대화형 메뉴(템플릿 실루엣 포함)로 조립한다. 이 스킬은 init 이 다루지 않는 한 가지 — wtree 훅 — 만 더한다. 흐름 전체가 useterminal pane 하나에서 끝난다:

1. **게이트** — wtree CLI 존재(`(gitwtree)` 문자열), git repo, 미설정(`.git/wtree/rules` 부재) 확인. 문제는 전부 모아 한 번에 알린다.
2. **훅 선택** — `templates/hooks/` 의 변형들을 multiselect 로 고른다. 화면 하나로 끝이고 후속 질문은 없다 — 같은 기능의 변형끼리는 배타 그룹이라 하나만 켜진다. repo 에 커밋된 `.wtree/hooks` 가 있으면 "가져오기" 항목이 목록에 추가된다 — init 의 `--load` 조차 훅은 가져오지 않으므로 반입은 이 목록의 몫이다.
3. **훅 기록** — 조립·병합한 훅을 `sh -n` 선검사(임시 파일에서) 후 `.git/wtree/hooks/` 에 기록한다. init 보다 먼저 기록해도 안전하다: `wtree init` 은 기존 훅 파일을 보존하고 `*.sample` 만 옆에 추가한다 (실측 검증).
4. **init 위임** — 같은 pane 에서 `wtree init` 을 자식으로 실행한다(`stdio: inherit`). 사용자가 CLI 의 메뉴에서 시작 rules 를 고른다. 자식이 도는 동안 부모는 SIGINT 를 무시해, init 이 취소돼도 종료 확인 화면까지 돌아온다.
5. **종료 확인** — 성공/실패 한 줄을 보여주고 아무 키나 받은 뒤 종료한다(exec pane 은 종료 즉시 사라지므로 마지막 화면을 붙잡는 용도).

handoff 파일은 없다. 에이전트는 pane 을 열고 기다렸다가, 사용자가 끝났다고 하면 `wtree rule` 로 결과를 직접 확인한다. 실패 메시지는 사용자가 화면에서 전달한다.

pane 을 열기 전 에이전트 몫이 하나 있다: `.wtree/hooks` 가 있으면 각 파일을 읽고, 표방한 기능 이상의 동작이 보이면 사용자에게 경고한다(SKILL 지시). pane 은 가져온 파일에 `sh -n` 문법 검사만 한다.

## 프롬프트와 템플릿

TUI 는 npm init 류 인라인 프롬프트다 — 흐르는 출력에 질문이 끼고, 선택은 방향키+Enter, Esc 는 그 자리 취소, Ctrl-C 는 종료(130). 전체 화면을 잡지 않는다. 프리미티브는 `lib/prompt.mjs`(의존성 없음, raw mode + ANSI, 한글 2폭 절단, 키 큐로 연타 유실 방지). 화면 문구는 `tui.mjs` 안의 en/ko 상수 표이고 `--ko` 로 고른다. 게이트 문제 같은 한 줄짜리 판정문은 영문 고정이다.

`templates/hooks/<기능>/<변형>/` — wtree 훅을 기능·변형 2단으로 담는다(현재 tmux-window 의 always / interactive-only). 변형 폴더가 곧 완성품이다: 훅 종류별 파일(예: post-create + post-destroy)과 INFO.md(첫 줄이 목록 요약, `.ko.md` 페어)만 있고, 슬롯도 조정 지점도 없다 — 조정은 설치된 `.git/wtree/hooks/` 파일을 직접 고치는 것으로 대신한다(INFO 안내). 같은 기능의 변형들은 목록에서 배타 선택된다(feature 가 그룹 키). 폴더 추가만으로 선택지가 늘어난다 — 스크립트는 고치지 않는다. 여러 변형이 공유하는 파일(tmux-window 의 post-destroy)은 동일 사본으로 두고 테스트가 드리프트를 잡는다.

같은 훅 종류를 여러 기능이 가지면 기능마다 서브셸로 격리해 하나로 병합한다(`mergeFeatures`) — 가져온 기존 훅도 같은 모양(`{ name, files }`)으로 섞인다. 단, `$0` 재호출 훅은 병합을 거부한다(재진입이 자기 절만이 아니라 뒤 절 전부를 다시 돌리므로).

## 폴더 구조

```
wtree/
├── SKILL.md            # 영문 스킬
├── SKILL.ko.md         # 한국어 스킬 (페어)
├── README.md           # 본 문서
├── templates/
│   └── hooks/
│       └── tmux-window/
│           ├── always/             # post-create + post-destroy + INFO.md (완성품)
│           └── interactive-only/   # post-create + post-destroy + INFO.md (완성품)
└── scripts/
    ├── tui.mjs            # 전체 흐름 (게이트 → 훅 선택·기록 → wtree init 위임 → 종료 확인)
    ├── lib/actions.mjs    # 게이트·훅 읽기·병합 (readHookFiles·mergeFeatures)
    ├── lib/prompt.mjs     # 인라인 프롬프트 프리미티브 (select·multiselect·input·pause)
    └── lib/setuplib.mjs   # 언어 선택·템플릿 변형 열거·외부 명령 실행
```

테스트는 `core/scripts/test/wtree-setup.test.mjs`(훅 조립·post-destroy 가드, wtree shim 으로 헤르메틱)와 `wtree-tui.test.mjs`(비대화 경로: 게이트·인자·TTY 거부)다. TUI 대화 경로는 tmux pane 실측으로 검증한다.

## 연혁

구 구현 — `wt-init.sh` 가 `wt.sh` 를 base64 로 베이크한 `mkwt.sh` 를 드롭하고 워크트리마다 `./wt` 복사본과 `.wtrc` 를 두던 방식 — 은 스탠드얼론 `wtree` CLI 로 대체되어 제거됐다. 스킬 폴더는 CLI rename(`wt` → `wtree`)을 따라 `skills/wt` 에서 옮겨왔다.

셋업 스크립트는 sh 4종 → 게임북(mjs 3단계) → 폼 프로토콜(`--answer` JSON 2단계) → TUI + handoff 2단 pane 으로 재편돼 왔고, CLI 의 `wtree init` 이 rules 템플릿 메뉴를 자체 탑재하면서 지금의 단일 pane 흐름으로 축소됐다 — 셰이프 템플릿·작업장 조립(`.wtree` 구성 후 `--load`)·handoff 파일·워크트리 폴더 CLAUDE.md 배치가 모두 CLI 또는 폐기로 넘어갔다.
