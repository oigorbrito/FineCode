import { foregroundAnsi, isAppleTerminalSession, rgbColor } from "@earendil-works/pi-tui";
import { APP_NAME } from "../../../config.ts";
import { theme } from "../theme/theme.ts";

const CORAL = rgbColor(228, 138, 122);
const YELLOW = rgbColor(234, 182, 93);
const RESET = "\x1b[0m";

/** FineCode wordmark in the existing startup-logo slot; colors adapt to the terminal color mode. */
function fineCodeWordmark(): string {
	const mode = theme.getColorMode();
	return `${foregroundAnsi(CORAL, mode)}<FC> Fine${RESET}${foregroundAnsi(YELLOW, mode)}Code${RESET}`;
}

export function piLogoLines(): [string, string] {
	return [fineCodeWordmark(), ""];
}

/**
 * Whether to enable the legacy clickable logo animation. Apple Terminal misaligns its half-block art, so
 * the animation is disabled there.
 */
export function supportsPiLogo(): boolean {
	return APP_NAME === "pi" && !isAppleTerminalSession();
}

/** Text fallback for FineCode's startup wordmark. */
export function piWordmark(): string {
	return fineCodeWordmark();
}
