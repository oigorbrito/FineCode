/** Stable identities and storage/discovery contract for RPC-compatible agent engines. */
export const AGENT_ENGINE_DEFINITIONS = {
  pi: {
    label: 'Pi',
    binary: 'pi',
    windowsBinary: 'pi.cmd',
    packageName: '@earendil-works/pi-coding-agent',
    cliEntry: 'node_modules/@earendil-works/pi-coding-agent/dist/cli.js',
    configDir: '.pi',
    agentDirEnv: 'PI_CODING_AGENT_DIR',
    sessionDirEnv: 'PI_CODING_AGENT_SESSION_DIR',
    modelsFile: 'models.json',
    modelsFormat: 'json',
    storage: 'user-home',
  },
  omp: {
    label: 'OMP',
    binary: 'omp',
    windowsBinary: 'omp.exe',
    packageName: '@oh-my-pi/pi-coding-agent',
    cliEntry: null,
    configDir: '.omp',
    agentDirEnv: 'OMP_CODING_AGENT_DIR',
    runtimeAgentDirEnv: 'PI_CODING_AGENT_DIR',
    sessionDirEnv: 'OMP_CODING_AGENT_SESSION_DIR',
    modelsFile: 'models.yml',
    modelsFormat: 'yaml',
    storage: 'user-home',
  },
  finecode: {
    label: 'FineCode',
    binary: 'finecode',
    windowsBinary: 'finecode.cmd',
    packageName: 'finecode',
    cliEntry: 'node_modules/finecode/dist/bundle/cli.js',
    configDir: '.pi',
    agentDirEnv: 'FINECODE_CODING_AGENT_DIR',
    sessionDirEnv: 'FINECODE_CODING_AGENT_SESSION_DIR',
    legacyAgentDirEnv: 'PI_CODING_AGENT_DIR',
    legacySessionDirEnv: 'PI_CODING_AGENT_SESSION_DIR',
    modelsFile: 'models.json',
    modelsFormat: 'json',
    storage: 'desktop-data',
  },
} as const

export type AgentEngineKind = keyof typeof AGENT_ENGINE_DEFINITIONS
export type AgentEngine = 'auto' | AgentEngineKind

export const AGENT_ENGINE_KINDS = Object.keys(AGENT_ENGINE_DEFINITIONS) as AgentEngineKind[]
