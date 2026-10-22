import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Console } from 'node:console'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { clearTimeout, setTimeout as setTimer } from 'node:timers'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import { join, resolve } from 'node:path'

const log = new Console(process.stdout, process.stderr)
const APP_SHUTDOWN_TIMEOUT_MS = 5_000
const CDP_REQUEST_TIMEOUT_MS = 30_000
const data = await mkdtemp(join(tmpdir(), 'desktop03-electron-data-'))
const finecodeData = join(data, 'finecode-agent')
const project = await mkdtemp(join(tmpdir(), 'desktop03-electron-project-'))
await mkdir(finecodeData, { recursive: true })
await writeFile(join(project, 'result.txt'), 'fixture baseline\n', 'utf8')
for (const args of [
  ['init', '--quiet'],
  ['config', 'user.name', 'DESKTOP03 fixture'],
  ['config', 'user.email', 'desktop03@example.invalid'],
  ['add', 'result.txt'],
  ['commit', '--quiet', '-m', 'fixture baseline'],
]) {
  const result = spawnSync('git', args, { cwd: project, encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr || `git ${args[0]} failed`)
}
let requestCount = 0
let cancelledRequests = 0
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  requestCount++
  JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (requestCount === 3) {
    response.on('close', () => { cancelledRequests++ })
    return
  }
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${JSON.stringify(chunk)}\n\n`)
  if (requestCount === 1) {
    send({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-write-1', type: 'function', function: { name: 'write', arguments: '{"path":"result.txt","content":"desktop03 deterministic result\\n"}' } }] }, finish_reason: null }] })
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
const debugPort = await new Promise((resolvePort, reject) => {
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
await writeFile(join(data, 'settings.json'), JSON.stringify({
  piEngine: 'finecode',
  piExecutablePath: resolve(process.env.FINECODE_CLI_PATH ?? '../../packages/coding-agent/dist/bundle/cli.js'),
  permissionMode: 'ask-edits',
  openToHomeOnLaunch: true,
}), 'utf8')
await writeFile(join(finecodeData, 'models.json'), JSON.stringify({ providers: { local: {
  baseUrl: `http://127.0.0.1:${address.port}/v1`,
  api: 'openai-completions',
  apiKey: 'local-only',
  models: [{
    id: 'deterministic', name: 'Desktop03 deterministic', reasoning: false, input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 256,
  }],
} } }), 'utf8')
async function connectToRenderer(port, app) {
  let target
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const targets = await (await globalThis.fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = targets.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl)
      if (target) break
    } catch {
      // Chromium has not opened its debugging endpoint yet.
    }
    if (app.exitCode !== null) break
    await delay(250)
  }
  assert.ok(target, `Electron renderer unavailable; exitCode=${app.exitCode}`)
  const socket = new globalThis.WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolveOpen, rejectOpen) => {
    const timeout = setTimer(() => {
      socket.close()
      rejectOpen(new Error('Chromium renderer WebSocket connection timed out'))
    }, APP_SHUTDOWN_TIMEOUT_MS)
    socket.addEventListener('open', () => {
      clearTimeout(timeout)
      resolveOpen()
    }, { once: true })
    socket.addEventListener('error', () => {
      clearTimeout(timeout)
      rejectOpen(new Error('Could not connect to the Chromium renderer WebSocket'))
    }, { once: true })
  })
  let cdpId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const packet = JSON.parse(String(event.data))
    if (packet.id && pending.has(packet.id)) {
      pending.get(packet.id)(packet)
      pending.delete(packet.id)
    }
  })
  const evaluate = async (expression) => {
    const id = ++cdpId
    const packet = await new Promise((resolvePacket, rejectPacket) => {
      const timeout = setTimer(() => {
        pending.delete(id)
        rejectPacket(new Error(`Chromium evaluate request ${id} timed out`))
      }, CDP_REQUEST_TIMEOUT_MS)
      pending.set(id, (result) => {
        clearTimeout(timeout)
        resolvePacket(result)
      })
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }))
    })
    if (packet.error) throw new Error(JSON.stringify(packet.error))
    if (packet.result.exceptionDetails) throw new Error(packet.result.exceptionDetails.text)
    return packet.result.result.value
  }
  const sendPrompt = async (message) => evaluate(`(()=>{const input=document.querySelector('textarea');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(input,${JSON.stringify(message)});input.dispatchEvent(new Event('input',{bubbles:true}));const send=document.querySelector('button[aria-label="Send message"]');if(!send||send.disabled)return false;send.click();return true})()`)
  return { socket, evaluate, sendPrompt }
}

function sampleApplicationProcessTree(pid) {
  if (process.platform !== 'win32') return null
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

function waitForAppExit(app, timeoutMs) {
  if (app.exitCode !== null) return Promise.resolve(true)
  return new Promise((resolveExit) => {
    const onExit = () => {
      clearTimeout(timeout)
      resolveExit(true)
    }
    const timeout = setTimer(() => {
      app.off('exit', onExit)
      resolveExit(false)
    }, timeoutMs)
    app.once('exit', onExit)
  })
}

async function terminateApp(app) {
  if (!app?.pid || app.exitCode !== null) return
  if (process.platform === 'win32') {
    const close = spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${app.pid} -ErrorAction SilentlyContinue).CloseMainWindow()`], {
      encoding: 'utf8', windowsHide: true, timeout: 10_000,
    })
    if (close.status === 0 && await waitForAppExit(app, APP_SHUTDOWN_TIMEOUT_MS)) return
  } else {
    app.kill('SIGTERM')
    if (await waitForAppExit(app, APP_SHUTDOWN_TIMEOUT_MS)) return
  }
  if (app.exitCode === null) {
    if (process.platform === 'win32') {
      const killed = spawnSync('taskkill', ['/pid', String(app.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 })
      if (killed.status !== 0) app.kill()
    } else {
      app.kill('SIGKILL')
    }
    assert.equal(await waitForAppExit(app, APP_SHUTDOWN_TIMEOUT_MS), true, `Electron process ${app.pid} did not exit`)
  }
}

const env = { ...process.env, PI_DESKTOP_USER_DATA_DIR: data }
const electron = resolve(process.env.ELECTRON_EXECUTABLE ?? 'node_modules/electron/dist/electron.exe')
const electronArgs = process.env.ELECTRON_EXECUTABLE
  ? [`--remote-debugging-port=${debugPort}`, '--no-sandbox']
  : ['.', `--remote-debugging-port=${debugPort}`, '--no-sandbox']
const launchElectron = () => spawn(electron, electronArgs, {
  cwd: process.cwd(), env, stdio: 'ignore', windowsHide: false,
})
let app = launchElectron()
let socket
let evaluate
let sendPrompt
try {
  const appStartedAt = performance.now()
  ;({ socket, evaluate, sendPrompt } = await connectToRenderer(debugPort, app))
  const waitForUsableUi = async () => {
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const state = JSON.parse(await evaluate("JSON.stringify({title:document.title,text:document.body.innerText})"))
        if (state.title === 'FineCode Desktop' && state.text.includes('New Task')) return state
      } catch {
        // The renderer can navigate between loading states during startup.
      }
      assert.equal(app.exitCode, null, 'Electron exited before the renderer became usable')
      await delay(50)
    }
    throw new Error('Electron renderer did not become usable')
  }
  const initial = await waitForUsableUi()
  const uiUsableMs = performance.now() - appStartedAt
  assert.equal(initial.title, 'FineCode Desktop')
  assert.match(initial.text, /New Task/)
  const workspace = JSON.parse(await evaluate(`(async()=>{const ws=await window.piDesktop.workspace.create('DESKTOP03 fixture',${JSON.stringify(project)});await window.piDesktop.workspace.setActive(ws.id);const status=await window.piDesktop.workspace.startPi(ws.id,{provider:'local',model:'deterministic'});return JSON.stringify({id:ws.id,status})})()`))
  assert.equal(workspace.status.status, 'running', workspace.status.error ?? 'Desktop did not start FineCode')
  // Main process updates its persistent workspace registry. Reload once so the
  // frontend boots through the same recovery path used by an ordinary launch.
  await evaluate('window.location.reload()')
  await waitForUsableUi()
  let boot
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      boot = JSON.parse(await evaluate("(async()=>JSON.stringify({active:await window.piDesktop.workspace.getActive(),text:document.body.innerText.slice(0,500)}))()"))
      if (boot.active?.path === project) break
    } catch {
      // The renderer can still be restoring its workspace after navigation.
    }
    assert.equal(app.exitCode, null, 'Electron exited while restoring the workspace')
    await delay(50)
  }
  assert.equal(boot?.active?.path, project, 'frontend should recover the active fixture workspace')
  await evaluate("(()=>{window.__desktop03FirstEventAt=null;window.piDesktop.onEvent((event)=>{if(window.__desktop03FirstEventAt===null&&event.type==='message_update')window.__desktop03FirstEventAt=Date.now()})})()")
  const promptStartedAt = Date.now()
  const taskStartedAt = performance.now()
  assert.equal(await sendPrompt('Use the write tool to create result.txt in the workspace.'), true, 'composer should send the prompt')
  let approvalVisible = false
  for (let attempt = 0; attempt < 400; attempt++) {
    const state = JSON.parse(await evaluate("JSON.stringify({text:document.body.innerText,confirm:[...document.querySelectorAll('button')].some((b)=>b.innerText.trim()==='Confirm')})"))
    if (state.text.includes('FineCode wants to run the write tool') && state.confirm) { approvalVisible = true; break }
    await delay(50)
  }
  assert.ok(approvalVisible, 'real renderer should show FineCode write-approval dialog')
  assert.equal(await evaluate("(()=>{const b=[...document.querySelectorAll('button')].find((x)=>x.innerText.trim()==='Confirm');if(!b)return false;b.click();return true})()"), true)
  let assistantVisible = false
  for (let attempt = 0; attempt < 400; attempt++) {
    const state = await evaluate("document.body.innerText.includes('Desktop integration completed.')")
    if (state) { assistantVisible = true; break }
    await delay(50)
  }
  assert.ok(assistantVisible, 'the renderer should display the streamed final assistant response')
  const taskDurationMs = performance.now() - taskStartedAt
  const firstStreamAt = await evaluate('window.__desktop03FirstEventAt')
  assert.equal(typeof firstStreamAt, 'number', 'the renderer should receive a real FineCode stream event')
  const firstStreamMs = firstStreamAt - promptStartedAt
  assert.equal(await readFile(join(project, 'result.txt'), 'utf8'), 'desktop03 deterministic result\n')
  const diff = await evaluate("window.piDesktop.files.getDiff('result.txt')")
  assert.match(diff, /-fixture baseline/)
  assert.match(diff, /\+desktop03 deterministic result/)
  const sessions = JSON.parse(await evaluate(`(async()=>JSON.stringify(await window.piDesktop.session.list(${JSON.stringify(project)})))()`))
  const finecodeSession = sessions.find((session) => session.projectPath === project && session.engine === 'finecode')
  assert.ok(finecodeSession, 'the session index should list the isolated FineCode session')
  const sessionPath = finecodeSession.path
  assert.ok((await readFile(sessionPath, 'utf8')).includes('desktop03 deterministic result'))
  const resumed = JSON.parse(await evaluate(`(async()=>{await window.piDesktop.workspace.stopPi(${JSON.stringify(workspace.id)});return JSON.stringify(await window.piDesktop.session.switch(${JSON.stringify(sessionPath)},${JSON.stringify(project)}))})()`))
  assert.ok(resumed.status === 'stopped' || resumed.status === 'starting' || resumed.status === 'running')
  let resumedRuntime
  for (let attempt = 0; attempt < 200; attempt++) {
    const runtimes = JSON.parse(await evaluate('(async()=>JSON.stringify(await window.piDesktop.session.listRuntimes()))()'))
    resumedRuntime = runtimes.find((runtime) => runtime.sessionPath === sessionPath)
    if (resumedRuntime?.status === 'running') break
    await delay(50)
  }
  assert.equal(resumedRuntime?.status, 'running', resumedRuntime?.error ?? 'Desktop did not resume FineCode session')
  const resumeView = await evaluate("document.body.innerText.includes('Desktop integration completed.')")
  assert.equal(resumeView, true, 'the resumed chat should restore the persisted assistant message')

  assert.equal(await sendPrompt('Wait and cancel this request.'), true, 'composer should send the cancellation prompt')
  for (let attempt = 0; attempt < 200 && requestCount < 3; attempt++) await delay(50)
  assert.equal(requestCount, 3)
  assert.equal(await evaluate(`(()=>{const stop=document.querySelector('button[aria-label="Stop generating"]');if(!stop)return false;stop.click();return true})()`), true, 'composer stop button should cancel the active turn')
  for (let attempt = 0; attempt < 100 && cancelledRequests === 0; attempt++) await delay(50)
  assert.ok(cancelledRequests > 0, 'desktop abort should cancel the local provider request')
  const rendered = await evaluate("document.body.innerText.includes('FineCode') && document.body.innerText.includes('Desktop integration completed.')")
  assert.equal(rendered, true)
  await evaluate(`window.piDesktop.workspace.stopPi(${JSON.stringify(workspace.id)})`)
  socket.close()
  await terminateApp(app)

  const restartStartedAt = performance.now()
  app = launchElectron()
  ;({ socket, evaluate, sendPrompt } = await connectToRenderer(debugPort, app))
  await waitForUsableUi()
  const restartUiUsableMs = performance.now() - restartStartedAt
  const restartedWorkspace = JSON.parse(await evaluate(`(async()=>JSON.stringify(await window.piDesktop.workspace.getActive()))()`))
  assert.equal(restartedWorkspace?.path, project, 'application restart should restore the active workspace')
  const resumeStartedAt = performance.now()
  await evaluate(`window.piDesktop.session.switch(${JSON.stringify(sessionPath)},${JSON.stringify(project)})`)
  let restartedRuntime
  for (let attempt = 0; attempt < 200; attempt++) {
    const runtimes = JSON.parse(await evaluate('(async()=>JSON.stringify(await window.piDesktop.session.listRuntimes()))()'))
    restartedRuntime = runtimes.find((runtime) => runtime.sessionPath === sessionPath)
    if (restartedRuntime?.status === 'running') break
    await delay(50)
  }
  assert.equal(restartedRuntime?.status, 'running', restartedRuntime?.error ?? 'FineCode session did not resume after application restart')
  let restoredTranscript = false
  for (let attempt = 0; attempt < 120; attempt++) {
    restoredTranscript = await evaluate("document.body.innerText.includes('Desktop integration completed.')")
    if (restoredTranscript) break
    await delay(50)
  }
  assert.equal(restoredTranscript, true, 'application restart should restore the FineCode transcript')
  assert.equal(await evaluate('document.title'), 'FineCode Desktop')
  const restartResumeMs = performance.now() - resumeStartedAt
  const desktopProcessResources = sampleApplicationProcessTree(app.pid)
  log.log(JSON.stringify({
    result: 'PASS_ELECTRON_RENDERER_AND_RPC', title: initial.title, engine: finecodeSession.engine,
    streamedAssistantText: assistantVisible, permissionDialogClicked: approvalVisible,
    toolFile: join(project, 'result.txt'), diffContainsExpectedChange: true, sessionPath,
    resumedAfterApplicationRestart: true, uiUsableMs: Math.round(uiUsableMs),
    firstStreamMs: Math.round(firstStreamMs), taskDurationMs: Math.round(taskDurationMs),
    restartUiUsableMs: Math.round(restartUiUsableMs), restartResumeMs: Math.round(restartResumeMs),
    desktopProcessTreeRssBytes: desktopProcessResources?.rssBytes ?? null,
    desktopProcessTreeCpuSeconds: desktopProcessResources?.cpuSeconds ?? null,
    providerRequests: requestCount, cancelledProviderRequests: cancelledRequests,
  }))
} finally {
  socket?.close()
  try {
    await terminateApp(app)
  } finally {
    server.closeAllConnections()
    await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()))
  }
  await Promise.all([
    rm(data, { recursive: true, force: true }),
    rm(project, { recursive: true, force: true }),
  ])
}
