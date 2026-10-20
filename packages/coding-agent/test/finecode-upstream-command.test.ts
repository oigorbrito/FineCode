import { afterEach, expect, it, vi } from "vitest";

const distribution = vi.hoisted(() => ({ name: "finecode" }));
vi.mock("../src/config.ts", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	get PACKAGE_NAME() {
		return distribution.name;
	},
}));

import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

afterEach(() => {
	distribution.name = "finecode";
});

it.each(["finecode", "@earendil-works/pi-coding-agent"])(
	"keeps the upstream announcement scoped to its distribution (%s)",
	async (name) => {
		distribution.name = name;
		const editor: { onSubmit?: (text: string) => Promise<void> } = {};
		const context = {
			defaultEditor: editor,
			editor: { setText: vi.fn(), addToHistory: vi.fn() },
			session: { isCompacting: false, isStreaming: false },
			handleDementedDelves: vi.fn(),
			flushPendingBashComponents: vi.fn(),
			onInputCallback: vi.fn(),
		};
		const prototype = InteractiveMode.prototype as unknown as {
			setupEditorSubmitHandler(this: typeof context): void;
		};
		prototype.setupEditorSubmitHandler.call(context);
		await editor.onSubmit!("/dementedelves");
		if (name === "finecode") {
			expect(context.handleDementedDelves).not.toHaveBeenCalled();
			expect(context.onInputCallback).toHaveBeenCalledWith("/dementedelves");
		} else {
			expect(context.handleDementedDelves).toHaveBeenCalledOnce();
			expect(context.onInputCallback).not.toHaveBeenCalled();
		}
	},
);
