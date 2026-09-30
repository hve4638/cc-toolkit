# 문헌 조사

한 주제의 관련 연구를 여러 출처에서 찾고, 후보 논문이 실재하는지 전부 확인한 뒤, 전체 지형을 표와 서술로 종합한다. 통신 분야 주제라면 아래 절의 게재처 우선순위를 적용한다.

## 목차

- 기본값
- Step 0: 사용자가 이미 가진 것
- Step 1: 외부 검색
- 통신 분야 주제의 게재처 우선순위
- Step 2: 후보가 실재하는지 확인
- Step 3: 논문별 추출
- Step 4: 종합
- Step 5: 출력
- Step 6: 저장
- 규칙

## 기본값

- **PAPER_LIBRARY**: 로컬 PDF. `papers/`, `literature/`, 그리고 프로젝트 `CLAUDE.md` 의 `## Paper Library` 제목 아래에 사용자가 적어둔 경로 순으로 확인한다.
- **MAX_LOCAL_PAPERS**: 20. 더 많이 발견되면 파일명 관련도로 우선순위를 매긴다.
- **SOURCES**: 로컬, arXiv, Semantic Scholar, 웹. DeepXiv 는 사용자가 요청할 때만 합류한다.
- **WINDOW**: 사용자가 연도 범위를 주지 않았으면 최근 묶음 (2022 년부터 현재까지) 과 작은 기초 묶음 (2022 년 이전) 을 모은다.
- **MAX_PER_SOURCE**: 10.
- **DOWNLOAD**: 끔. 사용자가 요청하면 가장 관련 있는 arXiv PDF 를 최대 5 편까지 PAPER_LIBRARY 에 내려받는다.
- **SCRIPTS**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/` 안에 `arxiv_fetch.py`, `semantic_scholar_fetch.py`, `deepxiv_fetch.py`, `verify_papers.py` 가 있다.

## Step 0: 사용자가 이미 가진 것

외부로 나가기 전에 로컬 라이브러리를 먼저 찾는다.

1. `papers/**/*.pdf` 와 `literature/**/*.pdf` 를 glob 하고, CLAUDE.md 에 적힌 경로가 있으면 함께 본다.
2. 파일명이나 첫 페이지가 주제와 맞는 것을 MAX_LOCAL_PAPERS 까지 남긴다.
3. 각 PDF 의 앞 3 페이지를 읽는다. 제목, 저자, 연도, 핵심 기여, 관련도를 뽑는다.

라이브러리 경로가 하나도 없으면 다음 단계로 넘어가기 전에 그 사실을 알린다:

```text
WARN: no local PDFs found in papers/, literature/, or a configured paper library. Add a "## Paper Library" heading to CLAUDE.md followed by the directory path to include yours.
```

## Step 1: 외부 검색

켜져 있는 출처를 각각 돌린다. Step 0 에서 이미 찾은 논문은 건너뛴다. 스크립트가 실패하면 그 오류를 출력하고 나머지 출처로 계속한다. 모든 출처가 실패하면 멈추고 보고한다.

arXiv:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" search "QUERY" --max 10
```

Semantic Scholar:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" search "QUERY" --max 10 \
  --fields-of-study "Computer Science,Engineering" \
  --publication-types "JournalArticle,Conference"
```

DeepXiv 는 요청받았을 때만:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" search "QUERY" --max 10
```

웹: arXiv, Semantic Scholar, Google Scholar, 출판사 페이지를 WebSearch 로 찾는다. 블로그 글이나 3 차 요약보다 1 차 페이지 (출판사, DOI, 공식 학회 사이트, 저자가 올린 사본) 를 우선한다.

병합 규칙:

- 논문 대조는 arXiv ID 를 먼저, DOI 를 다음, 정규화한 제목을 마지막으로 쓴다.
- 같은 논문이 arXiv 와 Semantic Scholar 양쪽에 있고 Semantic Scholar 에 게재처가 있으면, 그쪽의 게재처, 인용 수, DOI 를 쓴다. PDF 용으로 arXiv 링크는 남긴다.
- Semantic Scholar 에 게재처가 없으면 arXiv 레코드를 프리프린트로 남긴다.
- `externalIds.ArXiv` 가 없는 Semantic Scholar 결과는 게재처에만 있는 논문이다. 남긴다.

선택적 다운로드, 사용자가 요청했을 때만:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" download ARXIV_ID --dir papers/
```

관련도 상위 5 편만 받는다.

## 통신 분야 주제의 게재처 우선순위

주제가 무선, 셀룰러, 위성이나 NTN, Wi-Fi, 라우팅, 스케줄링, 빔포밍, 전송률이나 링크 적응, 채널 추정, 전송 프로토콜, 혼잡 제어, 크로스 레이어 설계일 때 이 절을 적용한다.

최상위 티어부터 아래로 내려가며 검색한다. 상위 티어가 빈약하거나 주제가 분명히 다른 곳에 발표되는 경우에만 범위를 넓힌다. 티어는 느슨한 순위이며, 사용자가 "top venues only" 라고 말할 때만 Tier A 를 강한 필터로 쓴다.

Tier A. 저널: IEEE JSAC, IEEE/ACM ToN, IEEE TWC, IEEE TCOM. 학회: ACM SIGCOMM, USENIX NSDI, ACM MobiCom, ACM CoNEXT, IEEE INFOCOM.

Tier B. 저널: IEEE TVT, IEEE WCL, IEEE Communications Letters, Computer Networks, Computer Communications, Ad Hoc Networks, Physical Communication. 학회: IEEE ICC, IEEE GLOBECOM, IEEE WCNC, IEEE PIMRC, ACM MobiHoc.

Tier C. 그 밖의 관련 IEEE transactions, Elsevier 저널, ACM 학회와 워크숍, 그리고 위성, 광, 차량, IoT, 항공, 엣지 같은 주제별 게재처.

출판 정책:

- 동료 심사를 거친 저널과 주요 학회를 우선한다.
- 워크숍 논문은 `workshop` 으로, arXiv 에만 있거나 저자가 올린 판본은 `preprint` 로 표기한다.
- 프리프린트와 정식 판본이 둘 다 있으면 정식 판본을 먼저 인용한다.
- 전송 계층의 rate control 과 PHY/MAC 의 rate adaptation 이 한 묶음에 들어가면 그 사실을 밝힌다.

## Step 2: 후보가 실재하는지 확인

Step 0 과 1 에서 나온 모든 후보에 대해 분석 전에 이것을 돌린다.

```bash
mkdir -p .lit
cat > .lit/candidates.json <<'JSON'
[
  {"id": "p1", "arxiv_id": "2307.03172", "doi": null, "title": "Lost in the Middle"},
  {"id": "p2", "arxiv_id": null, "doi": "10.1145/...", "title": "..."},
  {"id": "p3", "arxiv_id": null, "doi": null, "title": "Some Paper Title"}
]
JSON
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/verify_papers.py" \
  --input .lit/candidates.json --output .lit/verified.json
```

스크립트는 arXiv, 그다음 CrossRef, 그다음 Semantic Scholar 제목 퍼지 검색 순으로 확인한다. 판정과 논문별 상태는 `.lit/verified.json` 에서 읽는다.

- 모르는 필드는 `null` 로 둔다. 스크립트가 제목 검색으로 넘어간다.
- 출력의 모든 논문에 `verified (via arxiv|crossref|s2)`, `UNVERIFIED (reason)`, `verify_pending` 중 하나를 붙인다.
- 확인되지 않은 것을 포함해 모든 후보는 태그와 함께 출력에 남는다.
- 판정이 높은 환각률을 경고하면 그 경고를 그대로 보여주고 더 좁은 질의를 제안한다.
- 사용자는 `ARIS_VERIFY_EMAIL=you@institution.edu` 를 설정해 CrossRef 요청 제한을 풀 수 있다.

## Step 3: 논문별 추출

`.lit/verified.json` 의 모든 논문에 대해, 상태와 무관하게 다음을 기록한다:

- **Problem**: 다루는 공백
- **Method**: 핵심 기술 기여를 1 ~ 2 문장으로
- **Results**: 주요 수치나 주장
- **Limitation**: 다루지 않는 것
- **Relevance**: 사용자의 주제와 어떻게 이어지는지
- **Source**: local, arxiv, semantic-scholar, deepxiv, web 중 하나
- **Verification**: Step 2 에서 붙인 태그

일반적인 말바꿈보다 구체적인 수치, 가정, 문제 정의를 앞세운다.

## Step 4: 종합

- 검색 순서가 아니라 기술적 접근으로 논문을 묶는다.
- 기초 연구와 최신 연구, 정식 판본과 프리프린트, 사용자가 이미 갖고 있던 것과 새로 나온 것을 구분한다.
- 이 분야가 합의한 지점과 갈리는 지점을 짚는다.
- 사용자의 연구가 메울 수 있는 공백을 짚는다. 근거가 약하면 약하다고 말한다.

## Step 5: 출력

```text
| Paper | Venue | Year | Method | Key Result | Limitation | Relevance | Source | Verified |
|-------|-------|------|--------|------------|------------|-----------|--------|----------|
```

통신 분야 주제라면 `Year` 뒤에 `Layer` 와 `Scenario` 열을 더한다.

표 뒤에는 다음 순서로 3 ~ 5 문단을 쓴다:

1. 이 분야가 주로 풀려는 문제
2. 논문들이 2 ~ 4 개 접근으로 묶이는 방식
3. 사용자가 이미 갖고 있던 것과 새로 드러난 것
4. 근거가 강한 지점과 약한 지점
5. 남아 있는 연구 공백

마지막에 짧은 "Practical takeaway" 를 붙인다: 지금 우세한 접근, 포화돼 보이는 방향, 그리고 유망한 열린 방향.

## Step 6: 저장 (요청받았을 때만)

- PDF 를 PAPER_LIBRARY 에 저장한다.
- 표와 서술을 사용자가 지정한 파일에 쓴다.

## 규칙

- 모든 논문은 저자, 연도, 게재처와 함께 인용한다.
- 사용자 자신의 출처를 먼저 보되, 그것이 외부 검증을 대신하게 두지 않는다.
- 주제가 여러 계층에 걸쳐 있으면, 문헌 자체가 계층별로 갈려 있다는 점을 말한다.
