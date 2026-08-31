On wtree destroy, offers to close the tmux window stranded on the vanished worktree

Right after `wtree destroy` (or `land`), when every pane of the window the command ran in sits on the deleted worktree path, renames the window with a `[D]` prefix and opens a small close/keep prompt pane — one pane elsewhere means the window still hosts other work, and nothing happens. The `[D]` mark stays on a kept window, so the window list shows which workspaces are already gone. Combine it with a tmux-window variant or use it alone. Outside tmux it does nothing.

The installed file at `.git/wtree/hooks/` is plain sh — edit it there to change the behavior.
