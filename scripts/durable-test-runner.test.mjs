import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

for (const failRetention of [false, true]) {
	test(`Durable runner launches portable configurations and propagates failure (${failRetention})`, () => {
		const root = mkdtempSync(join(tmpdir(), "durable runner "));
		try {
			mkdirSync(join(root, "scripts"));
			mkdirSync(join(root, "node_modules/vitest"), { recursive: true });
			copyFileSync(new URL("../packages/durable/scripts/test.mjs", import.meta.url), join(root, "scripts/test.mjs"));
			writeFileSync(join(root, "node_modules/vitest/package.json"), JSON.stringify({ name: "vitest" }));
			writeFileSync(
				join(root, "node_modules/vitest/vitest.mjs"),
				`console.log(JSON.stringify({ args: process.argv.slice(2), retention: process.env.PI_DURABLE_DOCUMENT_RETENTION_MS }));
if (process.env.FAKE_FAIL_RETENTION === "1" && process.env.PI_DURABLE_DOCUMENT_RETENTION_MS === "0") process.exitCode = 7;
`,
			);
			const result = spawnSync(process.execPath, [join(root, "scripts/test.mjs"), "--maxWorkers=2"], {
				cwd: root,
				encoding: "utf8",
				env: { ...process.env, PI_DURABLE_DOCUMENT_RETENTION_MS: "42", FAKE_FAIL_RETENTION: failRetention ? "1" : "0" },
			});
			assert.ifError(result.error);
			assert.equal(result.status, failRetention ? 7 : 0, result.stderr);
			const runs = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
			assert.deepEqual(runs, [
				{ args: ["--run", "--maxWorkers=2"], retention: "42" },
				{ args: ["--run", "--maxWorkers=2"], retention: "0" },
				...(failRetention ? [] : [{ args: ["--run", "--config", "test-workers/vitest.config.ts", "--maxWorkers=2"], retention: "42" }]),
			]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
}
