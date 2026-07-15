---
name: usechrome
description: Drive the host's own Chrome via `usechrome <command>` — no container, no separate daemon. The first call launches Chrome headed on the host X display; it stays up between calls (each call attaches over CDP, acts, detaches) until `usechrome stop`. One shared instance and profile (`~/.usechrome`) machine-wide. Use whenever the user asks to browse a URL, take a screenshot, scrape a JS-rendered page, fill a form, automate a web flow, log into a site, or click/type on a real page. Do NOT use for plain HTML/JSON fetches that `WebFetch` or `curl` already handle. Set `UC_HEADLESS=1` only when no display is available.
---

# usechrome

`usechrome <command>` drives the host's system Chrome. The first command spawns Chrome as a detached process (headed, on the host X display) and it survives until `usechrome stop`. Each CLI call connects over CDP, acts, and disconnects — browser and page state persist between calls, which is why snapshot refs stay usable across calls as long as the page hasn't changed.

## Invoke

`usechrome` is on PATH (core exposes its `bin/`). If it is not found, fall back to:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/usechrome/scripts/cli.mjs" <command> …
```

The very first run may print `playwright-core 설치 중 (npm ci)` and take a few seconds — the launcher bootstraps its own dependency; nothing to do. The fallback path skips that bootstrap, so if it fails with `Cannot find package 'playwright-core'`, run `npm ci` once in the `scripts/` directory above.

## Commands

```bash
usechrome start                  # ensure Chrome is up (every command does this implicitly)
usechrome open <url>             # navigate, print the page title (alias: goto)
usechrome snapshot               # aria snapshot; interactive nodes carry [ref=eN] (alias: snap)
usechrome click <ref> --expect '<snapshot-line substring>'
usechrome fill <ref> <text> --expect '<snapshot-line substring>'
usechrome shot [path]            # screenshot → path (default ~/.usechrome/shot.png)
usechrome stop                   # kill the Chrome process
```

| env | default | meaning |
|---|---|---|
| `UC_PORT` | `19222` | CDP port |
| `UC_HOME` | `~/.usechrome` | state dir (profile, default shot path) |
| `UC_CHROME` | auto-detect | Chrome binary path |
| `UC_HEADLESS` | unset | `1` = headless (no X display needed) |
| `UC_NO_SANDBOX` | unset | `0` = keep the Chrome sandbox (`--no-sandbox` is default) |

## Operating loop

For any multi-step task:

1. **Open.** `usechrome open <url>`.
2. **Snapshot, then act.** `usechrome snapshot` and pick a ref from the output.
3. **Always pass `--expect`.** A ref is a DOM-traversal ordinal, not an element handle — if the DOM changed after the snapshot, the same number silently points at a different element. `--expect` takes a substring of that ref's snapshot line (e.g. `--expect 'button "삭제"'`) and turns a mis-click into a loud failure.
4. **Re-snapshot after every UI change.** Navigation, DOM-mutating click, modal, form submit → snapshot again before using the next ref.
5. **Ref missing/mismatch error → one retry.** Re-snapshot once and act with the fresh ref. Still failing → report the page state.
6. **Manual blockers → hand over, don't guess.** Login, 2FA, captcha, account chooser: the browser is visible on the user's screen, so ask the user to complete the step in that window and tell you when to continue. Never guess credentials, never loop retries.

## One instance, one profile

There is exactly one Chrome (port `UC_PORT`) and one profile (`~/.usechrome/profile`) shared machine-wide — no per-project or per-task isolation. Commands act on the first tab. Concurrent sessions driving usechrome collide with each other; cookies and logins persist across tasks until the profile directory is deleted.

## Anti-bot caveats

The headed default presents a clean fingerprint (real Chrome UA, `navigator.webdriver` false). `UC_HEADLESS=1` leaks `HeadlessChrome` in the UA — expect more refusals. Either way, when a strict site blocks (Cloudflare gate, Google login), report the block; don't retry-loop.

## When NOT to use

- Plain HTML/JSON the model already fetches via `WebFetch` or `curl`.
- Bulk scraping (hundreds of pages) — write a dedicated script.
