import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import process from 'node:process'
import { resolve } from 'node:path'

const packagedExecutable = resolve(process.env.DESKTOP_PACKAGED_EXE ?? '')
assert.ok(process.env.DESKTOP_PACKAGED_EXE, 'DESKTOP_PACKAGED_EXE must point to the unpacked Pi Desktop executable')
const devElectron = resolve('node_modules/electron/dist/electron.exe')
const originalSpawn = childProcess.spawn

childProcess.spawn = (command, args, options) => {
  if (typeof command === 'string' && resolve(command) === devElectron) {
    if (process.env.DESKTOP08_DEV_SMOKE === '1') return originalSpawn(command, args, options)
    const packagedArgs = args.filter((argument) => argument !== '.')
    return originalSpawn(packagedExecutable, packagedArgs, options)
  }
  return originalSpawn(command, args, options)
}
syncBuiltinESMExports()

await import('./desktop03-electron-e2e.mjs')
