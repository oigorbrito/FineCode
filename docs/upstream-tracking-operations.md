# Pi upstream tracking operations (Block 320)

## Scope and governance

This is P1 repository infrastructure, independent of the P0 Core migration. No
Core/package implementation, dependency, release, or publishing changes are needed.

The tracker mirrors metadata as **issues**, including PR metadata independently
of the code importer. A merged upstream PR does not authorize a FineCode merge.
Local state, labels, assignees, milestones, and review decisions are not updated.
Only new mirrors receive initial classification labels; later upstream label
changes appear as information in the managed body, not as local decisions.

## Workflow audit

Verified via the GitHub Actions API on 2026-10-20:

| Workflow | API state | Triggers (unchanged) | Permissions | Latest observed run |
| --- | --- | --- | --- | --- |
| `pi-upstream-tracker.yml` | `active` | `17 */6 * * *`, manual | `contents: read`, `issues: write` | [39417661831](https://github.com/oigorbrito/FineCode/actions/runs/39417661831), schedule, success |
| `import-pi-upstream-prs.yml` | `active` | `31 * * * *`, manual | `contents: write`, `pull-requests: write` | [39389329305](https://github.com/oigorbrito/FineCode/actions/runs/39389329305), schedule, success |

No workflows were enabled: both were already active. No unrelated workflows or
repository settings were changed. Both use `cancel-in-progress: false` and their
existing concurrency groups. The tracker cannot push branches or merge PRs.
The importer needs branch/PR writes, uses ordinary fast-forward pushes, checks
saved branch tips, and leaves divergent branches for human review. Its code and
workflow are unchanged in this block. Its checkout resets affect only the
throwaway Actions checkout, not remote branches. Neither workflow executes
imported code, closes FineCode issues/PRs, or uses extra upstream credentials.

## Reconciliation and resumption

Problem: open-only queries never revisit an issue after upstream closes it.
A seven-day release window can also expire before its write turn arrives.

The replacement reads complete paginated inventories with `state=all` (issues
and PRs), all published non-draft releases, and all local issues. There is no
page cap or time cutoff. All inventories are read before metadata writes begin.
PR `merged_at` distinguishes merged from closed without merge. Draft/head/base,
upstream labels, issue state reason/milestone/assignees, and release prerelease
metadata are informational fields.

`FineCode-Upstream-Key` remains the immutable identity. The managed metadata
block persisted on each mirror is its **per-record checkpoint**. This is an
equivalent replay mechanism rather than a global time cursor:

1. Read persisted mirrors, including locally closed ones.
2. Compare each desired title and managed block with the persisted record.
3. Skip completed records without spending writes.
4. Commit each changed record in one issue POST/PATCH.
5. Defer remaining changes when that stream's budget is exhausted.
6. On the next run, rescan all inventories and skip the committed records.

For example, a 15-record backlog with a budget of 10 writes produces 10 writes
then 5 on the next run. Even a timeout after GitHub accepted a POST is recovered
from the next local inventory without another POST. A manifest or cache is not
required for correctness and may be deleted without losing progress.

Previously mirrored records are checked before new records, then ordered by
upstream update time (oldest first) and key. Separate budgets are 10 issue,
10 PR metadata, and 10 release writes per run. Releases no longer compete with
issues. Label provisioning is separate and only creates missing label definitions.

Updates send **only title and body**, never local state or labels. Human content
outside the managed block is preserved. On the first legacy update, the old
body is retained verbatim in a collapsed historical section. Duplicate keys,
conflicting identities, or malformed managed blocks fail closed for manual repair.
Do not edit identity or block delimiters as part of ordinary review.

## Failures and evidence

`upstream-tracker-manifest.json` records `complete`, `deferred`, or `failed`,
per-stream counts, completed mutations and local issue numbers, and API errors.
For HTTP errors it includes status, `Retry-After`, and rate-limit reset when
available. Exceptions fail the Actions job; they are not reported as success.
The evidence upload runs even after tracker failure when a manifest exists,
with 90-day retention. A killed process can lose its manifest but not committed
mirror checkpoints. Retry by normal schedule or manual dispatch after the rate
limit reset; no cursor repair or force push is needed.

Inspect with:

```sh
gh workflow list --all
gh run list --workflow pi-upstream-tracker.yml --limit 3
gh run view <run-id> --log
gh run download <run-id> --name upstream-tracker-manifest-<run-id>
```

The code importer retains its independent `upstream-import-manifest` artifact.
No auto-merge, publishing, release, or auto-close workflow was enabled or invoked.

## Consolidated validation

```sh
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -p 'test_upstream_*.py' -v
npm run check
```

27 tests passed: creation, updates, upstream close/reopen/merge, old releases,
metadata edits, pagination beyond 1,000 records, budget/resume, repeated-run
idempotency, locally closed mirrors, human labels/notes, legacy migration,
ambiguous POST responses, read failures, rate limits, duplicate identities,
malformed blocks, and PR importer history/conflict/divergence regressions.
Two existing importer tests now restore cwd before temporary-directory cleanup,
which is required on Windows. Production importer behavior is unchanged.

`npm run check` passed after copying the existing ignored local provider data
into the isolated worktree. Its first invocation lacked those model data files.
Biome also reformatted two unrelated existing TypeScript files; those incidental
changes were discarded and are not included. No dependency or lockfile changed.

A live **GET-only** snapshot was replayed through the actual tracker with writes
simulated in memory (no production mutation and no paid provider calls):

- FineCode inventory: 473 issues/PRs.
- Pi issues endpoint: 10,766 records, including PRs; 7,298 non-PR issues selected.
- Pi pulls endpoint: 3,474 PRs in all states.
- Pi releases endpoint: 274 published releases.

| Replay | Issue writes / unchanged / deferred | PR writes / unchanged / deferred | Release writes / unchanged / deferred |
| --- | --- | --- | --- |
| 1 | 10 / 0 / 7,288 | 10 / 0 / 3,464 | 10 / 0 / 264 |
| 2 | 10 / 10 / 7,278 | 10 / 10 / 3,454 | 10 / 10 / 254 |
| 3 | 10 / 20 / 7,268 | 10 / 20 / 3,444 | 10 / 20 / 244 |

All three correctly reported `deferred`, not complete. Existing mappings such as
`issue:7553` -> FineCode #446 and `pr:8057` -> #473 were updated rather than
recreated. Releases older than seven days were not discarded. The local test
suite separately proves zero writes on an unchanged converged inventory and
actual closed/reopened/merged state transitions.

## Remaining limits and deployment gate

- This PR must be reviewed and manually merged before scheduled runs use the
  new reconciler. Existing workflows are operational, but their successful runs
  above do **not** prove production execution of the proposed code. No production
  reconciliation with this branch was performed.
- Full scans trade API reads for a simple durable replay log. Expect hundreds
  of GET requests and several minutes per run with the current upstream size.
  API failures stop safely and are retried later; no automatic rapid retry loop.
- Historical backfill is large: 7,298 issues at 40 writes/day is at least about
  183 days if all need a write, before accounting for churn. Already mirrored
  updates take priority. New records have no latency SLA during this backlog.
  Schedules and existing issue/PR budgets were intentionally not increased.
  Use manifest counts as evidence for a separately reviewed budget decision.
- GitHub pagination is not an atomic snapshot. Stable creation ordering reduces
  movement; a concurrent creation or edit is recovered by the next complete
  scan. Deleted/transferred/inaccessible upstream records are not automatically
  removed or closed locally.
- The importer retains its existing open-PR discovery limits and rotation.
  Complete metadata tracking does not claim complete code import or patch
  compatibility; porting and acceptance remain human decisions.
- Once merged, inspect two scheduled tracker manifests: verify completed keys
  become unchanged, deferred counts progress, and upstream closures change only
  the informational state. Do not declare the full backlog converged prematurely.
