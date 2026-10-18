import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type ExternalEditorResult, editInExternalEditor } from "../src/modes/interactive/external-editor.ts";

const editorFixturePath = fileURLToPath(new URL("./fixtures/fake-external-editor.mjs", import.meta.url));

interface EditorCapture {
	filePath: string;
	content: string;
	entries: string[];
	directoryMode: number;
	arguments: string[];
}

function quoteCommandArgument(value: string): string {
	return `"${value.replaceAll('"', '\\"')}"`;
}

async function runExternalEditor(
	options: { fixtureFlag?: "--fail" | "--empty"; editorArguments?: string[] } = {},
): Promise<{
	result: ExternalEditorResult;
	capture: EditorCapture;
}> {
	const testDirectory = mkdtempSync(join(tmpdir(), "pi-external-editor-test-"));
	const capturePath = join(testDirectory, "capture.json");
	try {
		const commandArguments = [
			process.execPath,
			editorFixturePath,
			capturePath,
			...(options.editorArguments ?? []),
			...(options.fixtureFlag ? [options.fixtureFlag] : []),
		];
		const result = await editInExternalEditor({
			command: commandArguments.map(quoteCommandArgument).join(" "),
			content: "original",
		});
		const capture = JSON.parse(readFileSync(capturePath, "utf-8")) as EditorCapture;
		return { result, capture };
	} finally {
		rmSync(testDirectory, { recursive: true, force: true });
	}
}

describe("editInExternalEditor", () => {
	// #7875: Windows paths with spaces must work without enabling shell parsing.
	it("edits a prompt inside a private temporary directory", async () => {
		const { result, capture } = await runExternalEditor();
		const directory = dirname(capture.filePath);

		expect(result).toEqual({ status: "complete", content: "edited" });
		expect(dirname(directory)).toBe(tmpdir());
		expect(basename(directory)).toMatch(/^finecode-editor-.+$/);
		expect(basename(capture.filePath)).toBe("prompt.md");
		expect(capture.entries).toEqual(["prompt.md"]);
		expect(capture.content).toBe("original");
		if (process.platform !== "win32") {
			expect(capture.directoryMode & 0o077).toBe(0);
		}
		expect(existsSync(directory)).toBe(false);
	});

	it("keeps the original content when the editor exits unsuccessfully", async () => {
		const { result, capture } = await runExternalEditor({ fixtureFlag: "--fail" });

		expect(result).toEqual({ status: "failed" });
		expect(existsSync(dirname(capture.filePath))).toBe(false);
	});
	it("preserves quoted executable paths and arguments", async () => {
		const expectedArguments = [
			"--profile",
			"My Profile",
			"--path",
			"C:\\Users\\Dev\\some dir",
			"--message",
			'say "hello"',
			"",
		];
		const { result, capture } = await runExternalEditor({ editorArguments: expectedArguments });

		expect(result).toEqual({ status: "complete", content: "edited" });
		expect(capture.arguments).toEqual(expectedArguments);
	});

	it("rejects an unterminated quoted command", async () => {
		const result = await editInExternalEditor({
			command: `${quoteCommandArgument(process.execPath)} "unterminated`,
			content: "original",
		});

		expect(result).toEqual({ status: "failed" });
	});

	it("returns empty content when the editor clears the prompt", async () => {
		const { result } = await runExternalEditor({ fixtureFlag: "--empty" });

		expect(result).toEqual({ status: "complete", content: "" });
	});
});
