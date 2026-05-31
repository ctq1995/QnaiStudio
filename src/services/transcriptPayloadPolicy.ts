export interface TranscriptPayloadPolicyOptions {
  maxStringLength?: number
  maxArrayItems?: number
  maxObjectKeys?: number
  maxDepth?: number
  redactKeys?: RegExp
}

export type TranscriptPayloadPolicy = (payload: unknown) => unknown

const DEFAULT_MAX_STRING_LENGTH = 4000
const DEFAULT_MAX_ARRAY_ITEMS = 50
const DEFAULT_MAX_OBJECT_KEYS = 80
const DEFAULT_MAX_DEPTH = 8
const DEFAULT_REDACT_KEYS = /(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key)/i
const REDACTED_VALUE = '[redacted]'

export function createTranscriptPayloadPolicy(options: TranscriptPayloadPolicyOptions = {}): TranscriptPayloadPolicy {
  const resolved = {
    maxStringLength: options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    maxArrayItems: options.maxArrayItems ?? DEFAULT_MAX_ARRAY_ITEMS,
    maxObjectKeys: options.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    redactKeys: options.redactKeys ?? DEFAULT_REDACT_KEYS,
  }

  return (payload) => sanitizeTranscriptPayload(payload, resolved, 0, new WeakSet<object>())
}

function sanitizeTranscriptPayload(
  value: unknown,
  options: Required<TranscriptPayloadPolicyOptions>,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return truncateString(value, options.maxStringLength)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`
  if (depth >= options.maxDepth) return '[max-depth-exceeded]'

  if (Array.isArray(value)) {
    return value.slice(0, options.maxArrayItems).map((item) => sanitizeTranscriptPayload(item, options, depth + 1, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]'
    seen.add(value)

    const entries = Object.entries(value as Record<string, unknown>).slice(0, options.maxObjectKeys)
    const sanitized: Record<string, unknown> = {}
    for (const [key, entryValue] of entries) {
      sanitized[key] = options.redactKeys.test(key) ? REDACTED_VALUE : sanitizeTranscriptPayload(entryValue, options, depth + 1, seen)
    }
    return sanitized
  }

  return String(value)
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`
}
