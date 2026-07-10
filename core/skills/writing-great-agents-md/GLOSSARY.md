<!-- Terms adapted from mattpocock-skills / writing-great-skills GLOSSARY.md (MIT, © 2026 Matt Pocock) -->

# Glossary — Context Files

Terms for keeping an always-loaded context file lean, adapted from the skill-writing glossary to the context-file setting. This is the disclosed reference for [`writing-great-agents-md`](SKILL.md).

**Bold terms** in any definition are themselves defined in this glossary.

## Context Load

The cost always-loaded content imposes on the agent's context window — tokens and attention spent on every turn, needed or not. For a context file the load is permanent: nothing in it loads on demand, which is why every line must earn its place. The brake on adding to the file; situational content belongs in a skill instead.

_Avoid_: token cost, context bloat

## Co-location

Keeping the material an agent needs at once in one place — one topic's rules under a single heading, not scattered across the file — so reading one part brings its neighbours with it. Distinct from **duplication**: that repeats one meaning in two places, where scattering fragments a single meaning across many.

_Avoid_: grouping, clustering, cohesion

## Negation

_Failure mode._ Steering by prohibition — telling the agent what _not_ to do — which drags the forbidden behaviour into context and makes it _more_ available, not less. _Don't think of an elephant_, and the elephant is all there is. Cure: prompt the positive — describe the target behaviour so the banned one is never spoken — or recast as transparency enforcement ("if X was done, declare it"). A prohibition earns its place only as a hard guardrail on a behaviour that has no positive phrasing; even then, pair it with the positive target.

_Avoid_: ironic rebound, don't-prompting, the pink elephant

## Single Source of Truth

The desired state where each meaning lives in exactly one authoritative place, so a change in behaviour is a change in one place. **Duplication** is its violation.

_Avoid_: home, canonical location

## Duplication

_Failure mode._ The same meaning given more than one **single source of truth**. It costs maintenance (change one place, you must change the others), costs tokens, and inflates the meaning's prominence past its real rank.

_Avoid_: repetition, redundancy

## Relevance

Whether a line still bears on the work — the lens for what to keep. A line loses relevance either by never bearing on it or by going stale: drifting out of date as the behaviour or world it describes changes. Distinct from **no-op**: relevance asks whether a line bears on the work, not whether it changes behaviour.

_Avoid_: load-bearing, staleness, freshness

## Sediment

_Failure mode._ Layers of old content that settle in a file and are never cleared, because adding feels safe and removing feels risky — so stale and irrelevant lines accumulate and you must core down through them to find what is still live. The default fate of any context file without a pruning discipline; the slow erosion of **relevance**.

_Avoid_: accretion, bloat, cruft, rot

## No-Op

_Failure mode._ An instruction that changes nothing because the model already does it by default — you pay load to tell the agent what it would do anyway. The test: does the line change behaviour versus the default? A line can be perfectly **relevant** and still be a no-op. Model-relative, not reader-relative: two people disagreeing over whether a line is a no-op disagree about the default, and settle it by observation, not debate.

_Avoid_: redundant instruction, restating the obvious, belaboring
