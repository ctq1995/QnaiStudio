import type { EngineeringContextProvider } from './context-provider'
import { estimateTokens } from './token-budget'

export type EngineeringDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface EngineeringDiagnostic {
  file?: string
  line?: number
  column?: number
  severity: EngineeringDiagnosticSeverity
  message: string
  source?: string
}

export function createDiagnosticsProvider(): EngineeringContextProvider {
  return {
    id: 'diagnostics',
    kind: 'diagnostics',
    label: 'Diagnostics',
    priority: 95,
    async collect(input) {
      const diagnostics = input.diagnostics || []
      const summary = formatEngineeringDiagnostics(diagnostics)
      return {
        id: 'diagnostics',
        kind: 'diagnostics',
        label: 'Diagnostics',
        priority: 95,
        summary,
        itemCount: diagnostics.length,
        tokenEstimate: estimateTokens(summary),
      }
    },
  }
}

export function formatEngineeringDiagnostics(diagnostics: EngineeringDiagnostic[]): string {
  if (diagnostics.length === 0) return 'Diagnostics: none'

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
  const infos = diagnostics.filter((diagnostic) => diagnostic.severity === 'info').length
  const lines = [`Diagnostics: ${errors} errors, ${warnings} warnings, ${infos} info, ${diagnostics.length} total`]

  for (const diagnostic of diagnostics.slice(0, 20)) {
    lines.push(formatDiagnosticLine(diagnostic))
  }

  if (diagnostics.length > 20) {
    lines.push(`[diagnostics truncated: ${diagnostics.length - 20} additional items omitted]`)
  }

  return lines.join('\n')
}

function formatDiagnosticLine(diagnostic: EngineeringDiagnostic): string {
  const location = [diagnostic.file, diagnostic.line, diagnostic.column]
    .filter((part) => part !== undefined && part !== '')
    .join(':')
  const source = diagnostic.source ? ` ${diagnostic.source}` : ''
  const prefix = location ? `${location} ` : ''
  return `${prefix}${diagnostic.severity}${source} ${diagnostic.message}`
}
