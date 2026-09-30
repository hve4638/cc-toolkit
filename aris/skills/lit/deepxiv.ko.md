# DeepXiv 검색과 점진적 읽기

DeepXiv 로 오픈 액세스 논문을 검색하고, brief, 섹션 맵, 섹션 하나의 단계로 나눠 읽는다. 논문의 일부만 필요할 때 쓴다.

## 기본값

- **MAX_RESULTS**: 10.
- **SCRIPT**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py`. `deepxiv` CLI 를 감싼 스크립트다.

## 준비

DeepXiv 는 선택이다. CLI 가 없으면 사용자에게 알린다:

```bash
pip install deepxiv-sdk
```

처음 쓸 때 `deepxiv` 가 무료 토큰을 발급받아 `~/.env` 에 저장한다.

## Step 1: 요청 해석

질의인지 arXiv ID 인지와 사용자가 원하는 깊이를 파악한다:

- 주제로 검색
- 논문 한 편의 brief 요약
- 논문 한 편의 섹션 맵
- 논문 한 편의 지정된 섹션 하나
- 트렌딩 논문, 기간은 7, 14, 30 일 중 하나
- DeepXiv 웹 검색

깊이를 밝히지 않은 arXiv ID 요청이면 brief 를 쓴다.

## Step 2: 답이 되는 가장 작은 명령 실행

검색:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" search "QUERY" --max MAX_RESULTS
```

Brief:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" paper-brief ARXIV_ID
```

섹션 맵:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" paper-head ARXIV_ID
```

섹션 하나:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" paper-section ARXIV_ID "SECTION_NAME"
```

트렌딩:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" trending --days 7 --max MAX_RESULTS
```

웹 검색:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" wsearch "QUERY"
```

## Step 3: 제시

검색 결과는 이렇게 보여준다:

```text
| # | ID | Title | Year | Citations | Notes |
|---|----|-------|------|-----------|-------|
```

논문을 읽은 경우에는 제목, arXiv ID, 저자, 확인되면 게재처나 날짜, TLDR 또는 초록 요약, 그리고 사용자가 다음으로 요청할 수 있는 깊이를 보여준다.

## Step 4: 필요할 때만 더 깊이

진행 순서는 검색, brief, 섹션 맵, 섹션 하나이고, 어느 것으로도 질문에 답이 안 될 때만 논문 전체를 읽는다.

## 규칙

- DeepXiv 를 쓸 수 없으면 설치 명령을 알려주고 arXiv 모드를 제안한다.
- 어떤 결과가 Semantic Scholar 로도 찾아지는 정식 출판 논문이라면, 더 풍부한 게재처 메타데이터를 최종 요약에 남긴다.
