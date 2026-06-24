# wt

현재 브랜치(HEAD)에서 분기한 git worktree 를 별도 폴더에 만드는 스킬. `/wt` 로 호출.

## 설계 의도

Claude Code 빌트인 워크트리는 항상 메인 브랜치에서 분기한다. wt 는 **현재 HEAD 에서 분기**해 작업 중 브랜치 위에 워크트리를 띄운다.

상정하는 워크플로: worktree 를 일회용 작업장으로 쓰며 막 커밋하다가, 끝나면 누적 결과를 부모 브랜치에 **squash 한 커밋**으로 올린다(`feat: ...` 단일 커밋, merge 흔적 없음). 그 정리를 각 워크트리가 스스로 책임지도록 wt-new 가 워크트리 안에 두 실행파일을 떨군다.

- `wt-land` — 부모에 squash-merge 후 워크트리 제거. 성공 경로.
- `wt-destroy` — 작업을 버리고 워크트리 제거. 폐기 경로.

스크립트는 세 개:
- `wt-new.sh` — 생성. `/wt` 본문이 호출
- `wt-land.sh` — land. 생성 시 각 워크트리로 복사됨
- `wt-destroy.sh` — 폐기. 생성 시 각 워크트리로 복사됨

## wt-new 작동

```bash
wt-new.sh <이름> [기준-ref]
```

위치 결정 (실행 위치 `$PWD` 를 프로젝트 루트로 본다):

| 조건 | 위치 |
|---|---|
| `$PWD` 가 repo 안 (git toplevel 존재) | `<repo부모>/<repo>.worktrees/<슬러그>/` |
| `$PWD` 가 repo 하나만 담은 컨테이너 | `<$PWD>/<repo>-<슬러그>/` |

전자는 부모가 여러 프로젝트를 담은 공용 공간일 수 있어 그룹 폴더로 묶고, 후자는 컨테이너가 이미 전용이라 평면 형제로 둔다. 후자의 repo 스캔은 linked worktree(git-dir ≠ git-common-dir)를 건너뛴다 — wt-new 가 만든 형제 워크트리들을 별도 repo 로 오인해 "multiple repos" 로 거부하면 병렬 생성이 깨지기 때문.

- 분기 기준은 `[기준-ref]`, 생략 시 `HEAD`. `git worktree add -b <슬러그> <대상> <기준>`.
- 슬러그는 공백·git 금지문자(`~^:?*[]`, `..`, `/`)를 정리하고 한글은 보존한다. 빈 슬러그는 거부.
- 같은 이름 브랜치나 기존 대상 폴더가 있으면 실패.
- stdout 에 새 워크트리 절대경로 한 줄만, 진행 메시지는 stderr.

생성 직후:
- `wt-land.sh`·`wt-destroy.sh` 를 워크트리 루트로 복사하고 실행권한 부여.
- 워크트리의 **per-worktree git dir**(`$(git rev-parse --absolute-git-dir)`, 작업트리 밖)에 메타 두 줄을 기록:
  - `wt-base` = 분기 시점 SHA. wt-destroy 가 "손 안 댄 워크트리" 를 가리는 데 씀.
  - `wt-parent` = land 대상 부모 브랜치명. 명시적 `[기준-ref]` 를 줬으면 빈 값(부모 모호 → land 시 `--into` 강제).
- 그 repo 의 `$GIT_COMMON_DIR/info/exclude`(전 워크트리 공유) 에 `/wt-land`·`/wt-destroy` 를 등록해 `git status` 에서 숨긴다. 이 exclude 는 메인 포함 모든 워크트리의 루트 동명 파일에 적용된다 (git 이 공용 exclude 만 읽어 per-worktree 스코핑은 불가).

## wt-land 작동

```bash
./wt-land -m "feat: ..."                 # 기록된 부모로
./wt-land -m "feat: ..." --into=<브랜치>  # 다른 브랜치로
```

대상은 **스크립트 파일이 놓인 위치(`$0`)** 의 워크트리. `-m` 없으면 usage.

1. 대상 브랜치 결정: `--into` 값, 없으면 `wt-parent`. 자기 브랜치거나 존재 안 하면 거부.
2. 대상이 체크아웃된 워크트리를 `git worktree list --porcelain` 에서 찾는다. 없으면 거부(체크아웃 필요), dirty 면 거부(섞임 방지).
3. **충돌 사전검사**: `git merge-tree --write-tree <대상> <feature>` 로 메모리상 병합. exit 0=clean, 비0=충돌. 충돌이면 충돌 파일을 알리고 멈춤 — 작업트리·인덱스·ref 아무것도 안 건드림(dangling tree 객체만 남고 gc 대상).
4. clean 이면 대상 워크트리에서 `git merge --squash <feature>` → `git commit -m`. squash 라 단일 커밋(merge 부모 없음). 올릴 게 없으면(대상과 차이 없음) 거부.
5. land 성공 = 내용이 대상에 들어감이 확정. 그래서 키 없이 `worktree remove --force` → `branch -D` → `prune` → 빈 그룹 폴더 `rmdir`.

충돌 해결은 스크립트가 안 한다(판정 영역). 사용자/에이전트가 그 워크트리에서 `git merge <대상>` 으로 풀고 커밋 후 재실행. 그 merge 커밋은 다음 land 의 squash 로 사라져 최종 이력은 단일 커밋 유지.

## wt-destroy 작동

```bash
./wt-destroy          # 점검 후 안전하면 삭제, 아니면 키 발급
./wt-destroy <키>     # 키 확인 후 강제 삭제
```

대상은 **스크립트 파일이 놓인 위치(`$0`)** 의 워크트리 (호출자 cwd 아님). 어느 디렉터리에서 불러도 같은 워크트리를 지운다 — 워크트리 밖에서 경로로 부르면 호출 셸이 삭제된 폴더에 갇히지 않는다. git-dir == git-common-dir 이면 메인 워크트리이므로 거부.

### 인자 없음 — 자동삭제는 "손 안 댄" 경우만

`wt-base`(분기 시점) 와 비교해 **HEAD 가 그대로 + 작업트리 clean** 이면(분기 후 커밋도 변경도 0) 곧바로 정리. 그 외(커밋이 하나라도 있거나 미커밋·untracked 변경이 있으면)는 아무것도 안 건드리고 거부 사유 + confirmation key 를 출력하고 멈춘다.

이게 기존 "타 브랜치에 merge 됐나(SHA 도달성)" 자동인식을 대체한다. 그 판정은 squash 워크플로에서 항상 "안 합쳐짐" 으로 보여 무의미했다(squash 는 새 SHA 라 도달 불가). 합친 작업의 정리는 이제 wt-land 가 직접 수행하니 wt-destroy 는 순수 폐기 경로로 좁혔다.

### 키 있음

현재 상태로 키를 다시 계산해 인자와 비교. 일치하면 `worktree remove --force` + `branch -D`. 불일치(상태 변동)면 새 키 안내 후 멈춤.

### confirmation key

`sha256(상태)` 의 앞 5 hex. 상태 = HEAD + `status --porcelain` + `diff HEAD` + untracked(비-ignored) 파일 내용 해시. 커밋·tracked 변경·untracked 내용 변경 어디서든 바뀌고, ignored 파일(node_modules 등)은 영향이 없다.

## 폴더 구조

```
wt/
├── SKILL.md          # 영문 스킬
├── SKILL.ko.md       # 한국어 스킬 (페어)
├── README.md         # 본 문서
└── scripts/
    ├── wt-new.sh     # 워크트리 생성 + land/destroy 드롭 + 메타 기록
    ├── wt-land.sh    # 부모에 squash-merge 후 정리 (생성 시 각 워크트리로 복사)
    └── wt-destroy.sh # 워크트리 폐기 (생성 시 각 워크트리로 복사)
```
