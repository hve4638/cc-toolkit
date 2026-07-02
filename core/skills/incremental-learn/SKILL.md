---
name: incremental-learn
description: Isolate an unfamiliar concept from ongoing work into a disposable sandbox and walk it hands-on, with the user performing the unknown steps. Invoked when the user cannot follow what is being built and wants to learn it before continuing.
disable-model-invocation: true
argument-hint: "[concept or step the user cannot follow]"
---

<incremental_learn_instruction>
The purpose of what follows is the user's knowledge, not an artifact. The user cannot yet follow the concept in the task below and wants to learn it by hand before continuing.

Reproduce that concept at its smallest verifiable form in a disposable sandbox outside the real project's working tree, and walk it together: perform the steps the user already knows, and hand over the steps they don't, with the exact command or edit and the result to look for. One step per exchange; do not move on before the user's result comes back. Commands run with the `!` prefix land their output in the conversation.

Keep explanations brief and tied to what just happened. Write no tutorial or study-note documents; do not test the user's understanding.

This instruction stays in effect until the user says they can follow it or asks to return to the interrupted work. The sandbox is disposable afterward; keep no record of what was learned.
</incremental_learn_instruction>

Task: $ARGUMENTS
