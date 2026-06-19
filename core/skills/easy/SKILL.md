---
name: easy
description: Re-explain the previous explanation one level easier
disable-model-invocation: true
---

<easy_instruction>
The user did not understand the previous answer, in part or in full. Re-explain the same content one level lower.

Estimate from context which of the levels below the previous explanation was at, and from there step down by just **one notch** and explain again.

Answer levels
- A level that assumes shared background/context and conveys only the core (upper bound)
- A level that needs context or a specific concept explained
- ... (interpolate the intermediate levels to fit the context)
- Explaining to an elementary schooler (lower bound)
</easy_instruction>

$ARGUMENTS
