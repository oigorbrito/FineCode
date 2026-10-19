import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Console } from 'node:console'
import { execFileSync, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { PiRpcManager, setPiExecutableOverride } from '../src/main/pi-rpc-manager.ts'

const ENGINE_ORDER = ['pi', 'omp', 'finecode']
const log = new Console(process.stdout, process.stderr)
const executables = {
  pi: resolve(process.argv[2] ?? ''),
  omp: resolve(process.argv[3] ?? ''),
  finecode: resolve(process.argv[4] ?? ''),
}
assert.ok(executables.pi.toLowerCase().endsWith('.cmd'), 'pass the installed Windows Pi .cmd shim path')
assert.ok(executables.omp.toLowerCase().endsWith('.exe'), 'pass the isolated OMP executable shim path')
assert.ok(executables.finecode.endsWith('.js'), 'pass FineCode packages/coding-agent/dist/bundle/cli.js')
const iterations = Number(process.env.DESKTOP05_BENCH_ITERATIONS ?? '3')
assert.ok(Number.isInteger(iterations) && iterations > 0, 'DESKTOP05_BENCH_ITERATIONS must be a positive integer')
const bunBin = process.env.DESKTOP05_BUN_BIN ?? join(
  process.env.APPDATA ?? join(process.env.USERPROFILE ?? tmpdir(), 'AppData', 'Roaming'),
  'npm', 'node_modules', 'bun', 'bin',
)
const isolatedPath = `${bunBin};${process.env.PATH ?? ''}`
const piVersion = (await readFile(join(dirname(dirname(executables.pi)), 'install', 'current-version'), 'utf8')).trim()
const ompVersion = execFileSync(executables.omp, ['--version'], {
  encoding: 'utf8', env: { ...process.env, PATH: isolatedPath },
}).trim()
const finecodeRoot = resolve(dirname(executables.finecode), '../../../..')
const finecodeCommit = execFileSync('git', ['-C', finecodeRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
assert.equal(piVersion, '1.3.0', 'the Pi version must match the fixed baseline')
assert.equal(ompVersion, 'omp/18.12.2', 'the OMP version must match the isolated baseline')
assert.equal(finecodeCommit, 'd14b91f58924b1f8e649a422fb07e590e1f12ef7', 'the FineCode revision must match the fixed baseline')
const data = await mkdtemp(join(tmpdir(), 'desktop05-engine-benchmark-data-'))
const home = join(data, 'home')
const appData = join(home, 'AppData', 'Roaming')
const localAppData = join(home, 'AppData', 'Local')
const project = await mkdtemp(join(tmpdir(), 'desktop05-engine-benchmark-project-'))
const agentDirs = {
  pi: join(data, 'pi-agent'),
  omp: join(data, 'omp-agent'),
  finecode: join(data, 'finecode-agent'),
}
for (const agentDir of Object.values(agentDirs)) await mkdir(agentDir, { recursive: true })
await mkdir(appData, { recursive: true })
await mkdir(localAppData, { recursive: true })
const prompt = 'Return exactly the text: DESKTOP05_ENGINE_BENCHMARK_OK'
const requests = []
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks)
  const body = JSON.parse(raw.toString('utf8'))
  requests.push({ time: performance.now(), bytes: raw.byteLength, model: body.model, promptTokens: Math.ceil(raw.byteLength / 4) })
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${chunk === '[DONE]' ? chunk : JSON.stringify(chunk)}\n\n`)
  send({ choices: [{ index: 0, delta: { content: 'DESKTOP05_ENGINE_BENCHMARK_OK' }, finish_reason: null }] })
  send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  send('[DONE]')
  response.end()
})
await new Promise((listen) => server.listen(0, '127.0.0.1', listen))
const address = server.address()
assert.ok(address && typeof address === 'object')
const jsonModelConfig = JSON.stringify({ providers: { local: {
  baseUrl: `http://127.0.0.1:${address.port}/v1`, api: 'openai-completions', apiKey: 'local-only',
  models: [{ id: 'deterministic', name: 'Desktop05 local benchmark', reasoning: false, input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 64 }],
} } })
await writeFile(join(agentDirs.pi, 'models.json'), jsonModelConfig, 'utf8')
await writeFile(join(agentDirs.finecode, 'models.json'), jsonModelConfig, 'utf8')
await writeFile(join(agentDirs.omp, 'models.yml'), `providers:\n  local:\n    baseUrl: http://127.0.0.1:${address.port}/v1\n    api: openai-completions\n    apiKey: local-only\n    models:\n      - id: deterministic\n        name: Desktop05 local benchmark\n        reasoning: false\n        input: [text]\n        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }\n        contextWindow: 4096\n        maxTokens: 64\n`, 'utf8')

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
process.env.PI_CODING_AGENT_DIR = agentDirs.pi
process.env.OMP_CODING_AGENT_DIR = agentDirs.omp
const noPaidCallsEnv = {
  ...credentialEnv,
  PATH: isolatedPath,
  HOME: home,
  USERPROFILE: home,
  APPDATA: appData,
  LOCALAPPDATA: localAppData,
  PI_DESKTOP_USER_DATA_DIR: data,
  PI_CODING_AGENT_DIR: agentDirs.pi,
  OMP_CODING_AGENT_DIR: agentDirs.omp,
  PI_OFFLINE: '1',
}

async function sampleProcessTree(pid) {
  if (process.platform !== 'win32' || !pid) return null
  const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const command = `$all=Get-CimInstance Win32_Process;$ids=[System.Collections.Generic.List[int]]::new();$ids.Add(${pid});for($i=0;$i -lt $ids.Count;$i++){foreach($p in $all){if([int]$p.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$p.ProcessId)){$ids.Add([int]$p.ProcessId)}}};$ps=Get-Process -Id $ids.ToArray() -ErrorAction SilentlyContinue;@{rssBytes=[int64](($ps|Measure-Object WorkingSet64 -Sum).Sum);cpuSeconds=[double](($ps|Measure-Object CPU -Sum).Sum)}|ConvertTo-Json -Compress`
  const result = spawnSync(powershell, ['-NoProfile', '-Command', command], {
    encoding: 'utf8', windowsHide: true, timeout: 10_000,
  })
  if (result.status !== 0) return null
  try {
    const sample = JSON.parse(result.stdout.trim())
    return { rssBytes: Number(sample.rssBytes), cpuSeconds: Number(sample.cpuSeconds) }
  } catch {
    return null
  }
}

async function runEngine(engine, collectResources) {
  const requestStart = requests.length
  const started = performance.now()
  const manager = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 30_000 })
  const events = []
  let completedAt = null
  let firstStreamAt = null
  manager.on('event', (event) => {
    events.push(event)
    if (event.type === 'message_update' && firstStreamAt === null) firstStreamAt = performance.now()
    if (event.type === 'agent_end' && completedAt === null) completedAt = performance.now()
  })

  let peakWorkingSetBytes = null
  let cpuAtReady = null
  let cpuAtCompletion = null
  let nextSampleAt = 0
  try {
    setPiExecutableOverride(executables[engine], engine)
    const status = await manager.start({
      cwd: project, engine, provider: 'local', model: 'deterministic', noSession: true,
      args: ['--no-tools', '--no-extensions'],
      env: noPaidCallsEnv,
    })
    assert.equal(status.status, 'running', status.error ?? `${engine} RPC did not start`)
    assert.equal(status.engine, engine)
    const rpcReadyAt = performance.now()
    const pid = manager.getStatus().pid
    if (collectResources && pid) {
      const sample = await sampleProcessTree(pid)
      if (sample) {
        peakWorkingSetBytes = sample.rssBytes
        cpuAtReady = sample.cpuSeconds
      }
    }

    const promptStartedAt = performance.now()
    assert.ok((await manager.sendCommand({ type: 'prompt', message: prompt }))?.success !== false)
    for (let elapsed = 0; elapsed < 20_000 && completedAt === null; elapsed += 50) {
      if (collectResources && pid && performance.now() >= nextSampleAt) {
        const sample = await sampleProcessTree(pid)
        if (sample) {
          peakWorkingSetBytes = Math.max(peakWorkingSetBytes ?? 0, sample.rssBytes)
          cpuAtCompletion = sample.cpuSeconds
        }
        nextSampleAt = performance.now() + 250
      }
      await delay(50)
    }
    assert.ok(completedAt !== null, `${engine} failed to complete its deterministic turn`)
    assert.ok(firstStreamAt !== null, `${engine} did not stream a message update`)
    const request = requests[requestStart]
    assert.ok(request, `${engine} did not call the local provider`)
    if (collectResources && pid) {
      const sample = await sampleProcessTree(pid)
      if (sample) {
        peakWorkingSetBytes = Math.max(peakWorkingSetBytes ?? 0, sample.rssBytes)
        cpuAtCompletion = sample.cpuSeconds
      }
    }
    return {
      engine, pid, rpcReadyMs: Number((rpcReadyAt - started).toFixed(1)),
      firstProviderRequestMs: Number((request.time - promptStartedAt).toFixed(1)),
      firstStreamMs: Number((firstStreamAt - promptStartedAt).toFixed(1)),
      taskDurationMs: Number((completedAt - promptStartedAt).toFixed(1)),
      requestBytes: request.bytes, promptTokensEstimate: request.promptTokens,
      peakWorkingSetBytes, cpuTimeSeconds: cpuAtReady !== null && cpuAtCompletion !== null
        ? Number(Math.max(0, cpuAtCompletion - cpuAtReady).toFixed(3)) : null,
      eventTypes: [...new Set(events.map((event) => event.type))],
    }
  } finally {
    await manager.stopAndWait()
    setPiExecutableOverride(null, 'auto')
  }
}

function orderFor(iteration) {
  const offset = (iteration - 1) % ENGINE_ORDER.length
  return [...ENGINE_ORDER.slice(offset), ...ENGINE_ORDER.slice(0, offset)]
}

try {
  const timingRuns = []
  for (let iteration = 1; iteration <= iterations; iteration++) {
    for (const engine of orderFor(iteration)) {
      timingRuns.push({ iteration, order: orderFor(iteration), ...(await runEngine(engine, false)) })
    }
  }
  const resourceRuns = []
  for (let iteration = 1; iteration <= iterations; iteration++) {
    for (const engine of orderFor(iteration)) {
      resourceRuns.push({ iteration, order: orderFor(iteration), ...(await runEngine(engine, true)) })
    }
  }
  const summary = ENGINE_ORDER.map((engine) => {
    const samples = timingRuns.filter((sample) => sample.engine === engine)
    const mean = (key) => {
      const values = samples.map((sample) => sample[key]).filter((value) => typeof value === 'number' && Number.isFinite(value))
      return values.length ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2)) : null
    }
    return {
      engine, iterations: samples.length, meanRpcReadyMs: mean('rpcReadyMs'),
      meanFirstProviderRequestMs: mean('firstProviderRequestMs'), meanFirstStreamMs: mean('firstStreamMs'),
      meanTaskDurationMs: mean('taskDurationMs'), meanRequestBytes: mean('requestBytes'),
      meanPromptTokensEstimate: mean('promptTokensEstimate'),
    }
  })
  const resourceSummary = ENGINE_ORDER.map((engine) => {
    const samples = resourceRuns.filter((sample) => sample.engine === engine)
    const cpu = samples.map((sample) => sample.cpuTimeSeconds).filter((value) => typeof value === 'number')
    return {
      engine, iterations: samples.length,
      peakWorkingSetBytes: Math.max(...samples.map((sample) => Number(sample.peakWorkingSetBytes ?? 0))) || null,
      meanCpuTimeSeconds: cpu.length ? Number((cpu.reduce((total, value) => total + value, 0) / cpu.length).toFixed(3)) : null,
    }
  })
  const result = {
    result: 'PASS_DESKTOP05_ENGINE_BENCHMARK', platform: process.platform, node: process.version,
    iterations, engines: ENGINE_ORDER,
    engineVersions: { pi: piVersion, omp: ompVersion, finecodeCommit },
    model: 'local/deterministic', tokenCost: 0,
    notes: 'All samples use the same local provider, user prompt, no-session mode, and disabled tools/extensions. Distinct native system prompts and model config formats remain. Timing runs omit process sampling; resource runs sample the engine process tree (including cmd/node descendants) every 250 ms. These are engine RPC process measurements, not packaged Electron whole-app measurements. Prompt-token estimates are request bytes / 4, not provider usage.',
    timingRuns, summary, resourceRuns, resourceSummary,
  }
  const evidencePath = resolve(process.env.DESKTOP05_BENCH_OUTPUT ?? 'DESKTOP05-BENCHMARK-RESULTS.json')
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  log.log(JSON.stringify({ ...result, evidencePath }))
} finally {
  server.close()
  setPiExecutableOverride(null, 'auto')
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
  await rm(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
}
