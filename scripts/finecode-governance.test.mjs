import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";

// https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions
for (const name of ["approve-contributor", "issue-gate", "pr-gate", "issue-triage-labels"]) {
	test(`${name} cannot apply upstream contributor governance to FineCode`, () => {
		const workflow = parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8"));
		assert.ok(Object.keys(workflow.jobs).length > 0);
		for (const job of Object.values(workflow.jobs)) {
			assert.equal(job.if, "github.repository == 'earendil-works/pi'");
		}
	});
}
