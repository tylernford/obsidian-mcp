# Observability gap in autonomous live validation

_2026-04-20 — surfaced while running `checklists/08-navigation-commands.md` with an operator watching each tool call._

## The intent

The protocol is designed so Claude can run a checklist autonomously: each item is a single tool call with a concrete expected outcome, and Claude writes pass/fail based on tool responses plus optional read-back asserts. The theory: if the expected outcome can be checked via another MCP tool (`active_file_read`, `vault_read`, etc.), Claude doesn't need eyes on the Obsidian UI.

## What actually happened

Claude correctly marked both failures the protocol is capable of catching:

- §1.2 — `file_open` with `newLeaf: true` did not shift active-file focus. Caught because the assertion reads the active file.
- §2.1 — `file_open` on a nonexistent path returned success. Claude recorded this as option (b) ("success with no actual file opened") and passed it.

But §2.1 was not actually a pass. Running it one-at-a-time with an operator watching Obsidian revealed:

1. The tool **created an empty file** at `sandbox/does-not-exist.md`.
2. That empty file triggered **Templater's new-file hook**, popping a template picker modal.

Neither side effect shows up in any tool response Claude has access to. `active_file_read` returning empty string was consistent with "active file is empty" (the newly-created empty file), but Claude read it as "no file is active" because that's what the expected-outcome wording allowed. The file was silently created on disk; the modal was a UI-only event.

Autonomous mode would have marked §2.1 a clean pass and logged nothing. Only when the operator said *"the template picker opened"* did the real behavior surface.

## What this means for the protocol

**Tool-level pass/fail is not the same as correct behavior.** The autonomous protocol can verify:

- Response shape and content of the tool under test.
- State changes observable via another MCP tool.

It cannot verify:

- Files created/modified **outside** the path the test targeted.
- UI modals, focus changes, or plugin side effects that don't surface in any MCP response.
- Whether a "success" response corresponds to the user-visible outcome the checklist author had in mind.

The larger the vault's plugin footprint (Templater, QuickAdd, file-creation hooks), the more the autonomous protocol can be fooled by success responses that hide real divergence.

## Other surprises from this run

- §1.3 presupposes §1.2 succeeded. With §1.2 failing, the "replace current tab" test runs against stale state and passes vacuously. Claude had no way to notice this; the operator flagged it mid-run.
- §1.3 also cannot distinguish "replaced current tab" from "focus-switched to an already-open tab" (Obsidian's tab dedupe). Again: invisible to Claude, visible to the operator.
- §4.3's "close all tabs" precondition is an operator action, but in one-at-a-time mode Claude ran the test before the operator closed tabs, because "next" was ambiguous. Had to redo the step.

## Suggested directions (not decisions)

1. **Operator-verified items.** Mark specific checklist items as requiring a human observation of Obsidian UI. Claude runs them but defers pass/fail to the operator. The README already implies this for §1.2 ("Operator visually confirms a new tab was opened") but doesn't carry the concept to §2.1 or §4.3.
2. **Stricter expected-outcome wording.** §2.1's "option (b) success with no actual file opened" was too lenient — it didn't forbid silent file creation. Expected outcomes should enumerate what must NOT happen, not just what must.
3. **Filesystem diff as an out-of-band check.** Between setup and teardown, snapshot `sandbox/` and diff at the end. Any file in the diff not explicitly created by the checklist is a side-effect worth flagging. (Would need a mechanism that respects the "no direct filesystem reads on vault" rule — perhaps `vault_list` before and after.)
4. **Plugin-state isolation.** The test vault runs real plugins (Templater, Dataview, Spaced Repetition, etc.). A minimally-configured test vault would narrow side-effect surface, at the cost of not exercising realistic conditions.

None of these are required to ship the current protocol — but the §2.1 result is a concrete example of autonomous pass/fail producing false confidence, and the protocol should at minimum acknowledge the gap.

## A class of test between hermetic and human

The autonomous protocol is not a unit test and not user testing. It sits between them in a way that seems worth naming.

Traditional tests are hermetic: they assert against return values and internal state. They do not model what the user sees; they rely on the fact that if the pieces return the right shapes, the user-visible behavior follows.

User testing is the opposite: a human exercises the real product and reports what is broken or surprising. High fidelity, low throughput, poorly reproducible.

The live-validation protocol is neither. The items are scripted and deterministic like a test suite, but the expected outcomes are written in product-behavior terms — "file opens", "tab appears", "command has no side effect" — not in return-value terms. An LLM can verify a subset of those outcomes with high confidence using its tools. The rest are invisible to it, and the invisibility only surfaces when a human happens to observe.

This suggests a tiering model. Every checklist item sits on a continuum defined by what evidence the LLM can reach:

1. **Fully tool-verifiable.** The tool under test produces state that another MCP tool can read back. `vault_read` after `vault_create` is the canonical case.
2. **Tool-verifiable with assumptions.** A read-back exists, but only confirms the outcome under the assumption that tool semantics match the checklist's intent. §1.2 sits here — the read-back caught the focus failure because the assumption was explicit.
3. **Not tool-verifiable; human observable.** The divergence is real but invisible to any MCP tool. §2.1's silent file creation and the Templater side effect are examples.
4. **Not verifiable at all.** Acknowledged gaps — worth marking rather than pretending they pass.

The practical payoff of tiering is that human attention can be spent deliberately. Tier-1 items run unattended. Tier-3 items are marked in the checklist as requiring a human observation, and the operator intervenes only at those points. This keeps the throughput advantage of scripted testing while acknowledging where the LLM's senses stop.

Whether this framing is novel is not the point. The point is that writing checklists without tiering — as this protocol currently does — produces silent false passes in the exact places where tool responses and user-visible behavior diverge. §2.1 is a concrete instance. The cost of formalizing tiers is low; the cost of not doing so is that a clean report can still mask behavior the tool should be rejecting.
