---
name: b
description: "[brief] Briefly recap the current session's goal, state, and next step"
disable-model-invocation: true
---

<brief_instruction>
# brief

Assume the user has lost the context of the current work for some reason (e.g., a long absence since the previous conversation), and give a short recap of the session in progress.
Unless told otherwise, draw the recap only from what is in the current conversation context.

What to report:
- Goal / current state / next step

If there is effectively no session context to recap, answer "no active context to resume" and stop.
</brief_instruction>

$ARGUMENTS
