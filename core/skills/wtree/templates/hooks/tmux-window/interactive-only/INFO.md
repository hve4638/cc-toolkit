Only an interactive wtree new opens a tmux window running claude, with focus

Right after `wtree new` typed in a terminal, opens one tmux window at the new worktree directory, starts `claude` there, and moves focus to it. A non-interactive run (an agent calling wtree) creates no window at all. Outside tmux it does nothing. `wtree new <name> -- <words>` hands everything after `--` to claude as its initial prompt.

The installed file at `.git/wtree/hooks/` is plain sh — edit it there to change the command or the window name.
