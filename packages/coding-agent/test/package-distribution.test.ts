import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

interface CodingAgentPackageJson {
	name: string;
	piConfig: { name: string; configDir: string };
	bin: { finecode: string };
	main: string;
	exports: {
		".": { import: string; types: string };
		"./rpc-entry": { import: string };
	};
}

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as CodingAgentPackageJson;

describe("package distribution entrypoints", () => {
	test("publishes FineCode with only the finecode executable", () => {
		expect(packageJson.name).toBe("finecode");
		expect(packageJson.piConfig.name).toBe("finecode");
		expect(packageJson.piConfig.configDir).toBe(".pi");
		expect(packageJson.bin.finecode).toBe("dist/bundle/cli.js");
		expect(Object.keys(packageJson.bin)).toEqual(["finecode"]);
	});

	test("uses the bundle for executables and modular output for libraries", () => {
		expect(packageJson.main).toBe("./dist/index.js");
		expect(packageJson.exports["."].import).toBe("./dist/index.js");
		expect(packageJson.exports["./rpc-entry"].import).toBe("./dist/bundle/rpc-entry.js");
	});
});
