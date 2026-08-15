Opens a tmux window per new worktree and starts claude inside it

Right after `wtree new`, opens one tmux window at the new worktree directory and starts `claude` there. Outside tmux it does nothing.

Three adjustment points, assembled from the answers given during setup:

- Focus — move to the new window always, only on interactive runs (`wtree new` typed in a terminal), or never. Default: interactive runs only.
- Window-name prefix — default is the branch name as-is.
- Command to run — `claude`, another command, or none to just open the window.
