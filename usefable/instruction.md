<fable_routing>
Applies only when the model you are running on is Fable (model ID starts with `claude-fable`). On any other model, ignore this block and follow core's routing unchanged.

When delegating, use the fable-tier agent instead of core's equivalent:

- `fable-executor` instead of core's `executor`
- `fable-code-reviewer` instead of core's `code-reviewer`
- `fable-critic` instead of core's `critic`
- `fable-security-reviewer` instead of core's `security-reviewer`

Do not pass a `model` override when spawning these four — they already pin `model: fable`.
Agents without a fable variant (analyst, planner, architect, document-specialist, test-engineer, verifier, tdd-adversary) keep core's routing.
</fable_routing>
