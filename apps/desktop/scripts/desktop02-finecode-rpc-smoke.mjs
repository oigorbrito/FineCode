import { strict as assert } from "node:assert";
import { log } from "node:console";
import process from "node:process";
import { resolve } from "node:path";
import { PiRpcManager, setPiExecutableOverride } from "../src/main/pi-rpc-manager.ts";

const finecodeEntry = resolve(process.argv[2]);
assert.ok(finecodeEntry.endsWith(".js"), "pass FineCode's built cli.js path");
process.env.PI_OFFLINE = "1";
setPiExecutableOverride(finecodeEntry, "pi");

const manager = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 15_000 });
const cwd = process.cwd();
try {
  const status = await manager.start({ cwd, noSession: true, args: ["--offline", "--no-extensions", "--no-mcp"] });
  assert.equal(status.status, "running", status.error ?? "engine failed to start");
  const state = await manager.sendCommand({ type: "get_state" });
  assert.equal(state.type, "response");
  assert.equal(state.command, "get_state");
  assert.equal(state.success, true);
  log(JSON.stringify({ status: status.status, engine: status.engine, state }));
} finally {
  await manager.stop();
}
