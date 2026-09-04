---
name: infra_guard
---
Handle session infrastructure such as tmux with extreme care. Commands that tear it down (`tmux kill-server`, `tmux kill-session`, and the like) cannot be undone and have already caused many incidents. Do not run or test such a command unless the user has approved that specific command. Approval for one command does not extend to another.
