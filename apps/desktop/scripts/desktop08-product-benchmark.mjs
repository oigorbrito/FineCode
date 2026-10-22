import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import { join, resolve } from 'node:path'

const cli = resolve(process.argv[2] ?? '')
const desktop = resolve(process.argv[3] ?? process.env.DESKTOP_PACKAGED_EXE ?? '')
const iterations = Number(process.env.DESKTOP08_BENCH_ITERATIONS ?? '10')
const warmups = 2
const marker = 'DESKTOP08_BENCHMARK_OK'
const prompt = `Return exactly this text: ${marker}`
assert.ok(cli.endsWith('.js'), 'pass the pinned FineCode CLI bundle path')
assert.ok(process.env.DESKTOP_PACKAGED_EXE || process.argv[3], 'pass the unpacked FineCode Desktop executable')
assert.equal(process.platform, 'win32', 'the product benchmark requires the Windows packaged application')
assert.equal(Number.isInteger(iterations) && iterations >= 10, true, 'at least 10 valid iterations are required')

let phase = 'startup'
const providerRequests = []
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks)
  const body = JSON.parse(raw.toString('utf8'))
  const requestAt = performance.now()
  providerRequests.push({ requestAt, requestBytes: raw.byteLength, model: body.model })
  phase = 'active'
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${JSON.stringify(chunk)}\n\n`)
  send({ choices: [{ index: 0, delta: { content: marker }, finish_reason: null }] })
  send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  send({ choices: [], usage: { prompt_tokens: 16, completion_tokens: 1, total_tokens: 17 } })
  send('[DONE]')
  response.end()
})
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
const address = server.address()
assert.ok(address && typeof address === 'object')

const samplerSource = `
param([int]$RootPid, [int]$IntervalMs)
$ErrorActionPreference = 'SilentlyContinue'
while ($true) {
  $all = Get-CimInstance Win32_Process
  $ids = [System.Collections.Generic.List[int]]::new()
  if (-not ($all | Where-Object { [int]$_.ProcessId -eq $RootPid })) { break }
  $ids.Add($RootPid)
  for ($i = 0; $i -lt $ids.Count; $i++) {
    foreach ($p in $all) {
      if ([int]$p.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$p.ProcessId)) { $ids.Add([int]$p.ProcessId) }
    }
  }
  $processes = Get-Process -Id $ids.ToArray() -ErrorAction SilentlyContinue
  if ($processes) {
    $sample = @{ privateBytes = [int64](($processes | Measure-Object PrivateMemorySize64 -Sum).Sum); workingSetBytes = [int64](($processes | Measure-Object WorkingSet64 -Sum).Sum); cpuSeconds = [double](($processes | Measure-Object CPU -Sum).Sum); pids = @($ids.ToArray()) }
    [Console]::Out.WriteLine(($sample | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds $IntervalMs
}
`
const samplerPath = join(await mkdtemp(join(tmpdir(), 'desktop08-sampler-')), 'sample.ps1')
await writeFile(samplerPath, samplerSource, 'utf8')

function startSampler(pid) {
  const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const sampler = spawn(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', samplerPath, '-RootPid', String(pid), '-IntervalMs', '150'], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
  const samples = []
  let buffered = ''
  sampler.stdout.setEncoding('utf8')
  sampler.stdout.on('data', (chunk) => {
    buffered += chunk
    for (;;) {
      const end = buffered.indexOf('\n')
      if (end < 0) break
      const line = buffered.slice(0, end).trim()
      buffered = buffered.slice(end + 1)
      if (!line) continue
      try {
        samples.push({ ...JSON.parse(line), phase })
      } catch {
        // Ignore only incomplete sampler lines; valid records are JSON per line.
      }
    }
  })
  return { sampler, samples }
}

async function stopSampler(handle) {
  if (handle.sampler.exitCode === null) handle.sampler.kill()
  await new Promise((resolveClose) => {
    if (handle.sampler.exitCode !== null) resolveClose()
    else handle.sampler.once('close', resolveClose)
  })
  return handle.samples
}

function resourceSummary(samples) {
  const max = (entries, key) => entries.length ? Math.max(...entries.map((entry) => Number(entry[key] ?? 0))) : null
  const idle = samples.filter((sample) => sample.phase === 'idle')
  const active = samples.filter((sample) => sample.phase === 'active')
  const cpu = samples.map((sample) => Number(sample.cpuSeconds)).filter(Number.isFinite)
  return {
    idlePrivateBytes: idle.length ? Math.round(idle.reduce((sum, sample) => sum + Number(sample.privateBytes), 0) / idle.length) : null,
    idleWorkingSetBytes: idle.length ? Math.round(idle.reduce((sum, sample) => sum + Number(sample.workingSetBytes), 0) / idle.length) : null,
    activePeakPrivateBytes: max(active, 'privateBytes'),
    activePeakWorkingSetBytes: max(active, 'workingSetBytes'),
    peakPrivateBytes: max(samples, 'privateBytes'),
    peakWorkingSetBytes: max(samples, 'workingSetBytes'),
    cpuSeconds: cpu.length > 1 ? Number(Math.max(0, Math.max(...cpu) - cpu[0]).toFixed(4)) : null,
    processCountPeak: samples.length ? Math.max(...samples.map((sample) => sample.pids?.length ?? 0)) : null,
  }
}

function reservePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const probeAddress = probe.address()
      if (!probeAddress || typeof probeAddress === 'string') {
        probe.close()
        reject(new Error('Could not reserve a Chromium debugging port'))
        return
      }
      probe.close((error) => error ? reject(error) : resolvePort(probeAddress.port))
    })
  })
}

async function connectRenderer(port, app) {
  let target
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const targets = await (await globalThis.fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = targets.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl)
      if (target) break
    } catch {
      // Wait for the packaged Chromium renderer to become available.
    }
    await delay(250)
  }
  assert.ok(target, `Packaged renderer unavailable; exitCode=${app.exitCode}`)
  const socket = new globalThis.WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const packet = JSON.parse(String(event.data))
    if (packet.id && pending.has(packet.id)) {
      pending.get(packet.id)(packet)
      pending.delete(packet.id)
    }
  })
  const evaluate = async (expression) => {
    const id = ++nextId
    const packet = await new Promise((resolvePacket) => {
      pending.set(id, resolvePacket)
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }))
    })
    if (packet.error) throw new Error(JSON.stringify(packet.error))
    if (packet.result.exceptionDetails) throw new Error(packet.result.exceptionDetails.text)
    return packet.result.result.value
  }
  const sendPrompt = (message) => evaluate(`(()=>{const input=document.querySelector('textarea');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(input,${JSON.stringify(message)});input.dispatchEvent(new Event('input',{bubbles:true}));const send=document.querySelector('button[aria-label="Send message"]');if(!send||send.disabled)return false;send.click();return true})()`)
  return { socket, evaluate, sendPrompt }
}

function writeModels(agentDir) {
  return mkdir(agentDir, { recursive: true }).then(() => writeFile(join(agentDir, 'models.json'), JSON.stringify({ providers: { local: {
    baseUrl: `http://127.0.0.1:${address.port}/v1`, api: 'openai-completions', apiKey: 'local-only',
    models: [{ id: 'deterministic', name: 'Desktop08 benchmark', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 64 }],
  } } }), 'utf8'))
}

async function runCli(iteration, warmup) {
  const data = await mkdtemp(join(tmpdir(), 'desktop08-cli-data-'))
  const project = await mkdtemp(join(tmpdir(), 'desktop08-cli-project-'))
  const agentDir = join(data, 'finecode-agent')
  await writeModels(agentDir)
  providerRequests.length = 0
  phase = 'startup'
  const startedAt = performance.now()
  let firstOutputAt = null
  let output = ''
  const child = spawn(process.execPath, [cli, '-p', '--mode', 'json', '--no-session', '--no-tools', '--no-extensions', '--no-mcp', '--provider', 'local', '--model', 'deterministic', '--thinking', 'off', prompt], {
    cwd: project,
    env: { ...process.env, FINECODE_CODING_AGENT_DIR: agentDir, PI_OFFLINE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const samplesHandle = startSampler(child.pid)
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    if (firstOutputAt === null) firstOutputAt = performance.now()
    output += chunk
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  try {
    const code = await new Promise((resolveClose, reject) => {
      child.once('error', reject)
      child.once('close', resolveClose)
    })
    const completedAt = performance.now()
    assert.equal(code, 0, `FineCode CLI failed: ${stderr.slice(-1200)} ${output.slice(-500)}`)
    assert.match(output, new RegExp(marker))
    const request = providerRequests[0]
    assert.ok(request, 'FineCode CLI made no request to the local provider')
    const samples = await stopSampler(samplesHandle)
    return {
      iteration, warmup, mode: 'cli', startupMs: Number((request.requestAt - startedAt).toFixed(2)),
      firstEventMs: firstOutputAt === null ? null : Number((firstOutputAt - startedAt).toFixed(2)),
      taskDurationMs: Number((completedAt - startedAt).toFixed(2)), requestBytes: request.requestBytes,
      promptTokens: 16, completionTokens: 1, totalTokens: 17, ...resourceSummary(samples),
    }
  } finally {
    if (child.exitCode === null) child.kill()
    await stopSampler(samplesHandle)
    await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
    await rm(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
  }
}

async function runDesktop(iteration, warmup) {
  const data = await mkdtemp(join(tmpdir(), 'desktop08-app-data-'))
  const finecodeData = join(data, 'finecode-agent')
  const project = await mkdtemp(join(tmpdir(), 'desktop08-app-project-'))
  await writeModels(finecodeData)
  await writeFile(join(data, 'settings.json'), JSON.stringify({ piEngine: 'finecode', piExecutablePath: cli, permissionMode: 'ask-edits', openToHomeOnLaunch: true }), 'utf8')
  providerRequests.length = 0
  phase = 'startup'
  const debugPort = await reservePort()
  const startedAt = performance.now()
  const appArgs = process.env.DESKTOP08_DEV_SMOKE === '1'
    ? ['.', `--remote-debugging-port=${debugPort}`, '--no-sandbox']
    : [`--remote-debugging-port=${debugPort}`, '--no-sandbox']
  const app = spawn(desktop, appArgs, {
    cwd: process.cwd(),
    env: { ...process.env, PI_DESKTOP_USER_DATA_DIR: data },
    stdio: 'ignore',
    windowsHide: false,
  })
  const samplesHandle = startSampler(app.pid)
  let socket
  try {
    const connection = await connectRenderer(debugPort, app)
    socket = connection.socket
    const { evaluate, sendPrompt } = connection
    let usable = false
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        usable = await evaluate("document.title==='FineCode Desktop' && document.body.innerText.includes('New Task')")
        if (usable) break
      } catch {
        // Wait through renderer startup navigation.
      }
      await delay(50)
    }
    assert.equal(usable, true, 'packaged app window did not become usable')
    const startupMs = performance.now() - startedAt
    phase = 'idle'
    const workspace = JSON.parse(await evaluate(`(async()=>{const ws=await window.piDesktop.workspace.create('Desktop08 benchmark',${JSON.stringify(project)});await window.piDesktop.workspace.setActive(ws.id);const status=await window.piDesktop.workspace.startPi(ws.id,{provider:'local',model:'deterministic'});return JSON.stringify({id:ws.id,status})})()`))
    assert.equal(workspace.status.status, 'running', workspace.status.error ?? 'Packaged FineCode RPC did not start')
    await evaluate('window.location.reload()')
    await delay(1200)
    await evaluate("(()=>{window.__desktop08FirstEventAt=null;window.piDesktop.onEvent((event)=>{if(window.__desktop08FirstEventAt===null&&event.type==='message_update')window.__desktop08FirstEventAt=Date.now()})})()")
    phase = 'active'
    const promptStartedAt = Date.now()
    const taskStartedAt = performance.now()
    assert.equal(await sendPrompt(prompt), true, 'packaged composer failed to send benchmark prompt')
    let completed = false
    for (let attempt = 0; attempt < 400; attempt++) {
      completed = await evaluate(`document.body.innerText.includes('${marker}')`)
      if (completed) break
      await delay(25)
    }
    assert.equal(completed, true, 'packaged FineCode response did not reach the renderer')
    const firstEventAt = await evaluate('window.__desktop08FirstEventAt')
    assert.equal(typeof firstEventAt, 'number', 'renderer did not receive a FineCode message_update event')
    const taskDurationMs = performance.now() - taskStartedAt
    const request = providerRequests[0]
    assert.ok(request, 'packaged app made no request to the local provider')
    await evaluate(`window.piDesktop.workspace.stopPi(${JSON.stringify(workspace.id)})`)
    socket.close()
    socket = undefined
    const processId = app.pid
    const appTree = await new Promise((resolveClose, reject) => {
      const timeout = globalThis.setTimeout(() => reject(new Error('Packaged app did not close during benchmark cleanup')), 15_000)
      app.once('close', (code) => { globalThis.clearTimeout(timeout); resolveClose(code) })
      const killer = spawn('taskkill', ['/pid', String(processId), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      killer.once('error', reject)
    })
    const samples = await stopSampler(samplesHandle)
    return {
      iteration, warmup, mode: 'desktop', startupMs: Number(startupMs.toFixed(2)),
      firstEventMs: Number((firstEventAt - promptStartedAt).toFixed(2)),
      taskDurationMs: Number(taskDurationMs.toFixed(2)), requestBytes: request.requestBytes,
      promptTokens: 16, completionTokens: 1, totalTokens: 17,
      appExitCode: appTree, ...resourceSummary(samples),
    }
  } finally {
    socket?.close()
    if (app.exitCode === null) {
      const killer = spawn('taskkill', ['/pid', String(app.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      await new Promise((resolveClose) => killer.once('close', resolveClose))
    }
    await stopSampler(samplesHandle)
    await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
    await rm(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
  }
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (!sorted.length) return null
  return Number(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)].toFixed(2))
}

function summarize(samples, mode) {
  const entries = samples.filter((sample) => sample.mode === mode && !sample.warmup)
  const keys = ['startupMs', 'firstEventMs', 'taskDurationMs', 'idlePrivateBytes', 'idleWorkingSetBytes', 'activePeakPrivateBytes', 'activePeakWorkingSetBytes', 'peakPrivateBytes', 'peakWorkingSetBytes', 'cpuSeconds']
  return { mode, validRuns: entries.length, metrics: Object.fromEntries(keys.map((key) => [key, { median: percentile(entries.map((entry) => entry[key]), 0.5), p95: percentile(entries.map((entry) => entry[key]), 0.95) }])) }
}

const allSamples = []
try {
  for (let warmup = 1; warmup <= warmups; warmup++) {
    allSamples.push(await runCli(0, true))
    allSamples.push(await runDesktop(0, true))
  }
  for (let iteration = 1; iteration <= iterations; iteration++) {
    const order = iteration % 2 === 1 ? ['cli', 'desktop'] : ['desktop', 'cli']
    for (const mode of order) allSamples.push(mode === 'cli' ? await runCli(iteration, false) : await runDesktop(iteration, false))
  }
  assert.equal(allSamples.filter((sample) => sample.mode === 'cli' && !sample.warmup).length, iterations)
  assert.equal(allSamples.filter((sample) => sample.mode === 'desktop' && !sample.warmup).length, iterations)
  globalThis.console.log(JSON.stringify({
    result: 'PASS_DESKTOP08_PRODUCT_BENCHMARK', node: process.version, electron: '43.7.9', iterationsPerMode: iterations, warmupsPerMode: warmups,
    provider: '127.0.0.1 deterministic; zero cost', tokenUsagePerRun: { prompt: 16, completion: 1, total: 17 },
    methodology: { order: 'alternating CLI/Desktop by iteration', cliStartup: 'spawn to first request to local provider', desktopStartup: 'spawn to usable packaged window', firstEvent: 'CLI first stdout chunk; desktop renderer message_update', memoryAndCpu: 'sampled complete root process tree every 150 ms; private bytes and working set; CPU delta' },
    summary: [summarize(allSamples, 'cli'), summarize(allSamples, 'desktop')], runs: allSamples,
  }))
} finally {
  server.close()
  await rm(samplerPath, { force: true }).catch(() => undefined)
  await rm(join(samplerPath, '..'), { recursive: true, force: true }).catch(() => undefined)
}
