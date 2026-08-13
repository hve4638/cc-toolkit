The simplest shape — work branches (feat/* fix/* …) squash-merged under a main root

`main` is the indestructible root; work in `feat/* fix/* refactor/* perf/* docs/* test/* chore/*` worktrees under it and land each as a single squash commit on `main`.

Common deviations:

- Root branch not named `main`: it is auto-renamed to the detected root; to use another name, pass the answer's `root` key.
- Changing the allowed prefixes (`name-allow`): edit the rules in the step 1 workspace directly, before step 2.
