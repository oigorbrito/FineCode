import { stripVTControlCharacters } from "node:util";
import { beforeAll, expect, it, vi } from "vitest";
import { FirstTimeSetupComponent } from "../src/modes/interactive/components/first-time-setup.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

beforeAll(() => initTheme("dark"));

it("keeps FineCode identity in both onboarding steps", () => {
	const component = new FirstTimeSetupComponent({ onThemePreview: vi.fn(), onSubmit: vi.fn(), onCancel: vi.fn() });
	const render = () => stripVTControlCharacters(component.render(120).join("\n"));
	expect(render()).toContain("<FC> FineCode");
	expect(render()).toContain("Welcome to FineCode");
	component.handleInput("\n");
	expect(render()).toContain("bugs within FineCode");
	expect(render()).not.toContain("bugs within Pi");
});
