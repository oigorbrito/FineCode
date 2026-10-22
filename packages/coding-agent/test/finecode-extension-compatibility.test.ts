import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@earendil-works/pi-agent-core", () => ({ name: "agent" }));
vi.mock("@earendil-works/pi-ai/compat", () => ({ name: "ai-compat" }));
vi.mock("@earendil-works/pi-ai/oauth", () => ({ name: "ai-oauth" }));
vi.mock("@earendil-works/pi-ai/providers/all", () => ({ name: "ai-providers" }));
vi.mock("@earendil-works/pi-tui", () => {
	const module = { visibleWidth: (value: string) => value.length };
	return { ...module, default: module };
});
vi.mock("../src/index.ts", () => ({}));

import { loadExtensions } from "../src/core/extensions/loader.ts";
import { VIRTUAL_MODULES } from "../src/core/extensions/virtual-modules.ts";

let root: string | undefined;

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = undefined;
});

describe("FineCode extension module compatibility", () => {
	it("maps the former FineCode package names to the bundled runtime modules", () => {
		expect(VIRTUAL_MODULES["@finecode/agent"]).toBe(VIRTUAL_MODULES["@earendil-works/pi-agent-core"]);
		expect(VIRTUAL_MODULES["@finecode/ai"]).toBe(VIRTUAL_MODULES["@earendil-works/pi-ai"]);
		expect(VIRTUAL_MODULES["@finecode/tui"]).toBe(VIRTUAL_MODULES["@earendil-works/pi-tui"]);
		expect(VIRTUAL_MODULES["@finecode/coding-agent"]).toBe(VIRTUAL_MODULES["@earendil-works/pi-coding-agent"]);
	});

	it("loads an extension importing the former FineCode TUI module", async () => {
		root = mkdtempSync(join(tmpdir(), "finecode-extension-compat-"));
		const extension = join(root, "extension.ts");
		writeFileSync(
			extension,
			`import { visibleWidth } from "@finecode/tui";
export default function(api) {
	if (visibleWidth("FineCode") !== 8) throw new Error("Unexpected TUI module");
	api.registerCommand("compat", { handler: async () => {} });
}
`,
		);

		const result = await loadExtensions([extension], root);
		expect(result.errors).toEqual([]);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].commands.has("compat")).toBe(true);
	});
});
