import {
	foregroundAnsi,
	isAppleTerminalSession,
	type RgbColorValue,
	rgbColor,
	type TerminalColorMode,
} from "@earendil-works/pi-tui";
import { APP_NAME } from "../../../config.ts";
import { theme } from "../theme/theme.ts";

export const FINECODE_CORAL: RgbColorValue = rgbColor(228, 138, 122);
export const FINECODE_YELLOW: RgbColorValue = rgbColor(234, 182, 93);

export const FINECODE_RESET = "\x1b[0m";
export const FINECODE_BADGE_TEXT = "<FC>";

/**
 * Renders the FineCode badge with brand coloring.
 */
export function fineCodeBadge(mode?: TerminalColorMode): string {
	const colorMode = mode ?? theme.getColorMode();
	return `${foregroundAnsi(FINECODE_CORAL, colorMode)}${FINECODE_BADGE_TEXT}${FINECODE_RESET}`;
}

/**
 * FineCode wordmark with brand colors that adapt to the terminal color mode.
 */
export function fineCodeWordmark(mode?: TerminalColorMode): string {
	const colorMode = mode ?? theme.getColorMode();
	const coral = foregroundAnsi(FINECODE_CORAL, colorMode);
	const yellow = foregroundAnsi(FINECODE_YELLOW, colorMode);
	return `${coral}${FINECODE_BADGE_TEXT} Fine${FINECODE_RESET}${yellow}Code${FINECODE_RESET}`;
}

/**
 * Returns startup logo lines for FineCode.
 */
export function fineCodeLogoLines(): [string, string] {
	return [fineCodeWordmark(), ""];
}

/**
 * Whether to enable startup clickable logo animation. Disabled for FineCode wordmark by default.
 */
export function supportsFineCodeLogo(): boolean {
	return APP_NAME === "pi" && !isAppleTerminalSession();
}
