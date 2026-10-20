import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config.ts", async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	PACKAGE_NAME: "@earendil-works/pi-coding-agent",
}));

import { checkForNewPiVersion, getLatestPackageRelease } from "../src/utils/version-check.ts";
import { allowNetwork } from "./test-network-env.ts";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("upstream Pi release compatibility", () => {
	it("preserves Pi's release endpoint, rename metadata and update notes", async () => {
		allowNetwork();
		vi.stubEnv("PI_SKIP_VERSION_CHECK", "");
		const release = { packageName: "@new-scope/pi", version: "1.2.4", note: "Upstream migration" };
		const fetch = vi.fn(async (_input: unknown) => Response.json(release));
		vi.stubGlobal("fetch", fetch);
		await expect(getLatestPackageRelease("1.2.3")).resolves.toEqual(release);
		await expect(checkForNewPiVersion("1.2.3")).resolves.toEqual(release);
		expect(fetch).toHaveBeenCalledTimes(2);
		for (const call of fetch.mock.calls) expect(call[0]).toBe("https://pi.dev/api/latest-version");
	});
});
