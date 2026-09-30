# Semantic Scholar 검색

Semantic Scholar API 로 출판된 저널·학회 논문 (IEEE, ACM, Springer 등) 을 검색한다. 이 모드는 arXiv 에 없는 것을 채운다: 게재처 이름, 인용 수, DOI, 그리고 프리프린트가 없는 게재처 전용 논문이다.

## 목차

- 기본값
- Step 1: 요청 파싱
- Step 2: 검색
- Step 3: 논문 한 편 가져오기
- Step 4: arXiv 중복 표시
- Step 5: 결과 제시
- Step 6: 상세 요약
- Step 7: 보고
- 규칙

## 기본값

- **MAX_RESULTS**: 10.
- **SCRIPT**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py`
- **DEFAULT_FILTERS**: `--fields-of-study "Computer Science,Engineering" --publication-types JournalArticle,Conference`. 이 필터가 없으면 무관한 분야가 결과에 섞인다.

## Step 1: 요청 파싱

질의어인지 논문 식별자인지 식별한다:

- DOI: `10.1109/TWC.2024.1234567`
- Semantic Scholar ID: 16진수 40자
- arXiv: `ARXIV:2006.10685`
- Corpus: `CorpusId:219792180`

요청이 식별자면 Step 3 으로 건너뛴다.

## Step 2: 검색

관련도 검색 (기본):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" search "QUERY" --max MAX_RESULTS \
  --fields-of-study "Computer Science,Engineering" \
  --publication-types JournalArticle,Conference
```

대량 검색은 사용자가 인용 수나 날짜 정렬을 요청하거나 100개가 넘는 결과를 원할 때 쓴다:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" search-bulk "QUERY" --max MAX_RESULTS \
  --sort citationCount:desc \
  --fields-of-study "Computer Science" \
  --year "2020-"
```

쓸 만한 플래그 조합:

| 목적 | 플래그 |
|------|-------|
| 품질 좋은 저널 논문 | `--publication-types JournalArticle --min-citations 10` |
| CS/EE 논문, 최근 것 | `--fields-of-study "Computer Science,Engineering" --year "2022-"` |
| 기초적이고 영향력 큰 논문 | `search-bulk --sort citationCount:desc --fields-of-study "Computer Science"` |
| 학회 논문만 | `--publication-types Conference` |

`--venue` 는 게재처 이름이 정확히 맞아야 하고 이름이 부분만 맞으면 빈 결과를 돌려주므로, 출판 유형과 연구 분야로 거른다.

## Step 3: 논문 한 편 가져오기

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" paper "PAPER_ID"
```

PAPER_ID 는 Step 1 의 식별자 형식을 모두 받는다.

## Step 4: arXiv 중복 표시

결과마다 `externalIds.ArXiv` 를 확인한다:

- 있으면: 그 논문은 arXiv 에도 있다. arXiv ID 를 적어둔다. 다시 가져오지 않는다.
- 없으면: 게재처 전용 논문이다.

## Step 5: 결과 제시

```text
| # | Title | Venue | Year | Citations | Authors | Type |
|---|-------|-------|------|-----------|---------|------|
| 1 | Deep Learning Enabled... | IEEE Trans. Signal Process. | 2021 | 1364 | Xie et al. | Journal |
```

## Step 6: 상세 요약

논문마다, 수가 많으면 상위 5편에 대해:

```markdown
## [Title]

- **Venue**: [venue name] ([publicationVenue.type]: journal/conference)
- **Year**: [year] | **Citations**: [citationCount]
- **Authors**: [full author list]
- **DOI**: [doi link]
- **Fields**: [fieldsOfStudy]
- **TLDR**: [tldr.text, or the first sentence of the abstract when absent]
- **Abstract**: [abstract]
- **Open Access**: [openAccessPdf.url or "Not available"]
- **Also on arXiv**: [ArXiv ID if exists, else "No"]
```

## Step 7: 보고

- `Found N published papers for "query"`
- `Filters applied: ...`
- `N papers are venue-only (not on arXiv)`

## 규칙

- 사용자가 없애라고 하지 않는 한 기본 필터를 유지한다.
- 인용 수를 눈에 띄게 보여주고 결과 순위에 쓴다.
- 키 없이 쓰는 API 는 초당 1회 정도를 허용한다. 사용자가 `SEMANTIC_SCHOLAR_API_KEY` 를 설정하면 한도가 올라간다.
- API 에 접근할 수 없으면 오류를 보고하고 arXiv 모드를 제안한다.
