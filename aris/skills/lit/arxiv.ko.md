# arXiv 검색과 다운로드

arXiv 를 주제나 ID 로 검색하고, 결과를 나열하고, 요청이 있으면 PDF 를 받고, 요약한다.

## 기본값

- **PAPER_DIR**: 현재 프로젝트의 `papers/`. 없으면 만든다.
- **MAX_RESULTS**: 10.
- **SCRIPT**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py`

## Step 1: 요청 파싱

질의어나 arXiv ID 만 있는 요청인지 식별한다. ID 는 `2301.07041` 이나 `cs/0601001` 같은 모양이다. `v2` 같은 버전 접미사는 떼어낸다.

요청이 ID 면 Step 3 으로 건너뛴다.

## Step 2: 검색

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" search "QUERY" --max MAX_RESULTS
```

스크립트는 id, 제목, 저자, 초록, 출판일, 카테고리, URL 을 담은 JSON 을 출력한다. 결과는 표로 제시한다:

```text
| # | arXiv ID   | Title               | Authors        | Date       | Category |
|---|------------|---------------------|----------------|------------|----------|
| 1 | 2301.07041 | Attention Is All... | Vaswani et al. | 2017-06-12 | cs.LG    |
```

## Step 3: 논문 한 편 가져오기

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" search "id:ARXIV_ID" --max 1
```

제목, 저자 전원, 카테고리, 초록 전문, 출판일, PDF URL, 초록 URL 을 보여준다.

## Step 4: PDF 다운로드

사용자가 다운로드를 요청했을 때만 한다.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" download ARXIV_ID --dir PAPER_DIR
```

스크립트가 파일을 검증하고, 다운로드 사이에 기다리고, HTTP 429 에 재시도하고, 이미 있는 PDF 는 건너뛴다. 그 출력을 그대로 보고한다:

- `Downloaded: papers/2301.07041.pdf (842 KB)`
- `Skipped: papers/2301.07041.pdf already exists`
- 스크립트가 출력한 오류 메시지

## Step 5: 요약

사용자가 물은 논문마다:

```markdown
## [Title]

- **arXiv**: [ID] - [abs_url]
- **Authors**: [full author list]
- **Date**: [published]
- **Categories**: [cs.LG, cs.AI, ...]
- **Abstract**: [full abstract]
- **Key contributions** (from the abstract):
  - [contribution 1]
  - [contribution 2]
  - [contribution 3]
- **Local PDF**: papers/[ID].pdf (if downloaded)
```

## Step 6: 보고

- `Found N papers for "query"`
- 다운로드마다 한 줄
- 경고가 있으면 함께: rate limit, 파일 크기 미달, 이미 존재

## 규칙

- arXiv API 에 접근할 수 없으면 오류를 보고하고 웹 검색을 쓰는 서베이 모드를 제안한다.
