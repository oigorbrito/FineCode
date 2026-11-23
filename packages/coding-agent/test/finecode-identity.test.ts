import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
	APP_NAME,
	APP_TITLE,
	CONFIG_DIR_NAME,
	ENV_AGENT_DIR,
	getAgentDir,
	getSessionDirEnvOverride,
	PACKAGE_NAME,
	VERSION,
} from "../src/config.ts";
import { mergeProviderAttributionHeaders } from "../src/core/provider-attribution.ts";
import type { SettingsManager } from "../src/core/settings-manager.ts";
import { shouldReportPiInstallTelemetry } from "../src/core/telemetry.ts";
import { FINECODE_RUNTIME_RELEASE_MARKER } from "../src/utils/version-check.ts";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("FineCode identity compatibility", () => {
	test("uses the FineCode package and CLI identity while retaining the existing config directory", () => {
		expect(PACKAGE_NAME).toBe("finecode");
		expect(APP_NAME).toBe("finecode");
		expect(APP_TITLE).toBe("FineCode");
		expect(CONFIG_DIR_NAME).toBe(".pi");
		expect(ENV_AGENT_DIR).toBe("FINECODE_CODING_AGENT_DIR");
	});

	test("identifies the FineCode runtime release while retaining Pi component versions", () => {
		const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
			version: string;
			finecodeRuntimeRelease?: string;
			dependencies: Record<string, string>;
		};
		expect(VERSION).toBe("0.0.3");
		expect(manifest.version).toBe(VERSION);
		expect(manifest.finecodeRuntimeRelease).toBe(FINECODE_RUNTIME_RELEASE_MARKER);
		expect(manifest.dependencies).toMatchObject({
			"@earendil-works/pi-agent-core": "1.3.0",
			"@earendil-works/pi-ai": "1.3.0",
			"@earendil-works/pi-codemode": "1.3.0",
			"@earendil-works/pi-mcp": "1.3.0",
			"@earendil-works/pi-tui": "1.3.0",
		});
	});

	test("does not send FineCode install telemetry to the upstream Pi service", () => {
		expect(shouldReportPiInstallTelemetry(PACKAGE_NAME)).toBe(false);
		expect(shouldReportPiInstallTelemetry("@earendil-works/pi-coding-agent")).toBe(true);
	});

	test("uses FineCode attribution headers for external providers", () => {
		const settings = { getEnableInstallTelemetry: () => true } as unknown as SettingsManager;
		const model = (provider: string, baseUrl: string) =>
			({
				id: "test-model",
				name: "Test Model",
				api: "openai-completions",
				provider,
				baseUrl,
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 1000,
				maxTokens: 100,
			}) as Model<Api>;

		const openRouter = mergeProviderAttributionHeaders(
			model("openrouter", "https://openrouter.ai/api/v1"),
			settings,
			undefined,
		);
		expect(openRouter).toMatchObject({ "X-OpenRouter-Title": "FineCode", "X-OpenRouter-Categories": "cli-agent" });
		expect(openRouter?.["HTTP-Referer"]).toBeUndefined();
		expect(
			mergeProviderAttributionHeaders(model("nvidia", "https://integrate.api.nvidia.com/v1"), settings, undefined)?.[
				"X-BILLING-INVOKE-ORIGIN"
			],
		).toBe("FineCode");
		expect(
			mergeProviderAttributionHeaders(
				model("cloudflare-workers-ai", "https://api.cloudflare.com"),
				settings,
				undefined,
			)?.["User-Agent"],
		).toBe("finecode-coding-agent");
		expect(
			mergeProviderAttributionHeaders(model("opencode", "https://opencode.ai/zen/v1"), settings, "session-id")?.[
				"x-opencode-client"
			],
		).toBe("finecode");
	});

	test("prefers the FineCode agent-dir variable and accepts the legacy Pi variable", () => {
		const finecodeAgentDir = join(tmpdir(), "finecode-agent-test");
		const piAgentDir = join(tmpdir(), "pi-agent-test");
		vi.stubEnv("FINECODE_CODING_AGENT_DIR", finecodeAgentDir);
		vi.stubEnv("PI_CODING_AGENT_DIR", piAgentDir);
		expect(getAgentDir()).toBe(finecodeAgentDir);

		vi.stubEnv("FINECODE_CODING_AGENT_DIR", "");
		expect(getAgentDir()).toBe(piAgentDir);
	});

	test("accepts the legacy Pi session-dir variable", () => {
		vi.stubEnv("FINECODE_CODING_AGENT_SESSION_DIR", "");
		vi.stubEnv("PI_CODING_AGENT_SESSION_DIR", "C:/pi-sessions");
		expect(getSessionDirEnvOverride()).toBe("C:/pi-sessions");
	});
});
