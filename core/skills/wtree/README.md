# wtree

repo 에 정책 기반 워크트리 관리를 셋업하는 스킬. `/wtree` 로 호출(1회 셋업). 실제 도구는 별도 저장소의 스탠드얼론 `wtree` CLI(크레이트 `gitwtree`, Rust 단일 바이너리)다.

경로는 둘이다. tmux 안에서는 TUI pane 이 기본이고, 밖에서는(또는 사용자가 대화 응답을 원하면) 폼 프로토콜이 폴백이다. 두 경로 모두 결정적 동작은 `scripts/lib/actions.mjs` 한 구현을 쓴다 — 흐름과 질문만 각자의 것이다.

## TUI 경로

`tui.mjs` 를 showcase pane 으로 띄우면 사용자가 직접 답한다. npm init 류 인라인 프롬프트다 — 흐르는 출력에 질문이 끼고, 선택은 방향키+Enter, Esc 는 그 자리 취소, Ctrl-C 는 종료(130). 전체 화면을 잡지 않는다. 프리미티브는 `lib/prompt.mjs`(의존성 없음, raw mode + ANSI, 한글 2폭 절단, 키 큐로 연타 유실 방지).

두 국면으로 나뉜다:

- **무동사(collect)** — 게이트·사실 수집 후 질문(기존 정책 처분 / 작업장 경로 / 셰이프 / 훅 / where / 감지 실패 시 root)을 받고, 변경 직전 계획을 한 화면으로 확정받은 뒤 step1 의 결정적 동작(회전·생성·셰이프 반영·훅 병합·settings)을 수행한다. 개입 구간(rules 검토, custom rules 작성, 훅 [조정]·판정)이 오면 handoff 를 쓰고 종료한다.
- **apply** — 에이전트가 검토를 마친 뒤 두 번째 pane 으로 띄운다 (`apply --path <ws> [--hooks yes|no] [--where ../|./]`). `--hooks` 는 에이전트의 검토 판정이고, 훅이 있으면 붉은 경고 + 0.5초 지연(그 사이 키는 버려져 반사적 Enter 가 안 통한다) 뒤 기본 커서 '아니오'인 더블 체크를 사용자가 한다. 확정 후 step2 의 결정적 동작(sh -n 선검사 → settings 보완 → `wtree init --load` → 훅 복사 → CLAUDE.md)을 수행한다.

**handoff 계약**: exec pane 은 종료 즉시 사라져 stdout 이 에이전트에게 돌아가지 않으므로, TUI 는 매 종료 지점에서 `<git-common-dir>/wtree-setup-handoff.md` 를 쓴다. 내용은 폼 스크립트의 출력 페이지와 같은 태그 블록(`tui-done`/`tui-adopted`/`tui-cancelled`/`tui-failed`, apply 는 `step2-done` 등 기존 페이지 재사용)이라 에이전트 대면 프로토콜이 두 경로에서 갈라지지 않는다. 끝났다는 신호는 지금은 사용자가 대화로 직접 준다.

TUI 화면 문구는 `tui.mjs` 안의 en/ko 상수 표다 — messages/ 페이지는 에이전트가 파싱하는 산문이고, 화면 문구는 커서·색과 함께 그려지는 조각이라 페이지가 되지 못한다. handoff 용 페이지는 messages/ 에 있다.

## 폼 프로토콜 (폴백)

SKILL 본문은 "step1 을 실행하고 출력을 따르라"와 태그 시맨틱 정의가 전부다. 각 스텝은 폼이고 `--answer '<JSON>'` 이 제출이다:

- 불완전한 answer 호출은 **어떤 변화도 없이** 채워야 할 키만 출력한다. step1 무인자는 현 상황 조회, step2 무인자는 정상 루트 이탈 error 다(step2 완성 명령은 step1 이 건네준다).
- 완전한 answer 를 받으면 그제서야 스텝의 한 동작을 수행하고, 수행 내역과 다음 스텝 명령을 출력한다.
- 검증은 수집형이다 — 게이트 문제도, 빠진 키도 전부 모아 한 번에 알린다. answer 의 모르는 키·잘못된 값도 에러다.

출력은 태그 블록이고 내부는 마크다운이다. 첫 줄 `<status>` 가 라운드 성격(Required Answer / Success / Blocked / Error)을 밝히고, `<require>` 는 채울 키와 값 힌트(잘못된 값엔 `— invalid value` 접미), `<question>` 은 사용자에게 물을 것(선택지 괄호에 채울 인자 병기), `<next>` 는 다음에 실행할 명령 하나다. 그 외 `<info>` 상태·결과·지시, `<alert>` 전달할 경고, `<error>` 잘못된 것(무변화), `<output cmd="...">` 그 명령의 실행 출력.

| 스크립트 | 동작 (완전한 answer 시) | answer 키 |
|---|---|---|
| `step1.mjs` | 작업장 생성 — path 회전(`.old` 백업, 이전 old 삭제) 또는 생성, 셰이프 rules 반영(루트 개명·`drop` 섹션 제거), 훅 병합(`post-create` 하나로, 복수 기능은 서브셸 격리), settings 기록. path 가 이미 유효한 작업장이면(채택) 무변화로 인정하고 step2 완성 명령을 handoff | `path`, `allow_overwrite`, `branch_shape`, `hooks`, `root`, `drop`, `where`, `copy_hooks`(채택 시) |
| `step2.mjs` | 적용 — 훅 `sh -n` 선검사 → settings 보완 → `wtree init --load` → 훅 복사(+실행 권한) → 워크트리 폴더 CLAUDE.md | `path`, `copy_hooks`, `where` |

역할 경계: 파일시스템 조작은 전부 스크립트가 한다. 에이전트는 읽기·질문·그리고 생성과 적용 사이의 작업장 내용 편집(훅 [조정] 주석 확인, custom rules 작성, 기타 이탈 반영)만 한다. `.git/wtree/` 반영은 항상 적용 국면(step2 또는 TUI apply) 몫이다.

기존 `.wtree` 발견 시 처분 3선택지(채택 / 폐기 재구성 / 보존 재구성)를 묻는다 — 폼에서는 step1 answer 인자로, TUI 에서는 select 로 표현된다. 훅 위험성 검토는 두 경로 모두 에이전트 몫이다: 폼은 `copy_hooks` 답으로, TUI 는 handoff 의 `--hooks` 판정 + 사용자 더블 체크로 이어진다. 작업장 기본이 repo 의 `.wtree/` 라 구성 결과가 곧 커밋 가능한 공유물이고, `wtree save` 단계는 따로 없다.

TUI 의 drop(셰이프 섹션 제거)과 root 재지정 같은 이탈은 질문에 없다 — 개입 구간에서 에이전트가 작업장 파일 편집으로 반영한다(폼 경로는 answer 키 그대로).

## 메시지와 템플릿

`scripts/messages/` — 에이전트 대면 산문은 전부 여기 있다. 영문 `.md` 가 정본이고 같은 이름의 `.ko.md` 가 한국어 페어다(`--ko` 플래그로 렌더, 없으면 영문 폴백). 전체 페이지 변형(`step1-fresh`, `tui-done` 등)과 조립용 조각(`q-*` 질문, `frag-*`)으로 나뉘고, 스크립트는 `{KEY}` 를 채워 조립한다. 치환은 양방향 엄격: 메시지에 있는데 값이 없어도, 값을 줬는데 자리가 없어도 내부 에러(`파일:줄번호` 힌트, exit 2)다. 게이트 문제·수행 내역 같은 한 줄짜리 판정문만 스크립트 상수다(영문 고정 — 언어 분기 없음).

`templates/shapes/<이름>/` — 브랜치명이 박힌 그대로 동작하는 rules + INFO.md. 디렉터리 하나가 선택지 하나이고, 목록 요약은 INFO.md 첫 줄이다(TUI select 의 note 로도 쓰인다). 템플릿 특정 이탈(prototype 제거 등)은 INFO.md 가 안내한다.

`templates/hooks/<기능>/` — post-create 훅을 기능 단위로 담는다(현재 tmux-window 하나). 가장 흔한 선택이 박힌 동작하는 훅 + [조정] 주석 + INFO.md. 복수 선택 시 서브셸 격리로 병합한다.

두 종류 모두 폴더 추가만으로 선택지가 늘어난다 — 스크립트는 고치지 않는다.

## 폴더 구조

```
wtree/
├── SKILL.md            # 영문 스킬 (TUI/폼 두 경로 + 태그 시맨틱)
├── SKILL.ko.md         # 한국어 스킬 (페어)
├── README.md           # 본 문서
├── vocabulary.md       # custom 셰이프용 rules 키 참조
├── templates/
│   ├── shapes/
│   │   ├── main-work/          # rules + INFO.md
│   │   └── main-dev-work/      # rules + INFO.md (실사용 rules 원본)
│   └── hooks/
│       └── tmux-window/        # post-create + INFO.md
└── scripts/
    ├── tui.mjs            # TUI (collect + apply 두 국면, 화면 문구 en/ko 상수)
    ├── step1.mjs          # 작업장 생성 폼 (폴백)
    ├── step2.mjs          # 적용 폼 (폴백)
    ├── lib/actions.mjs    # 결정적 동작 공유부 (게이트·사실 수집·step1 계획/실행·step2 실행)
    ├── lib/prompt.mjs     # 인라인 프롬프트 프리미티브 (select·multiselect·input·pause)
    ├── lib/setuplib.mjs   # 메시지 치환·answer 파싱·에러 계약·템플릿 열거
    ├── messages/          # 페이지 변형 + q-*/frag-* 조각 (tui-* 는 handoff 용)
    └── worktree-claude.md # 워크트리 폴더용 CLAUDE.md 템플릿
```

테스트는 `core/scripts/test/wtree-setup.test.mjs`(폼 15개, wtree shim 으로 헤르메틱)와 `wtree-tui.test.mjs`(비대화 경로·handoff 페이지 엄격 치환)다. TUI 대화 경로는 tmux pane 실측으로 검증한다.

## 연혁

구 구현 — `wt-init.sh` 가 `wt.sh` 를 base64 로 베이크한 `mkwt.sh` 를 드롭하고 워크트리마다 `./wt` 복사본과 `.wtrc` 를 두던 방식 — 은 스탠드얼론 `wtree` CLI 로 대체되어 제거됐다. 구 방식으로 만든 워크트리는 자기 `./wt` 복사본으로 계속 동작하므로 마이그레이션은 없다. 스킬 폴더는 CLI rename(`wt` → `wtree`)을 따라 `skills/wt` 에서 옮겨왔다.

셋업 스크립트는 sh 4종 + SKILL 본문 6절 → 게임북(mjs 3단계) → 폼 프로토콜(mjs 2단계 + `--answer` JSON)로 재편됐고, 이후 TUI 경로가 기본으로 얹혔다 — 질문 응답이 에이전트 중개(AskUserQuestion)에서 pane 직접 입력으로 옮겨가고, 폼은 tmux 밖 폴백으로 남았다. 결정적 동작은 이때 actions.mjs 로 추출되어 두 경로가 공유한다.
