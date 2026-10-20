import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const vitest = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");

// Launch Node directly: POSIX environment assignments and .cmd files are not portable to Windows.
for (const [args, env] of [
	[[], process.env],
	[[], { ...process.env, PI_DURABLE_DOCUMENT_RETENTION_MS: "0" }],
	[["--config", "test-workers/vitest.config.ts"], process.env],
]) {
	const result = spawnSync(process.execPath, [vitest, "--run", ...args, ...process.argv.slice(2)], {
		env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
		break;
	}
}
