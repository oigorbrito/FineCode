// Local copy of the repository's issues (the corpus), synced incrementally with the gh CLI, plus keyword search.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

export const REPO = "earendil-works/pi";
const MAX_BODY = 16_000;

export interface Issue {
	number: number;
	title: string;
	body: string;
	state: "open" | "closed";
	stateReason: string | null;
	labels: string[];
	author: string;
	association: string;
	createdAt: string;
	updatedAt: string;
	comments: number;
}

export type PullRequestDecisionStatus = "pending" | "port" | "adapt" | "decline";

export interface PullRequestCommit {
	sha: string;
	message: string;
	author: string;
	authoredAt: string;
	url: string;
}

export interface PullRequestEvent {
	id: string;
	type:
		| "opened"
		| "updated"
		| "closed"
		| "reopened"
		| "merged"
		| "head_updated"
		| "draft_changed"
		| "base_changed"
		| "commit"
		| "reviewed"
		| "labeled"
		| "unlabeled";
	at: string;
	summary: string;
	commitSha?: string;
	headSha?: string;
}

export interface PullRequestDecision {
	status: PullRequestDecisionStatus;
	note: string;
	at: string;
}

export interface PullRequest {
	number: number;
	title: string;
	body: string;
	state: "open" | "closed";
	draft: boolean;
	merged: boolean;
	mergedAt: string | null;
	closedAt: string | null;
	labels: string[];
	author: string;
	association: string;
	createdAt: string;
	updatedAt: string;
	comments: number;
	headRef: string;
	headSha: string;
	baseRef: string;
	baseSha: string;
	mergeCommitSha: string | null;
	htmlUrl: string;
	commits: PullRequestCommit[];
	history: PullRequestEvent[];
	decision: PullRequestDecision | null;
	decisionHistory: PullRequestDecision[];
}

interface CorpusFile {
	syncedAt: string;
	issues: Record<string, Issue>;
	pullRequests?: Record<string, PullRequest>;
}

interface IssueSyncRecord extends Issue {
	isPullRequest: boolean;
}

type PullRequestSnapshot = Omit<PullRequest, "commits" | "history" | "decision" | "decisionHistory">;
type GithubApi = (args: string[]) => Promise<string>;

interface PullRequestTimelineItem {
	id: number | string | null;
	event: string;
	createdAt: string;
	actor: string | null;
	commitSha: string | null;
	headSha: string | null;
	label: string | null;
	stateReason: string | null;
}

const TIMELINE_EVENT_TYPES: Record<string, PullRequestEvent["type"]> = {
	closed: "closed",
	reopened: "reopened",
	merged: "merged",
	head_ref_force_pushed: "head_updated",
	head_ref_deleted: "head_updated",
	ready_for_review: "draft_changed",
	converted_to_draft: "draft_changed",
	committed: "commit",
	reviewed: "reviewed",
	labeled: "labeled",
	unlabeled: "unlabeled",
};

const ISSUE_FIELDS =
	'{number, title, body: (.body // ""), state, stateReason: .state_reason, labels: [.labels[].name], author: .user.login, association: .author_association, createdAt: .created_at, updatedAt: .updated_at, comments, isPullRequest: (.pull_request != null)}';
const PULL_REQUEST_FIELDS =
	'{number, title, body: (.body // ""), state, draft, merged: (.merged_at != null), mergedAt: .merged_at, closedAt: .closed_at, labels: [.labels[].name], author: .user.login, association: .author_association, createdAt: .created_at, updatedAt: .updated_at, comments, headRef: .head.ref, headSha: .head.sha, baseRef: .base.ref, baseSha: .base.sha, mergeCommitSha: .merge_commit_sha, htmlUrl: .html_url}';
const PULL_REQUEST_COMMIT_FIELDS =
	'{sha, message: .commit.message, author: (.commit.author.name // .author.login // "unknown"), authoredAt: (.commit.author.date // .commit.committer.date), url: .html_url}';
const PULL_REQUEST_TIMELINE_FIELDS =
	"{id, event, createdAt: .created_at, actor: (.actor.login // .user.login // null), commitSha: (.commit_id // null), headSha: (.after // null), label: (.label.name // null), stateReason: (.state_reason // null)}";

function parseJsonLines<T>(output: string): T[] {
	return output
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as T);
}

function truncateBody(body: string): string {
	return body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}\n[truncated]` : body;
}

function normalizeTimelineEvent(item: PullRequestTimelineItem): PullRequestEvent | undefined {
	const type = TIMELINE_EVENT_TYPES[item.event];
	if (!type) return undefined;
	const suffix = String(item.id ?? item.commitSha ?? item.headSha ?? item.label ?? item.actor ?? "event");
	const timelineId = `timeline:${item.event}:${suffix}`;
	const actor = item.actor ? ` by ${item.actor}` : "";
	switch (item.event) {
		case "closed":
			return {
				id: `closed:${item.createdAt}`,
				type,
				at: item.createdAt,
				summary: item.stateReason ? `Pull request closed (${item.stateReason})` : "Pull request closed",
			};
		case "reopened":
			return { id: `reopened:${item.createdAt}`, type, at: item.createdAt, summary: "Pull request reopened" };
		case "merged":
			return { id: `merged:${item.createdAt}`, type, at: item.createdAt, summary: "Pull request merged" };
		case "head_ref_force_pushed":
			return {
				id: item.headSha ? `head:${item.headSha}` : timelineId,
				type,
				at: item.createdAt,
				summary: item.headSha ? `Head force-pushed to ${item.headSha}` : `Head force-pushed${actor}`,
				headSha: item.headSha ?? undefined,
			};
		case "head_ref_deleted":
			return { id: timelineId, type, at: item.createdAt, summary: `Head branch deleted${actor}` };
		case "ready_for_review":
			return {
				id: `draft:${item.createdAt}:false`,
				type,
				at: item.createdAt,
				summary: "Marked ready for review",
			};
		case "converted_to_draft":
			return { id: `draft:${item.createdAt}:true`, type, at: item.createdAt, summary: "Marked as draft" };
		case "committed":
			return {
				id: item.commitSha ? `commit:${item.commitSha}` : timelineId,
				type,
				at: item.createdAt,
				summary: item.commitSha ? `Commit ${item.commitSha}` : `Commit added${actor}`,
				commitSha: item.commitSha ?? undefined,
			};
		case "reviewed":
			return { id: timelineId, type, at: item.createdAt, summary: `Review submitted${actor}` };
		case "labeled":
			return {
				id: timelineId,
				type,
				at: item.createdAt,
				summary: item.label ? `Label added: ${item.label}` : `Label added${actor}`,
			};
		case "unlabeled":
			return {
				id: timelineId,
				type,
				at: item.createdAt,
				summary: item.label ? `Label removed: ${item.label}` : `Label removed${actor}`,
			};
		default:
			return undefined;
	}
}

export class Corpus {
	private path: string;
	private data: CorpusFile;
	private api: GithubApi;

	constructor(path: string, initialDays: number, api: GithubApi = gh) {
		this.path = path;
		this.api = api;
		this.data = existsSync(path)
			? (JSON.parse(readFileSync(path, "utf8")) as CorpusFile)
			: { syncedAt: new Date(Date.now() - initialDays * 86_400_000).toISOString(), issues: {}, pullRequests: {} };
		this.data.pullRequests ??= {};
	}

	get syncedAt(): string {
		return this.data.syncedAt;
	}

	get(number: number): Issue | undefined {
		return this.data.issues[number];
	}

	all(): Issue[] {
		return Object.values(this.data.issues);
	}

	/** Fetch changed issues incrementally and refresh open PRs without writing to GitHub. */
	async sync(): Promise<number> {
		const startedAt = new Date(Date.now() - 60_000).toISOString();
		const historySince = new Date(Date.parse(this.data.syncedAt) - 60_000).toISOString();
		const issueRecords = parseJsonLines<IssueSyncRecord>(
			await this.api([
				"api",
				"-X",
				"GET",
				`repos/${REPO}/issues`,
				"-f",
				"state=all",
				"-f",
				`since=${this.data.syncedAt}`,
				"-f",
				"per_page=100",
				"-f",
				"sort=updated",
				"-f",
				"direction=asc",
				"--paginate",
				"--jq",
				`.[] | ${ISSUE_FIELDS}`,
			]),
		);
		const changedPullRequests = new Set<number>();
		let count = 0;
		for (const record of issueRecords) {
			if (record.isPullRequest) {
				changedPullRequests.add(record.number);
				continue;
			}
			const { isPullRequest: _isPullRequest, ...issue } = record;
			issue.body = truncateBody(issue.body);
			const unchanged = isDeepStrictEqual(this.data.issues[issue.number], issue);
			this.data.issues[issue.number] = issue;
			if (!unchanged) count++;
		}

		const openPullRequests = parseJsonLines<PullRequestSnapshot>(
			await this.api([
				"api",
				"-X",
				"GET",
				`repos/${REPO}/pulls`,
				"-f",
				"state=open",
				"-f",
				"per_page=100",
				"-f",
				"sort=updated",
				"-f",
				"direction=desc",
				"--paginate",
				"--jq",
				`.[] | ${PULL_REQUEST_FIELDS}`,
			]),
		);
		const openPullRequestNumbers = new Set<number>();
		for (const pullRequest of openPullRequests) {
			openPullRequestNumbers.add(pullRequest.number);
			if (await this.upsertPullRequest(pullRequest, historySince)) count++;
		}

		for (const number of changedPullRequests) {
			if (openPullRequestNumbers.has(number)) continue;
			const output = await this.api([
				"api",
				"-X",
				"GET",
				`repos/${REPO}/pulls/${number}`,
				"--jq",
				PULL_REQUEST_FIELDS,
			]);
			const pullRequest = JSON.parse(output) as PullRequestSnapshot;
			if (await this.upsertPullRequest(pullRequest, historySince)) count++;
		}

		this.data.syncedAt = startedAt;
		this.persist();
		return count;
	}

	allPullRequests(): PullRequest[] {
		return Object.values(this.data.pullRequests ?? {});
	}

	decidePullRequest(number: number, status: PullRequestDecisionStatus, note = ""): void {
		const pullRequest = this.data.pullRequests?.[number];
		if (!pullRequest) throw new Error(`Pull request #${number} is not in the corpus`);
		const decision = { status, note, at: new Date().toISOString() };
		pullRequest.decision = decision;
		pullRequest.decisionHistory.push(decision);
		this.persist();
	}

	private async upsertPullRequest(snapshot: PullRequestSnapshot, historySince: string): Promise<boolean> {
		let pullRequests = this.data.pullRequests;
		if (!pullRequests) {
			pullRequests = {};
			this.data.pullRequests = pullRequests;
		}
		const previous = pullRequests[snapshot.number];
		const history = previous ? [...previous.history] : [];
		const commits = previous ? [...previous.commits] : [];
		const knownCommitShas = new Set(commits.map((commit) => commit.sha));
		const headChanged = !previous || previous.headSha !== snapshot.headSha;
		const fetchedCommits = headChanged ? await this.getPullRequestCommits(snapshot.number) : [];
		const timelineChanged = !previous || previous.updatedAt !== snapshot.updatedAt || headChanged;
		const withinHistoryWindow = Date.parse(snapshot.updatedAt) >= Date.parse(historySince);
		const timeline = timelineChanged && withinHistoryWindow ? await this.getPullRequestTimeline(snapshot.number) : [];
		let changed = !previous;
		const addEvent = (event: PullRequestEvent): void => {
			if (history.some((existing) => existing.id === event.id)) return;
			history.push(event);
			changed = true;
		};
		if (
			previous &&
			(previous.title !== snapshot.title ||
				previous.body !== truncateBody(snapshot.body) ||
				previous.state !== snapshot.state ||
				previous.draft !== snapshot.draft ||
				previous.merged !== snapshot.merged ||
				previous.mergedAt !== snapshot.mergedAt ||
				previous.closedAt !== snapshot.closedAt ||
				previous.updatedAt !== snapshot.updatedAt ||
				previous.headSha !== snapshot.headSha ||
				previous.baseRef !== snapshot.baseRef ||
				previous.baseSha !== snapshot.baseSha ||
				previous.comments !== snapshot.comments ||
				JSON.stringify(previous.labels) !== JSON.stringify(snapshot.labels))
		) {
			changed = true;
		}

		if (!previous) {
			addEvent({
				id: `opened:${snapshot.createdAt}`,
				type: "opened",
				at: snapshot.createdAt,
				summary: "Pull request opened",
			});
			if (snapshot.updatedAt !== snapshot.createdAt) {
				addEvent({
					id: `updated:${snapshot.updatedAt}`,
					type: "updated",
					at: snapshot.updatedAt,
					summary: "Pull request updated",
				});
			}
			if (snapshot.state === "closed") {
				addEvent({
					id: `closed:${snapshot.closedAt ?? snapshot.updatedAt}`,
					type: "closed",
					at: snapshot.closedAt ?? snapshot.updatedAt,
					summary: "Pull request closed",
				});
			}
			if (snapshot.merged && snapshot.mergedAt) {
				addEvent({
					id: `merged:${snapshot.mergedAt}`,
					type: "merged",
					at: snapshot.mergedAt,
					summary: "Pull request merged",
				});
			}
		} else {
			if (previous.state !== snapshot.state) {
				const reopened = snapshot.state === "open";
				const at = snapshot.closedAt ?? snapshot.updatedAt;
				addEvent({
					id: `${reopened ? "reopened" : "closed"}:${at}`,
					type: reopened ? "reopened" : "closed",
					at,
					summary: reopened ? "Pull request reopened" : "Pull request closed",
				});
			}
			if (!previous.merged && snapshot.merged && snapshot.mergedAt) {
				addEvent({
					id: `merged:${snapshot.mergedAt}`,
					type: "merged",
					at: snapshot.mergedAt,
					summary: "Pull request merged",
				});
			}
			if (previous.headSha !== snapshot.headSha) {
				addEvent({
					id: `head:${snapshot.headSha}`,
					type: "head_updated",
					at: snapshot.updatedAt,
					summary: `Head updated to ${snapshot.headSha}`,
				});
			}
			if (previous.draft !== snapshot.draft) {
				addEvent({
					id: `draft:${snapshot.updatedAt}:${snapshot.draft}`,
					type: "draft_changed",
					at: snapshot.updatedAt,
					summary: snapshot.draft ? "Marked as draft" : "Marked ready for review",
				});
			}
			if (previous.baseRef !== snapshot.baseRef) {
				addEvent({
					id: `base:${snapshot.updatedAt}:${snapshot.baseRef}`,
					type: "base_changed",
					at: snapshot.updatedAt,
					summary: `Base branch changed to ${snapshot.baseRef}`,
				});
			}
			if (previous.updatedAt !== snapshot.updatedAt) {
				addEvent({
					id: `updated:${snapshot.updatedAt}`,
					type: "updated",
					at: snapshot.updatedAt,
					summary: "Pull request updated",
				});
			}
		}

		for (const commit of fetchedCommits) {
			if (knownCommitShas.has(commit.sha)) continue;
			commits.push(commit);
			knownCommitShas.add(commit.sha);
			changed = true;
			addEvent({
				id: `commit:${commit.sha}`,
				type: "commit",
				at: commit.authoredAt,
				summary: commit.message.split("\n", 1)[0] ?? commit.sha,
				commitSha: commit.sha,
			});
		}
		for (const item of timeline) {
			if (!Number.isFinite(Date.parse(item.createdAt)) || Date.parse(item.createdAt) < Date.parse(historySince))
				continue;
			const event = normalizeTimelineEvent(item);
			if (event) addEvent(event);
		}

		history.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
		pullRequests[snapshot.number] = {
			...snapshot,
			body: truncateBody(snapshot.body),
			commits,
			history,
			decision: previous?.decision ?? null,
			decisionHistory: previous?.decisionHistory ?? [],
		};
		return changed;
	}

	private async getPullRequestTimeline(number: number): Promise<PullRequestTimelineItem[]> {
		return parseJsonLines<PullRequestTimelineItem>(
			await this.api([
				"api",
				"-X",
				"GET",
				`repos/${REPO}/issues/${number}/timeline`,
				"-f",
				"per_page=100",
				"--paginate",
				"--jq",
				`.[] | ${PULL_REQUEST_TIMELINE_FIELDS}`,
			]),
		);
	}

	private async getPullRequestCommits(number: number): Promise<PullRequestCommit[]> {
		return parseJsonLines<PullRequestCommit>(
			await this.api([
				"api",
				"-X",
				"GET",
				`repos/${REPO}/pulls/${number}/commits`,
				"-f",
				"per_page=100",
				"--paginate",
				"--jq",
				`.[] | ${PULL_REQUEST_COMMIT_FIELDS}`,
			]),
		);
	}

	private persist(): void {
		writeFileSync(`${this.path}.tmp`, JSON.stringify(this.data));
		renameSync(`${this.path}.tmp`, this.path);
	}

	/** Keyword search over titles and bodies, ranked by inverse document frequency; title hits weigh more. */
	search(query: string, exclude: number, limit = 10): Issue[] {
		const terms = tokenize(query);
		if (terms.length === 0) return [];
		const issues = this.all().filter((issue) => issue.number !== exclude);
		const docs = issues.map((issue) => ({ issue, title: issue.title.toLowerCase(), body: issue.body.toLowerCase() }));
		const phrase = query.toLowerCase().trim();
		const weights = terms.map((term) => {
			const df = docs.filter((doc) => doc.title.includes(term) || doc.body.includes(term)).length;
			return Math.log((docs.length + 1) / (df + 1));
		});
		return docs
			.map((doc) => {
				let score = 0;
				terms.forEach((term, i) => {
					if (doc.title.includes(term)) score += 3 * weights[i]!;
					else if (doc.body.includes(term)) score += weights[i]!;
				});
				if (phrase.length > 8 && (doc.title.includes(phrase) || doc.body.includes(phrase))) score *= 2;
				return { issue: doc.issue, score };
			})
			.filter((hit) => hit.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map((hit) => hit.issue);
	}

	/** How many issues the author filed before, and how many of those maintainers acted on. */
	authorStats(issue: Issue): { prior: number; actedOn: number } {
		const prior = this.all().filter((other) => other.author === issue.author && other.number < issue.number);
		return { prior: prior.length, actedOn: prior.filter(isActedOn).length };
	}
}

/** Open, fixed, or prioritized: a maintainer considered it worth working on. */
export function isActedOn(issue: Issue): boolean {
	return (
		issue.state === "open" ||
		issue.stateReason === "completed" ||
		issue.labels.includes("p0") ||
		issue.labels.includes("p1")
	);
}

export function issueStatus(issue: Issue): string {
	const labels = issue.labels.filter((label) => ["p0", "p1", "no-action", "untriaged"].includes(label));
	const state = issue.state === "open" ? "open" : `closed${issue.stateReason ? `:${issue.stateReason}` : ""}`;
	return labels.length ? `${state} ${labels.join(",")}` : state;
}

const STOPWORDS = new Set(
	"the and for with that this from when not are was but can does doesn have into after before about pi's pi issue bug feature request support add allow should".split(
		" ",
	),
);

function tokenize(text: string): string[] {
	const terms = text
		.toLowerCase()
		.split(/[^a-z0-9_./:-]+/)
		.map((term) => term.replace(/^[./:-]+|[./:-]+$/g, ""))
		.filter((term) => term.length >= 3 && !STOPWORDS.has(term));
	return [...new Set(terms)];
}

export function gh(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", args, { stdio: ["ignore", "pipe", "pipe"] });
		const out: Buffer[] = [];
		const err: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve(Buffer.concat(out).toString("utf8"));
			else
				reject(new Error(`gh ${args.slice(0, 3).join(" ")} failed: ${Buffer.concat(err).toString("utf8").trim()}`));
		});
	});
}
