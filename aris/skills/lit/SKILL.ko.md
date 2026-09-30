---
name: lit
description: arXiv, Semantic Scholar, AlphaXiv, DeepXiv 로 연구 논문을 찾고 읽고 개괄한다.
disable-model-invocation: true
argument-hint: "[topic, paper id/url, or request]"
---

# lit

## 모드

각 모드는 이 스킬 디렉터리 안에 자기 문서를 가진다.

| 모드 | 문서 | 요청이 다음과 같을 때 고른다 |
|------|------|------------------------------|
| arXiv 검색 | `arxiv.md` | 프리프린트, 최신 연구, 또는 로컬 논문 폴더로 PDF 다운로드를 원할 때 |
| 출판 논문 검색 | `semantic-scholar.md` | 저널이나 학회 논문, 인용 수, 또는 IEEE/ACM/Springer 게재처를 원할 때 |
| 논문 한 편 | `alphaxiv.md` | arXiv ID 나 URL 하나를 주고 그 논문의 내용을 물을 때 |
| 단계적 읽기 | `deepxiv.md` | 전체 PDF 를 읽지 않고 논문의 한 절을 읽거나 인기 논문을 보고 싶을 때 |
| 서베이 | `survey.md` | 관련 연구, 문헌 리뷰, 연구 지형, 또는 여러 소스에 걸쳐 "X 에 관해 무엇이 있는지" 를 물을 때 |

## 모드 선택

1. 요청이 비어 있거나 이 스킬로 무엇을 할 수 있는지 묻는 것이면, 각 모드를 한 줄씩 (입력과 산출물) 설명하고 어느 것을 원하는지 묻는다. 거기서 멈춘다.
2. 요청이 소스를 지목하거나 위 표의 한 행에만 정확히 맞으면 그 모드를 쓴다.
3. 요청이 다른 지시 없이 arXiv ID 나 URL 하나이면 논문 한 편 모드를 쓴다.
4. 그 외에는 모드, 소스, 연도 범위, 결과 개수를 한 줄로 적은 뒤 멈추고 사용자 승인을 기다린다. 검색과 스크립트는 승인 뒤에 시작한다.

규칙 4 의 한 줄 예시:

```text
Plan: Survey. Sources: local papers/, arXiv, Semantic Scholar. Window: 2022 to now, plus a few foundational papers. Up to 10 per source. Proceed?
```

## 모드 실행

고른 문서를 Read 도구로 읽은 뒤 그대로 따른다. 경로는 이 스킬 디렉터리에 파일 이름을 붙인 것이다.

## 모든 모드의 규칙

- 모든 논문에 arXiv ID 나 DOI 를 표시한다.
- 모든 ID, DOI, 제목은 검색 결과나 사용자 입력에서 가져온다. 모르는 항목은 비워 두고 모른다고 표시한다.
- 모든 표에서 프리프린트와 동료 심사 논문을 구분한다.

문헌 요청: $ARGUMENTS
