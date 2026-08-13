<status>Required Answer</status>
<info>
## status
{FACTS}
</info>
<require>
- path: ".wtree" — a fresh folder where the policy is composed before it is applied (the workspace). This is not where worktrees will live; that is asked later, as `where`. Keep the default unless the user asks for a different workspace path.
</require>
<next>
run this:

```
node {STEP1} --answer '{"path":".wtree"}'
```
</next>
