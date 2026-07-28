<!-- verity-memory:start -->
## Project Memory

This project has a knowledge graph maintained at `.verity/memory/`. Before starting
non-trivial work, scan `.verity/memory/index.md` for decisions, gotchas, and patterns
that may apply to the change you are about to make. Open specific node files via
the Read tool when the title or scope suggests relevance.

The graph is auto-maintained by Verity. Files at `.verity/memory/_archive/` are
superseded — ignore them unless investigating history.

> Durable, hand-curated guidance goes in the preserve region below (it survives
> regeneration) or anywhere OUTSIDE these markers. Everything else between the
> markers is tool-owned and overwritten on each run.

<!-- verity-memory:preserve -->
<!-- Add binding, hand-curated guidance here; it survives Verity regeneration. -->
<!-- /verity-memory:preserve -->
<!-- verity-memory:end -->

## Project Knowledge Base
> Read `.verity/memory/index.md` for accumulated project context, decisions, and conventions.

## Post-task reflection
When a task is complete (you've created a PR, the user says "done" or "ship it",
or the work is clearly finished), **draft the reflection yourself first** — 1–3
concrete things worth remembering (a decision, a gotcha, or a pattern), each
cited with the files / PR / commands / error-signatures it came from. Skip
entirely if nothing non-obvious happened.

Then, depending on how the session is running:

- **Interactive** (a person is at the keyboard): show your draft and ask one
  question before recording —

  > "Here's my reflection draft for the project memory: <draft>. Anything to
  > confirm, correct, or add before I record it? (Say 'skip' to drop it.)"

  Record the final text (with their corrections) via
  `verity reflect --user-input "<final reflection>" --kind <kind>`. If they say
  "skip", do not record.

- **Autonomous** (headless / CI / cron, or `VERITY_AUTONOMOUS=1`): record your
  draft directly, never blocking —
  `verity reflect --user-input "<your draft>" --kind <kind> --autonomous`.
