import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAME, PACKAGE_NAME } from "../../config.ts";
import { spawnProcess } from "../../utils/child-process.ts";
import { stripBom } from "../../utils/text.ts";

export interface ExternalEditorOptions {
	command: string;
	content: string;
}

export type ExternalEditorResult = { status: "complete"; content: string } | { status: "failed" };

const APP_DISPLAY_NAME = PACKAGE_NAME === "finecode" ? "FineCode" : APP_NAME === "pi" ? "Pi" : APP_NAME;

function parseExternalEditorCommand(command: string): string[] | undefined {
	const args: string[] = [];
	let current = "";
	let quote: '"' | "'" | undefined;
	let hasToken = false;

	for (let i = 0; i < command.length; i++) {
		const char = command[i]!;
		const next = command[i + 1];

		if (quote) {
			if (char === quote) {
				quote = undefined;
				hasToken = true;
			} else if (char === "\\" && next === quote) {
				current += next;
				i++;
				hasToken = true;
			} else {
				current += char;
				hasToken = true;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			hasToken = true;
		} else if (/\s/.test(char)) {
			if (hasToken) {
				args.push(current);
				current = "";
				hasToken = false;
			}
		} else if (char === "\\" && next && /[\s"']/.test(next)) {
			current += next;
			i++;
			hasToken = true;
		} else {
			current += char;
			hasToken = true;
		}
	}

	if (quote) return undefined;
	if (hasToken) args.push(current);
	return args;
}

export async function editInExternalEditor(options: ExternalEditorOptions): Promise<ExternalEditorResult> {
	const directory = mkdtempSync(join(tmpdir(), `${APP_NAME}-editor-`));
	const filePath = join(directory, "prompt.md");
	try {
		writeFileSync(filePath, options.content, "utf-8");
		const commandArgs = parseExternalEditorCommand(options.command);
		if (!commandArgs?.length) return { status: "failed" };
		const [editor, ...editorArgs] = commandArgs;
		if (!editor) return { status: "failed" };
		process.stdout.write(
			`Launching external editor: ${options.command}\n${APP_DISPLAY_NAME} will resume when the editor exits.\n`,
		);

		// Do not use spawnSync here. On Windows, synchronous child_process calls can keep
		// Node/libuv's console input read active after the parent pauses stdin, racing
		// vim/nvim for the console input buffer until Ctrl+C cancels the pending read.
		const exitCode = await new Promise<number | null>((resolve) => {
			const child = spawnProcess(editor, [...editorArgs, filePath], {
				stdio: "inherit",
			});
			child.on("error", () => resolve(null));
			child.on("close", (code) => resolve(code));
		});

		if (exitCode !== 0) {
			return { status: "failed" };
		}

		return { status: "complete", content: stripBom(readFileSync(filePath, "utf-8")).replace(/\n$/, "") };
	} finally {
		try {
			rmSync(directory, { recursive: true, force: true });
		} catch {
			// Cleanup is best effort.
		}
	}
}
