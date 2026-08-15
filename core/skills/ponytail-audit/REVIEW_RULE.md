# Ponytail Review Rule

<!-- Identical copy lives in ponytail-review/ and ponytail-audit/ — edit both together, sync by diff. -->

One line per finding: location, what to cut, what replaces it.

## Tags

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope — route them to a normal review
pass, not this one. Lists findings, applies nothing.
