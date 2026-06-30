# wt

프로젝트에 `./mkwt.sh` 를 생성해, 사용자가 명령 한 줄로 워크트리를 띄우게 하는 스킬. `/wt` 로 호출(1회 셋업).

## 설계 의도

Claude Code 빌트인 워크트리는 항상 메인 브랜치에서 분기한다. wt 는 **현재 HEAD 에서 분기**해 작업 중 브랜치 위에 워크트리를 띄운다.

예전엔 `/wt` 가 직접 워크트리를 만들었다(에이전트 셸만 그쪽으로 이동, 사용자 셸은 제자리). 지금은 역할을 바꿔, `/wt` 는 **`./mkwt.sh` 를 한 번 생성하는 init** 이고 워크트리 생성은 사용자가 직접 한다. 사용자가 `./mkwt.sh <브랜치>` 를 실행하면:
- tmux 안이면 워크트리를 초기 pwd 로 하는 **새 tmux 윈도우**(윈도우명=브랜치명)를 연다(셋업 시 선택하면 그 윈도우에서 claude 자동 실행).
- 아니면 cd 할 **워크트리 경로를 출력**한다.

상정 워크플로는 그대로다: 워크트리를 일회용 작업장으로 쓰며 막 커밋하다가, 끝나면 누적 결과를 부모 브랜치에 **squash 한 단일 커밋**으로 올린다(merge 흔적 없음). 그 정리를 각 워크트리가 스스로 책임지도록 `wt-land`·`wt-destroy` 가 워크트리 안에 들어간다.

## 스크립트 구성

| 파일 | 역할 |
|---|---|
| `wt-init.sh` | `/wt` 본문이 호출. 인자 `<repo-rel> [claude]` 받아 `mkwt.sh` 조립·드롭, 그룹 폴더에 `CLAUDE.md` 드롭, exclude 등록 (감지 안 함, 검증만) |
| `mkwt-body.sh` | `mkwt.sh` 의 정적 본문(템플릿). `wt-init` 이 설정값·헬퍼를 앞에 붙여 완성 |
| `wt-land.sh` | land. mkwt 가 base64 로 워크트리에 생성 |
| `wt-destroy.sh` | 폐기. mkwt 가 base64 로 워크트리에 생성 |
| `worktree-claude.md` | 워크트리용 `CLAUDE.md` 템플릿. wt-init 이 그룹 폴더에 복사 |

`mkwt.sh` 는 **자체 포함**이다. `wt-init` 이 `wt-land.sh`·`wt-destroy.sh` 를 base64 로 인코딩해 `mkwt.sh` 안에 써넣으므로, 사용자 셸에서 플러그인 경로(`CLAUDE_PLUGIN_ROOT`) 없이 동작한다. 템플릿이 바뀌면 `mkwt.sh` 를 지우고 `/wt` 를 재실행해 다시 조립한다.

## wt-init 작동

`$PWD`(= `mkwt.sh` 를 둘 위치)에서 인자로 받은 `<repo-rel>` 을 그대로 써넣는다. **감지하지 않는다 — 어디에 repo 가 있는지는 호출자(에이전트/사용자)가 정한다.** wt-init 은 그 값을 검증만 한다:

| `<repo-rel>` | 의미 | 결과 mkwt 위치 |
|---|---|---|
| `.` | `$PWD` 가 repo 루트 | repo 안 (`git status` 숨김 처리됨) |
| `<subdir>` | repo 가 `$PWD` 의 하위폴더 (컨테이너) | 컨테이너 안 (추적 안 됨) |

검증: `$PWD/<repo-rel>` 이 실제 git repo 의 **루트**인지 확인하고, 아니면 에러. 레이아웃 판정·repo 스캔은 안 한다 — 그 결정은 `/wt` 본문(SKILL.md)에서 에이전트가 하고, 애매하면 사용자에게 묻는다.

워크트리 최종 위치는 mkwt 가 **항상** `dirname(repo)/<repo>.worktrees/<슬러그>` 로 고정(repo 작업트리 밖이라 repo 를 오염시키지 않음).

조립 후:
- `mkwt.sh` 에 실행권한 부여.
- 그룹 폴더(`dirname(repo)/<repo>.worktrees/`)에 `worktree-claude.md` 를 `CLAUDE.md` 로 복사. 이미 있으면 보존(사용자 수정 유지). 워크트리가 이 폴더 하위라 각 워크트리는 부모 디렉터리 지침으로 자동으로 읽는다. land/destroy 의 `rmdir` 은 폴더가 빌 때만 지우므로 CLAUDE.md 와 함께 잔존한다.
- 2번째 인자가 `claude` 면 `WT_CLAUDE=1` 을 mkwt 에 써넣는다(없으면 0). tmux 윈도우에서 claude 자동 실행 여부.
- `<repo-rel>` 이 `.` 일 때만 `$GIT_COMMON_DIR/info/exclude` 에 `/mkwt.sh` 등록 → `git status` 에서 숨김. 그 외엔 `$PWD` 가 repo 작업트리 밖이라 불필요.

## mkwt 작동 (사용자 실행)

```bash
./mkwt.sh <브랜치명>
```

- repo 의 현재 HEAD 에서 `git worktree add -b <브랜치> <대상> HEAD`. 분기 기준은 항상 HEAD(예전 `[기준-ref]` 인자는 없앰).
- **브랜치명**은 입력에서 공백·git 금지문자(`~^:?*[]`, `..`)를 정리하되 `/` 는 보존해 계층 브랜치(`feat/login`)를 그대로 유지하고, 한글 등도 보존. 빈 이름·기존 브랜치·기존 대상 폴더는 거부.
- **디렉토리(슬러그)**는 그 브랜치명을 파일시스템용으로 변환 — `/` → `-` (예: `feat/login` → 워크트리 폴더 `feat-login`). 슬러그 변환은 폴더명에만 적용되고 브랜치·tmux 윈도우명은 브랜치명을 그대로 쓴다.
- `wt-land`·`wt-destroy` 를 base64 디코드해 워크트리 루트에 생성하고 실행권한 부여.
- 워크트리 **per-worktree git dir**(작업트리 밖)에 메타 두 줄:
  - `wt-base` = 분기 시점 SHA. wt-destroy 가 "손 안 댄 워크트리" 판별에 씀.
  - `wt-parent` = land 대상 부모 브랜치(= mkwt 실행 시점 repo 의 현재 브랜치).
- `$GIT_COMMON_DIR/info/exclude` 에 `/wt-land`·`/wt-destroy` 등록(전 워크트리 공유).
- 마지막: **tmux 안이고 stdout 이 실제 터미널(`[ -t 1 ]`)이면** 워크트리를 초기 pwd 로 한 새 tmux 윈도우(윈도우명=브랜치명)를 연다. `WT_CLAUDE=1`(wt-init 의 `claude` 인자)이면 그 윈도우에 `send-keys 'claude' Enter` 로 claude 를 띄운다 — `new-window <cmd>` 가 아니라 인터랙티브 셸에 타이핑하므로 사용자 alias·함수가 보존된다. 아니면(비대화형 — 파이프·캡처·에이전트) 대상 경로를 stdout 에 출력. tmux 실패 시에도 경로 폴백.

> `[ -t 1 ]` 가드 덕에 mkwt 는 호출자 무관하게 안전하다: 사용자가 터미널에서 실행하면 tmux 윈도우, 에이전트가 도구로 실행하거나 `$(...)` 로 캡처하면(stdout=파이프) tmux 를 안 건드리고 경로만 출력한다. mkwt 는 기본적으로 사용자 명령이다.

## wt-land 작동

```bash
<워크트리>/wt-land -m "feat: ..."                 # 기록된 부모로
<워크트리>/wt-land -m "feat: ..." --into=<브랜치>  # 다른 브랜치로
<워크트리>/wt-land -m "feat: ..." --keep          # 올리되 워크트리 보존(여러 번 land)
```

대상은 **스크립트 파일이 놓인 위치(`$0`)** 의 워크트리. `-m` 없으면 usage.

1. 대상 브랜치 결정: `--into` 값, 없으면 `wt-parent`. 자기 브랜치거나 존재 안 하면 거부.
2. 대상이 체크아웃된 워크트리를 찾는다. 없으면 거부(체크아웃 필요), dirty 면 거부(섞임 방지).
3. **충돌 사전검사**: `git merge-tree --write-tree <대상> <feature>` 로 메모리상 병합. 비0=충돌이면 충돌 파일을 알리고 멈춤 — 작업트리·인덱스·ref 안 건드림.
4. clean 이면 대상 워크트리에서 `git merge --squash <feature>` → `git commit -m`. squash 라 단일 커밋. 올릴 게 없으면 거부.
5. 성공 시 키 없이 `worktree remove --force` → `branch -D` → `prune` → 빈 그룹 폴더 `rmdir`. `--keep` 면 이 정리를 건너뛰어 워크트리·브랜치를 남긴다.

충돌 해결은 스크립트가 안 한다(판정 영역). 그 워크트리에서 `git merge <대상>` 으로 풀고 커밋 후 재실행. 그 merge 커밋은 다음 land 의 squash 로 사라져 최종 이력은 단일 커밋 유지.

`--keep` 는 한 워크트리에서 여러 번 land 하게 한다(작업 → `wt-land --keep` → 다음 작업 → `wt-land`). land 마다 부모에 단일 커밋이 하나씩 쌓인다. 연속 land 는 별도 동기화 없이 증분만 올라가고(squash base 가 분기점에 묶여 있어도 동일 내용은 blob 이 같아 충돌 안 남), 부모가 이미 올라간 파일을 분기 편집한 경우에만 충돌나는데 그때는 위 충돌 해결 흐름(`git merge <대상>`)이 곧 base 동기화가 된다. 마무리는 마지막 land 에서 `--keep` 를 빼거나(정리까지) `wt-destroy` 로 폐기한다(브랜치에 커밋이 남아 confirmation key 를 요구하지만 작업은 이미 부모에 있어 안전).

## wt-destroy 작동

```bash
<워크트리>/wt-destroy          # 점검 후 안전하면 삭제, 아니면 키 발급
<워크트리>/wt-destroy <키>     # 키 확인 후 강제 삭제
```

대상은 **스크립트 파일이 놓인 위치(`$0`)** 의 워크트리(호출자 cwd 아님). git-dir == git-common-dir 이면 메인 워크트리이므로 거부.

- **인자 없음**: `wt-base` 와 비교해 HEAD 그대로 + 작업트리 clean 이면(분기 후 커밋·변경 0) 곧바로 정리. 그 외는 거부 사유 + confirmation key 출력 후 멈춤.
- **키 있음**: 현재 상태로 키 재계산해 비교. 일치하면 강제 삭제, 불일치(상태 변동)면 새 키 안내.
- **confirmation key**: `sha256(상태)` 앞 5 hex. 상태 = HEAD + `status --porcelain` + `diff HEAD` + untracked(비-ignored) 내용 해시. ignored 파일(node_modules 등)은 영향 없음.

## 폴더 구조

```
wt/
├── SKILL.md          # 영문 스킬 (init)
├── SKILL.ko.md       # 한국어 스킬 (페어)
├── README.md         # 본 문서
└── scripts/
    ├── wt-init.sh        # /wt 본문: <repo-rel> [claude] 받아 mkwt.sh 조립·드롭 + 그룹 CLAUDE.md + exclude
    ├── mkwt-body.sh      # mkwt.sh 정적 본문 템플릿
    ├── wt-land.sh        # 부모에 squash-merge 후 정리 (mkwt 가 워크트리에 임베드)
    ├── wt-destroy.sh     # 워크트리 폐기 (mkwt 가 워크트리에 임베드)
    └── worktree-claude.md # 워크트리용 CLAUDE.md 템플릿 (wt-init 이 그룹 폴더에 복사)
```
