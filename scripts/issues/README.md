# Upstream Pi issue and pull-request review

A local, read-only review tool for `earendil-works/pi`, the upstream Pi repository. It does not manage FineCode issues and never writes to GitHub. GitHub requests use the REST API with explicit `GET` methods only.

It runs in this order:

1. **Sync.** Keeps a local copy of upstream issues and pull requests in `data/corpus.json`. The initial issue sync covers the last 120 days; later issue syncs run every 20 minutes and use the saved `since` cursor. Each sync also refreshes every currently open PR, so long-running open PRs remain visible. PRs found through both the issues and pull-request endpoints are deduplicated by number. Closed or merged PRs are fetched when updated within the issue sync window. Paginated timeline events are read for newly seen or updated PRs, and paginated commit lists are refreshed when a PR is first seen or its head changes.
2. **Triage issues.** Each new issue gets its own conversation with a [pi-durable](../../packages/durable/README.md) agent. The agent:
   - searches the local copy for duplicates and related issues (`search_issues`, `read_issue`)
   - picks a category from `categories/*.md`
   - writes a one-sentence summary and signals
   - suggests p0, p1, or none
3. **Review.** The web UI retains the existing issue inbox and adds an **Upstream PRs** tab. PR cards show lifecycle state, branches, commits and observed changes. You can record a local decision (`Not reviewed`, `Port as-is`, `Adapt before porting`, or `Do not port`) and a private note. These are review markers only: no code is ported, merged, or otherwise integrated automatically.

The PR activity log deduplicates paginated GitHub timeline events and commit details, including lifecycle changes that occur between polling cycles. Timeline events are imported only from the shared sync cursor onward (120 days on first run); history already stored is not pruned. Recorded commit SHAs also remain in the local corpus. Issue triage, PR history, and review decisions are stored locally. Nothing is written to upstream GitHub. For GitHub-side notifications, use Watch settings for `earendil-works/pi`.

All state lives in `data/` (gitignored):

- `corpus.json`: local issue and PR copies, observed PR activity/commits, and PR review decisions/history
- `triage.sqlite`: pi-durable storage with one conversation per triaged issue, triage results, and issue decisions in the `triage.state` document
- `token`: the UI access token

Restarting the server resumes any triage runs that were in flight and preserves local decisions and sync cursors.

## Files

- `categories/*.md`: one file per issue category. The file name is the category label. The frontmatter `owner` is the GitHub user who owns the category.
- `prompt.md`: issue triage procedure and priority guidance given to the agent.
- `main.ts`: sync loop and HTTP server.
- `triage.ts`: durable issue-triage agent.
- `github.ts`: local corpus, read-only GitHub API access, PR activity, and issue keyword search.
- `ui.html`: local review UI.
- `source-hooks.mjs`, `register.mjs`: run workspace packages from source, so no build is needed.

## Run

```bash
./scripts/issues/run.sh   # http://127.0.0.1:7788
```

Open `http://127.0.0.1:7788/?t=<token>` once, with the token from `scripts/issues/data/token`. The server then sets a cookie, so later visits don't need the token.

The issue-triage agent authenticates through `~/.pi/agent/auth.json`, the same credentials pi uses. PR review is local and does not invoke an agent.

| Variable | Default | |
|---|---|---|
| `TRIAGE_MODEL` | `openai-codex/gpt-5.6-sol` | `provider/model`. Supported providers: `openai-codex`, `anthropic`. |
| `TRIAGE_THINKING` | `medium` | Thinking level |
| `TRIAGE_CONCURRENCY` | `4` | Parallel issue-triage runs |
| `TRIAGE_INBOX_DAYS` | `2` | On the first run, the inbox starts this many days back |
| `TRIAGE_CORPUS_DAYS` | `120` | Initial issue history; open PRs are listed regardless of age |
| `TRIAGE_SYNC_MINUTES` | `20` | Sync interval |
| `TRIAGE_PORT` | `7788` | Local port |
| `TRIAGE_SOCKET` | | Listen on this unix socket instead of the port, for a reverse proxy |
| `TRIAGE_DATA` | `scripts/issues/data` | State directory |

## UI keys

- `j`/`k`: move between issues
- `0`, `1`, `n`: set p0, p1, none
- `o`: open the selected issue on GitHub
