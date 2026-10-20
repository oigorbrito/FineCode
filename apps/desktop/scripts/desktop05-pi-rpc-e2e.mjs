import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Console } from 'node:console'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join, resolve } from 'node:path'
import { PiRpcManager, setPiExecutableOverride } from '../src/main/pi-rpc-manager.ts'

const log = new Console(process.stdout, process.stderr)
const executable = resolve(process.argv[2] ?? '')
assert.ok(executable.toLowerCase().endsWith('.cmd'), 'pass the installed Windows Pi .cmd shim path')
const piVersion = (await readFile(join(dirname(dirname(executable)), 'install', 'current-version'), 'utf8')).trim()
assert.equal(piVersion, '1.3.0', 'the installed Pi version must match the fixed baseline')
const data = await mkdtemp(join(tmpdir(), 'desktop05-pi-data-'))
const home = join(data, 'home')
const appData = join(home, 'AppData', 'Roaming')
const localAppData = join(home, 'AppData', 'Local')
const agentDir = join(data, 'pi-agent')
const ompAgentDir = join(data, 'omp-agent')
const project = await mkdtemp(join(tmpdir(), 'desktop05-pi-project-'))
await mkdir(agentDir, { recursive: true })
await mkdir(ompAgentDir, { recursive: true })
await mkdir(appData, { recursive: true })
await mkdir(localAppData, { recursive: true })
let providerRequests = 0
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  providerRequests++
  assert.equal(body.model, 'deterministic')
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${chunk === '[DONE]' ? chunk : JSON.stringify(chunk)}\n\n`)
  send({ choices: [{ index: 0, delta: { content: 'Pi RPC integration completed.' }, finish_reason: null }] })
  send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  send('[DONE]')
  response.end()
})
await new Promise((listen) => server.listen(0, '127.0.0.1', listen))
const address = server.address()
assert.ok(address && typeof address === 'object')
await writeFile(join(agentDir, 'models.json'), JSON.stringify({ providers: { local: {
  baseUrl: `http://127.0.0.1:${address.port}/v1`,
  api: 'openai-completions',
  apiKey: 'local-only',
  models: [{
    id: 'deterministic', name: 'Desktop05 Pi deterministic', reasoning: false, input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 256,
  }],
} } }), 'utf8')

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
  PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
  OMP_CODING_AGENT_DIR: process.env.OMP_CODING_AGENT_DIR,
}
process.env.HOME = home
process.env.USERPROFILE = home
process.env.APPDATA = appData
process.env.LOCALAPPDATA = localAppData
process.env.PI_CODING_AGENT_DIR = agentDir
process.env.OMP_CODING_AGENT_DIR = ompAgentDir
setPiExecutableOverride(executable, 'pi')
const manager = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 30_000 })
const events = []
manager.on('event', (event) => events.push(event))

try {
  const status = await manager.start({
    cwd: project, engine: 'pi', provider: 'local', model: 'deterministic',
    args: ['-e', resolve('resources/pi-desktop-permissions.ts')],
    env: { ...credentialEnv, HOME: home, USERPROFILE: home },
  })
  assert.equal(status.status, 'running', status.error ?? 'Pi failed to start')
  assert.equal(status.engine, 'pi')
  assert.equal((await manager.sendCommand({ type: 'get_state' })).success, true, 'Pi RPC state request should succeed')
  assert.ok((await manager.sendCommand({ type: 'prompt', message: 'Return the deterministic completion.' }))?.success !== false)
  for (let elapsed = 0; elapsed < 15_000 && !events.some((event) => event.type === 'agent_end'); elapsed += 50) await delay(50)
  assert.ok(events.some((event) => event.type === 'message_update'), 'Pi streaming events should reach the desktop manager')
  assert.ok(events.some((event) => event.type === 'agent_end'), 'Pi should finish the deterministic RPC turn')
  assert.equal(providerRequests, 1)

  const sessionsRoot = join(agentDir, 'sessions')
  const sessionDir = join(sessionsRoot, (await readdir(sessionsRoot))[0])
  const sessionPath = join(sessionDir, (await readdir(sessionDir)).find((name) => name.endsWith('.jsonl')) ?? '')
  assert.ok(sessionPath.endsWith('.jsonl'), 'Pi must persist a session inside its isolated agent root')
  assert.ok((await readFile(sessionPath, 'utf8')).includes('Pi RPC integration completed.'))
  await manager.stopAndWait()

  const resumed = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 30_000 })
  try {
    const resumeStatus = await resumed.start({
      cwd: project, engine: 'pi', sessionPath, provider: 'local', model: 'deterministic',
      args: ['-e', resolve('resources/pi-desktop-permissions.ts')],
      env: { ...credentialEnv, HOME: home, USERPROFILE: home },
    })
    assert.equal(resumeStatus.status, 'running', resumeStatus.error ?? 'Pi session resume failed')
    assert.equal(resumeStatus.engine, 'pi')
    assert.equal((await resumed.sendCommand({ type: 'get_messages' })).success, true, 'Pi should restore persisted messages')
  } finally {
    await resumed.stopAndWait()
  }

  log.log(JSON.stringify({
    result: 'PASS_PI_RPC_CONTRACT', engine: status.engine, version: piVersion, providerRequests,
    sessionPath, eventTypes: [...new Set(events.map((event) => event.type))],
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
