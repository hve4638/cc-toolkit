# wtree

repo 에 정책 기반 워크트리 관리를 셋업하는 스킬. `/wtree` 로 호출(1회 셋업). 실제 도구는 별도 저장소의 스탠드얼론 `wtree` CLI(크레이트 `gitwtree`, Rust 단일 바이너리)다.

## 폼 프로토콜

SKILL 본문은 "step1 을 실행하고 출력을 따르라"와 태그 시맨틱 정의가 전부다. 각 스텝은 폼이고 `--answer '<JSON>'` 이 제출이다:

- 불완전한 answer 호출은 **어떤 변화도 없이** 채워야 할 키만 출력한다. step1 무인자는 현 상황 조회, step2 무인자는 정상 루트 이탈 error 다(step2 완성 명령은 step1 이 건네준다).
- 완전한 answer 를 받으면 그제서야 스텝의 한 동작을 수행하고, 수행 내역과 다음 스텝 명령을 출력한다.
- 검증은 수집형이다 — 게이트 문제도, 빠진 키도 전부 모아 한 번에 알린다. answer 의 모르는 키·잘못된 값도 에러다.

출력은 태그 블록이고 내부는 마크다운이다. 첫 줄 `<status>` 가 라운드 성격(Required Answer / Success / Blocked / Error)을 밝히고, `<require>` 는 채울 키와 값 힌트(잘못된 값엔 `— invalid value` 접미), `<question>` 은 사용자에게 물을 것(선택지 괄호에 채울 인자 병기), `<next>` 는 다음에 실행할 명령 하나다. 그 외 `<info>` 상태·결과·지시, `<alert>` 전달할 경고, `<error>` 잘못된 것(무변화), `<output cmd="...">` 그 명령의 실행 출력.

| 스크립트 | 동작 (완전한 answer 시) | answer 키 |
|---|---|---|
| `step1.mjs` | 작업장 생성 — path 회전(`.old` 백업, 이전 old 삭제) 또는 생성, 셰이프 rules 반영(루트 개명·`drop` 섹션 제거), 훅 병합(`post-create` 하나로, 복수 기능은 서브셸 격리), settings 기록. path 가 이미 유효한 작업장이면(채택) 무변화로 인정하고 step2 완성 명령을 handoff | `path`, `allow_overwrite`, `branch_shape`, `hooks`, `root`, `drop`, `where`, `copy_hooks`(채택 시) |
| `step2.mjs` | 적용 — 훅 `sh -n` 선검사 → settings 보완 → `wtree init --load` → 훅 복사(+실행 권한) → 워크트리 폴더 CLAUDE.md | `path`, `copy_hooks`, `where` |

역할 경계: 파일시스템 조작은 전부 스크립트가 한다. 에이전트는 읽기·질문·그리고 step1 과 step2 사이의 작업장 내용 편집(훅 [조정] 주석 확인, custom rules 작성, 기타 이탈 반영)만 한다. `.git/wtree/` 반영은 항상 step2 몫이다.

기존 `.wtree` 발견 시 step1 무인자 출력이 처분 3선택지를 묻고, 셋 다 step1 answer 인자로 표현된다: 그대로 적용은 그 path 그대로(채택 handoff), 폐기 재구성은 `allow_overwrite:true`, 보존 재구성은 /tmp 경로. 훅이 있으면 `<alert>` 로 위험성 검토를 앞세우고 그 답이 `copy_hooks` 값이 된다. 작업장 기본이 repo 의 `.wtree/` 라 구성 결과가 곧 커밋 가능한 공유물이고, `wtree save` 단계는 따로 없다.

## 메시지와 템플릿

`scripts/messages/` — 출력 산문은 전부 여기 있다. 영문 `.md` 가 정본이고 같은 이름의 `.ko.md` 가 한국어 페어다(`--ko` 플래그로 렌더, 없으면 영문 폴백). 전체 페이지 변형(`step1-fresh`, `step1-existing` 등)과 조립용 조각(`q-*` 질문, `frag-*`)으로 나뉘고, 스크립트는 `{KEY}` 를 채워 조립한다. 치환은 양방향 엄격: 메시지에 있는데 값이 없어도, 값을 줬는데 자리가 없어도 내부 에러(`파일:줄번호` 힌트, exit 2)다. 게이트 문제·수행 내역 같은 한 줄짜리 판정문만 스크립트 상수다(영문 고정 — 언어 분기 없음).

`templates/shapes/<이름>/` — 브랜치명이 박힌 그대로 동작하는 rules + INFO.md. 디렉터리 하나가 선택지 하나이고, 스크립트는 INFO.md 첫 줄로 목록만 찍는다. 템플릿 특정 이탈(prototype 제거 등)은 INFO.md 가 answer 키(`root`, `drop`)로 안내한다.

`templates/hooks/<기능>/` — post-create 훅을 기능 단위로 담는다(현재 tmux-window 하나). 가장 흔한 선택이 박힌 동작하는 훅 + [조정] 주석 + INFO.md. 복수 선택 시 step1 이 서브셸 격리로 병합한다.

두 종류 모두 폴더 추가만으로 선택지가 늘어난다 — 스크립트는 고치지 않는다.

## 폴더 구조

```
wtree/
├── SKILL.md            # 영문 스킬 (step1 실행 지시 + 태그 시맨틱)
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
    ├── step1.mjs          # 작업장 생성 폼
    ├── step2.mjs          # 적용 폼
    ├── lib/setuplib.mjs   # 메시지 치환·answer 파싱·에러 계약·템플릿 열거
    ├── messages/          # 페이지 변형 + q-*/frag-* 조각
    └── worktree-claude.md # 워크트리 폴더용 CLAUDE.md 템플릿
```

## 연혁

구 구현 — `wt-init.sh` 가 `wt.sh` 를 base64 로 베이크한 `mkwt.sh` 를 드롭하고 워크트리마다 `./wt` 복사본과 `.wtrc` 를 두던 방식 — 은 스탠드얼론 `wtree` CLI 로 대체되어 제거됐다. 구 방식으로 만든 워크트리는 자기 `./wt` 복사본으로 계속 동작하므로 마이그레이션은 없다. 스킬 폴더는 CLI rename(`wt` → `wtree`)을 따라 `skills/wt` 에서 옮겨왔다.

셋업 스크립트는 sh 4종 + SKILL 본문 6절 → 게임북(mjs 3단계: 조회 step1 / 준비 step2 / 적용 step3, 플래그 인자) → 지금의 폼 프로토콜(mjs 2단계 + `--answer` JSON)로 재편됐다. 판단 지침이 SKILL 산문에 상주하던 구조를 해당 시점의 스크립트 출력으로 옮기고, 마지막 재편에서 "완전한 answer 전까지 무변화" 계약으로 부분 실패 상태를 구조적으로 제거했다. write-hook.sh 생성기는 훅 템플릿 폴더로, write-settings.sh 는 settings 기록 로직으로 흡수됐다.
