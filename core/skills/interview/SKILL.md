---
name: interview
description: Socratic interview with mathematical ambiguity gating to produce a crystal-clear spec
argument-hint: "[--quick|--standard|--deep] <idea or vague description>"
handoff: .agent-memory/specs/interview-{slug}.md
---

<Purpose>
Interview implements Ouroboros-inspired Socratic questioning with mathematical ambiguity scoring. It replaces vague ideas with crystal-clear specifications by asking targeted questions that expose hidden assumptions, measuring clarity across weighted dimensions, and refusing to proceed until ambiguity drops below a configurable threshold (default: 20%). The output is a structured spec file that serves as input for implementation.
</Purpose>

<Use_When>
- User has a vague idea and wants thorough requirements gathering before execution
- User says "interview me", "ask me everything", "don't assume", "make sure you understand"
- User says "ouroboros", "socratic", "I have a vague idea", "not sure exactly what I want"
- User wants to avoid "that's not what I meant" outcomes from autonomous execution
- Task is complex enough that jumping to code would waste cycles on scope discovery
- User wants mathematically-validated clarity before committing to execution
</Use_When>

<Do_Not_Use_When>
- User has a detailed, specific request with file paths, function names, or acceptance criteria -- execute directly
- User wants a quick fix or single change -- delegate to an executor agent
- User says "just do it" or "skip the questions" -- respect their intent
- User already has a spec or plan file -- use it directly
</Do_Not_Use_When>

<Why_This_Exists>
AI can build anything. The hard part is knowing what to build. Single-pass expansion (analyst + architect over a vague sentence) struggles with genuinely vague inputs — it asks "what do you want?" instead of "what are you assuming?" Interview applies Socratic methodology to iteratively expose assumptions and mathematically gate readiness, ensuring genuine clarity before spending execution cycles.

Inspired by the [Ouroboros project](https://github.com/Q00/ouroboros) which demonstrated that specification quality is the primary bottleneck in AI-assisted development.
</Why_This_Exists>

<Execution_Policy>
- Ask ONE question at a time -- never batch multiple questions
- Target the WEAKEST clarity dimension with each question
- Make weakest-dimension targeting explicit every round: name the weakest dimension, state its score/gap, and explain why the next question is aimed there
- Gather codebase facts via `explore` agent BEFORE asking the user about them
- For brownfield confirmation questions, cite the repo evidence that triggered the question (file path, symbol, or pattern) instead of asking the user to rediscover it
- Score ambiguity after every answer -- display the score transparently
- Do not proceed to spec crystallization until ambiguity ≤ threshold (default 0.2)
- Allow early exit with a clear warning if ambiguity is still high
- Persist interview state for resume across session interruptions
- Challenge agents activate at specific round thresholds to shift perspective
</Execution_Policy>

<Steps>

## Phase 1: Initialize

1. **Parse the user's idea** from the task input at the end of this skill
2. **Detect brownfield vs greenfield**:
   - Run `explore` agent (haiku): check if cwd has existing source code, package files, or git history
   - If source files exist AND the user's idea references modifying/extending something: **brownfield**
   - Otherwise: **greenfield**
3. **For brownfield**: Run `explore` agent to map relevant codebase areas, store as `codebase_context`
4. **Initialize state** by writing JSON to `.agent-memory/state/interview-state.json`:

```json
{
  "active": true,
  "current_phase": "interview",
  "state": {
    "interview_id": "<uuid>",
    "type": "greenfield|brownfield",
    "initial_idea": "<user input>",
    "rounds": [],
    "current_ambiguity": 1.0,
    "threshold": 0.2,
    "codebase_context": null,
    "challenge_modes_used": [],
    "ontology_snapshots": []
  }
}
```

5. **Announce the interview** to the user:

> Starting interview. I'll ask targeted questions to understand your idea thoroughly before building anything. After each answer, I'll show your clarity score. We'll proceed to spec crystallization once ambiguity drops below 20%.
>
> **Your idea:** "{initial_idea}"
> **Project type:** {greenfield|brownfield}
> **Current ambiguity:** 100% (we haven't started yet)

## Phase 2: Interview Loop

Repeat until `ambiguity ≤ threshold` OR user exits early:

### Step 2a: Generate Next Question

Build the question generation prompt with:
- The user's original idea
- All prior Q&A rounds (conversation history)
- Current clarity scores per dimension (which is weakest?)
- Challenge agent mode (if activated -- see Phase 3)
- Brownfield codebase context (if applicable)

**Question targeting strategy:**
- Identify the dimension with the LOWEST clarity score
- Generate a question that specifically improves that dimension
- State, in one sentence before the question, why this dimension is now the bottleneck to reducing ambiguity
- Questions should expose ASSUMPTIONS, not gather feature lists
- If the scope is still conceptually fuzzy (entities keep shifting, the user is naming symptoms, or the core noun is unstable), switch to an ontology-style question that asks what the thing fundamentally IS before returning to feature/detail questions

**Question styles by dimension:**
| Dimension | Question Style | Example |
|-----------|---------------|---------|
| Goal Clarity | "What exactly happens when...?" | "When you say 'manage tasks', what specific action does a user take first?" |
| Constraint Clarity | "What are the boundaries?" | "Should this work offline, or is internet connectivity assumed?" |
| Success Criteria | "How do we know it works?" | "If I showed you the finished product, what would make you say 'yes, that's it'?" |
| Context Clarity (brownfield) | "How does this fit?" | "I found JWT auth middleware in `src/auth/` (pattern: passport + JWT). Should this feature extend that path or intentionally diverge from it?" |
| Scope-fuzzy / ontology stress | "What IS the core thing here?" | "You have named Tasks, Projects, and Workspaces across the last rounds. Which one is the core entity, and which are supporting views or containers?" |

### Step 2b: Ask the Question

Use `AskUserQuestion` with the generated question. Present it clearly with the current ambiguity context:

```
Round {n} | Targeting: {weakest_dimension} | Why now: {one_sentence_targeting_rationale} | Ambiguity: {score}%

{question}
```

Options should include contextually relevant choices plus free-text.

### Step 2c: Score Ambiguity

After receiving the user's answer, score clarity across all dimensions.

**Scoring prompt** (use opus model, temperature 0.1 for consistency):

```
Given the following interview transcript for a {greenfield|brownfield} project, score clarity on each dimension from 0.0 to 1.0:

Original idea: {idea}

Transcript:
{all rounds Q&A}

Score each dimension:
1. Goal Clarity (0.0-1.0): Is the primary objective unambiguous? Can you state it in one sentence without qualifiers? Can you name the key entities (nouns) and their relationships (verbs) without ambiguity?
2. Constraint Clarity (0.0-1.0): Are the boundaries, limitations, and non-goals clear?
3. Success Criteria Clarity (0.0-1.0): Could you write a test that verifies success? Are acceptance criteria concrete?
{4. Context Clarity (0.0-1.0): [brownfield only] Do we understand the existing system well enough to modify it safely? Do the identified entities map cleanly to existing codebase structures?}

For each dimension provide:
- score: float (0.0-1.0)
- justification: one sentence explaining the score
- gap: what's still unclear (if score < 0.9)

Also identify:
- weakest_dimension: the single lowest-confidence dimension this round
- weakest_dimension_rationale: one sentence explaining why it is the highest-leverage target for the next question

5. Ontology Extraction: Identify all key entities (nouns) discussed in the transcript.

{If round > 1, inject: "Previous round's entities: {prior_entities_json from state.ontology_snapshots[-1]}. REUSE these entity names where the concept is the same. Only introduce new names for genuinely new concepts."}

For each entity provide:
- name: string (the entity name, e.g., "User", "Order", "PaymentMethod")
- type: string (e.g., "core domain", "supporting", "external system")
- fields: string[] (key attributes mentioned)
- relationships: string[] (e.g., "User has many Orders")

Respond as JSON. Include an additional "ontology" key containing the entities array alongside the dimension scores.
```

**Calculate ambiguity:**

Greenfield: `ambiguity = 1 - (goal × 0.40 + constraints × 0.30 + criteria × 0.30)`
Brownfield: `ambiguity = 1 - (goal × 0.35 + constraints × 0.25 + criteria × 0.25 + context × 0.15)`

**Calculate ontology stability:**

**Round 1 special case:** For the first round, skip stability comparison. All entities are "new". Set stability_ratio = N/A. If any round produces zero entities, set stability_ratio = N/A (avoids division by zero).

For rounds 2+, compare with the previous round's entity list:
- `stable_entities`: entities present in both rounds with the same name
- `changed_entities`: entities with different names but the same type AND >50% field overlap (treated as renamed, not new+removed)
- `new_entities`: entities in this round not matched by name or fuzzy-match to any previous entity
- `removed_entities`: entities in the previous round not matched to any current entity
- `stability_ratio`: (stable + changed) / total_entities (0.0 to 1.0, where 1.0 = fully converged)

This formula counts renamed entities (changed) toward stability. Renamed entities indicate the concept persists even if the name shifted — this is convergence, not instability. Two entities with different names but the same `type` and >50% field overlap should be classified as "changed" (renamed), not as one removed and one added.

**Show your work:** Before reporting stability numbers, briefly list which entities were matched (by name or fuzzy) and which are new/removed. This lets the user sanity-check the matching.

Store the ontology snapshot (entities + stability_ratio + matching_reasoning) in `state.ontology_snapshots[]`.

### Step 2d: Report Progress

After scoring, show the user their progress:

```
Round {n} complete.

| Dimension | Score | Weight | Weighted | Gap |
|-----------|-------|--------|----------|-----|
| Goal | {s} | {w} | {s*w} | {gap or "Clear"} |
| Constraints | {s} | {w} | {s*w} | {gap or "Clear"} |
| Success Criteria | {s} | {w} | {s*w} | {gap or "Clear"} |
| Context (brownfield) | {s} | {w} | {s*w} | {gap or "Clear"} |
| **Ambiguity** | | | **{score}%** | |

**Ontology:** {entity_count} entities | Stability: {stability_ratio} | New: {new} | Changed: {changed} | Stable: {stable}

**Next target:** {weakest_dimension} — {weakest_dimension_rationale}

{score <= threshold ? "Clarity threshold met! Ready to proceed." : "Focusing next question on: {weakest_dimension}"}
```

### Step 2e: Update State

Rewrite `.agent-memory/state/interview-state.json` with the new round and scores using the `Write` tool.

### Step 2f: Check Soft Limits

- **Round 3+**: Allow early exit if user says "enough", "let's go", "build it"
- **Round 10**: Show soft warning: "We're at 10 rounds. Current ambiguity: {score}%. Continue or proceed with current clarity?"
- **Round 20**: Hard cap: "Maximum interview rounds reached. Proceeding with current clarity level ({score}%)."

## Phase 3: Challenge Agents

At specific round thresholds, shift the questioning perspective:

### Round 4+: Contrarian Mode
Inject into the question generation prompt:
> You are now in CONTRARIAN mode. Your next question should challenge the user's core assumption. Ask "What if the opposite were true?" or "What if this constraint doesn't actually exist?" The goal is to test whether the user's framing is correct or just habitual.

### Round 6+: Simplifier Mode
Inject into the question generation prompt:
> You are now in SIMPLIFIER mode. Your next question should probe whether complexity can be removed. Ask "What's the simplest version that would still be valuable?" or "Which of these constraints are actually necessary vs. assumed?" The goal is to find the minimal viable specification.

### Round 8+: Ontologist Mode (if ambiguity still > 0.3)
Inject into the question generation prompt:
> You are now in ONTOLOGIST mode. The ambiguity is still high after 8 rounds, suggesting we may be addressing symptoms rather than the core problem. The tracked entities so far are: {current_entities_summary from latest ontology snapshot}. Ask "What IS this, really?" or "Looking at these entities, which one is the CORE concept and which are just supporting?" The goal is to find the essence by examining the ontology.

Challenge modes are used ONCE each, then return to normal Socratic questioning. Track which modes have been used in state.

## Phase 4: Crystallize Spec

When ambiguity ≤ threshold (or hard cap / early exit):

1. **Generate the specification** using opus model with the full interview transcript
2. **Write to file**: `.agent-memory/specs/interview-{slug}.md`

Spec structure:

```markdown
# Interview Spec: {title}

## Metadata
- Interview ID: {uuid}
- Rounds: {count}
- Final Ambiguity Score: {score}%
- Type: greenfield | brownfield
- Generated: {timestamp}
- Threshold: {threshold}
- Status: {PASSED | BELOW_THRESHOLD_EARLY_EXIT}

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | {s} | {w} | {s*w} |
| Constraint Clarity | {s} | {w} | {s*w} |
| Success Criteria | {s} | {w} | {s*w} |
| Context Clarity | {s} | {w} | {s*w} |
| **Total Clarity** | | | **{total}** |
| **Ambiguity** | | | **{1-total}** |

## Goal
{crystal-clear goal statement derived from interview}

## Constraints
- {constraint 1}
- {constraint 2}
- ...

## Non-Goals
- {explicitly excluded scope 1}
- {explicitly excluded scope 2}

## Acceptance Criteria
- [ ] {testable criterion 1}
- [ ] {testable criterion 2}
- [ ] {testable criterion 3}
- ...

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| {assumption} | {how it was questioned} | {what was decided} |

## Technical Context
{brownfield: relevant codebase findings from explore agent}
{greenfield: technology choices and constraints}

## Ontology (Key Entities)
{Fill from the FINAL round's ontology extraction, not just crystallization-time generation}

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| {entity.name} | {entity.type} | {entity.fields} | {entity.relationships} |

## Ontology Convergence
{Show how entities stabilized across interview rounds using data from ontology_snapshots in state}

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | {n} | {n} | - | - | - |
| 2 | {n} | {new} | {changed} | {stable} | {ratio}% |
| ... | ... | ... | ... | ... | ... |
| {final} | {n} | {new} | {changed} | {stable} | {ratio}% |

## Interview Transcript
<details>
<summary>Full Q&A ({n} rounds)</summary>

### Round 1
**Q:** {question}
**A:** {answer}
**Ambiguity:** {score}% (Goal: {g}, Constraints: {c}, Criteria: {cr})

...
</details>
```

## Phase 5: Handoff

After the spec is written, report to the user:

```
Spec created: .agent-memory/specs/interview-{slug}.md

Summary:
- Final ambiguity: {score}% (threshold: {threshold}%)
- Rounds: {n}
- Type: {greenfield|brownfield}
- Goal: {one-line goal}
- Acceptance criteria: {n_criteria}

The spec is ready for implementation. Feed it to an executor agent, use it as input for a planning session, or drive the work manually from the acceptance criteria list.
```

Then clean up: delete `.agent-memory/state/interview-state.json` (interview is complete — no resume needed).

</Steps>

<Tool_Usage>
- Use `AskUserQuestion` for each interview question — provides clickable UI with contextual options
- Use `Task(subagent_type="explore", model="haiku")` for brownfield codebase exploration (run BEFORE asking user about codebase)
- Use opus model (temperature 0.1) for ambiguity scoring — consistency is critical
- Use `Write` tool to persist interview state JSON to `.agent-memory/state/interview-state.json` between rounds; `Read` when resuming
- Use `Write` tool to save the final spec to `.agent-memory/specs/`
- Challenge agent modes are prompt injections, not separate agent spawns
</Tool_Usage>

<Examples>
<Good>
Targeting weakest dimension:
```
Scores: Goal=0.9, Constraints=0.4, Criteria=0.7
Next question targets Constraints (lowest at 0.4):
"You mentioned this should 'work on mobile'. Does that mean a native app,
a responsive web app, or a PWA? And are there specific devices or OS versions
you need to support?"
```
Why good: Identifies weakest dimension, explains why it is now the bottleneck, asks a specific question to improve it, and doesn't batch multiple topics.
</Good>

<Good>
Gathering codebase facts before asking:
```
[spawns explore agent: "find authentication implementation"]
[receives: "Auth is in src/auth/ using JWT with passport.js"]

Question: "I found JWT authentication with passport.js in `src/auth/` (pattern match from explore).
For this new feature, should we extend the existing auth middleware or create
a separate authentication flow?"
```
Why good: Explored first, cited the repo evidence that triggered the question, then asked an informed confirmation question. Never asks the user what the code already reveals.
</Good>

<Good>
Contrarian mode activation:
```
Round 5 | Contrarian Mode | Ambiguity: 42%

You've said this needs to support 10,000 concurrent users. What if it only
needed to handle 100? Would the architecture change fundamentally, or is
the 10K number an assumption rather than a measured requirement?
```
Why good: Challenges a specific assumption (scale requirement) that could dramatically simplify the solution.
</Good>

<Good>
Early exit with warning:
```
User: "That's enough, just build it"
System: "Current ambiguity is 35% (threshold: 20%). Areas still unclear:
  - Success Criteria: 0.5 (How do we verify the search ranking algorithm works correctly?)
  - Constraints: 0.6 (No performance targets defined yet)

Proceeding may require rework. Continue anyway?"
  [Yes, proceed] [Ask 2-3 more questions] [Cancel]
```
Why good: Respects user's desire to stop but transparently shows the risk.
</Good>

<Good>
Ontology convergence tracking:
```
Round 3 entities: User, Task, Project (stability: N/A → 67%)
Round 4 entities: User, Task, Project, Tag (stability: 75% — 3 stable, 1 new)
Round 5 entities: User, Task, Project, Tag (stability: 100% — all 4 stable)

"Ontology has converged — the same 4 entities appeared in 2 consecutive rounds
with no changes. The domain model is stable."
```
Why good: Shows entity tracking across rounds with visible convergence. Stability ratio increases as the domain model solidifies, giving mathematical evidence that the interview is converging on a stable understanding.
</Good>

<Good>
Ontology-style question for scope-fuzzy tasks:
```
Round 6 | Targeting: Goal Clarity | Why now: the core entity is still unstable across rounds, so feature questions would compound ambiguity | Ambiguity: 38%

"Across the last rounds you've described this as a workflow, an inbox, and a planner. Which one is the core thing this product IS, and which ones are supporting metaphors or views?"
```
Why good: Uses ontology-style questioning to stabilize the core noun before drilling into features, which is the right move when the scope is fuzzy rather than merely incomplete.
</Good>

<Bad>
Batching multiple questions:
```
"What's the target audience? And what tech stack? And how should auth work?
Also, what's the deployment target?"
```
Why bad: Four questions at once — causes shallow answers and makes scoring inaccurate.
</Bad>

<Bad>
Asking about codebase facts:
```
"What database does your project use?"
```
Why bad: Should have spawned explore agent to find this. Never ask the user what the code already tells you.
</Bad>

<Bad>
Proceeding despite high ambiguity:
```
"Ambiguity is at 45% but we've done 5 rounds, so let's start building."
```
Why bad: 45% ambiguity means nearly half the requirements are unclear. The mathematical gate exists to prevent exactly this.
</Bad>
</Examples>

<Escalation_And_Stop_Conditions>
- **Hard cap at 20 rounds**: Proceed with whatever clarity exists, noting the risk
- **Soft warning at 10 rounds**: Offer to continue or proceed
- **Early exit (round 3+)**: Allow with warning if ambiguity > threshold
- **User says "stop", "cancel", "abort"**: Stop immediately, save state for resume
- **Ambiguity stalls** (same score +-0.05 for 3 rounds): Activate Ontologist mode to reframe
- **All dimensions at 0.9+**: Skip to spec generation even if not at round minimum
- **Codebase exploration fails**: Proceed as greenfield, note the limitation
</Escalation_And_Stop_Conditions>

<Final_Checklist>
- [ ] Interview completed (ambiguity ≤ threshold OR user chose early exit)
- [ ] Ambiguity score displayed after every round
- [ ] Every round explicitly names the weakest dimension and why it is the next target
- [ ] Challenge agents activated at correct thresholds (round 4, 6, 8)
- [ ] Spec file written to `.agent-memory/specs/interview-{slug}.md`
- [ ] Spec includes: goal, constraints, acceptance criteria, clarity breakdown, transcript
- [ ] Brownfield confirmation questions cite repo evidence (file/path/pattern) before asking the user to decide
- [ ] Scope-fuzzy tasks can trigger ontology-style questioning to stabilize the core entity before feature elaboration
- [ ] Per-round ambiguity report includes Ontology row with entity count and stability ratio
- [ ] Spec includes Ontology (Key Entities) table and Ontology Convergence section
- [ ] Handoff message reported to user with spec path and summary
- [ ] State file (`.agent-memory/state/interview-state.json`) removed after completion
</Final_Checklist>

<Advanced>
## Resume

If interrupted, run the skill again. It reads state from `.agent-memory/state/interview-state.json` and resumes from the last completed round.

## Brownfield vs Greenfield Weights

| Dimension | Greenfield | Brownfield |
|-----------|-----------|------------|
| Goal Clarity | 40% | 35% |
| Constraint Clarity | 30% | 25% |
| Success Criteria | 30% | 25% |
| Context Clarity | N/A | 15% |

Brownfield adds Context Clarity because modifying existing code safely requires understanding the system being changed.

## Challenge Agent Modes

| Mode | Activates | Purpose | Prompt Injection |
|------|-----------|---------|-----------------|
| Contrarian | Round 4+ | Challenge assumptions | "What if the opposite were true?" |
| Simplifier | Round 6+ | Remove complexity | "What's the simplest version?" |
| Ontologist | Round 8+ (if ambiguity > 0.3) | Find essence | "What IS this, really?" |

Each mode is used exactly once, then normal Socratic questioning resumes. Modes are tracked in state to prevent repetition.

## Ambiguity Score Interpretation

| Score Range | Meaning | Action |
|-------------|---------|--------|
| 0.0 - 0.1 | Crystal clear | Proceed immediately |
| 0.1 - 0.2 | Clear enough | Proceed (default threshold) |
| 0.2 - 0.4 | Some gaps | Continue interviewing |
| 0.4 - 0.6 | Significant gaps | Focus on weakest dimensions |
| 0.6 - 0.8 | Very unclear | May need reframing (Ontologist) |
| 0.8 - 1.0 | Almost nothing known | Early stages, keep going |
</Advanced>

Task: $ARGUMENTS
