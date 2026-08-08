#!/usr/bin/env node
/**
 * SessionStart Hook: tell the session that showcase is usable — but only when
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
        additionalContext: `<showcase>
This session runs inside tmux, so \`showcase\` can open panes in the user's own window — for demos, live output, anything they should watch happen. \`showcase --help\` lists the commands. Terminal work the user has no reason to watch belongs in \`vt\`.
</showcase>
`,
      },
    }
    : { continue: true, suppressOutput: true },
));
