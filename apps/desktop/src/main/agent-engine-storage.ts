import { homedir } from 'node:os'
import { join } from 'node:path'
import { AGENT_ENGINE_DEFINITIONS, type AgentEngineKind } from '../shared/agent-engine'
import { getFineCodeAgentDir } from './app-data-paths'
import { sanitizePath } from './session-paths'

/** Resolve one engine's agent configuration root without inheriting a sibling engine's defaults. */
export function getEngineAgentDir(engine: AgentEngineKind, env: NodeJS.ProcessEnv = process.env): string {
  const definition = AGENT_ENGINE_DEFINITIONS[engine]
  if (definition.storage === 'desktop-data') return getFineCodeAgentDir()
  return env[definition.agentDirEnv] || join(env.HOME ?? env.USERPROFILE ?? homedir(), definition.configDir, 'agent')
}

export function getEngineSessionsRoot(engine: AgentEngineKind, env: NodeJS.ProcessEnv = process.env): string {
  return join(getEngineAgentDir(engine, env), 'sessions')
}

/** FineCode's session directory for a project, matching its CLI path encoding. */
export function getFineCodeProjectSessionsDir(cwd: string): string {
  return join(getEngineSessionsRoot('finecode'), sanitizePath(cwd))
}

export function getEngineModelsPath(engine: AgentEngineKind, env: NodeJS.ProcessEnv = process.env): string {
  return join(getEngineAgentDir(engine, env), AGENT_ENGINE_DEFINITIONS[engine].modelsFile)
}
