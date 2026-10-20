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

async function runExternalEditor(
	fixtureFlag?: "--fail" | "--empty",
	editorArguments: string[] = [],
): Promise<{
	result: ExternalEditorResult;
	capture: EditorCapture;
}> {
	const testDirectory = mkdtempSync(join(tmpdir(), "finecode external editor test "));
	const capturePath = join(testDirectory, "capture.json");
	try {
		const result = await editInExternalEditor({
			command: [
				process.execPath,
				editorFixturePath,
				capturePath,
				...editorArguments,
				...(fixtureFlag ? [fixtureFlag] : []),
			]
				.map((arg) => `"${arg.replaceAll('"', '\\"')}"`)
				.join(" "),
			content: "original",
		});
		const capture = JSON.parse(readFileSync(capturePath, "utf-8")) as EditorCapture;
		return { result, capture };
	} finally {
		rmSync(testDirectory, { recursive: true, force: true });
	}
}

describe("editInExternalEditor", () => {
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
		const { result, capture } = await runExternalEditor("--fail");

		expect(result).toEqual({ status: "failed" });
		expect(existsSync(dirname(capture.filePath))).toBe(false);
	});
	it("preserves quoted arguments and literal shell metacharacters", async () => {
		const arguments_ = ["My Profile", "C:\\Users\\Dev\\some dir", 'say "hello"', "", "& echo must-not-run", "$HOME"];
		const { result, capture } = await runExternalEditor(undefined, arguments_);
		expect(result).toEqual({ status: "complete", content: "edited" });
		expect(capture.arguments).toEqual(arguments_);
	});

	it("rejects an unterminated quoted command", async () => {
		await expect(editInExternalEditor({ command: '"unterminated', content: "original" })).resolves.toEqual({
			status: "failed",
		});
	});

	it("returns empty content when the editor clears the prompt", async () => {
		const { result } = await runExternalEditor("--empty");

		expect(result).toEqual({ status: "complete", content: "" });
	});
});
