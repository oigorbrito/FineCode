import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { join, resolve } from 'node:path'

const executable = resolve(process.env.DESKTOP_PACKAGED_EXE ?? '')
assert.ok(process.env.DESKTOP_PACKAGED_EXE, 'DESKTOP_PACKAGED_EXE must point to the unpacked Pi Desktop executable')
const data = await mkdtemp(join(tmpdir(), 'desktop08-deny-data-'))
const finecodeData = join(data, 'finecode-agent')
const project = await mkdtemp(join(tmpdir(), 'desktop08-deny-project-'))
await mkdir(finecodeData, { recursive: true })
let requestCount = 0
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  JSON.parse(Buffer.concat(chunks).toString('utf8'))
  requestCount++
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (chunk) => response.write(`data: ${JSON.stringify(chunk)}\n\n`)
  if (requestCount === 1) {
    send({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-denied-write', type: 'function', function: { name: 'write', arguments: JSON.stringify({ path: 'denied.txt', content: 'must not exist\n' }) } }] }, finish_reason: null }] })
    send({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
  } else {
    send({ choices: [{ index: 0, delta: { content: 'The write was denied.' }, finish_reason: null }] })
    send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  }
  send('[DONE]')
  response.end()
})
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
const address = server.address()
assert.ok(address && typeof address === 'object')
await writeFile(join(data, 'settings.json'), JSON.stringify({
  piEngine: 'finecode',
  piExecutablePath: resolve('../FineCode/packages/coding-agent/dist/bundle/cli.js'),
  permissionMode: 'ask-edits',
  openToHomeOnLaunch: true,
}), 'utf8')
await writeFile(join(finecodeData, 'models.json'), JSON.stringify({ providers: { local: {
  baseUrl: `http://127.0.0.1:${address.port}/v1`,
  api: 'openai-completions',
  apiKey: 'local-only',
  models: [{ id: 'deterministic', name: 'Desktop08 denial fixture', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 128 }],
} } }), 'utf8')
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

async function connectRenderer(app) {
  let target
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const targets = await (await globalThis.fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
      target = targets.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl)
      if (target) break
    } catch {
      // The packaged Chromium renderer has not opened its debugging endpoint yet.
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

function processTree(pid) {
  const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const command = `$all=Get-CimInstance Win32_Process;$ids=[System.Collections.Generic.List[int]]::new();$ids.Add(${pid});for($i=0;$i -lt $ids.Count;$i++){foreach($p in $all){if([int]$p.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$p.ProcessId)){$ids.Add([int]$p.ProcessId)}}};@($ids.ToArray())|ConvertTo-Json -Compress`
  const result = spawnSync(powershell, ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 10_000 })
  if (result.status !== 0) throw new Error(result.stderr || 'Could not enumerate the packaged application process tree')
  const parsed = JSON.parse(result.stdout.trim())
  return Array.isArray(parsed) ? parsed.map(Number) : [Number(parsed)]
}

function terminateApp(app) {
  if (!app || app.exitCode !== null) return
  const result = spawnSync('taskkill', ['/pid', String(app.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  if (result.status !== 0) app.kill()
}

let app
let socket
try {
  const appArgs = process.env.DESKTOP08_DEV_SMOKE === '1'
    ? ['.', `--remote-debugging-port=${debugPort}`, '--no-sandbox']
    : [`--remote-debugging-port=${debugPort}`, '--no-sandbox']
  app = spawn(executable, appArgs, {
    cwd: process.cwd(),
    env: { ...process.env, PI_DESKTOP_USER_DATA_DIR: data },
    stdio: 'ignore',
    windowsHide: false,
  })
  const connection = await connectRenderer(app)
  socket = connection.socket
  const { evaluate, sendPrompt } = connection
  let usable = false
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      usable = await evaluate("document.title==='Pi Desktop' && document.body.innerText.includes('New Task') && window.outerWidth>0 && window.outerHeight>0 && document.visibilityState==='visible'")
      if (usable) break
    } catch {
      // Keep waiting while the renderer completes its startup navigation.
    }
    await delay(50)
  }
  assert.equal(usable, true, 'packaged Pi Desktop window should become usable')
  const workspace = JSON.parse(await evaluate(`(async()=>{const ws=await window.piDesktop.workspace.create('Desktop08 denial',${JSON.stringify(project)});await window.piDesktop.workspace.setActive(ws.id);const status=await window.piDesktop.workspace.startPi(ws.id,{provider:'local',model:'deterministic'});return JSON.stringify({id:ws.id,status})})()`))
  assert.equal(workspace.status.status, 'running', workspace.status.error ?? 'Packaged FineCode runtime failed to start')
  await evaluate('window.location.reload()')
  await delay(2000)
  assert.equal(await sendPrompt('Use the write tool to create denied.txt in the workspace.'), true, 'packaged composer should submit the denial prompt')
  let dialogVisible = false
  for (let attempt = 0; attempt < 400; attempt++) {
    const dialog = await evaluate("JSON.stringify({text:document.body.innerText,buttons:[...document.querySelectorAll('button')].map((button)=>button.innerText.trim())})")
    const state = JSON.parse(dialog)
    if (state.text.includes('FineCode wants to run the write tool') && state.buttons.includes('Cancel') && state.buttons.includes('Confirm')) {
      dialogVisible = true
      break
    }
    await delay(50)
  }
  assert.ok(dialogVisible, 'packaged renderer should show the FineCode write permission dialog')
  assert.equal(await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find((entry)=>entry.innerText.trim()==='Cancel');if(!button)return false;button.click();return true})()"), true, 'permission denial button should be clickable')
  let completed = false
  for (let attempt = 0; attempt < 400; attempt++) {
    completed = await evaluate("document.body.innerText.includes('The write was denied.')")
    if (completed) break
    await delay(50)
  }
  assert.equal(completed, true, 'packaged app should continue after the denied tool call')
  assert.equal(requestCount, 2, 'the deterministic provider should return the denied turn')
  assert.equal((await readdir(project)).includes('denied.txt'), false, 'denied write must not create a file')
  const processIds = processTree(app.pid)
  socket.close()
  socket = undefined
  terminateApp(app)
  await new Promise((resolveClose) => app.once('close', resolveClose))
  for (let attempt = 0; attempt < 40; attempt++) {
    const alive = processIds.filter((pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(`"${pid}"`))
    if (alive.length === 0) break
    await delay(100)
  }
  const orphans = processIds.filter((pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(`"${pid}"`))
  assert.deepEqual(orphans, [], `packaged application left processes behind: ${orphans.join(', ')}`)
  globalThis.console.log(JSON.stringify({ result: 'PASS_DESKTOP08_PACKAGED_DENIAL', engine: 'finecode', providerRequests: requestCount, deniedFileCreated: false, processTreePids: processIds.length, orphanProcessIds: orphans }))
} finally {
  socket?.close()
  terminateApp(app)
  await delay(1000)
  await new Promise((resolveClose) => server.close(resolveClose))
  await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
  await rm(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
}
