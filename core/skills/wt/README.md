# wt

현재 브랜치(HEAD)에서 분기한 git worktree 를 별도 폴더에 만드는 스킬. `/wt` 로 호출.

## 설계 의도

Claude Code 빌트인 워크트리는 항상 메인 브랜치에서 분기한다. wt 는 **현재 HEAD 에서 분기**해 작업 중 브랜치 위에 워크트리를 띄운다.

정리는 각 워크트리가 스스로 책임진다. wt-new 가 워크트리 안에 `wt-destroy` 를 떨궈, 그 폴더 안에서 인자 없이 실행하면 자기 자신을 정리한다. 사람이 경로를 기억하지 않아도 된다.

스크립트는 두 개:
- `wt-new.sh` — 생성. `/wt` 본문이 호출
- `wt-destroy.sh` — 정리. 생성 시 각 워크트리로 복사됨

## wt-new 작동

```bash
wt-new.sh <이름> [기준-ref]
```

위치 결정 (실행 위치 `$PWD` 를 프로젝트 루트로 본다):

| 조건 | 위치 |
|---|---|
| `$PWD` 가 repo 안 (git toplevel 존재) | `<repo부모>/<repo>.worktrees/<슬러그>/` |
| `$PWD` 가 repo 하나만 담은 컨테이너 | `<$PWD>/<repo>-<슬러그>/` |

전자는 부모가 여러 프로젝트를 담은 공용 공간일 수 있어 그룹 폴더로 묶고, 후자는 컨테이너가 이미 전용이라 평면 형제로 둔다.

- 분기 기준은 `[기준-ref]`, 생략 시 `HEAD`. `git worktree add -b <슬러그> <대상> <기준>`.
- 슬러그는 공백·git 금지문자(`~^:?*[]`, `..`, `/`)를 정리하고 한글은 보존한다. 빈 슬러그는 거부.
- 같은 이름 브랜치나 기존 대상 폴더가 있으면 실패.
- stdout 에 새 워크트리 절대경로 한 줄만, 진행 메시지는 stderr.

생성 직후:
- `wt-destroy.sh` 를 `<워크트리>/wt-destroy` 로 복사하고 실행권한 부여.
- 그 repo 의 `$GIT_COMMON_DIR/info/exclude` 에 `/wt-destroy` 를 등록해 `git status` 에서 숨긴다. `/` 앵커라 각 워크트리 루트의 그 파일만 가린다.

## wt-destroy 작동

워크트리 안에서 실행한다.

```bash
./wt-destroy          # 상태 점검 후 안전하면 삭제, 아니면 키 발급
./wt-destroy <키>     # 키 확인 후 강제 삭제
```

대상은 **스크립트 파일이 놓인 위치(`$0`)** 의 워크트리다 (호출자 cwd 아님). git-dir == git-common-dir 이면 메인 워크트리이므로 거부한다. 삭제 명령은 메인 repo 로 `cd` 한 뒤 실행해 셸 cwd 가 사라진 폴더에 갇히는 걸 피한다.

### 인자 없음

워킹트리가 깨끗하고(`status --porcelain` 비어 있음) 브랜치가 타 ref 에 모두 도달 가능(잃을 커밋 0)하면 곧바로 정리한다: `worktree remove` → `branch -d` → `prune` → 빈 그룹 폴더 `rmdir`.

그렇지 않으면 아무것도 건드리지 않고, 사유와 destroy 키를 출력한 뒤 exit 1 로 멈춘다. 출력에는 사용자에게 의도를 재확인하고 맞는 경우만 진행하라는 지시가 포함된다 — 에이전트가 키로 곧바로 재실행하지 않게 하는 가드레일.

"잃을 커밋" 판정: 브랜치 고유 커밋 수 = `rev-list --count <브랜치> --not <자신을 뺀 모든 heads/remotes/tags>`. 0 이면 다른 곳에 다 있으니 안전. detached HEAD 는 판정 불가로 보고 항상 불안전 처리.

### 키 있음

현재 상태로 키를 다시 계산해 인자와 비교한다. 일치하면 `worktree remove --force` + `branch -D` 로 강제 삭제. 불일치(그 사이 상태 변동)면 새 키를 안내하고 멈춘다.

### destroy 키

`sha256(상태)` 의 앞 5 hex. 상태 = HEAD + `status --porcelain` + `diff HEAD` + untracked(비-ignored) 파일 내용 해시. 그래서 커밋·tracked 변경·untracked 내용 변경 어디서든 바뀌고, ignored 파일(node_modules 등)은 영향이 없다.

## 폴더 구조

```
wt/
├── SKILL.md          # 영문 스킬
├── SKILL.ko.md       # 한국어 스킬 (페어)
├── README.md         # 본 문서
└── scripts/
    ├── wt-new.sh     # 워크트리 생성 + wt-destroy 드롭
    └── wt-destroy.sh # 워크트리 자기파괴 템플릿 (생성 시 각 워크트리로 복사)
```
