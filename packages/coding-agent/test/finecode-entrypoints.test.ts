import { afterAll, describe, expect, it, vi } from "vitest";

const original = vi.hoisted(() => ({
	title: process.title,
	agent: process.env.AI_AGENT,
	marker: process.env.PI_CODING_AGENT,
	emitWarning: process.emitWarning,
	main: vi.fn(),
}));
vi.mock("../src/main.ts", () => ({ main: original.main }));
vi.mock("../src/core/http-dispatcher.ts", () => ({ configureHttpDispatcher: vi.fn() }));

import "../src/rpc-entry.ts";
import { setupCli } from "../src/cli/setup.ts";

const rpc = { title: process.title, agent: process.env.AI_AGENT, marker: process.env.PI_CODING_AGENT };

afterAll(() => {
	process.title = original.title;
	process.emitWarning = original.emitWarning;
	if (original.agent === undefined) delete process.env.AI_AGENT;
	else process.env.AI_AGENT = original.agent;
	if (original.marker === undefined) delete process.env.PI_CODING_AGENT;
	else process.env.PI_CODING_AGENT = original.marker;
});

describe("FineCode entrypoint identity", () => {
	it("identifies RPC as FineCode while retaining the Pi interoperability marker", () => {
		expect(rpc).toEqual({ title: "finecode-rpc", agent: "finecode", marker: "true" });
		expect(original.main.mock.calls[0]?.[0].slice(0, 2)).toEqual(["--mode", "rpc"]);
	});

	it("replaces an inherited Pi agent identity in the CLI", () => {
		process.env.AI_AGENT = "pi";
		setupCli();
		expect(process.title).toBe("finecode");
		expect(process.env.AI_AGENT).toBe("finecode");
		expect(process.env.PI_CODING_AGENT).toBe("true");
	});
});
