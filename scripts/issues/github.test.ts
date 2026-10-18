import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Corpus, type Issue, type PullRequestCommit } from "./github.ts";

function makeIssue(number: number, isPullRequest = false) {
	return {
		number,
		title: `Issue ${number}`,
		body: "issue body",
		state: "open" as const,
		stateReason: null,
		labels: ["bug"],
		author: "reporter",
		association: "NONE",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		comments: 0,
		isPullRequest,
	};
}

function makePullRequest(overrides: Partial<Record<string, unknown>> = {}) {
	const createdAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
	const updatedAt = new Date(Date.now() - 86_400_000).toISOString();
	return {
		number: 42,
		title: "Upstream change",
		body: "PR description",
		state: "open" as const,
		draft: false,
		merged: false,
		mergedAt: null,
		closedAt: null,
		labels: ["enhancement"],
		author: "contributor",
		association: "CONTRIBUTOR",
		createdAt,
		updatedAt,
		comments: 1,
		headRef: "feature",
		headSha: "head-1",
		baseRef: "main",
		baseSha: "base-1",
		mergeCommitSha: null,
		htmlUrl: "https://github.com/earendil-works/pi/pull/42",
		...overrides,
	};
}

function makeCommit(sha: string, message = `Commit ${sha}`): PullRequestCommit {
	return {
		sha,
		message,
		author: "contributor",
		authoredAt: "2026-05-02T00:00:00Z",
		url: `https://github.com/earendil-works/pi/commit/${sha}`,
	};
}

function makeTimelineEvent(id: number, event: string, createdAt: string, fields: Record<string, unknown> = {}) {
	return {
		id,
		event,
		createdAt,
		actor: "maintainer",
		commitSha: null,
		headSha: null,
		label: null,
		stateReason: null,
		...fields,
	};
}

function createCorpusFile(): { directory: string; path: string } {
	const directory = mkdtempSync(join(tmpdir(), "finecode-upstream-corpus-"));
	return { directory, path: join(directory, "corpus.json") };
}

function endpoint(args: string[]): string {
	const value = args.find((argument) => argument.startsWith("repos/earendil-works/pi/"));
	assert.ok(value, `missing repository endpoint in ${args.join(" ")}`);
	return value;
}

function assertReadOnly(calls: string[][]): void {
	assert.ok(calls.length > 0);
	for (const args of calls) {
		assert.equal(args[0], "api");
		const methodIndex = args.indexOf("-X");
		assert.notEqual(methodIndex, -1, `missing explicit HTTP method: ${args.join(" ")}`);
		assert.equal(args[methodIndex + 1], "GET", `non-read-only request: ${args.join(" ")}`);
	}
}

test("initial sync paginates issues and open PRs, deduplicates PR endpoints, and stays read-only", async (t) => {
	const { directory, path } = createCorpusFile();
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const calls: string[][] = [];
	const api = async (args: string[]) => {
		calls.push(args);
		const resource = endpoint(args);
		if (resource === "repos/earendil-works/pi/issues") {
			return `${JSON.stringify(makeIssue(10))}\n${JSON.stringify(makeIssue(42, true))}\n`;
		}
		if (resource === "repos/earendil-works/pi/pulls") return `${JSON.stringify(makePullRequest())}\n`;
		if (resource === "repos/earendil-works/pi/pulls/42/commits") {
			return `${JSON.stringify(makeCommit("older-commit"))}\n${JSON.stringify(makeCommit("head-1"))}\n`;
		}
		if (resource === "repos/earendil-works/pi/issues/42/timeline") return "";
		throw new Error(`unexpected endpoint ${resource}`);
	};
	const corpus = new Corpus(path, 120, api);
	const count = await corpus.sync();

	assert.equal(count, 2);
	assert.deepEqual(
		corpus.all().map((issue) => issue.number),
		[10],
	);
	assert.equal(corpus.allPullRequests().length, 1);
	const pullRequest = corpus.allPullRequests()[0]!;
	assert.equal(pullRequest.number, 42);
	assert.equal(pullRequest.state, "open");
	assert.deepEqual(
		pullRequest.commits.map((commit) => commit.sha),
		["older-commit", "head-1"],
	);
	assert.equal(pullRequest.history.filter((event) => event.type === "opened").length, 1);
	assert.equal(pullRequest.history.filter((event) => event.type === "commit").length, 2);
	assert.ok(calls.every((args) => args.includes("--paginate")));
	assertReadOnly(calls);

	const issueCall = calls.find((args) => endpoint(args) === "repos/earendil-works/pi/issues")!;
	const pullsCall = calls.find((args) => endpoint(args) === "repos/earendil-works/pi/pulls")!;
	const commitsCall = calls.find((args) => endpoint(args).endsWith("/commits"))!;
	const timelineCall = calls.find((args) => endpoint(args).endsWith("/timeline"))!;
	assert.ok(issueCall.at(-1)?.startsWith(".[] |"));
	assert.ok(pullsCall.at(-1)?.startsWith(".[] |"));
	assert.ok(commitsCall.at(-1)?.startsWith(".[] |"));
	assert.ok(timelineCall.at(-1)?.startsWith(".[] |"));
	const since = issueCall.find((argument) => argument.startsWith("since="))?.slice("since=".length);
	assert.ok(since);
	const ageDays = (Date.now() - Date.parse(since)) / 86_400_000;
	assert.ok(ageDays >= 119 && ageDays <= 121, `expected 120-day history, got ${ageDays.toFixed(1)} days`);
});

test("incremental sync counts only added or changed issues", async (t) => {
	const { directory, path } = createCorpusFile();
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const { isPullRequest: _isPullRequest, ...existingIssue } = makeIssue(7);
	const initialCursor = new Date(Date.now() - 7 * 86_400_000).toISOString();
	const nested = { flags: ["a", "b"], owner: "team" };
	writeFileSync(path, JSON.stringify({ syncedAt: initialCursor, issues: { 7: { ...existingIssue, metadata: nested } } }));
	let record = { ...makeIssue(7), metadata: { owner: "team", flags: ["a", "b"] } };
	const api = async (args: string[]) => {
		const resource = endpoint(args);
		if (resource === "repos/earendil-works/pi/issues") return JSON.stringify(record);
		if (resource === "repos/earendil-works/pi/pulls") return "";
		throw new Error(`unexpected endpoint ${resource}`);
	};
	const corpus = new Corpus(path, 120, api);

	assert.equal(await corpus.sync(), 0, "replayed equivalent issues should not be counted as changes");
	const firstSaved = JSON.parse(readFileSync(path, "utf8")) as { syncedAt: string; issues: Record<string, Issue> };
	assert.ok(Date.parse(firstSaved.syncedAt) > Date.parse(initialCursor), "successful sync should persist its cursor");
	assert.deepEqual(firstSaved.issues["7"], { ...existingIssue, metadata: nested });

	record = { ...record, title: "Updated issue" };
	assert.equal(await corpus.sync(), 1, "changed titles should still be counted");
	record = { ...record, body: "Updated issue body" };
	assert.equal(await corpus.sync(), 1, "changed content should still be counted");
	record = { ...record, labels: ["enhancement", "bug"] };
	assert.equal(await corpus.sync(), 1, "array order changes should remain observable");
	record = { ...makeIssue(8), metadata: { owner: "team", flags: ["a", "b"] } };
	assert.equal(await corpus.sync(), 1, "new issues should be counted");

	const restarted = new Corpus(path, 120, async () => {
		throw new Error("restart inspection must not call GitHub");
	});
	assert.equal(restarted.get(7)?.body, "Updated issue body");
	assert.equal(restarted.get(8)?.title, "Issue 8");
	assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).issues["7"].labels, ["enhancement", "bug"]);
});

test("incremental sync records merge, state, commit, decision, and restart history without duplicates", async (t) => {
	const { directory, path } = createCorpusFile();
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const { isPullRequest: _isPullRequest, ...existingIssue } = makeIssue(7);
	const initialCursor = new Date(Date.now() - 7 * 86_400_000).toISOString();
	writeFileSync(path, JSON.stringify({ syncedAt: initialCursor, issues: { 7: existingIssue } }));
	let phase: "open" | "merged" = "open";
	let mergedTimestamp = "";
	let timelineEvents: ReturnType<typeof makeTimelineEvent>[] = [];
	const calls: string[][] = [];
	const api = async (args: string[]) => {
		calls.push(args);
		const resource = endpoint(args);
		if (resource === "repos/earendil-works/pi/issues") return `${JSON.stringify(makeIssue(42, true))}\n`;
		if (resource === "repos/earendil-works/pi/pulls") {
			return phase === "open" ? `${JSON.stringify(makePullRequest())}\n` : "";
		}
		if (resource === "repos/earendil-works/pi/pulls/42") {
			return JSON.stringify(
				phase === "open"
					? makePullRequest()
					: makePullRequest({
							state: "closed",
							merged: true,
							mergedAt: mergedTimestamp,
							closedAt:
								timelineEvents.filter((event) => event.event === "closed").at(-1)?.createdAt ?? mergedTimestamp,
							updatedAt: mergedTimestamp,
							headSha: "head-2",
							mergeCommitSha: "merge-1",
						}),
			);
		}
		if (resource === "repos/earendil-works/pi/pulls/42/commits") {
			const commits = phase === "open" ? [makeCommit("head-1")] : [makeCommit("head-1"), makeCommit("head-2")];
			return commits.map((commit) => JSON.stringify(commit)).join("\n");
		}
		if (resource === "repos/earendil-works/pi/issues/42/timeline") {
			return timelineEvents.map((event) => JSON.stringify(event)).join("\n");
		}
		throw new Error(`unexpected endpoint ${resource}`);
	};

	const corpus = new Corpus(path, 120, api);
	await corpus.sync();
	const callsBeforeLocalDecision = calls.length;
	corpus.decidePullRequest(42, "adapt", "Port only the compatible fix");
	assert.equal(calls.length, callsBeforeLocalDecision, "local review decisions must not call GitHub");
	const firstCursor = corpus.syncedAt;
	const now = Date.now();
	const closedAt = new Date(now - 45_000).toISOString();
	const reopenedAt = new Date(now - 35_000).toISOString();
	const closedAgainAt = new Date(now - 25_000).toISOString();
	mergedTimestamp = new Date(now - 20_000).toISOString();
	timelineEvents = [
		makeTimelineEvent(1, "closed", closedAt),
		makeTimelineEvent(2, "reopened", reopenedAt),
		makeTimelineEvent(3, "closed", closedAgainAt),
		makeTimelineEvent(4, "merged", mergedTimestamp),
		makeTimelineEvent(5, "head_ref_force_pushed", mergedTimestamp, { headSha: "head-2" }),
		makeTimelineEvent(6, "committed", mergedTimestamp, { commitSha: "head-2" }),
	];
	phase = "merged";
	await corpus.sync();

	const merged = corpus.allPullRequests()[0]!;
	assert.equal(merged.state, "closed");
	assert.equal(merged.merged, true);
	assert.equal(merged.mergeCommitSha, "merge-1");
	assert.deepEqual(
		merged.commits.map((commit) => commit.sha),
		["head-1", "head-2"],
	);
	assert.equal(merged.history.filter((event) => event.type === "closed").length, 2);
	assert.equal(merged.history.filter((event) => event.type === "reopened").length, 1);
	assert.equal(merged.history.filter((event) => event.type === "merged").length, 1);
	assert.equal(merged.history.filter((event) => event.type === "head_updated").length, 1);
	assert.equal(merged.history.filter((event) => event.type === "commit" && event.commitSha === "head-2").length, 1);
	assert.equal(merged.decision?.status, "adapt");
	assert.equal(merged.decisionHistory.length, 1);
	assert.equal(corpus.get(7)?.title, "Issue 7");

	const secondCursor = corpus.syncedAt;
	assert.ok(Date.parse(secondCursor) >= Date.parse(firstCursor));
	phase = "merged";
	await corpus.sync();
	assert.equal(corpus.allPullRequests()[0]?.history.length, merged.history.length);
	assert.equal(corpus.allPullRequests()[0]?.commits.length, 2);

	const restarted = new Corpus(path, 120, async () => {
		throw new Error("restart inspection must not call GitHub");
	});
	assert.equal(restarted.get(7)?.title, "Issue 7");
	assert.equal(restarted.allPullRequests()[0]?.decision?.note, "Port only the compatible fix");
	assert.equal(restarted.allPullRequests()[0]?.decisionHistory.length, 1);
	assert.equal(restarted.allPullRequests()[0]?.history.length, merged.history.length);
	assertReadOnly(calls);
	assert.ok(calls.some((args) => args.includes(`since=${firstCursor}`)));
});
