---
name: ai-ish
description: "만든 결과물에서 AI가 만든 티를 점검하고 고친다"
disable-model-invocation: true
---

<ai-ish>
Review an artifact for AI-ish tells and fix them. A tell is a default standing where a decision belongs: an element, value, or string for which no reason specific to this product can be stated.

The target is the files or focus the user gave with the command. Without one, the target is the artifact built in this conversation.

## Checklists

Read the checklist for the target's kind before the checklist pass:

- Frontend (pages, components, dashboards, UI text) → [FRONTEND.md](FRONTEND.md)

When no checklist matches the target, state that and stop.

## Fix scope

- Fix directly: a tell whose fix stays inside the existing design and changes no feature.
- Ask first: adding or removing a feature, control, or view, and every item the checklist marks as a taste call.

## Steps

1. Checklist pass. For each candidate, state the reason it exists for this product; a candidate with no reason is a tell. Record each tell with a `file:line` or the quoted string. Edits wait for step 3. Done when every checklist section has been applied to every file in the target.
2. User pass. Send the message below to GPT with `codex_agent`. Fill in the product and its users from the conversation, and the target paths. Add the running URL or screenshot paths when they exist. The message carries only the filled template.

   ```
   You are a user of <product>: <who uses it and for what>.
   Walk through <paths, URL, screenshots> as that user. Read the code to see what each screen shows and does.
   For every feature, control, panel, and piece of explanatory text, ask: as this user, should this be here?
   Report in this form:
   - Does not belong: <item> (<file:line>): <why, from the user's side>
   - Missing: <what this user came to this screen to do or see, and cannot find>
   Judge only. Leave every file unchanged.
   ```

   When `codex_agent` is unavailable or fails, run the same pass in this session and record it under Not checked as `user pass ran without GPT (<reason>)`. Sort each item into direct fix or ask first by the fix scope above, and mark the "Does not belong" items the user asked for in this conversation.
3. Fix every direct-fix tell, then run the checklist's post-fix check. Done when each tell from both passes is either fixed or listed for the user's decision, and the post-fix check has run or is recorded under Not checked.
4. Report in this form. Line numbers refer to the files before the fixes.

   ```
   ## Fixed
   - <tell>: <file:line> → <change>

   ## Needs your decision
   - <tell or user-pass item>: <evidence> → <proposal>

   ## Not checked
   - <part of the target or check that did not run>
   ```
</ai-ish>

$ARGUMENTS
