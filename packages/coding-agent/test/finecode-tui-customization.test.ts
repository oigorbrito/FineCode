import { visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../src/core/footer-data-provider.ts";
import { FooterComponent, formatCwdForFooter } from "../src/modes/interactive/components/footer.ts";
import {
	FINECODE_BADGE_TEXT,
	FINECODE_CORAL,
	FINECODE_YELLOW,
	FineCodeOperationalFooter,
	fineCodeBadge,
	fineCodeLogoLines,
	fineCodeWordmark,
	formatOperationalPath,
	formatOperationalTokens,
	supportsFineCodeLogo,
} from "../src/modes/interactive/finecode/index.ts";
import {
	FINECODE_THEME_NAME,
	getAvailableThemes,
	getThemeByName,
	initTheme,
} from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

function createMockSession(): AgentSession {
	return {
		state: {
			model: {
				id: "claude-sonnet-4-5",
				provider: "anthropic",
				contextWindow: 200_000,
				reasoning: false,
			},
			thinkingLevel: "off",
		},
		sessionManager: {
			getEntries: () => [],
			getEntryCount: () => 0,
			getSessionId: () => "test-session-123",
			getLeafId: () => null,
			getSessionName: () => "finecode-tui-task",
			getCwd: () => "/workspace/finecode",
		},
		getContextUsage: () => ({ contextWindow: 200_000, percent: 18.5 }),
		routedModel: undefined,
		modelRuntime: {
			isUsingSubscription: () => false,
		},
	} as unknown as AgentSession;
}

function createMockFooterData(): ReadonlyFooterDataProvider {
	return {
		getGitBranch: () => "feat/tui-identity",
		getExtensionStatuses: () => new Map<string, string>([["telemetry", "active"]]),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	};
}

describe("FineCode TUI-01 Brand Identity", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("exports brand palette and badge constants", () => {
		expect(FINECODE_BADGE_TEXT).toBe("<FC>");
		expect(FINECODE_CORAL).toEqual({ kind: "rgb", r: 228, g: 138, b: 122 });
		expect(FINECODE_YELLOW).toEqual({ kind: "rgb", r: 234, g: 182, b: 93 });
	});

	it("renders brand badge with <FC>", () => {
		const badge = fineCodeBadge();
		expect(stripAnsi(badge)).toBe("<FC>");
	});

	it("renders wordmark with brand styling and <FC> marker", () => {
		const wordmark = fineCodeWordmark();
		expect(stripAnsi(wordmark)).toBe("<FC> FineCode");
	});

	it("renders logo lines for interactive header", () => {
		const [top, bottom] = fineCodeLogoLines();
		expect(stripAnsi(top)).toBe("<FC> FineCode");
		expect(bottom).toBe("");
	});

	it("disables legacy Pi 3D clickable animation for FineCode", () => {
		expect(supportsFineCodeLogo()).toBe(false);
	});
});

describe("FineCode TUI-01 Built-in Theme", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("registers finecode as an available built-in theme", () => {
		const available = getAvailableThemes();
		expect(available[0]).toBe("system");
		expect(available).toContain(FINECODE_THEME_NAME);
	});

	it("loads the finecode theme with dark appearance and brand tokens", () => {
		const theme = getThemeByName(FINECODE_THEME_NAME);
		expect(theme).toBeDefined();
		expect(theme?.appearance).toBe("dark");
		expect(theme?.colors.accent).toBeDefined();
		expect(theme?.colors.warning).toBeDefined();
		expect(theme?.colors.mdHeading).toBeDefined();
		expect(theme?.colors.mdLink).toBeDefined();
		expect(theme?.getFgAnsi("accent")).toMatch(/^\x1b\[38;/);
	});
});

describe("FineCode TUI-01 Operational Footer", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("normalizes paths consistently across platforms", () => {
		expect(formatOperationalPath("/home/user", "/home/user")).toBe("~");
		expect(formatOperationalPath("/home/user/repo", "/home/user")).toBe("~/repo");
		expect(formatOperationalPath("/home/user/nested/dir", "/home/user")).toBe("~/nested/dir");
		expect(formatCwdForFooter("/home/user/project", "/home/user")).toBe("~/project");
	});

	it("formats token counts concisely", () => {
		expect(formatOperationalTokens(500)).toBe("500");
		expect(formatOperationalTokens(2500)).toBe("2.5k");
		expect(formatOperationalTokens(45000)).toBe("45k");
		expect(formatOperationalTokens(1500000)).toBe("1.5M");
	});

	it("renders operational footer lines with badge and session metadata within target width", () => {
		const session = createMockSession();
		const footerData = createMockFooterData();
		const footer = new FineCodeOperationalFooter(session, footerData);

		const lines = footer.render(100);
		expect(lines.length).toBeGreaterThanOrEqual(2);

		const firstLineClean = stripAnsi(lines[0]);
		expect(firstLineClean).toContain("<FC>");
		expect(firstLineClean).toContain("finecode-tui-task");
		expect(firstLineClean).toContain("feat/tui-identity");

		const statsLineClean = stripAnsi(lines[1]);
		expect(statsLineClean).toContain("claude-sonnet-4-5");
		expect(statsLineClean).toContain("18.5%/200k");

		for (const line of lines) {
			expect(visibleWidth(line)).toBeLessThanOrEqual(100);
		}
	});

	it("delegates FooterComponent to FineCodeOperationalFooter transparently", () => {
		const session = createMockSession();
		const footerData = createMockFooterData();
		const footer = new FooterComponent(session, footerData);

		const lines = footer.render(90);
		expect(lines.length).toBeGreaterThanOrEqual(2);
		expect(stripAnsi(lines[0])).toContain("<FC>");
		for (const line of lines) {
			expect(visibleWidth(line)).toBeLessThanOrEqual(90);
		}
	});
});
