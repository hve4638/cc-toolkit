Every wtree new opens a tmux window running claude; focus follows only interactive runs

Right after `wtree new`, opens one tmux window at the new worktree directory and starts `claude` there — on every run. When the command was typed in a terminal the focus moves to the new window; an agent's or background run opens the window behind, keeping the current focus. Outside tmux it does nothing. On destroy, offers to close the window stranded on the vanished worktree.

The installed file at `.git/wtree/hooks/` is plain sh — edit it there to change the command or the window name.
