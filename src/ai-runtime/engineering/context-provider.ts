import { createDiagnosticsProvider, type EngineeringDiagnostic } from './diagnostics-provider'
import type { EngineeringProjectFingerprint } from './project-fingerprint'
import type { EngineeringRepoMap } from './repo-map'
import { estimateTokens } from './token-budget'
import type { EngineeringInstructions } from './types'

export type EngineeringContextProviderKind =
  | 'instructions'
  | 'selectedFiles'
  | 'repoMap'
  | 'fingerprint'
  | 'gitDiff'
  | 'diagnostics'
  | 'terminal'
  | 'custom'

export interface EngineeringContextProviderResult {
  id: string
  kind: EngineeringContextProviderKind
  label: string
  priority: number
  summary: string
  itemCount: number
  tokenEstimate: number
}

export interface EngineeringContextProviderInput {
  selectedFiles: string[]
  instructions: EngineeringInstructions
  repoMap?: EngineeringRepoMap
  fingerprint: EngineeringProjectFingerprint
  diagnostics?: EngineeringDiagnostic[]
}

export interface EngineeringContextProvider {
  id: string
  kind: EngineeringContextProviderKind
  label: string
  priority: number
  collect(input: EngineeringContextProviderInput): Promise<EngineeringContextProviderResult>
}

export class EngineeringContextProviderRegistry {
  private readonly providers = new Map<string, EngineeringContextProvider>()

  register(provider: EngineeringContextProvider): void {
    this.providers.set(provider.id, provider)
  }

  list(): EngineeringContextProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  }

  async collect(input: EngineeringContextProviderInput): Promise<EngineeringContextProviderResult[]> {
    const results = await Promise.all(this.list().map((provider) => provider.collect(input)))
    return results.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  }
}

export function createDefaultEngineeringContextProviderRegistry(): EngineeringContextProviderRegistry {
  const registry = new EngineeringContextProviderRegistry()
  registry.register(createSelectedFilesProvider())
  registry.register(createInstructionsProvider())
  registry.register(createDiagnosticsProvider())
  registry.register(createRepoMapProvider())
  registry.register(createFingerprintProvider())
  return registry
}

export function createSelectedFilesProvider(): EngineeringContextProvider {
  return {
    id: 'selected-files',
    kind: 'selectedFiles',
    label: 'Selected Files',
    priority: 90,
    async collect(input) {
      const summary = input.selectedFiles.slice(0, 20).join('\n')
      return providerResult('selected-files', 'selectedFiles', 'Selected Files', 90, summary, input.selectedFiles.length)
    },
  }
}

export function createInstructionsProvider(): EngineeringContextProvider {
  return {
    id: 'instructions',
    kind: 'instructions',
    label: 'Project Instructions',
    priority: 100,
    async collect(input) {
      return providerResult('instructions', 'instructions', 'Project Instructions', 100, input.instructions.merged, input.instructions.files.length)
    },
  }
}

export function createRepoMapProvider(): EngineeringContextProvider {
  return {
    id: 'repo-map',
    kind: 'repoMap',
    label: 'Repo Map',
    priority: 80,
    async collect(input) {
      const summary = input.repoMap?.summary || ''
      return providerResult('repo-map', 'repoMap', 'Repo Map', 80, summary, input.repoMap?.files.length || 0)
    },
  }
}

export function createFingerprintProvider(): EngineeringContextProvider {
  return {
    id: 'fingerprint',
    kind: 'fingerprint',
    label: 'Project Fingerprint',
    priority: 85,
    async collect(input) {
      return providerResult('fingerprint', 'fingerprint', 'Project Fingerprint', 85, input.fingerprint.summary, input.fingerprint.languages.length + input.fingerprint.buildSystems.length)
    },
  }
}

function providerResult(
  id: string,
  kind: EngineeringContextProviderKind,
  label: string,
  priority: number,
  summary: string,
  itemCount: number
): EngineeringContextProviderResult {
  return {
    id,
    kind,
    label,
    priority,
    summary,
    itemCount,
    tokenEstimate: estimateTokens(summary),
  }
}
