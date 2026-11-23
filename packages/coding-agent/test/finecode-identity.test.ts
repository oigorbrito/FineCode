import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { FINECODE_ATTRIBUTION, getClientIdentity } from "../src/core/client-identity.ts";
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
			"@earendil-works/pi-agent-core": "1.6.0",
			"@earendil-works/pi-ai": "1.6.0",
			"@earendil-works/pi-codemode": "1.6.0",
			"@earendil-works/pi-mcp": "1.6.0",
			"@earendil-works/pi-tui": "1.6.0",
		});
	});

	test("does not send FineCode install telemetry to the upstream Pi service", () => {
		expect(shouldReportPiInstallTelemetry(PACKAGE_NAME)).toBe(false);
		expect(shouldReportPiInstallTelemetry("@earendil-works/pi-coding-agent")).toBe(true);
	});

	test("uses FineCode attribution in client identity", () => {
		const settings = { getEnableInstallTelemetry: () => true } as unknown as SettingsManager;
		const identity = getClientIdentity(settings);
		expect(identity.version).toBe(VERSION);
		expect(identity.attribution).toEqual(FINECODE_ATTRIBUTION);
		expect(identity.attribution?.name).toBe("FineCode");

		const disabledSettings = { getEnableInstallTelemetry: () => false } as unknown as SettingsManager;
		expect(getClientIdentity(disabledSettings).attribution).toBeNull();
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
