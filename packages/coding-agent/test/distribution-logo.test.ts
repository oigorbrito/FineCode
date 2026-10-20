import { stripVTControlCharacters } from "node:util";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

const distribution = vi.hoisted(() => ({ name: "finecode", apple: false }));
vi.mock("../src/config.ts", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	get PACKAGE_NAME() {
		return distribution.name;
	},
}));
vi.mock("@earendil-works/pi-tui", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	isAppleTerminalSession: () => distribution.apple,
}));

import { piLogoLines, piWordmark, supportsPiLogo } from "../src/modes/interactive/components/distribution-logo.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

beforeAll(() => initTheme("dark"));
afterEach(() => {
	distribution.name = "finecode";
	distribution.apple = false;
});

it.each(["finecode", "@earendil-works/pi-coding-agent"])("preserves the logo for %s", (name) => {
	distribution.name = name;
	const lines = piLogoLines().map(stripVTControlCharacters);
	if (name === "finecode") {
		expect(lines).toEqual(["<FC> FineCode", ""]);
		expect(stripVTControlCharacters(piWordmark())).toBe("<FC> FineCode");
		expect(supportsPiLogo()).toBe(false);
	} else {
		expect(lines).toEqual(["▀▀█ ", "█▀ █"]);
		expect(stripVTControlCharacters(piWordmark())).toBe("Pi");
		expect(supportsPiLogo()).toBe(true);
	}
});

it("keeps the Pi half-block animation disabled on Apple Terminal", () => {
	distribution.name = "@earendil-works/pi-coding-agent";
	distribution.apple = true;
	expect(supportsPiLogo()).toBe(false);
	expect(stripVTControlCharacters(piWordmark())).toBe("Pi");
});
