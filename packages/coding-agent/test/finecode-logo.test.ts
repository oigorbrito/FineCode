import { beforeAll, describe, expect, test } from "vitest";
import { piLogoLines, piWordmark, supportsPiLogo } from "../src/modes/interactive/components/pi-logo.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

function stripAnsi(value: string): string {
	return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

beforeAll(() => initTheme("dark"));

describe("FineCode startup wordmark", () => {
	test("renders FineCode in both logo and text-fallback paths", () => {
		const [logoLine, secondLine] = piLogoLines();

		expect(stripAnsi(logoLine)).toBe("<FC> FineCode");
		expect(secondLine).toBe("");
		expect(stripAnsi(piWordmark())).toBe("<FC> FineCode");
	});

	test("does not attach the legacy Pi logo animation to the FineCode wordmark", () => {
		expect(supportsPiLogo()).toBe(false);
	});
});
