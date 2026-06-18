---
name: init-context
disable-model-invocation: true
description: "Use this skill via `/init-context` to (re)generate a CLAUDE.md by composing the master skeleton, every active hve plugin's `docs/AGENTS.partial.md`, and selected rule/lang fragments. Run it when bootstrapping or refreshing project/global agent context to avoid hand-maintained drift, missed plugin guidance, and stale agent-routing tables. Idempotent via SHA-256 input hashing; writes `~/.claude/CLAUDE.md` (Global) or `<cwd>/CLAUDE.md` (Project)."
---

<init_context_instruction>
# init-context

`~/.claude/CLAUDE.md` (Global 모드) 또는 `<cwd>/CLAUDE.md` (Project 모드) 를 마스터 골격 + 활성 플러그인의 `docs/AGENTS.partial.md` + 사용자가 선택한 rule-* / lang-* fragment 로 합성해 만든다. sub-agent 에 위임하지 않고 직접 작성한다.

---

## 1. 모드 결정

`process.cwd() === os.homedir()` 정확 일치 시 **자동 Global**. 그 외엔 AskUserQuestion 으로 사용자 선택.

옵션:
- `Global`: `~/.claude/CLAUDE.md` 에 활성 hve 플러그인 가이드 주입
- `Project`: `<cwd>/CLAUDE.md` 에 프로젝트 컨텍스트 합성

---

## 2. 플러그인 검출 + 인터뷰

### 검출 (스크립트)

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/init-context/scripts/detect-active-plugins.mjs" --mode=<global|project>
```

스크립트가 JSON 으로 출력: `[{name, owner, installPath, hasPartial}, ...]`

내부 매칭 규칙:
- `Global`: `~/.claude/settings.json` + `~/.claude/settings.local.json` 의 `enabledPlugins` 머지 → `~/.claude/plugins/installed_plugins.json` 에서 `scope === "user"` 매칭
- `Project`: `<cwd>/.claude/settings.json` + `<cwd>/.claude/settings.local.json` 머지 (없으면 빈 목록) → `installed_plugins.json` 에서 `(scope === "project" || scope === "local")` AND `projectPath === <cwd>` 매칭

`hasPartial === true` 인 플러그인만 합성 후보.

### 인터뷰

후보를 AskUserQuestion (multiSelect) 로 제시. 사용자가 합성에 포함할 것 선별.

후보 0 개면 이 단계 skip (플러그인 컨텐츠 없이 진행).

---

## 3. rule 인터뷰

`${CLAUDE_PLUGIN_ROOT}/skills/init-context/fragments/rule-*.md` 전체를 직접 스캔. 각 fragment 의 `description` 을 라벨로 AskUserQuestion (multiSelect) 제시. **condition 무시** — 사용자가 자유 선택.

---

## 4. lang 인터뷰

### Global 모드

AskUserQuestion (단일):
- `적용 안 함`: 권고문 1줄 출력 ("각 프로젝트의 CLAUDE.md 에 두는 것을 권장")
- `Global CLAUDE.md 에 추가`: 전체 lang-* fragment multiSelect

### Project 모드

#### 4-1. 코드베이스 언어 탐색 (스크립트)

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/init-context/scripts/detect-languages.mjs"
```

JSON 출력: `[{lang, evidence, fragmentName}, ...]` (예: `[{lang:"python", evidence:"pyproject.toml + 23 *.py", fragmentName:"lang-python"}]`)

#### 4-2. 사용자에게 보고 + 선택

발견된 언어를 1~2줄로 보고. AskUserQuestion (단일):
- `발견된 언어 규칙 추가`: 발견된 모든 lang-* fragment 자동 포함
- `추가 안 함`
- `직접 선택`: 전체 lang-* fragment multiSelect

---

## 5. 충돌 검사 (정책 기반)

선택된 fragment 들의 frontmatter `conflicts_with` 상호 매칭 검사:
- 매칭 없음 → 다음 단계
- 매칭 있음 → AskUserQuestion 으로 1회 질문, 사용자 결정 후 진행 (자동 결정 금지)

톤·중복 충돌은 검사 안 함 — 정책 충돌만.

---

## 6. 합성

### 6-1. 마스터 골격 (skeleton) 로드

`${CLAUDE_PLUGIN_ROOT}/skills/init-context/AGENTS.skeleton.md` 읽어 태그 순서 결정.

### 6-2. 플러그인 컨텐츠 수집

선택된 각 플러그인의 `<installPath>/docs/AGENTS.partial.md` 읽어 XML 태그별로 분해.

### 6-3. Same-tag 합성

마스터 태그 순서대로:
- 같은 태그에 여러 플러그인이 기여하면 한 섹션에 모은다.
- 태그 내 컨텐츠 순서는 너의 재량이다. 논리적 묶음·중요도로 결정한다.
- 기여 컨텐츠 없는 태그는 placeholder 주석으로 자리 유지한다.
  ```
  <!-- <skills></skills> -->
  ```

### 6-4. rule / lang 영역

```
# Rules

## <fragment name>
(fragment 본문, frontmatter 제외)

# Languages

## <fragment name>
(fragment 본문, frontmatter 제외)
```

### 6-5. 입력 해시 계산

다음을 정규화된 JSON 으로 직렬화 후 SHA-256:
```json
{
  "plugins": [{name, installPath, partialBody}, ...],
  "selections": {
    "plugins": [...selected names],
    "rules": [...selected fragment names],
    "langs": [...selected fragment names]
  }
}
```

Bash 로 계산:
```bash
echo -n '<직렬화된 JSON>' | sha256sum
```

또는 임시 파일 작성 후 `sha256sum <file>`.

---

## 7. 멱등성 판정

기존 산출물의 `<!-- HVE:HASH:sha256-... -->` 추출 — **반드시 `cat` 으로** (Read 도구는 HTML 주석 strip).

```bash
cat ~/.claude/CLAUDE.md  # 또는 ./CLAUDE.md
```

비교:
- 해시 일치 → "변경 없음" 보고하고 종료. write skip.
- 해시 불일치 (또는 마커 없음) → 산출 진행.

---

## 8. 산출

### 8-1. 백업

기존 산출물 존재 시 `.bak` 으로 이동:
- `~/.claude/CLAUDE.md` → `~/.claude/CLAUDE.md.bak`
- `<cwd>/CLAUDE.md` → `<cwd>/CLAUDE.md.bak`

기존 `.bak` 이 이미 있으면 AskUserQuestion 으로 처리 방법 질문 (덮어쓰기 / 다른 이름 / 중단).

### 8-2. Global 모드 — 마커 블록

```
<!-- HVE:START -->
<!-- HVE:VERSION:1 -->
<!-- HVE:GENERATED-AT:<ISO-8601 UTC> -->
<!-- HVE:PLUGINS: <name1>, <name2>, ... -->
<!-- HVE:HASH:sha256-<hex> -->

# hve marketplace

(XML 태그 합성 본문 — 마스터 순서)

# Rules

(rule 본문)

# Languages

(lang 본문, 선택 시)

<!-- HVE:END -->
```

블록 위치:
- 기존 마커 없음 (또는 파일 자체 없음) → 파일 **최상단 prepend** (또는 마커 블록만으로 새 파일 생성)
- 기존 마커 있음 → 마커 위치 그대로, 안만 교체. 마커 바깥 (위·아래) 사용자 컨텐츠 보존.

### 8-3. Project 모드 — 전체 파일

```
# CLAUDE.md

<!-- HVE:VERSION:1 -->
<!-- HVE:GENERATED-AT:<ISO-8601 UTC> -->
<!-- HVE:PLUGINS: ... -->
<!-- HVE:HASH:sha256-... -->

(XML 태그 합성 본문)

# Rules
...

# Languages
...
```

전체 교체.

---

## 9. 보고

1~2줄 요약:
- 모드 (Global/Project)
- 포함된 플러그인 수, rule 수, lang 수
- 백업 파일 경로 (있는 경우)
- 본문 변경 여부 (write 했는지 / skip 했는지)

---

## 원본 검수 — `cat` 필수

기존 산출물의 마커·메타 주석을 확인할 때 **Read 도구는 HTML 주석을 strip** 한다. **반드시 Bash `cat` 사용.**

```bash
cat ~/.claude/CLAUDE.md
cat ./CLAUDE.md
```

Node 스크립트는 `fs.readFile` 직접 사용 → 영향 없음.

---

## 빈 결과 처리

플러그인 0 + rule 0 + lang 0 → 합성 본문이 모두 placeholder 주석뿐. 이 경우:
- 1줄 보고: "선택된 컨텐츠 없음. 산출물 만들지 않음."
- 파일 갱신 skip

---

## 주의사항

마커 안 본문은 다음 실행 시 덮어쓴다. 사용자에게 추가 메모는 마커 바깥에 두도록 안내한다.

`cwd === os.homedir()` 인 경우 항상 Global 모드로 진입한다. home 디렉터리에서는 Project 모드 우회가 불가능하다.

XML 태그는 단순 컨벤션만 사용한다. nested, 속성, CDATA 는 파싱하지 않는다.

태그 내 정렬은 너의 재량이라 출력이 미세하게 달라질 수 있다. 멱등성 판정은 입력 해시 기준이므로 write skip 동작에 영향이 없다.

</init_context_instruction>

$ARGUMENTS
