# wtree rules vocabulary

`[X]` declares a fixed branch, `[group:X]` a set of fungible work branches. `wtree check` validates everything, including references and name collisions.

| key | on | meaning |
|---|---|---|
| `children` | both | what may be created here, and what merges back here: bare fixed-branch names (branch sections only), `group:X`, `*` (free-branch fallback) |
| `name-allow` / `name-deny` | group | glob constraints on member names |
| `merge-mode` | both | modes accepted as a merge target: `squash`, `rebase`, `no-ff`, `ff` |
| `destroyable` | branch | `false` = wtree destroy refuses unconditionally |
| `ephemeral` | group | members are collected leaf-first when their parent is destroyed — only meaningful when that parent is itself destroyable |
| `copy` | both | untracked files copied from the parent's worktree into a new one; directories need a trailing `/` |
| `description` | both | free text saying what the branch or group is for; shown by `wtree info` and bare `wtree`, never acted on |

A fixed branch `X` and patterns `X/*` cannot coexist (git ref namespace).
