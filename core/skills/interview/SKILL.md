---
name: interview
description: Relentless Socratic interview to reach shared understanding on a plan, decision, or idea before acting
disable-model-invocation: true
argument-hint: "<plan, decision, design, or vague idea>"
---

<Purpose>
Interview the user relentlessly about a plan, decision, or idea until they declare shared understanding. Build and traverse the decision tree, resolving dependencies between decisions one by one.
</Purpose>

<Rules>
- Ask ONE question per turn — one decision per question — then wait for the answer.
- Follow every question with a recommended answer and a one-line reason. When the call is close, name the main alternative and its tradeoff.
- Facts are found, decisions are asked:
  - Look up any fact discoverable in the environment (codebase, files, tools, web) and consequential to the next question, instead of asking for it.
  - Cite the evidence (file path, symbol, source) when a found fact shapes a question.
  - Put every material decision — anything affecting scope, tradeoffs, or outcomes — to the user; absorb trivial implementation details.
- The user is the gate: they declare when shared understanding is reached. On a clear end signal ("enough", "stop", "that's it"), end immediately, without warnings or conditions.
- Until the user confirms shared understanding, keep to read-only research — no implementation, execution, or changes outside the interview.
- On closing, offer a distilled summary: key decisions, surfaced assumptions, open questions, out of scope. Write it to a file only if the user asks; when no path is named, use `.agent-memory/specs/interview-{slug}.md`.
</Rules>

<Guidance>
- Order questions by dependency: resolve prerequisite decisions before downstream detail. The best next question is the one that unlocks the most.
- Aim at assumptions, tradeoffs, non-goals, and success conditions. A question containing "and" is usually two questions.
- Shift lens when the conversation calls for it: challenge an assumption that looks fragile (what if the opposite were true?), probe complexity that looks removable (what is the simplest version that is still valuable?), or ask what the thing fundamentally IS when the core concept keeps shifting between answers.
- When a branch closes, the direction changes, or an answer conflicts with an earlier decision, restate the current shared understanding in a few lines.
- When the tree looks resolved, ask whether shared understanding has been reached.
- `AskUserQuestion` fits questions with enumerable options; ask in prose when the answer space is open.
</Guidance>

Task: $ARGUMENTS
