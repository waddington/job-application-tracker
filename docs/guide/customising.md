# Customising

Settings for your tracker live in **`config.toml` in your data folder** (not in the code),
so they travel with your data. `jat init` creates it:

```toml
[snapshot]
# Seconds without writes before the app commits a snapshot to this git repo.
debounce_seconds = 60

# [workflow]
# transitions = "any"        # move applications between any stages (default)
# transitions = "configured" # only allow the moves each stage lists in `next` (Jira-style)
```

Edit it in any text editor. Workflow changes take effect straight away (the app rereads the
file when it changes); snapshot timing takes effect when you restart `jat serve`. If the
workflow part has a mistake, pages that need it fail to load with an error starting
"invalid workflow in config.toml:" that says what's wrong (and the line, for a typo). Fix the
file and reload the page.

## The default stages

| Stage | Kind | Gone quiet after | Usual next |
|---|---|---|---|
| Interested | active | 14 days | Applied |
| Applied | active | 7 days | Screen, Interviewing |
| Screen | active | 5 days | Interviewing |
| Interviewing | active | 5 days | Final, Offer |
| Final | active | 5 days | Offer |
| Offer | active | 3 days | Accepted, Declined |
| Accepted | success | — | |
| Declined, Rejected, Withdrawn, Ghosted | closed | — | |

- **active** stages are in progress and can go quiet; **success** and **closed** stages are
  outcomes.
- Any active stage can move to a closed one, and **Ghosted** can be reopened (sometimes they
  do get back to you).

## Your own stages

Define the full list under `[workflow]`. Each stage has an `id` (used in the data; don't
change it once applications use it), a display `name`, a `kind`, an optional
`stale_after_days`, the usual `next` stages, and an optional `color` (a Mantine colour name:
gray, red, pink, grape, violet, indigo, blue, cyan, teal, green, lime, yellow, orange, dark).

```toml
[workflow]
initial = "applied"          # the stage new applications start in
transitions = "any"          # see below
skip_forward = true          # allow jumping ahead to any later active stage
reopen_from = ["ghosted"]    # stages that can go back to an active one

[[workflow.stages]]
id = "applied"
name = "Applied"
kind = "active"
stale_after_days = 7
next = ["recruiter_call"]
color = "blue"

[[workflow.stages]]
id = "recruiter_call"
name = "Recruiter call"
kind = "active"
stale_after_days = 4
next = ["tech_test", "rejected"]
color = "cyan"

[[workflow.stages]]
id = "tech_test"
name = "Tech test"
kind = "active"
stale_after_days = 7
next = ["offer"]
color = "violet"

[[workflow.stages]]
id = "offer"
name = "Offer"
kind = "success"
color = "green"

[[workflow.stages]]
id = "rejected"
name = "Rejected"
kind = "closed"
color = "red"

[[workflow.stages]]
id = "ghosted"
name = "Ghosted"
kind = "closed"
color = "dark"
```

The board shows stages in the order you list them; the Sankey diagram puts active stages
first, then outcomes.

**Removing a stage** that applications are still in doesn't lose them: they keep their old
stage. With `transitions = "any"` you can move them on as usual. With strict transitions
they'd be stuck there, so move them to a stage you're keeping *before* you remove it. (A
config that lists its own stages and doesn't set `transitions` is strict.)

## Strict, Jira-style transitions

By default (`transitions = "any"`) an application can move from any stage to any other;
real processes skip steps and loop back. The `next` lists are then only suggestions: they're
highlighted on the board and listed first under *Move to…*.

With `transitions = "configured"`, they're the rules. An active stage can then move to:
the stages in its `next`, any later active stage (if `skip_forward = true`), and any closed
stage. A `reopen_from` stage can move back to any active stage.

If you list your own stages and leave out `transitions`, the rules are enforced (that's how
older config files behaved). Add `transitions = "any"` to relax them.

## Snapshot timing

```toml
[snapshot]
debounce_seconds = 60   # 0 commits after every change
```

Restart `jat serve` after changing it. See [Snapshots](your-data.md#snapshots-automatic-local-history).

## Address and port

The app listens on `127.0.0.1:8770`. Change the port with `JAT_PORT` in `.env` or
`jat serve --port 8771`. See [Command reference](commands.md#settings).
