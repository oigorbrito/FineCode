import { APP_NAME } from "../../../config.ts";
import { theme } from "../theme/theme.ts";
import { fineCodeBadge } from "./brand.ts";

/** Compose only the branded path; statistics and layout remain in the upstream footer. */
export function fineCodeFooterPath(pwd: string): string {
	const badge = APP_NAME === "finecode" ? `${fineCodeBadge()} ` : "";
	return `${badge}${theme.fg("dim", pwd)}`;
}
