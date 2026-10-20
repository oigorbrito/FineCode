import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { finecodeThemeDefinition } from "../src/modes/interactive/finecode/theme.ts";
import { getThemeByName, getThemeExportColors, loadThemeFromPath } from "../src/modes/interactive/theme/theme.ts";

const interactiveDir = fileURLToPath(new URL("../src/modes/interactive/", import.meta.url));

describe("FineCode TUI-01B architecture", () => {
	// PR #339: theme loading must not pull branding/footer modules back into its graph.
	it("keeps the theme, brand and footer runtime dependency graph acyclic", () => {
		const visited = new Set<string>();
		const active = new Set<string>();
		function visit(file: string): void {
			expect(active.has(file), `Circular dependency: ${[...active, file].join(" -> ")}`).toBe(false);
			if (visited.has(file)) return;
			active.add(file);
			const source = readFileSync(file, "utf8");
			const imports = source.matchAll(
				/(?:^|\n)\s*(import|export)\s+(?!type\b)(?:[^;]*?\s+from\s+)?["'](\.[^"']+)["']/gm,
			);
			for (const [, , specifier] of imports) {
				const dependency = resolve(dirname(file), specifier);
				if (dependency.startsWith(interactiveDir) && dependency.endsWith(".ts")) visit(dependency);
			}
			active.delete(file);
			visited.add(file);
		}
		visit(join(interactiveDir, "theme/theme.ts"));
		expect([...visited].some((file) => file.endsWith("brand.ts") || file.endsWith("operational-footer.ts"))).toBe(
			false,
		);
		visit(join(interactiveDir, "finecode/index.ts"));
		visit(join(interactiveDir, "components/footer.ts"));
	});

	// PR #339: one JSON definition must drive both the asset and embedded loading.
	it("loads identical tokens from the packaged asset and the embedded definition", () => {
		const assetPath = join(interactiveDir, "theme/finecode.json");
		expect(finecodeThemeDefinition).toEqual(JSON.parse(readFileSync(assetPath, "utf8")));
		const embedded = getThemeByName("finecode");
		const asset = loadThemeFromPath(assetPath);
		expect(embedded?.name).toBe(asset.name);
		expect(embedded?.appearance).toBe(asset.appearance);
		expect(embedded?.colors).toEqual(asset.colors);
		expect(getThemeExportColors("finecode")).toEqual({
			pageBg: expect.any(String),
			cardBg: expect.any(String),
			infoBg: expect.any(String),
		});
	});

	it("embeds the canonical JSON without requiring theme assets at runtime", async () => {
		const dir = mkdtempSync(join(tmpdir(), "finecode-embedded-theme-"));
		try {
			const result = await build({
				stdin: {
					contents:
						'import { finecodeThemeDefinition } from "./finecode/theme.ts"; console.log(JSON.stringify(finecodeThemeDefinition));',
					resolveDir: interactiveDir,
					loader: "ts",
				},
				bundle: true,
				platform: "node",
				format: "esm",
				write: false,
			});
			const bundle = join(dir, "theme.mjs");
			writeFileSync(bundle, result.outputFiles[0].text);
			expect(JSON.parse(execFileSync(process.execPath, [bundle], { cwd: dir, encoding: "utf8" }))).toEqual(
				finecodeThemeDefinition,
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
