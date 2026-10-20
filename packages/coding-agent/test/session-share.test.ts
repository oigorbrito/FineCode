import type { SpawnSyncReturns } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const childProcessMocks = vi.hoisted(() => ({
	spawn: vi.fn(),
	spawnSync: vi.fn((): Pick<SpawnSyncReturns<string>, "status" | "error"> => ({ status: 0 })),
}));

vi.mock("node:child_process", () => childProcessMocks);

import { shareSession } from "../src/modes/interactive/session-share.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("shareSession", () => {
	beforeAll(() => initTheme("dark"));
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => vi.unstubAllGlobals());

	it("keeps concurrent session exports isolated", async () => {
		const uploads: string[] = [];
		childProcessMocks.spawn.mockImplementation((_command, args: string[]) => {
			uploads.push(readFileSync(args.at(-1)!, "utf8"));
			const child = Object.assign(new EventEmitter(), {
				stdout: new PassThrough(),
				stderr: new PassThrough(),
				kill: vi.fn(),
			});
			queueMicrotask(() => {
				child.stdout.end(`https://gist.github.com/test/${uploads.length}\n`);
				child.stderr.end();
				child.emit("close", 0);
			});
			return child;
		});

		const aWritten = deferred();
		const bWritten = deferred();
		const releaseB = deferred();
		const errors: string[] = [];
		const context = (name: "A" | "B") => ({
			session: {
				sessionManager: {
					getSessionId: () => name,
					getCwd: () => "/tmp",
					getBranch: () => [],
				},
				state: { systemPrompt: name, tools: [] },
				settingsManager: { getSessionShareDestination: () => "auto" },
				modelRuntime: { getProvider: () => undefined },
				exportToHtml: async (filePath: string) => {
					writeFileSync(filePath, name);
					if (name === "A") {
						aWritten.resolve();
						await bWritten.promise;
					} else {
						bWritten.resolve();
						await releaseB.promise;
					}
				},
			},
			ui: { setFocus() {}, requestRender() {} },
			editorContainer: { clear() {}, addChild() {} },
			editor: {},
			showStatus() {},
			showError(message: string) {
				errors.push(message);
			},
		});

		const shareA = shareSession(context("A") as never);
		await aWritten.promise;
		const shareB = shareSession(context("B") as never);
		await bWritten.promise;
		await shareA;
		releaseB.resolve();
		await shareB;

		expect(uploads).toEqual(["A", "B"]);
		expect(errors).toEqual([]);
	});

	// #10870: users need persistent gist shares even when Radius authentication is configured.
	it("forces gist sharing without checking Radius authentication", async () => {
		const getProvider = vi.fn(() => ({ id: "radius" }));
		childProcessMocks.spawn.mockImplementation((_command, args: string[]) => {
			const child = Object.assign(new EventEmitter(), {
				stdout: new PassThrough(),
				stderr: new PassThrough(),
				kill: vi.fn(),
			});
			queueMicrotask(() => {
				child.stdout.end("https://gist.github.com/test/forced-gist\n");
				child.stderr.end();
				child.emit("close", 0);
			});
			expect(readFileSync(args.at(-1)!, "utf8")).toBe("html");
			return child;
		});
		const statuses: string[] = [];

		await shareSession({
			session: {
				sessionManager: { getSessionId: () => "gist", getCwd: () => "/tmp", getBranch: () => [] },
				state: { systemPrompt: "", tools: [] },
				settingsManager: { getSessionShareDestination: () => "gist" },
				modelRuntime: { getProvider },
				exportToHtml: async (filePath: string) => writeFileSync(filePath, "html"),
			},
			ui: { setFocus() {}, requestRender() {} },
			editorContainer: { clear() {}, addChild() {} },
			editor: {},
			showStatus: (message: string) => statuses.push(message),
			showError: vi.fn(),
		} as never);

		expect(getProvider).not.toHaveBeenCalled();
		expect(childProcessMocks.spawn).toHaveBeenCalledWith("gh", [
			"gist",
			"create",
			"--public=false",
			expect.any(String),
		]);
		expect(statuses[0]).toContain("https://pi.dev/session/#forced-gist");
	});

	it.each(["missing", "unauthenticated", "spawn-error"] as const)(
		"reports %s GitHub CLI failures without credentials",
		async (failure) => {
			const errors: string[] = [];
			const exportToHtml = vi.fn(async (filePath: string) => writeFileSync(filePath, "html"));
			if (failure === "missing") {
				childProcessMocks.spawnSync.mockReturnValueOnce({
					status: null,
					error: Object.assign(new Error("spawnSync gh ENOENT"), { code: "ENOENT" }),
				});
			} else if (failure === "unauthenticated") {
				childProcessMocks.spawnSync.mockReturnValueOnce({ status: 1 });
			} else {
				childProcessMocks.spawn.mockImplementationOnce(() => {
					const child = Object.assign(new EventEmitter(), {
						stdout: new PassThrough(),
						stderr: new PassThrough(),
						kill: vi.fn(),
					});
					queueMicrotask(() => child.emit("error", new Error("spawn gh ENOENT")));
					return child;
				});
			}
			await shareSession({
				session: {
					sessionManager: { getSessionId: () => "failure", getCwd: () => "/tmp", getBranch: () => [] },
					state: { systemPrompt: "", tools: [] },
					settingsManager: { getSessionShareDestination: () => "gist" },
					exportToHtml,
				},
				ui: { setFocus() {}, requestRender() {} },
				editorContainer: { clear() {}, addChild() {} },
				editor: {},
				showStatus: vi.fn(),
				showError: (message: string) => errors.push(message),
			} as never);
			const expected = {
				missing: "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/",
				unauthenticated: "GitHub CLI is not logged in. Run 'gh auth login' first.",
				"spawn-error": "Failed to create gist: spawn gh ENOENT",
			};
			expect(errors).toEqual([expected[failure]]);
			expect(exportToHtml).toHaveBeenCalledTimes(failure === "spawn-error" ? 1 : 0);
			expect(childProcessMocks.spawn).toHaveBeenCalledTimes(failure === "spawn-error" ? 1 : 0);
		},
	);

	it("labels Radius artifacts as FineCode without changing the Pi share protocol", async () => {
		const fetch = vi.fn(async (input: unknown, options?: RequestInit) => {
			const url = new URL(String(input));
			expect(url.pathname).toBe("/v1/artifacts");
			expect(url.searchParams.get("title")).toBe("FineCode session");
			expect(String(options?.body)).toContain('"customType":"pi.share"');
			return Response.json({ artifact: { canonical_url: "https://example.test/artifact" } });
		});
		vi.stubGlobal("fetch", fetch);
		const showError = vi.fn();
		const showStatus = vi.fn();
		await shareSession({
			session: {
				sessionManager: { getSessionId: () => "radius", getCwd: () => "/tmp", getBranch: () => [] },
				state: { systemPrompt: "system", tools: [] },
				settingsManager: { getSessionShareDestination: () => "radius" },
				modelRuntime: {
					getProvider: () => ({ id: "radius" }),
					getAuth: async () => ({ auth: { apiKey: "fixture-token" } }),
				},
			},
			ui: { setFocus() {}, requestRender() {} },
			editorContainer: { clear() {}, addChild() {} },
			editor: {},
			showStatus,
			showError,
		} as never);
		expect(fetch).toHaveBeenCalledOnce();
		expect(showError).not.toHaveBeenCalled();
		expect(showStatus).toHaveBeenCalledWith(expect.stringContaining("https://example.test/artifact"));
		expect(childProcessMocks.spawnSync).not.toHaveBeenCalled();
	});

	it("reports missing Radius authentication when Radius is forced", async () => {
		const errors: string[] = [];

		await shareSession({
			session: {
				sessionManager: { getSessionId: () => "radius", getCwd: () => "/tmp", getBranch: () => [] },
				state: { systemPrompt: "", tools: [] },
				settingsManager: { getSessionShareDestination: () => "radius" },
				modelRuntime: { getProvider: () => undefined },
			},
			ui: { setFocus() {}, requestRender() {} },
			editorContainer: { clear() {}, addChild() {} },
			editor: {},
			showStatus: vi.fn(),
			showError: (message: string) => errors.push(message),
		} as never);

		expect(errors).toEqual(["Radius authentication is not configured. Run '/login radius' first."]);
		expect(childProcessMocks.spawnSync).not.toHaveBeenCalled();
		expect(childProcessMocks.spawn).not.toHaveBeenCalled();
	});
});
