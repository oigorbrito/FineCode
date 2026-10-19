import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { Console } from 'node:console'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import { join, resolve } from 'node:path'
import { PiRpcManager, setPiExecutableOverride } from '../src/main/pi-rpc-manager.ts'

const log = new Console(process.stdout, process.stderr)

function sampleEngineProcess(pid) {
  if (process.platform !== 'win32' || !pid) return null
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile', '-Command', `$p=Get-Process -Id ${pid}; @{rssBytes=$p.WorkingSet64; cpuSeconds=$p.CPU} | ConvertTo-Json -Compress`,
    ], { encoding: 'utf8', windowsHide: true })
    return JSON.parse(output.trim())
  } catch {
    return null
  }
}
const agent = resolve(process.argv[2] ?? '../../packages/coding-agent/dist/bundle/cli.js')
assert.ok(agent.endsWith('.js'), 'pass FineCode packages/coding-agent/dist/bundle/cli.js')
const data = await mkdtemp(join(tmpdir(), 'desktop03-data-'))
const project = await mkdtemp(join(tmpdir(), 'desktop03-project-'))
const finecodeData = join(data, 'finecode-agent')
await mkdir(finecodeData, { recursive: true })
const requests = []
let cancelledRequestCount = 0
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  requests.push({ model: body.model, messages: Array.isArray(body.messages) ? body.messages.length : 0 })
  if (requests.length === 5) {
    response.on('close', () => { cancelledRequestCount++ })
    return
  }

  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${JSON.stringify(chunk)}\n\n`)
  if (requests.length === 1 || requests.length === 3) {
    const path = requests.length === 1 ? 'result.txt' : 'denied.txt'
    const id = requests.length === 1 ? 'call-write-1' : 'call-write-denied'
    send({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name: 'write', arguments: JSON.stringify({ path, content: 'desktop03 deterministic result\n' }) } }] }, finish_reason: null }] })
    send({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
  } else {
    send({ choices: [{ index: 0, delta: { content: 'Desktop integration completed.' }, finish_reason: null }] })
    send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  }
  send('[DONE]')
  response.end()
})
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
const address = server.address()
assert.ok(address && typeof address === 'object')
await writeFile(join(finecodeData, 'models.json'), JSON.stringify({ providers: { local: {
  baseUrl: `http://127.0.0.1:${address.port}/v1`, api: 'openai-completions', apiKey: 'local-only',
  models: [{ id: 'deterministic', name: 'Desktop03 deterministic', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 256 }],
} } }), 'utf8')
process.env.PI_DESKTOP_USER_DATA_DIR = data
process.env.FINECODE_CODING_AGENT_DIR = finecodeData
setPiExecutableOverride(agent, 'finecode')
const manager = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 20_000 })
const events = []
let approvalCount = 0
let deniedApprovalCount = 0
let denyNextWrite = false
let promptStartedAt = null
let firstStreamMs = null
manager.on('event', (event) => {
  events.push(event)
  if (event.type === 'message_update' && promptStartedAt !== null && firstStreamMs === null) {
    firstStreamMs = performance.now() - promptStartedAt
  }
  if (event.type === 'extension_ui_request' && event.method === 'confirm') {
    assert.match(event.message ?? '', /FineCode/)
    if (denyNextWrite) {
      denyNextWrite = false
      deniedApprovalCount++
      manager.sendExtensionUiResponse(event.id, { confirmed: false })
    } else {
      approvalCount++
      manager.sendExtensionUiResponse(event.id, { confirmed: true })
    }
  }
})
try {
  const startupStartedAt = performance.now()
  const status = await manager.start({
    cwd: project,
    engine: 'finecode',
    provider: 'local',
    model: 'deterministic',
    args: ['-e', resolve('resources/pi-desktop-permissions.ts'), '--no-mcp'],
    env: {
      PI_DESKTOP_PERMISSION_MODE: 'ask-edits',
      PI_DESKTOP_AGENT_LABEL: 'FineCode',
      PI_DESKTOP_PERMISSION_RULES_PATH: join(data, 'permission-rules.json'),
      PI_DESKTOP_WORKSPACE_TRUSTED: '0',
    },
  })
  assert.equal(status.status, 'running', status.error ?? 'FineCode failed to start')
  const rpcReadyMs = performance.now() - startupStartedAt
  const engineProcessAtReady = sampleEngineProcess(status.pid)
  assert.equal((await manager.sendCommand({ type: 'get_state' })).success, true)
  promptStartedAt = performance.now()
  const promptResult = await manager.sendCommand({ type: 'prompt', message: 'Use the write tool to create result.txt in the workspace.' })
  assert.ok(promptResult?.success !== false, 'prompt RPC should be accepted')
  for (let elapsed = 0; elapsed < 15_000; elapsed += 50) {
    if (events.some((event) => event.type === 'agent_end')) break
    await delay(50)
  }

  const sessionsRoot = join(finecodeData, 'sessions')
  const sessionProjectDir = join(sessionsRoot, (await readdir(sessionsRoot))[0])
  const sessionPath = join(sessionProjectDir, (await readdir(sessionProjectDir)).find((entry) => entry.endsWith('.jsonl')) ?? '')
  assert.ok(sessionPath.endsWith('.jsonl'), 'FineCode session file should exist')
  assert.equal(await readFile(join(project, 'result.txt'), 'utf8'), 'desktop03 deterministic result\n')
  assert.ok(events.some((event) => event.type === 'message_update'), 'streamed text/tool events should reach the host')
  assert.ok(events.some((event) => event.type === 'tool_execution_start'), 'tool lifecycle events should stream')
  assert.equal(approvalCount, 1, 'the desktop permission extension should require approval for the write')
  assert.ok(events.some((event) => event.type === 'agent_end'), 'agent completion should stream')
  assert.ok((await readFile(sessionPath, 'utf8')).includes('desktop03 deterministic result'))

  const completedTurns = events.filter((event) => event.type === 'agent_end').length
  denyNextWrite = true
  const deniedPrompt = await manager.sendCommand({ type: 'prompt', message: 'Use the write tool to create denied.txt in the workspace.' })
  assert.ok(deniedPrompt?.success !== false, 'denial prompt RPC should be accepted')
  for (let elapsed = 0; elapsed < 10_000 && events.filter((event) => event.type === 'agent_end').length === completedTurns; elapsed += 50) {
    await delay(50)
  }
  assert.equal(deniedApprovalCount, 1, 'the desktop permission extension should deliver a denial')
  assert.equal((await readdir(project)).includes('denied.txt'), false, 'denied tools must not write into the project')

  const engineProcessAfterWorkflow = sampleEngineProcess(status.pid)
  const agentEndCount = events.filter((event) => event.type === 'agent_end').length
  const pendingPrompt = manager.sendCommand({ type: 'prompt', message: 'Wait for the local server and then stop.' })
  for (let elapsed = 0; elapsed < 10_000 && requests.length < 5; elapsed += 25) {
    await delay(25)
  }
  assert.equal(requests.length, 5, 'the deterministic provider should receive the cancellation prompt')
  const abort = await manager.sendCommand({ type: 'abort' })
  assert.equal(abort?.success, true, 'the runtime should acknowledge cancellation')
  await pendingPrompt
  for (let elapsed = 0; elapsed < 5_000 && events.filter((event) => event.type === 'agent_end').length === agentEndCount; elapsed += 25) {
    await delay(25)
  }
  assert.ok(cancelledRequestCount > 0, 'abort should cancel the in-flight local provider request')

  await manager.stopAndWait()
  const resumed = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 20_000 })
  try {
    const resumeStatus = await resumed.start({ cwd: project, engine: 'finecode', sessionPath, provider: 'local', model: 'deterministic', args: ['-e', resolve('resources/pi-desktop-permissions.ts'), '--no-mcp'] })
    assert.equal(resumeStatus.status, 'running', resumeStatus.error ?? 'FineCode session resume failed')
    assert.equal((await resumed.sendCommand({ type: 'get_messages' })).success, true)
  } finally {
    await resumed.stopAndWait()
  }

  log.log(JSON.stringify({
    result: 'PASS_RPC_VERTICAL_SLICE', engine: status.engine, sessionPath,
    providerRequests: requests.length, permissionPrompts: approvalCount, deniedPermissionPrompts: deniedApprovalCount,
    cancelledProviderRequests: cancelledRequestCount,
    benchmark: {
      rpcReadyMs: Math.round(rpcReadyMs),
      firstStreamMs: firstStreamMs === null ? null : Math.round(firstStreamMs),
      engineProcess: {
        pid: status.pid,
        rssAtReadyBytes: engineProcessAtReady?.rssBytes ?? null,
        rssAfterWorkflowBytes: engineProcessAfterWorkflow?.rssBytes ?? null,
        cpuSecondsDelta: engineProcessAtReady && engineProcessAfterWorkflow
          ? Math.max(0, engineProcessAfterWorkflow.cpuSeconds - engineProcessAtReady.cpuSeconds)
          : null,
      },
    },
    eventTypes: [...new Set(events.map((event) => event.type))],
  }))
} finally {
  await manager.stopAndWait()
  server.close()
  setPiExecutableOverride(null, 'auto')
  delete process.env.FINECODE_CODING_AGENT_DIR
  delete process.env.PI_DESKTOP_USER_DATA_DIR
  await rm(data, { recursive: true, force: true })
  await rm(project, { recursive: true, force: true })
}
