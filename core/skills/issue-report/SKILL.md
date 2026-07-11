---
name: issue-report
description: "Write an issue report — a self-contained work order that a zero-context Claude session on a new branch can execute. Use when the user asks to distill the current session's findings into an issue report for another branch or session."
argument-hint: "[issue topic]"
---

<issue_report_instruction>
# issue-report

Distill the current session's findings on one issue into a work order. The output is a single self-contained report that a zero-context Claude session on a new branch can read and start work from.

## Workflow

### 1. Scope

Take the issue topic from the user's request and cover only that issue. Draw content from what the current session already established; explore the codebase only to verify or fill in file:line evidence.

### 2. Destination

Use the path the user named. Otherwise place the file where the project keeps planning documents (an existing `docs/todo/`, `_docs/`, or similar); if no such location exists, use `docs/issues/<slug>.md`. State the chosen path when reporting.

### 3. Write

Follow the section skeleton in `assets/template.md`. Write in the language of the conversation, translating the headings accordingly. Obtain the date via `date +%F`.

- Include a code block only when it specifies a contract or sketches the change.
- Link full reports and prior analyses by path instead of restating them.
- Drop References or Out of scope when genuinely empty; keep the other sections.

The report is done when every template section is filled or dropped under the rule above, and every file:line citation has been checked against the current code.
</issue_report_instruction>

Task: $ARGUMENTS
