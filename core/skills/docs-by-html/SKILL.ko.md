---
name: docs-by-html
description: 사용자에게 보여줄 문서를 Markdown 대신 classless HTML 로 작성. 사용자가 읽을 문서 (보고서·리뷰·정리 글) 를 만들 때, 또는 HTML 문서를 요청받을 때 사용.
---

<docs_by_html_instruction>
사용자에게 보여줄 목적의 문서는 Markdown 이 아닌 HTML 로 작성한다.

적합:
- svg, 표, 그림 등 다양한 시각적 요소

비적합:
- 주기적으로 갱신되는 문서
- 텍스트만으로 충분한 표현 가능

## classless css

스타일시트를 link 하고 classless 로 작성한다: 시맨틱 HTML 요소만 사용 — class 속성, 인라인 스타일, 커스텀 CSS 금지. 표현은 전부 스타일시트가 담당한다.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/hve4638/classless.css@main/classless.css">
```

작성 전에 [example.html](./example.html) 을 읽고 그 문서 골격을 따른다.

## 산출물 위치

원본 마크다운 파일이 있다면 원본과 동일한 위치, 새로 생성된 파일이라면 해당 디렉토리에서 관례적인 위치(프로젝트 루트, docs/, report/ 등)에 둔다.

</docs_by_html_instruction>

$ARGUMENTS
