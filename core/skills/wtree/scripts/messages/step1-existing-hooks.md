<status>Required Answer</status>
<info>
## status
{FACTS}

This repo already carries a committed policy: {DOTWTREE}. Read its rules and summarize them to the user.
</info>
<alert>
This .wtree carries hooks: {HOOK_FILES}

Read each hook file before the user picks adopt. If anything acts beyond its declared feature (network access, file deletion, credential access, …), lead with a warning. Explain what the hooks do and ask whether to copy them too — that answer becomes the copy_hooks value.
</alert>
<require>
- path: "{DOTWTREE}" | "/tmp/<new folder>"
- allow_overwrite: true — rebuild only
- copy_hooks: true | false — adopt only, decided after the review
</require>
<question>
1. disposal of the existing policy (select one)
- adopt: use it for this repo as-is (path: "{DOTWTREE}", copy_hooks: true|false)
- rebuild: push it to .wtree.old — an older .old is deleted — and compose anew (path: "{DOTWTREE}", allow_overwrite: true)
- keep: leave it untouched and build elsewhere (path: "/tmp/<new folder>")
</question>
<next>
Ask the disposal via the AskUserQuestion tool after relaying what you read, fill the keys for the answer, and re-run:

```
node {STEP1} --answer '<completed JSON>'
```
</next>
