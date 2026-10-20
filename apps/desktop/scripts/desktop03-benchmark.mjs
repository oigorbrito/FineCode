import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Console } from 'node:console'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { PiRpcManager, setPiExecutableOverride } from '../src/main/pi-rpc-manager.ts'

const log = new Console(process.stdout, process.stderr)
const agent = resolve(process.argv[2] ?? '')
assert.ok(agent.endsWith('.js'), 'pass FineCode packages/coding-agent/dist/bundle/cli.js')
const iterations = Number(process.env.DESKTOP03_BENCH_ITERATIONS ?? '3')
assert.ok(Number.isInteger(iterations) && iterations > 0, 'DESKTOP03_BENCH_ITERATIONS must be a positive integer')
const prompt = 'Return exactly the text: DESKTOP03_BENCHMARK_OK'
const data = await mkdtemp(join(tmpdir(), 'desktop03-benchmark-data-'))
const project = await mkdtemp(join(tmpdir(), 'desktop03-benchmark-project-'))
const agentDir = join(data, 'finecode-agent')
const previousDesktopDataDir = process.env.PI_DESKTOP_USER_DATA_DIR
process.env.PI_DESKTOP_USER_DATA_DIR = data
await mkdir(agentDir, { recursive: true })
const requests = []
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks)
  const body = JSON.parse(raw.toString('utf8'))
  const logEntry = { time: performance.now(), bytes: raw.byteLength, model: body.model, promptTokens: Math.ceil(raw.byteLength / 4) }
  requests.push(logEntry)
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${JSON.stringify(chunk)}\n\n`)
  send({ choices: [{ index: 0, delta: { content: 'DESKTOP03_BENCHMARK_OK' }, finish_reason: null }] })
  send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  send({ choices: [], usage: { prompt_tokens: logEntry.promptTokens, completion_tokens: 1, total_tokens: logEntry.promptTokens + 1 } })
  send('[DONE]')
  response.end()
})
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
const address = server.address()
assert.ok(address && typeof address === 'object')
await writeFile(join(agentDir, 'models.json'), JSON.stringify({ providers: { local: {
  baseUrl: `http://127.0.0.1:${address.port}/v1`, api: 'openai-completions', apiKey: 'local-only',
  models: [{ id: 'deterministic', name: 'Desktop03 benchmark', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 64 }],
} } }), 'utf8')
const childEnv = { ...process.env, FINECODE_CODING_AGENT_DIR: agentDir, PI_OFFLINE: '1' }
setPiExecutableOverride(agent, 'finecode')

function workingSetBytes(pid) {
  if (process.platform === 'win32') {
    const tasklist = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tasklist.exe')
    const result = spawnSync(tasklist, ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true })
    const memory = result.stdout.match(/"([\d.,]+)\s+K"\s*$/m)?.[1]
    return memory ? Number(memory.replace(/[.,]/g, '')) * 1024 : null
  }
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8')
    const memory = status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1]
    return memory ? Number(memory) * 1024 : null
  } catch {
    return null
  }
}

function cpuSeconds(pid) {
  if (process.platform === 'win32') {
    const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const result = spawnSync(powershell, ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).CPU`], {
      encoding: 'utf8', windowsHide: true, timeout: 2_000,
    })
    const seconds = Number(result.stdout.trim().replace(',', '.'))
    return result.status === 0 && Number.isFinite(seconds) ? seconds : null
  }
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').trim().split(/\\s+/)
    return (Number(stat[13]) + Number(stat[14])) / 100
  } catch {
    return null
  }
}

async function runCli(collectResources = false) {
  const requestStart = requests.length
  const started = performance.now()
  const child = spawn(process.execPath, [
    agent, '-p', '--mode', 'json', '--no-session', '--no-tools', '--no-extensions', '--no-mcp',
    '--provider', 'local', '--model', 'deterministic', '--thinking', 'off', prompt,
  ], { cwd: project, env: childEnv, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
  let output = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { output += chunk })
  let peakWorkingSet = null
  let cpuTimeSeconds = null
  let nextCpuSampleAt = 0
  let completedAt = null
  let closed = false
  const finished = new Promise((resolveClose, reject) => {
    child.once('error', reject)
    child.once('close', (code) => {
      completedAt = performance.now()
      closed = true
      if (code !== 0) reject(new Error(`FineCode CLI exited ${String(code)}: ${output.slice(-500)}`))
      else resolveClose()
    })
  })
  if (collectResources) {
    while (!closed) {
      const sample = workingSetBytes(child.pid)
      if (sample !== null) peakWorkingSet = Math.max(peakWorkingSet ?? 0, sample)
      if (performance.now() >= nextCpuSampleAt) {
        cpuTimeSeconds = cpuSeconds(child.pid) ?? cpuTimeSeconds
        nextCpuSampleAt = performance.now() + 250
      }
      await Promise.race([finished, delay(50)])
    }
  }
  await finished
  assert.match(output, /DESKTOP03_BENCHMARK_OK/)
  const request = requests[requestStart]
  assert.ok(request, 'CLI should make one request to the local provider')
  return {
    elapsedMs: Number(((completedAt ?? performance.now()) - started).toFixed(1)),
    firstProviderRequestMs: Number((request.time - started).toFixed(1)),
    taskDurationMs: completedAt === null ? null : Number((completedAt - request.time).toFixed(1)),
    requestBytes: request.bytes,
    promptTokens: request.promptTokens,
    completionTokens: 1,
    totalTokens: request.promptTokens + 1,
    peakWorkingSetBytes: peakWorkingSet,
    cpuTimeSeconds,
  }
}

async function runDesktopRpc(collectResources = false) {
  const requestStart = requests.length
  const started = performance.now()
  const manager = new PiRpcManager({ waitingNoticeMs: 100, readyMs: 20_000 })
  const events = []
  let completedAt = null
  manager.on('event', (event) => {
    events.push(event)
    if (event.type === 'agent_end' && completedAt === null) completedAt = performance.now()
  })
  let peakWorkingSet = null
  let cpuTimeSeconds = null
  let nextCpuSampleAt = 0
  try {
    const status = await manager.start({
      cwd: project,
      engine: 'finecode',
      provider: 'local',
      model: 'deterministic',
      noSession: true,
      args: ['--no-tools', '--no-extensions', '--no-mcp'],
      env: { PI_OFFLINE: '1' },
    })
    assert.equal(status.status, 'running', status.error ?? 'Desktop FineCode RPC did not start')
    const pid = manager.getStatus().pid
    if (collectResources && pid) {
      peakWorkingSet = workingSetBytes(pid)
      cpuTimeSeconds = cpuSeconds(pid)
    }
    const result = await manager.sendCommand({ type: 'prompt', message: prompt })
    assert.ok(result?.success !== false, 'Desktop RPC should accept the benchmark prompt')
    for (let elapsed = 0; elapsed < 10_000 && !events.some((event) => event.type === 'agent_end'); elapsed += 25) {
      if (collectResources && pid) {
        const sample = workingSetBytes(pid)
        if (sample !== null) peakWorkingSet = Math.max(peakWorkingSet ?? 0, sample)
        if (performance.now() >= nextCpuSampleAt) {
          cpuTimeSeconds = cpuSeconds(pid) ?? cpuTimeSeconds
          nextCpuSampleAt = performance.now() + 250
        }
      }
      await delay(25)
    }
    assert.ok(events.some((event) => event.type === 'agent_end'), 'Desktop RPC should complete the turn')
    if (collectResources && pid) cpuTimeSeconds = cpuSeconds(pid) ?? cpuTimeSeconds
  } finally {
    await manager.stopAndWait()
  }
  const request = requests[requestStart]
  assert.ok(request, 'Desktop RPC should make one request to the local provider')
  return {
    elapsedMs: Number(((completedAt ?? performance.now()) - started).toFixed(1)),
    firstProviderRequestMs: Number((request.time - started).toFixed(1)),
    taskDurationMs: completedAt === null ? null : Number((completedAt - request.time).toFixed(1)),
    requestBytes: request.bytes,
    promptTokens: request.promptTokens,
    completionTokens: 1,
    totalTokens: request.promptTokens + 1,
    peakWorkingSetBytes: peakWorkingSet,
    cpuTimeSeconds,
  }
}

try {
  const runs = []
  for (let iteration = 1; iteration <= iterations; iteration++) {
    runs.push({ iteration, client: 'cli', ...(await runCli()) })
    runs.push({ iteration, client: 'desktop-rpc', ...(await runDesktopRpc()) })
  }
  const resourceRuns = []
  for (let iteration = 1; iteration <= iterations; iteration++) {
    const cli = await runCli(true)
    resourceRuns.push({ iteration, client: 'cli', peakWorkingSetBytes: cli.peakWorkingSetBytes, cpuTimeSeconds: cli.cpuTimeSeconds })
    const desktop = await runDesktopRpc(true)
    resourceRuns.push({ iteration, client: 'desktop-rpc', peakWorkingSetBytes: desktop.peakWorkingSetBytes, cpuTimeSeconds: desktop.cpuTimeSeconds })
  }
  const grouped = ['cli', 'desktop-rpc'].map((client) => {
    const samples = runs.filter((run) => run.client === client)
    const mean = (key) => {
      const values = samples.map((sample) => sample[key]).filter((value) => typeof value === 'number' && Number.isFinite(value))
      return values.length ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(3)) : null
    }
    return {
      client,
      iterations: samples.length,
      meanElapsedMs: mean('elapsedMs'),
      meanFirstProviderRequestMs: mean('firstProviderRequestMs'),
      meanTaskDurationMs: mean('taskDurationMs'),
      meanRequestBytes: mean('requestBytes'),
      meanPromptTokens: mean('promptTokens'),
      meanTotalTokens: mean('totalTokens'),
    }
  })
  const resourceSummary = ['cli', 'desktop-rpc'].map((client) => {
    const samples = resourceRuns.filter((run) => run.client === client)
    const cpuSamples = samples.map((sample) => sample.cpuTimeSeconds).filter((value) => typeof value === 'number')
    return {
      client,
      iterations: samples.length,
      peakWorkingSetBytes: Math.max(...samples.map((sample) => Number(sample.peakWorkingSetBytes ?? 0))) || null,
      meanCpuTimeSeconds: cpuSamples.length ? Number((cpuSamples.reduce((total, value) => total + value, 0) / cpuSamples.length).toFixed(3)) : null,
    }
  })
  log.log(JSON.stringify({
    result: 'PASS_LOCAL_BENCHMARK', platform: process.platform, node: process.version,
    iterations, model: 'local/deterministic', tokenCost: 0,
    notes: 'Timing runs omit process sampling; separate resource runs sample the FineCode child process. Desktop timing includes FineCode RPC process startup; CLI timing includes one-shot CLI startup. Prompt and local server response are identical. Request-byte token counts are deterministic fixture estimates, not model-reported tokens. CPU sampling is approximately every 250 ms.',
    runs, summary: grouped, resourceRuns, resourceSummary,
  }))
} finally {
  server.close()
  setPiExecutableOverride(null, 'auto')
  if (previousDesktopDataDir === undefined) delete process.env.PI_DESKTOP_USER_DATA_DIR
  else process.env.PI_DESKTOP_USER_DATA_DIR = previousDesktopDataDir
  await rm(data, { recursive: true, force: true })
  await rm(project, { recursive: true, force: true })
}
