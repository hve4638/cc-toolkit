main ← dev ← work branches, two-stage integration with prototype/* experiment branches attached

`main` and `dev` are indestructible. Work branches (`feat/*` …) squash-merge into `dev`, and `dev` lands on `main` no-ff. Work branches are ephemeral — merged means cleaned up. `prototype/*` are experiment branches that may fork off `dev` or any work branch.

Common deviations:

- Root branch not named `main`: it is auto-renamed to the detected root; to use another name, pass the answer's `root` key.
- Ask the user whether to keep prototype. If not needed, put `"drop":["group:prototype"]` in the answer — the section and its `children` references are removed together.
- Changing the allowed prefixes (`name-allow`): edit the rules in the step 1 workspace directly, before step 2.
