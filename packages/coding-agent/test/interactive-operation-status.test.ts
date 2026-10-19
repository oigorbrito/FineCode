import { type TUI, visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AgentSessionEvent } from "../src/core/agent-session.ts";
import { keyText } from "../src/modes/interactive/components/keybinding-hints.ts";
import { WorkingStatusIndicator } from "../src/modes/interactive/components/status-indicator.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

type FakeInteractiveMode = {
	isInitialized: boolean;
	pendingTools: Map<string, ToolExecutionComponent>;
	activeStatusIndicator: WorkingStatusIndicator;
	workingMessage: string | undefined;
	defaultWorkingMessage: string;
	footer: { invalidate(): void };
	programStatus: { handleEvent(event: AgentSessionEvent): void };
	ui: { requestRender(): void };
	maybeShowInstallChangeWarning(): void;
	updateWorkingToolStatus(): void;
};

const handleEvent = (
	InteractiveMode as unknown as {
		prototype: { handleEvent(this: FakeInteractiveMode, event: AgentSessionEvent): Promise<void> };
	}
).prototype.handleEvent;
const updateWorkingToolStatus = (
	InteractiveMode as unknown as {
		prototype: { updateWorkingToolStatus(this: FakeInteractiveMode): void };
	}
).prototype.updateWorkingToolStatus;

function createHarness(toolName: string) {
	const requestRender = vi.fn();
	const tui = { requestRender } as unknown as TUI;
	const component = new ToolExecutionComponent(
		toolName,
		"tool-call",
		{ command: "example" },
		{},
		undefined,
		tui,
		"/tmp",
	);
	const indicator = new WorkingStatusIndicator(tui, "Custom task", { frames: [] });
	let fakeThis: FakeInteractiveMode;
	fakeThis = {
		isInitialized: true,
		pendingTools: new Map([["tool-call", component]]),
		activeStatusIndicator: indicator,
		workingMessage: "Custom task",
		defaultWorkingMessage: "Working",
		footer: { invalidate: vi.fn() },
		programStatus: { handleEvent: vi.fn() },
		ui: { requestRender },
		maybeShowInstallChangeWarning: vi.fn(),
		updateWorkingToolStatus: () => updateWorkingToolStatus.call(fakeThis),
	};
	return { component, fakeThis, indicator };
}

function indicatorText(indicator: WorkingStatusIndicator): string {
	return stripAnsi(indicator.render(120)[1] ?? "");
}

describe("interactive operation status", () => {
	beforeAll(() => initTheme("dark"));

	it.each([
		{ outcome: "approved", isError: false, text: "Command completed" },
		{ outcome: "denied", isError: true, text: "Permission denied" },
	])("shows an active tool call and its $outcome result", async ({ isError, text }) => {
		const { component, fakeThis, indicator } = createHarness("bash");
		try {
			await handleEvent.call(fakeThis, {
				type: "tool_execution_start",
				toolCallId: "tool-call",
				toolName: "bash",
				args: { command: "example" },
			});

			const activeText = indicatorText(indicator);
			expect(activeText).toContain("Call: bash");
			expect(activeText).toContain(keyText("app.interrupt"));
			expect(component.getActiveToolCallName()).toBe("bash");
			expect(visibleWidth(indicator.renderInBorder(12))).toBeLessThanOrEqual(12);

			await handleEvent.call(fakeThis, {
				type: "tool_execution_update",
				toolCallId: "tool-call",
				toolName: "bash",
				args: { command: "example" },
				partialResult: { content: [{ type: "text", text: "partial output" }], details: {} },
			});
			expect(indicatorText(indicator)).toContain("Call: bash");
			expect(component.getActiveToolCallName()).toBe("bash");

			await handleEvent.call(fakeThis, {
				type: "tool_execution_end",
				toolCallId: "tool-call",
				toolName: "bash",
				result: { content: [{ type: "text", text }], details: {} },
				isError,
				...(isError ? {} : { durationMs: 10 }),
			});

			expect(indicatorText(indicator)).toContain("Custom task");
			expect(indicatorText(indicator)).not.toContain("Call: bash");
			expect(component.getActiveToolCallName()).toBeUndefined();
			expect(stripAnsi(component.render(120).join("\n"))).toContain(text);
			expect(fakeThis.pendingTools.size).toBe(0);
		} finally {
			indicator.dispose();
		}
	});
});
