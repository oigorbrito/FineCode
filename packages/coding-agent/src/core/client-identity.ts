import { type ClientAttribution, type ClientIdentity, PI_ATTRIBUTION } from "@earendil-works/pi-ai";
import { PACKAGE_NAME, VERSION } from "../config.ts";
import type { SettingsManager } from "./settings-manager.ts";
import { isInstallTelemetryEnabled } from "./telemetry.ts";

export const FINECODE_ATTRIBUTION: ClientAttribution = {
	name: "FineCode",
	url: "https://github.com/oigorbrito/FineCode",
	categories: ["cli-agent"],
};

/**
 * How requests identify to providers: a detailed `User-Agent` with version, and attribution
 * while install telemetry is enabled.
 */
export function getClientIdentity(settingsManager: SettingsManager): ClientIdentity {
	const defaultAttribution = PACKAGE_NAME === "finecode" ? FINECODE_ATTRIBUTION : PI_ATTRIBUTION;
	return {
		userAgent: "detailed",
		version: VERSION,
		attribution: isInstallTelemetryEnabled(settingsManager) ? defaultAttribution : null,
	};
}
