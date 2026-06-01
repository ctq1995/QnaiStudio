export interface TranscriptPayloadPolicyOptions {
  maxStringLength?: number
  maxArrayItems?: number
  maxObjectKeys?: number
  maxDepth?: number
  redactKeys?: RegExp
  secretPatterns?: TranscriptSecretPattern[]
}

export interface TranscriptSecretPattern {
  name: string
  pattern: RegExp
}

export type TranscriptPayloadPolicyActionType = 'redacted' | 'secret_redacted' | 'truncated' | 'array_truncated' | 'object_truncated' | 'max_depth' | 'circular' | 'converted'

export interface TranscriptPayloadPolicyAction {
  type: TranscriptPayloadPolicyActionType
  path: string
  detail?: string
}

export interface TranscriptPayloadPolicyResult {
  payload: unknown
  actions: TranscriptPayloadPolicyAction[]
}

export type TranscriptPayloadPolicy = (payload: unknown) => TranscriptPayloadPolicyResult

const DEFAULT_MAX_STRING_LENGTH = 4000
const DEFAULT_MAX_ARRAY_ITEMS = 50
const DEFAULT_MAX_OBJECT_KEYS = 80
const DEFAULT_MAX_DEPTH = 8
const DEFAULT_REDACT_KEYS = /(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key)/i
const DEFAULT_SECRET_PATTERNS: TranscriptSecretPattern[] = [
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: 'openai_key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'github_token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g },
  { name: 'aws_access_key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: 'private_key_block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
]
const REDACTED_VALUE = '[redacted]'

export function createTranscriptPayloadPolicy(options: TranscriptPayloadPolicyOptions = {}): TranscriptPayloadPolicy {
  const resolved = {
    maxStringLength: options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    maxArrayItems: options.maxArrayItems ?? DEFAULT_MAX_ARRAY_ITEMS,
    maxObjectKeys: options.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    redactKeys: options.redactKeys ?? DEFAULT_REDACT_KEYS,
    secretPatterns: options.secretPatterns ?? DEFAULT_SECRET_PATTERNS,
  }

  return (payload) => {
    const actions: TranscriptPayloadPolicyAction[] = []
    return {
      payload: sanitizeTranscriptPayload(payload, resolved, 0, '$', new WeakSet<object>(), actions),
      actions,
    }
  }
}

function sanitizeTranscriptPayload(
  value: unknown,
  options: Required<TranscriptPayloadPolicyOptions>,
  depth: number,
  path: string,
  seen: WeakSet<object>,
  actions: TranscriptPayloadPolicyAction[],
): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return sanitizeString(value, options, path, actions)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') {
    actions.push({ type: 'converted', path, detail: 'bigint converted to string' })
    return value.toString()
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    actions.push({ type: 'converted', path, detail: `${typeof value} converted to marker` })
    return `[${typeof value}]`
  }
  if (depth >= options.maxDepth) {
    actions.push({ type: 'max_depth', path, detail: `max depth ${options.maxDepth} reached` })
    return '[max-depth-exceeded]'
  }

  if (Array.isArray(value)) {
    const truncated = value.length > options.maxArrayItems
    if (truncated) {
      actions.push({ type: 'array_truncated', path, detail: `${value.length - options.maxArrayItems} items omitted` })
    }
    return value.slice(0, options.maxArrayItems).map((item, index) => sanitizeTranscriptPayload(item, options, depth + 1, `${path}[${index}]`, seen, actions))
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      actions.push({ type: 'circular', path })
      return '[circular]'
    }
    seen.add(value)

    const allEntries = Object.entries(value as Record<string, unknown>)
    const entries = allEntries.slice(0, options.maxObjectKeys)
    if (allEntries.length > options.maxObjectKeys) {
      actions.push({ type: 'object_truncated', path, detail: `${allEntries.length - options.maxObjectKeys} keys omitted` })
    }

    const sanitized: Record<string, unknown> = {}
    for (const [key, entryValue] of entries) {
      const entryPath = `${path}.${key}`
      const isRedacted = matchesRedactKey(options.redactKeys, key)
      if (isRedacted) {
        actions.push({ type: 'redacted', path: entryPath, detail: `key ${key} matched redaction policy` })
        sanitized[key] = REDACTED_VALUE
      } else {
        sanitized[key] = sanitizeTranscriptPayload(entryValue, options, depth + 1, entryPath, seen, actions)
      }
    }
    seen.delete(value)
    return sanitized
  }

  actions.push({ type: 'converted', path, detail: 'unknown value converted to string' })
  return String(value)
}

function sanitizeString(
  value: string,
  options: Required<TranscriptPayloadPolicyOptions>,
  path: string,
  actions: TranscriptPayloadPolicyAction[],
): string {
  const redacted = redactSecretPatterns(value, options.secretPatterns, path, actions)
  return truncateString(redacted, options.maxStringLength, path, actions)
}

function redactSecretPatterns(
  value: string,
  secretPatterns: TranscriptSecretPattern[],
  path: string,
  actions: TranscriptPayloadPolicyAction[],
): string {
  let redacted = value
  for (const secretPattern of secretPatterns) {
    secretPattern.pattern.lastIndex = 0
    if (!secretPattern.pattern.test(redacted)) continue
    secretPattern.pattern.lastIndex = 0
    redacted = redacted.replace(secretPattern.pattern, () => {
      actions.push({ type: 'secret_redacted', path, detail: `matched ${secretPattern.name}` })
      return REDACTED_VALUE
    })
  }
  return redacted
}

function matchesRedactKey(redactKeys: RegExp, key: string): boolean {
  redactKeys.lastIndex = 0
  return redactKeys.test(key)
}

function truncateString(value: string, maxLength: number, path: string, actions: TranscriptPayloadPolicyAction[]): string {
  if (value.length <= maxLength) return value
  actions.push({ type: 'truncated', path, detail: `${value.length - maxLength} chars omitted` })
  return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`
}
