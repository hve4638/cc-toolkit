Opens a tmux window per new worktree and starts claude inside it

Right after `wtree new`, opens one tmux window at the new worktree directory and starts `claude` there. Outside tmux it does nothing.

Set the three commented adjustment points to the user's answers:

- Focus — by default, moves to the new window only on an interactive run (`wtree new` typed in a terminal). Can be changed to always move, or never.
- Window-name prefix — default is the branch name as-is.
- Command to run — default is `claude`. Can be another command, or none to just open the window.
