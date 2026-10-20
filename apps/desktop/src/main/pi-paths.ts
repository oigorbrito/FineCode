import { isPathWithin, resolveRealPath } from '../../resources/path-within'
import { AGENT_ENGINE_KINDS, type AgentEngineKind } from '../shared/agent-engine'
import { getEngineSessionsRoot } from './agent-engine-storage'

/**
 * Absolute path to Pi's on-disk session store (`~/.pi/agent/sessions`).
 * Centralized so session listing, lineage, and activity aggregation agree.
 */
export function getSessionsRoot(): string {
  return getEngineSessionsRoot('pi')
}

/**
 * Absolute path to OMP's session store (`~/.omp/agent/sessions`).
 *
 * Each engine keeps its own sessions: OMP writes here, Pi writes under
 * `~/.pi`, and neither is pointed at the other's tree. Both stores use the
 * same per-project directory naming and the same JSONL record shape, so the
 * index can read them side by side.
 */
export function getOmpSessionsRoot(): string {
  return getEngineSessionsRoot('omp')
}

/** FineCode's desktop-owned agent store. Never inherited from the global Pi environment. */
export function getFineCodeSessionsRoot(): string {
  return getEngineSessionsRoot('finecode')
}

/**
 * Every store the session index reads, Pi's first so its rows win a tie.
 * Duplicates are dropped so an env var pointing both engines at one directory
 * cannot list the same session twice.
 */
export function getSessionRoots(): string[] {
  return [...new Set(AGENT_ENGINE_KINDS.map((engine) => getEngineSessionsRoot(engine)))]
}

/**
 * The engine that owns a session file: the store it lives in. Pi's store is
 * checked first so a directory shared by both engines (one env var pointing at
 * the other's) resolves the way getSessionRoots orders it. Null means the path
 * is in no store at all, which is also what makes it unauthorized.
 */
export function engineForSessionPath(candidate: string): AgentEngineKind | null {
  const roots = AGENT_ENGINE_KINDS.map((engine) => [engine, getEngineSessionsRoot(engine)] as const)
  const canonicalCandidate = resolveRealPath(candidate)
  if (!canonicalCandidate) return null
  const matches = roots.flatMap(([engine, root]) => {
    const canonicalRoot = resolveRealPath(root)
    return canonicalRoot && isPathWithin(canonicalRoot, canonicalCandidate) ? [engine] : []
  })
  // A misconfigured environment can point Pi or OMP at FineCode's directory.
  // Refuse ambiguous ownership rather than letting one engine open its sibling's session.
  if (matches.includes('finecode') && matches.length > 1) return null
  return matches[0] ?? null
}

/**
 * The engine a start must use, taken from the session file that start is bound
 * to. A fork source outranks a session path because the fork reads the source
 * before it writes anything. Null when the start creates a new session and so
 * has no owner yet, leaving the caller free to use the configured engine.
 *
 * Shared by the runtime launcher and the permission-mode options so both agree
 * on which engine a start belongs to — the tool names differ per engine, so a
 * disagreement sends OMP Pi's tool list.
 */
export function engineForBoundSession(
  bound: { sessionPath?: string; forkSessionPath?: string }
): AgentEngineKind | null {
  const boundSessionPath = bound.forkSessionPath ?? bound.sessionPath
  return boundSessionPath ? engineForSessionPath(boundSessionPath) : null
}

/** Resolve and validate the engine binding before a session file reaches a child process. */
export function resolveSessionEngineBinding(options: {
  engine?: AgentEngineKind
  sessionPath?: string
  forkSessionPath?: string
}): { engine: AgentEngineKind | undefined; error: string | null } {
  const paths = [options.forkSessionPath, options.sessionPath].filter((path): path is string => path !== undefined)
  const owners = paths.map((path) => engineForSessionPath(path))
  if (owners.some((owner) => owner === null)) {
    return { engine: undefined, error: 'Session path is outside the authorized engine stores' }
  }
  const distinctOwners = new Set(owners)
  if (distinctOwners.size > 1) {
    return { engine: undefined, error: 'Fork source and session path belong to different engines' }
  }
  const owner = owners[0] ?? options.engine
  if (options.engine && owner && options.engine !== owner) {
    return { engine: undefined, error: `Session belongs to ${owner}, not ${options.engine}` }
  }
  return { engine: owner, error: null }
}

/**
 * Authorization gate for a session path the renderer supplied. A path is
 * acceptable when it sits inside any store the index itself reads; anything
 * else is refused, which is what keeps resume/fork/delete inside the stores.
 */
export function isWithinSessionRoots(candidate: string): boolean {
  return engineForSessionPath(candidate) !== null
}
