#!/usr/bin/env node

/**
 * finecode-desktop — CLI launcher for FineCode Desktop GUI
 *
 * Usage:
 *   finecode-desktop              # Launch the app
 *   finecode-desktop --help       # Show help
 *   finecode-desktop --version    # Show version
 *   finecode-desktop /path/to/dir # Launch with workspace
 */

const { spawn, execSync } = require('child_process')
const { existsSync } = require('fs')
const { join, resolve } = require('path')

const VERSION = require('../package.json').version

// ─── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  finecode-desktop v${VERSION} — Desktop GUI for the FineCode coding agent

  Usage:
    finecode-desktop                  Launch the app
    finecode-desktop <path>           Launch with workspace directory
    finecode-desktop --help           Show this help
    finecode-desktop --version        Show version

  Examples:
    finecode-desktop                  # Launch with default workspace
    finecode-desktop ~/my-project     # Launch with specific project
    finecode-desktop .                # Launch with current directory

  The app executes FineCode via RPC:
    finecode --mode rpc
`)
  process.exit(0)
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(VERSION)
  process.exit(0)
}

// ─── Find Electron binary ────────────────────────────────────────────────────

function findElectron() {
  const electronExe = process.platform === 'win32' ? 'electron.exe' : 'electron'
  const electronCmd = process.platform === 'win32' ? 'electron.cmd' : 'electron'

  const candidates = [
    join(__dirname, '..', 'node_modules', 'electron', 'dist', electronExe),
    join(__dirname, '..', 'node_modules', '.bin', electronCmd),
    join(__dirname, '..', '..', '..', 'node_modules', 'electron', 'dist', electronExe),
    join(__dirname, '..', '..', '..', 'node_modules', '.bin', electronCmd),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  // Try to find globally installed electron
  try {
    const whichCmd = process.platform === 'win32' ? 'where.exe electron' : 'which electron'
    const electronPath = execSync(whichCmd, { encoding: 'utf8', timeout: 5000 }).trim().split(/\r?\n/)[0]
    if (existsSync(electronPath)) {
      return electronPath
    }
  } catch {
    // Not found
  }

  console.error('Error: Electron not found. Please install dependencies:')
  console.error('  cd ' + join(__dirname, '..') + ' && npm install')
  process.exit(1)
}

// ─── Find app resources ─────────────────────────────────────────────────────

function findAppResources() {
  // Packaged app: resources are in app.asar or app directory
  const packagedPaths = [
    join(__dirname, '..', 'app.asar'),
    join(__dirname, '..', 'app'),
    join(__dirname, '..', 'resources', 'app.asar'),
    join(__dirname, '..', 'resources', 'app'),
  ]

  for (const p of packagedPaths) {
    if (existsSync(p)) {
      return p
    }
  }

  // Development: use the project root (electron-vite builds to out/)
  const devPath = join(__dirname, '..')
  if (existsSync(join(devPath, 'out', 'main', 'index.js'))) {
    return devPath
  }

  console.error('Error: App not built. Run "npm run build" first.')
  process.exit(1)
}

// ─── Launch ──────────────────────────────────────────────────────────────────

function launch() {
  const electronPath = findElectron()
  const appPath = findAppResources()

  let workspacePath = null
  if (args.length > 0 && !args[0].startsWith('-')) {
    workspacePath = resolve(args[0])
    if (!existsSync(workspacePath)) {
      console.error(`Error: Path does not exist: ${workspacePath}`)
      process.exit(1)
    }
  }

  const electronArgs = [
    appPath,
    '--no-sandbox',
  ]

  const env = { ...process.env }
  if (workspacePath) {
    env.PI_DESKTOP_WORKSPACE = workspacePath
  }

  const child = spawn(electronPath, electronArgs, {
    stdio: 'inherit',
    env,
    detached: false,
  })

  child.on('error', (err) => {
    console.error('Failed to start FineCode Desktop:', err.message)
    process.exit(1)
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })

  process.on('SIGINT', () => child.kill('SIGINT'))
  process.on('SIGTERM', () => child.kill('SIGTERM'))
}

launch()
