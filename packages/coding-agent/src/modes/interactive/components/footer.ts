import type { Component } from "@earendil-works/pi-tui";
import type { AgentSession } from "../../../core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.ts";
import { FineCodeOperationalFooter, formatOperationalPath, formatOperationalTokens } from "../finecode/index.ts";

/**
 * Format token counts for compact footer display.
 */
export function formatTokens(count: number): string {
	return formatOperationalTokens(count);
}

/**
 * Normalizes and abbreviates cwd relative to home directory using uniform forward-slash separators.
 */
export function formatCwdForFooter(cwd: string, home: string | undefined): string {
	return formatOperationalPath(cwd, home);
}

/**
 * Footer component that shows pwd, token stats, context usage, and FineCode operational status.
 * Reuses the native TUI component model and delegates to the isolated FineCode operational footer.
 */
export class FooterComponent implements Component {
	private delegate: FineCodeOperationalFooter;

	constructor(session: AgentSession, footerData: ReadonlyFooterDataProvider) {
		this.delegate = new FineCodeOperationalFooter(session, footerData);
	}

	setSession(session: AgentSession): void {
		this.delegate.setSession(session);
	}

	setAutoCompactEnabled(enabled: boolean): void {
		this.delegate.setAutoCompactEnabled(enabled);
	}

	invalidate(): void {
		this.delegate.invalidate();
	}

	dispose(): void {
		this.delegate.dispose();
	}

	render(width: number): string[] {
		return this.delegate.render(width);
	}
}
