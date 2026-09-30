# Planning process

How work goes from an idea to merged code. This is a slimmed-down version of hype-pie's
process.

```
idea ──► roadmap task ──► PRD ──► RFC ──► build PR(s)
IDEAS.md  ROADMAP.yaml    docs/prd  docs/rfc  worktree-<task-id>
```

1. **Idea:** it comes from Kai, or lands in `docs/IDEAS.md`.
2. **Roadmap task:** added to `docs/ROADMAP.yaml` with an `id`, `status: planned`,
   `estimate_h` and `depends`. The PM dashboard shows it straight away.
3. **PRD** (`docs/prd/<slug>.md`): the *what* and *why*. Needed for big or unclear work only.
4. **RFC** (`docs/rfc/<slug>.md`): the *how*. Architecture, data model, tests and
   alternatives.
5. **Build PR:** one worktree and PR per task, on branch `worktree-<task-id>`, so the
   dashboard can link the branch and PR to the task.

Statuses for PRDs and RFCs are **Draft**, **Accepted**, **Implemented** and **Superseded**.

## Index

| Feature | Status | Roadmap | PRD | RFC |
|---|---|---|---|---|
| Job application tracker | Draft (rev 2) | P1–P6 | [PRD](../prd/tracker.md) | — |
| Stack and data format | Accepted | P0 `stack-rfc`, gate `stack-gate` | [PRD](../prd/tracker.md) | [RFC](../rfc/stack.md) |
