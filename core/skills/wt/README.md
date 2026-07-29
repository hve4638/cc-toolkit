# wt

프로젝트에 `./mkwt.sh` 를 생성해, 사용자가 명령 한 줄로 워크트리를 띄우게 하는 스킬. `/wt` 로 호출(1회 셋업).

## 설계 의도

Claude Code 빌트인 워크트리는 항상 메인 브랜치에서 분기한다. wt 는 **현재 HEAD 에서 분기**해 작업 중 브랜치 위에 워크트리를 띄운다.

예전엔 `/wt` 가 직접 워크트리를 만들었다(에이전트 셸만 그쪽으로 이동, 사용자 셸은 제자리). 지금은 역할을 바꿔, `/wt` 는 **`./mkwt.sh` 를 한 번 생성하는 init** 이고 워크트리 생성은 사용자가 직접 한다. 사용자가 `./mkwt.sh <브랜치>` 를 실행하면:
- 워크트리 경로를 stdout 에 출력한다.
- `.wtrc` 에 `post_create` 훅이 있으면 그걸 부른다. `/wt` 가 기본으로 써주는 훅은 tmux 윈도우를 여는 것이고(선택하면 거기서 claude 자동 실행), 다른 mux 든 알림이든 그 자리를 바꾸면 된다.

상정 워크플로는 그대로다: 워크트리를 작업장으로 쓰며 막 커밋하다가, 끝나면 누적 결과를 부모 브랜치에 **squash 한 단일 커밋**으로 올린다(merge 흔적 없음). 그 조작을 각 워크트리가 스스로 책임지도록 `wt` 한 파일이 워크트리 안에 들어가고, `merge`·`destroy` 두 동사를 받는다.

## 스크립트 구성

| 파일 | 역할 |
|---|---|
| `wt-init.sh` | `/wt` 본문이 호출. 인자 `<repo-rel>` 받아 `mkwt.sh` 조립·드롭, `mkwt init` 실행, 워크트리 폴더에 `CLAUDE.md` 드롭 (감지 안 함, 검증만) |
| `mkwt-body.sh` | `mkwt.sh` 의 정적 본문(템플릿). `wt-init` 이 페이로드를 앞에 붙여 완성 |
| `wt.sh` | 워크트리용 `merge`/`destroy`. mkwt 가 base64 로 워크트리에 `wt` 로 생성 |
| `worktree-claude.md` | 워크트리용 `CLAUDE.md` 템플릿. wt-init 이 그룹 폴더에 복사 |

`mkwt.sh` 는 **자체 포함**이다. `wt-init` 이 `wt.sh` 를 base64 로 인코딩해 `mkwt.sh` 안에 써넣으므로, 사용자 셸에서 플러그인 경로(`CLAUDE_PLUGIN_ROOT`) 없이 동작한다. 템플릿이 바뀌면 `mkwt.sh` 를 지우고 `/wt` 를 재실행해 다시 조립한다.

**baked 되는 건 페이로드뿐이다.** repo 위치·워크트리 위치·훅은 전부 `mkwt.sh` 옆의 `.wtrc` 에 있고 매 실행마다 source 된다. 그래서 그중 무엇을 바꾸든 재생성이 아니라 편집이다.

## 역할 분리 — mkwt 와 /wt

| | 무엇 | 에이전트 필요 |
|---|---|---|
| `mkwt.sh` | 메커니즘. `.wtrc` 만 있으면 단독으로 돈다 | 아니오 |
| `/wt` | 조력. `mkwt.sh`+`.wtrc` 를 적당한 위치에 놓고, 사용자에게 물어 훅을 채워주고, `CLAUDE.md` 를 떨군다 | 예 |

`mkwt.sh init` 이 그 경계다 — `.wtrc` 최소 템플릿 생성과 exclude 등록은 mkwt 자신의 일이라 스킬 없이도 되고, 그 위에 "tmux 를 쓸지, claude 를 띄울지" 를 물어 `post_create` 를 써넣는 건 스킬의 일이다.

## wt-init 작동

`$PWD`(= `mkwt.sh` 를 둘 위치)에서 인자로 받은 `<repo-rel>` 을 그대로 써넣는다. **감지하지 않는다 — 어디에 repo 가 있는지는 호출자(에이전트/사용자)가 정한다.** wt-init 은 그 값을 검증만 한다:

| `<repo-rel>` | 의미 | 결과 mkwt 위치 |
|---|---|---|
| `.` | `$PWD` 가 repo 루트 | repo 안 (`git status` 숨김 처리됨) |
| `<subdir>` | repo 가 `$PWD` 의 하위폴더 (컨테이너) | 컨테이너 안 (추적 안 됨) |

검증: `$PWD/<repo-rel>` 이 실제 git repo 의 **루트**인지 확인하고, 아니면 에러. 레이아웃 판정·repo 스캔은 안 한다 — 그 결정은 `/wt` 본문(SKILL.md)에서 에이전트가 하고, 애매하면 사용자에게 묻는다.

조립 후:
- `mkwt.sh` 에 실행권한 부여.
- **`mkwt.sh init <repo-rel>` 실행.** `.wtrc` 생성과 exclude 등록은 mkwt 자신의 일이라 여기서 재구현하지 않고 태운다.
- 그 `.wtrc` 를 **읽어서** `worktree_dir` 을 알아낸 뒤 거기에 `worktree-claude.md` 를 `CLAUDE.md` 로 복사. 이미 있으면 보존(사용자 수정 유지). 워크트리가 이 폴더 하위라 각 워크트리는 부모 디렉터리 지침으로 자동으로 읽는다. `wt destroy` 의 `rmdir` 은 폴더가 빌 때만 지우므로 CLAUDE.md 와 함께 잔존한다.

경로를 여기서 다시 계산하지 않고 `.wtrc` 에서 읽는 게 요점이다 — 규칙이 두 곳에 있으면 어긋난다.

`post_create` 훅은 wt-init 이 안 쓴다. 사용자에게 물어야 정해지는 값이라 `/wt` 본문(SKILL.md)이 `.wtrc` 를 편집해 채운다.

### mkwt init

```bash
./mkwt.sh init [<repo-rel>]
```

- `.wtrc` 가 없으면 만든다. 있으면 **보존**한다.
- 인자가 없고 현재 폴더에 `.git` 이 있으면 `repo=.` 로, 워크트리 폴더는 repo 의 **형제**인 `../<repo>.worktrees` 로 채운다. 작업트리 안에 두면 매 status·diff 에 잡히기 때문이다.
- repo 를 못 찾으면 키를 빈 채로 두고 알린다. mkwt 는 빈 템플릿으로는 실행을 거부하므로, 잘못 넘겨짚어 반쯤 도는 것보다 명확한 실패가 된다.
- `$GIT_COMMON_DIR/info/exclude` 등록: `/wt` 는 항상(모든 워크트리에 떨어지므로), `/mkwt.sh`·`/.wtrc` 는 그것들이 repo 작업트리 안에 있을 때만.

## mkwt 작동 (사용자 실행)

```bash
./mkwt.sh <브랜치명>
```

- repo 의 현재 HEAD 에서 `git worktree add -b <브랜치> <대상> HEAD`. 분기 기준은 항상 HEAD(예전 `[기준-ref]` 인자는 없앰).
- **브랜치명**은 입력에서 공백·git 금지문자(`~^:?*[]`, `..`)를 정리하되 `/` 는 보존해 계층 브랜치(`feat/login`)를 그대로 유지하고, 한글 등도 보존. 빈 이름·기존 브랜치·기존 대상 폴더는 거부.
- **디렉토리(슬러그)**는 그 브랜치명을 파일시스템용으로 변환 — `/` → `-` (예: `feat/login` → 워크트리 폴더 `feat-login`). 슬러그 변환은 폴더명에만 적용되고 브랜치·tmux 윈도우명은 브랜치명을 그대로 쓴다.
- `wt` 를 base64 디코드해 워크트리 루트에 생성하고 실행권한 부여.
- 워크트리 **per-worktree git dir**(작업트리 밖)에 메타 한 줄:
  - `wt-parent` = 부모 브랜치(= mkwt 실행 시점 repo 의 현재 브랜치). `wt merge` 는 올릴 곳으로, `wt destroy` 는 "이 작업이 이미 반영됐나" 를 잴 기준으로 쓴다.
- 마지막: `post_create` 훅이 정의돼 있으면 호출하고, **항상** 워크트리 경로를 stdout 에 출력한다.

### .wtrc

`mkwt.sh` 바로 옆에 있고 매 실행마다 `source` 된다. 선언 값과 훅이 섞이므로(`.bashrc` 와 같은 성격) 선언적 형식이 아니라 셸이고, 이름도 그 관례(`rc` = run commands)를 따른다.

| 키 | 뜻 |
|---|---|
| `repo` | 워크트리를 딸 git repo |
| `worktree_dir` | 워크트리를 놓을 폴더. 각 워크트리는 `<worktree_dir>/<슬러그>` |
| `post_create()` | 워크트리 생성 직후 한 번. 선택 |

경로 해석은 **이 파일이 있는 디렉터리 기준**이고 `/` 로 시작할 때만 절대경로다 (`a` = `./a` = 상대). 호출자 cwd 와 무관하다. `~` 는 source 시점에 셸이 이미 펼치므로 따로 처리하지 않는다.

훅에 넘어가는 환경변수: `WT_PATH`, `WT_BRANCH`, `WT_PARENT`, `WT_REPO`, `WT_INTERACTIVE`.

> **`WT_INTERACTIVE` 가 `[ -t 1 ]` 가드를 대체한다.** 예전엔 mkwt 가 "터미널이면 tmux 창, 아니면 경로 출력" 을 스스로 정했다. 지금은 사용자가 앞에 있는지만 알려주고 판단은 훅이 한다 — 창 열기는 대화형일 때만, 알림은 언제나처럼 **동작마다 답이 다를 수 있기 때문**이다. mkwt 가 대신 정하면 후자가 불가능해진다.

훅의 stdout 은 stderr 로 돌려진다. 그래야 훅이 뭘 출력해도 `$(./mkwt.sh feat)` 로 잡는 경로가 오염되지 않는다. 훅이 실패해도 워크트리는 되돌리지 않고 경고만 낸다.

`.wtrc` 는 `-e`·`-u` 를 끈 채 source 된다. rc 파일의 종료 상태는 마지막 줄이 반환한 값일 뿐이고(`command -v tmux >/dev/null` 같은 탐색이 흔하다), 설정 파일이 미설정 환경변수를 읽는 것도 정상이라 `-u` 로 죽일 이유가 없다. 대신 **문법 오류는 `bash -n` 으로 source 전에 잡아** 명확히 실패시킨다 — 종료 상태로는 무해한 비-0 과 구분할 수 없는 실패다.

`.wtrc` 가 source 되므로 이름이 mkwt 와 같은 공간에 놓인다. 그래서 mkwt 내부는 전부 `mkwt_` 접두어를 쓰고, 접두어 없는 이름(`repo`, `worktree_dir`, `post_create`)만이 계약이다.

## wt merge 작동

```bash
<워크트리>/wt merge -m "feat: ..."                 # 기록된 부모로
<워크트리>/wt merge -m "feat: ..." --into=<브랜치>  # 다른 브랜치로
```

대상은 **스크립트 파일이 놓인 위치(`$0`)** 의 워크트리. `-m` 없으면 usage.

**merge 는 워크트리를 정리하지 않는다.** 정리는 `wt destroy` 의 일이다. 둘을 한 명령에 묶으면 플래그 하나가 "정리하지 마라" 와 "내 미커밋 작업을 살려둬라" 를 동시에 뜻하게 되는데, 예전 `wt-land --keep` 이 정확히 그 상태였다. 나누면 각 동사가 한 가지만 하고, 미커밋 작업을 버려도 되는지는 destroy 의 기존 안전장치가 판정한다.

**부모는 합쳐지지 않고 fast-forward 만 된다.** 어려운 일(이력 정리·충돌)은 전부 이 워크트리에서 먼저 끝내고, 부모에는 실패할 수 없는 연산만 남긴다. 그래서 부모 워크트리는 반쯤 병합된 상태가 될 수 없고, clean 검사도 필요 없다 — fast-forward 는 자기가 덮어쓸 작업만 거부하고 무관한 작업은 건드리지 않는다.

사전 검증: `--into` 값(없으면 `wt-parent`)으로 대상 결정, 자기 브랜치·부재면 거부. 대상이 체크아웃된 워크트리를 찾아둔다(없으면 옮길 파일이 없으니 ref 이동이 곧 fast-forward). 3-dot diff 가 비면 "올릴 것 없음" 으로 거부. `merge-tree` 용 git ≥ 2.38 요구.

1. **충돌 사전검사**: `git merge-tree --write-tree <대상> <feature>` 로 메모리상 병합. merge-tree 는 두 tip 과 merge base 만 읽으므로 squash 전에 돌려도 4의 rebase 결과를 그대로 예측한다 — 그래서 **아무것도 바꾸기 전에** 검사한다. 충돌이면 파일을 알리고 멈춤(작업트리·인덱스·ref 무손상).
2. **stash**: `stash push -u`. 커밋된 것만 올리기 위해서이자, 아래 이력 재작성으로부터 작업 상태를 지키기 위해서다.
3. **squash**: `reset --soft $(git merge-base <대상> <feature>)` → `commit -m`. merge base 를 **파일이 아니라 계산으로** 얻는 게 핵심 — 직전 merge 후엔 브랜치와 대상이 같은 커밋이라 merge base 가 곧 그 지점이 되고, 이미 올라간 작업은 범위 밖이라 다시 재생되지 않는다.
4. **rebase**: `rebase <대상>`. 여기서 충돌하면(1 이후 대상이 움직인 경우) `--abort` 로 되돌린다 — mid-rebase 의 detached HEAD 는 두 동사를 모두 무력화하므로 그 상태로 두지 않는다.
5. **fast-forward**: 대상 워크트리에서 `merge --ff-only`, 체크아웃 안 돼 있으면 조상 확인 후 `update-ref`.
6. **stash 복원**: `stash pop --index` 로 staged/unstaged 구분까지 되돌린다. 워크트리가 남으므로 언제나 복원한다.

2 이후의 실패는 브랜치를 원래 커밋으로 되돌리고(`reset --keep`) stash 를 복원한 뒤 죽는다. 3에서 `reset --soft` 는 성공했는데 `commit` 이 실패하면 커밋들이 staged 상태로 흩어지므로, 이 되돌림이 없으면 "아무것도 안 올라감" 이 브랜치를 먹는 결과가 된다. pop 이 충돌하면 stash 엔트리가 남으므로 작업은 회수 가능하고, 그 경로를 안내한다.

충돌 해결은 스크립트가 안 한다(판정 영역). 그 워크트리에서 `git merge <대상>` 으로 풀고 커밋 후 재실행. 그 merge 커밋은 다음 merge 의 squash 로 사라져 최종 이력은 단일 커밋 유지.

한 워크트리에서 여러 번 merge 할 수 있다(작업 → `wt merge` → 다음 작업 → `wt merge`). merge 마다 부모에 단일 커밋이 하나씩 쌓인다. **merge 직후 브랜치와 부모가 동일 커밋이 되므로 merge base 가 전진하고, 다음 merge 는 완전히 새 출발점에서 시작한다.** 이 수렴이 없으면(예전 `merge --squash` 방식) merge base 가 최초 분기점에 머물러, 부모가 이미 올라간 영역을 후속 수정했을 때 이미 반영된 작업이 충돌로 되살아난다.

## wt destroy 작동

```bash
<워크트리>/wt destroy          # 점검 후 안전하면 삭제, 아니면 키 발급
<워크트리>/wt destroy <키>     # 키 확인 후 강제 삭제
```

대상은 **스크립트 파일이 놓인 위치(`$0`)** 의 워크트리(호출자 cwd 아님). git-dir == git-common-dir 이면 메인 워크트리이므로 거부.

- **인자 없음**: 작업트리가 clean 하고 브랜치가 `wt-parent` 에 아무것도 더하지 않으면 곧바로 정리. 그 외는 거부 사유 + confirmation key 출력 후 멈춤.
  - 판정은 **부모 브랜치 자체**를 기준으로 하며, 분기 시점 SHA 를 기록해두지 않는다. 네 검사를 싼 것부터 돌려 하나라도 걸리면 안전:
    - ① 부모와 같은 커밋 — 갓 만든 워크트리, 그리고 방금 merge 한 워크트리(merge 가 브랜치와 부모를 같은 커밋으로 만든다).
    - ② 부모의 조상 — ①과 같은 상황에서 부모가 그 뒤로 나아간 경우.
    - ③ 3-dot diff 가 빔 — 이 브랜치가 분기 후 아무것도 바꾸지 않은 경우. **merge base 기준으로 재므로 "부모가 이미 갖고 있다" 를 뜻하지 않는다.** squash 로 올라간 브랜치는 merge base 가 분기점에 머물러 여기 안 걸린다.
    - ④ 병합해도 부모 트리가 그대로임 — `merge-tree --write-tree` 결과가 부모의 현재 트리와 같은지. 커밋 SHA 는 달라도 **내용이 이미 부모에 들어간** 경우(squash 병합)를 잡는 건 이 검사다. 부모가 그 뒤 다른 파일을 수정해도 계속 유효하다. git ≥ 2.38 이 없으면 발동하지 않고 키 경로로 넘어간다.
  - 기록된 분기점으로는 ①만 알 수 있어서, merge 후에도 "작업이 남아있다" 고 오판했다.
  - detached HEAD, `wt-parent` 없음·부모 브랜치 부재는 판정 불가로 보고 키 경로로 보낸다.
- **키 있음**: 현재 상태로 키 재계산해 비교. 일치하면 강제 삭제, 불일치(상태 변동)면 새 키 안내.
- **confirmation key**: `sha256(상태)` 앞 5 hex. 상태 = HEAD + `status --porcelain` + `diff HEAD` + untracked(비-ignored) 내용 해시. ignored 파일(node_modules 등)은 영향 없음.

## 폴더 구조

```
wt/
├── SKILL.md          # 영문 스킬 (init)
├── SKILL.ko.md       # 한국어 스킬 (페어)
├── README.md         # 본 문서
└── scripts/
    ├── wt-init.sh        # /wt 본문: <repo-rel> 받아 mkwt.sh 조립·드롭 + mkwt init + CLAUDE.md
    ├── mkwt-body.sh      # mkwt.sh 정적 본문 템플릿
    ├── wt.sh             # 워크트리용 merge(squash→rebase→부모 ff) / destroy (mkwt 가 임베드)
    └── worktree-claude.md # 워크트리용 CLAUDE.md 템플릿 (wt-init 이 그룹 폴더에 복사)
```
