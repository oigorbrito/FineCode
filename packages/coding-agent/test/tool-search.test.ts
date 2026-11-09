import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import type { ToolInfo, ToolNamespace } from "../src/core/extensions/types.ts";
import { createCodemodeDescription } from "../src/extensions/codemode/tool.ts";
import {
	Bm25Ranker,
	createToolSearchDocument,
	createToolSearchToolDefinition,
	tokenize,
} from "../src/extensions/tool-search/tool.ts";

function tool(name: string, description: string, properties: Record<string, unknown> = {}): AgentTool {
	return {
		name,
		label: name,
		description,
		parameters: Type.Unsafe({ type: "object", properties }),
		execute: async () => ({ content: [], details: undefined }),
	};
}

describe("tokenize", () => {
	it("splits camelCase and snake_case, drops stop words, and folds plurals", () => {
		expect(tokenize("listIssues for the GitHub_repo")).toEqual(["list", "issue", "git", "hub", "repo"]);
		expect(tokenize("searches queries HTTPServer")).toEqual(["search", "query", "http", "server"]);
	});
});

describe("Bm25Ranker", () => {
	const tools = [
		tool("mcp__github__list_issues", "List issues in a repository.", {
			state: { type: "string", description: "open or closed" },
		}),
		tool("mcp__github__create_pull_request", "Open a pull request."),
		tool("mcp__linear__search_issues", "Search Linear issues by text."),
		tool("mcp__docs__search", "Search the documentation."),
	];
	const documents = tools.map((entry) => createToolSearchDocument(entry));

	it("ranks by term relevance and respects the limit", () => {
		const ranker = new Bm25Ranker();
		expect(ranker.rank("issue", documents, 8).map((match) => match.name)).toEqual([
			"mcp__linear__search_issues",
			"mcp__github__list_issues",
		]);
		expect(ranker.rank("pull requests", documents, 8)[0].name).toBe("mcp__github__create_pull_request");
		expect(ranker.rank("search", documents, 1)).toHaveLength(1);
		// Property names and descriptions are searchable.
		expect(ranker.rank("closed", documents, 8).map((match) => match.name)).toEqual(["mcp__github__list_issues"]);
	});

	it("returns nothing for unknown or empty queries", () => {
		const ranker = new Bm25Ranker();
		expect(ranker.rank("kubernetes", documents, 8)).toEqual([]);
		expect(ranker.rank("the", documents, 8)).toEqual([]);
		// Known v1 limit: no synonyms, so "tickets" does not find "issues".
		expect(ranker.rank("tickets", documents, 8)).toEqual([]);
	});

	it("includes the namespace in the search text", () => {
		const document = createToolSearchDocument(tool("mcp__x__run", "Run it."), {
			name: "mcp__x",
			description: "Kubernetes cluster tools",
		});
		expect(new Bm25Ranker().rank("kubernetes", [document], 8)).toEqual([
			{ name: "mcp__x__run", score: expect.any(Number) },
		]);
	});
});

describe("codemode description catalog", () => {
	const plain = tool("read_notes", "Read notes.");
	const github = ["a", "b", "c"].map((suffix) => tool(`mcp__github__${suffix}`, `GitHub ${suffix}.`));
	const docs = [tool("mcp__docs__search", "Search docs."), tool("mcp__docs__long", "Long ".repeat(200))];
	const all = [plain, ...github, ...docs];
	const namespaces = new Map<string, ToolNamespace>([
		...github.map((entry) => [entry.name, { name: "mcp__github", description: "GitHub server" }] as const),
		...docs.map((entry) => [entry.name, { name: "mcp__docs" }] as const),
	]);

	it("lists everything without a budget", () => {
		const description = createCodemodeDescription(all, { namespaces });
		expect(description).toContain("Nested tools:");
		expect(description).toContain("## mcp__github\nGitHub server");
		expect(description).toContain("## mcp__docs\n\n### `mcp__docs");
		// The search guidance is always there, so tools that appear later do not change it.
		expect(description).toContain("find unlisted tools, such as MCP tools");
		// #10555: the lookup helpers are async; without `await` scripts serialize the promise as {}.
		expect(description).toContain("`await searchTools(query, { limit?, namespace? })`");
		expect(description).toContain("`await describeTool(name)`");
		expect(description).toContain("`await describeNamespace(name)`");
	});

	it("fills the budget round-robin, cheapest first, and says what is missing", () => {
		// Each small section costs about 42 tokens: one tool per group, then one more.
		const description = createCodemodeDescription(all, { namespaces, inlineBudget: 170 });
		expect(description).toContain("### `read_notes`");
		expect(description).toContain("## mcp__docs (some tools not listed)");
		expect(description).toContain("### `mcp__docs__search`");
		expect(description).not.toContain("### `mcp__docs__long`");
		expect(description).toContain("## mcp__github (some tools not listed)");
		expect(description).toContain("find unlisted tools, such as MCP tools");
		// Deterministic: the same input gives the same description.
		expect(createCodemodeDescription(all, { namespaces, inlineBudget: 170 })).toBe(description);
	});

	it("leaves deferred tools and their namespaces out entirely", () => {
		const deferred = new Set(github.map((entry) => entry.name));
		const description = createCodemodeDescription(all, { namespaces, deferred });
		expect(description).not.toContain("mcp__github");
		// Deferred tools, such as those of a server that connects later, do not change the description.
		expect(description).toBe(createCodemodeDescription([plain, ...docs], { namespaces }));
	});

	it("leaves namespace instructions out", () => {
		const description = createCodemodeDescription(github, {
			namespaces: new Map(
				github.map((entry) => [entry.name, { name: "mcp__github", instructions: "Long usage guide." }] as const),
			),
		});
		expect(description).toContain("## mcp__github\n\n### `mcp__github__a`");
		expect(description).not.toContain("Long usage guide.");
	});

	it("lists only namespaces with a zero budget", () => {
		const description = createCodemodeDescription(all, { namespaces, inlineBudget: 0 });
		expect(description).toContain("## mcp__docs (tools not listed)");
		expect(description).not.toContain("codemode tool declaration:");
	});
});

describe("tool_search results", () => {
	function search(all: ToolInfo[], initiallyActive: string[], query: string) {
		let active = initiallyActive;
		const definition = createToolSearchToolDefinition({
			tools: {
				getAllTools: () => all,
				getActiveTools: () => active,
				setActiveTools: (names) => {
					active = names;
				},
			},
		});
		return {
			result: definition.execute("call", { query }, undefined, undefined, undefined as never),
			active: () => active,
		};
	}

	function info(name: string, description: string, exposure: ToolInfo["exposure"], namespace?: string): ToolInfo {
		const { parameters } = tool(name, description);
		return {
			name,
			description,
			parameters,
			exposure,
			namespace: namespace === undefined ? undefined : { name: namespace },
			sourceInfo: { path: name, source: "test", scope: "temporary", origin: "top-level" },
		};
	}

	const all = [
		info("tool_search", "Search for tools", "model-only"),
		info("grep", "Search file contents for a pattern", "direct"),
		info("mcp__common__tavily_search", "Search the web with Tavily", "direct", "mcp__common"),
		info("mcp__docs__fetch", "Fetch a documentation page", "deferred", "mcp__docs"),
		info("weather_now", "Current weather for a city", "deferred"),
	];

	// #11921: a direct MCP tool is already declared; searching for it must not say it does not exist.
	it("reports matching tools that are already active instead of finding nothing", async () => {
		const { result, active } = search(all, ["tool_search", "mcp__common__tavily_search"], "tavily");
		const { content, details } = await result;
		expect(content).toEqual([
			{
				type: "text",
				text: "Already available, no need to load:\n- mcp__common__tavily_search: Search the web with Tavily",
			},
		]);
		expect(details).toEqual({ loaded: [] });
		expect(active()).toEqual(["tool_search", "mcp__common__tavily_search"]);
	});

	it("reports deferred tools loaded earlier and leaves built-in tools out", async () => {
		const loadedEarlier = search(all, ["tool_search", "grep", "weather_now"], "weather");
		expect((await loadedEarlier.result).content).toEqual([
			{ type: "text", text: "Already available, no need to load:\n- weather_now: Current weather for a city" },
		]);
		const builtIn = search(all, ["tool_search", "grep"], "file contents pattern");
		expect((await builtIn.result).content).toEqual([{ type: "text", text: "No matching tools found." }]);
	});

	it("loads matching deferred tools and finds nothing when no tool matches", async () => {
		const loaded = search(all, ["tool_search", "mcp__common__tavily_search"], "documentation page");
		expect((await loaded.result).content).toEqual([
			{
				type: "text",
				text: "Loaded 1 tool. They are available from your next call:\n- mcp__docs__fetch: Fetch a documentation page",
			},
		]);
		expect(loaded.active()).toEqual(["tool_search", "mcp__common__tavily_search", "mcp__docs__fetch"]);
		const none = search(all, ["tool_search"], "translate");
		expect((await none.result).content).toEqual([{ type: "text", text: "No matching tools found." }]);
	});
});
