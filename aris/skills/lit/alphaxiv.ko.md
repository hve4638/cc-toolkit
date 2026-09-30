# AlphaXiv 단일 논문 조회

AlphaXiv 의 LLM 지향 요약으로 arXiv 논문 한 편을 빠르게 읽는다. 짧은 개요부터 LaTeX 소스까지 세 단계 깊이가 있다. 주제 검색용은 아니다.

## 기본값

- **OVERVIEW_URL**: `https://alphaxiv.org/overview/{PAPER_ID}.md`
- **ABS_URL**: `https://alphaxiv.org/abs/{PAPER_ID}.md`
- **ARXIV_SRC_URL**: `https://arxiv.org/src/{PAPER_ID}`
- **ALPHAXIV_UA**: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`. AlphaXiv 는 브라우저가 아닌 user agent 에 403 을 돌려줄 수 있다. 이 값이 막히기 시작하면 버전 숫자를 올린다.

## Step 1: 논문 ID 추출

다음 형태를 받아 `2401.12345` 같은 순수 ID 로 줄인다:

- `https://arxiv.org/abs/2401.12345` 또는 `v2` 가 붙은 형태
- `https://arxiv.org/pdf/2401.12345`
- `https://alphaxiv.org/overview/2401.12345`
- `https://alphaxiv.org/abs/2401.12345`
- `2401.12345` 또는 `2401.12345v2`

버전 접미사는 떼어낸다.

## Step 2: 개요 (티어 1)

```bash
curl -sL --max-time 15 -A "{ALPHAXIV_UA}" "https://alphaxiv.org/overview/{PAPER_ID}.md"
```

기계가 읽도록 쓰인 구조화된 리포트다. 사용자의 질문에 답이 되면 여기서 멈춘다.

요청이 실패하거나 (403 봇 차단, 404 아직 처리되지 않음) 빈 내용이 돌아오면 Step 3 으로 간다.

## Step 3: 전체 마크다운 (티어 2)

```bash
curl -sL --max-time 15 -A "{ALPHAXIV_UA}" "https://alphaxiv.org/abs/{PAPER_ID}.md"
```

사용자가 방법론 세부, 실험 결과, 개요가 건너뛴 절을 필요로 할 때 쓴다. 이것으로도 질문에 답이 안 되면 Step 4 로 간다.

## Step 4: LaTeX 소스 (티어 3)

수식, 증명, 부록 세부, 구현 세부에 쓴다. `https://arxiv.org/src/{PAPER_ID}` 를 `/tmp` 아래 임시 디렉터리로 내려받아 `.tar.gz` 를 풀고 `.tex` 파일 목록을 확인한다. 어느 플랫폼에서도 이 단계가 동작하도록 다운로드와 압축 해제는 Python 표준 라이브러리를 쓴다.

질문에 답하는 데 필요한 파일만 다음 순서로 읽는다:

1. 최상위 `*.tex` 파일
2. `\input{}` 이나 `\include{}` 로 끌어오는 파일
3. 질문과 관련된 부록, 표, 절

## Step 5: 제시

```markdown
## [Paper Title]

- **arXiv**: [PAPER_ID] - https://arxiv.org/abs/[PAPER_ID]
- **Source depth**: overview | abs | src

### Summary
[2-3 sentence summary]

### Key Points
- [point 1]
- [point 2]
- [point 3]

### Answer to Your Question
[Direct answer if the user asked a specific question]
```

사용자가 특정한 세부 하나를 물었다면 템플릿을 건너뛰고 바로 답한다.

## 규칙

- 이 모드는 PDF 가 아니라 마크다운과 LaTeX 를 읽는다. PDF 가 필요하면 다운로드가 있는 arXiv 모드를 제안한다.
- arXiv 소스 다운로드에서 HTTP 429 가 나오면 5 초 기다렸다가 한 번 재시도한다. 그래도 막히면 그 사실을 알리고 Progressive read 모드를 제안한다.
