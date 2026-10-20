import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Console } from 'node:console'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { join, resolve } from 'node:path'
import { PiRpcManager, setPiExecutableOverride } from '../src/main/pi-rpc-manager.ts'

const log = new Console(process.stdout, process.stderr)
const ompExecutable = resolve(process.argv[2] ?? '')
assert.ok(ompExecutable.endsWith('.exe'), 'pass the isolated OMP executable shim path')
const bunBin = process.env.DESKTOP05_BUN_BIN ?? join(
  process.env.APPDATA ?? join(process.env.USERPROFILE ?? tmpdir(), 'AppData', 'Roaming'),
  'npm', 'node_modules', 'bun', 'bin',
)
const isolatedPath = `${bunBin};${process.env.PATH ?? ''}`
const ompVersion = execFileSync(ompExecutable, ['--version'], {
  encoding: 'utf8',
  env: { ...process.env, PATH: isolatedPath },
}).trim()
assert.equal(ompVersion, 'omp/18.12.2', 'the isolated OMP version must match the reproducible baseline')
const data = await mkdtemp(join(tmpdir(), 'desktop05-omp-data-'))
const home = join(data, 'home')
const appData = join(home, 'AppData', 'Roaming')
const localAppData = join(home, 'AppData', 'Local')
const agentDir = join(data, 'omp-agent')
const piAgentDir = join(data, 'pi-agent')
const project = await mkdtemp(join(tmpdir(), 'desktop05-omp-project-'))
await mkdir(agentDir, { recursive: true })
await mkdir(piAgentDir, { recursive: true })
await mkdir(appData, { recursive: true })
await mkdir(localAppData, { recursive: true })
const requests = []
let cancelledRequests = 0
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  requests.push({ url: request.url, model: body.model, messages: Array.isArray(body.messages) ? body.messages.length : 0 })
  if (requests.length === 5) {
    response.on('close', () => { cancelledRequests++ })
    return
  }

  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${chunk === '[DONE]' ? chunk : JSON.stringify(chunk)}\n\n`)
  if (requests.length === 1 || requests.length === 3) {
    const path = requests.length === 1 ? 'omp-approved.txt' : 'omp-denied.txt'
    const id = requests.length === 1 ? 'omp-call-approved' : 'omp-call-denied'
    send({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name: 'write', arguments: JSON.stringify({ path, content: 'OMP deterministic result\n' }) } }] }, finish_reason: null }] })
    send({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
  } else {
    send({ choices: [{ index: 0, delta: { content: 'OMP integration completed.' }, finish_reason: null }] })
    send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  }
  send('[DONE]')
  response.end()
})
await new Promise((listen) => server.listen(0, '127.0.0.1', listen))
const address = server.address()
assert.ok(address && typeof address === 'object')
await writeFile(join(agentDir, 'models.yml'), `providers:\n  local:\n    baseUrl: http://127.0.0.1:${address.port}/v1\n    api: openai-completions\n    apiKey: local-only\n    models:\n      - id: deterministic\n        name: Desktop05 OMP deterministic\n        reasoning: false\n        input: [text]\n        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }\n        contextWindow: 4096\n        maxTokens: 256\n`, 'utf8')

const credentialEnv = Object.fromEntries(
  Object.keys(process.env)
    .filter((key) => /(?:API_KEY|TOKEN|SECRET(?:_ACCESS_KEY)?|ACCESS_KEY_ID|CLIENT_CERT|CLIENT_KEY)$/i.test(key))
    .map((key) => [key, '']),
)
const savedEnv = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  PI_DESKTOP_USER_DATA_DIR: process.env.PI_DESKTOP_USER_DATA_DIR,
  PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
  OMP_CODING_AGENT_DIR: process.env.OMP_CODING_AGENT_DIR,
}
process.env.HOME = home
process.env.USERPROFILE = home
process.env.APPDATA = appData
process.env.LOCALAPPDATA = localAppData
process.env.PI_DESKTOP_USER_DATA_DIR = data
process.env.PI_CODING_AGENT_DIR = piAgentDir
process.env.OMP_CODING_AGENT_DIR = agentDir
setPiExecutableOverride(ompExecutable, 'omp')

const manager = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 30_000 })
const events = []
let approved = 0
let denied = 0
let denyNext = false
manager.on('event', (event) => {
  events.push(event)
  if (event.type === 'extension_ui_request' && event.method === 'confirm') {
    assert.match(event.message ?? '', /OMP/)
    if (denyNext) {
      denyNext = false
      denied++
      manager.sendExtensionUiResponse(event.id, { confirmed: false })
    } else {
      approved++
      manager.sendExtensionUiResponse(event.id, { confirmed: true })
    }
  }
})

try {
  const status = await manager.start({
    cwd: project,
    engine: 'omp',
    provider: 'local',
    model: 'deterministic',
    args: ['-e', resolve('resources/pi-desktop-permissions.ts')],
    env: {
      ...credentialEnv,
      PATH: isolatedPath,
      HOME: home,
      USERPROFILE: home,
      OMP_CODING_AGENT_DIR: agentDir,
      PI_DESKTOP_PERMISSION_MODE: 'ask-edits',
      PI_DESKTOP_AGENT_LABEL: 'OMP',
      PI_DESKTOP_PERMISSION_RULES_PATH: join(data, 'permission-rules.json'),
      PI_DESKTOP_WORKSPACE_TRUSTED: '0',
    },
  })
  assert.equal(status.status, 'running', status.error ?? 'OMP failed to start')
  assert.equal(status.engine, 'omp', `expected OMP engine, got ${String(status.engine)}`)
  assert.equal((await manager.sendCommand({ type: 'get_state' })).success, true, 'OMP RPC state request should succeed')

  const prompt = await manager.sendCommand({ type: 'prompt', message: 'Use the write tool to create omp-approved.txt in the workspace.' })
  assert.ok(prompt?.success !== false, 'OMP prompt should be accepted')
  for (let elapsed = 0; elapsed < 20_000 && !events.some((event) => event.type === 'agent_end'); elapsed += 50) await delay(50)
  assert.ok(events.some((event) => event.type === 'message_update'), 'OMP streaming events should reach the desktop manager')
  assert.ok(events.some((event) => event.type === 'tool_execution_start'), 'OMP tool lifecycle should reach the desktop manager')
  assert.equal(approved, 1, 'desktop permission confirmation should be requested')
  assert.equal(await readFile(join(project, 'omp-approved.txt'), 'utf8'), 'OMP deterministic result\n')

  const sessionsRoot = join(agentDir, 'sessions')
  const sessionDir = join(sessionsRoot, (await readdir(sessionsRoot))[0])
  const sessionPath = join(sessionDir, (await readdir(sessionDir)).find((name) => name.endsWith('.jsonl')) ?? '')
  assert.ok(sessionPath.endsWith('.jsonl'), 'OMP must persist a session inside the isolated agent root')
  assert.ok(sessionPath.startsWith(agentDir), 'OMP session must not be written into the inherited Pi root')
  assert.ok((await readFile(sessionPath, 'utf8')).includes('OMP deterministic result'))

  const completedTurns = events.filter((event) => event.type === 'agent_end').length
  denyNext = true
  assert.ok((await manager.sendCommand({ type: 'prompt', message: 'Use the write tool to create omp-denied.txt in the workspace.' }))?.success !== false)
  for (let elapsed = 0; elapsed < 15_000 && events.filter((event) => event.type === 'agent_end').length === completedTurns; elapsed += 50) await delay(50)
  assert.equal(denied, 1, 'desktop permission denial should be delivered')
  assert.equal((await readdir(project)).includes('omp-denied.txt'), false, 'a denied OMP tool must not write the file')

  const completedBeforeCancel = events.filter((event) => event.type === 'agent_end').length
  const pendingPrompt = manager.sendCommand({ type: 'prompt', message: 'Wait for the local server and then stop.' })
  for (let elapsed = 0; elapsed < 15_000 && requests.length < 5; elapsed += 25) await delay(25)
  assert.equal(requests.length, 5, 'OMP should send the cancellation turn to the local provider')
  assert.equal((await manager.sendCommand({ type: 'abort' }))?.success, true, 'OMP should acknowledge abort')
  await pendingPrompt
  for (let elapsed = 0; elapsed < 5_000 && events.filter((event) => event.type === 'agent_end').length === completedBeforeCancel; elapsed += 25) await delay(25)
  assert.ok(cancelledRequests > 0, 'abort should cancel OMP’s in-flight provider request')

  await manager.stopAndWait()
  const resumed = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 30_000 })
  try {
    const resumeStatus = await resumed.start({
      cwd: project, engine: 'omp', sessionPath, provider: 'local', model: 'deterministic',
      args: ['-e', resolve('resources/pi-desktop-permissions.ts')],
      env: { ...credentialEnv, PATH: isolatedPath, HOME: home, USERPROFILE: home, OMP_CODING_AGENT_DIR: agentDir },
    })
    assert.equal(resumeStatus.status, 'running', resumeStatus.error ?? 'OMP session resume failed')
    assert.equal(resumeStatus.engine, 'omp')
    assert.equal((await resumed.sendCommand({ type: 'get_messages' })).success, true, 'OMP should load persisted messages')
  } finally {
    await resumed.stopAndWait()
  }

  log.log(JSON.stringify({
    result: 'PASS_OMP_RPC_CONTRACT', engine: status.engine, version: ompVersion, sessionPath,
    providerRequests: requests.length, approvedPermissionPrompts: approved, deniedPermissionPrompts: denied,
    cancelledProviderRequests: cancelledRequests,
    eventTypes: [...new Set(events.map((event) => event.type))],
    protocolNotes: ['OMP uses get_available_commands rather than get_commands', 'OMP session root is controlled by PI_CODING_AGENT_DIR'],
  }))
} finally {
  await manager.stopAndWait()
  server.close()
  setPiExecutableOverride(null, 'auto')
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
  await rm(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
}
