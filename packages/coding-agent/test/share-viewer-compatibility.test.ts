import { afterEach, describe, expect, it, vi } from "vitest";
import { getShareViewerUrl } from "../src/config.ts";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("FineCode share viewer compatibility", () => {
	it("uses the FineCode custom viewer ahead of the legacy Pi override", () => {
		vi.stubEnv("FINECODE_SHARE_VIEWER_URL", "https://finecode.example/shares");
		vi.stubEnv("PI_SHARE_VIEWER_URL", "https://legacy.example/session/");

		expect(getShareViewerUrl("abc")).toBe("https://finecode.example/shares/abc");
	});

	it("supports a FineCode viewer base with a trailing slash", () => {
		vi.stubEnv("FINECODE_SHARE_VIEWER_URL", "https://finecode.example/shares/");

		expect(getShareViewerUrl("abc")).toBe("https://finecode.example/shares/abc");
	});

	it("preserves the Pi viewer override when no FineCode override is set", () => {
		vi.stubEnv("FINECODE_SHARE_VIEWER_URL", "");
		vi.stubEnv("PI_SHARE_VIEWER_URL", "https://legacy.example/session/");

		expect(getShareViewerUrl("abc")).toBe("https://legacy.example/session/#abc");
	});

	it("keeps the current upstream viewer default", () => {
		vi.stubEnv("FINECODE_SHARE_VIEWER_URL", "");
		vi.stubEnv("PI_SHARE_VIEWER_URL", "");

		expect(getShareViewerUrl("abc")).toBe("https://pi.dev/session/#abc");
	});
});
