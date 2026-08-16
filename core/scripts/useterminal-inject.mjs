#!/usr/bin/env node
/**
 * SessionStart Hook: tell the session that useterminal is usable — but only when
 * it is. Hook processes inherit TMUX from the pane the session runs in
 * (verified), so its absence means there is no window to open panes in and the
 * session never hears about the tool.
 */

process.stdout.write(JSON.stringify(
  process.env.TMUX
    ? {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `<useterminal>
\`useterminal\` can open and drive panes in the user's own window. When something should happen where the user can watch it — a demo, live output, a program being driven — invoke the \`core:useterminal\` skill for how to use it.
</useterminal>
`,
      },
    }
    : { continue: true, suppressOutput: true },
));
