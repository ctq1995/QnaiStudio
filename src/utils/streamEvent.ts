import type { StreamEvent } from '../types'

export interface ToolEventInfo {
  toolId?: string
  toolName: string
  input: Record<string, unknown>
  output?: string
  success?: boolean
}

const TOOL_NAME_FALLBACK = 'unknown'
const TOOL_ID_KEYS = ['toolUseId', 'tool_use_id', 'toolId', 'tool_id', 'id', 'call_id', 'toolUseID'] as const
const TOOL_NAME_KEYS = ['toolName', 'tool_name', 'name', 'tool'] as const
const INPUT_KEYS = ['input', 'args', 'arguments'] as const
const OUTPUT_KEYS = ['output', 'result', 'response'] as const

type EventPayload = StreamEvent | Record<string, unknown>

export function extractToolEventInfo(event: EventPayload): ToolEventInfo {
  const payload = event as Record<string, unknown>
  const toolName = pickString(payload, TOOL_NAME_KEYS) ?? TOOL_NAME_FALLBACK
  const toolId = pickString(payload, TOOL_ID_KEYS)
  const input = pickRecord(payload, INPUT_KEYS) ?? {}
  const output = normalizeOutput(pickValue(payload, OUTPUT_KEYS))
  const success = typeof payload.success === 'boolean' ? payload.success : undefined

  return {
    toolId,
    toolName,
    input,
    output,
    success,
  }
}

function pickString(payload: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return undefined
}

function pickRecord(payload: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = payload[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return undefined
}

function pickValue(payload: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (key in payload) {
      return payload[key]
    }
  }
  return undefined
}

function normalizeOutput(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (value === undefined || value === null) {
    return undefined
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
