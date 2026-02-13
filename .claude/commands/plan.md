# /plan

You are starting an **Implementation Session** — Phase 1: Plan

This session will take you through Plan → Build → Document.

---

## Your Role

Break the design into atomic, executable tasks with clear commit points. You propose, the user approves.

---

## Prerequisite

If the user does not provide a design doc path, ask them for the file path.

---

## Announce Your Location

Every response must begin with:
```
**Phase 2: Plan** | Step [N]: [Step Name]
```

---

## Steps

### Step 1: Load Design Document

- Read the design document
- Summarize the key requirements and acceptance criteria
- Confirm this is the correct feature to plan

### Step 2: Codebase Verification

**Note:** The design document may have been written days or weeks ago. The codebase may have changed since then.

- Verify assumptions in the design doc match the actual codebase
- Check for existing patterns, utilities, or components to leverage
- Flag any discrepancies between design assumptions and reality
- Update understanding based on findings

### Step 3: Task Creation

Break the design into right-sized tasks (15-45 min each).

Each task must include:
- **Description**: Clear statement of what to do
- **Files**: Specific paths to create/modify
- **Code example**: Where helpful for clarity
- **Done when**: Expected output / how to verify completion
- **Commit message**: What to commit as

Present tasks to user for review. Adjust based on feedback.

### Step 4: Plan Validation

- Review task list against design doc requirements
- Confirm all requirements are covered by tasks
- Confirm all acceptance criteria are testable
- Check task ordering makes sense (dependencies)

---

## Write Implementation Plan

Before creating the file, run `date +%Y-%m-%d-%H%M` to get the current timestamp.

Create the implementation plan at:
```
docs/implementation-plans/YYYY-MM-DD-HHMM-feature-name.md
```

Use the template at `docs/templates/implementation-plan.md` as your guide.

---

## Update Design Doc

After creating the implementation plan, update the design doc's header:
- Replace `[link to implementation plan doc]` with the actual path to the implementation plan (e.g., `docs/implementation-plans/YYYY-MM-DD-HHMM-feature-name.md`)

---

## Phase Complete

When the implementation plan is written, announce:

```
**Phase 2: Plan** | Complete

Implementation plan created at: docs/implementation-plans/YYYY-MM-DD-HHMM-feature-name.md

**Commit checkpoint:** Commit the implementation plan before ending this session.

Next: End this session and start a new Claude Code session.
Run `/build` to begin Phase 3: Build.
```

---

## Task Sizing Guide

**Right-sized (15-45 min):**
- Coherent unit of work
- Independently verifiable
- Makes a sensible commit

**Too small:**
- "Add import statement"
- "Create empty file"

**Too large:**
- "Implement entire feature"
- "Build the component with all variants"

**Example breakdown:**
| Task | Commit |
|------|--------|
| Create component with base structure | "Add ComponentName base structure" |
| Add responsive layout | "Add ComponentName responsive layout" |
| Add variants (compact, featured) | "Add ComponentName variants" |
| Integrate with system | "Integrate ComponentName with SystemName" |
| Add tests/stories | "Add ComponentName tests" |

---

## Rules

1. **Verify before planning** - Check codebase matches design assumptions
2. **Right-size tasks** - 15-45 min each, one commit per task
3. **Be specific** - Include file paths, not vague descriptions
4. **User approves** - Get sign-off on task list before finalizing
5. **Stay local** - All files created must stay within the current project directory. No system-level or global configuration changes.
6. **No git operations** - Never run git commands (commit, add, push, etc.). User handles all version control manually.
7. **Slash commands only** - Phase transitions happen ONLY via explicit `/command`. Never auto-advance based on natural language like "let's start building."
8. **One phase per session** - Complete this phase, then end the session. Next phase starts fresh with docs as the handoff.
