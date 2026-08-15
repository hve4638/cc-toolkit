<status>Error</status>
<error>
The TUI pane was opened, but no outcome has been recorded — it is either still running, or it ended without finishing (closed pane, killed process, crash).
</error>
<next>
If the pane is still open, wait for the user to finish it. Otherwise check the current state with the read-only step 1 query and continue on the step route:

```
node {STEP1}
```
</next>
