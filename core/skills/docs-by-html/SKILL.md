---
name: docs-by-html
description: Write user-facing documents as classless HTML instead of Markdown. Use when producing a document for the user to read — a report, review, or writeup — or when the user asks for a document in HTML.
---

<docs_by_html_instruction>
Write documents meant to be shown to the user as HTML, not Markdown.

Good fit:
- Rich visual elements — SVG, tables, figures

Poor fit:
- Documents updated periodically
- Content that plain text expresses well enough

## classless css

Link the stylesheet and write classless: semantic HTML elements only — no class attributes, no inline styles, no custom CSS. The stylesheet handles all presentation.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/hve4638/classless.css@main/classless.css">
```

Before writing, read [example.html](./example.html) and follow its document shape.
</docs_by_html_instruction>

$ARGUMENTS
