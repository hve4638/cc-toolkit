---
name: inlay
description: "Context preservation methodology applied when writing, editing, refactoring, debugging, reviewing code or designing modules/architecture. Pins per-directory responsibilities, entry points, and domain terms through INLAY.md, and preserves non-obvious decisions through WHY comments."
---

<inlay>

# inlay

## Purpose

Discipline and guardrails for an agent's code work. Pin codebase context next to the code so the agent does not pay the cost of rediscovering truth on every task.

## Pre-work judgment

Before writing code:

1. State assumptions — if uncertain, ask.
2. Surface multiple interpretations — if the request points in several directions, present all of them.
3. Simpler alternatives — name them when they exist.
4. Stop and ask — if anything is unclear, stop and name what is unclear.

Test: *"If this interpretation is wrong, will the user have to ask for the work again?" → ✓ → confirm before starting.*

## Task entry procedure

When to apply: introducing a new module, a change that crosses inlay boundaries, or when the scope of the work is unclear. For self-evident in-file edits, the auto-injected context is enough.

When starting code exploration after receiving a request:

1. Scan tier-1 inlays (the first inlay met on each branch descending from the root) — from the root, run `search` to see the tier-1 inlay list and their `purpose`. Narrow down which tier-1 inlay this work touches (or whether it touches none).
2. Enter the selected inlay's entry — read INLAY.md and entry first. Descend into inner files starting from what entry points to, only as needed.
3. Recurse into child inlays — when entry or inner code touches a child inlay's responsibility, repeat steps 1–2 in that child.
4. Decide scope and external impact — judge which inlays the change spans, whether it breaks the entry contract, and whether it propagates to other inlays before starting.

Test: *"Do you know the entry contracts and internal responsibilities of every inlay this work touches before starting?"* → ✓ → proceed.

## INLAY.md rules

Place an `INLAY.md` at the codebase root. Any directory containing an `INLAY.md` is an **Inlay**. When exploring an inlay, read the `INLAY.md` and its entry point first; descend into inner files only when needed. Inlays can nest (child inlay inside a parent).

Fixed INLAY.md shape:

```markdown
---
name: <inlay name>
purpose: <one-line responsibility>
entry: <entry-point path>           # single file
entry: [<path>, <path>, ...]        # multiple files
when:
  - <invocation context>
---

## Domain Terms
- **<domain term>** — <definition>
```

- frontmatter has 4 fixed fields (`name`, `purpose`, `entry`, `when`).
- `when` — high-level scenarios in which the agent invokes this inlay. 1–3 bullets recommended. Needing more is a signal that the inlay's responsibility has grown too wide; consider splitting.
- Body `## Domain Terms` — **only when present**. A domain term is a name whose meaning is fixed inside the inlay. Exclude generic words and identifiers whose meaning is closed by language convention. A child inlay's domain terms live in the child INLAY.md only.

Split test: *"Can internal changes or failures affect code outside the inlay without going through entry?"* → ✓ → the boundary is drawn wrong.

Splitting: when a split is reported, propose it to the user. Split an inlay only when the user approves or explicitly asks. **A split is its own pass, separate from the change that surfaced it.**

Synchronization: when an inlay's entry points or domain terms change, update INLAY.md alongside the code. Breaking changes go through INLAY.md and the code in the same PR.

## Entry rules

`entry` is the single source of truth for the inlay's outward contract. Pin the following so an agent can call and review by reading entry alone:

1. Exposed symbols: every externally exposed function, class, type, and constant flows through `entry`'s exports. Symbols not in `entry` do not exist outside the inlay.
2. Signatures: types in statically-typed languages; type hints / JSDoc in dynamic languages.
3. Side effects: DB / network / file / log / env / time and other effects not visible in the signature go in the docstring.
4. Error model: throwable exceptions and their meaning go in the docstring (or a type like `Result<T, E>`).

Non-obvious preconditions, postconditions, invariants, external dependencies, and concurrency models also belong in the docstring when they apply.

The entry point is a source file inside the inlay directory. When the outward contract fits in one file, write a single path (e.g. `entry: index.ts`). When it spans several files, list them as an array (e.g. `entry: [routes.ts, schema.ts]`). Entry source files are the only interface documentation.

Multi-file entry test: *"Is each entry file a different facet of the same outward contract?"* → ✗ → signal that the inlay's responsibility has grown too wide; consider splitting.

## Domain term collision rules

Across all INLAY.md files in the repo (parent / child / sibling, all the same), the following are violations:

- Duplication: the same domain term defined with the same meaning in two or more INLAY.md files. Define it in the narrowest context that covers all referencing inlays (in the child if it stays inside the child; higher up if it leaks out). Remove from other locations.
- Collision: the same domain term used with different meanings in two INLAY.md files. Rename one or both, or unify the definition.

Inside one inlay, use one name per concept. When the external API and internal representation differ (e.g. snake_case vs camelCase), map explicitly at the entry boundary; past that, use a single name internally.

## WHY comment rules

Form: `// WHY: reason`. Use the language's comment marker (`#`, `/* */`, etc.). For multi-line, tag only the first line and indent continuation lines.

```ts
// WHY: This updates shared state, so parallelizing it would cause a race condition.
//      Sequential execution must be preserved.
```

Before writing a WHY comment, first complete this sentence:

> "From the code alone, the reader would not know ___."

If you can fill the blank with **one concrete fact** → that fact is the WHY body.
If you cannot fill it, or only abstract phrases come up ("for safety", "to prevent X", etc.) → **do not write the comment.**

Common shapes the blank takes:

1. External system / library behaves like ___
2. There was a past bug or incident: ___
3. A simpler alternative ___ exists but was rejected because ___
4. Invariant ___ holds (or breaks) at ___
5. Looks like A but is actually B
6. Performance / security / compatibility forced the constraint ___

Even if none of these shapes fit, a concrete blank is still a WHY. Even if one of them seems to fit, an abstract blank is WHAT.

**Signs the blank is not filled**:

- "For safety..." → what is safe is missing
- "Skip if X" → paraphrases the condition
- "To prevent X" → direct translation of the branch
- "Record Y", "Call Y" → direct translation of the function call

When editing or removing a `WHY:` line, first **verify the comment's condition still holds**. If it no longer holds, update both the comment and the code.

## Change scope limits

Even on lines without a `WHY:` comment, do not touch what is outside the request:

- Do not "improve" adjacent code, comments, or formatting.
- Do not refactor what is not broken.
- Keep the existing style.
- Unrelated dead code: **mention it**, do not delete it.
- Orphans your change introduces (unused imports / variables / functions): remove them. Pre-existing dead code stays unless asked.

Test: *"Does every changed line trace directly to the user's request?"*

## Automatic inlay injection

The plugin's hooks intercept `Read` / `Edit` / `Write` / `MultiEdit` / `NotebookEdit` calls and automatically inject the ancestor INLAY.md chain of the targeted file as a system-reminder.

- Injection form: `<inlay-context path="...">...</inlay-context>` blocks listed root → leaf.
- The second time the same inlay is encountered in the same session, it is omitted from output as long as its content is unchanged (silent skip).
- INLAY.md itself never triggers, regardless of patterns — no call (Read included) injects or tracks it.
- The hook also runs after tool execution (PostToolUse) — an edit to a trigger-matched file marks the nearest ancestor INLAY.md as touched for the current work cycle; an edit to an INLAY.md refreshes its hash against the new body and records it as updated for the cycle, regardless of patterns.

The `.inlay` marker file may contain gitignore-style patterns declaring which files trigger injection and tracking. Non-triggering files get neither chain injection nor touched tracking. An empty marker (zero patterns) triggers everything.

- One pattern per line, `#` comments, `!` negation. Last matching line wins; a file matched by no line does not trigger.
- A pattern without `/` matches the basename at any depth; with `/` it is anchored to the `.inlay` directory.
- `*` and `?` never cross `/`. `**` is depth-independent only in slash-delimited positions (`a**b` acts like a plain `*`). A trailing `/` covers everything under that directory (`src/` ≡ `src/**`).
- Pitfall: `!*.md` alone is not "everything except md" — non-md files match no line, so nothing triggers. For that intent write `*` first, then `!*.md` on the next line.

## Tool usage rules

Use the following tools instead of reading INLAY.md directly:

- **MCP `search`** — At a given location, find the INLAY.md there and in immediate children one level deep (deeper nesting is ignored). Returns a JSON array of `name`, `purpose`, `path`. Tool name: `mcp__plugin_frame_inlay__search`. Args: `{ path?: string }` (defaults to cwd). When to call: the tier-1 inlay scan in step 1 of Task entry procedure. For deeper trees, descend one level at a time during step 3 recursion.
- **MCP `read_context`** — Read the ancestor INLAY.md chain from a given path up to the nearest `.inlay` ancestor directory (stops at, and includes, that `.inlay` directory; never above it). If no `.inlay` ancestor exists, the path is outside any inlay scope and the result is empty. Output is a string of `<inlay-context path="...">...</inlay-context>` blocks, top-down. INLAY.md already served in this session with the same hash appears with `(already read)` as the body (lifetime: MCP server process). Tool name: `mcp__plugin_frame_inlay__read_context`. Args: `{ path?: string }` (defaults to cwd). When to call: when you want to peek at *another* inlay's context before editing (the prospective lookup in step 2 of Task entry procedure). The normal in-file flow is handled by automatic injection.
- **Static script `doctor`** — Checks for broken frontmatter (4 fields: `name`/`purpose`/`entry`/`when`), empty `when` list, and body over 300 lines. On violation, prints a `<inlay-instruction>` block with the prescription. Run: `node $CLAUDE_PLUGIN_ROOT/guardrails/inlay/context-doctor.mjs [<root>]`. Defaults to cwd. exit 0. When to call: right after creating or editing an INLAY.md, to verify it.

</inlay>
