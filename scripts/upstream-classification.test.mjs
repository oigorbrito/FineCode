import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const lines = readFileSync(new URL("../docs/block324-upstream-classification.tsv", import.meta.url), "utf8").trimEnd().split(/\r?\n/);
const header = lines.shift().split("\t");
const rows = lines.map((line) => Object.fromEntries(line.split("\t").map((value, i) => [header[i], value])));

test("classifies exactly the 438 canonical paths without unresolved functional conflicts", () => {
	assert.equal(rows.length, 438);
	assert.equal(new Set(rows.map((row) => row.caminho)).size, 438);
	const allowed = new Set(["UPSTREAM_APPLIED", "SEMANTICALLY_INTEGRATED", "FINECODE_PRESERVED", "INTENTIONALLY_EXCLUDED", "PENDING_FUNCTIONAL_CONFLICT", "UNRELATED_LOCAL_CHANGE"]);
	for (const row of rows) {
		assert.ok(allowed.has(row.categoria), row.caminho);
		assert.notEqual(row.categoria, "PENDING_FUNCTIONAL_CONFLICT", row.caminho);
		assert.ok(row.evidencia && row.delta_revisado, row.caminho);
		assert.match(row.local_blob, /^(?:[a-f0-9]{40}|-)$/);
	}
});

test("keeps all 16 paths of the six excluded examples absent", () => {
	const excluded = rows.filter((row) => row.categoria === "INTENTIONALLY_EXCLUDED");
	assert.equal(excluded.length, 16);
	for (const row of excluded) assert.equal(existsSync(new URL(`../${row.caminho}`, import.meta.url)), false, row.caminho);
	const examples = new Set(excluded.map((row) => row.caminho.split("examples/extensions/")[1].split("/")[0]));
	assert.equal(examples.size, 6);
	const catalog = readFileSync(new URL("../packages/coding-agent/examples/extensions/README.md", import.meta.url), "utf8");
	assert.ok(catalog.includes("finecode --extension examples/extensions/permission-gate.ts"));
	for (const line of catalog.split("\n")) {
		const example = line.match(/^\| `([^`]+)`/);
		if (example) assert.equal(examples.has(example[1].replace(/\/$/, "")), false, example[1]);
	}
});

test("applies all 22 upstream executable modes without changing their blobs", () => {
	const modes = rows.filter((row) => row.modo_baseline === "100644" && row.modo_upstream === "100755");
	assert.equal(modes.length, 22);
	const index = execFileSync("git", ["ls-files", "--stage", "--", ...modes.map((row) => row.caminho)], { cwd: root, encoding: "utf8" });
	const entries = new Map(index.trimEnd().split("\n").map((line) => {
		const [metadata, path] = line.split("\t");
		return [path, metadata.split(" ")];
	}));
	for (const row of modes) {
		assert.equal(entries.get(row.caminho)?.[0], "100755", row.caminho);
		assert.equal(entries.get(row.caminho)?.[1], row.upstream_blob, row.caminho);
	}
});
